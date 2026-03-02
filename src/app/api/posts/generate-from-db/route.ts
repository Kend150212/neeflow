import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAIWithUsage, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'

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
        } = await req.json()

        if (!channelId || !dataText) {
            return NextResponse.json({ error: 'channelId and dataText are required' }, { status: 400 })
        }

        const platformList: string[] = Array.isArray(platforms) ? platforms : [platforms]

        // Detect image URLs — prefer explicitly configured imageColumn from tablePermissions
        let imageUrls: string[] = []
        if (rowData && rowColumns) {
            const config = await (prisma as any).externalDbConfig.findFirst({
                where: { userId, isActive: true },
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

        const langInstruction = language === 'vi'
            ? 'Viết bằng Tiếng Việt tự nhiên, phù hợp mạng xã hội.'
            : 'Write in natural English for social media.'

        const toneMap: Record<string, string> = {
            professional: 'professional and authoritative',
            casual: 'casual, warm, and friendly',
            viral: 'exciting and viral-worthy with emojis',
            promotional: 'persuasive and promotional with a clear CTA',
            storytelling: 'narrative storytelling style',
        }
        const toneDesc = toneMap[tone] ?? 'engaging'

        const systemPrompt = `You are a social media content creator. Your only job is to write social media posts. Output only the post content, no explanations.`

        // Generate content per platform
        const contentPerPlatform: Record<string, string> = {}
        for (const platform of platformList) {
            const hint = PLATFORM_HINTS[platform] || `${platform} (optimized for platform)`
            const userPrompt = `Based on the following data record from the "${tableName}" table, write a ${toneDesc} post for ${hint}.

Data: ${dataText}

Requirements:
- ${langInstruction}
- Follow platform-specific format and limits described above
- Output ONLY the post content`

            const result = await callAIWithUsage(provider, apiKey, model, systemPrompt, userPrompt)
            contentPerPlatform[platform] = result.text.trim()
        }

        // Save draft post with AI-generated content
        const firstContent = contentPerPlatform[platformList[0]] || ''
        const post = await prisma.post.create({
            data: {
                content: firstContent,
                contentPerPlatform: Object.keys(contentPerPlatform).length > 0 ? contentPerPlatform : undefined,
                status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
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

        // ── Auto-import images from DB row → upload to media → attach to post ──
        if (imageUrls.length > 0) {
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
