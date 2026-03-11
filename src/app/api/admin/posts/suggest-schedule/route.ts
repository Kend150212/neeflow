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
    const { channelId, platforms, content, timezone, viewMonth, viewYear, selectedDay } = body

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

    // Gather past post performance — convert to user timezone for accurate hour analysis
    const pastPosts = await prisma.post.findMany({
        where: { channelId, status: 'PUBLISHED', publishedAt: { not: null } },
        select: { publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 50,
    })

    // Convert publishedAt to user timezone to get accurate local hour/weekday
    const historyLines: string[] = []
    for (const p of pastPosts.slice(0, 30)) {
        if (!p.publishedAt) continue
        const localDate = new Date(p.publishedAt.toLocaleString('en-US', { timeZone: userTz }))
        const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][localDate.getDay()]
        const hour = String(localDate.getHours()).padStart(2, '0')
        historyLines.push(`${weekday} ${hour}:00`)
    }
    const historyContext = historyLines.length > 0
        ? `Past posting times (in user's timezone ${userTz}): ${historyLines.join(', ')}`
        : 'No posting history yet.'

    // Per-platform day-of-week best score matrix (0=Sun,1=Mon,...,6=Sat)
    // Based on aggregated industry research — gives AI a concrete base to vary from
    const platformDayMatrix: Record<string, number[]> = {
        facebook: [55, 70, 88, 92, 85, 72, 60],  // Sun Mon Tue Wed Thu Fri Sat
        instagram: [58, 85, 90, 88, 82, 78, 65],
        tiktok: [75, 65, 78, 80, 72, 90, 92],
        x: [50, 80, 88, 85, 82, 75, 55],
        linkedin: [35, 78, 92, 90, 85, 70, 30],
        youtube: [65, 60, 70, 72, 85, 90, 75],
        pinterest: [75, 65, 68, 70, 72, 85, 90],
    }

    // Build combined avg day-of-week scores for the selected platforms
    const selectedPlatforms = (platforms as string[]).map((p: string) => p.toLowerCase())
    const dayOfWeekScores: number[] = Array(7).fill(0)
    let platformCount = 0
    for (const p of selectedPlatforms) {
        if (platformDayMatrix[p]) {
            platformDayMatrix[p].forEach((score, i) => {
                dayOfWeekScores[i] += score
            })
            platformCount++
        }
    }
    const avgDayOfWeekScores = platformCount > 0
        ? dayOfWeekScores.map(s => Math.round(s / platformCount))
        : [60, 75, 85, 88, 82, 76, 65]

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayOfWeekContext = avgDayOfWeekScores
        .map((score, i) => `${dayNames[i]}: ${score}`)
        .join(', ')

    // Determine which day to get hourly breakdown for
    // If user selected a specific day, use that; otherwise find best future day
    const hourlyTargetDay = selectedDay || null

    const todayLabel = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: userTz
    })

    const systemPrompt = `You are a social media strategy expert with deep knowledge of platform algorithms and audience engagement behavior. Today is ${todayLabel} in the user's timezone (${userTz}). Respond ONLY with valid JSON — no markdown, no backticks, no extra text.`

    const userPrompt = `Analyze optimal posting times for this social media channel and return a full monthly engagement heatmap.

Channel: ${channel.displayName}
Language/Audience: ${langLabel}
Platforms: ${selectedPlatforms.join(', ')}
Content preview: "${content ? content.slice(0, 200) : '(no content yet)'}"
Today: ${todayStr} (user timezone: ${userTz})

${historyContext}

Day-of-week engagement index for this platform combination (0=low, 100=peak):
${dayOfWeekContext}

Platform hourly peak windows (in user's LOCAL time):
- Facebook: 9-12 AM (Tue-Thu strongest), 1-3 PM (secondary)
- Instagram: 11 AM-1 PM, 7-9 AM for Stories
- TikTok: 2-5 PM (weekdays), 7-11 PM (Fri-Sat)
- X/Twitter: 8 AM-4 PM (Mon-Fri, avoid weekends)
- LinkedIn: 7-8 AM, 12 PM, 5-6 PM (Tue-Thu only — very low on weekends)
- YouTube: 2-4 PM (Thu-Fri strongest)
- Pinterest: 8-11 PM (Fri-Sun strongest)

SCORING RULES:
- Score each day in the month reflecting: day-of-week index above + whether it's a holiday + content type
- Score 80-100 = excellent (platform peak days, holidays with boost potential)
- Score 50-79 = good (solid weekday afternoons)
- Score 20-49 = average (off-peak days)
- Score 0-19 = poor (early morning, late night, past days)
- Days before today (${todayStr}) MUST score 0
- bestDay MUST be the highest-scoring FUTURE day (not today unless tomorrow is worse)
- bestTime MUST reflect the best HOUR for the dominant platform on that specific day
- DO NOT always return the same bestDay — vary based on the day-of-week scores above
- If multiple days have similar scores (within 5 points), prefer the EARLIEST upcoming one
${hourlyTargetDay ? `- hourlyTargetDay is set to "${hourlyTargetDay}" — generate bestDayHourlyScores FOR THIS SPECIFIC DAY (its weekday: ${dayNames[new Date(hourlyTargetDay + 'T12:00:00').getDay()]})` : '- Generate bestDayHourlyScores for the bestDay you choose'}
- Tailor hourly scores to the specific day's platform + time-of-week context

Generate appropriate holidays for a ${langLabel}-speaking audience this month.

Return ONLY this JSON:
{
  "dayScores": {
    "YYYY-MM-DD": 0-100
  },
  "holidays": [
    { "date": "YYYY-MM-DD", "name": "Holiday Name" }
  ],
  "bestDay": "YYYY-MM-DD",
  "bestTime": "HH:MM",
  "hourlyForDay": "${hourlyTargetDay || 'bestDay'}",
  "bestDayHourlyScores": {
    "00": 0-100, "01": 0-100, "02": 0-100, "03": 0-100, "04": 0-100, "05": 0-100,
    "06": 0-100, "07": 0-100, "08": 0-100, "09": 0-100, "10": 0-100, "11": 0-100,
    "12": 0-100, "13": 0-100, "14": 0-100, "15": 0-100, "16": 0-100, "17": 0-100,
    "18": 0-100, "19": 0-100, "20": 0-100, "21": 0-100, "22": 0-100, "23": 0-100
  },
  "engagement": "+XX% Expected Engagement",
  "reason": "Brief 1-sentence explanation referencing the specific day and platform peak"
}`

    // Add current year context note
    const currentYear = new Date().getFullYear()
    const finalPrompt = userPrompt + `\n\nCurrent year is ${currentYear}. All dates must be in format YYYY-MM-DD for the month ${targetYear}-${String(targetMonth).padStart(2, '0')}.`

    try {
        const result = await callAI(providerName, apiKey, model, systemPrompt, finalPrompt, baseUrl || null)

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
            hourlyForDay: parsed.hourlyForDay || parsed.bestDay || allDays[0],
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
