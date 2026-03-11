import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

// GET /api/support/articles/[slug]
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params

    const article = await db.supportArticle.findFirst({
        where: { slug, status: 'published' },
        include: {
            category: { select: { id: true, name: true, slug: true, iconSvg: true } },
            author: { select: { id: true, name: true, image: true } },
        },
    })

    if (!article) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Increment view counter (fire-and-forget)
    db.supportArticle.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
    }).catch(() => null)

    return NextResponse.json(article)
}
