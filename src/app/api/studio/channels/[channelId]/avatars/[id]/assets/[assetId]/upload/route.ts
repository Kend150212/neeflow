import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, generateR2Key } from '@/lib/r2'

type Ctx = { params: Promise<{ channelId: string; id: string; assetId: string }> }

async function verifyAccess(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// POST — upload one or more images to an asset (multi-image support)
export async function POST(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id, assetId } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const files = formData.getAll('file') as File[]
    const label = formData.get('label') as string | null

    if (!files.length) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const asset = await prisma.studioAvatarAsset.findFirst({ where: { id: assetId, avatarId: id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const existing = (asset.images as { url: string; label?: string }[]) || []
    const uploaded: { url: string; label?: string; createdAt: string }[] = []

    for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.name.split('.').pop() || 'jpg'
        const key = generateR2Key(channelId, `${Date.now()}-asset-${assetId}.${ext}`)
        const url = await uploadToR2(buffer, key, file.type || 'image/jpeg')
        uploaded.push({ url, label: label || undefined, createdAt: new Date().toISOString() })
    }

    const updated = await prisma.studioAvatarAsset.update({
        where: { id: assetId },
        data: { images: [...existing, ...uploaded] },
    })

    return NextResponse.json({ asset: updated, uploaded })
}

// DELETE image from asset by url — body: { url }
export async function DELETE(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id, assetId } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    const asset = await prisma.studioAvatarAsset.findFirst({ where: { id: assetId, avatarId: id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const images = (asset.images as { url: string }[]).filter(img => img.url !== url)
    const updated = await prisma.studioAvatarAsset.update({
        where: { id: assetId },
        data: { images },
    })
    return NextResponse.json({ asset: updated })
}
