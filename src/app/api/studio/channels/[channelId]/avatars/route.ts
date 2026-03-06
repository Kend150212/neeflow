import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Verify caller is a member of this channel (or platform ADMIN)
async function verifyMembership(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    const member = await prisma.channelMember.findFirst({
        where: { userId, channelId },
    })
    return !!member
}

// GET  /api/studio/channels/[channelId]/avatars — list own + shared avatars for channel
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ channelId: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId } = await params

    if (!(await verifyMembership(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Own avatars for this channel
    const own = await prisma.studioAvatar.findMany({
        where: { channelId, isActive: true },
        orderBy: { createdAt: 'desc' },
    })

    // Avatars shared INTO this channel (from other channels)
    const sharedRaw = await prisma.studioAvatarShare.findMany({
        where: { channelId },
        include: { avatar: true },
    })
    const shared = sharedRaw.map(s => ({ ...s.avatar, _shared: true, _shareId: s.id }))

    return NextResponse.json({ avatars: own, sharedAvatars: shared })
}

// POST /api/studio/channels/[channelId]/avatars — create a new avatar
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId } = await params

    if (!(await verifyMembership(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, prompt, style } = body

    if (!name || !prompt) {
        return NextResponse.json({ error: 'name and prompt are required' }, { status: 400 })
    }

    try {
        const avatar = await prisma.studioAvatar.create({
            data: {
                userId: session.user.id,
                channelId,
                name,
                description: description || null,
                prompt,
                style: style || 'realistic',
            },
        })
        return NextResponse.json({ avatar }, { status: 201 })
    } catch (err) {
        console.error('[CREATE AVATAR]', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
