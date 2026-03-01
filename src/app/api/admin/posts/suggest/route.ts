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

    // Random seed to force AI to generate fresh ideas every call
    const seedTime = Date.now()
    const seedMinute = Math.floor(seedTime / 60000)

    // Randomly pick 5 content styles from a big pool to force variety each refresh
    const ALL_CONTENT_STYLES = [
        'Hot Take / Controversial Opinion', 'Myth vs Reality', 'Unpopular Opinion + Why I Stand By It',
        'Step-by-Step Tutorial', 'Quick Tips (3 in 60 seconds)', 'Deep Dive Explainer',
        'Before & After Transformation', 'Day in the Life', 'Behind the Scenes',
        'Customer Success Story (storytelling format)', 'Mistake I Made + Lesson Learned',
        'The Truth About [Topic] Nobody Talks About', 'I Tried X For 30 Days — Here\'s What Happened',
        'Comparison / Head-to-Head Battle', 'Red Flags vs Green Flags', 'Tier List Ranking',
        'This or That Poll', 'Fill in the Blank', 'Would You Rather',
        'Trending Audio / Sound', 'React & Respond to Industry News', 'Stitch / Duet Opportunity',
        'POV: You\'re a [customer type]', 'A Day Without [Product/Service]',
        'Industry Predictions for This Year', 'I Asked 100 Customers This — Their Answers Surprised Me',
        'Why Most People Get [Topic] Wrong', 'The [X] Things I Wish I Knew Earlier',
        'Science-backed Fact + Surprise Twist', 'Local / Community Event Tie-in',
        'Seasonal / Holiday Angle', 'Cultural Moment Leverage', 'Nostalgia Hook',
        'Aesthetic / Vibe Post (no caption needed, visual story)', 'ASMR / Sensory Content',
        'Founder Story / Origin Arc', 'Team Spotlight', 'Process Reveal (how we make it)',
        'FAQ Smash (answer 5 questions in one post)', 'Testimonial Remix',
        'User-Generated Content Prompt', 'Challenge Launch', 'Series Post (episode 1 of X)',
        'Listicle (Top 7, Top 10, Top 13)', 'Stats & Data that Shock', 'Infographic Style',
        'Rant Post (passionate about something in industry)', 'Appreciation / Thank You Post',
        'Aspirational / Dream Big Content', 'Relatable Struggle Post', 'Humor / Meme Format',
    ]
    const shuffled = ALL_CONTENT_STYLES.sort(() => 0.5 - Math.random())
    const pickedStyles = shuffled.slice(0, 10).join('\n- ')

    const ALL_VIBES = [
        'Raw & Unfiltered', 'Cinematic & Moody', 'Gen Z Chaotic Energy', 'Luxury & Aspirational',
        'Warm & Community-driven', 'Edgy & Provocative', 'Playful & Silly',
        'Expert Authority', 'Underdog Story', 'Minimalist Clean',
        'Nostalgic Retro', 'Hype & High Energy', 'ASMR Calm & Soothing',
        'Academic & Research-backed', 'Street-level Authentic',
    ]
    const pickedVibes = shuffled.slice(0, 4).map((_, i) => ALL_VIBES[i % ALL_VIBES.length]).join(', ')

    const systemPrompt = `You are the world's most creative social media content ideation engine. You specialize in generating WILDLY DIVERSE, UNEXPECTED, and HIGHLY ENGAGING content ideas. Your ideas never repeat. You think across all formats, vibes, styles, emotions, and cultural angles. You mix viral formulas with brand-specific nuance. You NEVER generate generic content. Respond ONLY with valid JSON.`

    const userPrompt = `You are generating content topic ideas for a social media brand. Your job is to be MAXIMALLY CREATIVE and DIVERSE.

SEED: ${seedMinute} — use this as your creative starting point to ensure fresh, unique output every single time.

═══ BRAND DATA ═══
Brand: ${channel.displayName}
Description: ${channel.description || 'N/A'}
Language: ${langLabel}
${vibeStr ? `Tone & Style: ${vibeStr}` : ''}
${brandContext ? `\n${brandContext}` : ''}
${kbContext ? `\nKnowledge Base:\n${kbContext}` : ''}
${seoTags ? `SEO Tags: ${seoTags}` : ''}
${hashtags ? `Popular Hashtags: ${hashtags}` : ''}
${bizContext ? `Business: ${bizContext}` : ''}

═══ THIS SESSION'S ASSIGNED CONTENT STYLES ═══
You MUST use these 10 content styles (one per suggestion, in order):
- ${pickedStyles}

═══ THIS SESSION'S ASSIGNED EMOTIONAL VIBES ═══
Rotate through these vibes across your suggestions: ${pickedVibes}

═══ INSTRUCTIONS ═══
Generate EXACTLY 10 content topic ideas. Each must:
1. Match one of the assigned content styles above (in order)
2. Be 100% specific to this brand's niche — NEVER generic
3. Have a different emotional angle from the others
4. Feel like it was written by a creator who deeply knows this brand AND is obsessed with virality
5. Include a punchy 5-12 word headline as the topic
6. Use specific numbers, names, or provocative hooks where possible

═══ ANTI-REPETITION RULES ═══
- NO two topics can start with the same word
- NO two topics can use the same structure (e.g. "How to X" twice)
- NO safe, boring, predictable topics (no "5 tips for...", no "Why X is important")
- Each topic should feel completely different in FORMAT, EMOTION, and ANGLE
- Mix serious ↔ playful ↔ controversial ↔ educational ↔ emotional
- Some topics should be risky/edgy but brand-aligned

═══ RESPONSE FORMAT ═══
Return EXACTLY this JSON (no extra text):
{
  "suggestions": [
    {
      "topic": "Punchy 5-12 word headline",
      "emoji": "🔥",
      "keyword": "primary seo keyword",
      "angle": "One sentence: what makes this fresh and engaging",
      "relatedKeywords": ["keyword1", "keyword2"]
    }
  ]
}

CRITICAL: Write ALL content in ${langLabel}. Be BOLD. Be UNEXPECTED. Create topics that make the creator think "I HAVE to post this."
The topics MUST feel like they were invented RIGHT NOW, not recycled ideas. Seed ${seedMinute} ensures uniqueness.`


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
