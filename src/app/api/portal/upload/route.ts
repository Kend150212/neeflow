import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/portal/upload
 * Creates ContentJob entries for media items that were already uploaded
 * via the standard init-upload → complete-upload flow.
 * 
 * Accepts either:
 *   - mediaItemIds: string[]  (preferred — IDs returned by complete-upload)
 *   - mediaItems: Array<{ url, ... }>  (fallback — creates MediaItems inline)
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { channelId, mediaItemIds, mediaItems } = body as {
            channelId: string
            mediaItemIds?: string[]
            mediaItems?: Array<{
                id?: string
                url?: string
                thumbnailUrl?: string
                type?: string
                originalName?: string
                fileSize?: number
                mimeType?: string
            }>
        }

        if (!channelId) {
            return NextResponse.json({ error: 'channelId required' }, { status: 400 })
        }

        // Verify user has access to this channel
        const membership = await prisma.channelMember.findFirst({
            where: {
                channelId,
                user: { email: session.user.email },
            },
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
                { error: 'Auto Content Pipeline is not enabled for this channel' },
                { status: 400 }
            )
        }

        // Auto-create "📸 Client Uploads" folder if not exists
        let folder = await prisma.mediaFolder.findFirst({
            where: { channelId, name: '📸 Client Uploads', parentId: null },
        })
        if (!folder) {
            folder = await prisma.mediaFolder.create({
                data: { channelId, name: '📸 Client Uploads', parentId: null },
            })
        }

        // ─── Path A: mediaItemIds provided (from complete-upload) ─────
        if (mediaItemIds?.length) {
            // Move media items to the pipeline folder and create ContentJobs
            const jobs = await prisma.$transaction(async (tx) => {
                const createdJobs = []
                for (const mediaItemId of mediaItemIds) {
                    // Move to pipeline folder
                    await tx.mediaItem.update({
                        where: { id: mediaItemId },
                        data: { folderId: folder!.id },
                    })
                    // Create ContentJob
                    const job = await tx.contentJob.create({
                        data: {
                            channelId,
                            mediaItemId,
                            status: 'QUEUED',
                            uploadedBy: session.user!.email!,
                        },
                    })
                    createdJobs.push({ jobId: job.id, mediaItemId, status: 'QUEUED' })
                }
                return createdJobs
            })

            return NextResponse.json({
                success: true,
                jobs,
                message: `${jobs.length} item(s) queued for AI processing`,
            })
        }

        // ─── Path B: mediaItems with url provided (fallback) ──────────
        if (mediaItems?.length) {
            const jobs = await prisma.$transaction(async (tx) => {
                const createdJobs = []
                for (const item of mediaItems) {
                    // If item has id, it's an existing MediaItem
                    if (item.id) {
                        await tx.mediaItem.update({
                            where: { id: item.id },
                            data: { folderId: folder!.id },
                        })
                        const job = await tx.contentJob.create({
                            data: {
                                channelId,
                                mediaItemId: item.id,
                                status: 'QUEUED',
                                uploadedBy: session.user!.email!,
                            },
                        })
                        createdJobs.push({ jobId: job.id, mediaItemId: item.id, status: 'QUEUED' })
                    } else if (item.url) {
                        // Create a new MediaItem with the provided URL
                        const mediaItem = await tx.mediaItem.create({
                            data: {
                                channelId,
                                folderId: folder!.id,
                                url: item.url,
                                thumbnailUrl: item.thumbnailUrl || null,
                                type: item.type || 'image',
                                source: 'upload',
                                originalName: item.originalName || null,
                                fileSize: item.fileSize || null,
                                mimeType: item.mimeType || null,
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
                        createdJobs.push({ jobId: job.id, mediaItemId: mediaItem.id, status: 'QUEUED' })
                    }
                }
                return createdJobs
            })

            return NextResponse.json({
                success: true,
                jobs,
                message: `${jobs.length} item(s) queued for AI processing`,
            })
        }

        return NextResponse.json({ error: 'mediaItemIds or mediaItems required' }, { status: 400 })
    } catch (error) {
        console.error('Portal upload error:', error)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
}
