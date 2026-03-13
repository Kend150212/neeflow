import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inbox/conversations/[id]/messages
 * Returns messages for a specific conversation
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const markRead = searchParams.get('markRead') === 'true'

    // Verify user has access to this conversation's channel
    const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: { channelId: true, id: true },
    })

    if (!conversation) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const membership = await prisma.channelMember.findFirst({
        where: { channelId: conversation.channelId, userId: session.user.id },
    })

    if (!membership && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [messages, total] = await Promise.all([
        prisma.inboxMessage.findMany({
            where: { conversationId: id },
            orderBy: { sentAt: 'desc' }, // newest first — page 1 = most recent
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.inboxMessage.count({ where: { conversationId: id } }),
    ])
    // Reverse so messages render chronologically (oldest at top, newest at bottom)
    const ordered = messages.reverse()

    // Mark conversation as read only when the agent explicitly opens it (not during background polling)
    if (markRead) {
        await prisma.conversation.update({
            where: { id },
            data: { unreadCount: 0 },
        })
    }

    return NextResponse.json({
        messages: ordered.map(m => ({
            id: m.id,
            externalId: m.externalId,
            direction: m.direction,
            senderType: m.senderType,
            content: m.content,
            contentOriginal: m.contentOriginal,
            detectedLang: m.detectedLang,
            mediaUrl: m.mediaUrl,
            mediaType: m.mediaType,
            senderName: m.senderName,
            senderAvatar: m.senderAvatar,
            confidence: m.confidence,
            sentAt: m.sentAt.toISOString(),
        })),
        total,
        page,
        limit,
    })
}

/**
 * POST /api/inbox/conversations/[id]/messages
 * Send a reply to a conversation (as agent)
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Parse body — supports JSON or FormData (for image uploads)
    let content = ''
    let senderType = 'agent'
    let imageFile: File | null = null
    let replyToExternalId: string | null = null

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData()
        content = (formData.get('content') as string) || ''
        senderType = (formData.get('senderType') as string) || 'agent'
        imageFile = formData.get('image') as File | null
    } else {
        const body = await req.json()
        content = body.content || ''
        senderType = body.senderType || 'agent'
        replyToExternalId = body.replyToExternalId || null
    }

    if (!content?.trim() && !imageFile) {
        return NextResponse.json({ error: 'Content or image is required' }, { status: 400 })
    }

    // Verify access
    const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: { channelId: true, mode: true, platform: true, platformAccountId: true },
    })

    if (!conversation) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const membership = await prisma.channelMember.findFirst({
        where: { channelId: conversation.channelId, userId: session.user.id },
    })

    if (!membership && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Diagnostic log — helps trace why platform-specific send blocks may not fire
    console.log(`[Inbox Reply] conv=${id} platform="${conversation.platform}" platformAccountId="${conversation.platformAccountId}"`)


    // Create the message
    const message = await prisma.inboxMessage.create({
        data: {
            conversationId: id,
            direction: 'outbound',
            senderType,
            content: content.trim(),
            senderName: session.user.name || null,
            senderAvatar: session.user.image || null,
        },
    })

    // Update conversation
    const currentConv = await prisma.conversation.findUnique({
        where: { id },
        select: { mode: true, metadata: true },
    })

    await prisma.conversation.update({
        where: { id },
        data: {
            lastMessageAt: new Date(),
            mode: 'AGENT', // Auto-switch to agent mode when agent replies
            assignedTo: conversation.mode === 'BOT' ? session.user.id : undefined,
            status: conversation.mode === 'BOT' ? 'open' : undefined,
            // Clear pendingFollowup flag — agent has responded, no more warm messages needed
            ...(senderType === 'agent' && (currentConv?.metadata as any)?.pendingFollowup
                ? {
                    metadata: {
                        ...(currentConv?.metadata as object || {}),
                        pendingFollowup: false,
                        resolvedAt: new Date().toISOString(),
                        resolvedByAgent: session.user.id,
                    },
                }
                : {}),
        },
    })

    // ── Auto-learn: extract Q→A training pair from agent reply ──
    if (senderType === 'agent' && content.trim()) {
        // Run in background to not slow down the response
        setImmediate(async () => {
            try {
                // Get last inbound (customer) message before this agent reply
                const lastCustomerMsg = await prisma.inboxMessage.findFirst({
                    where: {
                        conversationId: id,
                        direction: 'inbound',
                        senderType: 'customer',
                    },
                    orderBy: { sentAt: 'desc' },
                    select: { content: true },
                })

                if (lastCustomerMsg?.content && lastCustomerMsg.content.length > 3) {
                    const botConfig = await prisma.botConfig.findUnique({
                        where: { channelId: conversation.channelId },
                        select: { id: true, trainingPairs: true },
                    })

                    if (botConfig) {
                        const pairs = (botConfig.trainingPairs as Array<{ q: string; a: string }>) || []

                        // Check for duplicate (same question)
                        const isDuplicate = pairs.some(
                            p => p.q.toLowerCase().trim() === lastCustomerMsg.content.toLowerCase().trim()
                        )

                        if (!isDuplicate) {
                            // Add new pair, keep max 100 (prune oldest)
                            pairs.push({
                                q: lastCustomerMsg.content.substring(0, 500),
                                a: content.trim().substring(0, 1000),
                            })
                            const trimmed = pairs.slice(-100) // Keep most recent 100

                            await prisma.botConfig.update({
                                where: { id: botConfig.id },
                                data: { trainingPairs: trimmed },
                            })
                            console.log(`[Bot Training] ✅ Learned from agent: "${lastCustomerMsg.content.substring(0, 50)}..." → "${content.substring(0, 50)}..."`)
                        }
                    }
                }
            } catch (err) {
                console.error('[Bot Training] ❌ Auto-learn error:', err)
            }
        })
    }

    // ── Send reply via Facebook Messenger API ──
    if (conversation.platform === 'facebook') {
        const platformAccount = await prisma.channelPlatform.findUnique({
            where: { id: conversation.platformAccountId },
        })

        if (platformAccount?.accessToken) {
            const conv = await prisma.conversation.findUnique({
                where: { id },
                select: { type: true, metadata: true, externalUserId: true },
            })

            try {
                // Upload image to Facebook if present
                let fbAttachmentId: string | null = null
                if (imageFile) {
                    const imgBuffer = Buffer.from(await imageFile.arrayBuffer())
                    const imgForm = new FormData()
                    imgForm.append('message', JSON.stringify({
                        attachment: { type: 'image', payload: { is_reusable: true } }
                    }))
                    imgForm.append('filedata', new Blob([imgBuffer], { type: imageFile.type }), imageFile.name)

                    const uploadRes = await fetch(
                        `https://graph.facebook.com/v19.0/me/message_attachments?access_token=${platformAccount.accessToken}`,
                        { method: 'POST', body: imgForm }
                    )
                    const uploadData = await uploadRes.json()
                    if (uploadData.attachment_id) {
                        fbAttachmentId = uploadData.attachment_id
                        console.log(`[FB Upload] ✅ Image uploaded: ${fbAttachmentId}`)
                    } else {
                        console.warn(`[FB Upload] ⚠️ Image upload failed:`, JSON.stringify(uploadData))
                    }
                }

                if (conv?.type === 'comment') {
                    // Reply to Facebook comment
                    // Use inboxMessage.externalId — always set by webhook, no _channelId suffix issues
                    const lastInboundMsg = await prisma.inboxMessage.findFirst({
                        where: { conversationId: id, direction: 'inbound' },
                        orderBy: { sentAt: 'desc' },
                        select: { externalId: true, senderName: true },
                    })

                    // Strip _channelId suffix if set during multi-account upsert
                    // FB comment IDs are numeric like "pageId_commentId" so any non-numeric trailing segment = channelId suffix
                    const rawCommentId = lastInboundMsg?.externalId || ''
                    const segments = rawCommentId.split('_')
                    const lastSeg = segments[segments.length - 1]
                    const commentId = segments.length > 1 && !/^\d+$/.test(lastSeg)
                        ? segments.slice(0, -1).join('_')  // Strip non-numeric channelId suffix
                        : rawCommentId                      // Use as-is (already clean)

                    if (commentId) {
                        let replyText = content.trim().replace(/@\[([^\]]+)\]/g, '@$1')
                        const authorName = lastInboundMsg?.senderName
                        if (authorName && !replyText.startsWith(`@${authorName}`)) {
                            replyText = `@${authorName} ${replyText}`
                        }
                        const fbRes = await fetch(
                            `https://graph.facebook.com/v19.0/${commentId}/comments`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    message: replyText,
                                    access_token: platformAccount.accessToken,
                                }),
                            }
                        )
                        const fbData = await fbRes.json()
                        if (fbData.id) {
                            await prisma.inboxMessage.update({
                                where: { id: message.id },
                                data: { externalId: fbData.id },
                            })
                            console.log(`[FB Reply] ✅ Comment reply posted: ${fbData.id}`)
                        } else {
                            console.warn(`[FB Reply] ⚠️ Comment reply failed (commentId=${commentId}):`, JSON.stringify(fbData))
                        }
                    } else {
                        console.warn(`[FB Reply] ⚠️ No inbound comment externalId for conversation ${id} — not sent to Facebook`)
                    }
                } else {
                    // Send DM via Messenger Send API
                    const cleanText = content.trim().replace(/^@\[[^\]]+\]\s*/, '').replace(/@\[([^\]]+)\]/g, '@$1')

                    const lastInbound = await prisma.inboxMessage.findFirst({
                        where: { conversationId: id, direction: 'inbound' },
                        orderBy: { sentAt: 'desc' },
                        select: { sentAt: true },
                    })
                    const hoursSinceLastInbound = lastInbound
                        ? (Date.now() - new Date(lastInbound.sentAt).getTime()) / (1000 * 60 * 60)
                        : Infinity
                    const messagingType = hoursSinceLastInbound <= 24 ? 'RESPONSE' : 'MESSAGE_TAG'
                    const messageTag = messagingType === 'MESSAGE_TAG' ? 'HUMAN_AGENT' : undefined
                    if (messagingType === 'MESSAGE_TAG') {
                        console.log(`[FB Reply] ⚠️ Outside 24h window (${Math.round(hoursSinceLastInbound)}h), using HUMAN_AGENT tag`)
                    }

                    if (fbAttachmentId) {
                        const fbRes = await fetch(
                            `https://graph.facebook.com/v19.0/me/messages?access_token=${platformAccount.accessToken}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    recipient: { id: conv?.externalUserId },
                                    message: { attachment: { type: 'image', payload: { attachment_id: fbAttachmentId } } },
                                    messaging_type: messagingType,
                                    ...(messageTag && { tag: messageTag }),
                                }),
                            }
                        )
                        const fbData = await fbRes.json()
                        if (fbData.message_id) {
                            console.log(`[FB Reply] ✅ Image DM sent: ${fbData.message_id}`)
                        }
                        if (cleanText && cleanText !== '📷 Image') {
                            await fetch(
                                `https://graph.facebook.com/v19.0/me/messages?access_token=${platformAccount.accessToken}`,
                                {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        recipient: { id: conv?.externalUserId },
                                        message: { text: cleanText },
                                        messaging_type: messagingType,
                                        ...(messageTag && { tag: messageTag }),
                                    }),
                                }
                            )
                        }
                    } else {
                        const fbPayload: any = {
                            recipient: { id: conv?.externalUserId },
                            message: {
                                text: cleanText,
                                ...(replyToExternalId && { reply_to: { mid: replyToExternalId } }),
                            },
                            messaging_type: messagingType,
                            ...(messageTag && { tag: messageTag }),
                        }
                        const fbRes = await fetch(
                            `https://graph.facebook.com/v19.0/me/messages?access_token=${platformAccount.accessToken}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(fbPayload),
                            }
                        )
                        const fbData = await fbRes.json()
                        if (fbData.message_id) {
                            await prisma.inboxMessage.update({
                                where: { id: message.id },
                                data: { externalId: fbData.message_id },
                            })
                            console.log(`[FB Reply] ✅ DM sent: ${fbData.message_id}`)
                        } else {
                            console.warn(`[FB Reply] ⚠️ DM send failed:`, JSON.stringify(fbData))
                        }
                    }
                }
            } catch (err) {
                console.error(`[FB Reply] ❌ Error sending reply:`, err)
            }
        }
    }

    // ── Send reply via Instagram Send API ──
    if (conversation.platform === 'instagram') {
        const platformAccount = await prisma.channelPlatform.findUnique({
            where: { id: conversation.platformAccountId },
        })

        if (platformAccount?.accessToken) {
            const conv = await prisma.conversation.findUnique({
                where: { id },
                select: { type: true, externalUserId: true },
            })

            try {
                // Instagram DMs are sent via the backing Facebook Page's messaging endpoint
                // The Page Access Token + Page ID handles Instagram messaging correctly
                const pageId = (platformAccount.config as any)?.pageId
                if (!pageId) {
                    console.warn(`[IG Reply] ⚠️ No backing pageId found in config for ${platformAccount.accountId}`)
                }

                if (conv?.type === 'message' || !conv?.type) {
                    const cleanText = content.trim().replace(/^@\[[^\]]+\]\s*/, '').replace(/@\[([^\]]+)\]/g, '@$1')

                    if (cleanText && pageId) {
                        const igRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/messages?access_token=${platformAccount.accessToken}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                recipient: { id: conv?.externalUserId },
                                message: { text: cleanText },
                            }),
                        })
                        const igData = await igRes.json()
                        if (igData.error) {
                            console.warn(`[IG Reply] ⚠️ DM send failed:`, JSON.stringify(igData.error))
                        } else {
                            if (igData.message_id) {
                                await prisma.inboxMessage.update({
                                    where: { id: message.id },
                                    data: { externalId: igData.message_id },
                                })
                            }
                            console.log(`[IG Reply] ✅ DM sent to ${conv?.externalUserId}`)
                        }
                    }
                } else if (conv?.type === 'comment') {
                    // IG comment reply — use the comment reply API
                    const lastComment = await prisma.inboxMessage.findFirst({
                        where: { conversationId: id, direction: 'inbound' },
                        orderBy: { sentAt: 'desc' },
                        select: { externalId: true },
                    })
                    if (lastComment?.externalId) {
                        const igRes = await fetch(
                            `https://graph.facebook.com/v19.0/${lastComment.externalId}/replies`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    message: content.trim(),
                                    access_token: platformAccount.accessToken,
                                }),
                            }
                        )
                        const igData = await igRes.json()
                        if (igData.id) {
                            console.log(`[IG Reply] ✅ Comment reply: ${igData.id}`)
                        } else {
                            console.warn(`[IG Reply] ⚠️ Comment reply failed:`, JSON.stringify(igData))
                        }
                    }
                }
            } catch (err) {
                console.error(`[IG Reply] ❌ Error sending reply:`, err)
            }
        }
    }

    // ── Send reply via Telegram Bot API ──
    if (conversation.platform === 'telegram') {
        const platformAccount = await prisma.channelPlatform.findUnique({
            where: { id: conversation.platformAccountId },
        })

        const botToken = platformAccount?.accessToken
        if (botToken) {
            const conv = await prisma.conversation.findUnique({
                where: { id },
                select: { externalUserId: true },
            })

            const chatId = conv?.externalUserId
            if (chatId) {
                try {
                    const cleanText = content.trim().replace(/^@\[[^\]]+\]\s*/, '').replace(/@\[([^\]]+)\]/g, '@$1')

                    if (cleanText) {
                        const tgRes = await fetch(
                            `https://api.telegram.org/bot${botToken}/sendMessage`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chat_id: chatId,
                                    text: cleanText,
                                    parse_mode: 'HTML',
                                }),
                            }
                        )
                        const tgData = await tgRes.json()
                        if (tgData.ok && tgData.result?.message_id) {
                            await prisma.inboxMessage.update({
                                where: { id: message.id },
                                data: { externalId: String(tgData.result.message_id) },
                            })
                            console.log(`[TG Reply] ✅ Message sent to chat ${chatId}: ${tgData.result.message_id}`)
                        } else {
                            console.warn(`[TG Reply] ⚠️ Send failed:`, JSON.stringify(tgData))
                        }
                    }

                    // Send image if present
                    if (imageFile) {
                        const imgBuffer = Buffer.from(await imageFile.arrayBuffer())
                        const imgForm = new FormData()
                        imgForm.append('chat_id', chatId)
                        imgForm.append('photo', new Blob([imgBuffer], { type: imageFile.type }), imageFile.name)
                        if (cleanText) imgForm.append('caption', cleanText)

                        const tgImgRes = await fetch(
                            `https://api.telegram.org/bot${botToken}/sendPhoto`,
                            { method: 'POST', body: imgForm }
                        )
                        const tgImgData = await tgImgRes.json()
                        if (tgImgData.ok) {
                            console.log(`[TG Reply] ✅ Photo sent to chat ${chatId}`)
                        } else {
                            console.warn(`[TG Reply] ⚠️ Photo send failed:`, JSON.stringify(tgImgData))
                        }
                    }
                } catch (err) {
                    console.error(`[TG Reply] ❌ Error sending reply:`, err)
                }
            }
        }
    }

    // ── Send reply via Threads API (threads_manage_replies) ──
    if (conversation.platform === 'threads') {
        const platformAccount = await prisma.channelPlatform.findUnique({
            where: { id: conversation.platformAccountId },
        })

        if (platformAccount?.accessToken) {
            const conv = await prisma.conversation.findUnique({
                where: { id },
                select: { metadata: true },
            })

            // Get the most recent inbound (customer) comment to reply to directly
            // This ensures our reply is nested under the right comment, not just the root post
            const lastInboundMsg = await prisma.inboxMessage.findFirst({
                where: { conversationId: id, direction: 'inbound' },
                orderBy: { sentAt: 'desc' },
                select: { externalId: true },
            })

            const meta = conv?.metadata as any
            // Prefer the specific comment ID; fall back to root post ID
            const replyToId = lastInboundMsg?.externalId
                || meta?.threadExternalId
                || meta?.rootPostId
                || null

            try {
                const cleanText = content.trim().replace(/^@\[[^\]]+\]\s*/, '').replace(/@\[([^\]]+)\]/g, '@$1')
                const base = 'https://graph.threads.net/v1.0'
                const accountId = platformAccount.accountId
                const token = platformAccount.accessToken

                console.log(`[Threads Reply] accountId=${accountId} token=${token.slice(0, 8)}... replyToId=${replyToId} text="${cleanText.slice(0, 60)}"`)

                if (cleanText && replyToId) {
                    // Step 1: Create media container
                    const createRes = await fetch(`${base}/${accountId}/threads`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            media_type: 'TEXT',
                            text: cleanText,
                            reply_to_id: replyToId,
                            access_token: token,
                        }),
                    })
                    const createData = await createRes.json()
                    console.log(`[Threads Reply] Create container response:`, JSON.stringify(createData))

                    if (createData.id) {
                        // Step 2: Poll container status until FINISHED (Threads requires this before publish)
                        // Without polling, publish returns error_subcode 4279009 "Media Not Found"
                        const creationId = createData.id
                        let containerReady = false
                        for (let attempt = 0; attempt < 12; attempt++) {
                            // Wait 1 second between polls (first poll also waits 1s)
                            await new Promise(r => setTimeout(r, 1000))
                            const statusRes = await fetch(
                                `${base}/${creationId}?fields=status,error_message&access_token=${token}`
                            )
                            const statusData = await statusRes.json()
                            console.log(`[Threads Reply] Container status poll ${attempt + 1}: ${statusData.status || JSON.stringify(statusData)}`)
                            if (statusData.status === 'FINISHED') {
                                containerReady = true
                                break
                            }
                            if (statusData.status === 'ERROR') {
                                console.warn(`[Threads Reply] ⚠️ Container ERROR: ${statusData.error_message}`)
                                break
                            }
                            // statuses: IN_PROGRESS, PUBLISHED, ERROR, EXPIRED
                        }

                        if (!containerReady) {
                            console.warn(`[Threads Reply] ⚠️ Container not ready after polling — aborting publish`)
                            return NextResponse.json({
                                message: { id: message.id, direction: message.direction, senderType: message.senderType, content: message.content, mediaUrl: message.mediaUrl, confidence: message.confidence, sentAt: message.sentAt.toISOString() },
                                threadsError: 'Threads container not ready (timed out waiting for FINISHED status)',
                            })
                        }

                        // Step 3: Publish the ready container
                        const publishRes = await fetch(`${base}/${accountId}/threads_publish`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                creation_id: creationId,
                                access_token: token,
                            }),
                        })
                        const publishData = await publishRes.json()
                        console.log(`[Threads Reply] Publish response:`, JSON.stringify(publishData))

                        if (publishData.id) {
                            await prisma.inboxMessage.update({
                                where: { id: message.id },
                                data: { externalId: publishData.id },
                            })
                            console.log(`[Threads Reply] ✅ Reply posted: ${publishData.id} (reply_to=${replyToId})`)
                        } else {
                            const errMsg = publishData.error?.message || JSON.stringify(publishData)
                            console.warn(`[Threads Reply] ⚠️ Publish failed:`, errMsg)
                            return NextResponse.json({
                                message: { id: message.id, direction: message.direction, senderType: message.senderType, content: message.content, mediaUrl: message.mediaUrl, confidence: message.confidence, sentAt: message.sentAt.toISOString() },
                                threadsError: `Threads publish failed: ${errMsg}`,
                            })
                        }
                    } else {
                        const errMsg = createData.error?.message || JSON.stringify(createData)
                        console.warn(`[Threads Reply] ⚠️ Create container failed:`, errMsg)
                        return NextResponse.json({
                            message: { id: message.id, direction: message.direction, senderType: message.senderType, content: message.content, mediaUrl: message.mediaUrl, confidence: message.confidence, sentAt: message.sentAt.toISOString() },
                            threadsError: `Threads create failed: ${errMsg}`,
                        })
                    }
                } else if (!replyToId) {
                    console.warn(`[Threads Reply] ⚠️ No reply_to_id — lastInboundMsg.externalId was null. Conv=${id}`)
                } else if (!cleanText) {
                    console.warn(`[Threads Reply] ⚠️ Empty text after cleaning`)
                }
            } catch (err) {
                console.error(`[Threads Reply] ❌ Error sending reply:`, err)
            }
        }
    }


    return NextResponse.json({
        message: {
            id: message.id,
            direction: message.direction,
            senderType: message.senderType,
            content: message.content,
            mediaUrl: message.mediaUrl,
            confidence: message.confidence,
            sentAt: message.sentAt.toISOString(),
        },
    })
}
