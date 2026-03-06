import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ channelId: string; id: string }> }

async function verifyAccess(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// GET /api/studio/channels/[channelId]/avatars/[id]/assets — list all assets
export async function GET(_req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const assets = await prisma.studioAvatarAsset.findMany({
        where: { avatarId: id },
        orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ assets })
}

// POST /api/studio/channels/[channelId]/avatars/[id]/assets — create asset
export async function POST(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params
    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const { name, type, prompt } = body
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const validTypes = ['outfit', 'accessory', 'prop']
    const assetType = validTypes.includes(type) ? type : 'outfit'

    const asset = await prisma.studioAvatarAsset.create({
        data: { avatarId: id, name: name.trim(), type: assetType, prompt: prompt || null },
    })
    return NextResponse.json({ asset }, { status: 201 })
}
