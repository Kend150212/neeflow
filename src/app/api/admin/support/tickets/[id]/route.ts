import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

function requireAdmin(session: { user?: { role?: string; id?: string } } | null) {
    return !session?.user || session.user.role !== 'ADMIN'
}

// GET /api/admin/support/tickets/[id] — full thread + enriched user context
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const ticket = await db.supportTicket.findFirst({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    role: true,
                    createdAt: true,
                    isActive: true,
                    lastLoginAt: true,
                    subscription: {
                        select: {
                            status: true,
                            billingInterval: true,
                            currentPeriodEnd: true,
                            trialEndsAt: true,
                            cancelAtPeriodEnd: true,
                            plan: {
                                select: {
                                    name: true,
                                    maxPostsPerMonth: true,
                                    maxAiImagesPerMonth: true,
                                    maxAiTextPerMonth: true,
                                    maxChannels: true,
                                    hasPrioritySupport: true,
                                },
                            },
                            usages: {
                                orderBy: { month: 'desc' },
                                take: 1,
                                select: {
                                    month: true,
                                    postsCreated: true,
                                    imagesGenerated: true,
                                    aiTextGenerated: true,
                                },
                            },
                        },
                    },
                    channelMembers: {
                        include: {
                            channel: {
                                select: {
                                    id: true,
                                    name: true,
                                    displayName: true,
                                    avatarUrl: true,
                                    isActive: true,
                                    platforms: {
                                        select: { platform: true, accountName: true, isActive: true },
                                    },
                                    _count: {
                                        select: { members: true, posts: true },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            agent: { select: { id: true, name: true, image: true } },
            messages: {
                orderBy: { createdAt: 'asc' },
                include: { sender: { select: { id: true, name: true, image: true, role: true } } },
            },
        },
    })

    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const userId = ticket.user?.id
    if (!userId) return NextResponse.json(ticket)

    // ── Parallel enrichment queries ──────────────────────────────────────────
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [
        totalPostsPublished,
        totalPostsFailed,
        lastPost,
        postsByChannel,
        recentFailedPosts,
        ticketHistory,
        recentActivity,
    ] = await Promise.all([
        // Total published posts
        db.post.count({ where: { authorId: userId, status: 'PUBLISHED' } }),

        // Total failed posts
        db.post.count({ where: { authorId: userId, status: 'FAILED' } }),

        // Last published post
        db.post.findFirst({
            where: { authorId: userId, status: 'PUBLISHED' },
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true, channelId: true, channel: { select: { displayName: true } } },
        }),

        // Posts per channel (published)
        db.post.groupBy({
            by: ['channelId'],
            where: { authorId: userId, status: 'PUBLISHED' },
            _count: { _all: true },
        }),

        // Recent failed posts with error details (last 10)
        db.post.findMany({
            where: { authorId: userId, status: 'FAILED' },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: {
                id: true,
                updatedAt: true,
                channel: { select: { displayName: true } },
                platformStatuses: {
                    where: { status: 'failed' },
                    select: { platform: true, errorMsg: true },
                },
            },
        }),

        // Ticket history (all other tickets by this user)
        db.supportTicket.count({ where: { userId, id: { not: id } } }),

        // Recent activity logs (last 15)
        db.activityLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 15,
            select: { action: true, details: true, createdAt: true, channelId: true },
        }),
    ])

    // Build channel name lookup map
    const channelMap: Record<string, string> = {}
    for (const m of ticket.user.channelMembers) {
        channelMap[m.channel.id] = m.channel.displayName
    }

    // Attach postsByChannel label
    const postsByChannelLabeled = postsByChannel.map((g: { channelId: string; _count: { _all: number } }) => ({
        channelId: g.channelId,
        channelName: channelMap[g.channelId] ?? g.channelId,
        count: g._count._all,
    }))

    return NextResponse.json({
        ...ticket,
        userContext: {
            totalPostsPublished,
            totalPostsFailed,
            lastPublishedAt: lastPost?.publishedAt ?? null,
            lastPublishedChannel: lastPost?.channel?.displayName ?? null,
            postsByChannel: postsByChannelLabeled,
            recentFailedPosts,
            ticketHistory,
            thisMonthUsage: ticket.user.subscription?.usages?.[0] ?? null,
            currentMonth: thisMonth,
            recentActivity,
        },
    })
}

// PATCH /api/admin/support/tickets/[id]
// Actions: reply | internalNote | assign | status | priority
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { action } = body

    const ticket = await db.supportTicket.findFirst({ where: { id } })
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'reply' || action === 'internalNote') {
        const msg = await db.ticketMessage.create({
            data: {
                ticketId: id,
                senderId: session!.user!.id,
                content: body.message,
                isInternal: action === 'internalNote',
                isBotMsg: false,
                attachments: body.attachments || [],
            },
            include: { sender: { select: { id: true, name: true, image: true, role: true } } },
        })
        // Move to pending when agent replies
        if (action === 'reply') {
            await db.supportTicket.update({ where: { id }, data: { status: 'pending' } })
        }
        return NextResponse.json(msg, { status: 201 })
    }

    if (action === 'assign') {
        const updated = await db.supportTicket.update({
            where: { id },
            data: { assignedTo: body.agentId || null },
        })
        return NextResponse.json(updated)
    }

    if (action === 'status') {
        const data: Record<string, unknown> = { status: body.status }
        if (body.status === 'resolved') data.resolvedAt = new Date()
        const updated = await db.supportTicket.update({ where: { id }, data })
        return NextResponse.json(updated)
    }

    if (action === 'priority') {
        const updated = await db.supportTicket.update({ where: { id }, data: { priority: body.priority } })
        return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
