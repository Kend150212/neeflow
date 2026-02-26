import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'

/**
 * POST /api/portal/upload/file
 * 
 * Accepts two modes:
 * 1. JSON body with R2 info (direct upload flow — browser uploaded directly to R2)
 *    { channelId, storage, r2Key, publicUrl, fileName, mimeType, fileSize }
 * 
 * 2. FormData with file (server proxy fallback — browser → server → R2)
 *    FormData { file, channelId }
 * 
 * Both modes create MediaItem + ContentJob.
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const contentType = req.headers.get('content-type') || ''
        let channelId: string
        let publicUrl: string
        let r2Key: string
        let fileName: string
        let mimeType: string
        let fileSize: number

        if (contentType.includes('application/json')) {
            // ─── Mode 1: Direct R2 upload (JSON body) ─────────────────
            const body = await req.json()
            channelId = body.channelId
            r2Key = body.r2Key
            publicUrl = body.publicUrl
            fileName = body.fileName
            mimeType = body.mimeType
            fileSize = body.fileSize || 0

            if (!channelId || !r2Key || !publicUrl) {
                return NextResponse.json({ error: 'channelId, r2Key, publicUrl required' }, { status: 400 })
            }
        } else {
            // ─── Mode 2: Server proxy upload (FormData) ────────────────
            const formData = await req.formData()
            const file = formData.get('file') as File | null
            channelId = formData.get('channelId') as string

            if (!file || !channelId) {
                return NextResponse.json({ error: 'file and channelId required' }, { status: 400 })
            }

            const useR2 = await isR2Configured()
            if (!useR2) {
                return NextResponse.json({ error: 'Storage (R2) not configured' }, { status: 500 })
            }

            const buffer = await file.arrayBuffer()
            r2Key = generateR2Key(channelId, file.name)
            publicUrl = await uploadToR2(buffer, r2Key, file.type)
            fileName = file.name
            mimeType = file.type
            fileSize = file.size
        }

        // ─── Common: verify access & create records ──────────────────
        const membership = await prisma.channelMember.findFirst({
            where: { channelId, user: { email: session.user.email } },
        })
        if (!membership) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }

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

        // Auto-create pipeline folder
        let folder = await prisma.mediaFolder.findFirst({
            where: { channelId, name: '📸 Client Uploads', parentId: null },
        })
        if (!folder) {
            folder = await prisma.mediaFolder.create({
                data: { channelId, name: '📸 Client Uploads', parentId: null },
            })
        }

        const fileType = mimeType.startsWith('video/') ? 'video' : 'image'

        // Create MediaItem + ContentJob
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
                    originalName: fileName,
                    fileSize: fileSize || 0,
                    mimeType,
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
