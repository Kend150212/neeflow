import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPinterestApiBase } from '@/lib/pinterest'
import { sendPublishWebhooks } from '@/lib/webhook-notify'
import crypto from 'crypto'

// ─── Types ───────────────────────────────────────────────────────────

interface MediaInfo {
    url: string
    type: string // 'image' | 'video' from database
    originalName?: string
}

// ─── Platform publishers ─────────────────────────────────────────────

function isVideoMedia(media: MediaInfo): boolean {
    // Primary: trust the database type field
    if (media.type === 'video') return true
    // Fallback: check extension in URL or originalName
    const str = (media.originalName || media.url || '').toLowerCase()
    return /\.(mp4|mov|webm|avi|mkv|ogg|3gp|flv|wmv|mpeg)(\?|$)/i.test(str)
}

async function publishToFacebook(
    accessToken: string,
    accountId: string,
    content: string,
    mediaItems: MediaInfo[],
    postType: string,
    config?: Record<string, unknown>,
): Promise<{ externalId: string }> {
    // Facebook Graph API — Post to Page
    const carousel = config?.carousel === true

    // ── Reel: use /video_reels endpoint (2-phase: start → finish) ──
    if (postType === 'reel') {
        const videoMedia = mediaItems.find(m => isVideoMedia(m))
        if (!videoMedia) throw new Error('Reels require a video attachment')
        const reelUrl = `https://graph.facebook.com/v21.0/${accountId}/video_reels`

        // Phase 1: START — get a video_id
        const startRes = await fetch(reelUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                upload_phase: 'start',
                access_token: accessToken,
            }),
        })
        const startData = await startRes.json()
        if (startData.error) throw new Error(startData.error.message || 'Facebook Reel start error')
        const videoId = startData.video_id
        if (!videoId) throw new Error('Facebook Reel start did not return video_id')
        console.log(`[Facebook] Reel start: video_id=${videoId}`)

        // Phase 2: FINISH — provide video_url + video_id + description
        const finishRes = await fetch(reelUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                upload_phase: 'finish',
                video_id: videoId,
                video_url: videoMedia.url,
                description: content,
                access_token: accessToken,
            }),
        })
        const finishData = await finishRes.json()
        if (finishData.error) throw new Error(finishData.error.message || 'Facebook Reel finish error')
        const postId = finishData.id || finishData.post_id || finishData.success?.toString()
        console.log(`[Facebook] ✅ Reel published successfully: ${postId}`)
        return { externalId: postId || videoId }
    }

    if (mediaItems.length > 0 && postType !== 'story') {
        const videoItems = mediaItems.filter(m => isVideoMedia(m))
        const imageItems = mediaItems.filter(m => !isVideoMedia(m))

        if (videoItems.length > 0) {
            // ── Video takes priority (FB doesn't support image+video carousel) ──
            const videoMedia = videoItems[0]
            if (imageItems.length > 0) {
                console.log(`[Facebook] Mixed media: posting video, skipping ${imageItems.length} image(s) (FB doesn't support mixed carousel)`)
            }
            const videoUrl = `https://graph.facebook.com/v21.0/${accountId}/videos`
            const videoBody: Record<string, string> = {
                description: content,
                file_url: videoMedia.url,
                access_token: accessToken,
            }
            const res = await fetch(videoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(videoBody),
            })
            const data = await res.json()
            if (data.error) {
                throw new Error(data.error.message || 'Facebook video upload error')
            }
            const postId = data.id || data.post_id
            return { externalId: postId }
        } else if (imageItems.length > 1) {
            // Auto-carousel when 2+ images
            console.log(`[Facebook] Multi-photo carousel with ${imageItems.length} images`)
            // ── Carousel: upload each photo unpublished, then batch ──
            const photoIds: string[] = []
            for (let i = 0; i < imageItems.length; i++) {
                const media = imageItems[i]
                console.log(`[Facebook] Uploading photo ${i + 1}/${imageItems.length}: ${media.url.slice(0, 80)}...`)
                const photoUrl = `https://graph.facebook.com/v21.0/${accountId}/photos`
                const photoBody: Record<string, string | boolean> = {
                    url: media.url,
                    published: 'false',
                    access_token: accessToken,
                }
                const res = await fetch(photoUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(photoBody),
                })
                const data = await res.json()
                if (data.error) throw new Error(data.error.message || `Facebook carousel photo ${i + 1} error`)
                if (data.id) {
                    photoIds.push(data.id)
                    console.log(`[Facebook] Photo ${i + 1} uploaded: ${data.id}`)
                }
            }
            // Batch publish — use form-encoded params (Facebook Graph API requirement)
            console.log(`[Facebook] Publishing carousel with ${photoIds.length} photos`)
            const feedUrl = `https://graph.facebook.com/v21.0/${accountId}/feed`
            const params = new URLSearchParams()
            params.append('message', content)
            params.append('access_token', accessToken)
            photoIds.forEach((pid, i) => {
                params.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: pid }))
            })
            const res = await fetch(feedUrl, {
                method: 'POST',
                body: params,
            })
            const data = await res.json()
            console.log(`[Facebook] Carousel publish result:`, JSON.stringify(data).slice(0, 200))
            if (data.error) throw new Error(data.error.message || 'Facebook carousel publish error')
            const postId = data.id
            return { externalId: postId }
        } else {
            // ── Single Image: use /photos endpoint ──
            const photoUrl = `https://graph.facebook.com/v21.0/${accountId}/photos`
            const photoBody: Record<string, string> = {
                caption: content,
                url: imageItems[0].url,
                access_token: accessToken,
            }
            const res = await fetch(photoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(photoBody),
            })
            const data = await res.json()
            if (data.error) {
                throw new Error(data.error.message || 'Facebook photo upload error')
            }
            const postId = data.id || data.post_id
            return { externalId: postId }
        }
    }

    // ── Text-only post: use /feed endpoint ──
    const url = `https://graph.facebook.com/v21.0/${accountId}/feed`
    const body: Record<string, string> = {
        message: content,
        access_token: accessToken,
    }
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) {
        throw new Error(data.error.message || 'Facebook API error')
    }
    const postId = data.id
    return { externalId: postId }
}

/** Post a first comment on a Facebook post */
async function postFirstComment(accessToken: string, postId: string, message: string) {
    // Retry a few times with delay — reels/videos may need processing time
    const maxRetries = 3
    const delayMs = 3000
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs))
            }
            const res = await fetch(`https://graph.facebook.com/v21.0/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, access_token: accessToken }),
            })
            const data = await res.json()
            if (data.error) {
                console.warn(`[FirstComment] Attempt ${attempt + 1}/${maxRetries} failed:`, data.error.message, `(code: ${data.error.code})`)
                // If it's a "page not found" or similar non-retryable error, stop
                if (data.error.code === 100 || data.error.code === 190) {
                    console.error(`[FirstComment] Non-retryable error, stopping.`)
                    return
                }
                continue
            }
            console.log(`[FirstComment] Successfully posted comment on ${postId}`)
            return
        } catch (err) {
            console.warn(`[FirstComment] Network error attempt ${attempt + 1}:`, err)
        }
    }
    console.error(`[FirstComment] All ${maxRetries} attempts failed for post ${postId}`)
}

async function publishToInstagram(
    accessToken: string,
    accountId: string,
    content: string,
    mediaItems: MediaInfo[],
    config?: Record<string, unknown>,
): Promise<{ externalId: string }> {
    if (mediaItems.length === 0) {
        throw new Error('Instagram requires at least one image or video')
    }

    // Validate media formats — Instagram rejects WebP, BMP, SVG, TIFF
    const unsupportedFormats = ['.webp', '.bmp', '.svg', '.tiff', '.tif', '.gif']
    for (const media of mediaItems) {
        const urlLower = (media.originalName || media.url || '').toLowerCase()
        const unsupported = unsupportedFormats.find(fmt => urlLower.includes(fmt))
        if (unsupported) {
            throw new Error(`Instagram does not support ${unsupported.toUpperCase().replace('.', '')} images. Please use JPEG or PNG format.`)
        }
    }

    console.log(`[Instagram] Publishing to ${accountId} with ${mediaItems.length} media item(s):`)
    mediaItems.forEach((m, i) => console.log(`[Instagram]   Media ${i + 1}: type=${m.type}, url=${m.url.substring(0, 120)}...`))

    const postType = (config?.postType as string) || 'feed'
    const collaborators = (config?.collaborators as string) || ''
    const collaboratorUsernames = collaborators
        .split(',')
        .map(c => c.trim().replace(/^@/, ''))
        .filter(Boolean)
        .slice(0, 3)

    // ── Story: use STORIES media type ──
    if (postType === 'story') {
        const firstMedia = mediaItems[0]
        if (isVideoMedia(firstMedia)) {
            // Use resumable upload for video stories
            return await igResumablePublish(accessToken, accountId, '', firstMedia, 'STORIES')
        }
        // Image story — use video_url/image_url as before
        const containerBody: Record<string, string> = {
            media_type: 'STORIES',
            image_url: firstMedia.url,
            access_token: accessToken,
        }
        const containerRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(containerBody),
        })
        const containerData = await containerRes.json()
        if (containerData.error) throw new Error(containerData.error.message || 'Instagram Story creation failed')
        await waitForIgContainer(accessToken, containerData.id)
        const publishRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
        })
        const publishData = await publishRes.json()
        if (publishData.error) throw new Error(publishData.error.message || 'Instagram Story publish failed')
        return { externalId: publishData.id }
    }

    // ── Reel: use REELS media type with resumable upload ──
    if (postType === 'reel') {
        const videoMedia = mediaItems.find(m => isVideoMedia(m))
        if (!videoMedia) throw new Error('Reels require a video attachment')
        return await igResumablePublish(accessToken, accountId, content, videoMedia, 'REELS', collaboratorUsernames)
    }

    // ── Carousel: multiple images/videos ──
    if (mediaItems.length > 1) {
        console.log(`[Instagram] Creating carousel with ${mediaItems.length} items`)
        const childIds: string[] = []
        const skippedItems: string[] = []
        for (let i = 0; i < mediaItems.length; i++) {
            const media = mediaItems[i]
            try {
                if (isVideoMedia(media)) {
                    // Use resumable upload for carousel videos
                    console.log(`[Instagram] Carousel item ${i + 1}/${mediaItems.length}: uploading video via resumable...`)
                    const result = await igResumableCreateChild(accessToken, accountId, media)
                    childIds.push(result.containerId)
                    console.log(`[Instagram] Carousel item ${i + 1}: video container ${result.containerId} created`)
                } else {
                    console.log(`[Instagram] Carousel item ${i + 1}/${mediaItems.length}: creating image container...`)
                    const childBody: Record<string, string> = {
                        is_carousel_item: 'true',
                        image_url: media.url,
                        access_token: accessToken,
                    }
                    const childRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(childBody),
                    })
                    const childData = await childRes.json()
                    if (childData.error) throw new Error(childData.error.message || `Instagram carousel item ${i + 1} creation failed`)
                    await waitForIgContainer(accessToken, childData.id)
                    childIds.push(childData.id)
                    console.log(`[Instagram] Carousel item ${i + 1}: image container ${childData.id} ready`)
                }
            } catch (itemErr) {
                // Skip failed items — carousel can still work with remaining items
                const name = (media as { originalName?: string }).originalName || `item ${i + 1}`
                console.warn(`[Instagram] ⚠️ Carousel item ${i + 1} (${name}) failed, skipping: ${itemErr instanceof Error ? itemErr.message : itemErr}`)
                skippedItems.push(name)
            }
        }

        // Need at least 2 items for carousel
        if (childIds.length < 2) {
            if (childIds.length === 0) {
                throw new Error(`Instagram carousel: all ${mediaItems.length} items failed to process.${skippedItems.length > 0 ? ` Skipped: ${skippedItems.join(', ')}` : ''}`)
            }
            // Only 1 item succeeded — can't do carousel, throw with info
            throw new Error(`Instagram carousel: only 1 of ${mediaItems.length} items succeeded (need at least 2). Skipped: ${skippedItems.join(', ')}`)
        }

        if (skippedItems.length > 0) {
            console.log(`[Instagram] ⚠️ Skipped ${skippedItems.length} item(s): ${skippedItems.join(', ')}. Publishing carousel with ${childIds.length} items.`)
        }

        console.log(`[Instagram] ${childIds.length} carousel children ready, creating carousel container...`)
        const containerUrl = `https://graph.facebook.com/v21.0/${accountId}/media`
        const containerBody: Record<string, unknown> = {
            media_type: 'CAROUSEL',
            children: childIds,
            caption: content,
            access_token: accessToken,
        }
        if (collaboratorUsernames.length > 0) {
            containerBody.collaborators = collaboratorUsernames
        }
        const containerRes = await fetch(containerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(containerBody),
        })
        const containerData = await containerRes.json()
        if (containerData.error) throw new Error(containerData.error.message || 'Instagram carousel container creation failed')
        const publishRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
        })
        const publishData = await publishRes.json()
        if (publishData.error) throw new Error(publishData.error.message || 'Instagram carousel publish failed')
        return { externalId: publishData.id }
    }

    // ── Single image/video feed post ──
    const firstMedia = mediaItems[0]
    if (isVideoMedia(firstMedia)) {
        // Instagram deprecated VIDEO type — all videos are now REELS (even for feed)
        console.log(`[Instagram] Video detected in feed post — auto-switching to REELS media type`)
        return await igResumablePublish(accessToken, accountId, content, firstMedia, 'REELS', collaboratorUsernames)
    }

    const containerUrl = `https://graph.facebook.com/v21.0/${accountId}/media`
    const containerBody: Record<string, unknown> = {
        caption: content,
        image_url: firstMedia.url,
        access_token: accessToken,
    }
    if (collaboratorUsernames.length > 0) {
        containerBody.collaborators = collaboratorUsernames
    }

    const containerRes = await fetch(containerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
    })
    const containerData = await containerRes.json()
    if (containerData.error) {
        throw new Error(containerData.error.message || 'Instagram container creation failed')
    }

    // Wait for container to be ready
    await waitForIgContainer(accessToken, containerData.id)

    // Publish
    const publishUrl = `https://graph.facebook.com/v21.0/${accountId}/media_publish`
    const publishRes = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creation_id: containerData.id,
            access_token: accessToken,
        }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) {
        throw new Error(publishData.error.message || 'Instagram publish failed')
    }
    return { externalId: publishData.id }
}

/** Instagram error code descriptions */
const igErrorCodes: Record<string, string> = {
    '2207001': 'Unknown Instagram error. Please try again.',
    '2207002': 'The media could not be saved. Please try again.',
    '2207003': 'Instagram rate limit reached. Please wait a few minutes and try again.',
    '2207009': 'Instagram server error. Please try again later.',
    '2207026': 'Instagram session expired. Please reconnect your Instagram account.',
    '2207050': 'Video aspect ratio is not supported for this post type. Reels require 9:16 (vertical).',
    '2207051': 'Video duration is invalid. Reels: 3s-90s. Stories: max 60s.',
    '2207076': 'Media download failed — Instagram could not fetch your file. The URL may be inaccessible.',
    '2207082': 'Media upload timed out — the file is too large or download was too slow.',
    '2207085': 'Unsupported video format or aspect ratio. Use MP4/MOV (H.264) with 9:16 for Reels, or 1:1/4:5/16:9 for Feed.',
}

/** Extract error code from Instagram error message */
function getIgErrorDescription(statusMessage: string): string {
    const codeMatch = statusMessage.match(/(\d{7})/)
    if (codeMatch) {
        const description = igErrorCodes[codeMatch[1]]
        if (description) return description
    }
    return statusMessage
}

/** Wait for Instagram media container to finish processing (videos especially) */
async function waitForIgContainer(accessToken: string, containerId: string, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${accessToken}`)
        const data = await res.json()
        console.log(`[Instagram] Container ${containerId} status: ${data.status_code || 'IN_PROGRESS'} (attempt ${i + 1}/${maxAttempts})`)
        if (data.status_code === 'FINISHED') return
        if (data.status_code === 'ERROR') {
            const rawDetail = data.status || 'Unknown error'
            const friendlyDetail = getIgErrorDescription(rawDetail)
            console.error(`[Instagram] Container processing ERROR: ${rawDetail}`)
            console.error(`[Instagram] → ${friendlyDetail}`)
            throw new Error(`Instagram: ${friendlyDetail}`)
        }
        await new Promise(resolve => setTimeout(resolve, 2000)) // wait 2s
    }
    throw new Error('Instagram: Video processing timed out (60s). Your video may be too large or in an unsupported format. Try using MP4/MOV (H.264) under 100MB.')
}

/**
 * Instagram Resumable Upload — upload video bytes directly to IG servers.
 * Same pattern as YouTube: download video → upload bytes → publish.
 *
 * Steps:
 * 1. Download video from URL (proxy or direct)
 * 2. Create media container with upload_type=resumable
 * 3. Upload video bytes to rupload.facebook.com
 * 4. Wait for container processing
 * 5. Publish
 */
async function igResumablePublish(
    accessToken: string,
    accountId: string,
    caption: string,
    videoMedia: MediaInfo,
    mediaType: 'REELS' | 'STORIES',
    collaboratorUsernames?: string[],
): Promise<{ externalId: string }> {
    // Step 1: Download video bytes
    console.log(`[Instagram] Resumable upload: downloading video from ${videoMedia.url.substring(0, 80)}...`)
    const videoRes = await fetch(videoMedia.url)
    if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.statusText}`)
    const videoBuffer = await videoRes.arrayBuffer()
    const fileSize = videoBuffer.byteLength
    console.log(`[Instagram] Resumable upload: downloaded ${(fileSize / 1024 / 1024).toFixed(1)}MB`)

    // Step 2: Create container with upload_type=resumable
    const containerBody: Record<string, unknown> = {
        media_type: mediaType,
        upload_type: 'resumable',
        access_token: accessToken,
    }
    if (caption) containerBody.caption = caption
    if (collaboratorUsernames && collaboratorUsernames.length > 0) {
        containerBody.collaborators = collaboratorUsernames
    }
    const containerRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
    })
    const containerData = await containerRes.json()
    if (containerData.error) throw new Error(containerData.error.message || 'Instagram container creation failed')
    const containerId = containerData.id
    console.log(`[Instagram] Resumable upload: container ${containerId} created`)

    // Step 3: Upload video bytes to rupload.facebook.com
    console.log(`[Instagram] Resumable upload: uploading ${(fileSize / 1024 / 1024).toFixed(1)}MB to rupload.facebook.com...`)
    const uploadRes = await fetch(`https://rupload.facebook.com/ig-api-upload/${containerId}`, {
        method: 'POST',
        headers: {
            'Authorization': `OAuth ${accessToken}`,
            'offset': '0',
            'file_size': String(fileSize),
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(fileSize),
        },
        body: videoBuffer,
    })
    if (!uploadRes.ok) {
        const errText = await uploadRes.text()
        console.error(`[Instagram] Resumable upload failed: ${uploadRes.status} ${errText}`)
        throw new Error(`Instagram video upload failed: ${uploadRes.status}`)
    }
    console.log(`[Instagram] Resumable upload: upload complete`)

    // Step 4: Wait for container processing
    await waitForIgContainer(accessToken, containerId)

    // Step 5: Publish
    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) throw new Error(publishData.error.message || 'Instagram publish failed')
    console.log(`[Instagram] ✅ Resumable upload published successfully: ${publishData.id}`)
    return { externalId: publishData.id }
}

/** Create a carousel child video using resumable upload */
async function igResumableCreateChild(
    accessToken: string,
    accountId: string,
    videoMedia: MediaInfo,
): Promise<{ containerId: string }> {
    const videoRes = await fetch(videoMedia.url)
    if (!videoRes.ok) throw new Error(`Failed to download carousel video: ${videoRes.statusText}`)
    const videoBuffer = await videoRes.arrayBuffer()
    const fileSize = videoBuffer.byteLength

    const containerRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            is_carousel_item: 'true',
            media_type: 'VIDEO',
            upload_type: 'resumable',
            access_token: accessToken,
        }),
    })
    const containerData = await containerRes.json()
    if (containerData.error) throw new Error(containerData.error.message || 'Instagram carousel video creation failed')

    const uploadRes = await fetch(`https://rupload.facebook.com/ig-api-upload/${containerData.id}`, {
        method: 'POST',
        headers: {
            'Authorization': `OAuth ${accessToken}`,
            'offset': '0',
            'file_size': String(fileSize),
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(fileSize),
        },
        body: videoBuffer,
    })
    if (!uploadRes.ok) {
        const errBody = await uploadRes.text().catch(() => '')
        console.error(`[Instagram] Carousel video upload failed: ${uploadRes.status}`, errBody)
        throw new Error(`Instagram carousel video upload failed: ${uploadRes.status} — ${errBody || 'unknown error'}`)
    }

    await waitForIgContainer(accessToken, containerData.id)
    return { containerId: containerData.id }
}

// ─── YouTube token refresh ──────────────────────────────────────────

async function refreshYouTubeToken(refreshToken: string): Promise<string> {
    // Read YouTube OAuth credentials from database
    const { decrypt } = await import('@/lib/encryption')
    const integration = await prisma.apiIntegration.findFirst({
        where: { provider: 'youtube' },
    })
    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.youtubeClientId || process.env.GOOGLE_CLIENT_ID || ''
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''

    if (integration?.apiKeyEncrypted) {
        try {
            clientSecret = decrypt(integration.apiKeyEncrypted)
        } catch {
            clientSecret = integration.apiKeyEncrypted
        }
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`YouTube token refresh failed: ${err}`)
    }

    const data = await res.json()
    return data.access_token
}

// ─── YouTube publisher ──────────────────────────────────────────────

async function publishToYouTube(
    accessToken: string,
    refreshToken: string | null,
    accountId: string,
    content: string,
    mediaItems: MediaInfo[],
    platformId: string,
    config?: Record<string, unknown>,
): Promise<{ externalId: string }> {
    // YouTube requires a video
    const videoMedia = mediaItems.find((m) => isVideoMedia(m))
    if (!videoMedia) {
        throw new Error('YouTube requires a video. Please attach a video to your post.')
    }

    // Read config values
    const ytPostType = (config?.postType as string) || 'video'
    const ytVideoTitle = (config?.videoTitle as string) || ''
    const ytCategory = (config?.category as string) || ''
    const ytTags = (config?.tags as string) || ''
    const ytPrivacy = (config?.privacy as string) || 'public'
    const ytNotifySubscribers = config?.notifySubscribers !== false
    const ytMadeForKids = config?.madeForKids === true

    // YouTube category ID mapping
    const categoryMap: Record<string, string> = {
        'Film & Animation': '1', 'Autos & Vehicles': '2', 'Music': '10', 'Pets & Animals': '15',
        'Sports': '17', 'Travel & Events': '19', 'Gaming': '20', 'People & Blogs': '22',
        'Comedy': '23', 'Entertainment': '24', 'News & Politics': '25', 'Howto & Style': '26',
        'Education': '27', 'Science & Technology': '28', 'Nonprofits & Activism': '29',
    }
    const categoryId = categoryMap[ytCategory] || '22' // Default to People & Blogs

    // Refresh token if we have a refresh token
    let token = accessToken
    if (refreshToken) {
        try {
            token = await refreshYouTubeToken(refreshToken)
            // Update stored access token
            await prisma.channelPlatform.update({
                where: { id: platformId },
                data: { accessToken: token, tokenExpiresAt: new Date(Date.now() + 3600 * 1000) },
            })
        } catch (err) {
            console.warn('YouTube token refresh failed, using existing token:', err)
        }
    }

    // Get title: from config, or from first line of content, or 'Untitled'
    const lines = content.split('\n')
    const title = (ytVideoTitle || lines[0] || 'Untitled').slice(0, 100)
    const description = ytVideoTitle ? content : (lines.slice(1).join('\n').trim() || content)

    // Parse tags
    const tags = ytTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

    // For Shorts, add #Shorts tag if not present
    if (ytPostType === 'shorts' && !tags.some(t => t.toLowerCase() === 'shorts' || t.toLowerCase() === '#shorts')) {
        tags.push('Shorts')
    }

    // Step 1: Download the video file from URL
    const videoRes = await fetch(videoMedia.url)
    if (!videoRes.ok) {
        throw new Error(`Failed to download video: ${videoRes.statusText}`)
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
    const contentType = videoRes.headers.get('content-type') || 'video/mp4'

    // Step 2: Start resumable upload
    const metadata = {
        snippet: {
            title,
            description,
            categoryId,
            ...(tags.length > 0 ? { tags } : {}),
        },
        status: {
            privacyStatus: ytPrivacy,
            selfDeclaredMadeForKids: ytMadeForKids,
        },
    }

    const uploadParams = new URLSearchParams({
        uploadType: 'resumable',
        part: 'snippet,status',
        notifySubscribers: String(ytNotifySubscribers),
    })

    const initRes = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/videos?${uploadParams}`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Length': String(videoBuffer.length),
                'X-Upload-Content-Type': contentType,
            },
            body: JSON.stringify(metadata),
        }
    )

    if (!initRes.ok) {
        const err = await initRes.text()
        throw new Error(`YouTube upload init failed: ${err}`)
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) {
        throw new Error('YouTube upload: no resumable upload URL returned')
    }

    // Step 3: Upload the actual video bytes
    const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType,
            'Content-Length': String(videoBuffer.length),
        },
        body: videoBuffer,
    })

    if (!uploadRes.ok) {
        const err = await uploadRes.text()
        throw new Error(`YouTube video upload failed: ${err}`)
    }

    const uploadData = await uploadRes.json()
    return { externalId: uploadData.id }
}

// ─── Pinterest publisher ─────────────────────────────────────────────

async function publishToPinterest(
    accessToken: string,
    content: string,
    mediaItems: MediaInfo[],
    config?: Record<string, unknown>,
): Promise<{ externalId: string }> {
    // Pinterest API v5 — Create a Pin
    const pinterestBase = await getPinterestApiBase()
    let boardId = (config?.boardId as string) || ''
    const pinTitle = (config?.pinTitle as string) || ''
    const pinLink = (config?.pinLink as string) || ''

    // If no board selected, fetch user's first board
    if (!boardId) {
        const boardsRes = await fetch(`${pinterestBase}/v5/boards`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (boardsRes.ok) {
            const boardsData = await boardsRes.json()
            if (boardsData.items?.length > 0) {
                boardId = boardsData.items[0].id
            }
        }
        if (!boardId) throw new Error('No Pinterest board found. Please create a board first.')
    }

    // Build pin body
    const pinBody: Record<string, unknown> = {
        board_id: boardId,
        description: content.slice(0, 500), // Pinterest limit: 500 chars
    }
    if (pinTitle) pinBody.title = pinTitle.slice(0, 100) // Pinterest limit: 100 chars
    if (pinLink) pinBody.link = pinLink

    // Add media source — Pinterest requires an image
    const imageMedia = mediaItems.find(m => !isVideoMedia(m))
    const videoMedia = mediaItems.find(m => isVideoMedia(m))

    if (imageMedia) {
        pinBody.media_source = {
            source_type: 'image_url',
            url: imageMedia.url,
        }
    } else if (videoMedia) {
        // Video pins require a more complex flow, but try with video URL
        pinBody.media_source = {
            source_type: 'video_url',
            url: videoMedia.url,
            cover_image_url: videoMedia.url, // fallback
        }
    } else {
        // Pinterest requires an image or video — fail early with a clear message
        throw new Error('Pinterest requires an image. Please attach an image to your post before publishing to Pinterest.')
    }

    const res = await fetch(`${pinterestBase}/v5/pins`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(pinBody),
    })
    const data = await res.json()

    if (!res.ok || data.code) {
        console.error('[Pinterest] Create pin error:', JSON.stringify(data))
        throw new Error(data.message || data.error?.message || 'Pinterest publish failed')
    }

    return { externalId: data.id }
}

// ─── LinkedIn publisher ──────────────────────────────────────────────

/** Auto-generate LinkedIn API version (YYYYMM) — uses 1 month behind current date for safety */
function getLinkedInVersion(): string {
    const now = new Date()
    // Use previous month to ensure it's always an active version
    now.setMonth(now.getMonth() - 1)
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}${m}`
}

async function publishToLinkedIn(
    accessToken: string,
    accountId: string,
    content: string,
    mediaItems: MediaInfo[],
): Promise<{ externalId: string }> {
    // Determine if this is an organization or personal account
    const isOrg = accountId.startsWith('org_')
    const authorUrn = isOrg
        ? `urn:li:organization:${accountId.replace('org_', '')}`
        : `urn:li:person:${accountId}`
    console.log(`[LinkedIn] Publishing as ${isOrg ? 'organization' : 'person'}: ${authorUrn}`)

    // If we have images, upload them first
    const imageUrns: string[] = []
    for (const media of mediaItems) {
        if (isVideoMedia(media)) continue // LinkedIn video requires different flow

        try {
            // Step 1: Register image upload
            const registerRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                    'LinkedIn-Version': getLinkedInVersion(),
                    'X-Restli-Protocol-Version': '2.0.0',
                },
                body: JSON.stringify({
                    initializeUploadRequest: {
                        owner: authorUrn,
                    },
                }),
            })

            if (!registerRes.ok) {
                const errText = await registerRes.text()
                console.error('[LinkedIn] Image register failed:', errText)
                continue
            }

            const registerData = await registerRes.json()
            const uploadUrl = registerData.value?.uploadUrl
            const imageUrn = registerData.value?.image

            if (!uploadUrl || !imageUrn) {
                console.error('[LinkedIn] Missing uploadUrl or image URN')
                continue
            }

            // Step 2: Download image and upload binary to LinkedIn
            const imageRes = await fetch(media.url)
            if (!imageRes.ok) {
                console.error('[LinkedIn] Failed to download image:', media.url)
                continue
            }
            const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': imageRes.headers.get('content-type') || 'image/jpeg',
                },
                body: imageBuffer,
            })

            if (!uploadRes.ok) {
                const errText = await uploadRes.text()
                console.error('[LinkedIn] Image upload failed:', errText)
                continue
            }

            imageUrns.push(imageUrn)
        } catch (err) {
            console.error('[LinkedIn] Image upload error:', err)
        }
    }

    // Build LinkedIn post body using Community Management API
    const postBody: Record<string, unknown> = {
        author: authorUrn,
        commentary: content,
        visibility: 'PUBLIC',
        distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
    }

    // Add media content if we have uploaded images
    if (imageUrns.length === 1) {
        postBody.content = {
            media: {
                id: imageUrns[0],
            },
        }
    } else if (imageUrns.length > 1) {
        postBody.content = {
            multiImage: {
                images: imageUrns.map(urn => ({ id: urn })),
            },
        }
    }

    const res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'LinkedIn-Version': getLinkedInVersion(),
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postBody),
    })

    if (!res.ok) {
        const errText = await res.text()
        console.error('[LinkedIn] Create post error:', errText)
        throw new Error(`LinkedIn publish failed: ${errText}`)
    }

    // LinkedIn returns the post URN in x-restli-id header
    const postUrn = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || ''
    console.log('[LinkedIn] Published successfully, URN:', postUrn)

    return { externalId: postUrn }
}

// ─── TikTok publisher ───────────────────────────────────────────────

async function publishToTikTok(
    accessToken: string,
    content: string,
    mediaItems: MediaInfo[],
    config?: Record<string, unknown>,
): Promise<{ externalId: string }> {
    const postType = (config?.postType as string) || 'video'
    const publishMode = (config?.publishMode as string) || 'direct'   // 'direct' | 'inbox'
    // UI saves 'visibility', fallback to 'privacy' for backward compat
    const privacy = (config?.visibility as string) || (config?.privacy as string) || 'PUBLIC_TO_EVERYONE'
    const disableComment = config?.allowComment === false                  // allowComment=true → disable_comment=false
    const disableDuet = config?.allowDuet !== true                      // allowDuet=true → disable_duet=false
    const disableStitch = config?.allowStitch !== true                    // allowStitch=true → disable_stitch=false
    const brandedContent = config?.brandedContent === true
    const aiGenerated = config?.aiGenerated === true

    // ── Video post — FILE_UPLOAD via temp disk file ───────────────────
    // Download to /tmp → get size from disk → stream to TikTok → delete
    // This avoids holding the entire video in RAM for concurrent requests.
    if (postType === 'video') {
        const videoMedia = mediaItems.find((m) => isVideoMedia(m))
        if (!videoMedia) throw new Error('TikTok requires a video. Please attach a video to your post.')

        const fs = await import('fs')
        const fsPromises = await import('fs/promises')
        const os = await import('os')
        const path = await import('path')
        const { randomUUID } = await import('crypto')

        const tmpPath = path.join(os.tmpdir(), `tiktok-${randomUUID()}.mp4`)
        console.log('[TikTok] Downloading video to temp file:', tmpPath)

        try {
            // ── Step 1: Download → write to disk (streaming) ───────────
            const videoRes = await fetch(videoMedia.url)
            if (!videoRes.ok) throw new Error(`TikTok: failed to download video (${videoRes.status})`)

            // Stream response body to temp file
            const fileStream = fs.createWriteStream(tmpPath)
            const reader = videoRes.body!.getReader()
            await new Promise<void>((resolve, reject) => {
                const pump = async () => {
                    try {
                        while (true) {
                            const { done, value } = await reader.read()
                            if (done) { fileStream.end(); break }
                            if (!fileStream.write(value)) {
                                await new Promise<void>(r => fileStream.once('drain', r))
                            }
                        }
                        fileStream.once('finish', resolve)
                        fileStream.once('error', reject)
                    } catch (err) {
                        fileStream.destroy()
                        reject(err)
                    }
                }
                pump()
            })

            const { size: videoSize } = await fsPromises.stat(tmpPath)
            console.log(`[TikTok] Downloaded ${(videoSize / 1024 / 1024).toFixed(2)} MB`)

            // ── Step 2: Init upload ─────────────────────────────────────
            const endpoint = publishMode === 'inbox'
                ? 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/'
                : 'https://open.tiktokapis.com/v2/post/publish/video/init/'

            const initBody: Record<string, unknown> = {
                post_info: {
                    title: content.slice(0, 2200),
                    privacy_level: privacy,
                    disable_comment: disableComment,
                    disable_duet: disableDuet,
                    disable_stitch: disableStitch,
                    ...(brandedContent ? { brand_content_toggle: true } : {}),
                    ...(aiGenerated ? { ai_generated_content: true } : {}),
                },
                source_info: {
                    source: 'FILE_UPLOAD',
                    video_size: videoSize,
                    chunk_size: videoSize,
                    total_chunk_count: 1,
                },
            }

            const initRes = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify(initBody),
            })

            const initData = await initRes.json()
            console.log('[TikTok] Init response:', JSON.stringify(initData))

            // Unaudited apps (Sandbox) can only post to private accounts — auto-retry with SELF_ONLY
            if (initData.error?.code === 'unaudited_client_can_only_post_to_private_accounts') {
                console.warn('[TikTok] App not yet audited — retrying with SELF_ONLY privacy')
                initBody.post_info = {
                    ...(initBody.post_info as Record<string, unknown>),
                    privacy_level: 'SELF_ONLY',
                }
                const retryRes = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json; charset=UTF-8',
                    },
                    body: JSON.stringify(initBody),
                })
                const retryData = await retryRes.json()
                console.log('[TikTok] Retry (SELF_ONLY) response:', JSON.stringify(retryData))
                if (retryData.error?.code && retryData.error.code !== 'ok') {
                    throw new Error(retryData.error.message || `TikTok init failed: ${retryData.error.code}`)
                }
                const retryPublishId: string = retryData.data?.publish_id
                const retryUploadUrl: string = retryData.data?.upload_url
                if (!retryPublishId || !retryUploadUrl) throw new Error('TikTok: missing publish_id or upload_url (retry)')
                // Upload with new upload_url
                const retryUploadRes = await fetch(retryUploadUrl, {
                    method: 'PUT',
                    // @ts-expect-error Node.js ReadStream is valid as fetch body
                    body: fs.createReadStream(tmpPath),
                    headers: {
                        'Content-Type': 'video/mp4',
                        'Content-Length': String(videoSize),
                        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
                    },
                    duplex: 'half',
                })
                if (!retryUploadRes.ok) {
                    const errText = await retryUploadRes.text()
                    throw new Error(`TikTok video upload (retry) failed: ${retryUploadRes.status} ${errText}`)
                }
                console.log('[TikTok] Video uploaded (SELF_ONLY), publish_id:', retryPublishId)
                return { externalId: retryPublishId }
            }

            if (initData.error?.code && initData.error.code !== 'ok') {
                throw new Error(initData.error.message || `TikTok init failed: ${initData.error.code}`)
            }

            const publishId: string = initData.data?.publish_id
            const uploadUrl: string = initData.data?.upload_url
            if (!publishId || !uploadUrl) throw new Error('TikTok: missing publish_id or upload_url')

            // ── Step 3: Stream from disk to TikTok ─────────────────────
            const readStream = fs.createReadStream(tmpPath)
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                // @ts-expect-error Node.js ReadStream is valid as fetch body
                body: readStream,
                headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Length': String(videoSize),
                    'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
                },
                duplex: 'half',
            })

            if (!uploadRes.ok) {
                const errText = await uploadRes.text()
                throw new Error(`TikTok video upload failed: ${uploadRes.status} ${errText}`)
            }

            console.log('[TikTok] Video uploaded, publish_id:', publishId)
            return { externalId: publishId }

        } finally {
            // Always clean up temp file
            try { await fsPromises.unlink(tmpPath) } catch { /* already gone */ }
        }
    }

    // ── Photo/carousel post ─────────────────────────────────────────
    if (postType === 'carousel') {
        const imageItems = mediaItems.filter((m) => !isVideoMedia(m))
        if (imageItems.length === 0) throw new Error('TikTok carousel requires at least one image.')

        const photoBody: Record<string, unknown> = {
            media_type: 'PHOTO',
            post_info: {
                title: content.slice(0, 2200),
                privacy_level: privacy,
                disable_comment: disableComment,
            },
            source_info: {
                source: 'PULL_FROM_URL',
                photo_images: imageItems.slice(0, 35).map((m) => m.url),
                photo_cover_index: 0,
            },
        }

        const photoRes = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify(photoBody),
        })

        const photoData = await photoRes.json()
        console.log('[TikTok] Photo init response:', JSON.stringify(photoData))

        if (photoData.error?.code && photoData.error.code !== 'ok') {
            throw new Error(photoData.error.message || `TikTok photo init failed: ${photoData.error.code}`)
        }

        const publishId: string = photoData.data?.publish_id
        if (!publishId) throw new Error('TikTok: no publish_id returned')

        return { externalId: publishId }
    }

    throw new Error(`TikTok unsupported post type: ${postType}`)
}

// ─── Threads publisher ────────────────────────────────────────────────
async function publishToThreads(
    accessToken: string,
    accountId: string,
    content: string,
    mediaItems: MediaInfo[],
): Promise<{ externalId: string }> {
    const base = 'https://graph.threads.net/v1.0'
    const appBase = process.env.NEXTAUTH_URL || 'https://neeflow.com'

    // Google Drive URLs can't be fetched directly by Meta's servers — proxy through our domain
    function resolveMediaUrl(url: string): string {
        if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
            return `${appBase}/api/media/proxy?url=${encodeURIComponent(url)}`
        }
        return url
    }

    // Threads API: 2-step flow — create container → publish
    const imageMedia = mediaItems.find(m => !isVideoMedia(m))
    const videoMedia = mediaItems.find(m => isVideoMedia(m))

    let containerBody: Record<string, string>

    if (videoMedia) {
        // Video post
        containerBody = {
            media_type: 'VIDEO',
            video_url: resolveMediaUrl(videoMedia.url),
            text: content.slice(0, 500),
            access_token: accessToken,
        }
    } else if (imageMedia) {
        // Image post
        containerBody = {
            media_type: 'IMAGE',
            image_url: resolveMediaUrl(imageMedia.url),
            text: content.slice(0, 500),
            access_token: accessToken,
        }
    } else {
        // Text-only post
        containerBody = {
            media_type: 'TEXT',
            text: content.slice(0, 500),
            access_token: accessToken,
        }
    }

    // Step 1: Create media container via /me (token resolves correct Threads user)
    const containerRes = await fetch(`${base}/me/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
    })
    const containerData = await containerRes.json()
    console.log('[Threads] Create container response:', JSON.stringify(containerData))

    if (!containerRes.ok || containerData.error) {
        throw new Error(containerData.error?.message || `Threads container creation failed: ${JSON.stringify(containerData)}`)
    }

    const containerId = containerData.id
    if (!containerId) throw new Error('Threads: no container ID returned')

    // Step 2: Poll container status until FINISHED (required for both image and video)
    const maxAttempts = 20
    const pollIntervalMs = 3000
    let containerStatus = ''
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, pollIntervalMs))
        const statusRes = await fetch(
            `${base}/${containerId}?fields=status,error_message&access_token=${accessToken}`
        )
        const statusData = await statusRes.json()
        containerStatus = statusData.status || ''
        console.log(`[Threads] Container ${containerId} status (attempt ${i + 1}): ${containerStatus}`)
        if (containerStatus === 'FINISHED') break
        if (containerStatus === 'ERROR') {
            throw new Error(`Threads container processing failed: ${statusData.error_message || 'unknown error'}`)
        }
    }
    if (containerStatus !== 'FINISHED') {
        throw new Error(`Threads container not ready after ${maxAttempts} attempts (status: ${containerStatus})`)
    }

    // Step 3: Publish container via /me
    const publishRes = await fetch(`${base}/me/threads_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    })
    const publishData = await publishRes.json()
    console.log('[Threads] Publish response:', JSON.stringify(publishData))

    if (!publishRes.ok || publishData.error) {
        throw new Error(publishData.error?.message || `Threads publish failed: ${JSON.stringify(publishData)}`)
    }

    return { externalId: publishData.id || containerId }
}

// ─── Google Business Profile publisher ────────────────────────────────────────
async function publishToGBP(
    accessToken: string,
    locationId: string,  // e.g. "locations/987654321"
    content: string,
    mediaItems: MediaInfo[],
): Promise<{ externalId: string }> {
    // GBP Local Posts API v4
    // locationId is the full resource name: "locations/{locationId}"
    const base = 'https://mybusiness.googleapis.com/v4'

    const imageMedia = mediaItems.find(m => !isVideoMedia(m))
    const videoMedia = mediaItems.find(m => isVideoMedia(m))

    // Build the local post body
    const postBody: Record<string, unknown> = {
        summary: content.slice(0, 1500),  // GBP max 1500 chars
        topicType: 'STANDARD',
    }

    if (videoMedia) {
        postBody.media = [{
            mediaFormat: 'VIDEO',
            sourceUrl: videoMedia.url,
        }]
    } else if (imageMedia) {
        postBody.media = [{
            mediaFormat: 'PHOTO',
            sourceUrl: imageMedia.url,
        }]
    }

    const res = await fetch(`${base}/${locationId}/localPosts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(postBody),
    })

    const data = await res.json()
    console.log('[GBP] Create local post response:', JSON.stringify(data))

    if (!res.ok || data.error) {
        throw new Error(data.error?.message || `GBP post failed: ${JSON.stringify(data)}`)
    }

    return { externalId: data.name || locationId }
}

// ─── X (Twitter) ───────────────────────────────────────────────
// OAuth 1.0a signature for v1.1 Media Upload
function xOAuthSign(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerKey: string,
    consumerSecret: string,
    accessToken: string,
    accessTokenSecret: string,
): string {
    const oauthParams: Record<string, string> = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: accessToken,
        oauth_version: '1.0',
    }
    const allParams = { ...params, ...oauthParams }
    const sortedParams = Object.keys(allParams)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
        .join('&')
    const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sortedParams)].join('&')
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')
    oauthParams['oauth_signature'] = signature
    return (
        'OAuth ' +
        Object.keys(oauthParams)
            .sort()
            .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
            .join(', ')
    )
}

async function publishToX(
    credentialJson: string,
    content: string,
    mediaItems: MediaInfo[],
): Promise<{ externalId: string }> {
    let creds: { apiKey: string; apiKeySecret: string; accessToken: string; accessTokenSecret: string }
    try {
        creds = JSON.parse(credentialJson)
    } catch {
        throw new Error('Invalid X credentials format. Please reconnect your X account.')
    }
    const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = creds

    const mediaIds: string[] = []

    // Upload up to 4 images via v1.1 media/upload
    const imageItems = mediaItems.filter(m => !isVideoMedia(m)).slice(0, 4)
    for (const img of imageItems) {
        try {
            const imgRes = await fetch(img.url)
            if (!imgRes.ok) continue
            const imgBuf = Buffer.from(await imgRes.arrayBuffer())
            const b64 = imgBuf.toString('base64')
            const totalBytes = imgBuf.length
            const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'

            // INIT
            const initUrl = 'https://upload.twitter.com/1.1/media/upload.json'
            const initParams = { command: 'INIT', total_bytes: totalBytes.toString(), media_type: mimeType, media_category: 'tweet_image' }
            const initAuth = xOAuthSign('POST', initUrl, initParams, apiKey, apiKeySecret, accessToken, accessTokenSecret)
            const initRes = await fetch(initUrl, {
                method: 'POST',
                headers: { Authorization: initAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(initParams),
            })
            if (!initRes.ok) continue
            const initData = await initRes.json()
            const mediaId = initData.media_id_string
            if (!mediaId) continue

            // APPEND
            const appendParams = { command: 'APPEND', media_id: mediaId, media_data: b64, segment_index: '0' }
            const appendAuth = xOAuthSign('POST', initUrl, {}, apiKey, apiKeySecret, accessToken, accessTokenSecret)
            await fetch(initUrl, {
                method: 'POST',
                headers: { Authorization: appendAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(appendParams),
            })

            // FINALIZE
            const finalParams = { command: 'FINALIZE', media_id: mediaId }
            const finalAuth = xOAuthSign('POST', initUrl, finalParams, apiKey, apiKeySecret, accessToken, accessTokenSecret)
            const finalRes = await fetch(initUrl, {
                method: 'POST',
                headers: { Authorization: finalAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(finalParams),
            })
            if (finalRes.ok) mediaIds.push(mediaId)
        } catch { /* skip image */ }
    }

    // Post tweet via v2
    const tweetUrl = 'https://api.twitter.com/2/tweets'
    const body: Record<string, unknown> = { text: content.slice(0, 280) }
    if (mediaIds.length > 0) body.media = { media_ids: mediaIds }

    const tweetAuth = xOAuthSign('POST', tweetUrl, {}, apiKey, apiKeySecret, accessToken, accessTokenSecret)
    const tweetRes = await fetch(tweetUrl, {
        method: 'POST',
        headers: { Authorization: tweetAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    if (!tweetRes.ok) {
        const err = await tweetRes.json().catch(() => ({}))
        const msg = err.detail || err.title || (err.errors as { message: string }[])?.[0]?.message || 'Failed to post tweet'
        throw new Error(msg)
    }

    const tweetData = await tweetRes.json()
    return { externalId: tweetData.data?.id || 'x-tweet' }
}

// ─── Bluesky ─────────────────────────────────────────────────────────
async function publishToBluesky(
    accessToken: string,
    refreshToken: string | null,
    platformId: string,
    content: string,
    mediaItems: MediaInfo[],
): Promise<{ externalId: string }> {
    // Auto-refresh session if token might be expired
    let token = accessToken
    try {
        if (refreshToken) {
            const refreshRes = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
                method: 'POST',
                headers: { Authorization: `Bearer ${refreshToken}` },
            })
            if (refreshRes.ok) {
                const refreshData = await refreshRes.json()
                if (refreshData.accessJwt) {
                    token = refreshData.accessJwt
                    await prisma.channelPlatform.update({
                        where: { id: platformId },
                        data: { accessToken: token, refreshToken: refreshData.refreshJwt, tokenExpiresAt: new Date(Date.now() + 90 * 60 * 1000) },
                    })
                }
            }
        }
    } catch { /* use existing token */ }

    // Get the DID from the token (it's a JWT — decode payload)
    const parts = token.split('.')
    if (parts.length < 2) throw new Error('Invalid Bluesky JWT')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    const did = payload.sub
    if (!did) throw new Error('Could not determine DID from Bluesky token')

    const record: Record<string, unknown> = {
        $type: 'app.bsky.feed.post',
        text: content.slice(0, 300), // Bluesky max 300 graphemes
        createdAt: new Date().toISOString(),
    }

    // Attach images if present (max 4 images)
    const imageItems = mediaItems.filter(m => !isVideoMedia(m)).slice(0, 4)
    if (imageItems.length > 0) {
        const blobs = []
        for (const img of imageItems) {
            // Download image and upload as blob
            const imgRes = await fetch(img.url)
            if (!imgRes.ok) continue
            const imgBuffer = await imgRes.arrayBuffer()
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
            const uploadRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
                body: imgBuffer,
            })
            if (!uploadRes.ok) continue
            const uploadData = await uploadRes.json()
            blobs.push({ image: uploadData.blob, alt: '' })
        }
        if (blobs.length > 0) {
            record.embed = { $type: 'app.bsky.embed.images', images: blobs }
        }
    }

    const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            repo: did,
            collection: 'app.bsky.feed.post',
            record,
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || 'Failed to publish to Bluesky')
    }

    const data = await res.json()
    return { externalId: data.uri || data.cid || 'bluesky-post' }
}

// Generic placeholder for other platforms (mark as pending-integration)
async function publishPlaceholder(platform: string): Promise<{ externalId: string }> {
    throw new Error(`${platform} publishing not yet integrated. Coming soon!`)
}

// ─── Main handler ────────────────────────────────────────────────────

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Allow internal worker calls (bypass NextAuth session)
    const workerSecret = process.env.WORKER_SECRET || ''
    const isWorkerCall = workerSecret &&
        _req.headers.get('x-worker-secret') === workerSecret

    let publishedBy = 'Auto-Scheduler'

    if (!isWorkerCall) {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        publishedBy = session.user.name || session.user.email || 'Unknown'
    }

    const { id } = await params

    const post = await prisma.post.findUnique({
        where: { id },
        include: {
            channel: {
                include: {
                    platforms: { where: { isActive: true } },
                },
            },
            media: {
                include: { mediaItem: true },
                orderBy: { sortOrder: 'asc' },
            },
            platformStatuses: true,
        },
    })

    if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Update status to PUBLISHING
    await prisma.post.update({
        where: { id },
        data: { status: 'PUBLISHING' },
    })

    const results: { platform: string; accountId: string; success: boolean; error?: string; externalId?: string }[] = []

    // Get pending platform statuses
    const pendingStatuses = post.platformStatuses.filter((ps) => ps.status === 'pending')

    // Build media info objects (URL + type) for platform APIs
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const mediaItems: MediaInfo[] = post.media.map((m) => {
        let url = m.mediaItem.url
        const metadata = (m.mediaItem.aiMetadata || {}) as Record<string, string>
        const isR2 = metadata.storage === 'r2'

        if (url.startsWith('http://') || url.startsWith('https://')) {
            if (isR2) {
                // R2 URLs are publicly accessible — use directly, no proxy needed
                console.log(`[Publish] ☁️ Using R2 URL directly for ${m.mediaItem.originalName || m.mediaItem.id}`)
            } else if (m.mediaItem.storageFileId) {
                // Google Drive files: use our proxy endpoint instead of direct Drive URLs
                // Instagram/Facebook APIs cannot download from Google Drive (redirects, virus scan, etc.)
                url = `${baseUrl}/api/media/serve/${m.mediaItem.id}`
                console.log(`[Publish] 🔄 Using proxy URL for ${m.mediaItem.originalName || m.mediaItem.id} (Google Drive → Neeflow proxy)`)
            }
        } else {
            // Legacy/local media — prefix with base URL
            url = `${baseUrl}${url}`
        }
        return {
            url,
            type: m.mediaItem.type || 'image',
            originalName: m.mediaItem.originalName || undefined,
        }
    })

    // Resolve per-platform content: use platform-specific override if available, else master content
    const contentPerPlatform = ((post?.contentPerPlatform) || {}) as Record<string, string>
    function getContent(platform: string): string {
        return contentPerPlatform[platform]?.trim() || post?.content || ''
    }

    for (const ps of pendingStatuses) {
        try {
            // Find the platform connection
            const platformConn = post.channel.platforms.find(
                (p) => p.platform === ps.platform && p.accountId === ps.accountId
            )

            if (!platformConn) {
                await prisma.postPlatformStatus.update({
                    where: { id: ps.id },
                    data: { status: 'failed', errorMsg: 'Platform connection not found or inactive' },
                })
                results.push({ platform: ps.platform, accountId: ps.accountId, success: false, error: 'Connection not found' })
                continue
            }

            if (!platformConn.accessToken) {
                await prisma.postPlatformStatus.update({
                    where: { id: ps.id },
                    data: { status: 'failed', errorMsg: 'No access token. Please reconnect this account.' },
                })
                results.push({ platform: ps.platform, accountId: ps.accountId, success: false, error: 'No access token' })
                continue
            }

            let publishResult: { externalId: string }

            // Get post type from platform status config or default to 'feed'
            const psConfig = (ps.config as Record<string, unknown>) || undefined
            const postType = (psConfig?.postType as string) || 'feed'
            console.log(`[Publish] Platform: ${ps.platform}, PostType: ${postType}, Config:`, JSON.stringify(psConfig || {}))

            switch (ps.platform) {
                case 'facebook':
                    publishResult = await publishToFacebook(
                        platformConn.accessToken,
                        platformConn.accountId,
                        getContent('facebook'),
                        mediaItems,
                        postType,
                        psConfig,
                    )
                    break

                case 'instagram':
                    publishResult = await publishToInstagram(
                        platformConn.accessToken,
                        platformConn.accountId,
                        getContent('instagram'),
                        mediaItems,
                        psConfig,
                    )
                    break

                case 'youtube':
                    publishResult = await publishToYouTube(
                        platformConn.accessToken,
                        platformConn.refreshToken || null,
                        platformConn.accountId,
                        getContent('youtube'),
                        mediaItems,
                        platformConn.id,
                        psConfig,
                    )
                    break

                case 'pinterest':
                    publishResult = await publishToPinterest(
                        platformConn.accessToken,
                        getContent('pinterest'),
                        mediaItems,
                        psConfig,
                    )
                    break

                case 'linkedin':
                    publishResult = await publishToLinkedIn(
                        platformConn.accessToken,
                        platformConn.accountId,
                        getContent('linkedin'),
                        mediaItems,
                    )
                    break

                case 'tiktok':
                    publishResult = await publishToTikTok(
                        platformConn.accessToken,
                        getContent('tiktok'),
                        mediaItems,
                        psConfig,
                    )
                    break

                case 'threads':
                    publishResult = await publishToThreads(
                        platformConn.accessToken,
                        platformConn.accountId,
                        getContent('threads'),
                        mediaItems,
                    )
                    break

                case 'gbp':
                    publishResult = await publishToGBP(
                        platformConn.accessToken,
                        platformConn.accountId,
                        getContent('gbp'),
                        mediaItems,
                    )
                    break

                case 'x':
                case 'twitter':
                    publishResult = await publishToX(
                        platformConn.accessToken,
                        getContent('x'),
                        mediaItems,
                    )
                    break

                case 'bluesky':
                    publishResult = await publishToBluesky(
                        platformConn.accessToken,
                        platformConn.refreshToken || null,
                        platformConn.id,
                        getContent('bluesky'),
                        mediaItems,
                    )
                    break

                default:
                    publishResult = await publishPlaceholder(ps.platform)
            }

            await prisma.postPlatformStatus.update({
                where: { id: ps.id },
                data: {
                    status: 'published',
                    externalId: publishResult.externalId,
                    publishedAt: new Date(),
                },
            })

            console.log(`[Publish] ✅ ${ps.platform} (${ps.accountId}): published successfully → ${publishResult.externalId}`)
            results.push({ platform: ps.platform, accountId: ps.accountId, success: true, externalId: publishResult.externalId })
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            console.error(`[Publish] ❌ ${ps.platform} (${ps.accountId}): ${errorMsg}`)
            await prisma.postPlatformStatus.update({
                where: { id: ps.id },
                data: { status: 'failed', errorMsg },
            })
            results.push({ platform: ps.platform, accountId: ps.accountId, success: false, error: errorMsg })
        }
    }

    // Determine final post status
    const allPublished = results.length > 0 && results.every((r) => r.success)
    const anyPublished = results.some((r) => r.success)

    await prisma.post.update({
        where: { id },
        data: {
            status: allPublished ? 'PUBLISHED' : anyPublished ? 'PUBLISHED' : 'FAILED',
            publishedAt: anyPublished ? new Date() : null,
        },
    })

    // ── Post-publish: First Comments ──────────────────────────────────
    // Run AFTER all platforms are published, with a delay to ensure
    // Facebook has fully processed the posts (especially reels/videos)
    const fbFirstCommentTasks = results
        .filter(r => r.success && r.platform === 'facebook' && r.externalId)
        .map(r => {
            const ps = pendingStatuses.find(p => p.platform === r.platform && p.accountId === r.accountId)
            const cfg = ps ? ((ps.config as Record<string, unknown>) || {}) : {}
            const firstComment = (cfg.firstComment as string) || ''
            if (!firstComment) return null
            // Find the access token for this platform
            const platformConn = post.channel.platforms.find(
                pc => pc.platform === r.platform && pc.accountId === r.accountId
            )
            if (!platformConn?.accessToken) return null
            return { accessToken: platformConn.accessToken, postId: r.externalId!, message: firstComment }
        })
        .filter(Boolean) as { accessToken: string; postId: string; message: string }[]

    if (fbFirstCommentTasks.length > 0) {
        // Wait 5 seconds for Facebook to finish processing the posts
        console.log(`[FirstComment] Waiting 5s before posting ${fbFirstCommentTasks.length} first comment(s)...`)
        await new Promise(resolve => setTimeout(resolve, 5000))
        for (const task of fbFirstCommentTasks) {
            await postFirstComment(task.accessToken, task.postId, task.message)
        }
    }

    // ── Post-publish: Webhook Notifications ────────────────────────────
    try {
        await sendPublishWebhooks(
            {
                webhookDiscord: post.channel.webhookDiscord as Record<string, string> | null,
                webhookTelegram: post.channel.webhookTelegram as Record<string, string> | null,
                webhookSlack: post.channel.webhookSlack as Record<string, string> | null,
                webhookZalo: { ...(post.channel.webhookZalo as Record<string, string> || {}), channelId: post.channel.id } as Record<string, string> | null,
                webhookCustom: post.channel.webhookCustom as Record<string, string> | null,
                webhookEvents: post.channel.webhookEvents as string[] | null,
            },
            {
                postId: id,
                content: post.content || '',
                publishedBy: publishedBy,
                publishedAt: new Date(),
                channelName: post.channel.name,
                results,
                mediaCount: post.media.length,
            },
        )
    } catch (err) {
        console.warn('[Webhook] Notification error:', err)
    }

    return NextResponse.json({
        success: anyPublished,
        results,
        allPublished,
    })
}
