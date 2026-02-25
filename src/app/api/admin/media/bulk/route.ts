import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGDriveAccessToken } from '@/lib/gdrive'
import { deleteFromR2 } from '@/lib/r2'

// POST /api/admin/media/bulk — bulk operations (delete, move)
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, ids, folderId } = body as {
        action: 'delete' | 'move'
        ids: string[]
        folderId?: string | null
    }

    if (!action || !ids?.length) {
        return NextResponse.json({ error: 'action and ids are required' }, { status: 400 })
    }

    if (action === 'delete') {
        // Get all media items to delete
        const mediaItems = await prisma.mediaItem.findMany({
            where: { id: { in: ids } },
        })

        // Separate R2 and GDrive items
        const r2Items = mediaItems.filter((m) => {
            const meta = (m.aiMetadata || {}) as Record<string, string>
            return meta.storage === 'r2' && m.storageFileId
        })
        const gdriveItems = mediaItems.filter((m) => {
            const meta = (m.aiMetadata || {}) as Record<string, string>
            return meta.storage !== 'r2' && m.storageFileId
        })

        // Delete from R2
        if (r2Items.length > 0) {
            await Promise.allSettled(
                r2Items.map(async (m) => {
                    const meta = (m.aiMetadata || {}) as Record<string, string>
                    await deleteFromR2(m.storageFileId!)
                    // Also delete thumbnail if separate
                    if (m.thumbnailUrl && m.thumbnailUrl !== m.url) {
                        const thumbKey = m.storageFileId!.replace(/\.[^.]+$/, '_thumb.jpg')
                        await deleteFromR2(thumbKey).catch(() => { })
                    }
                    // Also delete the original R2 file if this was transcoded
                    if (meta.originalR2Key && meta.originalR2Key !== m.storageFileId) {
                        await deleteFromR2(meta.originalR2Key).catch(() => { })
                        const origThumbKey = meta.originalR2Key.replace(/\.[^.]+$/, '_thumb.jpg')
                        await deleteFromR2(origThumbKey).catch(() => { })
                    }
                })
            )
        }

        // Delete from Google Drive (legacy)
        if (gdriveItems.length > 0) {
            try {
                const accessToken = await getGDriveAccessToken()
                await Promise.allSettled(
                    gdriveItems.map((m) =>
                        fetch(`https://www.googleapis.com/drive/v3/files/${m.storageFileId}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${accessToken}` },
                        })
                    )
                )
            } catch (err) {
                console.warn('Bulk GDrive delete partial failure:', err)
            }
        }

        // Delete post_media references first
        await prisma.postMedia.deleteMany({ where: { mediaItemId: { in: ids } } })
        // Delete media items
        const result = await prisma.mediaItem.deleteMany({ where: { id: { in: ids } } })

        return NextResponse.json({ success: true, deletedCount: result.count })
    }

    if (action === 'move') {
        const result = await prisma.mediaItem.updateMany({
            where: { id: { in: ids } },
            data: { folderId: folderId || null },
        })

        return NextResponse.json({ success: true, movedCount: result.count })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
