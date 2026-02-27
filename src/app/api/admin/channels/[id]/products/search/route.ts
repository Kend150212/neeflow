import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchProducts } from '../route'

/**
 * GET /api/admin/channels/[id]/products/search?q=kem+duong
 * Fast keyword + fuzzy search — used by bot pipeline (no AI tokens)
 * Returns top matching products to inject into bot context
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: channelId } = await params
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const topK = parseInt(searchParams.get('topK') || '5', 10)

    if (!q) return NextResponse.json([])

    const products = await prisma.productCatalog.findMany({
        where: { channelId, inStock: true },
        select: {
            id: true, productId: true, name: true, category: true,
            price: true, salePrice: true, description: true,
            features: true, images: true, tags: true,
        },
    })

    const results = searchProducts(products, q, topK)
    return NextResponse.json(results)
}
