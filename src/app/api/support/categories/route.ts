import { NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

// GET /api/support/categories
export async function GET() {
    const categories = await db.articleCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
            _count: {
                select: { articles: { where: { status: 'published' } } },
            },
        },
    })

    return NextResponse.json(categories)
}
