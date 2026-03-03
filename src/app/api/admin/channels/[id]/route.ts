import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'

// Helper: check if user is admin or a member of the channel
async function checkAccess(userId: string, role: string, channelId: string) {
    if (role === 'ADMIN') return { allowed: true, member: null }
    const member = await prisma.channelMember.findUnique({
        where: { userId_channelId: { userId, channelId } },
        include: { permission: true },
    })
    return { allowed: !!member, member }
}

// GET /api/admin/channels/[id] — single channel with all relations
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const access = await checkAccess(session.user.id, session.user.role, id)
    if (!access.allowed) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channel = await prisma.channel.findUnique({
        where: { id },
        include: {
            members: {
                include: {
                    user: { select: { id: true, name: true, email: true, role: true } },
                    permission: true,
                },
            },
            platforms: true,
            knowledgeBase: { orderBy: { createdAt: 'desc' } },
            contentTemplates: { orderBy: { createdAt: 'desc' } },
            hashtagGroups: { orderBy: { name: 'asc' } },
            integrationOverrides: true,
            _count: { select: { posts: true, mediaItems: true } },
        },
    })

    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Add flags for AI API key (don't expose the encrypted key itself)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelData = channel as any
    const response = {
        ...channel,
        hasAiApiKey: !!channelData.aiApiKeyEncrypted,
        requireOwnApiKey: channelData.requireOwnApiKey ?? false,
        aiApiKeyEncrypted: undefined, // never expose encrypted key
    }

    return NextResponse.json(response)
}

// PUT /api/admin/channels/[id] — update channel settings
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const isAdmin = session.user.role === 'ADMIN'

    if (!isAdmin) {
        const access = await checkAccess(session.user.id, session.user.role, id)
        if (!access.allowed || !access.member?.permission?.canEditSettings) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const body = await req.json()

    const existing = await prisma.channel.findUnique({ where: { id } })
    if (!existing) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Build update data — only update fields that are provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    const allowedFields = [
        'displayName', 'description', 'avatarUrl', 'isActive', 'language', 'timezone',
        'descriptionsPerPlatform', 'vibeTone', 'seoTags',
        'colorPalette', 'logoPrompts', 'bannerPrompts',
        'notificationEmail', 'requireApproval',
        'defaultAiProvider', 'defaultAiModel',
        'defaultImageProvider', 'defaultImageModel',
        'storageProvider', 'storageConfig', 'useDefaultStorage',
        'webhookDiscord', 'webhookTelegram', 'webhookSlack', 'webhookZalo',
        'webhookCustom', 'webhookEvents',
        'businessInfo',
        'brandProfile',
    ]

    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            updateData[field] = body[field]
        }
    }

    // Handle AI API key — both admin and managers can set it
    if (body.aiApiKey !== undefined) {
        if (body.aiApiKey && body.aiApiKey.trim()) {
            updateData.aiApiKeyEncrypted = encrypt(body.aiApiKey.trim())
        } else {
            updateData.aiApiKeyEncrypted = null // clear the key
        }
    }

    // Handle requireOwnApiKey — admin only
    if (isAdmin && body.requireOwnApiKey !== undefined) {
        updateData.requireOwnApiKey = body.requireOwnApiKey
    }

    const channel = await prisma.channel.update({
        where: { id },
        data: updateData,
        include: {
            platforms: true,
            _count: { select: { members: true, posts: true, knowledgeBase: true } },
        },
    })

    return NextResponse.json(channel)
}

// DELETE /api/admin/channels/[id] — delete channel (admin or channel owner)
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const isAdmin = session.user.role === 'ADMIN'

    if (!isAdmin) {
        // Non-admin: must be an OWNER of this specific channel
        const membership = await prisma.channelMember.findUnique({
            where: { userId_channelId: { userId: session.user.id, channelId: id } },
            select: { role: true },
        })
        if (!membership || membership.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized – only channel owners can delete this channel' }, { status: 403 })
        }
    }

    const existing = await prisma.channel.findUnique({ where: { id } })
    if (!existing) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    await prisma.channel.delete({ where: { id } })

    return NextResponse.json({ success: true })
}

