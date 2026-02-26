import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGDriveAccessToken, getUserGDriveAccessToken, uploadFile, makeFilePublic, getOrCreateChannelFolder, getOrCreateMonthlyFolder } from '@/lib/gdrive'
import { uploadToR2, generateR2Key, isR2Configured, deleteFromR2 } from '@/lib/r2'
import { checkStorageQuota } from '@/lib/storage-quota'
import { randomUUID } from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const execAsync = promisify(exec)

// Allow large file uploads (up to 60MB)
export const maxDuration = 120 // seconds (increased for transcoding)
export const dynamic = 'force-dynamic'

/**
 * Check video codec and transcode to H.264/AAC MP4 if needed.
 * Instagram/Facebook/TikTok require H.264. Screen recordings often use HEVC.
 * Returns: { buffer, mimeType, fileName } — either original or transcoded.
 */
async function transcodeVideoIfNeeded(
    videoBuffer: Buffer,
    originalName: string,
    originalType: string,
): Promise<{ buffer: Buffer; mimeType: string; fileName: string; transcoded: boolean }> {
    const id = randomUUID().slice(0, 8)
    const tmpInput = join(tmpdir(), `input_${id}_${originalName}`)
    const ext = originalName.replace(/.*\./, '.').toLowerCase()
    const tmpOutput = join(tmpdir(), `transcoded_${id}.mp4`)

    try {
        // Write video to temp file
        await writeFile(tmpInput, videoBuffer)

        // Check codec with ffprobe
        let codec = 'unknown'
        try {
            const { stdout } = await execAsync(
                `ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${tmpInput}"`,
                { timeout: 10000 }
            )
            codec = stdout.trim().toLowerCase()
        } catch {
            console.warn(`[Transcode] ffprobe failed for ${originalName}, assuming needs transcoding`)
        }

        console.log(`[Transcode] ${originalName}: codec=${codec}, ext=${ext}, type=${originalType}`)

        // Skip transcoding if already H.264 MP4
        if (codec === 'h264' && (ext === '.mp4' || originalType === 'video/mp4')) {
            console.log(`[Transcode] ${originalName}: already H.264 MP4, skipping transcoding`)
            await unlink(tmpInput).catch(() => { })
            return { buffer: videoBuffer, mimeType: originalType, fileName: originalName, transcoded: false }
        }

        // Transcode to H.264/AAC MP4
        console.log(`[Transcode] ${originalName}: transcoding ${codec} → H.264/AAC MP4...`)
        await execAsync(
            `ffmpeg -i "${tmpInput}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart -y "${tmpOutput}"`,
            { timeout: 300000 } // 5 min timeout for large files
        )

        const transcodedBuffer = await readFile(tmpOutput)
        const newName = originalName.replace(/\.[^.]+$/, '.mp4')
        console.log(`[Transcode] ${originalName}: done! ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB → ${(transcodedBuffer.length / 1024 / 1024).toFixed(1)}MB`)

        // Clean up
        await unlink(tmpInput).catch(() => { })
        await unlink(tmpOutput).catch(() => { })

        return { buffer: transcodedBuffer, mimeType: 'video/mp4', fileName: newName, transcoded: true }
    } catch (err) {
        console.error(`[Transcode] Failed for ${originalName}:`, err)
        // Clean up on error
        await unlink(tmpInput).catch(() => { })
        await unlink(tmpOutput).catch(() => { })
        // Return original if transcoding fails
        return { buffer: videoBuffer, mimeType: originalType, fileName: originalName, transcoded: false }
    }
}

/**
 * Background transcode: runs AFTER the response is returned.
 * Checks codec, transcodes if not H.264, re-uploads to R2, updates DB.
 */
async function backgroundTranscode(
    mediaItemId: string,
    originalBuffer: Buffer,
    originalName: string,
    originalType: string,
    channelId: string,
    originalR2Key: string,
): Promise<void> {
    try {
        const result = await transcodeVideoIfNeeded(originalBuffer, originalName, originalType)

        if (!result.transcoded) {
            // Already H.264 — just mark as done
            console.log(`[Transcode BG] ${originalName}: already H.264, marking as done`)
            await prisma.mediaItem.update({
                where: { id: mediaItemId },
                data: {
                    aiMetadata: {
                        storage: 'r2',
                        r2Key: originalR2Key,
                        transcodeStatus: 'skipped',
                        codec: 'h264',
                    },
                },
            })
            return
        }

        // Upload transcoded file to R2 (new key with .mp4 extension)
        const newR2Key = originalR2Key.replace(/\.[^.]+$/, '.mp4')
        const newUrl = await uploadToR2(result.buffer, newR2Key, 'video/mp4')
        console.log(`[Transcode BG] ${originalName}: transcoded + re-uploaded → ${newUrl}`)

        // Update DB with transcoded file info
        await prisma.mediaItem.update({
            where: { id: mediaItemId },
            data: {
                url: newUrl,
                storageFileId: newR2Key,
                fileSize: result.buffer.length,
                mimeType: 'video/mp4',
                aiMetadata: {
                    storage: 'r2',
                    r2Key: newR2Key,
                    originalR2Key,
                    transcodeStatus: 'done',
                    originalCodec: originalType,
                    transcodedTo: 'h264/aac/mp4',
                },
            },
        })

        // Generate thumbnail from transcoded video (better quality)
        const thumbUrl = await generateVideoThumbnail(result.buffer, channelId, newR2Key, true)
        if (thumbUrl) {
            await prisma.mediaItem.update({
                where: { id: mediaItemId },
                data: { thumbnailUrl: thumbUrl },
            })
        }

        // Delete original file from R2 (save storage — transcoded .mp4 replaces it)
        if (originalR2Key !== newR2Key) {
            await deleteFromR2(originalR2Key).catch((err) =>
                console.warn(`[Transcode BG] ${originalName}: failed to delete original R2 file:`, err)
            )
            // Delete original file's thumbnail ONLY if it differs from the new thumbnail
            // (both keys collapse to _thumb.jpg, so they'll be the same — don't delete!)
            const origThumbKey = originalR2Key.replace(/\.[^.]+$/, '_thumb.jpg')
            const newThumbKey = newR2Key.replace(/\.[^.]+$/, '_thumb.jpg')
            if (origThumbKey !== newThumbKey) {
                await deleteFromR2(origThumbKey).catch(() => { })
            }
            console.log(`[Transcode BG] ${originalName}: 🗑️ deleted original R2 file (${originalR2Key})`)
        }

        console.log(`[Transcode BG] ${originalName}: ✅ complete (${(originalBuffer.length / 1024 / 1024).toFixed(1)}MB → ${(result.buffer.length / 1024 / 1024).toFixed(1)}MB)`)
    } catch (err) {
        console.error(`[Transcode BG] ${originalName}: ❌ failed:`, err)
        // Mark as failed in DB
        await prisma.mediaItem.update({
            where: { id: mediaItemId },
            data: {
                aiMetadata: {
                    storage: 'r2',
                    r2Key: originalR2Key,
                    transcodeStatus: 'failed',
                    error: err instanceof Error ? err.message : String(err),
                },
            },
        }).catch(() => { })
    }
}

/**
 * Generate a video thumbnail using ffmpeg.
 * Extracts a frame at 1s and uploads to R2 or Google Drive.
 */
async function generateVideoThumbnail(
    videoBuffer: Buffer,
    channelId: string,
    videoKey: string,
    useR2: boolean,
    accessToken?: string,
    parentFolderId?: string,
    videoFileId?: string,
): Promise<string> {
    const fallbackUrl = videoFileId
        ? `https://drive.google.com/thumbnail?id=${videoFileId}&sz=w400`
        : ''

    try {
        const id = randomUUID().slice(0, 8)
        const tmpVideo = join(tmpdir(), `vid_${id}.mp4`)
        const tmpThumb = join(tmpdir(), `thumb_${id}.jpg`)

        // Write video to temp file
        await writeFile(tmpVideo, videoBuffer)

        // Extract frame at 1 second (or first frame if video is shorter)
        await execAsync(
            `ffmpeg -i "${tmpVideo}" -ss 00:00:01 -vframes 1 -q:v 2 -y "${tmpThumb}"`,
            { timeout: 15000 }
        )

        // Read the thumbnail
        const thumbBuffer = await readFile(tmpThumb)

        // Clean up temp files
        await unlink(tmpVideo).catch(() => { })
        await unlink(tmpThumb).catch(() => { })

        if (useR2) {
            // Upload thumbnail to R2
            const thumbKey = videoKey.replace(/\.[^.]+$/, '_thumb.jpg')
            const thumbUrl = await uploadToR2(thumbBuffer, thumbKey, 'image/jpeg')
            return thumbUrl
        } else if (accessToken && parentFolderId) {
            // Upload thumbnail to Google Drive (legacy)
            const thumbName = `thumb_${videoFileId}.jpg`
            const thumbFile = await uploadFile(
                accessToken,
                thumbName,
                'image/jpeg',
                thumbBuffer,
                parentFolderId,
            )
            const publicUrl = await makeFilePublic(accessToken, thumbFile.id, 'image/jpeg')
            return publicUrl
        }

        return fallbackUrl
    } catch (err) {
        console.warn('ffmpeg thumbnail generation failed, using fallback:', err)
        return fallbackUrl
    }
}


// GET /api/admin/media — list media for a channel
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')
    const type = searchParams.get('type') // image, video
    const source = searchParams.get('source') // upload, ai_generated
    const folderId = searchParams.get('folderId') // null = root
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'newest' // newest, oldest, name, size
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    if (!channelId) {
        return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { channelId }
    if (type) where.type = type
    if (source) where.source = source
    if (folderId === 'root') {
        where.folderId = null
    } else if (folderId) {
        where.folderId = folderId
    }
    if (search) {
        where.originalName = { contains: search, mode: 'insensitive' }
    }

    // Sorting
    let orderBy: Record<string, string> = { createdAt: 'desc' }
    if (sort === 'oldest') orderBy = { createdAt: 'asc' }
    else if (sort === 'name') orderBy = { originalName: 'asc' }
    else if (sort === 'size') orderBy = { fileSize: 'desc' }

    const [media, total] = await Promise.all([
        prisma.mediaItem.findMany({
            where,
            skip,
            take: limit,
            orderBy,
        }),
        prisma.mediaItem.count({ where }),
    ])

    return NextResponse.json({
        media,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
}

// POST /api/admin/media — upload image/video to R2 (falls back to Google Drive)
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const channelId = formData.get('channelId') as string
    const file = formData.get('file') as File | null
    const mediaFolderId = formData.get('folderId') as string | null
    console.log('POST /api/admin/media — channelId:', channelId, 'file:', file?.name, 'size:', file?.size, 'type:', file?.type, 'folderId:', mediaFolderId)

    if (!channelId) {
        return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
    }
    if (!file) {
        return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
        // Images
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
        // Videos
        'video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/x-msvideo',
        'video/x-matroska', 'video/ogg', 'video/3gpp', 'video/x-flv',
        'video/x-ms-wmv', 'video/mpeg',
    ]
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
            { error: `Unsupported file type: ${file.type}. Supported: images (JPG, PNG, GIF, WebP, HEIC, AVIF) and videos (MP4, MOV, WebM, AVI, MKV)` },
            { status: 400 }
        )
    }

    // Max size: 50MB
    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })
    }

    // Read file into buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileType = file.type.startsWith('video/') ? 'video' : 'image'

    // ─── Check storage quota ─────────────────────────────────────────
    const quota = await checkStorageQuota(session.user.id, file.size)
    if (!quota.allowed) {
        return NextResponse.json(
            { error: quota.reason, code: 'STORAGE_LIMIT_REACHED', usedMB: quota.usedMB, limitMB: quota.limitMB },
            { status: 429 }
        )
    }

    // ─── Try R2 first ────────────────────────────────────────────────
    const useR2 = await isR2Configured()

    if (useR2) {
        try {
            // Upload ORIGINAL file to R2 immediately (no blocking transcode)
            const r2Key = generateR2Key(channelId, file.name)
            const publicUrl = await uploadToR2(buffer, r2Key, file.type)

            // Generate thumbnail (fast — just extract 1 frame)
            let thumbnailUrl = ''
            if (fileType === 'image') {
                thumbnailUrl = publicUrl // Images are their own thumbnail
            } else {
                thumbnailUrl = await generateVideoThumbnail(
                    buffer, channelId, r2Key, true,
                )
            }

            // Save to database immediately — user gets instant response
            const mediaItem = await prisma.mediaItem.create({
                data: {
                    channelId,
                    url: publicUrl,
                    thumbnailUrl: thumbnailUrl || publicUrl,
                    storageFileId: r2Key,
                    type: fileType,
                    source: 'upload',
                    originalName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    ...(mediaFolderId ? { folderId: mediaFolderId } : {}),
                    aiMetadata: {
                        storage: 'r2',
                        r2Key,
                        ...(fileType === 'video' ? { transcodeStatus: 'pending' } : {}),
                    },
                },
            })

            // ── Fire background transcoding for videos (non-blocking) ──
            if (fileType === 'video') {
                console.log(`[Upload] ${file.name}: returned response, starting background transcode...`)
                backgroundTranscode(mediaItem.id, buffer, file.name, file.type, channelId, r2Key)
                    .catch(err => console.error(`[Transcode BG] Unhandled error for ${mediaItem.id}:`, err))
            }

            return NextResponse.json(mediaItem, { status: 201 })
        } catch (error) {
            console.error('R2 upload failed:', error)
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'R2 upload failed' },
                { status: 500 }
            )
        }
    }

    // ─── Fallback: Google Drive ──────────────────────────────────────
    try {
        let accessToken: string
        let targetFolderId: string

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { gdriveRefreshToken: true, gdriveFolderId: true, role: true },
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
        } else if (user?.role === 'ADMIN') {
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
        } else {
            return NextResponse.json(
                { error: 'No storage configured. Ask your admin to set up Cloudflare R2 in API Hub.', code: 'STORAGE_NOT_CONFIGURED' },
                { status: 403 }
            )
        }

        const ext = file.name.split('.').pop() || 'jpg'
        const now = new Date()
        const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`
        const prefix = file.type.startsWith('video/') ? 'video' : 'image'
        const shortId = randomUUID().slice(0, 6)
        const uniqueName = `${prefix} ${shortId} - ${dateStr}.${ext}`

        const driveFile = await uploadFile(accessToken, uniqueName, file.type, buffer, targetFolderId)
        const publicUrl = await makeFilePublic(accessToken, driveFile.id, file.type)

        let thumbnailUrl: string
        if (fileType === 'image') {
            thumbnailUrl = `https://lh3.googleusercontent.com/d/${driveFile.id}=s400`
        } else {
            thumbnailUrl = await generateVideoThumbnail(
                buffer, channelId, '', false, accessToken, targetFolderId, driveFile.id,
            )
        }

        const mediaItem = await prisma.mediaItem.create({
            data: {
                channelId,
                url: publicUrl,
                thumbnailUrl,
                storageFileId: driveFile.id,
                type: fileType,
                source: 'upload',
                originalName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                ...(mediaFolderId ? { folderId: mediaFolderId } : {}),
                aiMetadata: {
                    storage: 'gdrive',
                    gdriveFolderId: targetFolderId,
                    webViewLink: driveFile.webViewLink,
                },
            },
        })

        return NextResponse.json(mediaItem, { status: 201 })
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Upload failed'
        if (errMsg.includes('not found') || errMsg.includes('not connected')) {
            return NextResponse.json(
                { error: 'No storage configured. Set up Cloudflare R2 (recommended) or Google Drive in API Hub.' },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: errMsg }, { status: 500 })
    }
}
