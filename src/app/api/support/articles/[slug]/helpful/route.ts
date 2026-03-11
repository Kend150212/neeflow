import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

// POST /api/support/articles/[slug]/helpful
// body: { helpful: boolean }
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    const { helpful } = await req.json()

    const article = await db.supportArticle.findFirst({ where: { slug, status: 'published' } })
    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await db.supportArticle.update({
        where: { id: article.id },
        data: helpful
            ? { helpfulCount: { increment: 1 } }
            : { notHelpfulCount: { increment: 1 } },
        select: { helpfulCount: true, notHelpfulCount: true },
    })

    return NextResponse.json(updated)
}
