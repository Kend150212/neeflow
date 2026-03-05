import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Verify the session user is a member of this channel
async function resolveChannelMember(channelId: string, userId: string) {
    return prisma.channelMember.findFirst({
        where: { channelId, userId },
    })
}

// GET /api/studio/channels/[channelId]/projects
export async function GET(_req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await params
    const member = await resolveChannelMember(channelId, session.user.id)
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const projects = await prisma.studioProject.findMany({
        where: { channelId, status: { not: 'archived' } },
        orderBy: { updatedAt: 'desc' },
        include: {
            _count: { select: { outputs: true, jobs: true } },
            jobs: { take: 1, orderBy: { createdAt: 'desc' }, select: { status: true, createdAt: true } },
        },
    })

    return NextResponse.json({ projects })
}

// POST /api/studio/channels/[channelId]/projects
export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await params
    const member = await resolveChannelMember(channelId, session.user.id)
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { name, description } = await req.json()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const project = await prisma.studioProject.create({
        data: {
            userId: session.user.id,
            channelId,
            name,
            description: description || null,
            status: 'active',
        },
    })

    return NextResponse.json({ project })
}
