import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAIWithUsage, getDefaultModel } from '@/lib/ai-caller'

/**
 * POST /api/posts/generate-from-db
 * Generates a draft post from a row of external DB data
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const userId = session.user.id
        const { channelId, dataText, tableName, tone = 'viral', platform = 'facebook', language = 'vi' } = await req.json()

        if (!channelId || !dataText) {
            return NextResponse.json({ error: 'channelId and dataText are required' }, { status: 400 })
        }

        // Get user's AI key
        const keyRecord = await prisma.userApiKey.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        })

        if (!keyRecord?.apiKey) {
            return NextResponse.json({ error: 'No AI API key configured. Please set up your AI provider in settings.' }, { status: 400 })
        }

        const provider = keyRecord.provider
        const apiKey = keyRecord.apiKey
        const model = keyRecord.model || getDefaultModel(provider, {})

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

        // Save as draft post
        const post = await prisma.post.create({
            data: {
                content: result.text.trim(),
                status: 'DRAFT',
                authorId: userId,
                channelId,
            },
        })

        return NextResponse.json({ success: true, postId: post.id, content: result.text.trim() })
    } catch (err) {
        console.error('[generate-from-db]', err)
        const msg = err instanceof Error ? err.message : 'Generation failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
