import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAIWithUsage, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'
import { checkIntegrationAccess } from '@/lib/integration-access'
import { checkPostLimit, incrementPostUsage } from '@/lib/billing/check-limits'
import { resolveImageAIKey } from '@/lib/resolve-ai-key'
import { incrementImageUsage } from '@/lib/ai-quota'
import { randomUUID } from 'crypto'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// Detect image URLs from row data by column name heuristic
function detectImageUrls(row: Record<string, unknown>, columns: string[]): string[] {
    const imageKeywords = /image|photo|img|thumbnail|picture|avatar|banner|cover|media/i
    const urls: string[] = []
    for (const col of columns) {
        if (!imageKeywords.test(col)) continue
        const val = row[col]
        if (typeof val === 'string' && val.startsWith('http') && /\.(jpg|jpeg|png|gif|webp|avif)/i.test(val)) {
            urls.push(val)
        }
    }
    return [...new Set(urls)].slice(0, 4)
}

/**
 * Fetch an external image URL and upload to R2, or store as external URL reference.
 * Returns the created MediaItem id, or null on failure.
 */
async function importImageToMedia(imageUrl: string, channelId: string): Promise<string | null> {
    try {
        const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) return null
        const contentType = res.headers.get('content-type') || 'image/jpeg'
        if (!contentType.startsWith('image/')) return null
        const arrayBuffer = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Derive file name from URL
        const urlPath = new URL(imageUrl).pathname
        const fileName = urlPath.split('/').pop()?.split('?')[0] || 'image.jpg'

        const useR2 = await isR2Configured()
        if (useR2) {
            const r2Key = generateR2Key(channelId, fileName)
            const publicUrl = await uploadToR2(buffer, r2Key, contentType)
            const mediaItem = await prisma.mediaItem.create({
                data: {
                    channelId,
                    url: publicUrl,
                    thumbnailUrl: publicUrl,
                    storageFileId: r2Key,
                    type: 'image',
                    source: 'upload',
                    originalName: fileName,
                    fileSize: buffer.length,
                    mimeType: contentType,
                    aiMetadata: { storage: 'r2', r2Key, importedFrom: imageUrl },
                },
            })
            return mediaItem.id
        } else {
            // No R2 — store the original external URL directly
            const mediaItem = await prisma.mediaItem.create({
                data: {
                    channelId,
                    url: imageUrl,
                    thumbnailUrl: imageUrl,
                    type: 'image',
                    source: 'upload',
                    originalName: fileName,
                    fileSize: buffer.length,
                    mimeType: contentType,
                    aiMetadata: { storage: 'external_url', importedFrom: imageUrl },
                },
            })
            return mediaItem.id
        }
    } catch (err) {
        console.warn('[generate-from-db] Failed to import image:', imageUrl, err)
        return null
    }
}

// ── Inline AI image generation for per-row image attachment ─────────────────
interface ImageConfig {
    provider: string
    model?: string
    keySource?: string   // 'byok' | 'plan'
    prompt?: string      // optional — if empty, post content is used as prompt
    width?: number
    height?: number
}

async function generateAiImageForPost(
    imageConfig: ImageConfig,
    effectivePrompt: string,
    channelId: string,
    ownerId: string,
): Promise<string | null> {
    const { provider, model: requestedModel, keySource, width = 1024, height = 1024 } = imageConfig
    try {
        const keyResult = await resolveImageAIKey(channelId, provider, requestedModel, keySource)
        if (!keyResult.ok) {
            console.warn('[generate-from-db] resolveImageAIKey failed:', keyResult)
            return null
        }
        const { apiKey, provider: resolvedProvider, usingPlatformKey } = keyResult.data
        console.log('[generate-from-db] Generating AI image via', resolvedProvider, 'prompt length:', effectivePrompt.length)
        return await generateImageDirectly(
            { ...imageConfig, prompt: effectivePrompt, width, height },
            channelId, ownerId, apiKey, resolvedProvider, usingPlatformKey
        )
    } catch (err) {
        console.warn('[generate-from-db] AI image generation failed:', err)
        return null
    }
}

/** Direct image generation + R2 upload, returning MediaItem id */
async function generateImageDirectly(
    imageConfig: ImageConfig,
    channelId: string,
    ownerId: string,
    apiKey: string,
    resolvedProvider: string,
    usingPlatformKey: boolean,
): Promise<string | null> {
    const { width = 1024, height = 1024, model: requestedModel } = imageConfig
    // effectivePrompt is passed via imageConfig.prompt (set earlier by caller)
    const prompt = imageConfig.prompt || ''

    let imageUrl: string
    let mimeType = 'image/png'

    try {
        if (resolvedProvider === 'runware') {
            const model = requestedModel || 'runware:100@1'
            const res = await fetch('https://api.runware.ai/v1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify([{ taskType: 'imageInference', taskUUID: randomUUID(), positivePrompt: prompt, model, width, height, numberResults: 1, outputFormat: 'PNG' }]),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(`Runware error: ${err.error || res.statusText}`)
            }
            const data = await res.json()
            imageUrl = data.data?.[0]?.imageURL
            if (!imageUrl) throw new Error('Runware returned no image URL')

        } else if (resolvedProvider === 'openai') {
            const model = requestedModel || 'dall-e-3'
            const isGptImage1 = model === 'gpt-image-1'
            let size = '1024x1024'
            if (isGptImage1) {
                if (width > height) size = '1536x1024'
                else if (height > width) size = '1024x1536'
            } else {
                if (width > height) size = '1792x1024'
                else if (height > width) size = '1024x1792'
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reqBody: Record<string, any> = { model, prompt, n: 1, size }
            if (!isGptImage1) reqBody.response_format = 'url'
            const res = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(reqBody),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(`OpenAI error: ${err.error?.message || res.statusText}`)
            }
            const data = await res.json()
            const item = data.data?.[0]
            if (!item) throw new Error('OpenAI returned no image data')
            imageUrl = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url
            if (!imageUrl) throw new Error('OpenAI returned no image URL')

        } else if (resolvedProvider === 'gemini') {
            let model = requestedModel || 'gemini-3.1-flash-image-preview'
            // Reject text-only models — only image/imagen models support image generation
            if (!model.includes('image') && !model.includes('imagen')) {
                console.warn(`[generate-from-db] Gemini model "${model}" doesn't support image gen — using default`)
                model = 'gemini-3.1-flash-image-preview'
            }
            const ratio = width / height
            let geminiAspect = '1:1'
            if (Math.abs(ratio - 16 / 9) < 0.05) geminiAspect = '16:9'
            else if (Math.abs(ratio - 9 / 16) < 0.05) geminiAspect = '9:16'
            else if (Math.abs(ratio - 4 / 3) < 0.05) geminiAspect = '4:3'
            else if (Math.abs(ratio - 3 / 4) < 0.05) geminiAspect = '3:4'
            else if (Math.abs(ratio - 4 / 5) < 0.05) geminiAspect = '4:5'

            const isImagen = model.includes('imagen')
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${isImagen ? 'predict' : 'generateContent'}`
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify(isImagen
                    ? { instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: geminiAspect } }
                    : {
                        contents: [{ parts: [{ text: `Create a visually striking image that represents this concept:\n\n${prompt}` }] }],
                        generationConfig: { responseModalities: ['Text', 'Image'], imageConfig: { aspectRatio: geminiAspect } },
                    }
                ),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(`Gemini error: ${err.error?.message || res.statusText}`)
            }
            const data = await res.json()

            if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`)

            if (isImagen) {
                const p = data.predictions?.[0]
                if (!p?.bytesBase64Encoded) throw new Error('Gemini Imagen returned no image')
                mimeType = p.mimeType || 'image/png'
                imageUrl = `data:${mimeType};base64,${p.bytesBase64Encoded}`
            } else {
                const candidates = data.candidates
                if (!candidates?.[0]?.content?.parts) {
                    const reason = candidates?.[0]?.finishReason || 'unknown'
                    throw new Error(`Gemini returned no content (finishReason: ${reason}). Model: ${model}`)
                }
                const imagePart = candidates[0].content.parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData)
                if (!imagePart) throw new Error(`Gemini returned no image part. Model: ${model}`)
                mimeType = imagePart.inlineData.mimeType || 'image/png'
                imageUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`
            }
        } else {
            throw new Error(`Unsupported image provider: ${resolvedProvider}`)
        }
    } catch (err) {
        console.error('[generate-from-db] Provider call failed:', err instanceof Error ? err.message : err)
        return null
    }

    // Upload to R2
    const tmpPath = path.join(os.tmpdir(), `asoc_dbimg_${randomUUID()}.png`)
    try {
        if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1]
            fs.writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))
        } else {
            const dlRes = await fetch(imageUrl)
            if (!dlRes.ok || !dlRes.body) throw new Error('Failed to download image from URL')
            const writer = fs.createWriteStream(tmpPath)
            await pipeline(Readable.fromWeb(dlRes.body as Parameters<typeof Readable.fromWeb>[0]), writer)
        }
        const fileBuffer = fs.readFileSync(tmpPath)
        const fileSize = fs.statSync(tmpPath).size
        const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
        const shortId = randomUUID().slice(0, 6)
        const now = new Date()
        const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`
        const uniqueName = `ai-image ${shortId} - ${dateStr}.${ext}`

        const useR2 = await isR2Configured()
        if (!useR2) {
            console.error('[generate-from-db] R2 not configured, cannot upload AI image')
            return null
        }
        const r2Key = generateR2Key(channelId, uniqueName)
        const publicUrl = await uploadToR2(fileBuffer, r2Key, mimeType)
        const mediaItem = await prisma.mediaItem.create({
            data: {
                channelId,
                url: publicUrl,
                thumbnailUrl: publicUrl,
                storageFileId: r2Key,
                type: 'image',
                source: 'ai_generated',
                originalName: uniqueName,
                fileSize,
                mimeType,
                aiMetadata: { storage: 'r2', r2Key, provider: resolvedProvider },
            },
        })
        if (usingPlatformKey) await incrementImageUsage(ownerId).catch(() => { })
        console.log('[generate-from-db] AI image uploaded to R2:', publicUrl)
        return mediaItem.id
    } catch (err) {
        console.error('[generate-from-db] Image upload to R2 failed:', err instanceof Error ? err.message : err)
    } finally {
        fs.unlink(tmpPath, () => { })
    }
    return null
}

// Rich per-platform instructions — same quality as compose route
const PLATFORM_INSTRUCTIONS: Record<string, string> = {
    facebook: `FACEBOOK:
- Write like a REAL PERSON sharing a genuine thought, NOT like a brand posting an ad
- Start with a bold statement, personal story, or thought-provoking question that stops scrolling
- 2-4 paragraphs with blank line breaks between them for readability
- Conversational tone — write as if talking to a friend
- End with a question that genuinely invites discussion
- Use 3-6 emojis naturally sprinkled throughout, NOT clustered at the start
- Add 3-5 hashtags at the very end
- Length: 300-1000 characters`,
    instagram: `INSTAGRAM:
- Start with a POWERFUL hook line (bold claim, surprising fact, or emotional statement)
- Aesthetic, lifestyle-inspired tone with generous emoji use (8-15 emojis)
- Include a CTA: "Save this 🔖" or "Comment below 👇"
- End with 15-25 hashtags (mix of popular + niche + branded tags)
- Keep main caption under 200 words (before hashtags)`,
    tiktok: `TIKTOK:
- ULTRA SHORT caption — under 150 characters total
- Gen-Z / viral tone: authentic, raw, punchy
- 1-2 emojis maximum
- 3-5 trending/relevant hashtags
- Hook examples: "POV: you finally..." / "Nobody talks about this..." / "This changed everything..."`,
    twitter: `X (TWITTER):
- MUST be under 280 characters TOTAL including hashtags
- Strong opinion, hot take, or sharp insight
- 1-2 hashtags maximum
- No fluff — every word must earn its spot`,
    x: `X (TWITTER):
- MUST be under 280 characters TOTAL including hashtags
- Strong opinion, hot take, or sharp insight
- 1-2 hashtags maximum`,
    linkedin: `LINKEDIN:
- Start with a BOLD hook or contrarian take
- Professional but human — thought-leadership tone
- Short paragraphs (1-3 lines) with blank lines between them
- End with a thought-provoking question
- 3-5 industry-relevant hashtags
- Length: 500-1500 characters`,
    youtube: `YOUTUBE:
- First 2 lines are CRITICAL — they show before "Show More" — make them compelling
- Include value proposition and SEO keywords
- Add subscribe CTA: "🔔 Subscribe for more!"
- Length: 400-1000 characters`,
    pinterest: `PINTEREST:
- Keyword-rich, search-optimized description
- 2-3 sentences explaining what the pin shows/teaches
- Front-load important keywords in the first sentence
- 3-5 hashtags that match search intent`,
}

/**
 * POST /api/posts/generate-from-db
 * Generates platform-specific content from a row of external DB data.
 * Automatically detects and imports image URLs from the row into media.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const userId = session.user.id
        if (!await checkIntegrationAccess(userId, 'external_db'))
            return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.', messageVi: 'Nâng cấp gói để sử dụng tính năng External DB.' }, { status: 403 })
        const {
            channelId,
            dataText,
            tableName,
            tone = 'viral',
            platforms = ['facebook'],
            language = 'vi',
            rowData,
            columns: rowColumns,
            scheduledAt,
            requestApproval = false,
            imageConfig,   // { provider, model, keySource, prompt, width, height } — optional AI image
        } = await req.json()

        if (!channelId || !dataText) {
            return NextResponse.json({ error: 'channelId and dataText are required' }, { status: 400 })
        }

        const platformList: string[] = Array.isArray(platforms) ? platforms : [platforms]

        // Detect image URLs — prefer explicitly configured imageColumn from tablePermissions
        let imageUrls: string[] = []
        if (rowData && rowColumns) {
            const config = await (prisma as any).externalDbConfig.findUnique({
                where: { userId_channelId: { userId, channelId } },
                select: { tablePermissions: true },
            })
            const tablePerms = (config?.tablePermissions as Record<string, { imageColumn?: string }>) ?? {}
            const configuredImageCol = tablePerms[tableName]?.imageColumn?.trim()

            if (configuredImageCol) {
                const val = (rowData as Record<string, unknown>)[configuredImageCol]
                if (typeof val === 'string' && val.startsWith('http')) {
                    imageUrls = [val]
                }
            } else {
                imageUrls = detectImageUrls(rowData as Record<string, unknown>, rowColumns as string[])
            }
        }

        // Get AI key (skip image-only providers)
        const TEXT_AI_PROVIDERS = ['openai', 'anthropic', 'google', 'mistral', 'cohere', 'groq', 'together']
        const IMAGE_ONLY_PROVIDERS = ['runware', 'stability', 'ideogram', 'midjourney', 'dalle']

        let keyResult: Awaited<ReturnType<typeof getChannelOwnerKey>> | null = null
        for (const prov of TEXT_AI_PROVIDERS) {
            const r = await getChannelOwnerKey(channelId, prov)
            if (r?.apiKey && !IMAGE_ONLY_PROVIDERS.includes(r.provider ?? '')) {
                keyResult = r
                break
            }
        }
        if (!keyResult) {
            const r = await getChannelOwnerKey(channelId)
            if (r?.apiKey && !IMAGE_ONLY_PROVIDERS.includes(r.provider ?? '')) keyResult = r
        }

        if (!keyResult?.apiKey) {
            return NextResponse.json({
                error: 'No text AI key configured. Please add an OpenAI, Anthropic, or Google Gemini key in AI API Keys settings.',
            }, { status: 400 })
        }

        const provider = keyResult.provider!
        const apiKey = keyResult.apiKey!
        const model = keyResult.model || getDefaultModel(provider, {})

        // ── Post quota check (uses channel owner's plan, not caller's) ──
        const quotaUserId = keyResult.ownerId ?? userId
        const quotaErr = await checkPostLimit(quotaUserId)
        if (quotaErr) {
            return NextResponse.json({
                error: quotaErr.message,
                errorVi: quotaErr.messageVi,
                code: 'POST_LIMIT_REACHED',
                limit: quotaErr.limit,
                current: quotaErr.current,
            }, { status: 402 })
        }

        // Fetch channel with ALL settings used by compose route
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: {
                requireApproval: true,
                displayName: true,
                language: true,
                vibeTone: true,
                businessInfo: true,
                brandProfile: true,
                knowledgeBase: { take: 8, orderBy: { updatedAt: 'desc' } },
                hashtagGroups: true,
                contentTemplates: { take: 5 },
            },
        })

        const toneMap: Record<string, string> = {
            professional: 'professional and authoritative',
            casual: 'casual, warm, and friendly',
            viral: 'exciting and viral-worthy with emojis',
            promotional: 'persuasive and promotional with a clear CTA',
            storytelling: 'narrative storytelling style',
        }
        const toneDesc = toneMap[tone] ?? 'engaging'

        // ── Build channel context (mirrors compose route) ──
        const kbItems = (channel?.knowledgeBase ?? []) as { title: string; content: string }[]
        const kbContext = kbItems.map(kb => `[${kb.title}]: ${kb.content.slice(0, 500)}`).join('\n')
        const vibeTone = (channel?.vibeTone as Record<string, string> | null) ?? {}
        const vibeStr = Object.entries(vibeTone).map(([k, v]) => `${k}: ${v}`).join(', ')
        const allHashtags = (channel?.hashtagGroups ?? []).flatMap((g: { hashtags: unknown }) => (g.hashtags as string[]) || []).slice(0, 20)
        const brandName = channel?.displayName ?? 'Brand'
        const langMap: Record<string, string> = { vi: 'Vietnamese', en: 'English', fr: 'French', de: 'German', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', es: 'Spanish' }
        const langLabel = langMap[language] || langMap[channel?.language || ''] || 'English'

        // Content templates
        const templateContext = (channel?.contentTemplates ?? [])
            .filter((t: { platform: string | null; name: string; templateContent: string }) => !t.platform || platformList.includes(t.platform))
            .map((t: { platform: string | null; name: string; templateContent: string }) => `[Template: ${t.name}${t.platform ? ` (${t.platform})` : ''}]: ${t.templateContent.slice(0, 300)}`)
            .join('\n')

        // Brand profile (targetAudience, brandValues, communicationStyle)
        const brandProfile = (channel as any)?.brandProfile as {
            targetAudience?: string; brandValues?: string; communicationStyle?: string;
        } | null
        let brandProfileContext = ''
        if (brandProfile) {
            const parts: string[] = []
            if (brandProfile.targetAudience) parts.push(`Target Audience: ${brandProfile.targetAudience}`)
            if (brandProfile.brandValues) parts.push(`Brand Values: ${brandProfile.brandValues}`)
            if (brandProfile.communicationStyle) parts.push(`Communication Style: ${brandProfile.communicationStyle}`)
            if (parts.length > 0) brandProfileContext = parts.join('\n')
        }

        // Business info (phone, address, website, socials)
        const bizInfo = (channel as any)?.businessInfo as {
            phone?: string; address?: string; website?: string;
            socials?: Record<string, string>;
            custom?: { label: string; url: string }[]
        } | null
        let businessContext = ''
        if (bizInfo) {
            const parts: string[] = []
            if (bizInfo.phone) parts.push(`Phone: ${bizInfo.phone}`)
            if (bizInfo.address) parts.push(`Address: ${bizInfo.address}`)
            if (bizInfo.website) parts.push(`Website: ${bizInfo.website}`)
            const socialParts: string[] = []
            if (bizInfo.socials) {
                for (const [pl, url] of Object.entries(bizInfo.socials)) {
                    if (url) socialParts.push(`${pl}: ${url}`)
                }
            }
            if (bizInfo.custom) {
                for (const c of bizInfo.custom) {
                    if (c.label && c.url) socialParts.push(`${c.label}: ${c.url}`)
                }
            }
            if (socialParts.length > 0) parts.push(`Social Links: ${socialParts.join(', ')}`)
            if (parts.length > 0) businessContext = parts.join('\n')
        }

        // Platform rules (rich, like compose route)
        const platformRulesText = platformList
            .filter(p => PLATFORM_INSTRUCTIONS[p])
            .map(p => PLATFORM_INSTRUCTIONS[p])
            .join('\n\n')

        // Creative angles rotate per row to ensure variety
        const CREATIVE_ANGLES = [
            'Start with a bold, surprising FACT or statistic about this product.',
            'Write from the perspective of a GUEST who just stayed/used this — first-person review style.',
            'Open with a vivid SENSORY description (what it looks, smells, feels like). Make the reader feel present.',
            'Use a RELATABLE PROBLEM the reader has, then position this as the perfect solution.',
            'Start with a short STORY — one sentence scene-setter, then unfold why this is special.',
            'Write as a COMPARISON — "Most [category] are X... but this one is Y."',
            'Lead with FOMO — what the reader is missing out on if they don\'t experience this.',
            'Ask ONE provocative question that makes the reader stop scrolling.',
            'Start with a specific DETAIL about the product — a feature, a number, a design element.',
            'Write like you\'re telling a SECRET or insider tip not everyone knows.',
            'Use a CONTRAST structure — Before vs After, Day vs Night, Alone vs Together.',
            'Lead with EMOTION — what feeling does this product give? Name it immediately.',
        ]
        const rowAngle = CREATIVE_ANGLES[(Date.now() + Math.floor(Math.random() * 999)) % CREATIVE_ANGLES.length]

        // Build JSON structure for all platforms in ONE call (same as compose)
        const contentPerPlatformJson = platformList
            .map(p => `    "${p}": "Complete ready-to-post content for ${p}"`)
            .join(',\n')

        const systemPrompt = `You are a world-class social media copywriter for the brand "${brandName}". You write authentic, platform-native content that drives ENGAGEMENT — never generic, never robotic. Respond ONLY with valid JSON.

CRITICAL RULES:
- Every platform version must be COMPLETELY DIFFERENT in structure, length, and tone
- NEVER use the same opening phrase or structure across platforms
- Sound like a real human posting — NOT like a corporation
- Write ENTIRELY in ${langLabel}
${vibeStr ? `Brand Voice: ${vibeStr}` : ''}
${brandProfileContext ? `\n${brandProfileContext}` : ''}
${kbContext ? `\nBrand Knowledge Base:\n${kbContext}` : ''}`

        const userPrompt = `Create platform-specific social media content based on this product/room data.

Writing angle for this post: ${rowAngle}

Product Data (from "${tableName}" table):
${dataText}

Brand: ${brandName}
Tone: ${toneDesc}
Language: ${langLabel}
${templateContext ? `\nContent Templates (use as style reference):\n${templateContext}` : ''}
${businessContext ? `\nBusiness Info (include naturally in posts):\n${businessContext}` : ''}
${allHashtags.length > 0 ? `\nAvailable hashtags: ${allHashtags.join(' ')}` : ''}

PLATFORM RULES (follow EXACTLY):
${platformRulesText || platformList.map(p => `${p}: write an optimized post for ${p}`).join('\n')}

Respond with EXACT JSON:
{
  "contentPerPlatform": {
${contentPerPlatformJson}
  },
  "visualIdea": "1-2 sentence description of ideal image to accompany this post (style, composition, mood)"
}

CRITICAL: Each platform version MUST be completely different. Use the writing angle above for the hook.
${allHashtags.length > 0 ? `Include 2-5 relevant hashtags from the available list in each version.` : ''}`

        const result = await callAIWithUsage(provider, apiKey, model, systemPrompt, userPrompt)

        // Parse JSON response (same as compose route)
        let parsed: { contentPerPlatform?: Record<string, string>; visualIdea?: string } = {}
        try {
            let cleaned = result.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
            if (jsonMatch) cleaned = jsonMatch[0]
            parsed = JSON.parse(cleaned)
        } catch {
            // Fallback: use raw text as content for all platforms
            const fallback = result.text.trim()
            parsed = { contentPerPlatform: Object.fromEntries(platformList.map(p => [p, fallback])) }
        }

        const contentPerPlatform = parsed.contentPerPlatform || {}
        // Ensure all requested platforms have content
        for (const p of platformList) {
            if (!contentPerPlatform[p]) {
                const anyContent = Object.values(contentPerPlatform)[0] || result.text.trim()
                contentPerPlatform[p] = anyContent
            }
        }

        // Save draft post with AI-generated content
        // Determine final status: respect channel approval mode
        const approvalMode = (channel?.requireApproval as string | undefined) ?? 'none'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let finalStatus: any = scheduledAt ? 'SCHEDULED' : 'DRAFT'
        if (approvalMode === 'required' && finalStatus !== 'DRAFT') {
            finalStatus = 'PENDING_APPROVAL'
        } else if (approvalMode === 'optional' && requestApproval && finalStatus !== 'DRAFT') {
            finalStatus = 'PENDING_APPROVAL'
        }
        const firstContent = contentPerPlatform[platformList[0]] || ''
        const post = await prisma.post.create({
            data: {
                content: firstContent,
                contentPerPlatform: Object.keys(contentPerPlatform).length > 0 ? contentPerPlatform : undefined,
                status: finalStatus,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                authorId: userId,
                channelId,
                // Tag post with its creation source for display in dashboard
                metadata: {
                    source: 'external_db',
                    tableName,
                },
            },
        })

        // Increment post usage counter toward plan's monthly limit
        await incrementPostUsage(quotaUserId).catch(() => { /* non-fatal */ })

        // ── Generate & attach AI image if requested ────────────────────────
        let aiImageAttached = false
        if (imageConfig && typeof imageConfig === 'object' && imageConfig.provider) {
            // Use user's prompt if provided, otherwise fall back to generated post content
            const effectivePrompt = (imageConfig.prompt ?? '').trim() || firstContent
            console.log('[generate-from-db] AI image requested, prompt source:', imageConfig.prompt ? 'user' : 'post-content')
            const aiMediaId = await generateAiImageForPost(
                imageConfig as ImageConfig,
                effectivePrompt,
                channelId,
                quotaUserId,
            )
            if (aiMediaId) {
                await prisma.postMedia.create({
                    data: { postId: post.id, mediaItemId: aiMediaId, sortOrder: 0 },
                }).catch(() => { /* non-fatal */ })
                aiImageAttached = true
                console.log('[generate-from-db] AI image attached to post', post.id)
            } else {
                console.warn('[generate-from-db] AI image generation returned null, skipping attachment')
            }
        }

        // ── Auto-import images from DB row → upload to media → attach to post ──
        if (!aiImageAttached && imageUrls.length > 0) {
            const mediaIds: string[] = []
            for (const url of imageUrls) {
                const mediaId = await importImageToMedia(url, channelId)
                if (mediaId) mediaIds.push(mediaId)
            }
            if (mediaIds.length > 0) {
                await prisma.postMedia.createMany({
                    data: mediaIds.map((mediaItemId, i) => ({
                        postId: post.id,
                        mediaItemId,
                        sortOrder: i,
                    })),
                })
            }
        }

        return NextResponse.json({
            success: true,
            postId: post.id,
            contentPerPlatform,
            imageUrls,
        })
    } catch (err) {
        console.error('[generate-from-db]', err)
        const msg = err instanceof Error ? err.message : 'Generation failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
