/**
 * Bot Auto-Reply Engine
 *
 * Triggered when an inbound message arrives and conversation.mode === 'BOT'.
 * Uses ALL channel context: vibeTone, businessInfo, brandProfile, knowledgeBase,
 * BotConfig (personality, training pairs, escalation, images, videos).
 */

import { prisma } from '@/lib/prisma'
import { callAI, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { OAUTH_PLATFORMS, CREDENTIAL_PLATFORMS } from '@/lib/platform-registry'

// ─── Dedup cache: prevent duplicate Messenger sends ─────────
// Key: "recipientId" → timestamp of last bot send
// When same page is in multiple channels, only the first channel's
// bot actually sends to Messenger; others are saved to DB only.
const recentBotReplies = new Map<string, number>()
const DEDUP_TTL_MS = 30_000 // 30 seconds

interface BotReplyResult {
    replied: boolean
    reason?: string
}

export async function botAutoReply(
    conversationId: string,
    inboundContent: string,
    platform: string
): Promise<BotReplyResult> {
    try {
        // ─── 1. Load conversation + channel ───────────────────────
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                channel: {
                    select: {
                        id: true,
                        name: true,
                        displayName: true,
                        description: true,
                        language: true,
                        defaultAiProvider: true,
                        defaultAiModel: true,
                        vibeTone: true,
                        businessInfo: true,
                        brandProfile: true,
                    },
                },
            },
        })

        if (!conversation || !conversation.channel) {
            return { replied: false, reason: 'No conversation/channel' }
        }

        if (conversation.mode !== 'BOT') {
            return { replied: false, reason: 'Not in BOT mode' }
        }

        const channel = conversation.channel

        // ─── 2. Load BotConfig ────────────────────────────────────
        const botConfig = await prisma.botConfig.findUnique({
            where: { channelId: channel.id },
        })

        if (botConfig && !botConfig.isEnabled) {
            return { replied: false, reason: 'Bot disabled' }
        }

        // Per-page toggle is checked only when creating NEW conversations
        // (in upsertConversation). Here we trust conversation.mode — agents
        // can manually transfer any conversation to BOT mode.

        // ─── 2b. Send read receipt + typing indicator ─────────────
        if (conversation.platformAccountId) {
            const pa = await prisma.channelPlatform.findUnique({
                where: { id: conversation.platformAccountId },
                select: { accessToken: true },
            })
            if (pa?.accessToken) {
                await sendSenderAction(pa.accessToken, conversation.externalUserId, 'mark_seen').catch(() => { })
                await sendSenderAction(pa.accessToken, conversation.externalUserId, 'typing_on').catch(() => { })
            }
        }

        // ─── 3. Working Hours Check ───────────────────────────────
        if (botConfig?.workingHoursOnly && botConfig.workingHoursStart && botConfig.workingHoursEnd) {
            const now = new Date()
            const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            if (hhmm < botConfig.workingHoursStart || hhmm > botConfig.workingHoursEnd) {
                // Off-hours: send off-hours message
                if (botConfig.offHoursMessage) {
                    await sendAndSaveReply(
                        conversation,
                        botConfig.offHoursMessage,
                        platform
                    )
                    return { replied: true, reason: 'Off-hours message sent' }
                }
                return { replied: false, reason: 'Outside working hours, no off-hours message' }
            }
        }

        // ─── 4. Platform scope check ──────────────────────────────
        if (botConfig) {
            const enabledPlatforms = (botConfig.enabledPlatforms as string[]) || ['all']
            if (!enabledPlatforms.includes('all') && !enabledPlatforms.includes(platform)) {
                return { replied: false, reason: `Bot not enabled for ${platform}` }
            }

            const type = conversation.type || 'message'
            if (type === 'comment' && !botConfig.applyToComments) {
                return { replied: false, reason: 'Bot not enabled for comments' }
            }
            if (type === 'message' && !botConfig.applyToMessages) {
                return { replied: false, reason: 'Bot not enabled for messages' }
            }
        }

        // ─── 5. Count bot replies for max check ───────────────────
        if (botConfig?.maxBotReplies) {
            const botReplyCount = await prisma.inboxMessage.count({
                where: {
                    conversationId,
                    direction: 'outbound',
                    senderType: 'bot',
                },
            })
            if (botReplyCount >= botConfig.maxBotReplies) {
                // Escalate to agent
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { mode: 'AGENT' },
                })
                return { replied: false, reason: 'Max bot replies reached, escalated to agent' }
            }
        }

        // ─── 6. Escalation keyword check ──────────────────────────
        if (botConfig?.autoEscalateKeywords) {
            const keywords = (botConfig.autoEscalateKeywords as string[]) || []
            const lowerContent = inboundContent.toLowerCase()
            const triggered = keywords.some(kw => lowerContent.includes(kw.toLowerCase()))
            if (triggered) {
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { mode: 'AGENT' },
                })
                return { replied: false, reason: 'Escalation keyword detected' }
            }
        }

        // ─── 7. Resolve AI key ────────────────────────────────────
        const ownerKey = await getChannelOwnerKey(channel.id, channel.defaultAiProvider)
        if (!ownerKey.apiKey) {
            return { replied: false, reason: 'No AI API key available' }
        }

        const provider = ownerKey.provider!
        const apiKey = ownerKey.apiKey
        const model = channel.defaultAiModel || ownerKey.model || getDefaultModel(provider, {})

        // ─── 8. Load context ──────────────────────────────────────
        const knowledgeEntries = await prisma.knowledgeBase.findMany({
            where: { channelId: channel.id },
            select: { title: true, content: true },
            take: 20,
        })

        // Load recent conversation history
        const recentMessages = await prisma.inboxMessage.findMany({
            where: { conversationId },
            orderBy: { sentAt: 'desc' },
            take: 15,
        })

        const messageHistory = recentMessages
            .reverse()
            .map(m => `${m.direction === 'inbound' ? 'Customer' : 'Bot'}: ${m.content}`)
            .join('\n')

        // Load channel's connected platforms (auto-updated when new platforms are connected)
        const connectedPlatforms = await prisma.channelPlatform.findMany({
            where: { channelId: channel.id, isActive: true },
            select: { platform: true, accountName: true },
        })

        // Load image library metadata
        let imageLibrary: { originalName: string | null; url: string }[] = []
        if (botConfig?.imageFolderId) {
            imageLibrary = await prisma.mediaItem.findMany({
                where: {
                    channelId: channel.id,
                    folderId: botConfig.imageFolderId,
                    type: 'image',
                },
                select: { originalName: true, url: true },
                take: 100,
            })
        }

        // ─── 9. Build system prompt ───────────────────────────────
        const vibeTone = (channel.vibeTone as Record<string, string>) || {}
        const businessInfo = (channel.businessInfo as Record<string, any>) || {}
        const brandProfile = (channel.brandProfile as Record<string, string>) || {}
        const trainingPairs = (botConfig?.trainingPairs as Array<{ q: string; a: string }>) || []
        const consultVideos = (botConfig?.consultVideos as Array<{ title: string; url: string; description: string }>) || []
        const forbiddenTopics = (botConfig?.forbiddenTopics as string[]) || []

        let systemPrompt = `You are ${botConfig?.botName || 'AI Assistant'}, an auto-reply customer service bot for "${channel.displayName || channel.name}".`

        // ─── Neeflow Platform Knowledge (auto-injected) ──────────
        const allSupportedPlatforms = [
            ...OAUTH_PLATFORMS.map(p => `${p.label} (${p.description})`),
            ...CREDENTIAL_PLATFORMS.map(p => `${p.label} (${p.description})`),
        ]
        const connectedList = connectedPlatforms.length > 0
            ? connectedPlatforms.map(p => `${p.platform}: ${p.accountName}`).join(', ')
            : 'No platforms connected yet'

        systemPrompt += `\n\n## About NeeFlow (the platform you are part of):
- NeeFlow is an AI-powered social media management platform
- Website: https://neeflow.com
- NeeFlow supports ${allSupportedPlatforms.length} platforms: ${allSupportedPlatforms.join(', ')}
- Key features: Schedule posts, generate content with AI, manage Facebook/Instagram/YouTube/TikTok/LinkedIn/Pinterest/Threads/Google Business/X/Bluesky, unified inbox, AI auto-reply bot, media library, analytics
- This channel currently has these platforms connected: ${connectedList}
- When customers ask about platforms or features, use this information to answer accurately`

        if (botConfig?.personality) {
            systemPrompt += `\n\n## Your personality and instructions:\n${botConfig.personality}`
        }

        if (channel.description) {
            systemPrompt += `\n\n## About this business:\n${channel.description}`
        }

        if (vibeTone.personality || vibeTone.writingStyle) {
            systemPrompt += `\n\n## Brand voice:`
            if (vibeTone.personality) systemPrompt += `\n- Personality: ${vibeTone.personality}`
            if (vibeTone.writingStyle) systemPrompt += `\n- Writing style: ${vibeTone.writingStyle}`
            if (vibeTone.vocabulary) systemPrompt += `\n- Vocabulary: ${vibeTone.vocabulary}`
        }

        if (businessInfo.phone || businessInfo.address || businessInfo.website) {
            systemPrompt += `\n\n## Business contact:`
            if (businessInfo.phone) systemPrompt += `\n- Phone: ${businessInfo.phone}`
            if (businessInfo.address) systemPrompt += `\n- Address: ${businessInfo.address}`
            if (businessInfo.website) systemPrompt += `\n- Website: ${businessInfo.website}`
        }

        if (brandProfile.targetAudience) {
            systemPrompt += `\n\n## Target audience: ${brandProfile.targetAudience}`
        }

        if (knowledgeEntries.length > 0) {
            systemPrompt += `\n\n--- KNOWLEDGE BASE ---`
            for (const entry of knowledgeEntries) {
                systemPrompt += `\n\n### ${entry.title}\n${entry.content.substring(0, 2000)}`
            }
            systemPrompt += `\n--- END KNOWLEDGE BASE ---`
        }

        if (trainingPairs.length > 0) {
            systemPrompt += `\n\n--- TRAINING Q&A ---`
            for (const pair of trainingPairs.slice(0, 30)) {
                systemPrompt += `\nQ: ${pair.q}\nA: ${pair.a}`
            }
            systemPrompt += `\n--- END TRAINING Q&A ---`
        }

        if (imageLibrary.length > 0) {
            systemPrompt += `\n\n--- IMAGE LIBRARY ---`
            systemPrompt += `\nYou have access to the following images. If a customer asks to see something, find matching images and include their URLs in your reply.`
            systemPrompt += `\nFormat image links as: [IMAGE: url]`
            for (const img of imageLibrary) {
                systemPrompt += `\n- "${img.originalName || 'Untitled'}": ${img.url}`
            }
            systemPrompt += `\n--- END IMAGE LIBRARY ---`
        }

        if (consultVideos.length > 0) {
            systemPrompt += `\n\n--- CONSULTATION VIDEOS ---`
            systemPrompt += `\nYou can reference these videos when relevant. Include the URL in your reply.`
            for (const vid of consultVideos) {
                systemPrompt += `\n- "${vid.title}": ${vid.url}${vid.description ? ` (${vid.description})` : ''}`
            }
            systemPrompt += `\n--- END CONSULTATION VIDEOS ---`
        }

        if (forbiddenTopics.length > 0) {
            systemPrompt += `\n\n## FORBIDDEN TOPICS — DO NOT discuss these. If asked, say you need to forward to a human agent:\n${forbiddenTopics.join(', ')}`
        }

        const langLabel = channel.language === 'vi' ? 'Vietnamese' : channel.language === 'en' ? 'English' : channel.language || 'auto-detect'
        systemPrompt += `\n\n## Communication Style:\n- You are a REAL person on the team, not a bot. Chat naturally like a helpful colleague would over Messenger.\n- Keep messages SHORT (1-3 sentences max). Nobody likes walls of text in chat.\n- Use casual, warm language. It's okay to use emoji sparingly 😊\n- NEVER repeat yourself or say the same thing in two different ways.\n- NEVER generate multiple greeting options or alternatives.\n- ONE clear, direct response per message.`
        systemPrompt += `\n\n## Intelligence:\n- Analyze the customer's intent, sentiment, and urgency from their messages.\n- If they seem frustrated, be empathetic first before offering solutions.\n- If they ask for pricing/services, give specific information from the knowledge base.\n- If something is outside your knowledge, be honest and offer to connect them with the team.\n- Anticipate follow-up questions and proactively address them.\n- Remember context from earlier in the conversation and reference it naturally.`
        systemPrompt += `\n\n## Language:\n- Default: ${langLabel}\n- CRITICAL: Always reply in the SAME language the customer is writing in. If they switch languages, you switch too.`
        systemPrompt += `\n\n## Strict Rules:\n- NEVER say you are an AI, bot, or automated system\n- NEVER prefix with "Bot:" or any label\n- NEVER wrap reply in JSON, arrays, code blocks, or brackets\n- NEVER use [ ] or { } characters\n- PLAIN TEXT ONLY\n- If you don't know something, say "Let me check with the team and get back to you" or connect them with a human`

        // ─── 10. Call AI ──────────────────────────────────────────
        const userPrompt = `Customer name: ${conversation.externalUserName || 'Customer'}

Recent conversation:
${messageHistory}

Reply naturally in 1-3 sentences (plain text, no JSON, no brackets):`

        const rawReply = await callAI(provider, apiKey, model, systemPrompt, userPrompt)
        let cleanReply = rawReply.trim()

        // AI sometimes wraps reply in JSON — extract text if so
        if (cleanReply.startsWith('{') || cleanReply.startsWith('[') || cleanReply.startsWith('```')) {
            try {
                // Strip markdown code fences if present
                let jsonStr = cleanReply
                    .replace(/^```(?:json)?\s*/i, '')
                    .replace(/\s*```$/i, '')
                    .trim()
                // Fix malformed JSON: replace *key* or **key** with "key"
                jsonStr = jsonStr.replace(/\*{1,2}(\w+)\*{1,2}\s*:/g, '"$1":')
                // Fix unquoted string keys
                jsonStr = jsonStr.replace(/(?<=\{|,)\s*(\w+)\s*:/g, '"$1":')
                const parsed = JSON.parse(jsonStr)
                // Handle JSON array: ["reply text"] or ["text1", "text2"]
                if (Array.isArray(parsed)) {
                    const textItems = parsed.filter((item: any) => typeof item === 'string')
                    if (textItems.length > 0) {
                        cleanReply = textItems.join('\n')
                    }
                } else {
                    // Try common keys: reply, response, message, text, content, answer
                    cleanReply = parsed.reply || parsed.response || parsed.message
                        || parsed.text || parsed.content || parsed.answer
                        || cleanReply // fallback to original if no known key
                }
            } catch {
                // JSON.parse failed — try regex extraction as last resort
                const valueMatch = cleanReply.match(/(?:reply|response|message|text|content|answer)["*]*\s*:\s*"([^"]+)"/i)
                    || cleanReply.match(/(?:reply|response|message|text|content|answer)["*]*\s*:\s*"([\s\S]+?)"\s*\}?$/i)
                if (valueMatch?.[1]) {
                    cleanReply = valueMatch[1]
                }
                // Also try extracting from array-like pattern: ["text"]
                if (!valueMatch) {
                    const arrayMatch = cleanReply.match(/^\[\s*"([\s\S]+?)"\s*\]$/)
                    if (arrayMatch?.[1]) {
                        cleanReply = arrayMatch[1]
                    }
                }
            }
        }
        cleanReply = cleanReply.trim()

        if (!cleanReply) {
            return { replied: false, reason: 'Empty AI response' }
        }

        // ─── 11. Extract images from reply and send ───────────────
        // Extract [IMAGE: url] patterns
        const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/g
        const imageUrls: string[] = []
        let textReply = cleanReply
        let match
        while ((match = imageRegex.exec(cleanReply)) !== null) {
            imageUrls.push(match[1])
        }
        textReply = textReply.replace(/\[IMAGE:\s*https?:\/\/[^\]]+\]/g, '').trim()

        // ─── 12. Send reply via platform ──────────────────────────
        await sendAndSaveReply(conversation, textReply, platform, imageUrls)

        // ─── 13. Detect AI-decided escalation ─────────────────────
        // If the AI reply contains phrases indicating it's transferring
        // to a human agent, switch conversation mode to AGENT
        const escalationPatterns = [
            /connect(ing)?\s+(you\s+)?(with|to)\s+(a\s+)?(human|agent|team|staff|representative)/i,
            /transfer(ring)?\s+(you\s+)?(to|over)\s+(a\s+)?(human|agent|team|staff|representative)/i,
            /forward(ing)?\s+(you\s+)?to\s+(a\s+)?(human|agent|team|staff|representative)/i,
            /human\s+agent\s+(will|can|is\s+going\s+to)\s+(help|assist|take\s+over)/i,
            /let\s+me\s+(get|find|connect|transfer)/i,
            /kết\s*nối\s*(bạn\s*)?(với|đến)\s*(nhân\s*viên|agent|người)/i,
            /chuyển\s*(bạn\s*)?(cho|đến|qua)\s*(nhân\s*viên|agent|người|tư\s*vấn)/i,
            /nhân\s*viên\s*(sẽ|sẽ\s+sớm|đang)\s*(hỗ\s*trợ|liên\s*hệ|phục\s*vụ)/i,
        ]

        const lowerReply = textReply.toLowerCase()
        const isEscalation = escalationPatterns.some(p => p.test(textReply))

        if (isEscalation) {
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { mode: 'AGENT', status: 'new' },
            })
            console.log(`[Bot Auto-Reply] 🔄 AI escalated → switched to AGENT mode`)
            return { replied: true, reason: 'Escalated to agent' }
        }

        return { replied: true }
    } catch (err) {
        console.error('[Bot Auto-Reply] ❌ Error:', err)
        return { replied: false, reason: `Error: ${(err as Error).message}` }
    }
}

/**
 * Send reply via Facebook Graph API and save to DB
 */
async function sendAndSaveReply(
    conversation: any,
    text: string,
    platform: string,
    imageUrls?: string[]
) {
    // Get platform account for access token
    const platformAccount = conversation.platformAccountId
        ? await prisma.channelPlatform.findUnique({
            where: { id: conversation.platformAccountId },
            select: { accessToken: true, accountId: true },
        })
        : null

    if ((platform === 'facebook' || platform === 'instagram') && platformAccount?.accessToken) {
        const conversationType = conversation.type || 'message'

        if (conversationType === 'message') {
            // Dedup: prevent sending duplicate Messenger messages when same page is in multiple channels
            const dedupKey = conversation.externalUserId
            const lastSent = recentBotReplies.get(dedupKey)
            const now = Date.now()

            if (lastSent && (now - lastSent) < DEDUP_TTL_MS) {
                console.log(`[Bot] ⏭️ Skipping Messenger send (dedup) for ${dedupKey} - saving to DB only`)
            } else {
                recentBotReplies.set(dedupKey, now)
                if (recentBotReplies.size > 100) {
                    for (const [key, ts] of recentBotReplies) {
                        if (now - ts > DEDUP_TTL_MS) recentBotReplies.delete(key)
                    }
                }
                await sendFacebookMessage(
                    platformAccount.accessToken,
                    conversation.externalUserId,
                    text,
                    imageUrls
                )
            }
        }
    }

    // YouTube comment reply
    if (platform === 'youtube' && platformAccount?.accessToken && conversation.type === 'comment') {
        try {
            // Find the most recent inbound comment to reply to
            const lastComment = await prisma.inboxMessage.findFirst({
                where: {
                    conversationId: conversation.id,
                    direction: 'inbound',
                },
                orderBy: { sentAt: 'desc' },
                select: { externalId: true },
            })

            if (lastComment?.externalId) {
                await replyToYouTubeComment(
                    platformAccount.accessToken,
                    lastComment.externalId,
                    text
                )
            }
        } catch (err) {
            console.error('[Bot] YouTube comment reply failed:', err)
        }
    }

    // TikTok comment reply
    if (platform === 'tiktok' && platformAccount?.accessToken && conversation.type === 'comment') {
        try {
            const lastComment = await prisma.inboxMessage.findFirst({
                where: {
                    conversationId: conversation.id,
                    direction: 'inbound',
                },
                orderBy: { sentAt: 'desc' },
                select: { externalId: true },
            })

            if (lastComment?.externalId) {
                // Extract video ID from conversation metadata
                const metadata = conversation.metadata as any
                const videoId = metadata?.videoId
                // Strip the 'tt_' prefix we added during polling
                const commentId = lastComment.externalId.replace(/^tt_/, '')

                if (videoId && commentId) {
                    await replyToTikTokComment(
                        platformAccount.accessToken,
                        videoId,
                        commentId,
                        text
                    )
                }
            }
        } catch (err) {
            console.error('[Bot] TikTok comment reply failed:', err)
        }
    }

    // Save outbound message to DB
    await prisma.inboxMessage.create({
        data: {
            conversationId: conversation.id,
            direction: 'outbound',
            senderType: 'bot',
            content: text,
            senderName: 'Bot',
            mediaUrl: imageUrls?.[0] || null,
            mediaType: imageUrls?.[0] ? 'image' : null,
            sentAt: new Date(),
        },
    })
}

/**
 * Send a message via Facebook Messenger Send API
 */
async function sendFacebookMessage(
    accessToken: string,
    recipientId: string,
    text: string,
    imageUrls?: string[]
) {
    const apiUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`

    // Send text message
    if (text) {
        await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text },
            }),
        })
    }

    // Send images
    if (imageUrls?.length) {
        for (const url of imageUrls) {
            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: { url, is_reusable: true },
                        },
                    },
                }),
            })
        }
    }
}

/**
 * Send sender action (typing indicator, read receipt)
 */
async function sendSenderAction(
    accessToken: string,
    recipientId: string,
    action: 'typing_on' | 'typing_off' | 'mark_seen'
) {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            sender_action: action,
        }),
    })
}

/**
 * Reply to a YouTube comment via YouTube Data API v3
 */
async function replyToYouTubeComment(
    accessToken: string,
    parentCommentId: string,
    text: string
) {
    const res = await fetch(
        `https://www.googleapis.com/youtube/v3/comments?part=snippet`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                snippet: {
                    parentId: parentCommentId,
                    textOriginal: text,
                },
            }),
        }
    )

    if (!res.ok) {
        const errText = await res.text()
        console.error('[YT] Comment reply failed:', errText)
    } else {
        console.log(`[YT] ✅ Replied to comment ${parentCommentId}`)
    }
}

/**
 * Reply to a TikTok comment via TikTok API v2
 */
async function replyToTikTokComment(
    accessToken: string,
    videoId: string,
    commentId: string,
    text: string
) {
    const res = await fetch(
        'https://open.tiktokapis.com/v2/video/comment/reply/create/',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                video_id: videoId,
                comment_id: commentId,
                text,
            }),
        }
    )

    if (!res.ok) {
        const errText = await res.text()
        console.error('[TT] Comment reply failed:', errText)
    } else {
        console.log(`[TT] ✅ Replied to comment ${commentId}`)
    }
}

/**
 * Send greeting message when a new conversation starts in BOT mode
 */
export async function sendBotGreeting(
    conversationId: string,
    platform: string
) {
    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                channel: { select: { id: true, vibeTone: true, businessInfo: true } },
            },
        })

        if (!conversation?.channel) return

        const botConfig = await prisma.botConfig.findUnique({
            where: { channelId: conversation.channel.id },
        })

        if (!botConfig?.isEnabled) return

        // Per-page toggle only controls default mode for NEW conversations.
        // Greeting is only sent for NEW conversations, so per-page check is
        // already handled by upsertConversation setting mode=AGENT.

        const greetingMode = (botConfig as any).greetingMode || 'template'
        const greetingImages = (botConfig.greetingImages as string[]) || []
        let greetingText = botConfig.greeting || ''

        // Auto mode: generate greeting via AI
        if (greetingMode === 'auto') {
            try {
                const ownerKey = await getChannelOwnerKey(conversation.channel.id)
                if (ownerKey.apiKey) {
                    const vibeTone = (conversation.channel as any).vibeTone || ''
                    const businessInfo = (conversation.channel as any).businessInfo || ''
                    const prompt = `Generate a brief, friendly greeting message for a customer who just started a chat. 
Bot name: ${botConfig.botName || 'AI Assistant'}
${vibeTone ? `Brand voice/tone: ${vibeTone}` : ''}
${businessInfo ? `Business: ${businessInfo}` : ''}
${botConfig.personality ? `Personality: ${botConfig.personality}` : ''}
Language: ${botConfig.language || 'vi'}
Keep it short (1-2 sentences), warm, and professional. Reply with ONLY the greeting text.`
                    greetingText = await callAI(
                        ownerKey.provider!, ownerKey.apiKey!, ownerKey.model || getDefaultModel(ownerKey.provider || 'openai', {}),
                        'You are a greeting message generator. Reply with ONLY the greeting text, no JSON, no quotes, no formatting.', prompt
                    )
                    greetingText = greetingText.trim()
                    // Strip markdown code fences
                    greetingText = greetingText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
                    // Strip JSON wrapper: {"greeting": "..."}, ["text1", "text2"], etc.
                    if ((greetingText.startsWith('{') && greetingText.endsWith('}')) ||
                        (greetingText.startsWith('[') && greetingText.endsWith(']'))) {
                        try {
                            const parsed = JSON.parse(greetingText)
                            if (Array.isArray(parsed)) {
                                // Take first string from array
                                const first = parsed.find((item: any) => typeof item === 'string')
                                if (first) greetingText = first
                            } else if (typeof parsed === 'object') {
                                greetingText = parsed.greeting || parsed.message || parsed.text || parsed.content || Object.values(parsed)[0] as string || greetingText
                            }
                        } catch { /* not valid JSON, use as-is */ }
                    }
                    // Strip surrounding quotes
                    if ((greetingText.startsWith('"') && greetingText.endsWith('"')) ||
                        (greetingText.startsWith("'") && greetingText.endsWith("'"))) {
                        greetingText = greetingText.slice(1, -1)
                    }
                }
            } catch (err) {
                console.error('[Bot Greeting] AI greeting failed, using fallback:', err)
            }
            if (!greetingText) greetingText = `Xin chào! Tôi là ${botConfig.botName || 'AI Assistant'}. Tôi có thể giúp gì cho bạn?`
        }

        if (!greetingText) return

        await sendAndSaveReply(
            conversation,
            greetingText,
            platform,
            greetingImages.length > 0 ? greetingImages : undefined
        )

        console.log(`[Bot Greeting] ✅ Sent ${greetingMode} greeting for conversation ${conversationId}`)
    } catch (err) {
        console.error('[Bot Greeting] ❌ Error:', err)
    }
}
