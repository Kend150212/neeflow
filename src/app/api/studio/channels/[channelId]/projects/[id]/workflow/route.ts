import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/studio/channels/[channelId]/projects/[id]/workflow
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId, id } = await params

    const [project, member] = await Promise.all([
        prisma.studioProject.findFirst({ where: { id, channelId } }),
        prisma.channelMember.findFirst({ where: { channelId, userId: session.user.id } }),
    ])

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { nodes, edges } = await req.json()

    const workflow = await prisma.studioWorkflow.upsert({
        where: { projectId: id },
        create: { projectId: id, nodesJson: nodes || [], edgesJson: edges || [] },
        update: { nodesJson: nodes || [], edgesJson: edges || [] },
    })

    return NextResponse.json({ workflow })
}
