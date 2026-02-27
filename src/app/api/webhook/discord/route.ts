/**
 * Discord Webhook — receives bot events and ingests media into SmartFlow pipeline.
 * 
 * Discord sends interaction/message events when users post in the subscribed channel.
 * This endpoint extracts image/video attachments, uploads to R2, and creates ContentJobs.
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

        // Get channel ID from the message
        const channelId = body.channel_id || ''
        if (!channelId) {
            return NextResponse.json({ ok: true })
        }

        // Ignore messages from bots to prevent loops
        if (body.author?.bot) {
            return NextResponse.json({ ok: true })
        }

        // Find channel with this Discord channel ID configured
        const channels = await prisma.channel.findMany({
            where: { pipelineEnabled: true },
            select: { id: true, smartflowSources: true },
        })

        const matchingChannel = channels.find(ch => {
            const sources = (ch.smartflowSources || {}) as Record<string, Record<string, string>>
            return sources.discord?.channelId === channelId
        })

        if (!matchingChannel) {
            return NextResponse.json({ ok: true })
        }

        const sources = (matchingChannel.smartflowSources || {}) as Record<string, Record<string, string>>
        const discordConfig = sources.discord
        if (!discordConfig?.botToken) {
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

        // Reply with confirmation via Discord API
        if (results.length > 0 && source.buildReplyPayload) {
            const reply = source.buildReplyPayload(
                discordConfig,
                `✅ Received ${results.length} file(s)! AI is creating your post...`
            )
            await fetch(reply.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bot ${discordConfig.botToken}`,
                },
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
