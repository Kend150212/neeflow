import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/portal/upload/status — Get content jobs status for the current user's channels
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channelId = req.nextUrl.searchParams.get('channelId')

    // Get user's channel memberships
    const memberships = await prisma.channelMember.findMany({
        where: {
            user: { email: session.user.email },
            ...(channelId ? { channelId } : {}),
        },
        select: { channelId: true },
    })

    const channelIds = memberships.map(m => m.channelId)
    if (channelIds.length === 0) {
        return NextResponse.json({ jobs: [] })
    }

    const jobs = await prisma.contentJob.findMany({
        where: {
            channelId: { in: channelIds },
        },
        include: {
            mediaItem: {
                select: {
                    url: true,
                    thumbnailUrl: true,
                    type: true,
                    originalName: true,
                },
            },
            channel: {
                select: {
                    id: true,
                    displayName: true,
                },
            },
            post: {
                select: {
                    id: true,
                    status: true,
                    scheduledAt: true,
                    content: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    return NextResponse.json({ jobs })
}
