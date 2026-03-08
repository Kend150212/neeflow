import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/integrations/etsy?channelId=xxx — load config (no raw tokens)
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ config: null })

    const config = await (prisma as any).etsyConfig.findUnique({ where: { channelId } })
    if (!config) return NextResponse.json({ config: null })

    const isExpired = config.tokenExpiresAt < new Date()

    return NextResponse.json({
        config: {
            id: config.id,
            shopId: config.shopId,
            shopName: config.shopName,
            tokenExpiresAt: config.tokenExpiresAt,
            isExpired,
            lastSyncedAt: config.lastSyncedAt,
            productCount: config.productCount,
        },
    })
}

// DELETE /api/integrations/etsy?channelId=xxx — disconnect
export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

    try {
        await (prisma as any).etsyConfig.delete({ where: { channelId } })
        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }
}
