/**
 * Discord Webhook — receives events and ingests media into SmartFlow pipeline.
 * 
 * This endpoint can be called by Discord bot integrations or external automation
 * tools (like Zapier, n8n) that forward Discord messages to our webhook URL.
 * 
 * It extracts image/video attachments, uploads to R2, and creates ContentJobs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMessagingSource } from '@/lib/messaging-sources'
import { ingestMedia } from '@/lib/smartflow-ingest'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Discord interaction verification (required for bots)
        if (body.type === 1) {
            // PING — respond with PONG for Discord URL verification
            return NextResponse.json({ type: 1 })
        }

        const source = getMessagingSource('discord')
        if (!source) {
            return NextResponse.json({ ok: true })
        }

        // Ignore messages from bots/webhooks to prevent loops
        if (body.author?.bot || body.webhook_id) {
            return NextResponse.json({ ok: true })
        }

        // Extract the Discord webhook URL or channel identifier from the request
        const discordChannelId = body.channel_id || ''

        // Find channel with Discord configured that matches
        const channels = await prisma.channel.findMany({
            where: { pipelineEnabled: true },
            select: { id: true, smartflowSources: true },
        })

        const matchingChannel = channels.find(ch => {
            const sources = (ch.smartflowSources || {}) as Record<string, Record<string, string>>
            const discordConfig = sources.discord
            if (!discordConfig?.webhookUrl) return false
            // Match via webhook URL containing the channel or via explicit channel match
            return discordChannelId && discordConfig.webhookUrl.includes(discordChannelId)
        })

        if (!matchingChannel) {
            return NextResponse.json({ ok: true })
        }

        const sources = (matchingChannel.smartflowSources || {}) as Record<string, Record<string, string>>
        const discordConfig = sources.discord
        if (!discordConfig?.webhookUrl) {
            return NextResponse.json({ ok: true })
        }

        // Parse webhook to extract media attachments
        const { media } = await source.parseWebhook(body, discordConfig)
        if (media.length === 0) {
            return NextResponse.json({ ok: true })
        }

        // Ingest each media item
        const results = []
        for (const item of media) {
            try {
                const result = await ingestMedia({
                    channelId: matchingChannel.id,
                    fileUrl: item.fileUrl,
                    fileName: item.fileName,
                    mimeType: item.mimeType,
                    source: 'discord',
                    uploadedBy: `discord:${body.author?.id || 'unknown'}`,
                })
                results.push(result)
            } catch (err) {
                console.error(`[Discord Webhook] Failed to ingest media:`, err)
            }
        }

        // Reply with confirmation via Discord webhook
        if (results.length > 0 && source.buildReplyPayload) {
            const reply = source.buildReplyPayload(
                discordConfig,
                `✅ Received ${results.length} file(s)! AI is creating your post...`
            )
            await fetch(reply.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reply.body),
            }).catch(() => { })
        }

        console.log(`[Discord Webhook] Ingested ${results.length} media items for channel ${matchingChannel.id}`)
        return NextResponse.json({ ok: true, ingested: results.length })
    } catch (error) {
        console.error('[Discord Webhook] Error:', error)
        return NextResponse.json({ ok: true })
    }
}
