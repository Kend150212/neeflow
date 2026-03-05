import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/studio/projects/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await prisma.studioProject.findFirst({
        where: { id: params.id, userId: session.user.id },
        include: {
            workflow: true,
            jobs: { orderBy: { createdAt: 'desc' }, take: 10 },
            outputs: { orderBy: { createdAt: 'desc' }, take: 50 },
            _count: { select: { outputs: true, jobs: true } },
        },
    })

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ project })
}

// PATCH /api/studio/projects/[id] — update name/description/coverImage
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await prisma.studioProject.findFirst({
        where: { id: params.id, userId: session.user.id },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const { name, description, coverImage, status } = body

    const updated = await prisma.studioProject.update({
        where: { id: params.id },
        data: {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(coverImage !== undefined && { coverImage }),
            ...(status && { status }),
        },
    })

    return NextResponse.json({ project: updated })
}

// DELETE /api/studio/projects/[id] — archive
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.studioProject.updateMany({
        where: { id: params.id, userId: session.user.id },
        data: { status: 'archived' },
    })

    return NextResponse.json({ success: true })
}
