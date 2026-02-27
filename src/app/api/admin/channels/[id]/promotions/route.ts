import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/channels/[id]/promotions
 * List all promotions for a channel
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params

    const promotions = await prisma.promotion.findMany({
        where: { channelId },
        orderBy: { startAt: 'desc' },
    })

    return NextResponse.json(promotions)
}

/**
 * POST /api/admin/channels/[id]/promotions
 * Create a new promotion
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params
    const body = await req.json()

    const { name, description, startAt, endAt, isActive, priceGroups } = body

    if (!name || !startAt || !endAt) {
        return NextResponse.json({ error: 'name, startAt, endAt required' }, { status: 400 })
    }

    const promotion = await prisma.promotion.create({
        data: {
            channelId,
            name,
            description: description || null,
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            isActive: isActive !== false,
            priceGroups: priceGroups || [],
        },
    })

    return NextResponse.json(promotion, { status: 201 })
}
