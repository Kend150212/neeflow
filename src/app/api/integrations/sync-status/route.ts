/**
 * GET /api/integrations/sync-status
 * Returns the sync status (last synced, product count) for
 * Shopify, Etsy, and WordPress on the user's default channel.
 * Used by the Integrations page to show sync status + Sync button.
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
        select: { id: true },
        orderBy: { createdAt: 'asc' },
    })

    if (!channel) return NextResponse.json({ channelId: null, shopify: null, etsy: null, wordpress: null })

    const channelId = channel.id

    const [shopify, etsy, wordpress] = await Promise.all([
        db.shopifyConfig.findUnique({
            where: { channelId },
            select: { shopDomain: true, lastSyncedAt: true, productCount: true },
        }),
        db.etsyConfig.findUnique({
            where: { channelId },
            select: { shopId: true, lastSyncedAt: true, productCount: true },
        }),
        db.wordPressConfig.findUnique({
            where: { channelId },
            select: { siteUrl: true, lastSyncedAt: true, productCount: true },
        }),
    ])

    return NextResponse.json({
        channelId,
        shopify: shopify ? {
            connected: true,
            shopDomain: shopify.shopDomain,
            lastSyncedAt: shopify.lastSyncedAt,
            productCount: shopify.productCount,
        } : null,
        etsy: etsy ? {
            connected: true,
            shopId: etsy.shopId,
            lastSyncedAt: etsy.lastSyncedAt,
            productCount: etsy.productCount,
        } : null,
        wordpress: wordpress ? {
            connected: true,
            siteUrl: wordpress.siteUrl,
            lastSyncedAt: wordpress.lastSyncedAt,
            productCount: wordpress.productCount,
        } : null,
    })
}
