import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// GET /api/studio/channels/[channelId]/products?source=chatbot|shopify&search=keyword
// Returns products from ProductCatalog filtered by source
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

    const { searchParams } = new URL(req.url)
    const source = searchParams.get('source') || 'chatbot'
    const search = searchParams.get('search') || searchParams.get('q') || ''

    // chatbot = all non-shopify products (manually entered through KB / chatbot)
    // shopify = only products synced from Shopify
    const syncSourceFilter: string[] | undefined =
        source === 'shopify' ? ['shopify'] :
            source === 'chatbot' ? ['manual', 'chatbot', 'csv', 'google_sheet'] :
                undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
        channelId,
        ...(syncSourceFilter ? { syncSource: { in: syncSourceFilter } } : {}),
        ...(search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
            ]
        } : {})
    }

    const products = await prisma.productCatalog.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 80,
        select: {
            id: true,
            name: true,
            category: true,
            price: true,
            salePrice: true,
            description: true,
            images: true,
            inStock: true,
            syncSource: true,
        }
    })

    const mapped = products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category || '',
        price: p.salePrice ?? p.price ?? null,
        originalPrice: p.price ?? null,
        description: p.description || '',
        image: p.images?.[0] ?? null,
        images: p.images ?? [],
        inStock: p.inStock,
        source: p.syncSource || 'manual',
    }))

    return NextResponse.json({ products: mapped, total: mapped.length })
}
