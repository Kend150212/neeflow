import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Legacy /api/studio/avatars — used by /dashboard/studio/avatars page (no channelId).
 * Resolves the user's first channel and delegates to the same DB logic.
 */

async function resolveChannelId(userId: string): Promise<string | null> {
    // Try to get the first channel the user owns or is a member of
    const member = await prisma.channelMember.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
        select: { channelId: true },
    })
    return member?.channelId ?? null
}

// GET /api/studio/avatars
export async function GET(_req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = await resolveChannelId(session.user.id)
    if (!channelId) return NextResponse.json({ avatars: [] })

    const own = await prisma.studioAvatar.findMany({
        where: { channelId, isActive: true },
        orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ avatars: own })
}

// POST /api/studio/avatars
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = await resolveChannelId(session.user.id)
    if (!channelId) return NextResponse.json({ error: 'No channel found. Go to Dashboard → Studio and select a channel first.' }, { status: 400 })

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
        console.error('[CREATE AVATAR legacy]', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
