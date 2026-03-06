import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, generateR2Key } from '@/lib/r2'

type Ctx = { params: Promise<{ channelId: string; id: string; poseId: string }> }

async function verifyAccess(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// POST /api/studio/channels/[channelId]/avatars/[id]/poses/[poseId]/upload
// Upload one or more images into a pose folder
export async function POST(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id, poseId } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const files = formData.getAll('file') as File[]
    const label = formData.get('label') as string | null

    if (!files.length) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const pose = await prisma.studioAvatarPose.findFirst({ where: { id: poseId, avatarId: id } })
    if (!pose) return NextResponse.json({ error: 'Pose not found' }, { status: 404 })

    const existing = (pose.images as { url: string; label?: string }[]) || []
    const uploaded: { url: string; label?: string; createdAt: string }[] = []

    for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.name.split('.').pop() || 'jpg'
        const key = generateR2Key(channelId, `${Date.now()}-pose-${poseId}.${ext}`)
        const url = await uploadToR2(buffer, key, file.type || 'image/jpeg')
        uploaded.push({ url, label: label || undefined, createdAt: new Date().toISOString() })
    }

    const updated = await prisma.studioAvatarPose.update({
        where: { id: poseId },
        data: { images: [...existing, ...uploaded] },
    })

    return NextResponse.json({ pose: updated, uploaded })
}
