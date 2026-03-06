import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ channelId: string; id: string }> }

async function verifyAccess(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// GET /api/studio/channels/[channelId]/avatars/[id]/poses — list pose folders
export async function GET(_req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const poses = await prisma.studioAvatarPose.findMany({
        where: { avatarId: id },
        orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ poses })
}

// POST /api/studio/channels/[channelId]/avatars/[id]/poses — create pose folder
export async function POST(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const pose = await prisma.studioAvatarPose.create({
        data: { avatarId: id, name: name.trim() },
    })
    return NextResponse.json({ pose }, { status: 201 })
}
