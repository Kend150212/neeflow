/**
 * Telegram Webhook — receives bot updates, ingests messages into Inbox,
 * triggers AI Bot auto-reply, and allows agents to reply back from Inbox.
 *
 * Flow:
 *  1. Finds channel whose BotConfig has matching telegramBotToken
 *  2. Upserts a virtual ChannelPlatform record (platform='telegram')
 *  3. Upserts Conversation + creates InboxMessage
 *  4. Triggers botAutoReply — AI generates reply and sends back via Bot API
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { botAutoReply, sendBotGreeting } from '@/lib/bot-auto-reply'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Telegram update: message or edited_message
        const message = body.message || body.edited_message || body.channel_post
        if (!message) {
            return NextResponse.json({ ok: true })
        }

        const telegramUserId = String(message.from?.id || message.chat?.id || '')
        const telegramUserName =
            message.from?.first_name
                ? `${message.from.first_name}${message.from.last_name ? ' ' + message.from.last_name : ''}`.trim()
                : message.from?.username || 'Telegram User'
        const telegramUsername = message.from?.username || ''
        const chatId = String(message.chat?.id || '')
        const text = message.text || message.caption || ''
        const messageId = String(message.message_id || '')

        if (!telegramUserId) {
            return NextResponse.json({ ok: true })
        }

        // Find all channels with Telegram Bot Token configured
        const botConfigs = await prisma.botConfig.findMany({
            where: {
                telegramBotToken: { not: null },
            },
            select: {
                channelId: true,
                telegramBotToken: true,
                telegramChatId: true,
                isEnabled: true,
            },
        })

        if (botConfigs.length === 0) {
            console.log('[Telegram Webhook] No channels with Telegram configured')
            return NextResponse.json({ ok: true })
        }

        // Match by configured chatId, fall back to first configured channel
        let targetConfig = botConfigs.find(c => c.telegramChatId === chatId)
        if (!targetConfig) {
            targetConfig = botConfigs[0]
        }

        if (!targetConfig?.telegramBotToken) {
            return NextResponse.json({ ok: true })
        }

        const { channelId, telegramBotToken } = targetConfig

        // Upsert virtual ChannelPlatform for Telegram (uses bot numeric ID as accountId)
        const botTokenPrefix = telegramBotToken.split(':')[0]
        const virtualAccountId = `telegram_bot_${botTokenPrefix}`

        let platformAccount = await prisma.channelPlatform.findFirst({
            where: { channelId, platform: 'telegram', accountId: virtualAccountId },
        })

        if (!platformAccount) {
            platformAccount = await prisma.channelPlatform.create({
                data: {
                    channelId,
                    platform: 'telegram',
                    accountId: virtualAccountId,
                    accountName: 'Telegram Bot',
                    accessToken: telegramBotToken,
                    config: { botEnabled: true },
                },
            })
            console.log(`[Telegram Webhook] Created virtual ChannelPlatform for channel ${channelId}`)
        } else if (platformAccount.accessToken !== telegramBotToken) {
            // Keep token in sync if it changed
            await prisma.channelPlatform.update({
                where: { id: platformAccount.id },
                data: { accessToken: telegramBotToken },
            })
        }

        // Build message content
        const content = text ||
            (message.photo ? '[📷 Photo]' :
                message.video ? '[🎥 Video]' :
                    message.document ? '[📎 File]' :
                        message.voice ? '[🎤 Voice]' :
                            message.sticker ? '[🎭 Sticker]' : '[Message]')

        // Check bot config for conversation mode
        const botConfig = await prisma.botConfig.findUnique({
            where: { channelId },
            select: { isEnabled: true },
        })
        const convMode = botConfig?.isEnabled ? 'BOT' : 'AGENT'

        // Upsert Conversation
        let isNewConversation = false
        let conversation = await prisma.conversation.findFirst({
            where: {
                channelId,
                platform: 'telegram',
                externalUserId: telegramUserId,
                type: 'message',
            },
        })

        if (!conversation) {
            isNewConversation = true
            conversation = await prisma.conversation.create({
                data: {
                    channelId,
                    platformAccountId: platformAccount.id,
                    platform: 'telegram',
                    externalUserId: telegramUserId,
                    externalUserName: telegramUserName || telegramUsername || undefined,
                    status: 'new',
                    mode: convMode,
                    type: 'message',
                    unreadCount: 1,
                    lastMessageAt: new Date(),
                },
            })
            console.log(`[Telegram Webhook] Created new conversation ${conversation.id} for user ${telegramUserId}`)
        } else {
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: new Date(),
                    unreadCount: { increment: 1 },
                    status: conversation.status === 'done' ? 'open' : conversation.status,
                },
            })
        }

        // Create InboxMessage (dedup by Telegram message_id)
        const existingMsg = messageId
            ? await prisma.inboxMessage.findFirst({
                where: { conversationId: conversation.id, externalId: messageId },
            })
            : null

        if (!existingMsg) {
            await prisma.inboxMessage.create({
                data: {
                    conversationId: conversation.id,
                    externalId: messageId || undefined,
                    direction: 'inbound',
                    senderType: 'customer',
                    content,
                    senderName: telegramUserName || telegramUsername || undefined,
                    sentAt: message.date ? new Date(message.date * 1000) : new Date(),
                },
            })
        }

        // Trigger AI Bot auto-reply in background (non-blocking)
        // botAutoReply handles: checking if bot is enabled, generating AI response,
        // and sending it back via Telegram Bot API (see bot-auto-reply.ts)
        setImmediate(async () => {
            try {
                if (isNewConversation) {
                    await sendBotGreeting(conversation!.id, 'telegram')
                }
                const result = await botAutoReply(conversation!.id, content, 'telegram')
                if (result) {
                    console.log(`[Telegram Webhook] Bot auto-reply for ${conversation!.id}:`, result)
                }
            } catch (err) {
                console.error('[Telegram Webhook] Bot auto-reply error:', err)
            }
        })

        console.log(`[Telegram Webhook] ✅ Message from ${telegramUserName} (${telegramUserId}) → channel ${channelId}`)
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[Telegram Webhook] Error:', error)
        // Always return 200 to Telegram to prevent retries
        return NextResponse.json({ ok: true })
    }
}
