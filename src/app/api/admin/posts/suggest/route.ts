import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { callAI } from '@/lib/ai-caller'
import { resolveTextAIKey } from '@/lib/resolve-ai-key'
import { incrementTextUsage } from '@/lib/ai-quota'

// POST /api/admin/posts/suggest — AI-generate topic suggestions for a channel
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channelId } = await req.json()
    if (!channelId) {
        return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
    }

    // Verify user has access to this channel
    if (session.user.role !== 'ADMIN') {
        const membership = await prisma.channelMember.findFirst({
            where: { channelId, userId: session.user.id, role: { in: [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER] } },
        })
        if (!membership) {
            return NextResponse.json({ error: 'Access denied to this channel' }, { status: 403 })
        }
    }

    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: {
            knowledgeBase: { take: 8, orderBy: { updatedAt: 'desc' } },
            hashtagGroups: true,
            contentTemplates: { take: 5 },
        },
    })
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // ── Quota-aware key resolution ──
    const providerToUse = channel.defaultAiProvider
    const keyResult = await resolveTextAIKey(channelId, providerToUse || null, channel.defaultAiModel || null)
    if (!keyResult.ok) {
        return NextResponse.json({ error: keyResult.data.error, errorType: keyResult.data.errorType }, { status: keyResult.status })
    }
    const { apiKey, provider: providerName, model, usingPlatformKey, ownerId, integrationId } = keyResult.data
    const baseUrl = keyResult.data.baseUrl

    // ── Build rich channel context ──
    const langMap: Record<string, string> = { vi: 'Vietnamese', en: 'English', fr: 'French', de: 'German', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', es: 'Spanish' }
    const langLabel = langMap[channel.language] || 'English'

    // Vibe & Tone
    const vibeTone = (channel.vibeTone as Record<string, string>) || {}
    const vibeStr = Object.entries(vibeTone).map(([k, v]) => `${k}: ${v}`).join(', ')

    // Brand Profile
    const brandProfile = (channel as any).brandProfile as {
        targetAudience?: string; contentTypes?: string;
        brandValues?: string; communicationStyle?: string;
    } | null
    let targetAudience = ''
    let brandContext = ''
    if (brandProfile) {
        const parts: string[] = []
        if (brandProfile.targetAudience) { parts.push(`Target Audience: ${brandProfile.targetAudience}`); targetAudience = brandProfile.targetAudience }
        if (brandProfile.contentTypes) parts.push(`Content Types: ${brandProfile.contentTypes}`)
        if (brandProfile.brandValues) parts.push(`Brand Values: ${brandProfile.brandValues}`)
        if (brandProfile.communicationStyle) parts.push(`Communication Style: ${brandProfile.communicationStyle}`)
        if (parts.length > 0) brandContext = parts.join('\n')
    }

    // Knowledge Base — extract main topics for clustering
    const kbContext = channel.knowledgeBase
        .map(kb => `[${kb.title}]: ${kb.content.slice(0, 400)}`)
        .join('\n')

    // SEO Tags (use as seed keywords for clustering)
    const seoTags = ((channel.seoTags as string[]) || []).join(', ')

    // Hashtags
    const hashtags = channel.hashtagGroups.flatMap(g => (g.hashtags as string[]) || []).slice(0, 20).join(' ')

    // Business Info
    const bizInfo = (channel as any).businessInfo as {
        phone?: string; address?: string; website?: string;
    } | null
    let bizContext = ''
    if (bizInfo) {
        const parts: string[] = []
        if (bizInfo.website) parts.push(`Website: ${bizInfo.website}`)
        if (bizInfo.address) parts.push(`Location: ${bizInfo.address}`)
        if (parts.length > 0) bizContext = parts.join(', ')
    }

    // ── True random seed (millisecond + crypto-like suffix) ──
    const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase()
    const requestSeed = `${Date.now()}-${randomSuffix}`

    // ── Pick 10 non-repeating content styles + 3 search intent types ──
    const ALL_CONTENT_STYLES = [
        'Controversial Hot Take', 'Myth vs Reality Bust', 'Unpopular Opinion + Proof',
        'Step-by-Step How-To', 'Quick Tips (3 things in 60 seconds)', 'Deep Dive Explainer',
        'Before & After Transformation', 'Behind the Scenes Reveal', 'Day in the Life POV',
        'Customer Pain Point Story', 'Mistake I Made + Lesson', 'The Truth Nobody Talks About',
        'I Tried X For 30 Days Result', 'Head-to-Head Comparison', 'Red Flags vs Green Flags',
        'This or That Poll', 'Fill in the Blank Engagement', 'Industry Predictions This Year',
        'I Asked 100 People — Results Shocked Me', 'Why Most People Get This Wrong',
        'Science-backed Fact + Twist', 'Seasonal / Event Tie-in', 'Founder Origin Story',
        'FAQ Smash (5 questions in 1 post)', 'Aspirational Dream Content',
        'Rant Post (passionate industry take)', 'Humor / Relatable Meme Format',
        'Stats & Data That Shock', 'Series Episode (episodic content arc)',
        'Challenge or Contest Launch', 'User Pain Journey Arc', 'Product Demo in Use',
        'Local Community Angle', 'Trend Newsjacking', 'Nostalgia Hook',
        'Storytelling with Cliffhanger', 'Tutorial with Shortcut Reveal',
        'List: Top X Things (unexpected ranking)', 'Analogy from Unexpected Field',
        'The Cost of NOT Doing X', 'What Experts Won\'t Tell You'
    ]

    // Fisher-Yates shuffle for true randomness
    const shuffled = [...ALL_CONTENT_STYLES]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const pickedStyles = shuffled.slice(0, 9).join('\n- ')

    // ── 3 search intent clusters to organize topics ──
    const SEARCH_INTENTS = [
        ['Informational — audience seeking to learn or understand something'],
        ['Commercial — audience comparing or evaluating options before a decision'],
        ['Navigational/Brand — audience searching for this brand specifically or its use cases'],
    ]
    const pickedIntents = SEARCH_INTENTS.map(i => i[0]).join('\n- ')

    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

    const systemPrompt = `You are an expert SEO content strategist AND social media virality expert. You combine deep keyword research methodology with social media psychology to generate content ideas that are both search-rankable AND highly shareable. You NEVER generate generic ideas. Every idea is specific, fresh, and grounded in real audience pain points. Today is ${todayLabel}. Respond ONLY with raw valid JSON — no markdown fences.`

    const userPrompt = `Perform creative content ideation using SEO keyword cluster methodology for a social media brand. Generate 9 COMPLETELY UNIQUE topic ideas grouped into 3 clusters.

REQUEST SEED (guarantees fresh output): ${requestSeed}

━━━ BRAND PROFILE ━━━
Brand Name: ${channel.displayName}
Description: ${channel.description || 'N/A'}
Language: ${langLabel}
${vibeStr ? `Tone & Vibe: ${vibeStr}` : ''}
${brandContext ? `\n${brandContext}` : ''}
${targetAudience ? `\nAudience Niche: ${targetAudience}` : ''}
${kbContext ? `\nBrand Knowledge Base (use these topics as seed keywords for clustering):\n${kbContext}` : ''}
${seoTags ? `SEO Focus Tags: ${seoTags}` : ''}
${hashtags ? `Brand Hashtags: ${hashtags}` : ''}
${bizContext ? `Business Info: ${bizContext}` : ''}

━━━ METHODOLOGY: SEO TOPIC CLUSTER APPROACH ━━━
You MUST organize the 9 topics into exactly 3 search intent clusters:
- ${pickedIntents}

For each cluster, generate 3 topics that target DIFFERENT keyword angles within that intent.
Think like an SEO strategist: what are people actually searching for? What long-tail questions do they ask?

━━━ THIS SESSION'S CONTENT FORMATS ━━━
Each topic MUST use a DIFFERENT format from this assigned list (in order):
- ${pickedStyles}

━━━ RULES ━━━
1. Each topic must have a PUNCHY HEADLINE (5-12 words max) — provocative, specific, curiosity-driven
2. Include the primary SEO-style keyword people would actually search for
3. Include 2-3 related long-tail keywords / LSI keywords
4. Explain in ONE sentence WHY this topic will perform well (search + social angle)
5. Each cluster should feel like a coherent content pillar strategy
6. Mix search volume signals: some broad (high volume), some niche (low competition, high intent)
7. NO TWO topics can start with the same word or use the same structure
8. Topics must feel SPECIFIC to this brand's niche — ZERO generic ideas
9. Make topics that create urgency, FOMO, or satisfy a specific search intent

━━━ STRICTLY FORBIDDEN ━━━
- Generic phrases: "5 tips for", "Why X is important", "How to be successful"
- Starting with the same word twice
- Repeating the same emotional angle
- Topics that could apply to ANY brand in any industry

━━━ RESPONSE FORMAT ━━━
Return EXACTLY this JSON structure (raw JSON, no markdown):
{
  "suggestions": [
    {
      "topic": "Punchy 5-12 word headline",
      "emoji": "🔥",
      "keyword": "primary seo keyword phrase",
      "angle": "One sentence: search intent + viral angle that makes this unique",
      "relatedKeywords": ["long-tail keyword 1", "LSI keyword 2", "question keyword 3"],
      "cluster": "Informational|Commercial|Brand"
    }
  ]
}

Generate exactly 9 suggestions — 3 per cluster. Write ALL in ${langLabel}. Every topic must feel invented RIGHT NOW for seed ${requestSeed}. Be BOLD, be SPECIFIC, be UNEXPECTED.`

    try {
        const result = await callAI(providerName, apiKey, model, systemPrompt, userPrompt, baseUrl)
        let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) cleaned = jsonMatch[0]

        let parsed: { suggestions?: { topic: string; emoji: string; keyword?: string; angle?: string; relatedKeywords?: string[]; cluster?: string }[] }
        try { parsed = JSON.parse(cleaned) } catch { parsed = { suggestions: [] } }

        // Increment usage
        if (usingPlatformKey && ownerId) {
            await Promise.all([
                incrementTextUsage(ownerId, false),
                integrationId ? prisma.apiIntegration.update({ where: { id: integrationId }, data: { usageCount: { increment: 1 } } }) : Promise.resolve(),
            ])
        }

        return NextResponse.json({ suggestions: parsed.suggestions || [] })
    } catch (error) {
        console.error('Suggest error:', error)
        return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
    }
}
