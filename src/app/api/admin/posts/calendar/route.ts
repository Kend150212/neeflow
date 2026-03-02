import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma, PostStatus } from '@prisma/client'

/**
 * GET /api/admin/posts/calendar?from=ISO&to=ISO&channelId=&platform=
 *
 * Returns all posts whose display date (scheduledAt → publishedAt → createdAt)
 * falls within [from, to]. Used by the calendar page.
 * No pagination — calendar windows are at most 42 days.
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const channelId = searchParams.get('channelId')
    const platform = searchParams.get('platform')
    const statusParam = searchParams.get('status') // comma-separated e.g. "PUBLISHED,SCHEDULED,FAILED"

    if (!from || !to) {
        return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)
    const allowedStatuses = statusParam ? statusParam.split(',') : ['PUBLISHED', 'SCHEDULED', 'FAILED']

    const isAdmin = session.user.role === 'ADMIN'

    const where: Prisma.PostWhereInput = {
        ...(isAdmin ? {} : { channel: { members: { some: { userId: session.user.id } } } }),
        ...(channelId ? { channelId } : {}),
        status: { in: allowedStatuses as PostStatus[] },
        OR: [
            { scheduledAt: { gte: fromDate, lte: toDate } },
            { publishedAt: { gte: fromDate, lte: toDate } },
            {
                scheduledAt: null,
                publishedAt: null,
                createdAt: { gte: fromDate, lte: toDate },
            },
        ],
        ...(platform ? { platformStatuses: { some: { platform } } } : {}),
    }

    const posts = await prisma.post.findMany({
        where,
        orderBy: [
            { scheduledAt: 'asc' },
            { publishedAt: 'asc' },
            { createdAt: 'asc' },
        ],
        include: {
            channel: { select: { id: true, displayName: true, name: true, timezone: true } },
            media: {
                take: 1,
                include: {
                    mediaItem: {
                        select: { id: true, url: true, thumbnailUrl: true, type: true },
                    },
                },
                orderBy: { sortOrder: 'asc' },
            },
            platformStatuses: {
                select: { platform: true, status: true },
            },
        },
    })

    return NextResponse.json({ posts })
}
