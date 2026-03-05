import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/studio/projects/[id]/workflow — save workflow node/edge state
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await prisma.studioProject.findFirst({
        where: { id: params.id, userId: session.user.id },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { nodes, edges } = await req.json()

    const workflow = await prisma.studioWorkflow.upsert({
        where: { projectId: params.id },
        create: {
            projectId: params.id,
            nodesJson: nodes || [],
            edgesJson: edges || [],
        },
        update: {
            nodesJson: nodes || [],
            edgesJson: edges || [],
        },
    })

    return NextResponse.json({ workflow })
}
