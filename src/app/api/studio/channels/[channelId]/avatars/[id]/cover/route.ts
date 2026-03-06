import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, generateR2Key } from '@/lib/r2'

async function verifyMembership(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// POST — upload an external image as the avatar's cover image
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const avatar = await prisma.studioAvatar.findFirst({ where: { id, channelId } })
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF allowed' }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image must be under 20 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const key = generateR2Key(channelId, `avatar-cover-${id}-${Date.now()}-${file.name}`)

    let url: string
    try {
        url = await uploadToR2(buffer, key, file.type)
    } catch (err) {
        return NextResponse.json({ error: `Upload failed: ${String(err)}` }, { status: 500 })
    }

    const updated = await prisma.studioAvatar.update({
        where: { id },
        data: { coverImage: url, status: 'idle' },
    })

    return NextResponse.json({ avatar: updated, coverImage: url })
}
