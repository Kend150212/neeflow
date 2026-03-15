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

/** Download a Drive file trying user token first, then admin token as fallback */
async function downloadDriveFile(fileId: string, userId: string): Promise<Response> {
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`

    // Try user token first
    try {
        const userToken = await getUserGDriveAccessToken(userId)
        const res = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${userToken}` },
        })
        if (res.ok) return res
        // 403/404 → file may be in admin Drive, try admin token
        if (res.status !== 403 && res.status !== 404) {
            return res // other errors return as-is
        }
    } catch {
        // user has no Drive token connected — fall through to admin
    }

    // Fallback to admin token (files uploaded by NeeFlow's admin Drive integration)
    const adminToken = await getGDriveAccessToken()
    return fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${adminToken}` },
    })
}

export const maxDuration = 30

/**
 * POST /api/user/gdrive/import-file
 * Downloads a Google Drive file using the user's access token and re-uploads it
 * to R2 (or Google Drive fallback), returning a public MediaItem.
 *
 * Body: { fileId: string, mimeType: string, fileName: string, channelId: string }
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
        // ─── Deduplication: reuse existing MediaItem with same Drive file ID ──
        const existing = await prisma.mediaItem.findFirst({
            where: {
                channelId,
                aiMetadata: {
                    path: ['driveFileId'],
                    equals: fileId,
                },
            },
        })
        if (existing) {
            return NextResponse.json(existing, { status: 200 })
        }

        // ─── Download the file from Google Drive (user token → admin fallback) ──
        const driveRes = await downloadDriveFile(fileId, session.user.id)

        if (!driveRes.ok) {
            return NextResponse.json(
                { error: `Failed to download from Drive: ${driveRes.status}` },
                { status: 400 }
            )
        }

        const resolvedMime = mimeType || driveRes.headers.get('content-type') || 'image/jpeg'
        if (!resolvedMime.startsWith('image/') && !resolvedMime.startsWith('video/')) {
            return NextResponse.json({ error: 'Only images and videos can be imported.' }, { status: 400 })
        }

        const buffer = Buffer.from(await driveRes.arrayBuffer())
        const fileSize = buffer.length

        // Max 50MB for Drive imports
        if (fileSize > 50 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })
        }

        // ─── Check storage quota ───────────────────────────────────────────
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

        // ─── Try R2 first ──────────────────────────────────────────────────
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
                    aiMetadata: {
                        storage: 'r2',
                        r2Key,
                        driveFileId: fileId,
                    },
                },
            })

            return NextResponse.json(mediaItem, { status: 201 })
        }

        // ─── Fallback: Google Drive (re-upload as public) — get access token ─
        const accessToken = await getUserGDriveAccessToken(session.user.id)
            .catch(() => getGDriveAccessToken()) // use admin token if user has none
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
                aiMetadata: {
                    storage: 'gdrive',
                    gdriveFolderId: monthlyFolder.id,
                    driveFileId: fileId,
                    webViewLink: driveFile.webViewLink,
                },
            },
        })

        return NextResponse.json(mediaItem, { status: 201 })
    } catch (error) {
        console.error('Drive import-file error:', error)
        const msg = error instanceof Error ? error.message : 'Failed to import from Drive'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
