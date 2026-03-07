import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'

// GET /api/integrations/shopify?channelId=xxx — load config for channel
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ config: null })

    const config = await prisma.shopifyConfig.findUnique({ where: { channelId } })
    if (!config) return NextResponse.json({ config: null })

    return NextResponse.json({
        config: {
            id: config.id,
            shopDomain: config.shopDomain,
            // Never expose raw token — just show masked
            hasToken: !!config.accessToken,
            syncInventory: config.syncInventory,
            syncCollections: config.syncCollections,
            syncImages: config.syncImages,
            lastSyncedAt: config.lastSyncedAt,
            productCount: config.productCount,
        },
    })
}

// POST /api/integrations/shopify — save / update config
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { channelId, shopDomain, accessToken, syncInventory, syncCollections, syncImages } = body

    if (!channelId || !shopDomain) {
        return NextResponse.json({ error: 'channelId and shopDomain required' }, { status: 400 })
    }

    const data: Record<string, unknown> = {
        shopDomain: shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        syncInventory: syncInventory ?? true,
        syncCollections: syncCollections ?? true,
        syncImages: syncImages ?? true,
    }

    // Only update token if new one provided (not placeholder)
    if (accessToken && accessToken !== '••••••••••••') {
        data.accessToken = encrypt(accessToken)
    }

    const config = await prisma.shopifyConfig.upsert({
        where: { channelId },
        create: { channelId, shopDomain: data.shopDomain as string, accessToken: data.accessToken as string ?? '', ...data },
        update: data,
    })

    return NextResponse.json({ success: true, id: config.id })
}

// DELETE /api/integrations/shopify?channelId=xxx — remove config
export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })

    await prisma.shopifyConfig.deleteMany({ where: { channelId } })
    return NextResponse.json({ success: true })
}
