import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { summarizeSession } from '@/lib/customer-memory'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { getDefaultModel } from '@/lib/ai-caller'

/**
 * GET /api/cron/session-summarize
 * 
 * Hourly cron job that finds all expired sessions and summarizes them.
 * An "expired" session: conversation has lastMessageAt older than sessionTimeoutHours
 * AND the aiSummary for this session hasn't been written yet.
 * 
 * Set up via Vercel Cron (vercel.json) or external scheduler.
 */
export async function GET(req: NextRequest) {
    // Simple secret check for cron security
    const secret = req.nextUrl.searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && secret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    let processed = 0
    let errors = 0

    // Find all channels with Smart Memory enabled
    const botConfigs = await prisma.botConfig.findMany({
        where: { enableSmartMemory: true },
        select: {
            channelId: true,
            sessionTimeoutHours: true,
            summariesBeforeMerge: true,
        },
    })

    for (const config of botConfigs) {
        const cutoff = new Date(now.getTime() - config.sessionTimeoutHours * 60 * 60 * 1000)

        // Find expired BOT-mode conversations in this channel that haven't been summarized
        const expiredConvs = await prisma.conversation.findMany({
            where: {
                channelId: config.channelId,
                mode: 'BOT',
                lastMessageAt: { lte: cutoff },
                // Not already summarized via Smart Memory
                OR: [
                    { aiSummary: null },
                    { aiSummary: { not: { startsWith: '[Smart Memory:' } } },
                ],
            },
            select: {
                id: true,
                externalUserId: true,
                platform: true,
                channel: {
                    select: {
                        defaultAiProvider: true,
                        defaultAiModel: true,
                    },
                },
            },
            take: 50,
        })

        for (const conv of expiredConvs) {
            try {
                const ownerKey = await getChannelOwnerKey(config.channelId, conv.channel.defaultAiProvider)
                if (!ownerKey.apiKey) continue

                const provider = ownerKey.provider!
                const apiKey = ownerKey.apiKey
                const model = conv.channel.defaultAiModel || ownerKey.model || getDefaultModel(provider, {})

                await summarizeSession({
                    conversationId: conv.id,
                    channelId: config.channelId,
                    externalUserId: conv.externalUserId,
                    platform: conv.platform,
                    provider,
                    apiKey,
                    model,
                    summariesBeforeMerge: config.summariesBeforeMerge,
                })
                processed++
            } catch (err) {
                console.error(`[Cron/session-summarize] ❌ Error for conv ${conv.id}:`, err)
                errors++
            }
        }
    }

    console.log(`[Cron/session-summarize] ✅ Processed ${processed} sessions, ${errors} errors`)
    return NextResponse.json({ ok: true, processed, errors })
}
