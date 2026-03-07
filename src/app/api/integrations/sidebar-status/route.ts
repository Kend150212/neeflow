import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface SidebarIntegrationItem {
    slug: string
    name: string
    href: string
}

// GET /api/integrations/sidebar-status
// Returns which data-source integrations this user has configured,
// so the sidebar can show / hide shortcut pills dynamically.
export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ items: [] })

    const userId = session.user.id as string

    const items: SidebarIntegrationItem[] = []

    // ── External DB ──────────────────────────────────────────────────────────
    // A user has External DB configured if any ExternalDbConfig row exists for them
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extDb = await (prisma as any).externalDbConfig.findFirst({
        where: { userId },
        select: { id: true, channelId: true },
    })
    if (extDb) {
        items.push({
            slug: 'external_db',
            name: 'Ext. DB',
            href: '/dashboard/integrations/external-db',
        })
    }

    // ── Shopify ───────────────────────────────────────────────────────────────
    // Shopify config is per-channel, find any channel owned by this user
    const shopify = await prisma.shopifyConfig.findFirst({
        where: {
            channel: {
                members: { some: { userId, role: 'OWNER' } },
            },
        },
        select: { id: true, channelId: true },
    })
    if (shopify) {
        items.push({
            slug: 'shopify',
            name: 'Shopify',
            href: '/dashboard/integrations/shopify',
        })
    }

    return NextResponse.json({ items })
}
