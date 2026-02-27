import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/admin/channels/[id]/promotions/[promoId]
 * Update a promotion
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; promoId: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { promoId } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description || null
    if (body.startAt !== undefined) data.startAt = new Date(body.startAt)
    if (body.endAt !== undefined) data.endAt = new Date(body.endAt)
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.priceGroups !== undefined) data.priceGroups = body.priceGroups

    const updated = await prisma.promotion.update({
        where: { id: promoId },
        data,
    })

    return NextResponse.json(updated)
}

/**
 * DELETE /api/admin/channels/[id]/promotions/[promoId]
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; promoId: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { promoId } = await params

    await prisma.promotion.delete({ where: { id: promoId } })

    return NextResponse.json({ ok: true })
}
