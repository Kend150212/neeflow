import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai-caller'
import { resolveTextAIKey } from '@/lib/resolve-ai-key'
import { THUMBNAIL_STYLES, DEFAULT_THUMBNAIL_STYLE_ID } from '@/lib/thumbnail-styles'

// POST /api/admin/posts/generate-metadata
// AI-generates platform-specific metadata: first comment, Pinterest title/link,
// YouTube 3 titles / tags / category / 3 thumbnail prompts (with style)
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { channelId, content, platforms, thumbnailStyleId } = body as {
        channelId: string
        content: string
        platforms: string[]
        thumbnailStyleId?: string
    }

    if (!channelId || !content) {
        return NextResponse.json({ error: 'Channel and content are required' }, { status: 400 })
    }

    // Get channel context
    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: {
            knowledgeBase: { take: 3, orderBy: { updatedAt: 'desc' } },
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
    const { apiKey, provider: providerName, model } = keyResult.data
    const baseUrl = keyResult.data.baseUrl

    // Build brand context
    const vibeTone = (channel.vibeTone as Record<string, string>) || {}
    const vibeStr = Object.entries(vibeTone).map(([k, v]) => `${k}: ${v}`).join(', ')
    const kbContext = channel.knowledgeBase
        .map((kb) => `[${kb.title}]: ${kb.content.slice(0, 300)}`)
        .join('\n')

    const langMap: Record<string, string> = {
        vi: 'Vietnamese', fr: 'French', de: 'German', ja: 'Japanese',
        ko: 'Korean', zh: 'Chinese', es: 'Spanish', en: 'English',
    }
    const langLabel = langMap[channel.language] || 'English'

    // YouTube categories for auto-selection
    const ytCategories = [
        'Film & Animation', 'Autos & Vehicles', 'Music', 'Pets & Animals',
        'Sports', 'Short Movies', 'Travel & Events', 'Gaming', 'Videoblogging',
        'People & Blogs', 'Comedy', 'Entertainment', 'News & Politics',
        'Howto & Style', 'Education', 'Science & Technology', 'Nonprofits & Activism',
    ]

    // Resolve thumbnail style
    const selectedStyle = THUMBNAIL_STYLES.find(s => s.id === (thumbnailStyleId || DEFAULT_THUMBNAIL_STYLE_ID))
        || THUMBNAIL_STYLES[0]

    // Build the prompt
    const requestedPlatforms = platforms || []
    const hasFacebook = requestedPlatforms.includes('facebook')
    const hasPinterest = requestedPlatforms.includes('pinterest')
    const hasYouTube = requestedPlatforms.includes('youtube')

    const systemPrompt = `You are a world-class social media strategist and YouTube growth expert. Generate platform-specific metadata for a post. Respond ONLY with valid JSON.`

    const userPrompt = `Given this post content for the brand "${channel.displayName}" (${langLabel}):

---
${content.slice(0, 1500)}
---

${vibeStr ? `Brand tone: ${vibeStr}` : ''}
${kbContext ? `Brand context:\n${kbContext}` : ''}

Generate the following metadata as JSON. Write ENTIRELY in ${langLabel} unless noted otherwise:

{
${hasFacebook ? `  "firstComment": "A relevant first comment for the Facebook post — should be engaging, add value (e.g. a question, extra tip, or CTA). 1-2 sentences. Don't repeat the post content.",` : ''}
${hasPinterest ? `  "pinTitle": "A catchy, SEO-optimized pin title (max 100 chars) that describes the content. In ${langLabel}.",
  "pinLink": "A suggested destination URL if the post mentions any link or website. Empty string if no link context.",` : ''}
${hasYouTube ? `  "ytTitles": [
    "Title option 1 — compelling, clickbait-worthy video title (max 100 chars). In ${langLabel}.",
    "Title option 2 — different angle/approach, curiosity-driven. In ${langLabel}.",
    "Title option 3 — with strong viral hook words (e.g. 'CẤM', 'BÍ MẬT', 'SHOCKING', 'PHẢI XEM'). In ${langLabel}."
  ],
  "ytTags": "Comma-separated relevant video tags (8-15 tags) for YouTube SEO. Mix of broad and specific. In ${langLabel}.",
  "ytCategory": "The most relevant category from this list: [${ytCategories.join(', ')}]. Return the exact category name.",
  "ytThumbnailPrompts": [
    "Thumbnail prompt 1: ${selectedStyle.promptTemplate} Adapt to this video's content: describe specific visual elements, text overlays, and composition. Be specific about what the viewer should see. Write in English.",
    "Thumbnail prompt 2: A variation of the same style with different composition, different hook text, and different focal point. Same style: ${selectedStyle.name}. Write in English.",
    "Thumbnail prompt 3: Another variation with a completely different angle but same style. Different pose, color emphasis, or perspective. Same style: ${selectedStyle.name}. Write in English."
  ],` : ''}
}

Rules:
- ALL text fields in ${langLabel} (except ytThumbnailPrompts which MUST be in English)
- YouTube titles should be 3 DIFFERENT approaches — each must feel unique and click-worthy
- Include strong viral hook words in titles (urgency, curiosity, numbers, superlatives)
- First comment should feel natural, not promotional
- YouTube tags should be comma-separated and SEO-optimized
- Each thumbnail prompt must be a detailed, complete image generation prompt
- Return ONLY valid JSON, no extra text`

    try {
        const result = await callAI(providerName, apiKey, model, systemPrompt, userPrompt, baseUrl)

        // Parse JSON response
        let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) cleaned = jsonMatch[0]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsed: Record<string, any>
        try {
            parsed = JSON.parse(cleaned)
        } catch {
            parsed = {}
        }

        return NextResponse.json({
            ...(hasFacebook ? { firstComment: parsed.firstComment || '' } : {}),
            ...(hasPinterest ? {
                pinTitle: parsed.pinTitle || '',
                pinLink: parsed.pinLink || '',
            } : {}),
            ...(hasYouTube ? {
                ytTitles: Array.isArray(parsed.ytTitles) ? parsed.ytTitles : [parsed.ytTitle || '', '', ''],
                ytTags: parsed.ytTags || '',
                ytCategory: parsed.ytCategory || '',
                ytThumbnailPrompts: Array.isArray(parsed.ytThumbnailPrompts) ? parsed.ytThumbnailPrompts : [parsed.ytThumbnailPrompt || '', '', ''],
                thumbnailStyleId: selectedStyle.id,
            } : {}),
            provider: providerName,
            model,
        })
    } catch (error) {
        console.error('AI Generate metadata error:', error)
        const msg = error instanceof Error ? error.message : 'Failed to generate metadata'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
