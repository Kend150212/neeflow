import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inbox/conversations
 * Query params: channelId, status, platform, platformAccountId, search, tab, page, limit
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status') // new, open, done, archived
    const platform = searchParams.get('platform')
    const platformAccountId = searchParams.get('platformAccountId')
    const search = searchParams.get('search')
    const tab = searchParams.get('tab') || 'all' // all, messages, comments
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const assignedToMe = searchParams.get('mine') === 'true'

    // Build where clause
    const where: any = {}

    // Channel access check — only show conversations from channels user has access to
    if (channelId) {
        where.channelId = channelId
    } else {
        // Get all channels user is a member of
        const memberships = await prisma.channelMember.findMany({
            where: { userId: session.user.id },
            select: { channelId: true },
        })
        where.channelId = { in: memberships.map(m => m.channelId) }
    }

    // Only show conversations from active/enabled platform accounts
    where.platformAccount = { isActive: true }

    if (status && status !== 'all') {
        where.status = status
    }

    if (assignedToMe) {
        where.assignedTo = session.user.id
    }

    if (platform) {
        where.platform = platform
    }

    if (platformAccountId) {
        where.platformAccountId = platformAccountId
    }

    // Tab-based type filter
    if (tab === 'messages') {
        where.type = 'message'
    } else if (tab === 'comments') {
        where.type = 'comment'
    } else if (tab === 'reviews') {
        where.type = 'review'
    }

    if (search) {
        where.OR = [
            { externalUserName: { contains: search, mode: 'insensitive' } },
            { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
        ]
    }

    const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
            where,
            orderBy: [
                { lastMessageAt: 'desc' },
            ],
            skip: (page - 1) * limit,
            take: limit,
            include: {
                platformAccount: {
                    select: {
                        id: true,
                        platform: true,
                        accountName: true,
                    },
                },
                agent: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                messages: {
                    orderBy: { sentAt: 'desc' },
                    take: 1,
                    select: {
                        content: true,
                        senderType: true,
                        sentAt: true,
                    },
                },
            },
        }),
        prisma.conversation.count({ where }),
    ])

    // Get counts by status for sidebar badges
    const baseWhere = { ...where }
    delete baseWhere.status
    delete baseWhere.assignedTo

    const [countNew, countOpen, countDone, countArchived, countMine] = await Promise.all([
        prisma.conversation.count({ where: { ...baseWhere, status: 'new' } }),
        prisma.conversation.count({ where: { ...baseWhere, status: 'open' } }),
        prisma.conversation.count({ where: { ...baseWhere, status: 'done' } }),
        prisma.conversation.count({ where: { ...baseWhere, status: 'archived' } }),
        prisma.conversation.count({ where: { ...baseWhere, assignedTo: session.user.id } }),
    ])

    // Format conversations for frontend
    const formatted = conversations.map(c => ({
        id: c.id,
        channelId: c.channelId,
        platform: c.platform,
        externalUserId: c.externalUserId,
        externalUserName: c.externalUserName,
        externalUserAvatar: c.externalUserAvatar,
        status: c.status,
        mode: c.mode,
        assignedTo: c.assignedTo,
        agent: c.agent,
        tags: (c.tags as string[]) || [],
        sentiment: c.sentiment,
        intent: c.intent,
        type: c.type,
        metadata: c.metadata,
        priority: c.priority,
        aiSummary: c.aiSummary,
        lastMessageAt: c.lastMessageAt?.toISOString() || null,
        unreadCount: c.unreadCount,
        lastMessage: c.messages[0]?.content?.substring(0, 120) || null,
        lastMessageSender: c.messages[0]?.senderType || null,
        platformAccount: c.platformAccount,
        createdAt: c.createdAt.toISOString(),
    }))

    return NextResponse.json({
        conversations: formatted,
        total,
        page,
        limit,
        counts: {
            new: countNew,
            open: countOpen,
            done: countDone,
            archived: countArchived,
            mine: countMine,
            all: total,
        },
    })
}
