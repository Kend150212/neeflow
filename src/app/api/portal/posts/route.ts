import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/portal/posts
// Returns posts for ALL channels the customer belongs to
// Includes CLIENT_REVIEW, PENDING_APPROVAL, SCHEDULED, and PUBLISHED posts
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'CUSTOMER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Get customer's channels — no approval-mode filter!
    // The customer should see posts in ALL channels they belong to.
    const memberships = await prisma.channelMember.findMany({
        where: { userId: session.user.id, role: 'CUSTOMER' },
        select: { channelId: true },
    })
    const channelIds = memberships.map((m) => m.channelId)

    if (channelIds.length === 0) return NextResponse.json({ posts: [] })

    const posts = await prisma.post.findMany({
        where: {
            channelId: { in: channelIds },
            status: { in: ['PENDING_APPROVAL', 'CLIENT_REVIEW', 'SCHEDULED', 'PUBLISHED'] },
        },
        include: {
            channel: { select: { id: true, displayName: true } },
            author: { select: { name: true, email: true } },
            media: {
                include: {
                    mediaItem: { select: { id: true, url: true, thumbnailUrl: true, type: true } },
                },
                orderBy: { sortOrder: 'asc' },
            },
            approvals: {
                where: { userId: session.user.id },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
            platformStatuses: { select: { id: true, platform: true, accountId: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ posts })
}
