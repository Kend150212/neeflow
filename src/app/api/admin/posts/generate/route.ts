import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai-caller'
import { resolveTextAIKey } from '@/lib/resolve-ai-key'
import { incrementTextUsage } from '@/lib/ai-quota'

// ─── URL detection & article scraping ────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi

async function fetchArticleContent(url: string): Promise<{ text: string; images: string[] }> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) return { text: '', images: [] }
        const html = await res.text()

        // Strip HTML tags, scripts, styles to get text content
        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim()

        // Extract title from meta or title tag
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
        const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
        const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)

        // Extract og:image and twitter:image
        const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
            || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i)
        const twitterImage = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i)
            || html.match(/<meta[^>]*content="([^"]+)"[^>]*name="twitter:image"/i)
        const images: string[] = []
        if (ogImage?.[1]) images.push(ogImage[1])
        else if (twitterImage?.[1]) images.push(twitterImage[1])

        const title = ogTitle?.[1] || titleMatch?.[1] || ''
        const description = ogDesc?.[1] || metaDesc?.[1] || ''

        // Return structured article info, limited to ~3000 chars
        const articleBody = text.slice(0, 2500)
        const articleText = [
            title ? `Title: ${title}` : '',
            description ? `Summary: ${description}` : '',
            `Content: ${articleBody}`,
        ].filter(Boolean).join('\n')

        return { text: articleText, images }
    } catch {
        return { text: '', images: [] }
    }
}

// POST /api/admin/posts/generate — AI-generate post content
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
        channelId, topic, platforms,
        provider: requestedProvider, model: requestedModel,
        includeSourceLink, includeBusinessInfo,
    } = body

    if (!channelId || !topic) {
        return NextResponse.json({ error: 'Channel and topic are required' }, { status: 400 })
    }

    // Get channel for context
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

    // ─── Quota-aware key resolution ───────────────────────────────
    const providerToUse = requestedProvider || channel.defaultAiProvider
    const keyResult = await resolveTextAIKey(channelId, providerToUse || null, requestedModel)
    if (!keyResult.ok) {
        return NextResponse.json({ error: keyResult.data.error, errorType: keyResult.data.errorType }, { status: keyResult.status })
    }
    const { apiKey, provider: providerName, model, usingPlatformKey, ownerId, integrationId } = keyResult.data
    const baseUrl = keyResult.data.baseUrl

    // Build context from knowledge base
    const kbContext = channel.knowledgeBase
        .map((kb) => `[${kb.title}]: ${kb.content.slice(0, 500)}`)
        .join('\n')

    // Vibe & tone
    const vibeTone = (channel.vibeTone as Record<string, string>) || {}
    const vibeStr = Object.entries(vibeTone)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')

    // Hashtags
    const allHashtags = channel.hashtagGroups
        .flatMap((g) => (g.hashtags as string[]) || [])
        .slice(0, 20)

    // Content Templates
    const templateContext = channel.contentTemplates
        .filter(t => !t.platform || (platforms as string[])?.includes(t.platform))
        .map(t => `[Template: ${t.name}${t.platform ? ` (${t.platform})` : ''}]: ${t.templateContent.slice(0, 300)}`)
        .join('\n')

    const langMap: Record<string, string> = {
        vi: 'Vietnamese', fr: 'French', de: 'German', ja: 'Japanese',
        ko: 'Korean', zh: 'Chinese', es: 'Spanish', en: 'English',
    }
    const langLabel = langMap[channel.language] || 'English'

    const platformList = (platforms as string[])?.join(', ') || 'all social media'

    // ── Detect URLs in topic and fetch article content ──
    const urls = topic.match(URL_REGEX) || []
    let articleContext = ''
    const imageUrls: string[] = []
    if (urls.length > 0) {
        const fetches = await Promise.allSettled(
            urls.slice(0, 3).map((u: string) => fetchArticleContent(u))
        )
        const articles = fetches
            .filter((r): r is PromiseFulfilledResult<{ text: string; images: string[] }> => r.status === 'fulfilled' && !!r.value.text)
            .map((r) => r.value)
        if (articles.length > 0) {
            articleContext = `\n\nArticle(s) referenced by the user:\n${articles.map(a => a.text).join('\n---\n')}`
            // Collect all og:image URLs
            for (const a of articles) {
                imageUrls.push(...a.images)
            }
        }
    }

    // Clean topic: keep the user's text but note what URLs were fetched
    const cleanTopic = topic

    // ── Build business info context ──
    const bizInfo = (channel as any).businessInfo as {
        phone?: string; address?: string; website?: string;
        socials?: Record<string, string>;
        custom?: { label: string; url: string }[]
    } | null
    let businessContext = ''
    if (includeBusinessInfo && bizInfo) {
        const parts: string[] = []
        if (bizInfo.phone) parts.push(`Phone: ${bizInfo.phone}`)
        if (bizInfo.address) parts.push(`Address: ${bizInfo.address}`)
        if (bizInfo.website) parts.push(`Website: ${bizInfo.website}`)
        // Social links
        const socialParts: string[] = []
        if (bizInfo.socials) {
            for (const [platform, url] of Object.entries(bizInfo.socials)) {
                if (url) socialParts.push(`${platform}: ${url}`)
            }
        }
        if (bizInfo.custom) {
            for (const c of bizInfo.custom) {
                if (c.label && c.url) socialParts.push(`${c.label}: ${c.url}`)
            }
        }
        if (socialParts.length > 0) parts.push(`Social Links: ${socialParts.join(', ')}`)
        if (parts.length > 0) {
            businessContext = `\nBusiness Contact Info:\n${parts.join('\n')}`
        }
    }

    // ── Source link instruction ──
    const isUrlTopic = urls.length > 0
    const sourceUrlText = isUrlTopic && includeSourceLink
        ? `\n- At the END of the post, append: "\n\n🔗 ${urls[0]}"`
        : ''

    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    const systemPrompt = `You are a world-class social media content creator and copywriter who has managed accounts with millions of followers. You create content that feels native to each platform — never generic, never robotic. You understand how real people post on each platform and you replicate that authentic feel. You write content that gets ENGAGEMENT, not just impressions. Respond ONLY with valid JSON. Do NOT wrap your response in markdown code fences (no \`\`\`json, no \`\`\`). Output raw JSON only.

IMPORTANT CONTEXT: Today's date is ${todayLabel}. Use this as your reference for any date-aware content, trending topics, seasonal references, or "current year" context. Do NOT assume any other year or date.`

    // Build platform-specific instructions with much stronger detail
    const platformInstructions: Record<string, string> = {
        facebook: `FACEBOOK:
- Write like a REAL PERSON sharing a genuine thought, NOT like a brand posting an ad
- Start with a bold statement, personal story, or thought-provoking question that stops scrolling
- Use storytelling format — share a perspective, lesson, or experience related to the topic
- 2-4 paragraphs with blank line breaks between them for readability
- Conversational tone — write as if talking to a friend over coffee
- End with a question that genuinely invites discussion (not generic "What do you think?")
- Use 3-6 emojis naturally sprinkled throughout, NOT clustered at the start
- Add 3-5 hashtags at the very end
- Length: 300-1000 characters
- FEEL: Like a thoughtful friend sharing an insight, NOT a corporation posting content
${businessContext ? '- Include phone/website/address naturally in a sign-off line like "DM us or visit [website] for more" or "Find us at [address]"' : ''}`,

        instagram: `INSTAGRAM:
- Start with a POWERFUL hook line that makes people stop scrolling (bold claim, surprising fact, or emotional statement)
- Write in aesthetic, lifestyle-inspired tone
- Use line breaks between short paragraphs (2-3 lines each)
- Generous emoji use throughout — 8-15 emojis woven in naturally
- Include a CTA: "Save this 🔖" or "Share with someone who needs this 💫" or "Comment your [X] below 👇"
- End with 15-25 hashtags (mix of popular 500K+ tags AND niche-specific tags AND branded tags)
- Keep main caption under 200 words (before hashtags)
- FEEL: Aesthetic, aspirational, shareable — like a lifestyle brand
${businessContext ? '- Include social media handles naturally: "Follow us @handle for daily [content type]" or "Link in bio for more 🔗"' : ''}`,

        tiktok: `TIKTOK:
- ULTRA SHORT caption — under 150 characters total
- Create CURIOSITY with 1 punchy line that makes people want to engage
- Gen-Z / viral tone: authentic, raw, slightly informal, trendy
- 1-2 emojis maximum — less is more
- 3-5 trending/relevant hashtags
- Examples of great hooks: "POV: you finally..." / "Nobody talks about this..." / "This changed everything..." / "Tell me you're a [X] without telling me..."
- Include a micro-CTA: "Follow for more" or "Save this" or "🔗 Link in bio"
- FEEL: Like a real person, not a brand
${businessContext ? '- Mention "🔗 Link in bio" for any business links' : ''}`,

        x: `X (TWITTER):
- MUST be under 280 characters TOTAL including hashtags
- Strong opinion, hot take, or sharp insight format
- Be witty, clever, or thought-provoking — every single word must earn its spot
- 1-2 hashtags maximum, or zero if the tweet is better without them
- No fluff, no filler words
- Formats that work: hot takes, thread starters, "Unpopular opinion:", lists ("3 things I learned from..."), questions
- FEEL: Like a smart person sharing a sharp thought
${businessContext ? '- Only include website link if it fits within 280 chars naturally' : ''}`,

        linkedin: `LINKEDIN:
- Start with a BOLD hook or contrarian take that challenges conventional thinking
- Professional but human — thought-leadership tone, not corporate PR
- Share expertise, lessons learned, behind-the-scenes insights, or industry analysis
- Use short paragraphs (1-3 lines each) with blank lines between them
- End with a thought-provoking question that drives professional discussion
- 3-5 industry-relevant hashtags at the end
- Length: 500-1500 characters — LinkedIn rewards longer, insightful content
- NO emojis or maximum 1-2 very professional ones (📌, ✅, 💡)
- Format options: lesson learned, framework/methodology, industry prediction, personal story + lesson
- FEEL: Like a respected industry expert sharing valuable insight
${businessContext ? '- Include website and phone as a professional footer: "Learn more at [website] | Contact: [phone]"' : ''}`,

        youtube: `YOUTUBE:
- First 2 lines are CRITICAL — they show before "Show More" — make them compelling
- Include key value proposition: what will the viewer learn/gain?
- Add timestamps if the content suggests multiple sections: "0:00 Intro / 1:30 Topic A / ..."
- Natural SEO keywords woven throughout the description
- Include subscribe CTA: "🔔 Subscribe and hit the bell for weekly [content type]!"
- Length: 400-1000 characters
- FEEL: Informative, SEO-optimized, but still engaging
${businessContext ? '- Add a "📞 Contact & Links" section at the end with all business info: phone, website, address, social links' : ''}`,

        pinterest: `PINTEREST:
- Write keyword-rich, SEARCH-OPTIMIZED description — think "what would someone Google to find this?"
- 2-3 concise but descriptive sentences explaining what the pin shows/teaches
- Front-load important keywords in the first sentence
- Include relevant search terms naturally (not stuffed)
- 3-5 hashtags that match search intent
- FEEL: Discoverable, informative, click-worthy
${businessContext ? '- Include website link naturally: "Visit [website] for more [content type]"' : ''}`,
    }

    const selectedPlatforms = (platforms as string[]) || []
    const uniquePlatforms = [...new Set(selectedPlatforms)]
    const platformRulesText = uniquePlatforms
        .filter(p => platformInstructions[p])
        .map(p => platformInstructions[p])
        .join('\n\n')

    // Build brand profile context
    const brandProfile = (channel as any).brandProfile as {
        targetAudience?: string; contentTypes?: string;
        brandValues?: string; communicationStyle?: string;
    } | null
    let brandProfileContext = ''
    if (brandProfile) {
        const parts: string[] = []
        if (brandProfile.targetAudience) parts.push(`Target Audience: ${brandProfile.targetAudience}`)
        if (brandProfile.brandValues) parts.push(`Brand Values: ${brandProfile.brandValues}`)
        if (brandProfile.communicationStyle) parts.push(`Communication Style: ${brandProfile.communicationStyle}`)
        if (parts.length > 0) brandProfileContext = `\n${parts.join('\n')}`
    }

    // Build the contentPerPlatform JSON structure
    const contentPerPlatformJson = uniquePlatforms
        .map(p => `    "${p}": "Complete, ready-to-post content for ${p} following the platform rules above"`)
        .join(',\n')

    // ── Variation engine — force creative diversity on every call ──────────────────
    // 12 content format archetypes: rotate randomly so no two calls produce the same structure
    const CONTENT_FORMATS = [
        { name: 'Personal Story', instruction: 'Write as a first-person story. Open with "I " or "We ". Share a real-seeming experience or lesson tied to the topic. Make it feel personal and vulnerable, not corporate.' },
        { name: 'Bold Hot Take', instruction: 'Open with a controversial or counterintuitive opinion. Challenge conventional wisdom. Be direct, even provocative. Invite pushback.' },
        { name: 'Numbered List', instruction: 'Structure the content as a concise numbered list (3–7 items). Each point must be punchy, specific, and non-obvious. Add a short intro and a CTA.' },
        { name: 'Question-Led', instruction: 'Open with a rhetorical or thought-provoking question that touches a pain point or curiosity. Answer it progressively through the post. End with another question to drive replies.' },
        { name: 'Surprising Stat', instruction: 'Lead with a startling statistic or data point (you may invent a plausible one). Then unpack what it means and why it matters to the audience.' },
        { name: 'Myth Busting', instruction: 'Start with a common misconception: "❌ Myth: ...". Then reveal the truth: "✅ Reality: ...". Explain why the myth persists and what the audience should do instead.' },
        { name: 'Step-by-Step How-To', instruction: 'Provide actionable steps (3–5) the reader can take right now. Use action verbs. Keep each step short and concrete. End with an outcome promise.' },
        { name: 'Behind the Scenes', instruction: 'Share insider perspective. What does the brand/creator do that others don’t see? Give a peek behind the curtain. Tone: honest, revealing, slightly raw.' },
        { name: 'Analogy / Metaphor', instruction: 'Explain the topic through a surprising analogy or metaphor from a completely different field (sports, cooking, movies, nature, etc.). The more unexpected the better.' },
        { name: 'Trend Hook', instruction: 'Open by referencing a current cultural trend, viral moment, or collective mood. Connect it to the topic in a clever, non-forced way. Show cultural awareness.' },
        { name: 'Before / After', instruction: 'Contrast a before state (problem / old way / frustration) with an after state (solution / result / transformation). Use specific, vivid language for both sides.' },
        { name: 'Curated POV', instruction: 'Write as a confident, opinionated expert sharing their perspective. Avoid hedging. Use "Here’s what I know:", "The truth is:", "Stop doing X, start doing Y:" framing.' },
    ]
    const pickedFormat = CONTENT_FORMATS[Math.floor(Math.random() * CONTENT_FORMATS.length)]
    // Unique per-request seed so identical inputs still diverge
    const requestSeed = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    const userPrompt = `Create platform-specific social media content. Generate a SEPARATE, COMPLETE post for EACH platform — do NOT create a generic version.

Topic / Input: ${cleanTopic}
Brand: ${channel.displayName}
Language: ${langLabel}
${vibeStr ? `Tone & Style: ${vibeStr}` : ''}
${brandProfileContext}
${kbContext ? `\nBrand Knowledge:\n${kbContext}` : ''}
${templateContext ? `\nContent Templates (use as style reference):\n${templateContext}` : ''}
${articleContext}
${businessContext ? `\n${businessContext}\nIMPORTANT: You MUST include the business contact information in each platform's content. Follow the platform-specific guidelines on HOW to include it (sign-off, link in bio, footer, etc.). Do NOT ignore this data.` : ''}
${allHashtags.length > 0 ? `\nAvailable hashtags to use/reference: ${allHashtags.join(' ')}` : ''}

Mandatory Content Format for this request (${requestSeed}):
Format: "${pickedFormat.name}"
Instruction: ${pickedFormat.instruction}
Apply this format consistently across ALL platform versions — adapt the platform-specific rules BUT keep the core format structure.

PLATFORM RULES (follow these EXACTLY for each platform):

${platformRulesText}

Respond with this EXACT JSON structure:
{
  "contentPerPlatform": {
${contentPerPlatformJson}
  },
  "hashtags": ["#relevant", "#hashtags", "#for_all_platforms"],
  "hook": "A short attention-grabbing first line (the best hook from all versions)",
  "visualIdea": "1-2 sentence description of an ideal image/visual to accompany this post (for AI image generation — describe style, composition, mood, subject)"
}

CRITICAL RULES:
- Write ENTIRELY in ${langLabel}
- EACH platform version must be COMPLETELY DIFFERENT — different length, different tone, different structure
- Do NOT just copy the same text across platforms with minor tweaks
- TikTok MUST be under 150 chars. X/Twitter MUST be under 280 chars total.
${isUrlTopic ? `- REWRITE the article content into original, engaging posts. Paraphrase creatively — do NOT copy verbatim.
- For article-based content: be thorough (500-2000 chars for long-form platforms like Facebook/LinkedIn/YouTube)` : '- Keep content engaging and platform-appropriate in length'}
- Start each version with a powerful hook/attention-grabber SPECIFIC to that platform's style AND aligned with the mandatory format above
- Sound AUTHENTIC — like a real person posting, NOT like an AI or a corporation
- The visualIdea should describe a compelling image concept (art style, composition, mood, lighting, subject)
- DIVERSITY IS MANDATORY: Do NOT use the same opening word, phrase, or sentence structure across any two platform versions
- FORBIDDEN phrases (never use these): "In today's world", "In the digital age", "Are you ready?", "Game changer", "Dive in", "Unlock your potential", "Exciting news", "We are thrilled"
- Every platform version must feel like it was written by a different writer in a different mood
${sourceUrlText}`

    try {
        const result = await callAI(
            providerName,
            apiKey,
            model,
            systemPrompt,
            userPrompt,
            baseUrl,
        )

        // ── Bulletproof JSON parsing ──────────────────────────────────────────
        // Layer 1: strip ALL variants of markdown code fences
        let cleaned = result
            .replace(/```+json\s*/gi, '')
            .replace(/```+\s*/g, '')
            .trim()

        // Layer 2: extract the outermost { ... } block (handles extra prose before/after)
        const jsonBlock = cleaned.match(/\{[\s\S]*\}/)
        if (jsonBlock) cleaned = jsonBlock[0]

        // Layer 3: sometimes the model double-encodes — detect stringified JSON and parse it out
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            try { cleaned = JSON.parse(cleaned) } catch { /* ignore */ }
        }

        // Helper: strip any remaining code-fence artifacts from individual string values
        const cleanStr = (s: string) => s
            .replace(/```+json\s*/gi, '')
            .replace(/```+\s*/g, '')
            .trim()

        let parsed: {
            content?: string
            contentPerPlatform?: Record<string, string>
            hashtags?: string[]
            hook?: string
            visualIdea?: string
        }
        try {
            const raw = JSON.parse(cleaned)
            // Sanitize each platform string to remove any nested JSON artifacts
            if (raw.contentPerPlatform && typeof raw.contentPerPlatform === 'object') {
                for (const key of Object.keys(raw.contentPerPlatform)) {
                    if (typeof raw.contentPerPlatform[key] === 'string') {
                        raw.contentPerPlatform[key] = cleanStr(raw.contentPerPlatform[key])
                    }
                }
            }
            parsed = raw
        } catch (jsonErr) {
            // Hard failure: log the raw response and return error — never bleed raw JSON into content
            console.error('[generate] JSON.parse failed. Raw AI output:', result.slice(0, 800))
            return NextResponse.json(
                { error: 'AI returned an invalid response. Please try again or switch AI model.', details: String(jsonErr) },
                { status: 500 }
            )
        }

        // Increment usage: count towards quota when using platform key
        if (usingPlatformKey && ownerId) {
            await Promise.all([
                incrementTextUsage(ownerId, false),
                integrationId ? prisma.apiIntegration.update({ where: { id: integrationId }, data: { usageCount: { increment: 1 } } }) : Promise.resolve(),
            ])
        }

        // Build fallback main content from first platform if contentPerPlatform exists
        const hashtags = (parsed.hashtags || []).join(' ')
        let mainContent = parsed.content || ''
        if (!mainContent && parsed.contentPerPlatform) {
            // Try matching from requested platforms first
            const firstPlatform = uniquePlatforms.find(p => parsed.contentPerPlatform?.[p])
            if (firstPlatform) {
                mainContent = parsed.contentPerPlatform[firstPlatform]
            } else {
                // Fallback: use any available platform content
                const anyKey = Object.keys(parsed.contentPerPlatform).find(k => parsed.contentPerPlatform![k])
                if (anyKey) mainContent = parsed.contentPerPlatform[anyKey]
            }
        }
        // Only append hashtags if there's actual content to append to
        const fullContent = mainContent
            ? (hashtags ? `${mainContent}\n\n${hashtags}` : mainContent)
            : (hashtags || result)

        return NextResponse.json({
            content: fullContent,
            contentPerPlatform: parsed.contentPerPlatform || undefined,
            hook: parsed.hook || '',
            hashtags: parsed.hashtags || [],
            visualIdea: parsed.visualIdea || '',
            provider: providerName,
            model,
            articlesFetched: urls.length,
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
            appliedContext: {
                vibe: !!vibeStr,
                knowledge: channel.knowledgeBase.length,
                hashtags: allHashtags.length,
                templates: channel.contentTemplates.filter(t => !t.platform || (platforms as string[])?.includes(t.platform)).length,
                businessInfo: !!businessContext,
                brandProfile: !!brandProfileContext,
            },
        })
    } catch (error) {
        console.error('AI Generate error:', error)
        const msg = error instanceof Error ? error.message : 'Failed to generate content'
        return NextResponse.json(
            { error: msg, details: String(error) },
            { status: 500 }
        )
    }
}
