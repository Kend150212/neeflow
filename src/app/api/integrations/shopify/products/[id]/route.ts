import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/integrations/shopify/products/[id]  — single product for compose pre-fill
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const product = await db.productCatalog.findUnique({
            where: { id },
        })

        if (!product) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json({
            id: product.id,
            externalId: product.externalId,
            name: product.name,
            description: product.description,
            price: product.price ? parseFloat(product.price.toString()) : null,
            category: product.category,
            tags: product.tags || [],
            images: product.images || [],
            inStock: product.inStock,
        })
    } catch (err) {
        console.error('GET shopify product by id error:', err)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
