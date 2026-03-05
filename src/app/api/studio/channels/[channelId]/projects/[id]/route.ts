import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function resolveProjectAndMember(projectId: string, channelId: string, userId: string) {
    const [project, member] = await Promise.all([
        prisma.studioProject.findFirst({ where: { id: projectId, channelId } }),
        prisma.channelMember.findFirst({ where: { channelId, userId } }),
    ])
    return { project, member }
}

// GET /api/studio/channels/[channelId]/projects/[id]
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId, id } = await params
    const { project, member } = await resolveProjectAndMember(id, channelId, session.user.id)

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const fullProject = await prisma.studioProject.findUnique({
        where: { id },
        include: {
            workflow: true,
            jobs: { orderBy: { createdAt: 'desc' }, take: 10 },
            outputs: { orderBy: { createdAt: 'desc' }, take: 50 },
            _count: { select: { outputs: true, jobs: true } },
        },
    })

    return NextResponse.json({ project: fullProject })
}

// PATCH /api/studio/channels/[channelId]/projects/[id]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId, id } = await params
    const { project, member } = await resolveProjectAndMember(id, channelId, session.user.id)

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { name, description, coverImage, status } = await req.json()

    const updated = await prisma.studioProject.update({
        where: { id },
        data: {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(coverImage !== undefined && { coverImage }),
            ...(status && { status }),
        },
    })

    return NextResponse.json({ project: updated })
}

// DELETE /api/studio/channels/[channelId]/projects/[id]
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId, id } = await params
    const { project, member } = await resolveProjectAndMember(id, channelId, session.user.id)

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.studioProject.update({ where: { id }, data: { status: 'archived' } })

    return NextResponse.json({ success: true })
}
