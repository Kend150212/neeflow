import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2 } from '@/lib/r2'

// POST /api/admin/channels/[id]/avatar
// Accepts: multipart/form-data with file field "avatar"
// Returns: { avatarUrl: string }
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const isAdmin = session.user.role === 'ADMIN'

    // Non-admin: must be a member with canEditSettings
    if (!isAdmin) {
        const member = await prisma.channelMember.findUnique({
            where: { userId_channelId: { userId: session.user.id, channelId: id } },
            include: { permission: true },
        })
        if (!member || !member.permission?.canEditSettings) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
    }

    const channel = await prisma.channel.findUnique({ where: { id } })
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('avatar') as File | null
        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        // Validate type and size (max 2MB)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed' }, { status: 400 })
        }
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 })
        }

        const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
        const key = `avatars/channels/${id}/${Date.now()}.${ext}`
        const buffer = Buffer.from(await file.arrayBuffer())

        const avatarUrl = await uploadToR2(buffer, key, file.type)

        // Save to DB
        await prisma.channel.update({
            where: { id },
            data: { avatarUrl },
        })

        return NextResponse.json({ avatarUrl })
    } catch (err) {
        console.error('[Channel Avatar Upload]', err)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
}

// DELETE /api/admin/channels/[id]/avatar — remove avatar
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const isAdmin = session.user.role === 'ADMIN'

    if (!isAdmin) {
        const member = await prisma.channelMember.findUnique({
            where: { userId_channelId: { userId: session.user.id, channelId: id } },
            include: { permission: true },
        })
        if (!member || !member.permission?.canEditSettings) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
    }

    await prisma.channel.update({
        where: { id },
        data: { avatarUrl: null },
    })

    return NextResponse.json({ success: true })
}
