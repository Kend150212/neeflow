import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
    getGDriveAccessToken,
    getUserGDriveAccessToken,
    uploadFile,
    makeFilePublic,
    getOrCreateChannelFolder,
    getOrCreateMonthlyFolder,
} from '@/lib/gdrive'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'
import { checkStorageQuota } from '@/lib/storage-quota'
import { randomUUID } from 'crypto'

export const maxDuration = 30

/**
 * POST /api/admin/media/from-url
 * Downloads an image from a URL and uploads it to R2 (or Google Drive fallback),
 * then creates a MediaItem record.
 *
 * Body: { url: string, channelId: string }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { url, channelId } = body

    if (!url || !channelId) {
        return NextResponse.json({ error: 'url and channelId are required' }, { status: 400 })
    }

    try {
        // ─── Deduplication: reuse existing MediaItem with same sourceUrl ──
        // Query uses Prisma's JSON filter on aiMetadata->>'sourceUrl'
        const existing = await prisma.mediaItem.findFirst({
            where: {
                channelId,
                aiMetadata: {
                    path: ['sourceUrl'],
                    equals: url,
                },
            },
        })
        if (existing) {
            // Return cached item — no upload, no storage cost, no duplicate
            return NextResponse.json(existing, { status: 200 })
        }

        // ─── Download the image ────────────────────────────────────
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        const imgRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)',
                'Accept': 'image/*,*/*;q=0.8',
            },
            signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!imgRes.ok) {
            return NextResponse.json({ error: `Failed to download image: ${imgRes.status}` }, { status: 400 })
        }

        const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
        if (!contentType.startsWith('image/')) {
            return NextResponse.json({ error: 'URL does not point to an image' }, { status: 400 })
        }

        const buffer = Buffer.from(await imgRes.arrayBuffer())
        const fileSize = buffer.length

        // Max 10MB for URL downloads
        if (fileSize > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 })
        }

        // ─── Check storage quota ───────────────────────────────────
        const quota = await checkStorageQuota(session.user.id, fileSize)
        if (!quota.allowed) {
            return NextResponse.json(
                { error: quota.reason, code: 'STORAGE_LIMIT_REACHED', usedMB: quota.usedMB, limitMB: quota.limitMB },
                { status: 429 }
            )
        }

        // ─── Try R2 first ──────────────────────────────────────────
        const useR2 = await isR2Configured()

        if (useR2) {
            const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
            const originalName = url.split('/').pop()?.split('?')[0] || `article-image.${ext}`
            const r2Key = generateR2Key(channelId, originalName)
            const publicUrl = await uploadToR2(buffer, r2Key, contentType)

            const mediaItem = await prisma.mediaItem.create({
                data: {
                    channelId,
                    url: publicUrl,
                    thumbnailUrl: publicUrl,
                    storageFileId: r2Key,
                    type: 'image',
                    source: 'url',
                    originalName,
                    fileSize,
                    mimeType: contentType,
                    aiMetadata: {
                        storage: 'r2',
                        r2Key,
                        sourceUrl: url,
                    },
                },
            })

            return NextResponse.json(mediaItem, { status: 201 })
        }

        // ─── Fallback: Google Drive ────────────────────────────────
        let accessToken: string
        let targetFolderId: string

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { gdriveRefreshToken: true, gdriveFolderId: true, role: true },
        })

        if (user?.gdriveRefreshToken && user?.gdriveFolderId) {
            accessToken = await getUserGDriveAccessToken(session.user.id)
            const channel = await prisma.channel.findUnique({
                where: { id: channelId },
                select: { name: true, displayName: true },
            })
            const channelName = channel?.displayName || channel?.name || 'General'
            const channelFolder = await getOrCreateChannelFolder(accessToken, user.gdriveFolderId, channelName)
            const monthlyFolder = await getOrCreateMonthlyFolder(accessToken, channelFolder.id)
            targetFolderId = monthlyFolder.id
        } else if (user?.role === 'ADMIN') {
            accessToken = await getGDriveAccessToken()
            const integration = await prisma.apiIntegration.findFirst({
                where: { provider: 'gdrive' },
            })
            const gdriveConfig = (integration?.config || {}) as Record<string, string>
            const parentFolderId = gdriveConfig.parentFolderId
            if (!parentFolderId) {
                return NextResponse.json({ error: 'No storage configured. Set up Cloudflare R2 or Google Drive in API Hub.' }, { status: 400 })
            }
            const channel = await prisma.channel.findUnique({
                where: { id: channelId },
                select: { name: true, displayName: true },
            })
            if (!channel) {
                return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
            }
            const channelFolder = await getOrCreateChannelFolder(accessToken, parentFolderId, channel.displayName || channel.name)
            targetFolderId = channelFolder.id
        } else {
            return NextResponse.json(
                { error: 'No storage configured. Set up Cloudflare R2 in API Hub.', code: 'STORAGE_NOT_CONFIGURED' },
                { status: 403 }
            )
        }

        // Upload to Google Drive
        const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
        const now = new Date()
        const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`
        const shortId = randomUUID().slice(0, 6)
        const uniqueName = `article-image ${shortId} - ${dateStr}.${ext}`

        const driveFile = await uploadFile(accessToken, uniqueName, contentType, buffer, targetFolderId)
        const publicUrl = await makeFilePublic(accessToken, driveFile.id, contentType)
        const thumbnailUrl = `https://lh3.googleusercontent.com/d/${driveFile.id}=s400`

        const mediaItem = await prisma.mediaItem.create({
            data: {
                channelId,
                url: publicUrl,
                thumbnailUrl,
                storageFileId: driveFile.id,
                type: 'image',
                source: 'url',
                originalName: url.split('/').pop()?.split('?')[0] || 'article-image.jpg',
                fileSize,
                mimeType: contentType,
                aiMetadata: {
                    storage: 'gdrive',
                    gdriveFolderId: targetFolderId,
                    sourceUrl: url,
                    webViewLink: driveFile.webViewLink,
                },
            },
        })

        return NextResponse.json(mediaItem, { status: 201 })
    } catch (error) {
        console.error('Media from-url error:', error)
        const errMsg = error instanceof Error ? error.message : 'Failed to download image'
        return NextResponse.json({ error: errMsg }, { status: 500 })
    }
}
