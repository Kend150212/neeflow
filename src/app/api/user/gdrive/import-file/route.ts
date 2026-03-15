import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
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
 * Downloads a Google Drive file and re-uploads it to R2 (or Drive fallback),
 * returning a public MediaItem.
 *
 * Body: { fileId, mimeType, fileName, channelId, pickerAccessToken }
 *   pickerAccessToken — the short-lived token already used to open the Google Picker.
 *   It has the user's full Drive scopes so it can download ANY file the user can see.
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId, mimeType, fileName, channelId, pickerAccessToken } = await req.json()

    if (!fileId || !channelId) {
        return NextResponse.json({ error: 'fileId and channelId are required' }, { status: 400 })
    }

    if (!pickerAccessToken) {
        return NextResponse.json({ error: 'pickerAccessToken is required' }, { status: 400 })
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

        // ─── Download via picker access token (has user's full Drive scopes) ─
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
        const driveRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${pickerAccessToken}` },
        })

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

        // ─── Fallback: Google Drive (re-upload as public) — use picker token ─
        const accessToken = pickerAccessToken
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
