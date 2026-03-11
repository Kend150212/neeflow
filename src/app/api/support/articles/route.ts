import { NextRequest, NextResponse } from 'next/server'
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

// GET /api/support/articles?q=&category=&limit=20&page=1
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const q = searchParams.get('q') || ''
    const category = searchParams.get('category') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { status: 'published' }

    if (q) {
        where.OR = [
            { title: { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
        ]
    }

    // category is a plain string field, not a relation
    if (category) {
        where.category = category
    }

    const [articles, total] = await Promise.all([
        db.supportArticle.findMany({
            where,
            skip,
            take: limit,
            orderBy: { viewCount: 'desc' },
            select: {
                id: true,
                title: true,
                slug: true,
                excerpt: true,
                tags: true,
                viewCount: true,
                helpfulCount: true,
                updatedAt: true,
                category: true,   // plain string
                author: { select: { id: true, name: true, image: true } },
            },
        }),
        db.supportArticle.count({ where }),
    ])

    // Shape category string → object for UI compatibility
    const shaped = articles.map((a: Record<string, unknown>) => ({
        ...a,
        category: {
            id: a.category,
            slug: a.category,
            name: CATEGORY_LABELS[a.category as string] ?? a.category,
            iconSvg: '',
        },
    }))

    return NextResponse.json({ articles: shaped, total, page, limit })
}
