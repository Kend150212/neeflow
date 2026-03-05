import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/studio/projects — list user's projects
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projects = await prisma.studioProject.findMany({
        where: { userId: session.user.id, status: { not: 'archived' } },
        orderBy: { updatedAt: 'desc' },
        include: {
            _count: { select: { outputs: true, jobs: true } },
            jobs: { take: 1, orderBy: { createdAt: 'desc' }, select: { status: true, createdAt: true } },
        },
    })

    return NextResponse.json({ projects })
}

// POST /api/studio/projects — create a new project
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, description } = body

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const project = await prisma.studioProject.create({
        data: {
            userId: session.user.id,
            name,
            description: description || null,
            status: 'active',
        },
    })

    return NextResponse.json({ project })
}
