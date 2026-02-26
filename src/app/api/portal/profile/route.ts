import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/portal/profile — customer profile + channels
export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true, name: true, email: true, role: true, image: true, createdAt: true,
        },
    })

    const memberships = await prisma.channelMember.findMany({
        where: { userId: session.user.id },
        include: {
            channel: {
                select: { id: true, displayName: true, name: true, isActive: true },
            },
        },
    })

    const channels = memberships.map((m) => ({
        id: m.channel.id,
        displayName: m.channel.displayName,
        name: m.channel.name,
        isActive: m.channel.isActive,
    }))

    return NextResponse.json({ user, channels })
}
