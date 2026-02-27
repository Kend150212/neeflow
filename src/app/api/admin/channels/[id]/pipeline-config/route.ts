import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/channels/[id]/pipeline-config
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const channel = await prisma.channel.findUnique({
        where: { id },
        select: {
            pipelineEnabled: true,
            pipelineFrequency: true,
            pipelineApprovalMode: true,
            pipelinePostingTimes: true,
            smartflowSources: true,
        },
    })

    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

    // Get pipeline stats
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [queued, processing, completedToday, failed] = await Promise.all([
        prisma.contentJob.count({ where: { channelId: id, status: 'QUEUED' } }),
        prisma.contentJob.count({ where: { channelId: id, status: 'PROCESSING' } }),
        prisma.contentJob.count({
            where: { channelId: id, status: 'COMPLETED', processedAt: { gte: startOfDay } },
        }),
        prisma.contentJob.count({ where: { channelId: id, status: 'FAILED' } }),
    ])

    return NextResponse.json({
        ...channel,
        stats: { queued, processing, completedToday, failed },
    })
}

// PATCH /api/admin/channels/[id]/pipeline-config
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    if (typeof body.pipelineEnabled === 'boolean') {
        updateData.pipelineEnabled = body.pipelineEnabled
    }
    if (body.pipelineFrequency) {
        updateData.pipelineFrequency = body.pipelineFrequency
    }
    if (body.pipelineApprovalMode) {
        updateData.pipelineApprovalMode = body.pipelineApprovalMode
    }
    if (Array.isArray(body.pipelinePostingTimes)) {
        updateData.pipelinePostingTimes = body.pipelinePostingTimes
    }
    if (body.smartflowSources !== undefined) {
        updateData.smartflowSources = body.smartflowSources
    }

    const channel = await prisma.channel.update({
        where: { id },
        data: updateData,
        select: {
            pipelineEnabled: true,
            pipelineFrequency: true,
            pipelineApprovalMode: true,
            pipelinePostingTimes: true,
            smartflowSources: true,
        },
    })

    return NextResponse.json(channel)
}
