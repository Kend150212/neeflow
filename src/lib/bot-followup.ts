/**
 * bot-followup.ts
 *
 * Smart Follow-up System:
 * When bot escalates ("let me check with the team"), this module:
 *   1. Sends warm messages to customer at configurable intervals
 *   2. Notifies agents via in-app SSE + DB badge (immediate)
 *   3. Alerts via Telegram if no agent reply within threshold (via scheduler)
 *
 * Timing is configurable via botConfig JSON:
 *   followupWarm1Minutes  — default 30   (warm message 1 delay)
 *   followupWarm2Hours    — default 2    (fallback message + Telegram alert delay)
 *   followupWarm1Text     — null = use i18n default
 *   followupWarm2Text     — null = use i18n default
 */

import { prisma } from '@/lib/prisma'
import { createNotification, notifyChannelAdmins } from '@/lib/notify'

// ─── i18n warm message strings ─────────────────────────────────────────────
const WARM_MESSAGES = {
    warm1: {
        vi: 'Bạn ơi, team tụi mình đang check nhanh á, xíu có kết quả liền! 😊',
        en: 'Hi! Our team is checking on this for you — we\'ll be right back! 😊',
    },
    warm2: {
        vi: 'Xin lỗi bạn đợi lâu! Để chắc ăn bạn liên hệ trực tiếp với team tụi mình để được hỗ trợ ngay nha! 🙏',
        en: 'So sorry for the wait! Please reach out to our team directly for immediate assistance! 🙏',
    },
    warm2WithPhone: {
        vi: (phone: string) => `Xin lỗi bạn đợi lâu! Bạn gọi ${phone} để được hỗ trợ ngay nha! 🙏`,
        en: (phone: string) => `So sorry for the wait! Please call us at ${phone} for immediate help! 🙏`,
    },
    notifyTitle: {
        vi: '⚠️ Khách đang chờ tư vấn',
        en: '⚠️ Customer waiting for follow-up',
    },
    notifyTitleUrgent: {
        vi: '🔴 Khách đã chờ quá lâu — chưa có agent reply',
        en: '🔴 Customer has been waiting too long — no agent reply yet',
    },
} as const

type Lang = 'vi' | 'en'

function getLang(channelLanguage: string | null | undefined): Lang {
    return channelLanguage === 'vi' ? 'vi' : 'en'
}

// ─── Save bot warm message to DB ───────────────────────────────────────────
async function saveBotMessage(conversationId: string, channelId: string, text: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.inboxMessage.create({
        data: {
            conversationId,
            channelId,
            direction: 'outbound',
            senderType: 'bot',
            content: text,
            sentAt: new Date(),
        } as any,
    })
}

// ─── Send warm message via Facebook/Instagram API ──────────────────────────
async function sendWarmViaPlatform(
    conversation: {
        id: string
        channelId: string
        platform: string
        externalUserId: string
        platformAccountId: string | null
        type: string | null
    },
    text: string
) {
    if (!conversation.platformAccountId) return
    if (conversation.type === 'comment') return // don't warm-message comments

    const platformAccount = await prisma.channelPlatform.findUnique({
        where: { id: conversation.platformAccountId },
        select: { accessToken: true, config: true },
    })
    if (!platformAccount?.accessToken) return

    try {
        if (conversation.platform === 'facebook') {
            await fetch('https://graph.facebook.com/v19.0/me/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: conversation.externalUserId },
                    message: { text },
                    access_token: platformAccount.accessToken,
                }),
            })
        } else if (conversation.platform === 'instagram') {
            const pageId = (platformAccount.config as any)?.pageId
            if (pageId) {
                await fetch(`https://graph.facebook.com/v19.0/${pageId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: { id: conversation.externalUserId },
                        message: { text },
                        access_token: platformAccount.accessToken,
                    }),
                })
            }
        }
    } catch (err) {
        console.error('[BotFollowup] ❌ Failed to send warm message via platform:', err)
    }
}

// ─── Schedule warm follow-up messages ──────────────────────────────────────
export function scheduleWarmFollowup(opts: {
    conversationId: string
    channelId: string
    channelLanguage: string | null | undefined
    channelPhone: string | null | undefined
    platform: string
    externalUserId: string
    platformAccountId: string | null
    conversationType: string | null
    assignedTo: string | null
    customerName: string | null
    escalatedTopic: string
    botConfig: Record<string, any> | null
}) {
    const {
        conversationId, channelId, channelLanguage, channelPhone,
        platform, externalUserId, platformAccountId, conversationType,
        assignedTo, customerName, escalatedTopic, botConfig,
    } = opts

    const lang = getLang(channelLanguage)

    // Configurable delays (from botConfig, fallback to defaults)
    const warm1Ms = ((botConfig?.followupWarm1Minutes as number) ?? 30) * 60 * 1000
    const warm2Ms = ((botConfig?.followupWarm2Hours as number) ?? 2) * 60 * 60 * 1000

    // Custom text override (null = use i18n default)
    const customWarm1 = botConfig?.followupWarm1Text as string | null | undefined
    const customWarm2 = botConfig?.followupWarm2Text as string | null | undefined

    const conv = { id: conversationId, channelId, platform, externalUserId, platformAccountId, type: conversationType }

    // ── T+warm1: First warm message ──────────────────────────────────────────
    setTimeout(async () => {
        try {
            // Check if agent already replied — if so, skip
            const lastOutbound = await prisma.inboxMessage.findFirst({
                where: { conversationId, direction: 'outbound', senderType: 'agent' },
                orderBy: { sentAt: 'desc' },
            })
            const escalatedAt = new Date(Date.now() - warm1Ms)
            if (lastOutbound && lastOutbound.sentAt > escalatedAt) {
                console.log(`[BotFollowup] ✅ Agent already replied for ${conversationId} — skipping warm1`)
                return
            }

            const text = customWarm1 || WARM_MESSAGES.warm1[lang]
            await sendWarmViaPlatform(conv, text)
            await saveBotMessage(conversationId, channelId, text)

            // Mark warm1 sent in metadata
            const existing = await prisma.conversation.findUnique({
                where: { id: conversationId }, select: { metadata: true },
            })
            await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    metadata: {
                        ...(existing?.metadata as object || {}),
                        followupWarm1SentAt: new Date().toISOString(),
                    },
                },
            })

            console.log(`[BotFollowup] ✅ Warm1 sent for conversation ${conversationId}`)
        } catch (err) {
            console.error('[BotFollowup] ❌ Warm1 error:', err)
        }
    }, warm1Ms)

    // ── T+warm2: Fallback + repeat agent notification ─────────────────────────
    setTimeout(async () => {
        try {
            // Check if agent already replied
            const lastOutbound = await prisma.inboxMessage.findFirst({
                where: { conversationId, direction: 'outbound', senderType: 'agent' },
                orderBy: { sentAt: 'desc' },
            })
            const escalatedAt = new Date(Date.now() - warm2Ms)
            if (lastOutbound && lastOutbound.sentAt > escalatedAt) {
                console.log(`[BotFollowup] ✅ Agent already replied for ${conversationId} — skipping warm2`)
                return
            }

            // Build warm2 text (with phone if available)
            let warm2Text: string
            if (customWarm2) {
                warm2Text = customWarm2
            } else if (channelPhone) {
                warm2Text = WARM_MESSAGES.warm2WithPhone[lang](channelPhone)
            } else {
                warm2Text = WARM_MESSAGES.warm2[lang]
            }

            await sendWarmViaPlatform(conv, warm2Text)
            await saveBotMessage(conversationId, channelId, warm2Text)

            // Mark warm2 sent
            const existing = await prisma.conversation.findUnique({
                where: { id: conversationId }, select: { metadata: true },
            })
            await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    metadata: {
                        ...(existing?.metadata as object || {}),
                        followupWarm2SentAt: new Date().toISOString(),
                    },
                },
            })

            // Repeat agent notification (urgent)
            const urgentTitle = WARM_MESSAGES.notifyTitleUrgent[lang]
            const inboxLink = `/dashboard/inbox?conversationId=${conversationId}`

            await notifyChannelAdmins({
                channelId,
                type: 'new_message',
                title: urgentTitle,
                message: `${customerName || 'Khách'} — "${escalatedTopic}"`,
                link: inboxLink,
                data: { conversationId, urgent: true },
            })

            if (assignedTo) {
                await createNotification({
                    userId: assignedTo,
                    type: 'new_message',
                    title: urgentTitle,
                    message: `${customerName || 'Khách'} đã chờ ${Math.round(warm2Ms / 3600000)}h chưa được trả lời`,
                    link: inboxLink,
                    data: { conversationId, urgent: true },
                })
            }

            // Telegram alert via channel botConfig (if telegramChatId + telegramBotToken set)
            await sendTelegramFollowupAlert({
                channelId,
                conversationId,
                customerName: customerName || 'Khách',
                escalatedTopic,
                waitHours: Math.round(warm2Ms / 3600000),
                lang,
            })

            console.log(`[BotFollowup] ✅ Warm2 + urgent notify sent for conversation ${conversationId}`)
        } catch (err) {
            console.error('[BotFollowup] ❌ Warm2 error:', err)
        }
    }, warm2Ms)
}

// ─── Telegram alert (raw fetch, no postId needed) ──────────────────────────
async function sendTelegramFollowupAlert(opts: {
    channelId: string
    conversationId: string
    customerName: string
    escalatedTopic: string
    waitHours: number
    lang: Lang
}) {
    const { channelId, conversationId, customerName, escalatedTopic, waitHours, lang } = opts

    try {
        const botConfig = await prisma.botConfig.findUnique({
            where: { channelId },
            select: { telegramChatId: true, telegramBotToken: true } as any,
        }) as any

        if (!botConfig?.telegramChatId || !botConfig?.telegramBotToken) return

        const msg = lang === 'vi'
            ? `🔴 *Cần follow-up gấp!*\n\nKhách: *${customerName}*\nChủ đề: ${escalatedTopic}\nĐã chờ: ${waitHours} giờ chưa có agent reply\n\n👉 Trả lời ngay trong dashboard`
            : `🔴 *Urgent follow-up needed!*\n\nCustomer: *${customerName}*\nTopic: ${escalatedTopic}\nWaiting: ${waitHours}h with no agent reply\n\n👉 Reply now in dashboard`

        await fetch(`https://api.telegram.org/bot${botConfig.telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: botConfig.telegramChatId,
                text: msg,
                parse_mode: 'Markdown',
            }),
        })

        console.log(`[BotFollowup] ✅ Telegram alert sent for ${conversationId}`)
    } catch (err) {
        console.error('[BotFollowup] ❌ Telegram alert error:', err)
    }
}

// ─── Scheduler: check stale escalations (called every 5 minutes) ──────────
export async function checkStaleEscalations(): Promise<void> {
    try {
        // Find conversations with pendingFollowup=true that have been stale for >3h
        // and haven't received warm2 yet
        const staleConvs = await prisma.$queryRawUnsafe<Array<{
            id: string
            channel_id: string
            assigned_to: string | null
            external_user_name: string | null
        }>>(
            `SELECT id, channel_id, assigned_to, external_user_name
             FROM conversations
             WHERE metadata->>'pendingFollowup' = 'true'
               AND metadata->>'followupWarm2SentAt' IS NULL
               AND (metadata->>'escalatedAt')::timestamptz < now() - interval '3 hours'
             LIMIT 20`
        )

        if (staleConvs.length === 0) return

        console.log(`[BotFollowup] 🔍 Found ${staleConvs.length} stale escalation(s) to alert`)

        for (const conv of staleConvs) {
            // Check if an agent has replied since escalation
            const lastAgentMsg = await prisma.inboxMessage.findFirst({
                where: { conversationId: conv.id, direction: 'outbound', senderType: 'agent' },
                orderBy: { sentAt: 'desc' },
            })

            const meta = await prisma.conversation.findUnique({
                where: { id: conv.id },
                select: { metadata: true, channel: { select: { language: true } } },
            })
            const escalatedAt = new Date((meta?.metadata as any)?.escalatedAt || 0)

            if (lastAgentMsg && lastAgentMsg.sentAt > escalatedAt) {
                // Agent did reply — clear the flag
                await prisma.conversation.update({
                    where: { id: conv.id },
                    data: {
                        metadata: {
                            ...(meta?.metadata as object || {}),
                            pendingFollowup: false,
                            resolvedAt: new Date().toISOString(),
                        },
                    },
                })
                continue
            }

            const lang = getLang(meta?.channel?.language)

            // Send Telegram + in-app notify (re-use sendTelegramFollowupAlert)
            await notifyChannelAdmins({
                channelId: conv.channel_id,
                type: 'new_message',
                title: WARM_MESSAGES.notifyTitleUrgent[lang],
                message: `${conv.external_user_name || 'Khách'} — Chờ >3 giờ chưa có phản hồi`,
                link: `/dashboard/inbox?conversationId=${conv.id}`,
                data: { conversationId: conv.id, urgent: true },
            })

            await sendTelegramFollowupAlert({
                channelId: conv.channel_id,
                conversationId: conv.id,
                customerName: conv.external_user_name || 'Khách',
                escalatedTopic: 'Cần tư vấn',
                waitHours: 3,
                lang,
            })

            console.log(`[BotFollowup] ⚠️ Stale alert sent for conversation ${conv.id}`)
        }
    } catch (err) {
        console.error('[BotFollowup] ❌ checkStaleEscalations error:', err)
    }
}
