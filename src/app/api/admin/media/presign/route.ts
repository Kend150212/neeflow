import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateR2Key, getR2PresignedUrl, getR2PublicUrl, isR2Configured } from '@/lib/r2'
import { checkStorageQuota } from '@/lib/storage-quota'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/media/presign
 * Returns a presigned PUT URL so the client can upload directly to R2.
 * Also creates a placeholder MediaItem (source: 'uploading') in the DB.
 *
 * Body: { channelId, fileName, fileType, fileSize, folderId? }
 * Response: { presignedUrl, r2Key, mediaItemId, publicUrl }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check R2 is configured — presign only makes sense for R2
    const r2Available = await isR2Configured()
    if (!r2Available) {
        return NextResponse.json({ error: 'R2 not configured' }, { status: 400 })
    }

    const body = await req.json() as {
        channelId?: string
        fileName?: string
        fileType?: string
        fileSize?: number
        folderId?: string | null
    }

    const { channelId, fileName, fileType, fileSize, folderId } = body

    if (!channelId || !fileName || !fileType || !fileSize) {
        return NextResponse.json(
            { error: 'channelId, fileName, fileType and fileSize are required' },
            { status: 400 }
        )
    }

    // Validate file type
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/x-msvideo',
        'video/x-matroska', 'video/ogg', 'video/3gpp', 'video/x-flv',
        'video/x-ms-wmv', 'video/mpeg',
    ]
    if (!allowedTypes.includes(fileType)) {
        return NextResponse.json(
            { error: `Unsupported file type: ${fileType}` },
            { status: 400 }
        )
    }

    // File size limits
    const isVideoFile = fileType.startsWith('video/')
    const MAX_SIZE = isVideoFile ? 500 * 1024 * 1024 : 50 * 1024 * 1024
    const MAX_LABEL = isVideoFile ? '500MB' : '50MB'
    if (fileSize > MAX_SIZE) {
        return NextResponse.json(
            { error: `File too large. Maximum: ${MAX_LABEL}` },
            { status: 400 }
        )
    }

    // Check storage quota
    const quota = await checkStorageQuota(session.user.id, fileSize)
    if (!quota.allowed) {
        return NextResponse.json(
            { error: quota.reason, code: 'STORAGE_LIMIT_REACHED', usedMB: quota.usedMB, limitMB: quota.limitMB },
            { status: 429 }
        )
    }

    // Generate the R2 key + presigned URL
    const r2Key = generateR2Key(channelId, fileName)
    const presignedUrl = await getR2PresignedUrl(r2Key, fileType, fileSize)
    const publicUrl = getR2PublicUrl(r2Key)

    const fileMediaType = isVideoFile ? 'video' : 'image'

    // Create a placeholder DB record so the frontend gets a mediaItemId immediately
    const mediaItem = await prisma.mediaItem.create({
        data: {
            channelId,
            url: publicUrl,
            thumbnailUrl: isVideoFile ? '' : publicUrl,
            storageFileId: r2Key,
            type: fileMediaType,
            source: 'uploading', // marks this as in-progress
            originalName: fileName,
            fileSize,
            mimeType: fileType,
            ...(folderId ? { folderId } : {}),
            aiMetadata: {
                storage: 'r2',
                r2Key,
                ...(isVideoFile ? { transcodeStatus: 'pending' } : {}),
            },
        },
    })

    return NextResponse.json({
        presignedUrl,
        r2Key,
        mediaItemId: mediaItem.id,
        publicUrl,
    })
}
