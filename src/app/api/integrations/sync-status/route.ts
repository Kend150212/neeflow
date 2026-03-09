/**
 * GET /api/integrations/sync-status
 * Returns the sync status for Shopify, Etsy, and WordPress.
 * Searches ALL user channels for each integration so the hub
 * always finds the connected one regardless of channel order.
 *
 * productCount is read from actual ProductCatalog rows (not cached config.productCount).
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = prisma as any

    // Get ALL channels the user belongs to
    const channels = await prisma.channel.findMany({
        where: { members: { some: { userId: session.user.id as string } } },
        select: { id: true, timezone: true },
        orderBy: { createdAt: 'asc' },
    })

    if (!channels.length) return NextResponse.json({ channelId: null, timezone: 'UTC', shopify: null, etsy: null, wordpress: null })

    const channelIds = channels.map(c => c.id)
    const defaultChannelId = channels[0].id
    const timezone = (channels[0] as any).timezone || 'UTC'

    // For each integration, find whichever channel has the config
    const [shopifyConfigs, etsyConfigs, wpConfigs] = await Promise.all([
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
        shopifyConfigs ? prisma.productCatalog.count({ where: { channelId: shopifyConfigs.channelId, syncSource: 'shopify' } }) : 0,
        etsyConfigs ? prisma.productCatalog.count({ where: { channelId: etsyConfigs.channelId, syncSource: 'etsy' } }) : 0,
        wpConfigs ? prisma.productCatalog.count({ where: { channelId: wpConfigs.channelId, syncSource: 'wordpress' } }) : 0,
    ])

    console.log(`[sync-status] userId=${session.user.id} defaultChannelId=${defaultChannelId} shopify=${shopifyConfigs ? `${shopifyConfigs.shopDomain} (ch:${shopifyConfigs.channelId})` : 'NULL'}`)

    return NextResponse.json({
        channelId: defaultChannelId,
        timezone,
        shopify: shopifyConfigs ? {
            connected: true,
            channelId: shopifyConfigs.channelId,
            shopDomain: shopifyConfigs.shopDomain,
            lastSyncedAt: shopifyConfigs.lastSyncedAt,
            productCount: shopifyCount,
        } : null,
        etsy: etsyConfigs ? {
            connected: true,
            channelId: etsyConfigs.channelId,
            shopId: etsyConfigs.shopId,
            lastSyncedAt: etsyConfigs.lastSyncedAt,
            productCount: etsyCount,
        } : null,
        wordpress: wpConfigs ? {
            connected: true,
            channelId: wpConfigs.channelId,
            siteUrl: wpConfigs.siteUrl,
            lastSyncedAt: wpConfigs.lastSyncedAt,
            productCount: wpCount,
        } : null,
    })
}
