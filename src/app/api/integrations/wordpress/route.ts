import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { syncWordPressProducts } from '@/lib/integration-sync'

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

    const url = siteUrl.replace(/\/$/, '')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, unknown> = {
        siteUrl: url,
        username,
        syncWooProducts: syncWooProducts ?? true,
        syncWpPosts: syncWpPosts ?? false,
    }

    const hasNewPassword = appPassword && appPassword !== '••••••••••••'
    if (hasNewPassword) {
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

    // ── Auto-sync on connect / password update (fire-and-forget) ───────────
    if (hasNewPassword) {
        const _channelId = channelId
        setImmediate(async () => {
            try {
                const r = await syncWordPressProducts(_channelId)
                console.log(`[AutoSync] WordPress connect channel=${_channelId}: synced=${r.synced} failed=${r.failed}`)
            } catch (err) {
                console.error(`[AutoSync] WordPress connect channel=${_channelId} error:`, err)
            }
        })
    }

    return NextResponse.json({ success: true, id: cfg.id, autoSyncStarted: hasNewPassword })
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
