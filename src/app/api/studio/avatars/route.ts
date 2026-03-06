import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Legacy /api/studio/avatars — used by /dashboard/studio and /dashboard/studio/avatars pages.
 * Accepts ?channelId=xxx from the workspace context (activeChannelId).
 * Falls back to the user's first channel member if no channelId provided.
 */

async function resolveChannelId(userId: string, fromQuery?: string | null): Promise<string | null> {
    if (fromQuery) {
        // Verify the user has membership in the requested channel
        const member = await prisma.channelMember.findFirst({
            where: { userId, channelId: fromQuery },
            select: { channelId: true },
        })
        if (member) return member.channelId
    }
    // Fallback: first channel member
    const member = await prisma.channelMember.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
        select: { channelId: true },
    })
    return member?.channelId ?? null
}

// GET /api/studio/avatars?channelId=xxx
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = await resolveChannelId(
        session.user.id,
        req.nextUrl.searchParams.get('channelId'),
    )
    if (!channelId) return NextResponse.json({ avatars: [] })

    const own = await prisma.studioAvatar.findMany({
        where: { channelId, isActive: true },
        orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ avatars: own, channelId })
}

// POST /api/studio/avatars?channelId=xxx
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = await resolveChannelId(
        session.user.id,
        req.nextUrl.searchParams.get('channelId'),
    )
    if (!channelId) {
        return NextResponse.json({ error: 'No channel found. Go to Dashboard and select a channel from the workspace first.' }, { status: 400 })
    }

    const body = await req.json()
    const { name, description, prompt, style } = body

    if (!name || !prompt) {
        return NextResponse.json({ error: 'name and prompt are required' }, { status: 400 })
    }

    try {
        const avatar = await prisma.studioAvatar.create({
            data: {
                userId: session.user.id,
                channelId,
                name,
                description: description || null,
                prompt,
                style: style || 'realistic',
            },
        })
        return NextResponse.json({ avatar }, { status: 201 })
    } catch (err) {
        console.error('[CREATE AVATAR]', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
