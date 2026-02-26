import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/content-pipeline — List content jobs with filtering
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const status = req.nextUrl.searchParams.get('status')
    const channelId = req.nextUrl.searchParams.get('channelId')
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (channelId) where.channelId = channelId

    const [jobs, total] = await Promise.all([
        prisma.contentJob.findMany({
            where,
            include: {
                mediaItem: {
                    select: { url: true, thumbnailUrl: true, type: true, originalName: true },
                },
                channel: {
                    select: { id: true, displayName: true },
                },
                post: {
                    select: { id: true, status: true, scheduledAt: true, content: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.contentJob.count({ where }),
    ])

    // Get overall stats
    const stats = await prisma.contentJob.groupBy({
        by: ['status'],
        _count: { id: true },
        ...(channelId ? { where: { channelId } } : {}),
    })

    const statsMap: Record<string, number> = {}
    stats.forEach(s => { statsMap[s.status] = s._count.id })

    return NextResponse.json({
        jobs,
        total,
        page,
        limit,
        stats: statsMap,
    })
}

// POST /api/admin/content-pipeline — Actions: retry, cancel
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, jobId, jobIds } = body as {
        action: 'retry' | 'cancel' | 'retry_all_failed'
        jobId?: string
        jobIds?: string[]
    }

    if (action === 'retry' && jobId) {
        await prisma.contentJob.update({
            where: { id: jobId },
            data: { status: 'QUEUED', errorMessage: null, processedAt: null },
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'cancel' && jobId) {
        await prisma.contentJob.update({
            where: { id: jobId },
            data: { status: 'FAILED', errorMessage: 'Cancelled by admin' },
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'retry_all_failed') {
        const result = await prisma.contentJob.updateMany({
            where: { status: 'FAILED', ...(jobIds?.length ? { id: { in: jobIds } } : {}) },
            data: { status: 'QUEUED', errorMessage: null, processedAt: null },
        })
        return NextResponse.json({ success: true, count: result.count })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
