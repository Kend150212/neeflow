import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

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
            category: { select: { id: true, name: true, slug: true } },
            author: { select: { id: true, name: true, image: true } },
        },
    })

    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(article)
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

    // If publishing for the first time, set publishedAt
    const wasUnpublished = existing.status !== 'published'
    const isNowPublishing = body.status === 'published'

    const data: Record<string, unknown> = { ...body }
    if (wasUnpublished && isNowPublishing) {
        data.publishedAt = new Date()
    }

    const article = await db.supportArticle.update({
        where: { id },
        data,
        include: {
            category: { select: { id: true, name: true, slug: true } },
            author: { select: { id: true, name: true, image: true } },
        },
    })

    return NextResponse.json(article)
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
