import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/admin/channels/[id]/products/[productId]
 * Update a product
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; productId: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { productId } = await params
    const body = await req.json()

    const product = await prisma.productCatalog.update({
        where: { id: productId },
        data: {
            productId: body.productId,
            name: body.name,
            category: body.category ?? null,
            price: body.price != null ? parseFloat(body.price) : null,
            salePrice: body.salePrice != null ? parseFloat(body.salePrice) : null,
            description: body.description ?? null,
            features: Array.isArray(body.features) ? body.features : [],
            images: Array.isArray(body.images) ? body.images : [],
            tags: Array.isArray(body.tags) ? body.tags : [],
            inStock: body.inStock !== false,
        },
    })

    return NextResponse.json(product)
}

/**
 * DELETE /api/admin/channels/[id]/products/[productId]
 * Delete a product
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; productId: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { productId } = await params

    await prisma.productCatalog.delete({ where: { id: productId } })

    return NextResponse.json({ ok: true })
}
