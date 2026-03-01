import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserGDriveAccessToken, getGDriveAccessToken, getOrCreateMonthlyFolder, getOrCreateChannelFolder } from '@/lib/gdrive'
import { getR2PresignedUrl, generateR2Key, getR2PublicUrl, isR2Configured } from '@/lib/r2'
import { checkStorageQuota } from '@/lib/storage-quota'
import { randomUUID } from 'crypto'

/**
 * POST /api/admin/media/init-upload
 * For R2: Returns a presigned PUT URL for direct client-side upload.
 * For GDrive (fallback): Creates a resumable upload session and returns the upload URI.
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channelId, fileName, mimeType, fileSize } = await req.json()

    if (!channelId || !fileName || !mimeType) {
        return NextResponse.json({ error: 'channelId, fileName, mimeType are required' }, { status: 400 })
    }

    // File size limits: video up to 500MB, images up to 50MB
    if (fileSize) {
        const isVideo = mimeType.startsWith('video/')
        const limitBytes = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024
        const limitLabel = isVideo ? '500MB' : '50MB'
        if (fileSize > limitBytes) {
            return NextResponse.json(
                { error: `File too large. Maximum size: ${limitLabel} for ${isVideo ? 'videos' : 'images'}` },
                { status: 400 }
            )
        }
    }

    // ─── Check storage quota ─────────────────────────────────────────
    if (fileSize) {
        const quota = await checkStorageQuota(session.user.id, fileSize)
        if (!quota.allowed) {
            return NextResponse.json(
                { error: quota.reason, code: 'STORAGE_LIMIT_REACHED', usedMB: quota.usedMB, limitMB: quota.limitMB },
                { status: 429 }
            )
        }
    }

    // ─── Try R2 first ────────────────────────────────────────────────
    const useR2 = await isR2Configured()

    if (useR2) {
        try {
            const r2Key = generateR2Key(channelId, fileName)
            const presignedUrl = await getR2PresignedUrl(r2Key, mimeType, fileSize)
            const publicUrl = getR2PublicUrl(r2Key)

            return NextResponse.json({
                uploadUri: presignedUrl,
                r2Key,
                publicUrl,
                originalName: fileName,
                storage: 'r2',
            })
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'R2 presigned URL generation failed'
            return NextResponse.json({ error: msg }, { status: 500 })
        }
    }

    // ─── Fallback: Google Drive ──────────────────────────────────────
    try {
        let accessToken: string
        let targetFolderId: string

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { gdriveRefreshToken: true, gdriveFolderId: true },
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
        } else {
            accessToken = await getGDriveAccessToken()
            const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'gdrive' } })
            const gdriveConfig = (integration?.config || {}) as Record<string, string>
            const parentFolderId = gdriveConfig.parentFolderId
            if (!parentFolderId) {
                return NextResponse.json(
                    { error: 'No storage configured. Set up Cloudflare R2 (recommended) or Google Drive in API Hub.' },
                    { status: 400 }
                )
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
        }

        const ext = fileName.split('.').pop() || 'mp4'
        const now = new Date()
        const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`
        const prefix = mimeType.startsWith('video/') ? 'video' : 'image'
        const shortId = randomUUID().slice(0, 6)
        const uniqueName = `${prefix} ${shortId} - ${dateStr}.${ext}`

        const metadata = {
            name: uniqueName,
            mimeType,
            parents: [targetFolderId],
        }

        const initRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,webViewLink,webContentLink,size',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Upload-Content-Type': mimeType,
                    ...(fileSize ? { 'X-Upload-Content-Length': String(fileSize) } : {}),
                },
                body: JSON.stringify(metadata),
            },
        )

        if (!initRes.ok) {
            const errData = await initRes.json()
            throw new Error(`GDrive init failed: ${errData.error?.message || initRes.statusText}`)
        }

        const uploadUri = initRes.headers.get('Location')
        if (!uploadUri) {
            throw new Error('No upload URI returned from Google Drive')
        }

        return NextResponse.json({
            uploadUri,
            accessToken,
            channelFolderId: targetFolderId,
            uniqueName,
            originalName: fileName,
            storage: 'gdrive',
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Init upload failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
