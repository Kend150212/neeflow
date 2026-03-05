import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// GET /api/studio/channels/[channelId]/products?q=searchTerm
// Returns products from the channel's ProductCatalog (synced from External DB or manually added)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId } = await params

    if (!(await verifyMembership(session.user.id, channelId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const q = req.nextUrl.searchParams.get('q') || ''

    const catalogItems = await prisma.productCatalog.findMany({
        where: {
            channelId,
            ...(q ? {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } },
                ],
            } : {}),
        },
        take: 100,
        orderBy: { createdAt: 'desc' },
    })

    const products = catalogItems.map(c => ({
        id: c.id,
        name: c.name,
        price: c.price,
        description: c.description,
        image: c.images?.[0] ?? null,
    }))

    return NextResponse.json({ products })
}
