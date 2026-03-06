import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verifyMembership(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

type Ctx = { params: Promise<{ channelId: string; id: string }> }

// POST /api/studio/channels/[channelId]/avatars/[id]/share
// body: { targetChannelId: string }
export async function POST(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params
    const role = session.user.role as string

    if (!(await verifyMembership(session.user.id, channelId, role))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id, channelId, isActive: true },
    })
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })

    const { targetChannelId } = await req.json()
    if (!targetChannelId) {
        return NextResponse.json({ error: 'targetChannelId required' }, { status: 400 })
    }
    if (targetChannelId === channelId) {
        return NextResponse.json({ error: 'Cannot share to the same channel' }, { status: 400 })
    }

    // Must be a member of target channel too (or ADMIN)
    if (!(await verifyMembership(session.user.id, targetChannelId, role))) {
        return NextResponse.json({ error: 'Not a member of target channel' }, { status: 403 })
    }

    const share = await prisma.studioAvatarShare.upsert({
        where: { avatarId_channelId: { avatarId: id, channelId: targetChannelId } },
        create: { avatarId: id, channelId: targetChannelId },
        update: {},
    })

    return NextResponse.json({ share }, { status: 201 })
}

// DELETE /api/studio/channels/[channelId]/avatars/[id]/share
// body: { targetChannelId: string }
export async function DELETE(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { targetChannelId } = await req.json()
    if (!targetChannelId) {
        return NextResponse.json({ error: 'targetChannelId required' }, { status: 400 })
    }

    await prisma.studioAvatarShare.deleteMany({
        where: { avatarId: id, channelId: targetChannelId },
    })

    return NextResponse.json({ success: true })
}
