/**
 * Telegram Webhook — receives bot updates and ingests media into SmartFlow pipeline.
 * 
 * Telegram sends updates when users send messages to the bot.
 * This endpoint extracts photos/videos, uploads to R2, and creates ContentJobs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMessagingSource, resolveTelegramFileUrl } from '@/lib/messaging-sources'
import { ingestMedia } from '@/lib/smartflow-ingest'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const source = getMessagingSource('telegram')
        if (!source) {
            return NextResponse.json({ ok: true }) // Silent fail
        }

        // Extract chat ID from the update to find the channel
        const message = body.message || body.channel_post
        if (!message) {
            return NextResponse.json({ ok: true }) // Not a message update
        }

        const chatId = String(message.chat?.id || '')
        if (!chatId) {
            return NextResponse.json({ ok: true })
        }

        // Find channel with this Telegram chat ID configured
        const channels = await prisma.channel.findMany({
            where: { pipelineEnabled: true },
            select: { id: true, smartflowSources: true },
        })

        const matchingChannel = channels.find(ch => {
            const sources = (ch.smartflowSources || {}) as Record<string, Record<string, string>>
            return sources.telegram?.chatId === chatId
        })

        if (!matchingChannel) {
            console.log(`[Telegram Webhook] No channel configured for chat ${chatId}`)
            return NextResponse.json({ ok: true })
        }

        const sources = (matchingChannel.smartflowSources || {}) as Record<string, Record<string, string>>
        const telegramConfig = sources.telegram
        if (!telegramConfig?.botToken) {
            return NextResponse.json({ ok: true })
        }

        // Parse the webhook to extract media
        const { media } = await source.parseWebhook(body, telegramConfig)
        if (media.length === 0) {
            // No media — might be a text message, send helpful reply
            if (source.buildReplyPayload && message.text) {
                const reply = source.buildReplyPayload(telegramConfig, '📸 Gửi ảnh hoặc video để tạo bài viết tự động!')
                await fetch(reply.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reply.body),
                }).catch(() => { })
            }
            return NextResponse.json({ ok: true })
        }

        // Ingest each media item
        const results = []
        for (const item of media) {
            try {
                // Resolve Telegram file_id to download URL
                let fileUrl = item.fileUrl
                if (fileUrl.startsWith('__telegram_file_id__:')) {
                    const fileId = fileUrl.replace('__telegram_file_id__:', '')
                    fileUrl = await resolveTelegramFileUrl(telegramConfig.botToken, fileId)
                }

                const result = await ingestMedia({
                    channelId: matchingChannel.id,
                    fileUrl,
                    fileName: item.fileName,
                    mimeType: item.mimeType,
                    source: 'telegram',
                    uploadedBy: `telegram:${chatId}`,
                })
                results.push(result)
            } catch (err) {
                console.error(`[Telegram Webhook] Failed to ingest media:`, err)
            }
        }

        // Reply with confirmation
        if (results.length > 0 && source.buildReplyPayload) {
            const reply = source.buildReplyPayload(
                telegramConfig,
                `✅ Đã nhận ${results.length} file! AI đang tạo bài viết...`
            )
            await fetch(reply.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reply.body),
            }).catch(() => { })
        }

        console.log(`[Telegram Webhook] Ingested ${results.length} media items for channel ${matchingChannel.id}`)
        return NextResponse.json({ ok: true, ingested: results.length })
    } catch (error) {
        console.error('[Telegram Webhook] Error:', error)
        // Always return 200 to Telegram to prevent retries
        return NextResponse.json({ ok: true })
    }
}
