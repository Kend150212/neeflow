import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/encryption'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'

// Helper: get Canva access token for the current user, auto-refresh if expired
async function getCanvaToken(userId: string, forceRefresh = false): Promise<{ token: string | null; connected: boolean }> {
    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'canva' } })
    if (!integration) return { token: null, connected: false }
    const config = (integration.config || {}) as Record<string, string | null>
    const encryptedToken = config[`canvaToken_${userId}`]
    if (!encryptedToken) return { token: null, connected: false }

    const token = decrypt(encryptedToken)

    if (!forceRefresh) {
        // Return token directly — if it's expired, the calling code will get a 401
        // and should call getCanvaToken(userId, true) to force a refresh
        return { token, connected: true }
    }

    // forceRefresh=true — token got a 401, try to refresh
    console.log('Canva token refresh requested for user', userId)
    const encryptedRefresh = config[`canvaRefresh_${userId}`]
    if (!encryptedRefresh) {
        console.error('No Canva refresh token available')
        return { token: null, connected: false }
    }

    const refreshToken = decrypt(encryptedRefresh)
    const clientId = config.canvaClientId || process.env.CANVA_CLIENT_ID || ''
    let clientSecret = process.env.CANVA_CLIENT_SECRET || ''
    if (!clientSecret && integration.apiKeyEncrypted) {
        clientSecret = decrypt(integration.apiKeyEncrypted)
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    console.log('Canva refresh: clientId length:', clientId.length, 'secret length:', clientSecret.length)

    const refreshRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    })

    if (!refreshRes.ok) {
        const errText = await refreshRes.text()
        console.error('Canva token refresh failed:', errText)
        return { token: null, connected: false }
    }

    const refreshData = await refreshRes.json()
    const newAccessToken = refreshData.access_token
    const newRefreshToken = refreshData.refresh_token

    // Save new tokens to database
    const updatedConfig = {
        ...config,
        [`canvaToken_${userId}`]: encrypt(newAccessToken),
        ...(newRefreshToken ? { [`canvaRefresh_${userId}`]: encrypt(newRefreshToken) } : {}),
    }

    await prisma.apiIntegration.update({
        where: { id: integration.id },
        data: { config: updatedConfig },
    })

    console.log('Canva token refreshed successfully for user', userId)
    return { token: newAccessToken, connected: true }
}

// Helper: Upload an image to Canva as an asset, return asset ID
async function uploadImageToCanva(token: string, imageUrl: string): Promise<string | null> {
    try {
        // Download the image
        const imgRes = await fetch(imageUrl)
        if (!imgRes.ok) {
            console.error('Failed to download image for Canva upload:', imgRes.status)
            return null
        }
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

        // Upload to Canva Asset Upload API
        // Content-Type MUST be application/octet-stream per Canva docs
        const uploadRes = await fetch('https://api.canva.com/rest/v1/asset-uploads', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/octet-stream',
                'Asset-Upload-Metadata': JSON.stringify({
                    name_base64: Buffer.from(`Upload-${Date.now()}`).toString('base64'),
                }),
            },
            body: imgBuffer,
        })

        if (!uploadRes.ok) {
            const errText = await uploadRes.text()
            console.error('Canva asset upload failed:', uploadRes.status, errText)
            return null
        }

        const uploadData = await uploadRes.json()
        console.log('Canva asset upload response:', JSON.stringify(uploadData))

        // If already completed, return asset ID directly
        if (uploadData.job?.status === 'success' && uploadData.job?.asset?.id) {
            return uploadData.job.asset.id
        }

        // Otherwise poll for completion (async job)
        const jobId = uploadData.job?.id
        if (!jobId) {
            console.error('No job ID from Canva asset upload')
            return null
        }

        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 2000))

            const statusRes = await fetch(`https://api.canva.com/rest/v1/asset-uploads/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            })

            if (!statusRes.ok) {
                console.error('Canva asset upload status check failed:', statusRes.status)
                continue
            }

            const statusData = await statusRes.json()
            console.log('Canva asset upload job status:', JSON.stringify(statusData))

            if (statusData.job?.status === 'success' && statusData.job?.asset?.id) {
                return statusData.job.asset.id
            }
            if (statusData.job?.status === 'failed') {
                console.error('Canva asset upload job failed:', statusData.job.error)
                return null
            }
            // status is 'in_progress', keep polling
        }

        console.error('Canva asset upload timed out')
        return null
    } catch (err) {
        console.error('Error uploading image to Canva:', err)
        return null
    }
}

// POST /api/canva/designs — Create a new Canva design
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token, connected } = await getCanvaToken(session.user.id)
    if (!connected || !token) {
        return NextResponse.json({
            error: 'canva_not_connected',
            message: 'Please connect your Canva account first.',
            connectUrl: `/api/oauth/canva?returnUrl=${encodeURIComponent('/dashboard/posts/compose')}`,
        }, { status: 401 })
    }

    const { designType, width, height, title, imageUrl } = await req.json()

    // If editing an existing image, upload it to Canva as an asset first
    let assetId: string | undefined
    if (imageUrl) {
        console.log('Uploading image to Canva:', imageUrl)
        const uploadedAssetId = await uploadImageToCanva(token, imageUrl)
        if (uploadedAssetId) {
            assetId = uploadedAssetId
            console.log('Successfully uploaded asset to Canva:', assetId)
        } else {
            console.warn('Failed to upload image to Canva, creating blank design instead')
        }
    }

    // Build design_type
    let design_type: Record<string, unknown>
    if (designType === 'custom' && width && height) {
        design_type = { type: 'custom', width: Number(width), height: Number(height) }
    } else {
        design_type = { type: 'custom', width: width || 1080, height: height || 1080 }
    }

    const body: Record<string, unknown> = {
        design_type,
        title: title || 'Design',
    }
    if (assetId) body.asset_id = assetId

    console.log('Creating Canva design with body:', JSON.stringify(body))

    const res = await fetch('https://api.canva.com/rest/v1/designs', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error('Canva create design failed:', res.status, errorText)
        // Token expired and couldn't be refreshed → specific error for frontend modal
        if (res.status === 401) {
            return NextResponse.json({
                error: 'canva_token_expired',
                message: 'Your Canva session has expired. Please reconnect your account.',
                reconnectUrl: `/api/oauth/canva?returnUrl=${encodeURIComponent('/dashboard/posts/compose')}`,
            }, { status: 401 })
        }
        return NextResponse.json({ error: 'Failed to create Canva design', detail: errorText }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({
        designId: data.design?.id,
        editUrl: data.design?.urls?.edit_url,
        viewUrl: data.design?.urls?.view_url,
        title: data.design?.title,
        thumbnail: data.design?.thumbnail,
        hasAsset: !!assetId,
    })
}

// GET /api/canva/designs?designId=xxx — Export a design as PNG (proxied through server)
export async function GET(req: NextRequest) {
    // Debug beacon from client — log and return early
    const debugStep = req.nextUrl.searchParams.get('_debug')
    if (debugStep) {
        const step = req.nextUrl.searchParams.get('step')
        const chId = req.nextUrl.searchParams.get('channelId')
        const fileSize = req.nextUrl.searchParams.get('fileSize')
        const mediaId = req.nextUrl.searchParams.get('mediaId')
        console.log(`[CLIENT DEBUG] step=${step} channelId=${chId} fileSize=${fileSize} mediaId=${mediaId}`)
        return NextResponse.json({ ok: true })
    }

    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let { token, connected } = await getCanvaToken(session.user.id)
    if (!connected || !token) {
        return NextResponse.json({ error: 'Canva not connected' }, { status: 400 })
    }

    const designId = req.nextUrl.searchParams.get('designId')
    const channelId = req.nextUrl.searchParams.get('channelId') // optional: enables server-side R2 upload for large images
    if (!designId) return NextResponse.json({ error: 'designId required' }, { status: 400 })

    // Create export job — with one retry if token expired (401)
    let exportRes = await fetch(`https://api.canva.com/rest/v1/exports`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            design_id: designId,
            format: { type: 'png' },
        }),
    })

    // If token expired, refresh and retry once
    if (exportRes.status === 401) {
        console.log('Canva export got 401 — refreshing token and retrying...')
        const refreshed = await getCanvaToken(session.user.id, true)
        if (!refreshed.token) {
            return NextResponse.json({
                error: 'canva_token_expired',
                message: 'Your Canva session has expired. Please reconnect your account.',
                reconnectUrl: `/api/oauth/canva?returnUrl=${encodeURIComponent('/dashboard/posts/compose')}`,
            }, { status: 401 })
        }
        token = refreshed.token
        exportRes = await fetch(`https://api.canva.com/rest/v1/exports`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                design_id: designId,
                format: { type: 'png' },
            }),
        })
    }

    if (!exportRes.ok) {
        const errorText = await exportRes.text()
        console.error('Canva export failed:', errorText)
        return NextResponse.json({ error: 'Failed to export design', detail: errorText }, { status: exportRes.status })
    }

    const exportData = await exportRes.json()
    const jobId = exportData.job?.id

    if (!jobId) {
        return NextResponse.json({ error: 'No export job ID returned' }, { status: 500 })
    }

    // Poll for export completion (max 50 seconds = 25 × 2s)
    for (let i = 0; i < 25; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000))

        const statusRes = await fetch(`https://api.canva.com/rest/v1/exports/${jobId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        })

        if (!statusRes.ok) continue

        const statusData = await statusRes.json()

        if (statusData.job?.status === 'success') {
            const urls: string[] = statusData.job.urls || []
            console.log('Canva export job succeeded, urls count:', urls.length)
            if (urls.length === 0) continue

            const isMultiPage = urls.length > 1
            const LARGE_THRESHOLD = 1.5 * 1024 * 1024 // 1.5MB

            // ── Multi-page OR large image → server-side R2 upload for all pages ──
            if (channelId && (isMultiPage || true)) {
                try {
                    const r2Ok = await isR2Configured()
                    if (r2Ok) {
                        // Download and upload all pages in parallel
                        const pageResults = await Promise.all(
                            urls.map(async (pageUrl, idx) => {
                                try {
                                    console.log(`Canva page ${idx + 1}/${urls.length}: downloading...`)
                                    const imgRes = await fetch(pageUrl)
                                    if (!imgRes.ok) {
                                        console.error(`Canva page ${idx + 1}: download failed ${imgRes.status}`)
                                        return null
                                    }
                                    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
                                    console.log(`Canva page ${idx + 1}: ${imgBuffer.length} bytes`)

                                    // Small single-page image → skip server upload, use base64 path below
                                    if (!isMultiPage && imgBuffer.length <= LARGE_THRESHOLD) {
                                        const base64 = imgBuffer.toString('base64')
                                        return { base64, contentType: imgRes.headers.get('content-type') || 'image/png' }
                                    }

                                    const suffix = urls.length > 1 ? `-page${idx + 1}` : ''
                                    const fileName = `canva-design-${Date.now()}${suffix}.png`
                                    const r2Key = generateR2Key(channelId, fileName)
                                    const publicUrl = await uploadToR2(imgBuffer, r2Key, 'image/png')
                                    const mediaItem = await prisma.mediaItem.create({
                                        data: {
                                            channelId,
                                            url: publicUrl,
                                            thumbnailUrl: publicUrl,
                                            storageFileId: r2Key,
                                            type: 'image',
                                            source: 'upload',
                                            originalName: fileName,
                                            fileSize: imgBuffer.length,
                                            mimeType: 'image/png',
                                            aiMetadata: { storage: 'r2', r2Key, source: 'canva', page: idx + 1 },
                                        },
                                    })
                                    console.log(`Canva page ${idx + 1}: R2 upload done, mediaId=${mediaItem.id}`)
                                    return { mediaItem }
                                } catch (pageErr) {
                                    console.error(`Canva page ${idx + 1}: error`, pageErr)
                                    return null
                                }
                            })
                        )

                        // Check if first (and only) page returned base64 (small single-page fallback)
                        if (!isMultiPage && pageResults[0] && 'base64' in pageResults[0]) {
                            const { base64, contentType } = pageResults[0]
                            console.log(`Canva single page: returning base64 (${base64!.length} chars)`)
                            return NextResponse.json({ status: 'success', imageBase64: base64, contentType })
                        }

                        // All pages uploaded to R2 — return as pages array
                        const mediaItems = pageResults.filter(r => r && 'mediaItem' in r).map(r => (r as { mediaItem: unknown }).mediaItem)
                        if (mediaItems.length > 0) {
                            console.log(`Canva export: returning ${mediaItems.length} page(s) as media_ready`)
                            return NextResponse.json({ status: 'media_ready', pages: mediaItems })
                        }
                        // All pages failed — fall through to URL fallback
                    }
                } catch (r2Err) {
                    console.error('Canva multi-page R2 upload failed, falling back to URL:', r2Err)
                }
            }

            // Fallback: return raw URLs (CORS may block client-side fetch)
            console.log('Returning URL fallback for export')
            return NextResponse.json({ status: 'success', urls })
        }

        if (statusData.job?.status === 'failed') {
            return NextResponse.json({ error: 'Export failed', detail: statusData.job.error }, { status: 500 })
        }
    }

    return NextResponse.json({ error: 'Export timed out' }, { status: 408 })
}

