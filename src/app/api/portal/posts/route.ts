import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/portal/posts
// Returns posts for ALL channels the user belongs to
// Works for CUSTOMER, ADMIN, OWNER, etc. — anyone with channel membership
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get ALL channels the user is a member of (any role)
    const memberships = await prisma.channelMember.findMany({
        where: { userId: session.user.id },
        select: { channelId: true },
    })
    const channelIds = memberships.map((m) => m.channelId)

    if (channelIds.length === 0) return NextResponse.json({ posts: [] })

    const posts = await prisma.post.findMany({
        where: {
            channelId: { in: channelIds },
            status: { in: ['CLIENT_REVIEW', 'SCHEDULED', 'PUBLISHED'] },
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
                include: { user: { select: { name: true, email: true } } },
                orderBy: { createdAt: 'desc' as const },
            },
            platformStatuses: { select: { id: true, platform: true, accountId: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ posts })
}
