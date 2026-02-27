import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildPromotionContext } from '@/lib/product-context'

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params

    // Verify the channel belongs to this user
    const channel = await prisma.channel.findFirst({
        where: { id: channelId },
        select: { id: true, name: true },
    })
    if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Gather all context sections in parallel
    const [knowledgeEntries, botConfig, products] = await Promise.all([
        prisma.knowledgeBase.findMany({
            where: { channelId },
            select: { title: true, content: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 50,
        }),
        prisma.botConfig.findUnique({
            where: { channelId },
        }),
        prisma.productCatalog.findMany({
            where: { channelId, inStock: true },
            select: { name: true, price: true, salePrice: true, category: true },
            take: 30,
        }),
    ])

    const promotionContext = await buildPromotionContext(channelId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trainingPairs = ((botConfig as any)?.trainingPairs as Array<{ q: string; a: string }>) || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forbiddenTopics = ((botConfig as any)?.forbiddenTopics as string[]) || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const systemPromptText = (botConfig as any)?.systemPrompt as string | undefined

    const sections: { label: string; count: number; content: string }[] = []

    // 1. System prompt
    if (systemPromptText) {
        sections.push({
            label: '⚙️ System Prompt (custom)',
            count: 1,
            content: systemPromptText.substring(0, 2000),
        })
    }

    // 2. Knowledge base
    sections.push({
        label: '📚 Knowledge Base',
        count: knowledgeEntries.length,
        content: knowledgeEntries.length === 0
            ? '(trống — thêm dữ liệu ở tab Training)'
            : knowledgeEntries.map(e =>
                `### ${e.title}\n${e.content.substring(0, 400)}${e.content.length > 400 ? '...' : ''}`
            ).join('\n\n'),
    })

    // 3. Promotions (active + upcoming)
    const promoCount = promotionContext
        ? promotionContext.split('\n').filter(l => l.startsWith('📌') || l.startsWith('⏳')).length
        : 0
    sections.push({
        label: '🎉 Promotions (Đang hoạt động + Sắp diễn ra 7 ngày tới)',
        count: promoCount,
        content: promotionContext || '(không có KM nào đang hoạt động hoặc sắp diễn ra)',
    })

    // 4. Products
    sections.push({
        label: '🛒 Sản phẩm (còn hàng)',
        count: products.length,
        content: products.length === 0
            ? '(chưa có sản phẩm nào trong catalog)'
            : products.map(p => {
                const price = p.salePrice && p.salePrice < (p.price ?? Infinity)
                    ? `${p.price?.toLocaleString('vi-VN')}đ → ${p.salePrice.toLocaleString('vi-VN')}đ (sale)`
                    : p.price ? `${p.price.toLocaleString('vi-VN')}đ` : 'N/A'
                return `- ${p.name}${p.category ? ` [${p.category}]` : ''}: ${price}`
            }).join('\n'),
    })

    // 5. Q&A Training pairs
    sections.push({
        label: '💬 Q&A Training Pairs',
        count: trainingPairs.length,
        content: trainingPairs.length === 0
            ? '(chưa có cặp Q&A nào)'
            : trainingPairs.slice(0, 20).map(p => `Q: ${p.q}\nA: ${p.a}`).join('\n\n'),
    })

    // 6. Forbidden rules
    sections.push({
        label: '🚫 Forbidden Rules (Cấm kỵ)',
        count: forbiddenTopics.length,
        content: forbiddenTopics.length === 0
            ? '(chưa có quy tắc cấm nào)'
            : forbiddenTopics.map((r, i) => `${i + 1}. ${r}`).join('\n'),
    })

    return NextResponse.json({
        channel: channel.name,
        generatedAt: new Date().toISOString(),
        sections,
    })
}
