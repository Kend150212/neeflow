import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { botAutoReply, sendBotGreeting } from '@/lib/bot-auto-reply'
import { notifyChannelAdmins } from '@/lib/notify'

// Queue of background bot tasks to execute after returning 200
type BotTask = () => Promise<void>
const pendingBotTasks: BotTask[] = []

// ─── Webhook verify token ──────────────
const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || 'Neeflow'

/**
 * GET /api/webhooks/facebook
 * Facebook Webhook Verification (required during setup)
 */
export async function GET(req: NextRequest) {
    const mode = req.nextUrl.searchParams.get('hub.mode')
    const token = req.nextUrl.searchParams.get('hub.verify_token')
    const challenge = req.nextUrl.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[FB Webhook] ✅ Verified')
        return new NextResponse(challenge, { status: 200 })
    }

    console.warn('[FB Webhook] ❌ Verification failed')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST /api/webhooks/facebook
 * Receive Facebook events: comments (feed), messages (messaging)
 */
export async function POST(req: NextRequest) {
    const body = await req.json()

    console.log('[Webhook] Received:', JSON.stringify(body).substring(0, 500))

    // Collect bot tasks to run AFTER returning 200 to Facebook
    const botTasks: BotTask[] = []

    // Facebook sends events grouped by object type
    if (body.object === 'page') {
        for (const entry of body.entry || []) {
            const pageId = entry.id

            // ── Feed changes (comments, reactions, posts) ──
            if (entry.changes) {
                for (const change of entry.changes) {
                    if (change.field === 'feed') {
                        try {
                            await handleFeedChange(pageId, change.value, botTasks)
                        } catch (err) {
                            console.error(`[FB Webhook] ❌ Error processing feed change for page ${pageId}:`, err)
                        }
                    }
                }
            }

            // ── Messaging (DMs) ──
            if (entry.messaging) {
                for (const msgEvent of entry.messaging) {
                    try {
                        await handleMessaging(pageId, msgEvent, botTasks)
                    } catch (err) {
                        console.error(`[FB Webhook] ❌ Error processing message for page ${pageId}:`, err)
                    }
                }
            }
        }
    }

    // Instagram events — DMs and comments
    if (body.object === 'instagram') {
        for (const entry of body.entry || []) {
            const igAccountId = entry.id // Instagram Business Account ID

            // ── IG Comments ──
            if (entry.changes) {
                for (const change of entry.changes) {
                    if (change.field === 'comments') {
                        try {
                            await handleInstagramComment(igAccountId, change.value, botTasks)
                        } catch (err) {
                            console.error(`[IG Webhook] ❌ Error processing comment for IG ${igAccountId}:`, err)
                        }
                    }
                }
            }

            // ── IG DMs ──
            if (entry.messaging) {
                for (const msgEvent of entry.messaging) {
                    try {
                        await handleInstagramMessaging(igAccountId, msgEvent, botTasks)
                    } catch (err) {
                        console.error(`[IG Webhook] ❌ Error processing message for IG ${igAccountId}:`, err)
                    }
                }
            }
        }
    }

    // ─── Run bot tasks in background AFTER returning 200 ────
    if (botTasks.length > 0) {
        setImmediate(async () => {
            for (const task of botTasks) {
                try {
                    await task()
                } catch (e) {
                    console.error('[Bot Background Task] ❌', e)
                }
            }
        })
    }

    // Return 200 immediately to Facebook (prevents timeout)
    return NextResponse.json({ status: 'ok' })
}

// ═══════════════════════════════════════
// HANDLE INSTAGRAM COMMENTS
// ═══════════════════════════════════════
async function handleInstagramComment(igAccountId: string, value: any, botTasks: BotTask[]) {
    const verb = value.verb || 'add'
    if (verb === 'remove') {
        if (value.id) {
            await prisma.socialComment.updateMany({
                where: { externalCommentId: value.id },
                data: { status: 'hidden' },
            })
            console.log(`[IG Webhook] Comment removed: ${value.id}`)
        }
        return
    }

    // Find ALL IG platform accounts for this IG account (may span multiple channels)
    const platformAccounts = await prisma.channelPlatform.findMany({
        where: { platform: 'instagram', accountId: igAccountId, isActive: true, accessToken: { not: null } },
    })
    if (platformAccounts.length === 0) {
        const fallback = await prisma.channelPlatform.findMany({
            where: { platform: 'instagram', accountId: igAccountId },
        })
        if (fallback.length > 0) platformAccounts.push(...fallback)
    }

    if (platformAccounts.length === 0) {
        console.warn(`[IG Webhook] ❌ No platform account for IG ${igAccountId}`)
        return
    }

    const commentId = value.id || ''
    const parentCommentId = value.parent_id || null
    const authorName = value.from?.username || value.from?.id || 'Unknown'
    const authorId = value.from?.id || ''
    const content = value.text || ''
    const mediaId = value.media?.id || ''
    const commentedAt = value.timestamp ? new Date(value.timestamp * 1000) : new Date()

    if (authorId === igAccountId) {
        console.log(`[IG Webhook] Skipping own comment by IG account ${igAccountId}`)
        return
    }

    // Fetch post/media metadata once using first account's token
    const tokenAccount = platformAccounts.find(a => a.accessToken) || platformAccounts[0]
    let postMetadata: any = null
    if (mediaId && tokenAccount.accessToken) {
        try {
            const mediaRes = await fetch(
                `https://graph.facebook.com/v19.0/${mediaId}?fields=caption,permalink,media_url,media_type,thumbnail_url&access_token=${tokenAccount.accessToken}`
            )
            if (mediaRes.ok) {
                const mediaData = await mediaRes.json()
                const images: string[] = []
                if (mediaData.media_url) images.push(mediaData.media_url)
                if (mediaData.thumbnail_url && !mediaData.media_url) images.push(mediaData.thumbnail_url)
                postMetadata = {
                    externalPostId: mediaId,
                    postContent: mediaData.caption || '',
                    postImages: images.slice(0, 5),
                    postPermalink: mediaData.permalink || `https://instagram.com/p/${mediaId}`,
                }
            }
        } catch (err) {
            console.warn(`[IG Webhook] ⚠️ Failed to fetch media ${mediaId}:`, err)
            postMetadata = { externalPostId: mediaId, postContent: '', postImages: [], postPermalink: `https://instagram.com` }
        }
    }

    const postLabel = postMetadata?.postContent
        ? postMetadata.postContent.substring(0, 60) + (postMetadata.postContent.length > 60 ? '...' : '')
        : `IG Post ${mediaId}`

    // Process for ALL matching channels
    for (const platformAccount of platformAccounts) {
        await prisma.socialComment.upsert({
            where: { externalCommentId: `${commentId}_${platformAccount.channelId}` },
            update: { content, authorName },
            create: {
                channelId: platformAccount.channelId,
                platformAccountId: platformAccount.id,
                platform: 'instagram',
                externalPostId: mediaId,
                externalCommentId: platformAccounts.length > 1 ? `${commentId}_${platformAccount.channelId}` : commentId,
                parentCommentId,
                authorName,
                authorAvatar: null,
                content,
                status: 'new',
                commentedAt,
            },
        })

        await upsertConversation({
            channelId: platformAccount.channelId,
            platformAccountId: platformAccount.id,
            platform: 'instagram',
            externalUserId: `post_${mediaId}`,
            externalUserName: postLabel,
            externalUserAvatar: null,
            content,
            direction: 'inbound',
            senderType: 'customer',
            senderName: `@${authorName}`,
            senderAvatar: null,
            type: 'comment',
            metadata: postMetadata,
            externalId: platformAccounts.length > 1 ? `${commentId}_${platformAccount.channelId}` : commentId,
            botTasks,
        })
        console.log(`[IG Webhook] 💬 Comment routed to channel ${platformAccount.channelId} (${platformAccount.accountName})`)
    }
}

// ═══════════════════════════════════════
// HANDLE INSTAGRAM DMs
// ═══════════════════════════════════════
async function handleInstagramMessaging(igAccountId: string, event: any, botTasks: BotTask[]) {
    if (!event.message?.text && !event.message?.attachments) return

    const senderId = event.sender?.id
    const recipientId = event.recipient?.id
    if (!senderId || !recipientId) return

    const isEcho = event.message?.is_echo === true

    // Capture echo = admin replied from Instagram app / Meta Business Suite
    if (isEcho) {
        const recipientId = event.recipient?.id
        if (!recipientId) return

        const platformAccounts = await prisma.channelPlatform.findMany({
            where: { platform: 'instagram', accountId: igAccountId, isActive: true },
        })
        if (platformAccounts.length === 0) return

        const content = event.message?.text || '[Attachment]'
        const mediaUrl = event.message?.attachments?.[0]?.payload?.url || null
        const mediaType = event.message?.attachments?.[0]?.type || null

        for (const platformAccount of platformAccounts) {
            await upsertConversation({
                channelId: platformAccount.channelId,
                platformAccountId: platformAccount.id,
                platform: 'instagram',
                externalUserId: recipientId,
                content,
                direction: 'outbound',
                senderType: 'agent',
                senderName: 'Page',
                senderAvatar: null,
                mediaUrl,
                mediaType,
                externalId: platformAccounts.length > 1
                    ? `${event.message?.mid}_${platformAccount.channelId}`
                    : event.message?.mid,
            })
        }
        console.log(`[IG Webhook] 📤 Echo captured (agent reply): "${content.substring(0, 60)}"`)
        return
    }

    const isOutbound = senderId === igAccountId
    const externalUserId = isOutbound ? recipientId : senderId

    // Find ALL IG platform accounts for this IG account
    const platformAccounts = await prisma.channelPlatform.findMany({
        where: { platform: 'instagram', accountId: igAccountId, isActive: true },
    })

    if (platformAccounts.length === 0) {
        console.warn(`[IG Webhook] No platform account for IG ${igAccountId}`)
        return
    }

    const content = event.message?.text || '[Attachment]'
    const mediaUrl = event.message?.attachments?.[0]?.payload?.url || null
    const mediaType = event.message?.attachments?.[0]?.type || null

    // Get user profile once using first account's token
    const tokenAccount = platformAccounts.find(a => a.accessToken) || platformAccounts[0]
    let senderName = externalUserId
    let senderAvatar: string | null = null
    if (tokenAccount.accessToken) {
        try {
            const res = await fetch(
                `https://graph.facebook.com/v19.0/${externalUserId}?fields=name,username,profile_pic&access_token=${tokenAccount.accessToken}`
            )
            if (res.ok) {
                const data = await res.json()
                senderName = data.username || data.name || senderName
                senderAvatar = data.profile_pic || null
            }
        } catch { /* fallback */ }
    }

    // Process for ALL matching channels
    for (const platformAccount of platformAccounts) {
        await upsertConversation({
            channelId: platformAccount.channelId,
            platformAccountId: platformAccount.id,
            platform: 'instagram',
            externalUserId,
            externalUserName: senderName !== externalUserId ? senderName : undefined,
            externalUserAvatar: senderAvatar,
            content,
            direction: isOutbound ? 'outbound' : 'inbound',
            senderType: isOutbound ? 'agent' : 'customer',
            mediaUrl,
            mediaType,
            externalId: platformAccounts.length > 1 ? `${event.message?.mid}_${platformAccount.channelId}` : event.message?.mid,
            botTasks,
        })
        console.log(`[IG Webhook] 💬 Message routed to channel ${platformAccount.channelId} (${platformAccount.accountName})`)
    }
}

// ═══════════════════════════════════════
// HANDLE FEED CHANGES (Comments)
// ═══════════════════════════════════════
async function handleFeedChange(pageId: string, value: any, botTasks: BotTask[]) {
    if (value.item !== 'comment') return

    const verb = value.verb
    if (verb === 'remove') {
        if (value.comment_id) {
            await prisma.socialComment.updateMany({
                where: { externalCommentId: value.comment_id },
                data: { status: 'hidden' },
            })
            // Also hide channel-specific variants
            await prisma.socialComment.updateMany({
                where: { externalCommentId: { startsWith: `${value.comment_id}_` } },
                data: { status: 'hidden' },
            })
            console.log(`[FB Webhook] Comment removed: ${value.comment_id}`)
        }
        return
    }

    // Find ALL platform accounts for this page (may span multiple channels)
    const platformAccounts = await prisma.channelPlatform.findMany({
        where: { platform: 'facebook', accountId: pageId, isActive: true, accessToken: { not: null } },
    })
    if (platformAccounts.length === 0) {
        const fallback = await prisma.channelPlatform.findMany({
            where: { platform: 'facebook', accountId: pageId },
        })
        if (fallback.length > 0) platformAccounts.push(...fallback)
    }

    if (platformAccounts.length === 0) {
        const allFbAccounts = await prisma.channelPlatform.findMany({
            where: { platform: 'facebook' },
            select: { accountId: true, accountName: true, isActive: true },
        })
        console.warn(`[FB Webhook] ❌ No platform account for page ${pageId}. Available:`,
            allFbAccounts.map(a => `${a.accountName}(${a.accountId}, active=${a.isActive})`).join(', ')
        )
        return
    }

    console.log(`[FB Webhook] ✅ Matched page ${pageId} → ${platformAccounts.length} channel(s): ${platformAccounts.map(a => a.accountName).join(', ')}`)

    const externalPostId = value.post_id || ''
    const externalCommentId = value.comment_id || ''
    const parentCommentId = value.parent_id || null
    const authorName = value.from?.name || 'Unknown'
    const authorId = value.from?.id || ''
    const content = value.message || ''
    const commentedAt = value.created_time ? new Date(value.created_time * 1000) : new Date()

    if (authorId === pageId) {
        console.log(`[FB Webhook] Skipping own comment by page ${pageId}`)
        return
    }

    let postId: string | null = null
    if (externalPostId) {
        const platformStatus = await prisma.postPlatformStatus.findFirst({
            where: { externalId: externalPostId },
            select: { postId: true },
        })
        postId = platformStatus?.postId || null
    }

    // Fetch post details once using first account's token
    const tokenAccount = platformAccounts.find(a => a.accessToken) || platformAccounts[0]
    let postMetadata: any = null
    if (externalPostId && tokenAccount.accessToken) {
        try {
            const postRes = await fetch(
                `https://graph.facebook.com/v19.0/${externalPostId}?fields=message,permalink_url,full_picture,attachments{media,media_type,url,subattachments}&access_token=${tokenAccount.accessToken}`
            )
            if (postRes.ok) {
                const postData = await postRes.json()
                const images: string[] = []
                if (postData.attachments?.data) {
                    for (const att of postData.attachments.data) {
                        if (att.subattachments?.data) {
                            for (const sub of att.subattachments.data) {
                                if (sub.media?.image?.src) images.push(sub.media.image.src)
                            }
                        } else if (att.media?.image?.src) {
                            images.push(att.media.image.src)
                        }
                    }
                }
                if (images.length === 0 && postData.full_picture) images.push(postData.full_picture)
                postMetadata = {
                    externalPostId,
                    postContent: postData.message || '',
                    postImages: images.slice(0, 5),
                    postPermalink: postData.permalink_url || `https://facebook.com/${externalPostId}`,
                }
            }
        } catch (err) {
            console.warn(`[FB Webhook] ⚠️ Failed to fetch post ${externalPostId}:`, err)
            postMetadata = { externalPostId, postContent: '', postImages: [], postPermalink: `https://facebook.com/${externalPostId}` }
        }
    }

    const postLabel = postMetadata?.postContent
        ? postMetadata.postContent.substring(0, 60) + (postMetadata.postContent.length > 60 ? '...' : '')
        : `Post ${externalPostId}`
    const authorAvatar = value.from?.id ? `https://graph.facebook.com/${value.from.id}/picture?type=small&access_token=${tokenAccount.accessToken}` : null

    // Process for ALL matching channels
    for (const platformAccount of platformAccounts) {
        const commentIdForChannel = platformAccounts.length > 1 ? `${externalCommentId}_${platformAccount.channelId}` : externalCommentId

        await prisma.socialComment.upsert({
            where: { externalCommentId: commentIdForChannel },
            update: { content, authorName },
            create: {
                channelId: platformAccount.channelId,
                platformAccountId: platformAccount.id,
                postId,
                platform: 'facebook',
                externalPostId,
                externalCommentId: commentIdForChannel,
                parentCommentId,
                authorName,
                authorAvatar,
                content,
                status: 'new',
                commentedAt,
            },
        })

        await upsertConversation({
            channelId: platformAccount.channelId,
            platformAccountId: platformAccount.id,
            platform: 'facebook',
            externalUserId: `post_${externalPostId}`,
            externalUserName: postLabel,
            externalUserAvatar: null,
            content,
            direction: 'inbound',
            senderType: 'customer',
            senderName: authorName,
            senderAvatar: authorAvatar,
            type: 'comment',
            metadata: postMetadata,
            externalId: commentIdForChannel,
            botTasks,
        })
        console.log(`[FB Webhook] 💬 Comment routed to channel ${platformAccount.channelId} (${platformAccount.accountName})`)
    }
}

// ═══════════════════════════════════════
// HANDLE MESSAGING (DMs + Echoes)
// ═══════════════════════════════════════
async function handleMessaging(pageId: string, event: any, botTasks: BotTask[]) {
    if (!event.message?.text && !event.message?.attachments) return

    const senderId = event.sender?.id
    const recipientId = event.recipient?.id
    if (!senderId || !recipientId) return

    const isEcho = event.message?.is_echo === true

    // ─── Echo = message sent BY the page admin (Meta Business Suite, 3rd-party tool, etc.)
    // We capture it as an outbound/agent message for bi-directional sync (like Hootsuite).
    // Echoes should NEVER trigger the bot.
    if (isEcho) {
        const recipientId = event.recipient?.id   // customer's PSID
        const pageAccountId = pageId              // who sent it = the page
        if (!recipientId) return

        const platformAccounts = await prisma.channelPlatform.findMany({
            where: { platform: 'facebook', accountId: pageAccountId, isActive: true },
        })
        if (platformAccounts.length === 0) return

        const content = event.message?.text || '[Attachment]'
        const mediaUrl = event.message?.attachments?.[0]?.payload?.url || null
        const mediaType = event.message?.attachments?.[0]?.type || null
        const tokenAccount = platformAccounts.find(a => a.accessToken) || platformAccounts[0]

        // Get customer profile for conversation labelling
        let senderName = recipientId
        let senderAvatar: string | null = null
        if (tokenAccount.accessToken) {
            try {
                const res = await fetch(
                    `https://graph.facebook.com/v19.0/${recipientId}?fields=name,profile_pic&access_token=${tokenAccount.accessToken}`
                )
                if (res.ok) {
                    const data = await res.json()
                    senderName = data.name || senderName
                    senderAvatar = data.profile_pic || null
                }
            } catch { /* fallback */ }
        }

        for (const platformAccount of platformAccounts) {
            await upsertConversation({
                channelId: platformAccount.channelId,
                platformAccountId: platformAccount.id,
                platform: 'facebook',
                externalUserId: recipientId,
                externalUserName: senderName !== recipientId ? senderName : 'Facebook User',
                externalUserAvatar: senderAvatar || `https://graph.facebook.com/${recipientId}/picture?type=small&access_token=${tokenAccount?.accessToken || ''}`,
                content,
                direction: 'outbound',
                senderType: 'agent',
                senderName: 'Page',
                senderAvatar: null,
                mediaUrl,
                mediaType,
                externalId: platformAccounts.length > 1
                    ? `${event.message?.mid}_${platformAccount.channelId}`
                    : event.message?.mid,
                // No botTasks — echo should never trigger bot
            })
        }
        console.log(`[FB Webhook] 📤 Echo captured (agent reply via Meta/3rd-party): "${content.substring(0, 60)}"`)
        return
    }

    const isOutbound = senderId === pageId
    const externalUserId = isOutbound ? recipientId : senderId

    // Find ALL platform accounts for this page (may span multiple channels)
    const platformAccounts = await prisma.channelPlatform.findMany({
        where: { platform: 'facebook', accountId: pageId, isActive: true },
    })

    if (platformAccounts.length === 0) {
        console.warn(`[FB Webhook] No platform account for page ${pageId}`)
        return
    }

    const content = event.message?.text || '[Attachment]'
    const mediaUrl = event.message?.attachments?.[0]?.payload?.url || null
    const mediaType = event.message?.attachments?.[0]?.type || null

    // Get user profile once using first account's token
    const tokenAccount = platformAccounts.find(a => a.accessToken) || platformAccounts[0]
    let senderName: string | null = null  // null = unknown, will use 'Facebook User' fallback
    let senderAvatar: string | null = null
    if (tokenAccount.accessToken) {
        try {
            const res = await fetch(
                `https://graph.facebook.com/v19.0/${externalUserId}?fields=name,profile_pic&access_token=${tokenAccount.accessToken}`
            )
            if (res.ok) {
                const data = await res.json()
                if (data.error) {
                    console.warn(`[FB Webhook] ⚠️ Profile fetch error for ${externalUserId}: ${data.error.message} (code: ${data.error.code})`)
                } else {
                    senderName = data.name || null
                    senderAvatar = data.profile_pic || null
                }
            } else {
                const errText = await res.text()
                console.warn(`[FB Webhook] ⚠️ Profile fetch HTTP ${res.status} for ${externalUserId}: ${errText.substring(0, 150)}`)
            }
        } catch (e) {
            console.warn(`[FB Webhook] ⚠️ Profile fetch exception for ${externalUserId}:`, e)
        }
        if (!senderAvatar) {
            // Fallback: Facebook profile picture endpoint (may still serve generic avatar)
            senderAvatar = `https://graph.facebook.com/${externalUserId}/picture?type=small&access_token=${tokenAccount.accessToken}`
        }
    }

    // Process for ALL matching channels
    for (const platformAccount of platformAccounts) {
        await upsertConversation({
            channelId: platformAccount.channelId,
            platformAccountId: platformAccount.id,
            platform: 'facebook',
            externalUserId,
            externalUserName: senderName || 'Facebook User',
            externalUserAvatar: senderAvatar,
            content,
            direction: isOutbound ? 'outbound' : 'inbound',
            senderType: isOutbound ? 'agent' : 'customer',
            mediaUrl,
            mediaType,
            externalId: platformAccounts.length > 1 ? `${event.message?.mid}_${platformAccount.channelId}` : event.message?.mid,
            botTasks,
        })
        console.log(`[FB Webhook] 💬 Message routed to channel ${platformAccount.channelId} (${platformAccount.accountName})`)
    }
}

// ═══════════════════════════════════════
// SHARED: Upsert conversation + add message
// ═══════════════════════════════════════
async function upsertConversation(opts: {
    channelId: string
    platformAccountId: string
    platform: string
    externalUserId: string
    externalUserName?: string
    externalUserAvatar?: string | null
    content: string
    direction: string
    senderType: string
    senderName?: string | null
    senderAvatar?: string | null
    mediaUrl?: string | null
    mediaType?: string | null
    externalId?: string | null
    type?: string
    metadata?: any
    botTasks?: BotTask[]
}) {
    // Find or create conversation
    // Include type in lookup so DMs and comments create separate conversations
    let isNewConversation = false
    let conversation = await prisma.conversation.findFirst({
        where: {
            channelId: opts.channelId,
            platform: opts.platform,
            externalUserId: opts.externalUserId,
            type: opts.type || 'message',
        },
    })

    if (!conversation) {
        isNewConversation = true

        // Determine conversation mode: BOT only if both channel bot AND page bot are enabled
        let convMode: 'BOT' | 'AGENT' = 'BOT'
        const platformAccount = await prisma.channelPlatform.findUnique({
            where: { id: opts.platformAccountId },
            select: { config: true },
        })
        const pageConfig = (platformAccount?.config as any) || {}
        if (pageConfig.botEnabled !== true) {
            convMode = 'AGENT' // Page bot toggle is not ON
        } else {
            // Also check channel-level BotConfig
            const botConfig = await prisma.botConfig.findUnique({
                where: { channelId: opts.channelId },
                select: { isEnabled: true },
            })
            if (botConfig && !botConfig.isEnabled) {
                convMode = 'AGENT' // Channel bot is disabled
            }
        }

        conversation = await prisma.conversation.create({
            data: {
                channelId: opts.channelId,
                platformAccountId: opts.platformAccountId,
                platform: opts.platform,
                externalUserId: opts.externalUserId,
                externalUserName: opts.externalUserName || opts.externalUserId,
                externalUserAvatar: opts.externalUserAvatar || null,
                status: 'new',
                mode: convMode,
                type: opts.type || 'message',
                metadata: opts.metadata || null,
                unreadCount: 1,
                lastMessageAt: new Date(),
                tags: [],
            },
        })
        console.log(`[FB Webhook] 🆕 New conversation: ${opts.externalUserName || opts.externalUserId} (mode: ${convMode})`)
    } else {
        // Update existing conversation
        const updateData: any = {
            lastMessageAt: new Date(),
        }
        if (opts.direction === 'inbound') {
            updateData.unreadCount = { increment: 1 }
            // Re-open if it was done/archived
            if (['done', 'archived'].includes(conversation.status)) {
                updateData.status = 'new'
            }
        }
        const isPlaceholderName = !conversation.externalUserName
            || /^\d{10,}$/.test(conversation.externalUserName)
            || conversation.externalUserName === 'Facebook User'
        if (opts.externalUserName && isPlaceholderName && opts.externalUserName !== 'Facebook User') {
            updateData.externalUserName = opts.externalUserName
        }
        if (opts.externalUserAvatar) {
            updateData.externalUserAvatar = opts.externalUserAvatar
        }
        // Update metadata if we have post info and conversation doesn't have it yet
        if (opts.metadata && !conversation.metadata) {
            updateData.metadata = opts.metadata
            updateData.type = opts.type || conversation.type
        }
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: updateData,
        })
    }

    // ── Duplicate guard ────────────────────────────────────────────────────
    // Primary: check by externalId (covers most cases)
    if (opts.externalId) {
        const existingById = await prisma.inboxMessage.findFirst({
            where: { externalId: opts.externalId },
        })
        if (existingById) {
            console.log(`[Webhook] Skipping duplicate message (externalId match): ${opts.externalId}`)
            return
        }
    }

    // Secondary: race-condition guard for echoed outbound messages.
    // When Neeflow sends a message, the echo from Facebook can arrive BEFORE
    // our API finishes saving the externalId — so the primary check misses it.
    // Guard: if outbound message with same content exists in this conversation within 60s, skip.
    if (opts.direction === 'outbound') {
        // We need conversation id — look it up again (already fetched above)
        const conv = await prisma.conversation.findFirst({
            where: {
                channelId: opts.channelId,
                platform: opts.platform,
                externalUserId: opts.externalUserId,
                type: opts.type || 'message',
            },
            select: { id: true },
        })
        if (conv) {
            const sixtySecondsAgo = new Date(Date.now() - 60_000)
            const recentOutbound = await prisma.inboxMessage.findFirst({
                where: {
                    conversationId: conv.id,
                    direction: 'outbound',
                    content: opts.content,
                    sentAt: { gte: sixtySecondsAgo },
                },
            })
            if (recentOutbound) {
                // Update externalId if not set yet (echo brings the mid)
                if (opts.externalId && !recentOutbound.externalId) {
                    await prisma.inboxMessage.update({
                        where: { id: recentOutbound.id },
                        data: { externalId: opts.externalId },
                    })
                }
                console.log(`[Webhook] Skipping echo duplicate (content+60s window match): "${opts.content?.substring(0, 50)}"`)
                return
            }
        }
    }

    // Create message
    await prisma.inboxMessage.create({
        data: {
            conversationId: conversation.id,
            externalId: opts.externalId || null,
            direction: opts.direction,
            senderType: opts.senderType,
            content: opts.content,
            senderName: opts.senderName || null,
            senderAvatar: opts.senderAvatar || null,
            mediaUrl: opts.mediaUrl || null,
            mediaType: opts.mediaType || null,
            sentAt: new Date(),
        },
    })

    // ─── Notify channel admins of inbound messages/comments ────
    if (opts.direction === 'inbound') {
        const isComment = opts.type === 'comment'
        const senderLabel = opts.senderName || opts.externalUserName || 'Someone'
        const preview = opts.content?.substring(0, 80) || (isComment ? 'New comment' : 'New message')
        notifyChannelAdmins({
            channelId: opts.channelId,
            type: isComment ? 'new_comment' : 'new_message',
            title: isComment
                ? `🗨️ ${senderLabel} commented`
                : `💬 ${senderLabel}`,
            message: preview,
            link: `/dashboard/inbox?conversation=${conversation.id}`,
        }).catch(() => { }) // fire-and-forget
    }

    // ─── Queue Bot Auto-Reply for background execution ──────
    if (opts.direction === 'inbound' && conversation.mode === 'BOT' && opts.botTasks) {
        const convId = conversation.id
        const platform = opts.platform
        const content = opts.content

        opts.botTasks.push(async () => {
            if (isNewConversation) {
                await sendBotGreeting(convId, platform)
                const r = await botAutoReply(convId, content, platform)
                console.log(`[Bot Auto-Reply] Result:`, r)
            } else {
                const r = await botAutoReply(convId, content, platform)
                console.log(`[Bot Auto-Reply] Result:`, r)
            }
        })
    }
}
