import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BASE = 'https://graph.threads.net/v1.0'

// POST /api/inbox/threads/sync
// Correct flow:
//   1. GET /me/threads           → list user's own posts (threads_basic)
//   2. GET /{post-id}/replies    → replies TO each post  (threads_read_replies)
//   3. GET /me/mentions          → posts that mention the user (threads_manage_mentions)
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await req.json()
    if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

    // Verify access
    const isAdmin = session.user.role === 'ADMIN'
    if (!isAdmin) {
        const member = await prisma.channelMember.findFirst({
            where: { channelId, userId: session.user.id, role: { notIn: ['CUSTOMER'] } }
        })
        if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

        try {
            // ── 1. Get the user's own Threads posts ──────────────────────────
            const postsRes = await fetch(
                `${BASE}/me/threads?fields=id,text,timestamp,username&limit=25&access_token=${token}`
            )
            const postsData = await postsRes.json()

            if (postsData.data && Array.isArray(postsData.data)) {
                for (const post of postsData.data) {
                    // ── 2. Get replies TO this post ──────────────────────────
                    const repRes = await fetch(
                        `${BASE}/${post.id}/replies?fields=id,text,username,timestamp,replied_to&limit=50&access_token=${token}`
                    )
                    const repData = await repRes.json()

                    if (repData.data && Array.isArray(repData.data)) {
                        for (const reply of repData.data) {
                            await upsertThreadsConversation({
                                channelId,
                                platformAccountId: tp.id,
                                // Group by post — all replies to same post = same conversation
                                conversationExternalId: post.id,
                                messageExternalId: reply.id,
                                type: 'reply',
                                text: reply.text || '',
                                username: reply.username || 'threads_user',
                                timestamp: reply.timestamp ? new Date(reply.timestamp) : new Date(),
                                rootPostId: post.id,
                                rootPostText: post.text || '',
                            })
                            totalSynced++
                        }
                    } else if (repData.error) {
                        console.warn(`[Threads sync] replies error for post ${post.id}:`, repData.error?.message)
                    }
                }
            } else if (postsData.error) {
                console.warn(`[Threads sync] posts fetch error:`, postsData.error?.message)
            }

            // ── 3. Mentions (threads_manage_mentions) ────────────────────────
            const mentionsRes = await fetch(
                `${BASE}/me/mentions?fields=id,text,username,timestamp&limit=50&access_token=${token}`
            )
            const mentionsData = await mentionsRes.json()

            if (mentionsData.data && Array.isArray(mentionsData.data)) {
                for (const mention of mentionsData.data) {
                    await upsertThreadsConversation({
                        channelId,
                        platformAccountId: tp.id,
                        conversationExternalId: mention.id,
                        messageExternalId: mention.id,
                        type: 'mention',
                        text: mention.text || '',
                        username: mention.username || 'threads_user',
                        timestamp: mention.timestamp ? new Date(mention.timestamp) : new Date(),
                        rootPostId: null,
                        rootPostText: null,
                    })
                    totalSynced++
                }
            } else if (mentionsData.error) {
                console.warn(`[Threads sync] mentions error:`, mentionsData.error?.message)
            }

        } catch (err) {
            console.error(`[Threads sync] Error for account ${tp.accountId}:`, err)
        }
    }

    return NextResponse.json({ synced: totalSynced, accounts: threadsPlatforms.length })
}

// ── Helper: upsert Threads conversation + message ────────────────────
async function upsertThreadsConversation(params: {
    channelId: string
    platformAccountId: string
    conversationExternalId: string   // post ID — groups replies together
    messageExternalId: string        // reply/mention ID
    type: 'reply' | 'mention'
    text: string
    username: string
    timestamp: Date
    rootPostId: string | null
    rootPostText: string | null
}) {
    const {
        channelId, platformAccountId,
        conversationExternalId, messageExternalId,
        type, text, username, timestamp, rootPostId, rootPostText,
    } = params

    // One conversation per post (all replies grouped under the same post)
    const conversation = await prisma.conversation.upsert({
        where: {
            channelId_platform_externalUserId: {
                channelId,
                platform: 'threads',
                externalUserId: conversationExternalId,
            },
        },
        create: {
            channelId,
            platformAccountId,
            platform: 'threads',
            externalUserId: conversationExternalId,
            status: 'open',
            type: 'comment',
            externalUserName: username,
            metadata: {
                threadsType: type,
                rootPostId,
                rootPostText,
                threadExternalId: conversationExternalId,   // used as reply_to_id when replying
            } as object,
            lastMessageAt: timestamp,
        },
        update: {
            lastMessageAt: timestamp,
        },
        select: { id: true },
    })

    // Deduplicate messages by externalId
    const existing = await prisma.inboxMessage.findFirst({
        where: { conversationId: conversation.id, externalId: messageExternalId },
        select: { id: true },
    })
    if (!existing) {
        await prisma.inboxMessage.create({
            data: {
                conversationId: conversation.id,
                externalId: messageExternalId,
                direction: 'inbound',
                content: text,
                senderName: username,
                senderType: 'customer',
                sentAt: timestamp,
            },
        })
    }
}

// GET — quick health check
export async function GET() {
    return NextResponse.json({ status: 'ok', endpoint: 'Threads inbox sync' })
}
