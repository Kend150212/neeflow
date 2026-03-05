import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, generateR2Key, deleteFromR2 } from '@/lib/r2'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

function r2KeyFromUrl(url: string): string | null {
    try {
        const path = new URL(url).pathname
        return path.startsWith('/') ? path.slice(1) : path
    } catch {
        return null
    }
}

// POST — upload a reference image (max 4 per avatar)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id, channelId },
        select: { id: true, referenceImages: true },
    })
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })

    const currentImages = (avatar.referenceImages as string[]) || []
    if (currentImages.length >= 4) {
        return NextResponse.json({ error: 'Maximum 4 reference images allowed' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image must be under 10 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const key = generateR2Key(channelId, `avatar-ref-${id}-${file.name}`)

    let url: string
    try {
        url = await uploadToR2(buffer, key, file.type)
    } catch (err) {
        return NextResponse.json({ error: `Upload failed: ${String(err)}` }, { status: 500 })
    }

    const updatedImages = [...currentImages, url]
    await prisma.studioAvatar.update({
        where: { id },
        data: { referenceImages: updatedImages },
    })

    return NextResponse.json({ referenceImages: updatedImages })
}

// DELETE — remove reference image by index
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id, channelId },
        select: { id: true, referenceImages: true },
    })
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const index = body.index as number
    const currentImages = (avatar.referenceImages as string[]) || []

    if (typeof index !== 'number' || index < 0 || index >= currentImages.length) {
        return NextResponse.json({ error: 'Invalid image index' }, { status: 400 })
    }

    const urlToDelete = currentImages[index]
    const key = r2KeyFromUrl(urlToDelete)

    // Best-effort delete from R2
    if (key) {
        try { await deleteFromR2(key) } catch { /* ignore */ }
    }

    const updatedImages = currentImages.filter((_, i) => i !== index)
    await prisma.studioAvatar.update({
        where: { id },
        data: { referenceImages: updatedImages },
    })

    return NextResponse.json({ referenceImages: updatedImages })
}
