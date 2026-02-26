import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/portal/upload — Client uploads media for auto content pipeline
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { channelId, mediaItems } = body as {
            channelId: string
            mediaItems: Array<{
                url: string
                thumbnailUrl?: string
                type: string
                originalName?: string
                fileSize?: number
                mimeType?: string
            }>
        }

        if (!channelId || !mediaItems?.length) {
            return NextResponse.json({ error: 'channelId and mediaItems required' }, { status: 400 })
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
            where: {
                channelId,
                name: '📸 Client Uploads',
                parentId: null,
            },
        })
        if (!folder) {
            folder = await prisma.mediaFolder.create({
                data: {
                    channelId,
                    name: '📸 Client Uploads',
                    parentId: null,
                },
            })
        }

        // Create MediaItems and ContentJobs in a transaction
        const jobs = await prisma.$transaction(async (tx) => {
            const createdJobs = []

            for (const item of mediaItems) {
                // Create MediaItem in the dedicated folder
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

                // Create ContentJob in queue
                const job = await tx.contentJob.create({
                    data: {
                        channelId,
                        mediaItemId: mediaItem.id,
                        status: 'QUEUED',
                        uploadedBy: session.user!.email!,
                    },
                })

                createdJobs.push({
                    jobId: job.id,
                    mediaItemId: mediaItem.id,
                    status: job.status,
                    url: item.url,
                    originalName: item.originalName,
                })
            }

            return createdJobs
        })

        return NextResponse.json({
            success: true,
            jobs,
            message: `${jobs.length} item(s) queued for AI processing`,
        })
    } catch (error) {
        console.error('Portal upload error:', error)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
}
