/**
 * GET /api/integrations/sync-status
 * Returns the sync status (last synced, product count) for
 * Shopify, Etsy, and WordPress on the user's default channel.
 * Used by the Integrations page to show sync status + Sync button.
 *
 * productCount is read from actual ProductCatalog rows (not cached ShopifyConfig.productCount)
 * so it's always accurate even if a previous sync failed to update the cache.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Find the user's first channel
    const db = prisma as any
    const channel = await prisma.channel.findFirst({
        where: { members: { some: { userId: session.user.id as string } } },
        select: { id: true, timezone: true },
        orderBy: { createdAt: 'asc' },
    })

    if (!channel) return NextResponse.json({ channelId: null, timezone: 'UTC', shopify: null, etsy: null, wordpress: null })

    const channelId = channel.id
    const timezone = (channel as any).timezone || 'UTC'

    const [shopify, etsy, wordpress, shopifyCount, etsyCount, wpCount] = await Promise.all([
        db.shopifyConfig.findUnique({
            where: { channelId },
            select: { shopDomain: true, lastSyncedAt: true },
        }),
        db.etsyConfig.findUnique({
            where: { channelId },
            select: { shopId: true, lastSyncedAt: true },
        }),
        db.wordPressConfig.findUnique({
            where: { channelId },
            select: { siteUrl: true, lastSyncedAt: true },
        }),
        // Read actual counts from ProductCatalog — always accurate
        prisma.productCatalog.count({ where: { channelId, syncSource: 'shopify' } }),
        prisma.productCatalog.count({ where: { channelId, syncSource: 'etsy' } }),
        prisma.productCatalog.count({ where: { channelId, syncSource: 'wordpress' } }),
    ])

    return NextResponse.json({
        channelId,
        timezone,
        shopify: shopify ? {
            connected: true,
            shopDomain: shopify.shopDomain,
            lastSyncedAt: shopify.lastSyncedAt,
            productCount: shopifyCount,
        } : null,
        etsy: etsy ? {
            connected: true,
            shopId: etsy.shopId,
            lastSyncedAt: etsy.lastSyncedAt,
            productCount: etsyCount,
        } : null,
        wordpress: wordpress ? {
            connected: true,
            siteUrl: wordpress.siteUrl,
            lastSyncedAt: wordpress.lastSyncedAt,
            productCount: wpCount,
        } : null,
    })
}
