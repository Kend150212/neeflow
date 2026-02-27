import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/log-activity'
import type { Prisma } from '@prisma/client'
import { sendPendingApprovalWebhooks } from '@/lib/webhook-notify'
import { incrementPostUsage, checkPostLimit } from '@/lib/billing/check-limits'

// GET /api/admin/posts — list posts with filters
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const isAdmin = session.user.role === 'ADMIN'

    // Build where clause
    const where: Prisma.PostWhereInput = {}

    // Non-admin: only posts from assigned channels
    if (!isAdmin) {
        where.channel = { members: { some: { userId: session.user.id } } }
    }

    if (channelId) where.channelId = channelId
    if (status) where.status = status as Prisma.EnumPostStatusFilter
    if (search) {
        where.content = { contains: search, mode: 'insensitive' }
    }

    const [posts, total] = await Promise.all([
        prisma.post.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                channel: { select: { id: true, displayName: true, name: true } },
                author: { select: { id: true, name: true, email: true } },
                media: {
                    include: {
                        mediaItem: {
                            select: { id: true, url: true, thumbnailUrl: true, type: true, originalName: true },
                        },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
                platformStatuses: true,
                _count: { select: { approvals: true } },
            },
        }),
        prisma.post.count({ where }),
    ])

    return NextResponse.json({
        posts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
}

// POST /api/admin/posts — create a new post
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
        channelId,
        content,
        contentPerPlatform,
        status = 'DRAFT',
        scheduledAt,
        mediaIds,
        platforms,
        requestApproval,  // boolean — used when channel.requireApproval === 'optional'
    } = body

    if (!channelId) {
        return NextResponse.json({ error: 'Channel is required' }, { status: 400 })
    }

    if (!content && !contentPerPlatform) {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Verify channel exists and user has access
    const isAdmin = session.user.role === 'ADMIN'
    const channel = await prisma.channel.findFirst({
        where: {
            id: channelId,
            ...(isAdmin ? {} : { members: { some: { userId: session.user.id } } }),
        },
        include: {
            platforms: { where: { isActive: true } },
        },
    })

    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // ─── Post quota enforcement (non-admin only) ──────────────────────────────
    if (!isAdmin) {
        const limitError = await checkPostLimit(session.user.id)
        if (limitError) {
            return NextResponse.json(
                { error: limitError.message, errorType: 'LIMIT_REACHED', feature: 'posts', limit: limitError.limit, current: limitError.current },
                { status: 402 }
            )
        }
    }

    // Generate content hash for duplicate detection
    const contentHash = content
        ? Buffer.from(content).toString('base64').slice(0, 32)
        : undefined

    // Determine post status based on channel approval mode
    let finalStatus = status
    if (status === 'SCHEDULED' && !scheduledAt) {
        finalStatus = 'DRAFT'
    }
    const approvalMode = channel.requireApproval as unknown as string // 'none'|'optional'|'required'
    if (approvalMode === 'required' && status !== 'DRAFT') {
        finalStatus = 'PENDING_APPROVAL'
    } else if (approvalMode === 'optional' && requestApproval && status !== 'DRAFT') {
        finalStatus = 'PENDING_APPROVAL'
    }

    const post = await prisma.post.create({
        data: {
            channelId,
            authorId: session.user.id,
            content,
            contentPerPlatform: contentPerPlatform || {},
            status: finalStatus,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            contentHash,
            // Attach media
            ...(mediaIds?.length ? {
                media: {
                    create: mediaIds.map((mediaItemId: string, index: number) => ({
                        mediaItemId,
                        sortOrder: index,
                    })),
                },
            } : {}),
            // Create platform statuses
            ...(platforms?.length ? {
                platformStatuses: {
                    create: platforms.map((p: { platform: string; accountId: string;[key: string]: unknown }) => {
                        // Extract platform-specific config (postType, firstComment, carousel, visibility, etc.)
                        const { platform, accountId, ...rest } = p
                        const config = Object.keys(rest).length > 0 ? rest : undefined
                        return {
                            platform,
                            accountId,
                            status: 'pending',
                            ...(config ? { config } : {}),
                        }
                    }),
                },
            } : {}),
        },
        include: {
            channel: { select: { id: true, displayName: true, name: true } },
            author: { select: { id: true, name: true, email: true } },
            media: {
                include: {
                    mediaItem: {
                        select: { id: true, url: true, thumbnailUrl: true, type: true, originalName: true },
                    },
                },
                orderBy: { sortOrder: 'asc' },
            },
            platformStatuses: true,
        },
    })

    // Fire webhook notification when post requires approval
    if (post.status === 'PENDING_APPROVAL') {
        try {
            const channel = await prisma.channel.findUnique({ where: { id: post.channelId } })
            const appBaseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            const firstImage = post.media?.[0]?.mediaItem?.url || null
            const fullImageUrl = firstImage && !firstImage.startsWith('http')
                ? `${appBaseUrl}${firstImage}` : firstImage
            await sendPendingApprovalWebhooks(
                {
                    webhookDiscord: channel?.webhookDiscord as Record<string, string> | null,
                    webhookTelegram: channel?.webhookTelegram as Record<string, string> | null,
                    webhookSlack: channel?.webhookSlack as Record<string, string> | null,
                    webhookZalo: { ...(channel?.webhookZalo as Record<string, string> || {}), channelId: channel?.id } as Record<string, string> | null,
                    webhookCustom: channel?.webhookCustom as Record<string, string> | null,
                    webhookEvents: channel?.webhookEvents as string[] | null,
                },
                {
                    postId: post.id,
                    content: post.content || '',
                    authorName: post.author?.name || post.author?.email || 'Unknown',
                    channelName: post.channel?.name || '',
                    platforms: post.platformStatuses.map((ps: { platform: string }) => ps.platform),
                    scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : null,
                    imageUrl: fullImageUrl,
                    appBaseUrl,
                },
            )
        } catch (err) {
            console.warn('[Webhook] Pending approval notification error:', err)
        }
    }

    // Audit log
    logActivity(session.user.id, 'post_created', { postId: post.id, channel: post.channel?.name }, channelId)

    // Increment monthly post usage counter (fire-and-forget, don't block response)
    incrementPostUsage(session.user.id).catch(() => { })

    return NextResponse.json(post, { status: 201 })
}
