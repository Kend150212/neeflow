import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAIWithUsage, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'

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
    return [...new Set(urls)].slice(0, 4) // max 4 images
}

/**
 * POST /api/posts/generate-from-db
 * Generates a draft post from a row of external DB data.
 * Returns: { success, postId, content, imageUrls }
 * Modal behavior:
 *   - 1 row  → caller redirects to /dashboard/posts/compose?content=...&images=...
 *   - N rows → caller calls N times and shows "done" with link to /dashboard/posts
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
            platform = 'facebook',
            language = 'vi',
            rowData,      // full row object for image detection
            columns: rowColumns, // column names list
        } = await req.json()

        if (!channelId || !dataText) {
            return NextResponse.json({ error: 'channelId and dataText are required' }, { status: 400 })
        }

        // Detect image URLs — prefer explicitly configured imageColumn from tablePermissions
        let imageUrls: string[] = []
        if (rowData && rowColumns) {
            // Load config to check if user configured an image column for this table
            const config = await (prisma as any).externalDbConfig.findFirst({
                where: { userId, isActive: true },
                select: { tablePermissions: true },
            })
            const tablePerms = (config?.tablePermissions as Record<string, { imageColumn?: string }>) ?? {}
            const configuredImageCol = tablePerms[tableName]?.imageColumn?.trim()

            if (configuredImageCol && rowData) {
                // Use explicitly configured column
                const val = (rowData as Record<string, unknown>)[configuredImageCol]
                if (typeof val === 'string' && val.startsWith('http')) {
                    imageUrls = [val]
                }
            } else {
                // Fallback: heuristic detection by column name
                imageUrls = detectImageUrls(rowData as Record<string, unknown>, rowColumns as string[])
            }
        }

        // Get AI key for the channel (prefer text AI providers)
        // Try text-AI providers in order: openai → anthropic → google → mistral → cohere → any non-image
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
        // Fallback: default key, as long as it's not image-only
        if (!keyResult) {
            const r = await getChannelOwnerKey(channelId)
            if (r?.apiKey && !IMAGE_ONLY_PROVIDERS.includes(r.provider ?? '')) {
                keyResult = r
            }
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
        const userPrompt = `Based on the following data record from the "${tableName}" table, write a ${toneDesc} ${platform} post.

Data: ${dataText}

Requirements:
- ${langInstruction}
- Optimized for ${platform}
- Include relevant hashtags at the end
- Maximum 2200 characters
- Output ONLY the post content`

        const result = await callAIWithUsage(provider, apiKey, model, systemPrompt, userPrompt)
        const content = result.text.trim()

        // Save as draft post
        const post = await prisma.post.create({
            data: {
                content,
                status: 'DRAFT',
                authorId: userId,
                channelId,
            },
        })

        return NextResponse.json({
            success: true,
            postId: post.id,
            content,
            imageUrls,
        })
    } catch (err) {
        console.error('[generate-from-db]', err)
        const msg = err instanceof Error ? err.message : 'Generation failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
