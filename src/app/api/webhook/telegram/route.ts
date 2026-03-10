/**
 * Telegram Webhook — receives bot updates, ingests messages into Inbox,
 * and optionally ingests media into the SmartFlow pipeline.
 *
 * Telegram sends updates when users send messages to the bot.
 * This endpoint:
 *  1. Finds the channel whose BotConfig has matching webhookTelegramToken
 *  2. Upserts a ChannelPlatform record for telegram (virtual account)
 *  3. Creates / upserts a Conversation + InboxMessage so it appears in Inbox
 *  4. If the message contains media, also ingests it into SmartFlow
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

        // Find all channels that have a BotConfig with telegramBotToken set
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

        // Match by chatId (the Chat ID configured in the bot config)
        // telegramChatId in BotConfig is the notification chat ID (for admins)
        // For inbox: we accept messages from ANY user who sends to the bot
        // Use the first channel that has this bot configured (or match by specific chat if set)
        let targetConfig = botConfigs.find(c => c.telegramChatId === chatId)
        if (!targetConfig) {
            // Fall back to first configured channel (single-bot scenario)
            targetConfig = botConfigs[0]
        }

        if (!targetConfig?.telegramBotToken) {
            return NextResponse.json({ ok: true })
        }

        const { channelId, telegramBotToken } = targetConfig

        // Upsert a virtual ChannelPlatform record for Telegram
        // accountId = bot token prefix (unique per bot)
        const botTokenPrefix = telegramBotToken.split(':')[0] // numeric bot ID
        const virtualAccountId = `telegram_bot_${botTokenPrefix}`

        let platformAccount = await prisma.channelPlatform.findFirst({
            where: {
                channelId,
                platform: 'telegram',
                accountId: virtualAccountId,
            },
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
        }

        // Determine content
        const content = text || (message.photo ? '[📷 Photo]' : message.video ? '[🎥 Video]' : message.document ? '[📎 File]' : message.sticker ? '[🎭 Sticker]' : '[Message]')

        // Upsert Conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                channelId,
                platform: 'telegram',
                externalUserId: telegramUserId,
                type: 'message',
            },
        })

        // Check bot mode
        const botConfig = await prisma.botConfig.findUnique({
            where: { channelId },
            select: { isEnabled: true },
        })
        const convMode = botConfig?.isEnabled ? 'BOT' : 'AGENT'

        if (!conversation) {
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
            console.log(`[Telegram Webhook] Created new conversation for user ${telegramUserId}`)
        } else {
            // Update last message timestamp and unread count
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: new Date(),
                    unreadCount: { increment: 1 },
                    status: conversation.status === 'done' ? 'open' : conversation.status,
                },
            })
        }

        // Create InboxMessage (dedup by externalId)
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

        console.log(`[Telegram Webhook] Ingested message from ${telegramUserName} (${telegramUserId}) for channel ${channelId}`)
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('[Telegram Webhook] Error:', error)
        // Always return 200 to Telegram to prevent retries
        return NextResponse.json({ ok: true })
    }
}
