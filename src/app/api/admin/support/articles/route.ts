import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

function requireAdmin(session: { user?: { role?: string } } | null) {
    return !session?.user || session.user.role !== 'ADMIN'
}

// GET /api/admin/support/articles?status=&category=&q=&page=1
export async function GET(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const q = searchParams.get('q') || ''
    const status = searchParams.get('status') || ''
    const category = searchParams.get('category') || ''
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const limit = 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category) where.category = { slug: category }
    if (q) {
        where.OR = [
            { title: { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
        ]
    }

    const [articles, total] = await Promise.all([
        db.supportArticle.findMany({
            where,
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            include: {
                category: { select: { id: true, name: true, slug: true } },
                author: { select: { id: true, name: true, image: true } },
            },
        }),
        db.supportArticle.count({ where }),
    ])

    // Stats
    const [publishedCount, draftCount, totalViews] = await Promise.all([
        db.supportArticle.count({ where: { status: 'published' } }),
        db.supportArticle.count({ where: { status: 'draft' } }),
        db.supportArticle.aggregate({ _sum: { viewCount: true } }),
    ])

    return NextResponse.json({
        articles,
        total,
        page,
        limit,
        stats: {
            published: publishedCount,
            drafts: draftCount,
            totalViews: totalViews._sum.viewCount || 0,
        },
    })
}

// POST /api/admin/support/articles — create article
export async function POST(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, slug, excerpt, content, seoMeta, categoryId, status, tags } = body

    if (!title || !slug || !content || !categoryId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await db.supportArticle.findFirst({ where: { slug } })
    if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })

    const article = await db.supportArticle.create({
        data: {
            title,
            slug,
            excerpt: excerpt || '',
            content,
            seoMeta: seoMeta || '',
            categoryId,
            status: status || 'draft',
            tags: tags || [],
            authorId: session!.user!.id,
            publishedAt: status === 'published' ? new Date() : null,
        },
        include: {
            category: { select: { id: true, name: true, slug: true } },
            author: { select: { id: true, name: true, image: true } },
        },
    })

    return NextResponse.json(article, { status: 201 })
}
