import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/studio/avatars/[id] — update name/description
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id: params.id, userId: session.user.id },
    })
    if (!avatar) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const { name, description } = body

    const updated = await prisma.studioAvatar.update({
        where: { id: params.id },
        data: { name: name || avatar.name, description: description ?? avatar.description },
    })

    return NextResponse.json({ avatar: updated })
}

// DELETE /api/studio/avatars/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id: params.id, userId: session.user.id },
    })
    if (!avatar) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.studioAvatar.update({
        where: { id: params.id },
        data: { isActive: false },
    })

    return NextResponse.json({ success: true })
}
