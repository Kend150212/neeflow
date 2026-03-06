import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ channelId: string; id: string; assetId: string }> }

async function verifyAccess(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// PATCH — rename asset or update prompt
export async function PATCH(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, assetId } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const asset = await prisma.studioAvatarAsset.update({
        where: { id: assetId },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.prompt !== undefined && { prompt: body.prompt }),
        },
    })
    return NextResponse.json({ asset })
}

// DELETE — delete asset
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, assetId } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await prisma.studioAvatarAsset.delete({ where: { id: assetId } })
    return NextResponse.json({ success: true })
}
