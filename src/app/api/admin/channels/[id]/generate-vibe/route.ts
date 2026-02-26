import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai-caller'
import { resolveTextAIKey } from '@/lib/resolve-ai-key'
import { incrementTextUsage } from '@/lib/ai-quota'

// POST /api/admin/channels/[id]/generate-vibe — AI-generate Vibe & Tone from short description
// API key priority:
//   1. Channel owner's UserApiKey (preferred provider → default → any)
//   2. Admin's shared ApiIntegration (fallback, subject to quota)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params
    const body = await req.json()
    const { channelName, description, language, provider: requestedProvider, model: requestedModel } = body

    if (!channelName || !description) {
        return NextResponse.json({ error: 'Channel name and description are required' }, { status: 400 })
    }

    // ─── Quota-aware key resolution ───
    const keyResult = await resolveTextAIKey(channelId, requestedProvider, requestedModel)
    if (!keyResult.ok) {
        return NextResponse.json({ error: keyResult.data.error, errorType: keyResult.data.errorType }, { status: keyResult.status })
    }
    const { apiKey, provider, model, usingPlatformKey, ownerId, integrationId } = keyResult.data

    const langMap: Record<string, string> = {
        vi: 'Vietnamese', fr: 'French', de: 'German', ja: 'Japanese',
        ko: 'Korean', zh: 'Chinese', es: 'Spanish', en: 'English',
    }
    const langLabel = langMap[language] || 'English'

    const systemPrompt = `You are a brand voice strategist and tone-of-voice expert. Generate comprehensive brand voice guidelines based on a channel description. Respond ONLY with valid JSON.`

    const userPrompt = `Create detailed Vibe & Tone (brand voice) guidelines for this channel:

Channel Name: ${channelName}
Description: ${description}
Language: ${langLabel}

Respond with this exact JSON structure:
{
  "vibeTone": {
    "personality": "3-4 sentences describing the brand personality. Include specific traits, emotional tone, and how the brand should feel to the audience. Be detailed and actionable.",
    "writingStyle": "3-4 sentences about writing style. Cover: formality level, sentence structure preference, humor usage, storytelling approach, use of emojis, punctuation style. Be specific.",
    "vocabulary": "3-4 sentences about vocabulary. Include: preferred words/phrases, words to avoid, technical level, industry jargon usage, tone markers. Give concrete examples.",
    "targetAudience": "3-4 sentences about target audience. Cover: demographics (age, gender, location), psychographics (interests, values, lifestyle), pain points, content consumption habits.",
    "brandValues": "3-4 sentences about brand values. Include: core mission, key differentiators, brand promise, emotional benefits, trust factors."
  }
}

Requirements:
- All content must be in ${langLabel}
- Be specific and actionable, not generic
- Include concrete examples where possible
- Each field should be detailed enough to guide content creation
- Reflect the unique identity of this specific brand`

    try {
        const result = await callAI(provider, apiKey, model, systemPrompt, userPrompt)

        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(cleaned)

        // Track usage when using platform key
        if (usingPlatformKey && ownerId) {
            await Promise.all([
                incrementTextUsage(ownerId, false),
                integrationId ? prisma.apiIntegration.update({ where: { id: integrationId }, data: { usageCount: { increment: 1 } } }) : Promise.resolve(),
            ])
        }

        return NextResponse.json({ vibeTone: parsed.vibeTone })
    } catch (error) {
        console.error('AI Vibe & Tone error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate Vibe & Tone' },
            { status: 500 }
        )
    }
}
