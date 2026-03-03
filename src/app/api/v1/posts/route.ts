import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, apiSuccess } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/v1/posts — List posts (filter by channelId, status, limit, offset)
 */
export async function GET(req: NextRequest) {
    const authResult = await authenticateApiKey(req)
    if (authResult instanceof NextResponse) return authResult

    const { user, plan, usage } = authResult
    const { searchParams } = new URL(req.url)

    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = {}
    if (channelId) where.channelId = channelId
    if (status) where.status = status.toUpperCase()

    // Non-admin only sees own posts
    if (user.role !== 'ADMIN') {
        where.authorId = user.id
    }

    const [posts, total] = await Promise.all([
        prisma.post.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                content: true,
                contentPerPlatform: true,
                status: true,
                scheduledAt: true,
                publishedAt: true,
                createdAt: true,
                channel: { select: { id: true, displayName: true } },
                platformStatuses: {
                    select: { platform: true, status: true, externalId: true, errorMsg: true, publishedAt: true },
                },
                media: {
                    select: { mediaItem: { select: { id: true, url: true, thumbnailUrl: true, mimeType: true } } },
                    orderBy: { sortOrder: 'asc' },
                },
            },
        }),
        prisma.post.count({ where }),
    ])

    return apiSuccess({ posts, total, limit, offset }, usage.apiCalls, plan.maxApiCallsPerMonth)
}

/**
 * POST /api/v1/posts — Create a new post (full multi-platform support)
 */
export async function POST(req: NextRequest) {
    const authResult = await authenticateApiKey(req)
    if (authResult instanceof NextResponse) return authResult

    const { user, plan, usage } = authResult
    const body = await req.json()

    const { channelId, content, contentPerPlatform, platforms, platformConfig, mediaIds, scheduledAt, status } = body

    if (!channelId) {
        return NextResponse.json(
            { success: false, error: { code: 'MISSING_CHANNEL', message: 'channelId is required' } },
            { status: 400 },
        )
    }

    if (!content && !contentPerPlatform) {
        return NextResponse.json(
            { success: false, error: { code: 'MISSING_CONTENT', message: 'content or contentPerPlatform is required' } },
            { status: 400 },
        )
    }

    // ── Post quota check ────────────────────────────────────────────────────
    const maxPosts = (plan.maxPostsPerMonth as number) ?? 0
    if (maxPosts !== -1 && maxPosts !== 0) {
        // maxPosts === -1 → unlimited, maxPosts === 0 → no gating (legacy)
        const now = new Date()
        const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)
        if (usage.postsCreated >= maxPosts) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'POST_QUOTA_EXCEEDED',
                        message: `Post limit reached (${maxPosts}/month). Resets on ${resetDate}.`,
                    },
                    meta: { posts: { used: usage.postsCreated, limit: maxPosts, reset: resetDate } },
                },
                { status: 429 },
            )
        }
    }

    // Verify channel access
    const channel = await prisma.channel.findFirst({
        where: {
            id: channelId,
            OR: [
                ...(user.role === 'ADMIN' ? [{}] : []),
                { members: { some: { userId: user.id } } },
            ],
        },
        include: {
            platforms: { where: { isActive: true } },
        },
    })

    if (!channel) {
        return NextResponse.json(
            { success: false, error: { code: 'CHANNEL_NOT_FOUND', message: 'Channel not found or no access' } },
            { status: 404 },
        )
    }

    // Determine post status
    let postStatus = 'DRAFT'
    if (status === 'SCHEDULED' && scheduledAt) postStatus = 'SCHEDULED'
    else if (status === 'PENDING_APPROVAL') postStatus = 'PENDING_APPROVAL'

    // Create the post
    const post = await prisma.post.create({
        data: {
            channelId,
            authorId: user.id,
            content: content || '',
            contentPerPlatform: contentPerPlatform || {},
            status: postStatus as 'DRAFT' | 'SCHEDULED' | 'PENDING_APPROVAL',
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            // Connect media if provided
            ...(mediaIds?.length ? {
                media: {
                    create: mediaIds.map((id: string, i: number) => ({
                        mediaItemId: id,
                        sortOrder: i,
                    })),
                },
            } : {}),
        },
    })

    // Create platform statuses
    const targetPlatforms = platforms || channel.platforms.map((p: { platform: string }) => p.platform)

    for (const platformName of targetPlatforms) {
        const channelPlatform = channel.platforms.find((p: { platform: string }) => p.platform === platformName)
        if (!channelPlatform) continue

        await prisma.postPlatformStatus.create({
            data: {
                postId: post.id,
                platform: platformName,
                accountId: channelPlatform.id,
                status: 'pending',
                config: platformConfig?.[platformName] || null,
            },
        })
    }

    // Fetch the complete post with relations
    const fullPost = await prisma.post.findUnique({
        where: { id: post.id },
        select: {
            id: true,
            content: true,
            contentPerPlatform: true,
            status: true,
            scheduledAt: true,
            createdAt: true,
            platformStatuses: {
                select: { platform: true, status: true, config: true },
            },
        },
    })

    // Increment postsCreated usage (fire-and-forget)
    prisma.usage.update({
        where: { id: usage.usageId },
        data: { postsCreated: { increment: 1 } },
    }).catch(() => { })

    return apiSuccess(fullPost, usage.apiCalls, plan.maxApiCallsPerMonth as number, 201)
}
