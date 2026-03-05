import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// GET /api/studio/channels/[channelId]/products?source=chatbot|externaldb
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

    const source = req.nextUrl.searchParams.get('source') || 'chatbot'
    const q = req.nextUrl.searchParams.get('q') || ''

    if (source === 'chatbot') {
        // Pull from BotConfig product catalog JSON
        const botConfig = await prisma.botConfig.findFirst({
            where: { channelId },
            select: { products: true },
        })

        let products: unknown[] = []
        if (botConfig?.products) {
            try {
                const raw = typeof botConfig.products === 'string'
                    ? JSON.parse(botConfig.products as string)
                    : botConfig.products
                products = Array.isArray(raw) ? raw : []
            } catch {
                products = []
            }
        }

        // Filter by query if provided
        if (q) {
            const lower = q.toLowerCase()
            products = products.filter((p: unknown) => {
                const prod = p as { name?: string; description?: string }
                return prod.name?.toLowerCase().includes(lower) ||
                    prod.description?.toLowerCase().includes(lower)
            })
        }

        return NextResponse.json({ products, source: 'chatbot' })
    }

    if (source === 'externaldb') {
        // Pull from ProductCatalog table (synced from external DB)
        const catalogs = await prisma.productCatalog.findMany({
            where: { channelId },
            take: 100,
            orderBy: { createdAt: 'desc' },
        })

        let products = catalogs.map(c => ({
            id: c.id,
            name: c.name,
            price: c.price,
            description: c.description,
            image: c.imageUrl,
            source: 'externaldb',
        }))

        if (q) {
            const lower = q.toLowerCase()
            products = products.filter(p =>
                p.name?.toLowerCase().includes(lower) ||
                p.description?.toLowerCase().includes(lower)
            )
        }

        return NextResponse.json({ products, source: 'externaldb' })
    }

    return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
}
