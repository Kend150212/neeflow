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
        if (!tp.accessToken) {
            console.warn(`[Threads sync] No access token for account ${tp.accountId}`)
            continue
        }
        const token = tp.accessToken
        console.log(`[Threads sync] Starting sync for account: ${tp.accountName || tp.accountId} (token: ${token.slice(0, 8)}...)`)

        try {
            // ── 1. Get the user's own Threads posts ──────────────────────────
            const postsUrl = `${BASE}/me/threads?fields=id,text,timestamp,username,media_type,media_url,thumbnail_url,permalink&limit=25&access_token=${token}`
            const postsRes = await fetch(postsUrl)
            const postsData = await postsRes.json()

            if (postsData.error) {
                console.error(`[Threads sync] Posts fetch error:`, JSON.stringify(postsData.error))
                continue
            }

            const posts = postsData.data || []
            console.log(`[Threads sync] Found ${posts.length} posts for account ${tp.accountName}`)

            for (const post of posts) {
                // Resolve the best image URL for this post
                const postMediaUrl: string | null =
                    post.media_type === 'VIDEO'
                        ? (post.thumbnail_url || null)
                        : (post.media_url || null)

                // ── 2. Get replies TO this post ──────────────────────────
                const repUrl = `${BASE}/${post.id}/replies?fields=id,text,username,timestamp,replied_to&limit=50&access_token=${token}`
                const repRes = await fetch(repUrl)
                const repData = await repRes.json()

                if (repData.error) {
                    console.warn(`[Threads sync] ⚠️ Replies error for post ${post.id}: ${repData.error.message} (code: ${repData.error.code})`)
                } else {
                    const replies = repData.data || []
                    console.log(`[Threads sync] Post ${post.id} has ${replies.length} replies`)

                    for (const reply of replies) {
                        await upsertThreadsConversation({
                            channelId,
                            platformAccountId: tp.id,
                            conversationExternalId: post.id,
                            messageExternalId: reply.id,
                            type: 'reply',
                            text: reply.text || '',
                            username: reply.username || 'threads_user',
                            timestamp: reply.timestamp ? new Date(reply.timestamp) : new Date(),
                            rootPostId: post.id,
                            rootPostText: post.text || '',
                            rootPostMediaUrl: postMediaUrl,
                            rootPostMediaType: post.media_type || null,
                            rootPostPermalink: post.permalink || null,
                        })
                        totalSynced++
                        console.log(`[Threads sync] ✅ Synced reply ${reply.id} by @${reply.username} on post ${post.id}`)
                    }
                }

                // ── 2b. Also try conversation_replies (gets ALL nested replies) ──
                const convUrl = `${BASE}/${post.id}/conversation?fields=id,text,username,timestamp,replied_to&limit=50&access_token=${token}`
                const convRes = await fetch(convUrl)
                const convData = await convRes.json()

                if (!convData.error && convData.data) {
                    console.log(`[Threads sync] Post ${post.id} conversation has ${convData.data.length} items`)
                    for (const item of convData.data) {
                        // Skip if already processed as a top-level reply
                        await upsertThreadsConversation({
                            channelId,
                            platformAccountId: tp.id,
                            conversationExternalId: post.id,
                            messageExternalId: item.id,
                            type: 'reply',
                            text: item.text || '',
                            username: item.username || 'threads_user',
                            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
                            rootPostId: post.id,
                            rootPostText: post.text || '',
                            rootPostMediaUrl: postMediaUrl,
                            rootPostMediaType: post.media_type || null,
                            rootPostPermalink: post.permalink || null,
                        })
                        totalSynced++
                    }
                } else if (convData.error) {
                    console.log(`[Threads sync] conversation endpoint not available for post ${post.id}: ${convData.error.message}`)
                }
            }

            // ── 3. Mentions (threads_manage_mentions) ────────────────────────
            const mentionsUrl = `${BASE}/me/mentions?fields=id,text,username,timestamp&limit=50&access_token=${token}`
            const mentionsRes = await fetch(mentionsUrl)
            const mentionsData = await mentionsRes.json()

            if (mentionsData.error) {
                console.warn(`[Threads sync] Mentions error: ${mentionsData.error.message} (code: ${mentionsData.error.code})`)
            } else {
                const mentions = mentionsData.data || []
                console.log(`[Threads sync] Found ${mentions.length} mentions`)
                for (const mention of mentions) {
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
            }

        } catch (err) {
            console.error(`[Threads sync] ❌ Fatal error for account ${tp.accountId}:`, err)
        }
    }

    console.log(`[Threads sync] ✅ Done. Total synced: ${totalSynced}`)
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
    rootPostMediaUrl?: string | null
    rootPostMediaType?: string | null
    rootPostPermalink?: string | null
}) {
    const {
        channelId, platformAccountId,
        conversationExternalId, messageExternalId,
        type, text, username, timestamp, rootPostId, rootPostText,
        rootPostMediaUrl, rootPostMediaType, rootPostPermalink,
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
                // Fields the inbox UI already reads for the post preview card:
                postContent: rootPostText || null,
                postImages: rootPostMediaUrl ? [rootPostMediaUrl] : [],
                postPermalink: rootPostPermalink || null,
                rootPostMediaType: rootPostMediaType || null,
            } as object,
            lastMessageAt: timestamp,
        },
        update: {
            lastMessageAt: timestamp,
            // Also update media fields in case they changed (e.g. thumbnail generated later)
            metadata: {
                threadsType: type,
                rootPostId,
                rootPostText,
                threadExternalId: conversationExternalId,
                postContent: rootPostText || null,
                postImages: rootPostMediaUrl ? [rootPostMediaUrl] : [],
                postPermalink: rootPostPermalink || null,
                rootPostMediaType: rootPostMediaType || null,
            } as object,
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
