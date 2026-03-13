import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BASE = 'https://graph.threads.net/v1.0'

// POST /api/inbox/threads/sync
// Fetches Threads replies and mentions for all active Threads accounts in the channel
// and upserts them as Conversations + Messages in the inbox.
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await req.json()
    if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

    // Verify user has access to this channel
    const isAdmin = session.user.role === 'ADMIN'
    if (!isAdmin) {
        const member = await prisma.channelMember.findFirst({
            where: { channelId, userId: session.user.id, role: { notIn: ['CUSTOMER'] } }
        })
        if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get active Threads platform accounts for this channel
    const threadsPlatforms = await prisma.channelPlatform.findMany({
        where: { channelId, platform: 'threads', isActive: true },
        select: { id: true, accountId: true, accountName: true, accessToken: true }
    })

    if (threadsPlatforms.length === 0) {
        return NextResponse.json({ synced: 0, message: 'No active Threads accounts' })
    }

    let totalSynced = 0

    for (const tp of threadsPlatforms) {
        if (!tp.accessToken) continue
        const token = tp.accessToken

        // Fetch platform account record
        const platformAccount = await prisma.platformAccount.findFirst({
            where: { channelId, platform: 'threads', externalId: tp.accountId }
        })
        if (!platformAccount) continue

        try {
            // ── 1. Fetch replies (threads_manage_replies + threads_read_replies) ──
            const repliesRes = await fetch(
                `${BASE}/${tp.accountId}/replies?fields=id,text,username,timestamp,has_replies,root_post,replied_to,is_reply&limit=50&access_token=${token}`
            )
            const repliesData = await repliesRes.json()

            if (repliesData.data && Array.isArray(repliesData.data)) {
                for (const reply of repliesData.data) {
                    await upsertThreadsConversation({
                        channelId,
                        platformAccountId: platformAccount.id,
                        externalId: reply.id,
                        type: 'reply',
                        text: reply.text || '',
                        username: reply.username || 'threads_user',
                        timestamp: reply.timestamp ? new Date(reply.timestamp) : new Date(),
                        rootPostId: reply.root_post?.id || reply.replied_to?.id || null,
                    })
                    totalSynced++
                }
            }

            // ── 2. Fetch mentions (threads_manage_mentions) ──
            const mentionsRes = await fetch(
                `${BASE}/${tp.accountId}/mentions?fields=id,text,username,timestamp&limit=50&access_token=${token}`
            )
            const mentionsData = await mentionsRes.json()

            if (mentionsData.data && Array.isArray(mentionsData.data)) {
                for (const mention of mentionsData.data) {
                    await upsertThreadsConversation({
                        channelId,
                        platformAccountId: platformAccount.id,
                        externalId: mention.id,
                        type: 'mention',
                        text: mention.text || '',
                        username: mention.username || 'threads_user',
                        timestamp: mention.timestamp ? new Date(mention.timestamp) : new Date(),
                        rootPostId: null,
                    })
                    totalSynced++
                }
            }

        } catch (err) {
            console.error(`[Threads sync] Error for account ${tp.accountId}:`, err)
        }
    }

    return NextResponse.json({ synced: totalSynced, accounts: threadsPlatforms.length })
}

// ── Helper: upsert a Threads conversation + message ──────────────────
async function upsertThreadsConversation(params: {
    channelId: string
    platformAccountId: string
    externalId: string
    type: 'reply' | 'mention'
    text: string
    username: string
    timestamp: Date
    rootPostId: string | null
}) {
    const { channelId, platformAccountId, externalId, type, text, username, timestamp, rootPostId } = params

    // Upsert conversation
    const conversation = await prisma.conversation.upsert({
        where: { externalId_platform: { externalId, platform: 'threads' } },
        create: {
            channelId,
            platformAccountId,
            platform: 'threads',
            externalId,
            status: 'open',
            participantName: username,
            participantExternalId: username,
            metadata: { type, rootPostId } as object,
            lastMessageAt: timestamp,
        },
        update: {
            lastMessageAt: timestamp,
            participantName: username,
        },
        select: { id: true }
    })

    // Upsert the message itself
    await prisma.message.upsert({
        where: { externalId_conversationId: { externalId, conversationId: conversation.id } },
        create: {
            conversationId: conversation.id,
            externalId,
            content: text,
            senderName: username,
            senderType: 'customer',
            sentAt: timestamp,
            metadata: { threadsType: type, rootPostId } as object,
        },
        update: { content: text },
    })
}

// GET /api/inbox/threads/sync — quick status check
export async function GET() {
    return NextResponse.json({ status: 'ok', endpoint: 'Threads inbox sync' })
}
