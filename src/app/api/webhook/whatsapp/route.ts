/**
 * WhatsApp Webhook — receives Cloud API events and ingests media into SmartFlow pipeline.
 * 
 * Meta Cloud API sends webhook events when users send messages to the WhatsApp Business number.
 * This endpoint handles GET (webhook verification) and POST (incoming messages).
 * It extracts image/video attachments, downloads via Graph API, uploads to R2, and creates ContentJobs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMessagingSource, resolveWhatsAppMediaUrl } from '@/lib/messaging-sources'
import { ingestMedia } from '@/lib/smartflow-ingest'

// GET — Meta webhook verification (subscribe endpoint)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode !== 'subscribe' || !token || !challenge) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Find channel with matching verify token
    const channels = await prisma.channel.findMany({
        where: { pipelineEnabled: true },
        select: { id: true, smartflowSources: true },
    })

    const match = channels.find(ch => {
        const sources = (ch.smartflowSources || {}) as Record<string, Record<string, string>>
        return sources.whatsapp?.verifyToken === token
    })

    if (!match) {
        return NextResponse.json({ error: 'Verify token mismatch' }, { status: 403 })
    }

    // Return the challenge to complete verification
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

// POST — Incoming WhatsApp message events
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        const source = getMessagingSource('whatsapp')
        if (!source) {
            return NextResponse.json({ ok: true })
        }

        // Extract phone number ID from webhook payload
        const entry = (body.entry as Array<Record<string, unknown>>)?.[0]
        const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0]
        const value = changes?.value as Record<string, unknown> | undefined
        const phoneNumberId = value?.metadata
            ? String((value.metadata as Record<string, unknown>).phone_number_id)
            : ''

        if (!phoneNumberId) {
            return NextResponse.json({ ok: true })
        }

        // Find channel with this WhatsApp phone number ID
        const channels = await prisma.channel.findMany({
            where: { pipelineEnabled: true },
            select: { id: true, smartflowSources: true },
        })

        const matchingChannel = channels.find(ch => {
            const sources = (ch.smartflowSources || {}) as Record<string, Record<string, string>>
            return sources.whatsapp?.phoneNumberId === phoneNumberId
        })

        if (!matchingChannel) {
            return NextResponse.json({ ok: true })
        }

        const sources = (matchingChannel.smartflowSources || {}) as Record<string, Record<string, string>>
        const waConfig = sources.whatsapp
        if (!waConfig?.accessToken) {
            return NextResponse.json({ ok: true })
        }

        // Parse webhook to extract media
        const { media, senderId } = await source.parseWebhook(body, waConfig)
        if (media.length === 0) {
            return NextResponse.json({ ok: true })
        }

        // Ingest each media item
        const results = []
        for (const item of media) {
            try {
                let fileUrl = item.fileUrl

                // Resolve WhatsApp media ID to download URL
                if (fileUrl.startsWith('__whatsapp_media_id__:')) {
                    const mediaId = fileUrl.replace('__whatsapp_media_id__:', '')
                    fileUrl = await resolveWhatsAppMediaUrl(waConfig.accessToken, mediaId)
                }

                const result = await ingestMedia({
                    channelId: matchingChannel.id,
                    fileUrl,
                    fileName: item.fileName,
                    mimeType: item.mimeType,
                    source: 'whatsapp',
                    uploadedBy: `whatsapp:${senderId || 'unknown'}`,
                    authHeader: `Bearer ${waConfig.accessToken}`,
                })
                results.push(result)
            } catch (err) {
                console.error(`[WhatsApp Webhook] Failed to ingest media:`, err)
            }
        }

        // Reply with confirmation
        if (results.length > 0 && source.buildReplyPayload && senderId) {
            const reply = source.buildReplyPayload(
                waConfig,
                `✅ Received ${results.length} file(s)! AI is creating your post...`
            )
            // Set the recipient
            const replyBody = { ...reply.body as Record<string, unknown>, to: senderId }
            await fetch(reply.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${waConfig.accessToken}`,
                },
                body: JSON.stringify(replyBody),
            }).catch(() => { })
        }

        console.log(`[WhatsApp Webhook] Ingested ${results.length} media items for channel ${matchingChannel.id}`)
        return NextResponse.json({ ok: true, ingested: results.length })
    } catch (error) {
        console.error('[WhatsApp Webhook] Error:', error)
        return NextResponse.json({ ok: true })
    }
}
