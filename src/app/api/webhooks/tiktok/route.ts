import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * TikTok Webhook Handler
 *
 * GET  — TikTok sends a challenge param for URL verification.
 *         We must echo it back as plain text.
 *
 * POST — TikTok sends real-time events:
 *         • post.publish.complete  — video finished publishing
 *         • video.status_update    — legacy video status tracking
 *         • authorization.removed  — user revoked app access
 */

// ─── GET: URL Verification ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const challenge = req.nextUrl.searchParams.get('challenge')
    if (challenge) {
        // TikTok requires plain text response with the challenge value
        return new Response(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        })
    }
    return NextResponse.json({ ok: true })
}

// ─── POST: Event Handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.text()
        const payload = JSON.parse(body)

        // Log raw event for debugging
        console.log('[TikTok Webhook]', JSON.stringify(payload, null, 2))

        const eventType: string = payload.event ?? payload.type ?? ''

        // ── post.publish.complete ────────────────────────────────────────────
        // Fired when TikTok finishes processing and publishing the video
        if (eventType === 'post.publish.complete') {
            await handlePublishComplete(payload)
        }

        // ── post.publish.failed ──────────────────────────────────────────────
        // Fired when TikTok fails to pull/process the video (e.g. reason=internal)
        if (eventType === 'post.publish.failed') {
            await handlePublishFailed(payload)
        }

        // ── video.status_update (legacy / non-sandbox) ──────────────────────
        if (eventType === 'video.status_update') {
            await handleVideoStatusUpdate(payload)
        }

        // ── authorization.removed ───────────────────────────────────────────
        // Fired when user revokes app access from TikTok
        if (eventType === 'authorization.removed') {
            await handleAuthorizationRemoved(payload)
        }

        return NextResponse.json({ received: true })
    } catch (err) {
        console.error('[TikTok Webhook] Error:', err)
        return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/**
 * post.publish.complete
 * Payload: { client_key, event, create_time, user_openid, content: JSON string }
 * content: { publish_id, publish_type }
 */
async function handlePublishComplete(payload: {
    content?: string
    user_openid?: string
}) {
    let publishId: string | undefined
    try {
        const content = JSON.parse(payload.content ?? '{}')
        publishId = content.publish_id
    } catch {
        console.warn('[TikTok Webhook] Failed to parse content field')
        return
    }

    if (!publishId) {
        console.warn('[TikTok Webhook] post.publish.complete: no publish_id')
        return
    }

    console.log('[TikTok Webhook] publish.complete for publish_id:', publishId)

    try {
        // Update platform status to PUBLISHED
        await prisma.postPlatformStatus.updateMany({
            where: {
                platform: 'tiktok',
                externalId: publishId,
            },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(),
            },
        })

        // Update parent post status too
        const record = await prisma.postPlatformStatus.findFirst({
            where: { platform: 'tiktok', externalId: publishId },
            select: { postId: true },
        })
        if (record?.postId) {
            await prisma.post.update({
                where: { id: record.postId },
                data: { status: 'PUBLISHED', publishedAt: new Date() },
            })
            console.log('[TikTok Webhook] Post', record.postId, 'marked PUBLISHED')
        }
    } catch (err) {
        console.error('[TikTok Webhook] DB update failed:', err)
    }
}

/**
 * post.publish.failed
 * Fired when TikTok cannot pull/process the video from the URL.
 * Payload: { client_key, event, create_time, user_openid, content: JSON string }
 * content: { publish_id, publish_type, reason }
 *   reason can be: "internal", "permission_denied", "video_pull_failed", etc.
 */
async function handlePublishFailed(payload: {
    content?: string
    user_openid?: string
}) {
    let publishId: string | undefined
    let reason: string | undefined
    try {
        const content = JSON.parse(payload.content ?? '{}')
        publishId = content.publish_id
        reason = content.reason
    } catch {
        console.warn('[TikTok Webhook] post.publish.failed: failed to parse content field')
        return
    }

    if (!publishId) {
        console.warn('[TikTok Webhook] post.publish.failed: no publish_id')
        return
    }

    const errorMessage = `TikTok publishing failed (reason: ${reason || 'unknown'}).`
    console.error('[TikTok Webhook] post.publish.failed — publish_id:', publishId, 'reason:', reason)

    try {
        // Mark postPlatformStatus as FAILED
        await prisma.postPlatformStatus.updateMany({
            where: { platform: 'tiktok', externalId: publishId },
            data: {
                status: 'FAILED',
                errorMsg: errorMessage,
            },
        })

        // Find parent post and mark as FAILED; also clear cached tiktokUrl
        // so the next publish attempt re-transcodes a fresh file instead of
        // reusing the broken cached URL.
        const record = await prisma.postPlatformStatus.findFirst({
            where: { platform: 'tiktok', externalId: publishId },
            select: { postId: true },
        })
        if (record?.postId) {
            await prisma.post.update({
                where: { id: record.postId },
                data: { status: 'FAILED' },
            })
            console.log('[TikTok Webhook] Post', record.postId, 'marked FAILED (reason:', reason, ')')

            // Clear tiktokUrl cache on all media items attached to this post
            // so the next attempt re-transcodes from scratch rather than
            // reusing the broken cached URL.
            const mediaItems = await prisma.postMedia.findMany({
                where: { postId: record.postId },
                select: { mediaItemId: true },
            })
            const mediaItemIds = mediaItems.map(m => m.mediaItemId)
            if (mediaItemIds.length > 0) {
                await prisma.mediaItem.updateMany({
                    where: { id: { in: mediaItemIds } },
                    data: { tiktokUrl: null } as any,
                }).catch((e: unknown) => console.warn('[TikTok Webhook] Could not clear tiktokUrl cache:', e))
            }
        }
    } catch (err) {
        console.error('[TikTok Webhook] DB update failed:', err)
    }
}


/**
 * video.status_update (legacy format)
 * Payload: { data: { video_id, status, error_code, error_message } }
 */

async function handleVideoStatusUpdate(payload: {
    data?: {
        video_id?: string
        status?: string
        error_code?: number
        error_message?: string
    }
}) {
    const { video_id, status, error_message } = payload.data ?? {}
    if (!video_id || !status) return

    // Map TikTok status → our platform status
    const platformStatus =
        status === 'PUBLISHED' ? 'PUBLISHED'
            : status === 'FAILED' ? 'FAILED'
                : 'PROCESSING'

    try {
        await prisma.postPlatformStatus.updateMany({
            where: {
                platform: 'tiktok',
                externalId: video_id,
            },
            data: {
                status: platformStatus,
                ...(platformStatus === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
                ...(error_message ? { errorMessage: error_message } : {}),
            },
        })

        // Also update parent post status if now published
        if (platformStatus === 'PUBLISHED') {
            const record = await prisma.postPlatformStatus.findFirst({
                where: { platform: 'tiktok', externalId: video_id },
                select: { postId: true },
            })
            if (record?.postId) {
                await prisma.post.update({
                    where: { id: record.postId },
                    data: { status: 'PUBLISHED', publishedAt: new Date() },
                })
            }
        }
    } catch (err) {
        console.error('[TikTok Webhook] DB update failed:', err)
    }
}

/**
 * authorization.removed
 * Fired when user revokes app access from TikTok settings.
 * Payload: { client_key, event, create_time, user_openid, content: JSON string }
 * content: { reason: number }
 *   0=Unknown, 1=User disconnect, 2=Account deleted, 3=Age changed, 4=Banned, 5=Developer revoke
 */
async function handleAuthorizationRemoved(payload: {
    user_openid?: string
    content?: string
}) {
    const openId = payload.user_openid
    if (!openId) {
        console.warn('[TikTok Webhook] authorization.removed: no user_openid')
        return
    }

    let reason = 0
    try {
        const content = JSON.parse(payload.content ?? '{}')
        reason = content.reason ?? 0
    } catch { /* ignore */ }

    const reasonLabels: Record<number, string> = {
        0: 'Unknown',
        1: 'User disconnected from TikTok',
        2: 'Account deleted',
        3: 'Age changed',
        4: 'Account banned',
        5: 'Developer revoked',
    }

    console.log(`[TikTok Webhook] authorization.removed — openId: ${openId}, reason: ${reasonLabels[reason] || reason}`)

    try {
        // Deactivate all TikTok platform accounts matching this openId
        const result = await prisma.channelPlatform.updateMany({
            where: {
                platform: 'tiktok',
                accountId: openId,
            },
            data: {
                isActive: false,
                accessToken: null,
                refreshToken: null,
                tokenExpiresAt: null,
            },
        })

        if (result.count > 0) {
            console.log(`[TikTok Webhook] Deactivated ${result.count} TikTok account(s) for openId ${openId}`)
        } else {
            console.log(`[TikTok Webhook] No TikTok accounts found for openId ${openId}`)
        }
    } catch (err) {
        console.error('[TikTok Webhook] Failed to deactivate account:', err)
    }
}
