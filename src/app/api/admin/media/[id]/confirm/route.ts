import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { backgroundTranscodeFromR2 } from '@/lib/media-transcode'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/media/[id]/confirm
 * Called after a successful direct R2 upload.
 * - Updates source: 'uploading' → 'upload'
 * - For videos: fires background transcode (download from R2, encode H264, re-upload)
 */
export async function PATCH(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const mediaItem = await prisma.mediaItem.findUnique({
        where: { id },
    })

    if (!mediaItem) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Mark as fully uploaded
    const updated = await prisma.mediaItem.update({
        where: { id },
        data: { source: 'upload' },
    })

    // Fire background transcode for videos (non-blocking)
    if (updated.type === 'video') {
        const r2Key = updated.storageFileId || ''
        if (r2Key) {
            backgroundTranscodeFromR2(
                updated.id,
                updated.url,
                r2Key,
                updated.originalName || updated.id,
                updated.mimeType || 'video/mp4',
                updated.channelId,
            ).catch(err => console.error('[confirm] bg transcode error:', err))
        }
    }

    return NextResponse.json(updated)
}
