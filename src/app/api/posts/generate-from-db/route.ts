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
    prompt: string
    width?: number
    height?: number
}

async function generateAiImageForPost(
    imageConfig: ImageConfig,
    channelId: string,
    ownerId: string,
): Promise<string | null> {
    const { provider, model: requestedModel, keySource, prompt, width = 1024, height = 1024 } = imageConfig
    try {
        const keyResult = await resolveImageAIKey(channelId, provider, requestedModel, keySource)
        if (!keyResult.ok) return null
        const { apiKey, provider: resolvedProvider, usingPlatformKey } = keyResult.data

        // Call the generate-image endpoint internally as a fetch — reuse all its logic
        const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/posts/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-call': '1' },
            body: JSON.stringify({ channelId, prompt, width, height, provider: resolvedProvider, model: requestedModel, keySource, _apiKey: apiKey }),
        }).catch(() => null)

        if (!res || !res.ok) {
            // Fallback: call provider directly and create a minimal MediaItem
            return await generateImageDirectly(imageConfig, channelId, ownerId, apiKey, resolvedProvider, usingPlatformKey)
        }

        const data = await res.json()
        return data.mediaItem?.id ?? null
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
    const { prompt, width = 1024, height = 1024, model: requestedModel } = imageConfig

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
            if (!res.ok) return null
            const data = await res.json(); imageUrl = data.data?.[0]?.imageURL
            if (!imageUrl) return null
        } else if (resolvedProvider === 'openai') {
            const model = requestedModel || 'dall-e-3'
            const size = width > height ? '1792x1024' : height > width ? '1024x1792' : '1024x1024'
            const res = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model, prompt, n: 1, size, response_format: 'url' }),
            })
            if (!res.ok) return null
            const data = await res.json(); imageUrl = data.data?.[0]?.url
            if (!imageUrl) return null
        } else if (resolvedProvider === 'gemini') {
            const model = requestedModel || 'gemini-3.1-flash-image-preview'
            const ratio = width / height
            let geminiAspect = '1:1'
            if (Math.abs(ratio - 16 / 9) < 0.05) geminiAspect = '16:9'
            else if (Math.abs(ratio - 9 / 16) < 0.05) geminiAspect = '9:16'
            else if (Math.abs(ratio - 4 / 3) < 0.05) geminiAspect = '4:3'
            else if (Math.abs(ratio - 3 / 4) < 0.05) geminiAspect = '3:4'

            const isImagen = model.includes('imagen')
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${isImagen ? 'predict' : 'generateContent'}`
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify(isImagen
                    ? { instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: geminiAspect } }
                    : { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['Text', 'Image'], imageConfig: { aspectRatio: geminiAspect } } }
                ),
            })
            if (!res.ok) return null
            const data = await res.json()
            if (isImagen) {
                const p = data.predictions?.[0]
                if (!p?.bytesBase64Encoded) return null
                mimeType = p.mimeType || 'image/png'
                imageUrl = `data:${mimeType};base64,${p.bytesBase64Encoded}`
            } else {
                const parts = data.candidates?.[0]?.content?.parts
                if (!parts) return null
                const part = parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData)
                if (!part) return null
                mimeType = part.inlineData.mimeType || 'image/png'
                imageUrl = `data:${mimeType};base64,${part.inlineData.data}`
            }
        } else { return null }
    } catch { return null }

    // Upload to R2
    const tmpPath = path.join(os.tmpdir(), `asoc_dbimg_${randomUUID()}.png`)
    try {
        if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1]
            fs.writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))
        } else {
            const dlRes = await fetch(imageUrl)
            if (!dlRes.ok || !dlRes.body) return null
            const writer = fs.createWriteStream(tmpPath)
            await pipeline(Readable.fromWeb(dlRes.body as Parameters<typeof Readable.fromWeb>[0]), writer)
        }
        const fileBuffer = fs.readFileSync(tmpPath)
        const fileSize = fs.statSync(tmpPath).size
        const ext = mimeType.includes('jpg') || mimeType.includes('jpeg') ? 'jpg' : 'png'
        const shortId = randomUUID().slice(0, 6)
        const dateStr = new Date().toISOString().slice(0, 10)
        const uniqueName = `ai-image ${shortId} - ${dateStr}.${ext}`

        const useR2 = await isR2Configured()
        let publicUrl: string
        if (useR2) {
            const r2Key = generateR2Key(channelId, uniqueName)
            publicUrl = await uploadToR2(fileBuffer, r2Key, mimeType)
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
        }
    } catch (err) {
        console.warn('[generate-from-db] Image upload failed:', err)
    } finally {
        fs.unlink(tmpPath, () => { })
    }
    return null
}

const PLATFORM_HINTS: Record<string, string> = {
    facebook: 'Facebook (feed post, max 2200 chars, can use longer storytelling, include 3-5 hashtags)',
    instagram: 'Instagram (caption, max 2200 chars, heavy hashtags 10-20, visual-first language)',
    twitter: 'X/Twitter (max 280 chars, punchy, 1-2 hashtags max)',
    tiktok: 'TikTok (caption max 2200 chars, Gen-Z friendly, trending hooks, 3-5 hashtags)',
    linkedin: 'LinkedIn (professional tone, max 3000 chars, insights-first, 2-3 hashtags)',
    youtube: 'YouTube (video description, max 5000 chars, include timestamps if relevant, 5-10 hashtags)',
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

        // Fetch channel details for context
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: {
                requireApproval: true,
                displayName: true,
                language: true,
                vibeTone: true,
                knowledgeBase: { take: 8, orderBy: { updatedAt: 'desc' } },
                hashtagGroups: true,
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

        // ── Build channel-aware prompt context (KB, vibeTone, hashtags) ──
        const kbItems = (channel?.knowledgeBase ?? []) as { title: string; content: string }[]
        const kbContext = kbItems.map(kb => `[${kb.title}]: ${kb.content.slice(0, 600)}`).join('\n')
        const vibeTone = (channel?.vibeTone as Record<string, string> | null) ?? {}
        const vibeStr = Object.entries(vibeTone).map(([k, v]) => `${k}: ${v}`).join(', ')
        const allHashtags = (channel?.hashtagGroups ?? []).flatMap((g: { hashtags: unknown }) => (g.hashtags as string[]) || []).slice(0, 20)
        const brandName = channel?.displayName ?? 'Brand'
        const langLabel = language === 'vi' ? 'Vietnamese' : language === 'en' ? 'English' : language

        const systemPrompt = `You are a social media content creator for the brand "${brandName}". Write engaging posts that reflect the brand voice and style. Output only the post content, no explanations.
${vibeStr ? `Brand tone & style: ${vibeStr}` : ''}
${kbContext ? `\nBrand knowledge base:\n${kbContext}` : ''}`

        // Generate content per platform
        const contentPerPlatform: Record<string, string> = {}
        for (const platform of platformList) {
            const hint = PLATFORM_HINTS[platform] || `${platform} (optimized for platform)`
            const userPrompt = `Based on the following product/data record from the "${tableName}" table, write a ${toneDesc} post for ${hint}.

Data: ${dataText}

Requirements:
- Language: ${langLabel}
- Follow platform-specific format and limits described above
${allHashtags.length > 0 ? `- You may use relevant hashtags from this list: ${allHashtags.join(' ')}` : ''}
- Output ONLY the post content`

            const result = await callAIWithUsage(provider, apiKey, model, systemPrompt, userPrompt)
            contentPerPlatform[platform] = result.text.trim()
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
        if (imageConfig && typeof imageConfig === 'object' && imageConfig.prompt) {
            const aiMediaId = await generateAiImageForPost(
                imageConfig as ImageConfig,
                channelId,
                quotaUserId,
            )
            if (aiMediaId) {
                await prisma.postMedia.create({
                    data: { postId: post.id, mediaItemId: aiMediaId, sortOrder: 0 },
                }).catch(() => { /* non-fatal */ })
                aiImageAttached = true
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
