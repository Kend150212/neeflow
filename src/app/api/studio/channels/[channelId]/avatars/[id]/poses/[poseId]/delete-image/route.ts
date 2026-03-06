import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, generateR2Key } from '@/lib/r2'

type Ctx = { params: Promise<{ channelId: string; id: string; poseId: string }> }

async function verifyAccess(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// POST — delete a specific image from a pose folder by URL
// body: { url: string }
export async function DELETE(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id, poseId } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    const pose = await prisma.studioAvatarPose.findFirst({ where: { id: poseId, avatarId: id } })
    if (!pose) return NextResponse.json({ error: 'Pose not found' }, { status: 404 })

    const images = (pose.images as { url: string }[]).filter(img => img.url !== url)
    const updated = await prisma.studioAvatarPose.update({
        where: { id: poseId },
        data: { images },
    })
    return NextResponse.json({ pose: updated })
}

// Suppress unused imports — uploadToR2/generateR2Key used in upload route
void uploadToR2
void generateR2Key
