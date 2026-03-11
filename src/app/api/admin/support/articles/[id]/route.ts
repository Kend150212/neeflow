import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

const CATEGORY_LABELS: Record<string, string> = {
    getting_started: 'Getting Started',
    ai: 'AI & Automation',
    integrations: 'Integrations',
    billing: 'Billing',
    troubleshooting: 'Troubleshooting',
    security: 'Security',
    other: 'General',
}

function shapeArticle(article: Record<string, unknown>) {
    return {
        ...article,
        category: {
            id: article.category,
            slug: article.category,
            name: CATEGORY_LABELS[article.category as string] ?? article.category,
        },
    }
}

function requireAdmin(session: { user?: { role?: string } } | null) {
    return !session?.user || session.user.role !== 'ADMIN'
}

// GET /api/admin/support/articles/[id]
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const article = await db.supportArticle.findFirst({
        where: { OR: [{ id }, { slug: id }] },
        include: {
            author: { select: { id: true, name: true, image: true } },
        },
    })

    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(shapeArticle(article))
}

// PATCH /api/admin/support/articles/[id] — update article
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const existing = await db.supportArticle.findFirst({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Remove fields that don't exist in schema
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { publishedAt, notHelpfulCount, category: _cat, ...rest } = body

    // Keep category as plain string
    const data: Record<string, unknown> = {
        ...rest,
        ...(body.category ? { category: body.category } : {}),
    }

    const article = await db.supportArticle.update({
        where: { id },
        data,
        include: {
            author: { select: { id: true, name: true, image: true } },
        },
    })

    return NextResponse.json(shapeArticle(article))
}

// DELETE /api/admin/support/articles/[id]
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await db.supportArticle.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
