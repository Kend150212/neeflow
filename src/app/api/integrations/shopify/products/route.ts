import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/integrations/shopify/products?channelId=xxx&page=1&search=xxx&status=all
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all' // all | in_stock | low_stock | out_of_stock
    const limit = 20

    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })

    const where: Record<string, unknown> = {
        channelId,
        syncSource: 'shopify',
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
        ]
    }

    if (status === 'in_stock') {
        where.inStock = true
    } else if (status === 'out_of_stock') {
        where.inStock = false
    }

    const [products, total] = await Promise.all([
        prisma.productCatalog.findMany({
            where,
            orderBy: { syncedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                externalId: true,
                name: true,
                description: true,
                price: true,
                salePrice: true,
                category: true,
                tags: true,
                images: true,
                inStock: true,
                syncedAt: true,
            },
        }),
        prisma.productCatalog.count({ where }),
    ])

    return NextResponse.json({
        products,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    })
}

// GET /api/integrations/shopify/products/[id] — single product for compose pre-fill
// We handle this via search param: ?productId=xxx
