/**
 * Shared video transcoding helpers.
 * Used by both /api/admin/media (server upload) and /api/admin/media/[id]/confirm (direct R2 upload).
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { prisma } from '@/lib/prisma'

const execAsync = promisify(exec)

/**
 * Extracts a thumbnail from a video buffer and uploads it to R2.
 */
export async function generateVideoThumbnailFromBuffer(
    videoBuffer: Buffer,
    channelId: string,
    videoKey: string,
): Promise<string> {
    try {
        const id = randomUUID().slice(0, 8)
        const tmpVideo = join(tmpdir(), `vid_${id}.mp4`)
        const tmpThumb = join(tmpdir(), `thumb_${id}.jpg`)

        await writeFile(tmpVideo, videoBuffer)
        await execAsync(
            `ffmpeg -i "${tmpVideo}" -ss 00:00:01 -vframes 1 -q:v 2 -y "${tmpThumb}"`,
            { timeout: 15000 }
        )
        const thumbBuffer = await readFile(tmpThumb)
        await Promise.all([
            unlink(tmpVideo).catch(() => { }),
            unlink(tmpThumb).catch(() => { }),
        ])

        const thumbKey = videoKey.replace(/\.[^.]+$/, '_thumb.jpg')
        return await uploadToR2(thumbBuffer, thumbKey, 'image/jpeg')
    } catch {
        return ''
    }
}

/**
 * Downloads a file from R2 by fetching its public URL.
 */
async function downloadFromR2(publicUrl: string): Promise<Buffer> {
    const res = await fetch(publicUrl)
    if (!res.ok) throw new Error(`Failed to download from R2: ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
}

/**
 * Background transcode job for a direct-to-R2 uploaded video.
 * Downloads the original from R2, checks/transcodes to H.264, re-uploads, updates DB.
 */
export async function backgroundTranscodeFromR2(
    mediaItemId: string,
    publicUrl: string,
    r2Key: string,
    originalName: string,
    originalType: string,
    channelId: string,
): Promise<void> {
    try {
        console.log(`[Transcode BG-R2] ${originalName}: downloading from R2...`)
        const buffer = await downloadFromR2(publicUrl)

        // Check codec
        const id = randomUUID().slice(0, 8)
        const tmpInput = join(tmpdir(), `input_${id}_${originalName}`)
        const tmpOutput = join(tmpdir(), `transcoded_${id}.mp4`)
        await writeFile(tmpInput, buffer)

        let codec = 'unknown'
        try {
            const { stdout } = await execAsync(
                `ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${tmpInput}"`,
                { timeout: 10000 }
            )
            codec = stdout.trim().toLowerCase()
        } catch { /* ignore */ }

        const ext = originalName.replace(/.*\./, '.').toLowerCase()
        const alreadyH264 = codec === 'h264' && (ext === '.mp4' || originalType === 'video/mp4')

        if (alreadyH264) {
            console.log(`[Transcode BG-R2] ${originalName}: already H.264 — generating thumbnail only`)
            await unlink(tmpInput).catch(() => { })
            // Generate thumbnail
            const thumbUrl = await generateVideoThumbnailFromBuffer(buffer, channelId, r2Key)
            await prisma.mediaItem.update({
                where: { id: mediaItemId },
                data: {
                    ...(thumbUrl ? { thumbnailUrl: thumbUrl } : {}),
                    aiMetadata: { storage: 'r2', r2Key, transcodeStatus: 'skipped', codec: 'h264' },
                },
            })
            return
        }

        // Transcode to H.264
        console.log(`[Transcode BG-R2] ${originalName}: transcoding ${codec} → H.264...`)
        await execAsync(
            `ffmpeg -i "${tmpInput}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart -y "${tmpOutput}"`,
            { timeout: 300000 }
        )
        const transcodedBuffer = await readFile(tmpOutput)
        await Promise.all([unlink(tmpInput).catch(() => { }), unlink(tmpOutput).catch(() => { })])

        const newR2Key = r2Key.replace(/\.[^.]+$/, '.mp4')
        const newUrl = await uploadToR2(transcodedBuffer, newR2Key, 'video/mp4')

        const thumbUrl = await generateVideoThumbnailFromBuffer(transcodedBuffer, channelId, newR2Key)

        await prisma.mediaItem.update({
            where: { id: mediaItemId },
            data: {
                url: newUrl,
                storageFileId: newR2Key,
                fileSize: transcodedBuffer.length,
                mimeType: 'video/mp4',
                ...(thumbUrl ? { thumbnailUrl: thumbUrl } : {}),
                aiMetadata: {
                    storage: 'r2', r2Key: newR2Key, originalR2Key: r2Key,
                    transcodeStatus: 'done', transcodedTo: 'h264/aac/mp4',
                },
            },
        })

        // Delete original if key changed
        if (r2Key !== newR2Key) {
            await deleteFromR2(r2Key).catch(() => { })
        }

        console.log(`[Transcode BG-R2] ${originalName}: ✅ done`)
    } catch (err) {
        console.error(`[Transcode BG-R2] ${originalName}: ❌ failed`, err)
        await prisma.mediaItem.update({
            where: { id: mediaItemId },
            data: {
                aiMetadata: {
                    storage: 'r2', r2Key,
                    transcodeStatus: 'failed',
                    error: err instanceof Error ? err.message : String(err),
                },
            },
        }).catch(() => { })
    }
}
