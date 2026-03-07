import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/integrations/shopify/products?channelId=xxx&page=1&search=xxx&status=all&collection=xxx
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all' // all | in_stock | out_of_stock
    const collection = searchParams.get('collection') || '' // filter by category/collection
    const limit = 24

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

    if (collection) {
        where.category = collection
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
                lastPostedAt: true,
                postCount: true,
            },
        }),
        prisma.productCatalog.count({ where }),
    ])

    // Also return list of unique collections for this channel (for sidebar filter)
    const collectionsRaw = await prisma.productCatalog.findMany({
        where: { channelId, syncSource: 'shopify', category: { not: null } },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
    })
    const collections = collectionsRaw
        .map(c => c.category)
        .filter((c): c is string => !!c)

    return NextResponse.json({
        products,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        collections,
    })
}
