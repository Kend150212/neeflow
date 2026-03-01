/**
 * GET /api/admin/channels/[id]/bot-config/usage
 * Returns bot token usage stats for this channel.
 * Only accessible if user's plan has hasBotUsageAnalytics = true.
 *
 * Query: ?period=today|7d|30d|year
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveLimits } from '@/lib/addon-resolver'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'

function maskApiKey(key: string): string {
    if (!key || key.length < 8) return '***'
    const prefix = key.slice(0, 6)
    const suffix = key.slice(-4)
    return `${prefix}****${suffix}`
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params

    // Check plan feature gate
    const limits = await getEffectiveLimits(session.user.id)
    if (!limits.hasBotUsageAnalytics) {
        return NextResponse.json({ error: 'Feature not available on your plan' }, { status: 403 })
    }

    // Verify channel exists
    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, defaultAiProvider: true },
    })
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Parse period
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '30d'

    const now = new Date()
    let startDate: Date
    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            break
        default: // 30d
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Load all usage records in period
    const rows = await (prisma as any).botTokenUsage.findMany({
        where: {
            channelId,
            createdAt: { gte: startDate },
        },
        select: {
            provider: true,
            model: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
    })

    // Aggregate totals
    let totalPrompt = 0, totalCompletion = 0, totalTokens = 0
    const repliesCount = rows.length
    const byModelMap: Record<string, { model: string; provider: string; tokens: number; promptTokens: number; completionTokens: number; replies: number }> = {}
    const byDateMap: Record<string, { date: string; tokens: number; replies: number }> = {}

    for (const row of rows) {
        totalPrompt += row.promptTokens
        totalCompletion += row.completionTokens
        totalTokens += row.totalTokens

        // By model
        const mKey = row.model
        if (!byModelMap[mKey]) {
            byModelMap[mKey] = { model: row.model, provider: row.provider, tokens: 0, promptTokens: 0, completionTokens: 0, replies: 0 }
        }
        byModelMap[mKey].tokens += row.totalTokens
        byModelMap[mKey].promptTokens += row.promptTokens
        byModelMap[mKey].completionTokens += row.completionTokens
        byModelMap[mKey].replies++

        // By date (YYYY-MM-DD)
        const day = row.createdAt.toISOString().slice(0, 10)
        if (!byDateMap[day]) byDateMap[day] = { date: day, tokens: 0, replies: 0 }
        byDateMap[day].tokens += row.totalTokens
        byDateMap[day].replies++
    }

    const byModel = Object.values(byModelMap).sort((a, b) => b.tokens - a.tokens)
    const byDate = Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date))
    const topModel = byModel[0]?.model || null

    // Get masked API key
    const ownerKey = await getChannelOwnerKey(channelId, channel.defaultAiProvider)
    const apiKeyMasked = ownerKey.apiKey ? maskApiKey(ownerKey.apiKey) : null

    return NextResponse.json({
        period,
        totalTokens,
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
        repliesCount,
        topModel,
        byModel,
        byDate,
        apiKeyMasked,
        provider: ownerKey.provider || channel.defaultAiProvider,
    })
}
