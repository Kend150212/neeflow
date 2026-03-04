import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inbox/channels/[id]/members
 * Returns all members of a channel (for assign dropdown)
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params

    // Verify the current user is a member of this channel
    const membership = await prisma.channelMember.findFirst({
        where: { channelId, userId: session.user.id },
    })
    if (!membership && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const members = await prisma.channelMember.findMany({
        where: { channelId },
        include: {
            user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { userId: 'asc' },
    })

    return NextResponse.json({
        members: members.map(m => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image,
            role: m.role,
        })),
    })
}
