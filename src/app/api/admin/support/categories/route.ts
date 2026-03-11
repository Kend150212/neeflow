import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

function requireAdmin(session: { user?: { role?: string } } | null) {
    return !session?.user || session.user.role !== 'ADMIN'
}

// GET /api/admin/support/categories
export async function GET() {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const categories = await db.articleCategory.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
            _count: { select: { articles: true } },
        },
    })

    return NextResponse.json(categories)
}

// POST /api/admin/support/categories
export async function POST(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, slug, description, iconSvg, sortOrder } = await req.json()

    if (!name || !slug) return NextResponse.json({ error: 'name and slug required' }, { status: 400 })

    const existing = await db.articleCategory.findFirst({ where: { slug } })
    if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })

    const category = await db.articleCategory.create({
        data: {
            name,
            slug,
            description: description || '',
            iconSvg: iconSvg || '',
            sortOrder: sortOrder ?? 0,
            isActive: true,
        },
    })

    return NextResponse.json(category, { status: 201 })
}

// PATCH /api/admin/support/categories — bulk sort-order update body: { orders: [{id, sortOrder}] }
// Or single update body: { id, ...fields }
export async function PATCH(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    if (body.orders) {
        // Bulk reorder
        await Promise.all(
            body.orders.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
                db.articleCategory.update({ where: { id }, data: { sortOrder } })
            )
        )
        return NextResponse.json({ success: true })
    }

    const { id, ...data } = body
    const updated = await db.articleCategory.update({ where: { id }, data })
    return NextResponse.json(updated)
}

// DELETE /api/admin/support/categories?id=
export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await db.articleCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
