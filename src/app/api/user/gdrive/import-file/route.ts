import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
    getUserGDriveAccessToken,
    getGDriveAccessToken,
    uploadFile,
    makeFilePublic,
    getOrCreateChannelFolder,
    getOrCreateMonthlyFolder,
} from '@/lib/gdrive'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'
import { checkStorageQuota } from '@/lib/storage-quota'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

/**
 * POST /api/user/gdrive/import-file
 * Server-side import: downloads a Google Drive file using the SESSION USER's access
 * token (proven working via picker-config), uploads to R2 (or Drive fallback),
 * and returns a public MediaItem.
 *
 * Body: { fileId, mimeType, fileName, channelId }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId, mimeType, fileName, channelId } = await req.json()

    if (!fileId || !channelId) {
        return NextResponse.json({ error: 'fileId and channelId are required' }, { status: 400 })
    }

    try {
        // ─── Deduplication ────────────────────────────────────────────────
        const existing = await prisma.mediaItem.findFirst({
            where: {
                channelId,
                aiMetadata: { path: ['driveFileId'], equals: fileId },
            },
        })
        if (existing) return NextResponse.json(existing, { status: 200 })

        // ─── Get access token — try user token first, admin fallback ──────
        // User token is proven to work (same call as picker-config).
        // Admin token is used as fallback for files in admin's drive.
        let accessToken: string
        try {
            accessToken = await getUserGDriveAccessToken(session.user.id)
        } catch {
            // User's personal Drive not connected — try system admin token
            try {
                accessToken = await getGDriveAccessToken()
            } catch {
                return NextResponse.json(
                    { error: 'Google Drive not connected. Please connect your Drive in settings.' },
                    { status: 403 }
                )
            }
        }

        // ─── Download the file ────────────────────────────────────────────
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
        const driveRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!driveRes.ok) {
            // If 403/404 with user token, try admin token as fallback
            if (driveRes.status === 403 || driveRes.status === 404) {
                try {
                    const adminToken = await getGDriveAccessToken()
                    const retryRes = await fetch(downloadUrl, {
                        headers: { Authorization: `Bearer ${adminToken}` },
                    })
                    if (!retryRes.ok) {
                        return NextResponse.json(
                            { error: `Cannot access this file from Google Drive (${retryRes.status}). The file may be in a different account.` },
                            { status: 400 }
                        )
                    }
                    // Use retryRes from this point
                    return await processDownload(retryRes, { fileId, mimeType, fileName, channelId, adminToken, session })
                } catch {
                    return NextResponse.json(
                        { error: `Cannot access this Drive file (${driveRes.status}). Please check file permissions.` },
                        { status: 400 }
                    )
                }
            }
            return NextResponse.json(
                { error: `Failed to download from Drive: ${driveRes.status}` },
                { status: 400 }
            )
        }

        return await processDownload(driveRes, { fileId, mimeType, fileName, channelId, accessToken, session })

    } catch (error) {
        console.error('Drive import-file error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to import from Drive' },
            { status: 500 }
        )
    }
}

async function processDownload(
    driveRes: Response,
    opts: {
        fileId: string
        mimeType?: string
        fileName?: string
        channelId: string
        accessToken: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session: any
    }
) {
    const { fileId, mimeType: reqMime, fileName, channelId, accessToken, session } = opts

    const resolvedMime = reqMime || driveRes.headers.get('content-type') || 'image/jpeg'
    if (!resolvedMime.startsWith('image/') && !resolvedMime.startsWith('video/')) {
        return NextResponse.json({ error: 'Only images and videos can be imported.' }, { status: 400 })
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer())
    const fileSize = buffer.length

    if (fileSize > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })
    }

    const quota = await checkStorageQuota(session.user.id, fileSize)
    if (!quota.allowed) {
        return NextResponse.json(
            { error: quota.reason, code: 'STORAGE_LIMIT_REACHED', usedMB: quota.usedMB, limitMB: quota.limitMB },
            { status: 429 }
        )
    }

    const ext = resolvedMime.split('/')[1]?.replace('jpeg', 'jpg').split(';')[0] || 'jpg'
    const originalName = fileName || `drive-import.${ext}`
    const isImage = resolvedMime.startsWith('image/')

    // ─── R2 upload (preferred) ────────────────────────────────────────────
    const useR2 = await isR2Configured()

    if (useR2) {
        const r2Key = generateR2Key(channelId, originalName)
        const publicUrl = await uploadToR2(buffer, r2Key, resolvedMime)

        const mediaItem = await prisma.mediaItem.create({
            data: {
                channelId,
                url: publicUrl,
                thumbnailUrl: publicUrl,
                storageFileId: r2Key,
                type: isImage ? 'image' : 'video',
                source: 'drive',
                originalName,
                fileSize,
                mimeType: resolvedMime,
                aiMetadata: { storage: 'r2', r2Key, driveFileId: fileId },
            },
        })
        return NextResponse.json(mediaItem, { status: 201 })
    }

    // ─── Google Drive fallback (re-upload as public) ──────────────────────
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { gdriveFolderId: true },
    })

    if (!user?.gdriveFolderId) {
        return NextResponse.json(
            { error: 'No storage configured. Set up Cloudflare R2 in API Hub.' },
            { status: 403 }
        )
    }

    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { name: true, displayName: true },
    })
    const channelName = channel?.displayName || channel?.name || 'General'
    const channelFolder = await getOrCreateChannelFolder(accessToken, user.gdriveFolderId, channelName)
    const monthlyFolder = await getOrCreateMonthlyFolder(accessToken, channelFolder.id)

    const driveFile = await uploadFile(accessToken, originalName, resolvedMime, buffer, monthlyFolder.id)
    const publicUrl = await makeFilePublic(accessToken, driveFile.id, resolvedMime)
    const thumbnailUrl = `https://lh3.googleusercontent.com/d/${driveFile.id}=s800`

    const mediaItem = await prisma.mediaItem.create({
        data: {
            channelId,
            url: publicUrl,
            thumbnailUrl,
            storageFileId: driveFile.id,
            type: isImage ? 'image' : 'video',
            source: 'drive',
            originalName,
            fileSize,
            mimeType: resolvedMime,
            aiMetadata: { storage: 'gdrive', driveFileId: fileId, webViewLink: driveFile.webViewLink },
        },
    })
    return NextResponse.json(mediaItem, { status: 201 })
}
