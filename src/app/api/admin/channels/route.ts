import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/log-activity'
import { getUserPlan } from '@/lib/plans'

// GET /api/admin/channels — list channels (admin: all, others: assigned only)
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN'
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''

    // Build search/filter condition
    const searchWhere = q ? {
        OR: [
            { displayName: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
            {
                members: {
                    some: {
                        user: {
                            OR: [
                                { email: { contains: q, mode: 'insensitive' as const } },
                                { name: { contains: q, mode: 'insensitive' as const } },
                            ],
                        },
                    },
                },
            },
        ],
    } : {}

    const channels = await prisma.channel.findMany({
        where: isAdmin
            ? searchWhere
            : {
                AND: [
                    { members: { some: { userId: session.user.id, role: { notIn: ['CUSTOMER'] } } } },
                    ...(q ? [searchWhere] : []),
                ],
            },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: { select: { members: true, posts: true, knowledgeBase: true, platforms: true } },
            platforms: {
                select: { id: true, platform: true, accountId: true, accountName: true, isActive: true, config: true },
            },
            // Return OWNER first, fall back to ADMIN
            members: {
                where: { role: { in: ['OWNER', 'ADMIN'] } },
                orderBy: [
                    { role: 'asc' }, // ADMIN < OWNER alphabetically — we prioritise OWNER so we take all and sort in UI
                ],
                take: 3,
                include: {
                    user: { select: { name: true, email: true, role: true } },
                },
            },
        },
    })

    return NextResponse.json(channels)
}

// POST /api/admin/channels — create a new channel
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, displayName, language, timezone, description, defaultAiProvider, vibeTone } = body

    // ─── Permission check: any user with a plan can create channels ──────────
    // Admin users bypass plan check. Others must have an active subscription
    // and must not exceed their plan's maxChannels limit.
    const isAdmin = session.user.role === 'ADMIN'

    if (!isAdmin) {
        const plan = await getUserPlan(session.user.id)

        // Count channels where this user is OWNER
        const ownedChannelCount = await prisma.channelMember.count({
            where: { userId: session.user.id, role: 'OWNER' },
        })

        if (plan.maxChannels !== -1 && ownedChannelCount >= plan.maxChannels) {
            return NextResponse.json(
                {
                    error: `Your ${plan.planName} plan allows up to ${plan.maxChannels} channel${plan.maxChannels === 1 ? '' : 's'}. Upgrade your plan to create more.`,
                    errorType: 'plan_limit',
                    current: ownedChannelCount,
                    limit: plan.maxChannels,
                },
                { status: 403 }
            )
        }
    }

    if (!name || !displayName) {
        return NextResponse.json({ error: 'Name and display name are required' }, { status: 400 })
    }

    // Check unique name PER USER (different users can have same channel slug)
    const existingOwned = await prisma.channel.findFirst({
        where: {
            name,
            members: { some: { userId: session.user.id, role: 'OWNER' } },
        },
    })
    if (existingOwned) {
        return NextResponse.json({ error: 'You already have a channel with this name' }, { status: 409 })
    }

    const channel = await prisma.channel.create({
        data: {
            name: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            displayName,
            language: language || 'en',
            timezone: timezone || 'UTC',
            ...(description && { description }),
            ...(defaultAiProvider && { defaultAiProvider }),
            ...(vibeTone && { vibeTone }),
            // Creator always becomes OWNER of the channel they create
            members: {
                create: {
                    userId: session.user.id,
                    role: 'OWNER',
                    permission: {
                        create: {
                            canCreatePost: true,
                            canEditPost: true,
                            canDeletePost: true,
                            canApprovePost: true,
                            canSchedulePost: true,
                            canUploadMedia: true,
                            canDeleteMedia: true,
                            canViewMedia: true,
                            canCreateEmail: true,
                            canManageContacts: true,
                            canViewReports: true,
                            canEditSettings: true,
                        },
                    },
                },
            },
        },
        include: {
            _count: { select: { members: true, posts: true, knowledgeBase: true, platforms: true } },
            platforms: {
                select: { id: true, platform: true, accountId: true, accountName: true, isActive: true, config: true },
            },
        },
    })

    // Audit log
    logActivity(session.user.id, 'channel_created', { channelId: channel.id, name: channel.displayName })

    return NextResponse.json(channel, { status: 201 })
}

