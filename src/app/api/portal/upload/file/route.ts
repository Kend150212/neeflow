import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'

/**
 * POST /api/portal/upload/file
 * Server-side file upload proxy for portal.
 * Accepts FormData with file + channelId, uploads to R2,
 * creates MediaItem, and creates ContentJob.
 *
 * This avoids CORS issues with direct browser → R2 presigned URL uploads.
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const channelId = formData.get('channelId') as string | null

        if (!file || !channelId) {
            return NextResponse.json({ error: 'file and channelId required' }, { status: 400 })
        }

        // Verify user has access to this channel
        const membership = await prisma.channelMember.findFirst({
            where: { channelId, user: { email: session.user.email } },
        })
        if (!membership) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }

        // Check pipeline is enabled
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { pipelineEnabled: true },
        })
        if (!channel?.pipelineEnabled) {
            return NextResponse.json(
                { error: 'Auto Content Pipeline chưa được bật cho channel này. Vào Channel Settings → Auto Content để bật.' },
                { status: 400 }
            )
        }

        // Check R2 is configured
        const useR2 = await isR2Configured()
        if (!useR2) {
            return NextResponse.json({ error: 'Storage (R2) not configured' }, { status: 500 })
        }

        // Upload file to R2
        const buffer = await file.arrayBuffer()
        const r2Key = generateR2Key(channelId, file.name)
        const publicUrl = await uploadToR2(buffer, r2Key, file.type)

        // Auto-create pipeline folder
        let folder = await prisma.mediaFolder.findFirst({
            where: { channelId, name: '📸 Client Uploads', parentId: null },
        })
        if (!folder) {
            folder = await prisma.mediaFolder.create({
                data: { channelId, name: '📸 Client Uploads', parentId: null },
            })
        }

        const fileType = file.type.startsWith('video/') ? 'video' : 'image'

        // Create MediaItem + ContentJob in transaction
        const result = await prisma.$transaction(async (tx) => {
            const mediaItem = await tx.mediaItem.create({
                data: {
                    channelId,
                    folderId: folder!.id,
                    url: publicUrl,
                    thumbnailUrl: fileType === 'image' ? publicUrl : null,
                    storageFileId: r2Key,
                    type: fileType,
                    source: 'upload',
                    originalName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    aiMetadata: { storage: 'r2', r2Key },
                },
            })

            const job = await tx.contentJob.create({
                data: {
                    channelId,
                    mediaItemId: mediaItem.id,
                    status: 'QUEUED',
                    uploadedBy: session.user!.email!,
                },
            })

            return { mediaItem, job }
        })

        return NextResponse.json({
            success: true,
            mediaItemId: result.mediaItem.id,
            jobId: result.job.id,
            url: publicUrl,
            status: 'QUEUED',
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Upload failed'
        console.error('[Portal file upload] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
