import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGDriveAccessToken } from '@/lib/gdrive'
import { deleteFromR2 } from '@/lib/r2'

/**
 * DELETE /api/admin/media/[id]
 * Deletes a media item from storage (R2 or GDrive) and the database.
 */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const media = await prisma.mediaItem.findUnique({ where: { id } })
    if (!media) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Determine storage type from metadata
    const metadata = (media.aiMetadata || {}) as Record<string, string>
    const storageType = metadata.storage || 'gdrive' // Default to gdrive for old media

    if (media.storageFileId) {
        try {
            if (storageType === 'r2') {
                // Delete from R2
                await deleteFromR2(media.storageFileId)

                // Also delete thumbnail if it's a separate R2 object
                if (media.thumbnailUrl && media.thumbnailUrl !== media.url) {
                    const thumbKey = media.storageFileId.replace(/\.[^.]+$/, '_thumb.jpg')
                    await deleteFromR2(thumbKey).catch(() => { })
                }

                // Also delete the original R2 file if this was transcoded
                // (background transcoding creates a new .mp4 but the original .mov stays in R2)
                if (metadata.originalR2Key && metadata.originalR2Key !== media.storageFileId) {
                    await deleteFromR2(metadata.originalR2Key).catch(() => { })
                    // Delete original file's thumbnail too
                    const origThumbKey = metadata.originalR2Key.replace(/\.[^.]+$/, '_thumb.jpg')
                    await deleteFromR2(origThumbKey).catch(() => { })
                }
            } else {
                // Delete from Google Drive (legacy)
                const accessToken = await getGDriveAccessToken()
                await fetch(
                    `https://www.googleapis.com/drive/v3/files/${media.storageFileId}`,
                    {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }
                )

                // Try to delete thumbnail from Drive too
                if (media.thumbnailUrl?.includes('lh3.googleusercontent.com') || media.thumbnailUrl?.includes('drive.google.com')) {
                    // Thumbnail is GDrive-hosted, might have its own file ID
                    // but we don't store it separately, so skip
                }
            }
        } catch (err) {
            console.warn(`Failed to delete from ${storageType}:`, err)
            // Continue with DB deletion even if storage delete fails
        }
    }

    // Delete from database
    await prisma.postMedia.deleteMany({ where: { mediaItemId: id } })
    await prisma.mediaItem.delete({ where: { id } })

    return NextResponse.json({ success: true })
}
