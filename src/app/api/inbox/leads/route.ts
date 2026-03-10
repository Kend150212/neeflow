import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inbox/leads?channelId=xxx&status=xxx&search=xxx&page=1&limit=50
 * List all leads for a channel (channel-scoped)
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Resolve channelIds user has access to
    let channelIds: string[]
    if (channelId) {
        channelIds = [channelId]
    } else {
        const memberships = await prisma.channelMember.findMany({
            where: { userId: session.user.id },
            select: { channelId: true },
        })
        channelIds = memberships.map(m => m.channelId)
    }

    const where: Record<string, unknown> = {
        channelId: { in: channelIds },
    }
    if (status) where.status = status
    if (search) {
        where.OR = [
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
        ]
    }

    const [leads, total] = await Promise.all([
        prisma.inboxContact.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                conversation: {
                    select: {
                        id: true,
                        externalUserAvatar: true,
                        lastMessageAt: true,
                        platform: true,
                    },
                },
            },
        }),
        prisma.inboxContact.count({ where }),
    ])

    return NextResponse.json({ leads, total, page, limit })
}

/**
 * POST /api/inbox/leads
 * Create or upsert a lead
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { channelId, platform, externalUserId, conversationId, ...data } = body

    if (!channelId || !platform || !externalUserId) {
        return NextResponse.json({ error: 'channelId, platform, externalUserId required' }, { status: 400 })
    }

    const contact = await prisma.inboxContact.upsert({
        where: {
            channelId_platform_externalUserId: { channelId, platform, externalUserId },
        },
        update: { ...data, conversationId: conversationId ?? undefined },
        create: { channelId, platform, externalUserId, conversationId, ...data },
    })

    return NextResponse.json(contact)
}
