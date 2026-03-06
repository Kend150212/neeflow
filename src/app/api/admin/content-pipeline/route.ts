import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/content-pipeline — List content jobs scoped to the current user's channels
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id
    const isAdmin = (session.user as { role?: string }).role === 'admin'

    const status = req.nextUrl.searchParams.get('status')
    const channelId = req.nextUrl.searchParams.get('channelId')
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')

    // ─── DATA ISOLATION ──────────────────────────────────────────────────────
    // Channel model has no direct userId — ownership is tracked via ChannelMember.
    // Always filter by the current user's channels unless a super-admin override is passed.
    const channelFilter = isAdmin && req.nextUrl.searchParams.get('adminOverride')
        ? {} // Super-admin viewing global data via explicit override
        : { members: { some: { userId } } }  // Normal user: only their channels

    const where: Record<string, unknown> = {
        channel: channelFilter,
    }
    if (status) where.status = status

    if (channelId) {
        // When filtering by a specific channel, verify user is a member
        where.channelId = channelId
        if (!isAdmin) {
            // Re-apply membership check combined with specific channel
            where.channel = { id: channelId, members: { some: { userId } } }
        }
    }

    if (from || to) {
        const dateFilter: Record<string, unknown> = {}
        if (from) dateFilter.gte = new Date(from)
        if (to) {
            const toDate = new Date(to)
            toDate.setHours(23, 59, 59, 999)
            dateFilter.lte = toDate
        }
        where.createdAt = dateFilter
    }

    const [jobs, total] = await Promise.all([
        prisma.contentJob.findMany({
            where,
            include: {
                mediaItem: {
                    select: { url: true, thumbnailUrl: true, type: true, originalName: true },
                },
                channel: {
                    select: { id: true, displayName: true, pipelineApprovalMode: true },
                },
                post: {
                    select: {
                        id: true, status: true, scheduledAt: true, content: true,
                        metadata: true,
                        platformStatuses: { select: { id: true, platform: true, accountId: true, status: true } },
                        approvals: {
                            include: { user: { select: { name: true, email: true } } },
                            orderBy: { createdAt: 'desc' as const },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.contentJob.count({ where }),
    ])

    // Stats scoped to the same channel filter
    const stats = await prisma.contentJob.groupBy({
        by: ['status'],
        _count: { id: true },
        where: {
            channel: channelFilter,
            ...(channelId ? { channelId } : {}),
        },
    })

    const statsMap: Record<string, number> = {}
    stats.forEach(s => { statsMap[s.status] = s._count.id })

    return NextResponse.json({ jobs, total, page, limit, stats: statsMap })
}

// POST /api/admin/content-pipeline — Actions: retry, cancel, approve, reject
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id
    const isAdmin = (session.user as { role?: string }).role === 'admin'

    const body = await req.json()
    const { action, jobId, jobIds, postId, platformStatusId, newStatus, comment } = body as {
        action: 'retry' | 'cancel' | 'retry_all_failed' | 'approve' | 'reject' | 'client_approve' | 'toggle_platform' | 'requeue'
        jobId?: string
        jobIds?: string[]
        postId?: string
        platformStatusId?: string
        newStatus?: string
        comment?: string
    }

    // ─── Ownership helpers ────────────────────────────────────────────────────
    async function isJobOwner(id: string) {
        if (isAdmin) return true
        const job = await prisma.contentJob.findUnique({
            where: { id },
            select: { channel: { select: { members: { where: { userId }, select: { id: true } } } } },
        })
        return (job?.channel?.members?.length ?? 0) > 0
    }

    async function isPostOwner(id: string) {
        if (isAdmin) return true
        const post = await prisma.post.findUnique({
            where: { id },
            select: { channel: { select: { members: { where: { userId }, select: { id: true } } } } },
        })
        return (post?.channel?.members?.length ?? 0) > 0
    }

    if (action === 'retry' && jobId) {
        if (!(await isJobOwner(jobId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await prisma.contentJob.update({
            where: { id: jobId },
            data: { status: 'QUEUED', errorMessage: null, processedAt: null },
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'cancel' && jobId) {
        if (!(await isJobOwner(jobId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await prisma.contentJob.update({
            where: { id: jobId },
            data: { status: 'FAILED', errorMessage: 'Cancelled by user' },
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'retry_all_failed') {
        // Get the user's channel IDs so we scope the batch update
        const userChannels = await prisma.channelMember.findMany({
            where: isAdmin ? {} : { userId },
            select: { channelId: true },
        })
        const channelIds = userChannels.map(c => c.channelId)
        const result = await prisma.contentJob.updateMany({
            where: {
                status: 'FAILED',
                ...(isAdmin ? {} : { channelId: { in: channelIds } }),
                ...(jobIds?.length ? { id: { in: jobIds } } : {}),
            },
            data: { status: 'QUEUED', errorMessage: null, processedAt: null },
        })
        return NextResponse.json({ success: true, count: result.count })
    }

    // ─── SmartFlow: Approve post ──────────────────────────────────────────────
    if (action === 'approve' && postId) {
        if (!(await isPostOwner(postId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: { channel: { select: { pipelineApprovalMode: true } } },
        })
        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
        await prisma.post.update({
            where: { id: postId },
            data: {
                status: post.channel.pipelineApprovalMode === 'smartflow' ? 'CLIENT_REVIEW' : 'SCHEDULED',
            },
        })
        return NextResponse.json({ success: true })
    }

    // ─── SmartFlow: Client approve ────────────────────────────────────────────
    if (action === 'client_approve' && postId) {
        if (!(await isPostOwner(postId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await prisma.post.update({ where: { id: postId }, data: { status: 'SCHEDULED' } })
        return NextResponse.json({ success: true })
    }

    // ─── Reject post (with optional comment) ─────────────────────────────────
    if (action === 'reject' && postId) {
        if (!(await isPostOwner(postId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await prisma.post.update({ where: { id: postId }, data: { status: 'REJECTED' } })
        if (comment?.trim()) {
            await prisma.postApproval.create({
                data: { postId, userId, action: 'REJECTED', comment: comment.trim() },
            })
        }
        return NextResponse.json({ success: true })
    }

    // ─── Re-queue rejected post back to pending review ────────────────────────
    if (action === 'requeue' && postId) {
        if (!(await isPostOwner(postId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: { channel: { select: { pipelineApprovalMode: true } } },
        })
        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
        // Return to appropriate review stage
        const nextStatus = post.channel.pipelineApprovalMode === 'smartflow' ? 'CLIENT_REVIEW' : 'PENDING_APPROVAL'
        await prisma.post.update({ where: { id: postId }, data: { status: nextStatus } })
        return NextResponse.json({ success: true })
    }

    // ─── Toggle platform on/off ───────────────────────────────────────────────
    if (action === 'toggle_platform' && platformStatusId && newStatus) {
        if (!isAdmin) {
            const ps = await prisma.postPlatformStatus.findUnique({
                where: { id: platformStatusId },
                select: { post: { select: { channel: { select: { members: { where: { userId }, select: { id: true } } } } } } },
            })
            const isMember = (ps?.post?.channel?.members?.length ?? 0) > 0
            if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        await prisma.postPlatformStatus.update({
            where: { id: platformStatusId },
            data: { status: newStatus },
        })
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
