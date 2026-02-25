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
            orderBy: { sentAt: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.inboxMessage.count({ where: { conversationId: id } }),
    ])

    // Mark conversation as read when agent opens it
    await prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 },
    })

    return NextResponse.json({
        messages: messages.map(m => ({
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
    await prisma.conversation.update({
        where: { id },
        data: {
            lastMessageAt: new Date(),
            mode: 'AGENT', // Auto-switch to agent mode when agent replies
            assignedTo: conversation.mode === 'BOT' ? session.user.id : undefined,
            status: conversation.mode === 'BOT' ? 'open' : undefined,
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
                    // Reply to comment
                    const postExternalId = conv.externalUserId?.replace('post_', '') || ''
                    const lastComment = await prisma.socialComment.findFirst({
                        where: {
                            platformAccountId: conversation.platformAccountId,
                            externalPostId: postExternalId,
                            platform: 'facebook',
                        },
                        orderBy: { commentedAt: 'desc' },
                        select: { externalCommentId: true, authorName: true },
                    })
                    const commentId = lastComment?.externalCommentId
                    if (commentId) {
                        let replyText = content.trim().replace(/@\[([^\]]+)\]/g, '@$1')
                        if (lastComment.authorName && !replyText.startsWith(`@${lastComment.authorName}`)) {
                            replyText = `@${lastComment.authorName} ${replyText}`
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
                            console.warn(`[FB Reply] ⚠️ Comment reply failed:`, JSON.stringify(fbData))
                        }
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
                        const fbRes = await fetch(
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
                if (conv?.type === 'message' || !conv?.type) {
                    const cleanText = content.trim().replace(/^@\[[^\]]+\]\s*/, '').replace(/@\[([^\]]+)\]/g, '@$1')
                    const igApiUrl = `https://graph.instagram.com/v21.0/me/messages`

                    if (cleanText) {
                        const igRes = await fetch(igApiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${platformAccount.accessToken}`,
                            },
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
