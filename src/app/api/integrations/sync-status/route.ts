/**
 * GET /api/integrations/sync-status?channelId=xxx
 *
 * Returns Shopify / Etsy / WordPress sync status.
 * When channelId is supplied (and the user is a member), results are scoped
 * to THAT channel only — so switching channels gives the correct per-channel
 * connected/not-connected status.
 *
 * When channelId is absent, falls back to the old behavior (search all
 * user channels) for backward compatibility.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = prisma as any
    const userId = session.user.id as string
    const { searchParams } = new URL(req.url)
    const requestedChannelId = searchParams.get('channelId')

    // ── Resolve which channel(s) to search ───────────────────────────────────
    let channelIds: string[]
    let timezone = 'UTC'
    let resolvedChannelId: string | null = null

    if (requestedChannelId) {
        // Verify the user is a member of this channel
        const membership = await prisma.channelMember.findFirst({
            where: { channelId: requestedChannelId, userId },
            select: { channelId: true },
        })
        if (!membership) {
            return NextResponse.json({ channelId: null, timezone: 'UTC', shopify: null, etsy: null, wordpress: null })
        }
        channelIds = [requestedChannelId]
        resolvedChannelId = requestedChannelId

        // Load timezone from this channel
        const ch = await prisma.channel.findUnique({
            where: { id: requestedChannelId },
            select: { timezone: true } as any,
        })
        timezone = (ch as any)?.timezone || 'UTC'
    } else {
        // Legacy: search all channels the user belongs to
        const channels = await prisma.channel.findMany({
            where: { members: { some: { userId } } },
            select: { id: true, timezone: true },
            orderBy: { createdAt: 'asc' },
        })
        if (!channels.length) {
            return NextResponse.json({ channelId: null, timezone: 'UTC', shopify: null, etsy: null, wordpress: null })
        }
        channelIds = channels.map(c => c.id)
        resolvedChannelId = channels[0].id
        timezone = (channels[0] as any).timezone || 'UTC'
    }

    // ── Query integrations ────────────────────────────────────────────────────
    const [shopifyConfig, etsyConfig, wpConfig] = await Promise.all([
        db.shopifyConfig.findFirst({
            where: { channelId: { in: channelIds } },
            select: { channelId: true, shopDomain: true, lastSyncedAt: true },
            orderBy: { updatedAt: 'desc' },
        }),
        db.etsyConfig.findFirst({
            where: { channelId: { in: channelIds } },
            select: { channelId: true, shopId: true, lastSyncedAt: true },
            orderBy: { updatedAt: 'desc' },
        }),
        db.wordPressConfig.findFirst({
            where: { channelId: { in: channelIds } },
            select: { channelId: true, siteUrl: true, lastSyncedAt: true },
            orderBy: { updatedAt: 'desc' },
        }),
    ])

    const [shopifyCount, etsyCount, wpCount] = await Promise.all([
        shopifyConfig ? prisma.productCatalog.count({ where: { channelId: shopifyConfig.channelId, syncSource: 'shopify' } }) : 0,
        etsyConfig ? prisma.productCatalog.count({ where: { channelId: etsyConfig.channelId, syncSource: 'etsy' } }) : 0,
        wpConfig ? prisma.productCatalog.count({ where: { channelId: wpConfig.channelId, syncSource: 'wordpress' } }) : 0,
    ])

    console.log(`[sync-status] userId=${userId} channelId=${resolvedChannelId} shopify=${shopifyConfig?.shopDomain ?? 'NULL'}`)

    return NextResponse.json({
        channelId: resolvedChannelId,
        timezone,
        shopify: shopifyConfig ? {
            connected: true,
            channelId: shopifyConfig.channelId,
            shopDomain: shopifyConfig.shopDomain,
            lastSyncedAt: shopifyConfig.lastSyncedAt,
            productCount: shopifyCount,
        } : null,
        etsy: etsyConfig ? {
            connected: true,
            channelId: etsyConfig.channelId,
            shopId: etsyConfig.shopId,
            lastSyncedAt: etsyConfig.lastSyncedAt,
            productCount: etsyCount,
        } : null,
        wordpress: wpConfig ? {
            connected: true,
            channelId: wpConfig.channelId,
            siteUrl: wpConfig.siteUrl,
            lastSyncedAt: wpConfig.lastSyncedAt,
            productCount: wpCount,
        } : null,
    })
}
