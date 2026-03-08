import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'

// GET /api/integrations/wordpress?channelId=xxx — load config for channel
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ config: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma as any).wordPressConfig.findUnique({ where: { channelId } })
    if (!config) return NextResponse.json({ config: null })

    return NextResponse.json({
        config: {
            id: config.id,
            siteUrl: config.siteUrl,
            username: config.username,
            hasPassword: !!config.appPassword,
            syncWooProducts: config.syncWooProducts,
            syncWpPosts: config.syncWpPosts,
            lastSyncedAt: config.lastSyncedAt,
            productCount: config.productCount,
        },
    })
}

// POST /api/integrations/wordpress — save / update per-channel config
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { channelId, siteUrl, username, appPassword, syncWooProducts, syncWpPosts } = body

    if (!channelId || !siteUrl || !username) {
        return NextResponse.json({ error: 'channelId, siteUrl and username required' }, { status: 400 })
    }

    const url = siteUrl.replace(/\/$/, '') // remove trailing slash

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, unknown> = {
        siteUrl: url,
        username,
        syncWooProducts: syncWooProducts ?? true,
        syncWpPosts: syncWpPosts ?? false,
    }

    // Only update password if new one provided (not placeholder)
    if (appPassword && appPassword !== '••••••••••••') {
        data.appPassword = encrypt(appPassword)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = await (prisma as any).wordPressConfig.upsert({
        where: { channelId },
        create: {
            channelId,
            siteUrl: url,
            username,
            appPassword: data.appPassword as string ?? '',
            syncWooProducts: data.syncWooProducts as boolean,
            syncWpPosts: data.syncWpPosts as boolean,
        },
        update: data,
    })

    return NextResponse.json({ success: true, id: cfg.id })
}

// DELETE /api/integrations/wordpress?channelId=xxx — remove config
export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).wordPressConfig.deleteMany({ where: { channelId } })
    return NextResponse.json({ success: true })
}

export { decrypt } // re-export so route.ts modules can use it for decrypt in sync
