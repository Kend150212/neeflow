import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

function requireAdmin(session: { user?: { role?: string } } | null) {
    return !session?.user || session.user.role !== 'ADMIN'
}

// Built-in categories derived from the SupportArticle.category enum values
const BUILTIN_CATEGORIES = [
    { id: 'getting_started', slug: 'getting_started', name: 'Getting Started', description: 'First steps and setup guides', iconSvg: '', isActive: true, sortOrder: 0 },
    { id: 'ai', slug: 'ai', name: 'AI Features', description: 'AI tools, models, and generation', iconSvg: '', isActive: true, sortOrder: 1 },
    { id: 'integrations', slug: 'integrations', name: 'Integrations', description: 'Connect platforms and tools', iconSvg: '', isActive: true, sortOrder: 2 },
    { id: 'billing', slug: 'billing', name: 'Billing', description: 'Subscriptions and payments', iconSvg: '', isActive: true, sortOrder: 3 },
    { id: 'troubleshooting', slug: 'troubleshooting', name: 'Troubleshooting', description: 'Fix common issues', iconSvg: '', isActive: true, sortOrder: 4 },
    { id: 'security', slug: 'security', name: 'Security', description: 'Account and data security', iconSvg: '', isActive: true, sortOrder: 5 },
    { id: 'other', slug: 'other', name: 'Other', description: 'Everything else', iconSvg: '', isActive: true, sortOrder: 6 },
]

// GET /api/admin/support/categories — returns merged DB + builtin categories with article counts
export async function GET() {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get article counts per category slug
    const counts = await db.supportArticle.groupBy({
        by: ['category'],
        _count: { id: true },
    })
    const countMap: Record<string, number> = {}
    for (const row of counts) {
        countMap[row.category] = row._count.id
    }

    // Try to get custom categories from ArticleCategory table; fall back to builtins if table empty
    let dbCats: Array<Record<string, unknown>> = []
    try {
        dbCats = await db.articleCategory.findMany({ orderBy: { sortOrder: 'asc' } })
    } catch {
        // table might not exist yet — ignore
    }

    const categories = dbCats.length > 0
        ? dbCats.map(c => ({ ...c, _count: { articles: countMap[String(c.slug)] || 0 } }))
        : BUILTIN_CATEGORIES.map(c => ({ ...c, _count: { articles: countMap[c.slug] || 0 } }))

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
        data: { name, slug, description: description || '', iconSvg: iconSvg || '', sortOrder: sortOrder ?? 0, isActive: true },
    })

    return NextResponse.json(category, { status: 201 })
}

// PATCH /api/admin/support/categories
export async function PATCH(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    if (body.orders) {
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
