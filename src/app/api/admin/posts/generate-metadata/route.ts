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

    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    const systemPrompt = `You are a world-class social media strategist and YouTube growth expert. Generate platform-specific metadata for a post. Respond ONLY with valid JSON.

IMPORTANT CONTEXT: Today's date is ${todayLabel}. Use this as your reference for any time-sensitive content, trends, or year context. Do NOT assume any other year or date.`

    const userPrompt = `Given this post content for the brand "${channel.displayName}" (${langLabel}):

---
${content.slice(0, 1500)}
---

${vibeStr ? `Brand tone: ${vibeStr}` : ''}
${kbContext ? `Brand context:\n${kbContext}` : ''}

Generate the following metadata. Write ENTIRELY in ${langLabel} unless noted.
Respond ONLY with a valid JSON object — no markdown, no explanation.

Required JSON fields:
${hasFacebook ? `- "firstComment": string — A natural, engaging first comment to auto-post under the Facebook post. Should add value: a follow-up question, interesting fact, or CTA. 1-3 sentences. Do NOT repeat the main post content.` : ''}
${hasPinterest ? `- "pinTitle": string — A catchy, SEO-optimized pin title (max 100 chars). In ${langLabel}.
- "pinLink": string — A destination URL if the post mentions a website/link, otherwise empty string.` : ''}
${hasYouTube ? `- "ytTitles": array of exactly 3 strings — Three different, compelling YouTube video title options (max 100 chars each). Each must use a different hook strategy:
  1. Curiosity/question style (e.g. starts with a compelling why/how)
  2. List/how-to style (numbers, steps)
  3. Viral hook style using power words in ${langLabel} (urgency, surprise, exclusivity)
  All in ${langLabel}.
- "ytTags": string — 8-15 comma-separated YouTube video tags. Mix broad + specific. In ${langLabel}.
- "ytCategory": string — Best matching YouTube category from: [${ytCategories.join(', ')}]. Return the exact category name.
- "ytThumbnailPrompts": array of exactly 3 strings — Three different YouTube thumbnail image generation prompts.
  Each prompt in English. Style to use: ${selectedStyle.name} (${selectedStyle.promptTemplate}).
  Each prompt must fully describe: subject, composition, text overlay, colors, mood. Make them different from each other.` : ''}

IMPORTANT:
- Return ONLY a valid JSON object. No trailing commas. No comments.
- All string fields should contain ACTUAL content, not placeholder descriptions.
- Arrays must contain exactly the number of items specified.
- JSON must be parseable by JSON.parse() without any modification.`

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
        } catch (jsonErr) {
            // Log raw output for debugging so we can see what the model actually returned
            console.error('[generate-metadata] JSON.parse failed. Raw output:', cleaned.slice(0, 500), 'Error:', jsonErr)
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
