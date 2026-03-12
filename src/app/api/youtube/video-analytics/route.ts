import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/youtube/video-analytics?channelPlatformId=...&videoId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const channelPlatformId = searchParams.get('channelPlatformId')
    const videoId = searchParams.get('videoId')
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    // Default: last 30 days
    const startDate = searchParams.get('startDate') || (() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString().split('T')[0]
    })()

    if (!channelPlatformId || !videoId) {
        return NextResponse.json({ error: 'channelPlatformId and videoId are required' }, { status: 400 })
    }

    const cp = await prisma.channelPlatform.findFirst({
        where: { id: channelPlatformId, platform: 'youtube' },
        select: { accessToken: true, accountId: true },
    })
    if (!cp?.accessToken) {
        return NextResponse.json({ error: 'YouTube account not connected' }, { status: 400 })
    }

    const headers = { Authorization: `Bearer ${cp.accessToken}` }

    try {
        // YouTube Analytics API v2 — per-video daily metrics
        const analyticsUrl = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
        analyticsUrl.searchParams.set('ids', 'channel==MINE')
        analyticsUrl.searchParams.set('startDate', startDate)
        analyticsUrl.searchParams.set('endDate', endDate)
        analyticsUrl.searchParams.set('metrics', 'views,likes,dislikes,comments,estimatedMinutesWatched,averageViewDuration,subscribersGained')
        analyticsUrl.searchParams.set('dimensions', 'day')
        analyticsUrl.searchParams.set('filters', `video==${videoId}`)
        analyticsUrl.searchParams.set('sort', 'day')

        const analyticsRes = await fetch(analyticsUrl.toString(), { headers })
        const analyticsData = await analyticsRes.json()

        if (analyticsData.error) {
            return NextResponse.json(
                { error: analyticsData.error.message || 'Analytics API error', code: analyticsData.error.code },
                { status: 400 }
            )
        }

        // Parse response — columnHeaders + rows
        const cols = (analyticsData.columnHeaders || []).map((h: { name: string }) => h.name)
        const rows = analyticsData.rows || []

        const timeSeries = rows.map((row: (string | number)[]) => {
            const entry: Record<string, string | number> = {}
            cols.forEach((col: string, i: number) => { entry[col] = row[i] })
            return entry
        })

        // Aggregated totals
        const totals = {
            views: 0, likes: 0, comments: 0,
            estimatedMinutesWatched: 0, averageViewDuration: 0,
        }
        for (const row of timeSeries) {
            totals.views += Number(row.views || 0)
            totals.likes += Number(row.likes || 0)
            totals.comments += Number(row.comments || 0)
            totals.estimatedMinutesWatched += Number(row.estimatedMinutesWatched || 0)
        }
        if (timeSeries.length > 0) {
            totals.averageViewDuration = timeSeries.reduce((s: number, r: Record<string, string | number>) => s + Number(r.averageViewDuration || 0), 0) / timeSeries.length
        }

        return NextResponse.json({ timeSeries, totals, startDate, endDate })
    } catch (err) {
        console.error('[YouTube Analytics] error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
