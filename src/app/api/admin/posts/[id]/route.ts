import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPendingApprovalWebhooks } from '@/lib/webhook-notify'

// GET /api/admin/posts/[id] — single post with full relations
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const post = await prisma.post.findUnique({
        where: { id },
        include: {
            channel: {
                select: {
                    id: true,
                    displayName: true,
                    name: true,
                    language: true,
                    vibeTone: true,
                    defaultAiProvider: true,
                    defaultAiModel: true,
                    platforms: {
                        select: { id: true, platform: true, accountId: true, accountName: true },
                    },
                },
            },
            author: { select: { id: true, name: true, email: true } },
            media: {
                include: {
                    mediaItem: true,
                },
                orderBy: { sortOrder: 'asc' },
            },
            platformStatuses: true,
            approvals: {
                orderBy: { createdAt: 'desc' },
            },
        },
    })

    if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Access check for non-admin
    if (session.user.role !== 'ADMIN') {
        const member = await prisma.channelMember.findFirst({
            where: { channelId: post.channelId, userId: session.user.id },
        })
        if (!member) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    return NextResponse.json(post)
}

// PUT /api/admin/posts/[id] — update post
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const {
        content,
        contentPerPlatform,
        status,
        scheduledAt,
        mediaIds,
        platforms,
        requestApproval,  // boolean — used when channel.requireApproval === 'optional'
    } = body

    // Verify post exists
    const existing = await prisma.post.findUnique({
        where: { id },
        include: { channel: true },
    })
    if (!existing) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Access check
    if (session.user.role !== 'ADMIN' && existing.authorId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cannot edit published posts (only allow re-scheduling failed ones)
    if (existing.status === 'PUBLISHED' || existing.status === 'PUBLISHING') {
        return NextResponse.json(
            { error: 'Cannot edit a published or publishing post' },
            { status: 400 }
        )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (content !== undefined) updateData.content = content
    if (contentPerPlatform !== undefined) updateData.contentPerPlatform = contentPerPlatform
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null

    if (status) {
        const approvalMode = existing.channel.requireApproval as unknown as string // 'none'|'optional'|'required'
        const fromDraft = existing.status === 'DRAFT'
        if (
            (approvalMode === 'required' && status !== 'DRAFT') ||
            (approvalMode === 'optional' && requestApproval && status !== 'DRAFT' && fromDraft)
        ) {
            updateData.status = 'PENDING_APPROVAL'
        } else {
            updateData.status = status
        }
    }

    // Update content hash
    if (content) {
        updateData.contentHash = Buffer.from(content).toString('base64').slice(0, 32)
    }

    // Transaction: update post + media + platforms
    const post = await prisma.$transaction(async (tx) => {
        // Update media if provided
        if (mediaIds !== undefined) {
            await tx.postMedia.deleteMany({ where: { postId: id } })
            if (mediaIds.length > 0) {
                await tx.postMedia.createMany({
                    data: mediaIds.map((mediaItemId: string, index: number) => ({
                        postId: id,
                        mediaItemId,
                        sortOrder: index,
                    })),
                })
            }
        }

        // Update platform statuses if provided
        if (platforms !== undefined) {
            await tx.postPlatformStatus.deleteMany({ where: { postId: id } })
            if (platforms.length > 0) {
                await tx.postPlatformStatus.createMany({
                    data: platforms.map((p: { platform: string; accountId: string;[key: string]: unknown }) => {
                        const { platform, accountId, ...rest } = p
                        const config = Object.keys(rest).length > 0 ? rest : undefined
                        return {
                            postId: id,
                            platform,
                            accountId,
                            status: 'pending',
                            ...(config ? { config } : {}),
                        }
                    }),
                    skipDuplicates: true,
                })
            }
        }

        return tx.post.update({
            where: { id },
            data: updateData,
            include: {
                channel: { select: { id: true, displayName: true, name: true } },
                author: { select: { id: true, name: true, email: true } },
                media: {
                    include: {
                        mediaItem: {
                            select: { id: true, url: true, thumbnailUrl: true, type: true, originalName: true },
                        },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
                platformStatuses: true,
            },
        })
    })

    // Fire webhook notification when post transitions to PENDING_APPROVAL
    if (post.status === 'PENDING_APPROVAL' && existing.status === 'DRAFT') {
        try {
            const appBaseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            const firstImage = post.media?.[0]?.mediaItem?.url || null
            const fullImageUrl = firstImage && !firstImage.startsWith('http')
                ? `${appBaseUrl}${firstImage}` : firstImage
            const channel = existing.channel
            await sendPendingApprovalWebhooks(
                {
                    webhookDiscord: channel.webhookDiscord as Record<string, string> | null,
                    webhookTelegram: channel.webhookTelegram as Record<string, string> | null,
                    webhookSlack: channel.webhookSlack as Record<string, string> | null,
                    webhookZalo: { ...(channel.webhookZalo as Record<string, string> || {}), channelId: channel.id } as Record<string, string> | null,
                    webhookCustom: channel.webhookCustom as Record<string, string> | null,
                    webhookEvents: channel.webhookEvents as string[] | null,
                },
                {
                    postId: post.id,
                    content: post.content || '',
                    authorName: post.author?.name || post.author?.email || 'Unknown',
                    channelName: channel.name,
                    platforms: post.platformStatuses.map((ps: { platform: string }) => ps.platform),
                    scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : null,
                    imageUrl: fullImageUrl,
                    appBaseUrl,
                },
            )
        } catch (err) {
            console.warn('[Webhook] Pending approval notification error:', err)
        }
    }

    return NextResponse.json(post)
}

// PATCH /api/admin/posts/[id] — lightweight update (scheduledAt only), used by calendar drag-drop
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { scheduledAt } = body

    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (session.user.role !== 'ADMIN' && existing.authorId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const post = await prisma.post.update({
        where: { id },
        data: {
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            // If rescheduling a FAILED post, reset it to SCHEDULED
            ...(existing.status === 'FAILED' ? { status: 'SCHEDULED' } : {}),
        },
        select: { id: true, scheduledAt: true, status: true },
    })

    return NextResponse.json(post)
}

// DELETE /api/admin/posts/[id] — delete post
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Only admin or author can delete
    if (session.user.role !== 'ADMIN' && post.authorId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete related records first, then the post
    await prisma.$transaction([
        prisma.postMedia.deleteMany({ where: { postId: id } }),
        prisma.postPlatformStatus.deleteMany({ where: { postId: id } }),
        prisma.postApproval.deleteMany({ where: { postId: id } }),
        prisma.post.delete({ where: { id } }),
    ])

    return NextResponse.json({ success: true })
}
