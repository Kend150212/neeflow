import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * POST /api/admin/channels/[id]/bot-config/avatar
 * Upload a custom avatar image for the channel's bot
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params

    // Check membership
    const membership = await prisma.channelMember.findFirst({
        where: { channelId, userId: session.user.id },
    })
    if (!membership && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('avatar') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WebP or GIF.' }, { status: 400 })
    }

    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
        return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
    const filename = `bot-avatar-${channelId}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'bot-avatars')
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, filename), buffer)

    const avatarUrl = `/uploads/bot-avatars/${filename}`

    // Save to BotConfig
    await prisma.botConfig.upsert({
        where: { channelId },
        update: { botAvatarUrl: avatarUrl },
        create: { channelId, botAvatarUrl: avatarUrl },
    })

    return NextResponse.json({ avatarUrl })
}

/**
 * DELETE /api/admin/channels/[id]/bot-config/avatar
 * Remove bot avatar (reset to default)
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params

    await prisma.botConfig.upsert({
        where: { channelId },
        update: { botAvatarUrl: null },
        create: { channelId },
    })

    return NextResponse.json({ ok: true })
}
