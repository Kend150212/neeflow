import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface SidebarIntegrationItem {
    slug: string
    name: string
    href: string
}

// GET /api/integrations/sidebar-status?channelId=xxx
// Returns which data-source integrations are configured for the given channel
// (or any channel the user belongs to if channelId not supplied).
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ items: [] })

    const userId = session.user.id as string
    const { searchParams } = new URL(req.url)
    const requestedChannelId = searchParams.get('channelId')

    const items: SidebarIntegrationItem[] = []

    // ── Resolve the channel scope ─────────────────────────────────────────────
    // If a specific channelId is given, verify the user is a member of that channel
    // and only look for integrations there.
    // Otherwise fall back to any channel the user belongs to (legacy behavior).
    let channelFilter: { channelId: string } | { channelId: { in: string[] } }

    if (requestedChannelId) {
        // Verify membership
        const isMember = await prisma.channelMember.findFirst({
            where: { channelId: requestedChannelId, userId },
            select: { id: true },
        })
        if (isMember) {
            channelFilter = { channelId: requestedChannelId }
        } else {
            // Not a member of that channel — return empty
            return NextResponse.json({ items: [] })
        }
    } else {
        // No channelId → any channel this user belongs to (sidebar always-visible)
        const channels = await prisma.channelMember.findMany({
            where: { userId },
            select: { channelId: true },
        })
        const ids = channels.map(c => c.channelId)
        if (!ids.length) return NextResponse.json({ items: [] })
        channelFilter = { channelId: { in: ids } }
    }

    // ── External DB ──────────────────────────────────────────────────────────
    // ExternalDbConfig is per-user, not per-channel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extDb = await (prisma as any).externalDbConfig.findFirst({
        where: { userId },
        select: { id: true },
    })
    if (extDb) {
        items.push({
            slug: 'external_db',
            name: 'Ext. DB',
            href: '/dashboard/integrations/external-db',
        })
    }

    // ── Shopify ──────────────────────────────────────────────────────────────
    const shopify = await prisma.shopifyConfig.findFirst({
        where: channelFilter,
        select: { id: true, channelId: true },
    })
    if (shopify) {
        items.push({
            slug: 'shopify',
            name: 'Shopify',
            href: `/dashboard/integrations/shopify?channelId=${shopify.channelId}`,
        })
    }

    // ── Etsy ─────────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const etsy = await (prisma as any).etsyConfig?.findFirst({
        where: channelFilter,
        select: { id: true, channelId: true },
    }).catch(() => null)
    if (etsy) {
        items.push({
            slug: 'etsy',
            name: 'Etsy',
            href: `/dashboard/integrations/etsy?channelId=${etsy.channelId}`,
        })
    }

    return NextResponse.json({ items })
}
