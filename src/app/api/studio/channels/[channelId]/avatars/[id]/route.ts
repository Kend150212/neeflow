import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteFromR2 } from '@/lib/r2'

async function verifyMembership(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

type Ctx = { params: Promise<{ channelId: string; id: string }> }

/** Extract R2 key from a full URL (the pathname without leading slash) */
function r2KeyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null
    try {
        const path = new URL(url).pathname
        return path.startsWith('/') ? path.slice(1) : path
    } catch { return null }
}

/** Best-effort delete a list of URLs from R2 — never throws */
async function cleanupR2Urls(urls: (string | null | undefined)[]) {
    await Promise.allSettled(
        urls.flatMap(u => {
            const key = r2KeyFromUrl(u)
            return key ? [deleteFromR2(key)] : []
        })
    )
}

// GET /api/studio/channels/[channelId]/avatars/[id]
export async function GET(_req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id, channelId, isActive: true },
        include: {
            poses: { orderBy: { createdAt: 'asc' } },
            assets: { orderBy: [{ type: 'asc' }, { createdAt: 'asc' }] },
        },
    })
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
    return NextResponse.json({ avatar })
}

// PATCH /api/studio/channels/[channelId]/avatars/[id]
export async function PATCH(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const avatar = await prisma.studioAvatar.findFirst({ where: { id, channelId, isActive: true } })
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })

    const body = await req.json()
    const { name, description, prompt, style, coverImage, falJobId, status } = body

    const updated = await prisma.studioAvatar.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(prompt !== undefined && { prompt }),
            ...(style !== undefined && { style }),
            ...(coverImage !== undefined && { coverImage }),
            ...(falJobId !== undefined && { falJobId }),
            ...(status !== undefined && { status }),
        },
    })
    return NextResponse.json({ avatar: updated })
}

// DELETE /api/studio/channels/[channelId]/avatars/[id]
// Cleans up ALL R2 files (cover, reference images, pose images, asset images) then soft-deletes the record.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id, channelId },
        include: {
            poses: true,
            assets: true,
        },
    })
    if (!avatar) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Collect all R2 URLs to delete
    const urlsToDelete: (string | null | undefined)[] = [
        avatar.coverImage,
        ...((avatar.referenceImages as string[]) || []),
    ]

    // Pose images
    for (const pose of avatar.poses || []) {
        const imgs = (pose.images as Array<{ url?: string }>) || []
        for (const img of imgs) urlsToDelete.push(img.url)
    }

    // Asset images
    for (const asset of avatar.assets || []) {
        const imgs = (asset.images as Array<{ url?: string }>) || []
        for (const img of imgs) urlsToDelete.push(img.url)
    }

    // Best-effort R2 cleanup (DB soft-delete still succeeds even if R2 fails)
    await cleanupR2Urls(urlsToDelete)

    await prisma.studioAvatar.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
}

