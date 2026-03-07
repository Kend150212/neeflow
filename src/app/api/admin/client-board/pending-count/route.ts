import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/client-board/pending-count
 * Returns count of posts needing action:
 *   - PENDING_APPROVAL (admin needs to review)
 *   - CLIENT_REVIEW    (client needs to approve)
 * Used by the sidebar to show a real-time notification badge.
 */
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ count: 0 }, { status: 401 })
    }

    try {
        // Get all channelIds this user has OWNER/ADMIN access to
        const memberships = await prisma.channelMember.findMany({
            where: { userId: session.user.id, role: { in: ['OWNER', 'ADMIN'] } },
            select: { channelId: true },
        })
        const channelIds = memberships.map(m => m.channelId)
        if (channelIds.length === 0) return NextResponse.json({ count: 0 })

        // Count jobs where the generated post needs action
        const count = await prisma.contentJob.count({
            where: {
                channelId: { in: channelIds },
                status: 'COMPLETED',
                post: {
                    status: { in: ['PENDING_APPROVAL', 'CLIENT_REVIEW'] },
                },
            },
        })

        return NextResponse.json({ count })
    } catch (error) {
        console.error('[pending-count]', error)
        return NextResponse.json({ count: 0 })
    }
}
