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
            knowledgeBase: { take: 5, orderBy: { updatedAt: 'desc' } },
            hashtagGroups: true,
            contentTemplates: { take: 5 },
        },
    })
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // ── Quota-aware key resolution ──
    const providerToUse = channel.defaultAiProvider
    const keyResult = await resolveTextAIKey(channelId, providerToUse || null)
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
    let brandContext = ''
    if (brandProfile) {
        const parts: string[] = []
        if (brandProfile.targetAudience) parts.push(`Target Audience: ${brandProfile.targetAudience}`)
        if (brandProfile.contentTypes) parts.push(`Content Types: ${brandProfile.contentTypes}`)
        if (brandProfile.brandValues) parts.push(`Brand Values: ${brandProfile.brandValues}`)
        if (brandProfile.communicationStyle) parts.push(`Communication Style: ${brandProfile.communicationStyle}`)
        if (parts.length > 0) brandContext = parts.join('\n')
    }

    // Knowledge Base (content, not just titles)
    const kbContext = channel.knowledgeBase
        .map(kb => `[${kb.title}]: ${kb.content.slice(0, 300)}`)
        .join('\n')

    // SEO Tags
    const seoTags = ((channel.seoTags as string[]) || []).join(', ')

    // Hashtags
    const hashtags = channel.hashtagGroups.flatMap(g => (g.hashtags as string[]) || []).slice(0, 20).join(' ')

    // Content Templates
    const templateNames = channel.contentTemplates.map(t => t.name).join(', ')

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

    const systemPrompt = `You are an expert SEO copywriter and social media content strategist. You deeply understand how to create compelling, SEO-optimized content ideas that resonate with specific target audiences and drive engagement. Analyze the brand data provided and generate highly relevant, data-driven topic suggestions. Respond ONLY with valid JSON.`

    const userPrompt = `As an expert SEO copywriter and content strategist, brainstorm 8 highly compelling, SEO-optimized social media post ideas for this brand. Analyze ALL the brand data below to create hyper-relevant, targeted topics.

═══ BRAND DATA ═══
Brand: ${channel.displayName}
Description: ${channel.description || 'N/A'}
Language: ${langLabel}
${vibeStr ? `Tone & Style: ${vibeStr}` : ''}
${brandContext ? `\n${brandContext}` : ''}
${kbContext ? `\nKnowledge Base:\n${kbContext}` : ''}
${seoTags ? `SEO Tags: ${seoTags}` : ''}
${hashtags ? `Popular Hashtags: ${hashtags}` : ''}
${templateNames ? `Content Templates: ${templateNames}` : ''}
${bizContext ? `Business: ${bizContext}` : ''}

═══ INSTRUCTIONS ═══
For each topic, provide:
1. A catchy, SEO-friendly headline that's optimized for social engagement
2. The primary target keyword this post should rank for
3. A brief angle explaining the core value (solving a problem, answering a question, providing insight)
4. 2-3 related keywords or long-tail phrases

═══ DIVERSITY RULES ═══
Mix these content types across the 8 suggestions:
- 2 Educational/How-To (teach something valuable to the target audience)
- 2 Engagement/Community (conversation starters, polls, debates, "hot takes")
- 1 Trending/Timely (connect to current events, seasons, or trends)
- 1 Behind-the-Scenes/Story (brand personality, journey, lessons learned)
- 1 Promotional/Value (showcase product/service without being salesy)
- 1 Thought Leadership (industry insights, predictions, expert analysis)

═══ RESPONSE FORMAT ═══
Return EXACTLY this JSON:
{
  "suggestions": [
    {
      "topic": "Short catchy headline (5-12 words)",
      "emoji": "🔥",
      "keyword": "primary target keyword",
      "angle": "Brief description of the content angle and value (1 sentence)",
      "relatedKeywords": ["keyword1", "keyword2"]
    }
  ]
}

CRITICAL:
- Write ALL topics in ${langLabel}
- Topics MUST be specific to THIS brand's niche — NOT generic social media advice
- Each topic should feel like it was crafted by someone who deeply understands this brand
- Include actionable, specific hooks — avoid vague topics like "Tips for success"
- Make headlines click-worthy but NOT clickbait`

    try {
        const result = await callAI(providerName, apiKey, model, systemPrompt, userPrompt, baseUrl)
        let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) cleaned = jsonMatch[0]

        let parsed: { suggestions?: { topic: string; emoji: string; keyword?: string; angle?: string; relatedKeywords?: string[] }[] }
        try { parsed = JSON.parse(cleaned) } catch { parsed = { suggestions: [] } }

        return NextResponse.json({ suggestions: parsed.suggestions || [] })
    } catch (error) {
        console.error('Suggest error:', error)
        return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
    }
}
