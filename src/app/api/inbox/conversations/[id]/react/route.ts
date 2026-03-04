import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Facebook reaction map: our emoji → FB enum
const REACTION_MAP: Record<string, string> = {
    '👍': 'LIKE',
    '❤️': 'LOVE',
    '😂': 'HAHA',
    '😮': 'WOW',
    '😢': 'SAD',
    '😡': 'ANGRY',
}

/**
 * POST /api/inbox/conversations/[id]/react
 * Body: { messageId: string (our DB id), externalId: string (FB mid), emoji: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { externalId, emoji } = await req.json()

    const fbReaction = REACTION_MAP[emoji]
    if (!fbReaction) return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 })

    const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: { platform: true, platformAccountId: true, channelId: true },
    })
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only Facebook supports reactions
    if (conversation.platform !== 'facebook') {
        return NextResponse.json({ error: 'Reactions only supported for Facebook' }, { status: 400 })
    }

    const platformAccount = await prisma.channelPlatform.findUnique({
        where: { id: conversation.platformAccountId },
        select: { accessToken: true },
    })
    if (!platformAccount?.accessToken) return NextResponse.json({ error: 'No token' }, { status: 400 })

    try {
        const fbRes = await fetch(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${platformAccount.accessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { comment_id: externalId },
                    sender_action: 'react',
                    payload: { reaction: fbReaction.toLowerCase(), emoji },
                }),
            }
        )
        const fbData = await fbRes.json()
        if (fbData.error) {
            console.warn('[React] FB error:', fbData.error)
            return NextResponse.json({ error: fbData.error.message }, { status: 400 })
        }
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('[React] Error:', err)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}

/**
 * DELETE /api/inbox/conversations/[id]/react
 * Body: { externalId: string }
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { externalId } = await req.json()

    const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: { platform: true, platformAccountId: true },
    })
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const platformAccount = await prisma.channelPlatform.findUnique({
        where: { id: conversation.platformAccountId },
        select: { accessToken: true },
    })
    if (!platformAccount?.accessToken) return NextResponse.json({ error: 'No token' }, { status: 400 })

    try {
        const fbRes = await fetch(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${platformAccount.accessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { comment_id: externalId },
                    sender_action: 'unreact',
                    payload: { reaction: 'NONE' },
                }),
            }
        )
        const fbData = await fbRes.json()
        if (fbData.error) return NextResponse.json({ error: fbData.error.message }, { status: 400 })
        return NextResponse.json({ ok: true })
    } catch (err) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
