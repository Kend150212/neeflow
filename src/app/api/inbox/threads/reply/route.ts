import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BASE = 'https://graph.threads.net/v1.0'

// POST /api/inbox/threads/reply
// Creates a reply to a Threads post on behalf of the connected account.
// Body: { channelId, replyToId, text, platformAccountId }
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId, replyToId, text, platformAccountId } = await req.json()
    if (!channelId || !replyToId || !text) {
        return NextResponse.json({ error: 'channelId, replyToId, and text are required' }, { status: 400 })
    }

    // Verify access
    const isAdmin = session.user.role === 'ADMIN'
    if (!isAdmin) {
        const member = await prisma.channelMember.findFirst({
            where: { channelId, userId: session.user.id, role: { notIn: ['CUSTOMER'] } }
        })
        if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get Threads platform account
    const platformAccount = platformAccountId
        ? await prisma.channelPlatform.findFirst({
            where: { id: platformAccountId, channelId, platform: 'threads', isActive: true },
            select: { accountId: true, accessToken: true }
        })
        : await prisma.channelPlatform.findFirst({
            where: { channelId, platform: 'threads', isActive: true },
            select: { accountId: true, accessToken: true }
        })

    if (!platformAccount?.accessToken) {
        return NextResponse.json({ error: 'No active Threads account found' }, { status: 404 })
    }

    const { accountId, accessToken: token } = platformAccount

    try {
        // Step 1: Create reply container (threads_manage_replies)
        const createRes = await fetch(`${BASE}/${accountId}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                media_type: 'TEXT',
                text,
                reply_to_id: replyToId,
                access_token: token,
            }),
        })
        const createData = await createRes.json()
        if (createData.error || !createData.id) {
            console.error('[Threads reply] Create container error:', createData.error)
            return NextResponse.json({ error: createData.error?.message || 'Failed to create reply container' }, { status: 500 })
        }

        // Step 2: Publish the reply container
        const publishRes = await fetch(`${BASE}/${accountId}/threads_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: createData.id,
                access_token: token,
            }),
        })
        const publishData = await publishRes.json()
        if (publishData.error || !publishData.id) {
            console.error('[Threads reply] Publish error:', publishData.error)
            return NextResponse.json({ error: publishData.error?.message || 'Failed to publish reply' }, { status: 500 })
        }

        return NextResponse.json({ success: true, replyId: publishData.id })

    } catch (err) {
        console.error('[Threads reply] Unexpected error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
