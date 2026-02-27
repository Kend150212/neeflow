/**
 * SmartFlow Ingestion Utility — Shared media ingestion for all content sources.
 * 
 * Used by: Portal uploads, Telegram bot, Discord bot, and future sources.
 * Flow: Download file → Upload to R2 → Create MediaItem + ContentJob (QUEUED)
 */

import { prisma } from '@/lib/prisma'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'

export interface IngestMediaOptions {
    channelId: string
    /** Direct URL to download the file from (or Buffer) */
    fileUrl?: string
    /** Raw file buffer (alternative to fileUrl) */
    fileBuffer?: Buffer | ArrayBuffer
    fileName: string
    mimeType: string
    /** Source identifier: 'portal' | 'telegram' | 'discord' | etc. */
    source: string
    /** Who uploaded: email or bot identifier */
    uploadedBy: string
}

export interface IngestResult {
    mediaItemId: string
    jobId: string
    url: string
}

/**
 * Ingest media into the SmartFlow pipeline.
 * Downloads the file, uploads to R2, creates MediaItem + ContentJob.
 */
export async function ingestMedia(opts: IngestMediaOptions): Promise<IngestResult> {
    const { channelId, fileUrl, fileBuffer, fileName, mimeType, source, uploadedBy } = opts

    // Verify R2 is configured
    const r2Ready = await isR2Configured()
    if (!r2Ready) {
        throw new Error('Storage (R2) not configured')
    }

    // Verify channel has pipeline enabled
    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { pipelineEnabled: true },
    })
    if (!channel) throw new Error(`Channel ${channelId} not found`)
    if (!channel.pipelineEnabled) {
        throw new Error('SmartFlow pipeline is not enabled for this channel')
    }

    // Get or create the media buffer
    let buffer: Buffer | ArrayBuffer
    if (fileBuffer) {
        buffer = fileBuffer
    } else if (fileUrl) {
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error(`Failed to download file: ${response.status}`)
        buffer = await response.arrayBuffer()
    } else {
        throw new Error('Either fileUrl or fileBuffer is required')
    }

    const fileSize = buffer instanceof Buffer ? buffer.length : buffer.byteLength

    // Upload to R2
    const r2Key = generateR2Key(channelId, fileName)
    const publicUrl = await uploadToR2(buffer, r2Key, mimeType)

    // Auto-create pipeline folder
    let folder = await prisma.mediaFolder.findFirst({
        where: { channelId, name: `📸 ${source.charAt(0).toUpperCase() + source.slice(1)} Uploads`, parentId: null },
    })
    if (!folder) {
        folder = await prisma.mediaFolder.create({
            data: { channelId, name: `📸 ${source.charAt(0).toUpperCase() + source.slice(1)} Uploads`, parentId: null },
        })
    }

    const fileType = mimeType.startsWith('video/') ? 'video' : 'image'

    // Create MediaItem + ContentJob in a transaction
    const result = await prisma.$transaction(async (tx) => {
        const mediaItem = await tx.mediaItem.create({
            data: {
                channelId,
                folderId: folder!.id,
                url: publicUrl,
                thumbnailUrl: fileType === 'image' ? publicUrl : null,
                storageFileId: r2Key,
                type: fileType,
                source,
                originalName: fileName,
                fileSize,
                mimeType,
                aiMetadata: { storage: 'r2', r2Key, ingestSource: source },
            },
        })

        const job = await tx.contentJob.create({
            data: {
                channelId,
                mediaItemId: mediaItem.id,
                status: 'QUEUED',
                uploadedBy,
            },
        })

        return { mediaItem, job }
    })

    console.log(`[SmartFlow Ingest] ${source} → MediaItem ${result.mediaItem.id}, Job ${result.job.id}`)

    return {
        mediaItemId: result.mediaItem.id,
        jobId: result.job.id,
        url: publicUrl,
    }
}
