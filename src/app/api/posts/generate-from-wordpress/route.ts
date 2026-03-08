import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAIWithUsage, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'
import { checkPostLimit, incrementPostUsage } from '@/lib/billing/check-limits'
import { resolveImageAIKey } from '@/lib/resolve-ai-key'
import { incrementImageUsage } from '@/lib/ai-quota'
import { randomUUID } from 'crypto'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

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
        console.warn('[generate-from-wordpress] Failed to import image:', imageUrl, err)
        return null
    }
}

// ── Inline AI image generation ────────────────────────────────────────────────
interface ImageConfig {
    provider: string
    model?: string
    keySource?: string
    prompt?: string
    width?: number
    height?: number
    referenceImageUrl?: string  // product image as img2img reference
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
            console.warn('[generate-from-wordpress] resolveImageAIKey failed:', keyResult)
            return null
        }
        const { apiKey, provider: resolvedProvider, usingPlatformKey } = keyResult.data
        return await generateImageDirectly(
            { ...imageConfig, prompt: effectivePrompt, width, height },
            channelId, ownerId, apiKey, resolvedProvider, usingPlatformKey
        )
    } catch (err) {
        console.warn('[generate-from-wordpress] AI image generation failed:', err)
        return null
    }
}

async function generateImageDirectly(
    imageConfig: ImageConfig,
    channelId: string,
    ownerId: string,
    apiKey: string,
    resolvedProvider: string,
    usingPlatformKey: boolean,
): Promise<string | null> {
    const { width = 1024, height = 1024, model: requestedModel } = imageConfig
    const prompt = imageConfig.prompt || ''
    const referenceImageUrl = imageConfig.referenceImageUrl

    let imageUrl: string
    let mimeType = 'image/png'

    try {
        if (resolvedProvider === 'runware') {
            const model = requestedModel || 'runware:100@1'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const taskBody: Record<string, any> = {
                taskType: referenceImageUrl ? 'imageToImage' : 'imageInference',
                taskUUID: randomUUID(),
                positivePrompt: prompt,
                model,
                width,
                height,
                numberResults: 1,
                outputFormat: 'PNG',
            }
            if (referenceImageUrl) {
                taskBody.seedImage = referenceImageUrl
                taskBody.strength = 0.7
            }
            const res = await fetch('https://api.runware.ai/v1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify([taskBody]),
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

            // If we have a reference image and gpt-image-1, use edits endpoint (img2img)
            if (referenceImageUrl && isGptImage1) {
                // Download reference image for multipart
                const refRes = await fetch(referenceImageUrl)
                const refBlob = await refRes.blob()
                const formData = new FormData()
                formData.append('model', 'gpt-image-1')
                formData.append('prompt', prompt)
                formData.append('image', refBlob, 'reference.png')
                formData.append('n', '1')
                formData.append('size', size)
                const res = await fetch('https://api.openai.com/v1/images/edits', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    body: formData,
                })
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(`OpenAI edits error: ${err.error?.message || res.statusText}`)
                }
                const data = await res.json()
                const item = data.data?.[0]
                imageUrl = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url
                if (!imageUrl) throw new Error('OpenAI returned no image data')
            } else {
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
            }

        } else if (resolvedProvider === 'gemini') {
            let model = requestedModel || 'gemini-3.1-flash-image-preview'
            if (!model.includes('image') && !model.includes('imagen')) {
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

            // Build contents with optional reference image
            let contents
            if (referenceImageUrl && !isImagen) {
                // Fetch reference image and include as inline data
                const refRes = await fetch(referenceImageUrl)
                const refBuf = Buffer.from(await refRes.arrayBuffer())
                const refMime = refRes.headers.get('content-type') || 'image/jpeg'
                contents = [{
                    parts: [
                        { inlineData: { mimeType: refMime, data: refBuf.toString('base64') } },
                        { text: `Using this product image as visual reference, create a new marketing image: ${prompt}` },
                    ]
                }]
            } else {
                contents = [{
                    parts: [{ text: `Create a visually striking image that represents this concept:\n\n${prompt}` }]
                }]
            }

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify(isImagen
                    ? { instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: geminiAspect } }
                    : { contents, generationConfig: { responseModalities: ['Text', 'Image'], imageConfig: { aspectRatio: geminiAspect } } }
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
        console.error('[generate-from-wordpress] Provider call failed:', err instanceof Error ? err.message : err)
        return null
    }

    // Upload to R2
    const tmpPath = path.join(os.tmpdir(), `asoc_shopimg_${randomUUID()}.png`)
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
        const uniqueName = `ai-shopify-img ${shortId} - ${dateStr}.${ext}`

        const useR2 = await isR2Configured()
        if (!useR2) {
            console.error('[generate-from-wordpress] R2 not configured, cannot upload AI image')
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
        return mediaItem.id
    } catch (err) {
        console.error('[generate-from-wordpress] Image upload to R2 failed:', err instanceof Error ? err.message : err)
    } finally {
        fs.unlink(tmpPath, () => { })
    }
    return null
}

// ── Platform-specific Instructions ────────────────────────────────────────────
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

const CREATIVE_ANGLES = [
    'Start with a bold, surprising FACT or statistic about this product.',
    'Write from the perspective of a CUSTOMER who just received it — first-person review style.',
    'Open with a vivid SENSORY description (what it looks, smells, feels like). Make the reader feel present.',
    'Use a RELATABLE PROBLEM the reader has, then position this product as the perfect solution.',
    'Start with a short STORY — one sentence scene-setter, then unfold why this product is special.',
    'Write as a COMPARISON — "Most products are X... but this one is Y."',
    'Lead with FOMO — what the reader is missing out on if they don\'t buy this.',
    'Ask ONE provocative question that makes the reader stop scrolling.',
    'Start with a specific DETAIL about the product — a feature, a number, a design element.',
    'Write like you\'re telling a SECRET or insider tip not everyone knows.',
    'Use a CONTRAST structure — Before vs After, Problem vs Solution.',
    'Lead with EMOTION — what feeling does owning this product give? Name it immediately.',
]

/**
 * POST /api/posts/generate-from-wordpress
 * Generates platform-specific content from a Shopify product.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const userId = session.user.id
        const {
            channelId,
            productId,            // ProductCatalog.id — for tracking lastPostedAt / postCount
            productData,          // { name, price, description, category, tags, images }
            importImageUrls,      // string[] — selected product images to import as post media
            tone = 'viral',
            platforms = ['facebook'],
            language = 'vi',
            scheduledAt,
            requestApproval = false,
            asDraft = false,      // true = save as draft, skip publish queue
            imageConfig,          // { provider, model, keySource, prompt, width, height, referenceImageUrl? }
            platformConfig = {},  // { facebook: { postType, ... }, instagram: { postType, ... }, ... }
        } = await req.json()

        if (!channelId || !productData) {
            return NextResponse.json({ error: 'channelId and productData are required' }, { status: 400 })
        }

        const platformList: string[] = Array.isArray(platforms) ? platforms : [platforms]

        // Get AI text key
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

        // Guard: some users set an image-only model (e.g. gpt-image-1, dall-e-3) as their
        // default — these models do NOT support /chat/completions → 403. Fall back to the
        // provider's default text model in that case.
        const IMAGE_ONLY_MODELS = [
            'gpt-image-1', 'dall-e-3', 'dall-e-2',
            'imagen-3.0-generate-002', 'imagen-3.0-fast-generate-002',
            'stable-diffusion-3', 'stable-diffusion-xl',
            'midjourney', 'ideogram-v2',
        ]
        const rawModel = keyResult.model || ''
        const isImageOnly = IMAGE_ONLY_MODELS.some(m => rawModel.toLowerCase().includes(m.toLowerCase()))
            || rawModel.startsWith('runware:')
        const model = (!rawModel || isImageOnly) ? getDefaultModel(provider, {}) : rawModel


        // Post quota check
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

        // Fetch channel context
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
                // fetch platforms so we can look up accountId per slug
                platforms: {
                    select: { id: true, platform: true, accountId: true },
                },
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

        const kbItems = (channel?.knowledgeBase ?? []) as { title: string; content: string }[]
        const kbContext = kbItems.map(kb => `[${kb.title}]: ${kb.content.slice(0, 500)}`).join('\n')
        const vibeTone = (channel?.vibeTone as Record<string, string> | null) ?? {}
        const vibeStr = Object.entries(vibeTone).map(([k, v]) => `${k}: ${v}`).join(', ')
        const allHashtags = (channel?.hashtagGroups ?? []).flatMap((g: { hashtags: unknown }) => (g.hashtags as string[]) || []).slice(0, 20)
        const brandName = channel?.displayName ?? 'Brand'
        const langMap: Record<string, string> = { vi: 'Vietnamese', en: 'English', fr: 'French', de: 'German', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', es: 'Spanish' }
        const langLabel = langMap[language] || langMap[channel?.language || ''] || 'English'

        const templateContext = (channel?.contentTemplates ?? [])
            .filter((t: { platform: string | null; name: string; templateContent: string }) => !t.platform || platformList.includes(t.platform))
            .map((t: { platform: string | null; name: string; templateContent: string }) => `[Template: ${t.name}${t.platform ? ` (${t.platform})` : ''}]: ${t.templateContent.slice(0, 300)}`)
            .join('\n')

        const brandProfile = (channel as unknown as { brandProfile?: { targetAudience?: string; brandValues?: string; communicationStyle?: string } })?.brandProfile
        let brandProfileContext = ''
        if (brandProfile) {
            const parts: string[] = []
            if (brandProfile.targetAudience) parts.push(`Target Audience: ${brandProfile.targetAudience}`)
            if (brandProfile.brandValues) parts.push(`Brand Values: ${brandProfile.brandValues}`)
            if (brandProfile.communicationStyle) parts.push(`Communication Style: ${brandProfile.communicationStyle}`)
            if (parts.length > 0) brandProfileContext = parts.join('\n')
        }

        const bizInfo = (channel as unknown as { businessInfo?: { phone?: string; address?: string; website?: string; socials?: Record<string, string>; custom?: { label: string; url: string }[] } })?.businessInfo
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

        const platformRulesText = platformList
            .filter(p => PLATFORM_INSTRUCTIONS[p])
            .map(p => PLATFORM_INSTRUCTIONS[p])
            .join('\n\n')

        const rowAngle = CREATIVE_ANGLES[(Date.now() + Math.floor(Math.random() * 999)) % CREATIVE_ANGLES.length]

        // Build product data text
        const prod = productData as {
            name: string; price?: number | null; description?: string | null;
            category?: string | null; tags?: string[]; images?: string[]
        }
        const productText = [
            `Product Name: ${prod.name}`,
            prod.price != null ? `Price: $${prod.price.toFixed(2)}` : null,
            prod.category ? `Category: ${prod.category}` : null,
            prod.tags?.length ? `Tags: ${prod.tags.join(', ')}` : null,
            prod.description ? `Description: ${prod.description.slice(0, 800)}` : null,
        ].filter(Boolean).join('\n')

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

        const userPrompt = `Create platform-specific social media content to promote this Shopify product.

Writing angle for this post: ${rowAngle}

Product Information:
${productText}

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
  "visualIdea": "1-2 sentence description of ideal image to accompany this post"
}

CRITICAL: Each platform version MUST be completely different. Use the writing angle above for the hook.
${allHashtags.length > 0 ? `Include 2-5 relevant hashtags from the available list in each version.` : ''}`

        const result = await callAIWithUsage(provider, apiKey, model, systemPrompt, userPrompt)

        let parsed: { contentPerPlatform?: Record<string, string>; visualIdea?: string } = {}
        try {
            // Strip markdown fences + extract the first JSON object
            let cleaned = result.text
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim()
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
            if (jsonMatch) cleaned = jsonMatch[0]
            parsed = JSON.parse(cleaned)
        } catch {
            // Parse failed — but the raw text might itself be valid JSON (AI returned JSON without fences).
            // Try one more time on the raw text before falling back to treating it as plain text.
            try {
                const raw = result.text.trim()
                const inner = JSON.parse(raw)
                if (inner && typeof inner === 'object' && inner.contentPerPlatform) {
                    parsed = inner
                } else {
                    parsed = { contentPerPlatform: Object.fromEntries(platformList.map(p => [p, raw])) }
                }
            } catch {
                const raw = result.text.trim()
                parsed = { contentPerPlatform: Object.fromEntries(platformList.map(p => [p, raw])) }
            }
        }

        const contentPerPlatform = parsed.contentPerPlatform || {}

        // Normalize keys — AI sometimes capitalizes them ("Instagram" vs "instagram")
        const normalizedCpp: Record<string, string> = {}
        for (const [k, v] of Object.entries(contentPerPlatform)) {
            normalizedCpp[k.toLowerCase()] = v
        }

        for (const p of platformList) {
            if (!normalizedCpp[p]) {
                const anyContent = Object.values(normalizedCpp)[0] ||
                    Object.values(contentPerPlatform)[0] ||
                    result.text.trim()
                normalizedCpp[p] = anyContent
            }
        }

        // Determine final status
        const approvalMode = (channel?.requireApproval as string | undefined) ?? 'none'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let finalStatus: any
        if (asDraft) {
            finalStatus = 'DRAFT'
        } else if (scheduledAt) {
            finalStatus = 'SCHEDULED'
        } else {
            finalStatus = 'DRAFT'  // default to draft; publish action handles the rest
        }
        if (!asDraft && approvalMode === 'required' && finalStatus !== 'DRAFT') {
            finalStatus = 'PENDING_APPROVAL'
        } else if (!asDraft && approvalMode === 'optional' && requestApproval && finalStatus !== 'DRAFT') {
            finalStatus = 'PENDING_APPROVAL'
        }

        const firstContent = normalizedCpp[platformList[0]] || Object.values(normalizedCpp)[0] || ''
        const post = await prisma.post.create({
            data: {
                content: firstContent,
                contentPerPlatform: Object.keys(normalizedCpp).length > 0 ? normalizedCpp : undefined,
                status: finalStatus,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                authorId: userId,
                channelId,
                metadata: {
                    source: 'shopify',
                    productName: prod.name,
                    productId: productId || null,
                },
            },
        })

        await incrementPostUsage(quotaUserId).catch(() => { /* non-fatal */ })

        // ── Save platform-specific config to PostPlatformStatus ─────────────
        // This allows Compose to auto-restore settings (postType, board, etc.) when editing.
        const channelPlatforms = (channel?.platforms as { platform: string; accountId: string }[] | undefined) ?? []
        const cfgMap = (platformConfig as Record<string, Record<string, unknown>>)
        if (platformList.length > 0) {
            const platformStatusRows = platformList
                .map(slug => {
                    const accountEntry = channelPlatforms.find(p => p.platform === slug)
                    if (!accountEntry) return null
                    const cfg = cfgMap[slug] ?? {}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const row: any = {
                        postId: post.id,
                        platform: slug,
                        accountId: accountEntry.accountId,
                    }
                    if (Object.keys(cfg).length > 0) row.config = cfg
                    return row
                })
                .filter(Boolean)

            if (platformStatusRows.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (prisma.postPlatformStatus as any).createMany({
                    data: platformStatusRows,
                    skipDuplicates: true,
                }).catch((err: unknown) => console.warn('[generate-from-wordpress] Could not create platform statuses:', err))
            }
        }

        // ── Stamp lastPostedAt + increment postCount on the source product ────
        if (productId) {
            prisma.productCatalog.update({
                where: { id: productId },
                data: {
                    lastPostedAt: new Date(),
                    postCount: { increment: 1 },
                },
            }).catch(err => console.warn('[generate-from-wordpress] Could not stamp product:', err))
        }

        // ── Generate & attach AI image if requested ─────────────────────────
        // AI image gets sortOrder 0 (shown first in post)
        let nextSortOrder = 0
        if (imageConfig && typeof imageConfig === 'object' && imageConfig.provider) {
            const effectivePrompt = (imageConfig.prompt ?? '').trim() || firstContent
            const aiMediaId = await generateAiImageForPost(
                imageConfig as ImageConfig,
                effectivePrompt,
                channelId,
                quotaUserId,
            )
            if (aiMediaId) {
                await prisma.postMedia.create({
                    data: { postId: post.id, mediaItemId: aiMediaId, sortOrder: 0 },
                }).catch(() => { })
                nextSortOrder = 1  // product images will follow after AI image
            }
        }

        // ── Import selected product images ───────────────────────────────────
        // Always import product images regardless of whether an AI image was generated
        if (importImageUrls && Array.isArray(importImageUrls) && importImageUrls.length > 0) {
            const mediaIds: string[] = []
            for (const url of importImageUrls as string[]) {
                const mediaId = await importImageToMedia(url, channelId)
                if (mediaId) mediaIds.push(mediaId)
            }
            if (mediaIds.length > 0) {
                await prisma.postMedia.createMany({
                    data: mediaIds.map((mediaItemId, i) => ({
                        postId: post.id,
                        mediaItemId,
                        sortOrder: nextSortOrder + i,
                    })),
                })
            }
        }

        return NextResponse.json({
            success: true,
            postId: post.id,
            contentPerPlatform,
        })
    } catch (err) {
        console.error('[generate-from-wordpress]', err)
        const msg = err instanceof Error ? err.message : 'Generation failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
