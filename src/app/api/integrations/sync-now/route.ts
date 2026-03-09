/**
 * POST /api/integrations/sync-now
 * Trigger an immediate sync for a specific integration + channel.
 * Used by the Sync button in the Integrations UI.
 *
 * Body: { slug: 'shopify' | 'etsy' | 'wordpress', channelId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncShopifyProducts, syncEtsyProducts, syncWordPressProducts } from '@/lib/integration-sync'

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slug, channelId } = await req.json()
    if (!slug || !channelId) {
        return NextResponse.json({ error: 'slug and channelId required' }, { status: 400 })
    }

    // Verify the channel belongs to the current user
    const channel = await prisma.channel.findFirst({
        where: {
            id: channelId,
            members: { some: { userId: session.user.id as string } },
        },
        select: { id: true },
    })
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

    try {
        let result: { synced: number; failed: number }

        switch (slug) {
            case 'shopify':
                result = await syncShopifyProducts(channelId)
                break
            case 'etsy':
                result = await syncEtsyProducts(channelId)
                break
            case 'wordpress':
                result = await syncWordPressProducts(channelId)
                break
            default:
                return NextResponse.json({ error: `Unknown slug: ${slug}` }, { status: 400 })
        }

        return NextResponse.json({ ok: true, synced: result.synced, failed: result.failed })
    } catch (err) {
        console.error('[sync-now] error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
