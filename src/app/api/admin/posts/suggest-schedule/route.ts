import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai-caller'
import { resolveTextAIKey } from '@/lib/resolve-ai-key'

// POST /api/admin/posts/suggest-schedule
// Returns: monthly day-level heatmap scores + hourly heatmap for a selected day
// + holidays for the channel locale + top recommended slot
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { channelId, platforms, content, timezone, viewMonth, viewYear } = body

    if (!channelId || !platforms?.length) {
        return NextResponse.json({ error: 'Channel and platforms are required' }, { status: 400 })
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const keyResult = await resolveTextAIKey(channelId, channel.defaultAiProvider || null)
    if (!keyResult.ok) {
        return NextResponse.json({ error: keyResult.data.error }, { status: keyResult.status })
    }
    const { apiKey, provider: providerName, model } = keyResult.data
    const baseUrl = keyResult.data.baseUrl

    const langMap: Record<string, string> = {
        vi: 'Vietnamese', fr: 'French', de: 'German', ja: 'Japanese',
        ko: 'Korean', zh: 'Chinese', es: 'Spanish', en: 'English',
    }
    const langLabel = langMap[channel.language] || 'English'

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const userTz = timezone || 'UTC'
    const targetMonth = viewMonth ?? (now.getMonth() + 1)    // 1-12
    const targetYear = viewYear ?? now.getFullYear()

    // Build list of all days in the target month for the AI to score
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate()
    const allDays: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(targetMonth).padStart(2, '0')
        const dd = String(d).padStart(2, '0')
        allDays.push(`${targetYear}-${mm}-${dd}`)
    }

    // Gather past post performance for smarter suggestions
    const pastPosts = await prisma.post.findMany({
        where: { channelId, status: 'PUBLISHED', publishedAt: { not: null } },
        select: { publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 50,
    })
    const historyContext = pastPosts.length > 0
        ? `Past posting times (recent): ${pastPosts.slice(0, 20).map(p => {
            const d = new Date(p.publishedAt!)
            return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        }).join(', ')}`
        : ''

    const todayLabel = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

    const systemPrompt = `You are a social media strategy expert with deep knowledge of platform algorithms and audience behavior. Today is ${todayLabel}. Respond ONLY with valid JSON — no markdown, no backticks.`

    const userPrompt = `Analyze optimal posting times for this channel and return a full monthly engagement heatmap.

Channel: ${channel.displayName}
Language/Audience: ${langLabel}
Platforms: ${(platforms as string[]).join(', ')}
Content preview: ${content ? content.slice(0, 200) : '(no content yet)'}
Today: ${todayStr}
User timezone: ${userTz}
${historyContext}

Platform peak times reference:
- Facebook: Tue-Thu 9 AM-12 PM, Wed 11 AM-1 PM
- Instagram: Mon-Fri 11 AM-1 PM, Stories 7-9 AM
- TikTok: Tue-Thu 2-5 PM, Fri-Sat 7-11 PM
- X/Twitter: Mon-Fri 8 AM-4 PM
- LinkedIn: Tue-Thu 7-8 AM, 12 PM, 5-6 PM
- YouTube: Thu-Fri 2-4 PM
- Pinterest: Fri-Sun 8-11 PM

Generate scores for each day in the month ${targetYear}-${String(targetMonth).padStart(2, '0')} and an hourly breakdown for the single best day.

Return ONLY this JSON:
{
  "dayScores": {
    "YYYY-MM-DD": 0-100,
    ... (one entry per day in the month)
  },
  "holidays": [
    { "date": "YYYY-MM-DD", "name": "Holiday Name" }
  ],
  "bestDay": "YYYY-MM-DD",
  "bestTime": "HH:MM",
  "bestDayHourlyScores": {
    "00": 0-100, "01": 0-100, "02": 0-100, "03": 0-100, "04": 0-100, "05": 0-100,
    "06": 0-100, "07": 0-100, "08": 0-100, "09": 0-100, "10": 0-100, "11": 0-100,
    "12": 0-100, "13": 0-100, "14": 0-100, "15": 0-100, "16": 0-100, "17": 0-100,
    "18": 0-100, "19": 0-100, "20": 0-100, "21": 0-100, "22": 0-100, "23": 0-100
  },
  "engagement": "+42% Expected Engagement",
  "reason": "Brief explanation of why this slot is best (1 sentence)"
}

Rules:
- Score 80-100 = excellent (holidays with shopping/engagement, platform peak days)
- Score 50-79 = good (weekday afternoons)
- Score 20-49 = average
- Score 0-19 = poor (early morning, late night)
- Holidays: list major ${langLabel}-audience holidays in this month (US holidays if English audience, include holiday shopping boosts)
- Days before today (${todayStr}) should score 0
- bestDay must be the highest-scoring future day in the month
- All dates must be in format YYYY-MM-DD
- bestTime must be the peak hour on bestDay as HH:MM (24h format)
- bestDayHourlyScores: score each hour 0-100 based on platform peaks`

    try {
        const result = await callAI(providerName, apiKey, model, systemPrompt, userPrompt, baseUrl || null)

        let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) cleaned = jsonMatch[0]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsed: Record<string, any> = {}
        try {
            parsed = JSON.parse(cleaned)
        } catch (e) {
            console.error('[suggest-schedule] JSON parse failed:', cleaned.slice(0, 300), e)
        }

        // Ensure all days are present in dayScores (fill missing with 0)
        const dayScores: Record<string, number> = {}
        for (const day of allDays) {
            dayScores[day] = typeof parsed.dayScores?.[day] === 'number' ? parsed.dayScores[day] : 0
        }

        return NextResponse.json({
            dayScores,
            holidays: Array.isArray(parsed.holidays) ? parsed.holidays : [],
            bestDay: parsed.bestDay || allDays[0],
            bestTime: parsed.bestTime || '10:00',
            bestDayHourlyScores: parsed.bestDayHourlyScores || {},
            engagement: parsed.engagement || '+30% Expected Engagement',
            reason: parsed.reason || 'Peak engagement window for your platforms',
            provider: providerName,
            model,
        })
    } catch (err) {
        console.error('[suggest-schedule] Error:', err)
        return NextResponse.json({ error: 'AI suggestion failed' }, { status: 500 })
    }
}
