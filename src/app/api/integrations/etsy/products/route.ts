import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/integrations/etsy/products?channelId=xxx&page=1&search=&status=all
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const channelId = searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ products: [], total: 0 })

    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '24')
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? 'all' // all | active | draft

    const where: Record<string, unknown> = {
        channelId,
        syncSource: 'etsy',
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
        ]
    }

    if (status === 'active') where.inStock = true
    if (status === 'draft') where.inStock = false

    const [products, total] = await Promise.all([
        prisma.productCatalog.findMany({
            where,
            orderBy: { syncedAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
                id: true,
                externalId: true,
                name: true,
                description: true,
                price: true,
                salePrice: true,
                images: true,
                category: true,
                tags: true,
                inStock: true,
                syncedAt: true,
            },
        }),
        prisma.productCatalog.count({ where }),
    ])

    return NextResponse.json({ products, total, page, pageSize })
}
