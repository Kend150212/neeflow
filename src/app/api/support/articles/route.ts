import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

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
            { tags: { hasSome: [q] } },
        ]
    }

    if (category) {
        where.category = { slug: category }
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
                category: { select: { id: true, name: true, slug: true, iconSvg: true } },
                author: { select: { id: true, name: true, image: true } },
            },
        }),
        db.supportArticle.count({ where }),
    ])

    return NextResponse.json({ articles, total, page, limit })
}
