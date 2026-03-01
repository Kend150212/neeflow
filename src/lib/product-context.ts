import { prisma } from '@/lib/prisma'
import { searchProducts } from '@/app/api/admin/channels/[id]/products/route'

/**
 * Extract potential product-search keywords from a customer message.
 * Pure code — zero AI tokens.
 */
export function extractProductKeywords(message: string): string {
    // Remove common stop words (vi + en)
    const stopWords = new Set([
        'tôi', 'muốn', 'cần', 'mua', 'hỏi', 'giá', 'là', 'có', 'không', 'cho', 'bao',
        'nhiêu', 'tiền', 'đồng', 'sản', 'phẩm', 'i', 'want', 'need', 'buy', 'price',
        'how', 'much', 'the', 'a', 'an', 'is', 'are', 'do', 'you', 'have', 'what',
        'về', 'và', 'với', 'của', 'trong', 'này', 'đó', 'ơi', 'bạn', 'shop', 'ạ',
    ])
    return message
        .toLowerCase()
        .replace(/[^\w\sàáâãèéêìíòóôõùúýăđơư]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.has(w))
        .join(' ')
}

/**
 * Build product context for injection into bot system prompt.
 * Uses semantic RAG search when provider/apiKey are provided, otherwise keyword search.
 */
export async function buildProductContext(
    channelId: string,
    customerMessage: string,
    provider?: string,
    apiKey?: string
): Promise<{ contextText: string; imageUrls: string[] }> {
    const keywords = extractProductKeywords(customerMessage)
    if (!keywords.trim()) return { contextText: '', imageUrls: [] }

    let matches: Array<{
        productId: string | null; name: string; category: string | null
        price: number | null; salePrice: number | null; description: string | null
        features: string[]; images: string[]; tags: string[]
    }>

    if (provider && apiKey) {
        // Semantic RAG search — only top-5 most relevant products
        const { semanticSearchProducts } = await import('@/lib/rag-search')
        const semantic = await semanticSearchProducts(channelId, customerMessage, provider, apiKey, 5)
        // Load images field separately (not in semantic return type)
        if (semantic.length > 0) {
            const withImages = await prisma.productCatalog.findMany({
                where: { id: { in: semantic.map(p => p.id) } },
                select: {
                    id: true, productId: true, name: true, category: true,
                    price: true, salePrice: true, description: true,
                    features: true, images: true, tags: true,
                },
            })
            // Preserve semantic order
            const byId = Object.fromEntries(withImages.map(p => [p.id, p]))
            matches = semantic.map(p => byId[p.id]).filter(Boolean)
        } else {
            matches = []
        }
    } else {
        // Keyword fallback — load all in-stock products, do text search
        const products = await prisma.productCatalog.findMany({
            where: { channelId, inStock: true },
            select: {
                productId: true, name: true, category: true,
                price: true, salePrice: true, description: true,
                features: true, images: true, tags: true,
            },
        })
        if (products.length === 0) return { contextText: '', imageUrls: [] }
        matches = searchProducts(products, keywords, 5)
    }

    if (matches.length === 0) return { contextText: '', imageUrls: [] }

    // Format for system prompt
    const lines: string[] = ['--- PRODUCT CATALOG (relevant results) ---']
    const allImages: string[] = []

    for (const p of matches) {
        lines.push(`\n📦 ${p.name}${p.productId ? ` [${p.productId}]` : ''}`)
        if (p.category) lines.push(`   Category: ${p.category}`)
        if (p.price) {
            const priceStr = p.salePrice && p.salePrice < p.price
                ? `~~${formatPrice(p.price)}~~ → ${formatPrice(p.salePrice)} (sale)`
                : formatPrice(p.price)
            lines.push(`   Price: ${priceStr}`)
        }
        if (p.description) lines.push(`   Description: ${p.description.substring(0, 300)}`)
        if (p.features?.length) lines.push(`   Features: ${p.features.join(', ')}`)
        if (p.images?.length) {
            lines.push(`   Images: ${p.images.slice(0, 3).join(' | ')}`)
            allImages.push(...p.images.slice(0, 2))
        }
    }

    lines.push('\n--- END PRODUCT CATALOG ---')
    lines.push('When referencing products above: mention price, features naturally. Include image URLs as [IMAGE:url] at the end of your message.')

    return {
        contextText: lines.join('\n'),
        imageUrls: [...new Set(allImages)].slice(0, 3),
    }
}


function formatPrice(price: number): string {
    if (price >= 1000) return price.toLocaleString('vi-VN') + 'đ'
    return price + 'đ'
}

/**
 * Parse bot response text and extract [IMAGE:url] markers.
 * Returns { cleanText, imageUrls }
 */
export function extractImageMarkers(text: string): { cleanText: string; imageUrls: string[] } {
    const imageUrls: string[] = []
    const cleanText = text.replace(/\[IMAGE:(https?:\/\/[^\]]+)\]/g, (_, url) => {
        imageUrls.push(url.trim())
        return ''
    }).trim()
    return { cleanText, imageUrls }
}

// ─── Promotion context ─────────────────────────────────────────────────
// priceGroup type stored in Promotion.priceGroups JSON
interface PriceGroup {
    groupName: string
    direction: 'increase' | 'decrease'
    adjustType: 'fixed' | 'percent'
    adjustment: number          // positive number
    productIds: string[]        // ProductCatalog.id values
}

/**
 * Build active-promotion context for bot system prompt.
 * Queries promotions where isActive=true AND now is within [startAt, endAt].
 * Returns empty string if no active promotions.
 */
export async function buildPromotionContext(channelId: string): Promise<string> {
    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Active promotions: isActive AND now is within window
    const activePromos = await prisma.promotion.findMany({
        where: {
            channelId,
            isActive: true,
            startAt: { lte: now },
            endAt: { gte: now },
        },
        orderBy: { startAt: 'asc' },
    })

    // Upcoming promotions: isActive AND starts within the next 7 days
    const upcomingPromos = await prisma.promotion.findMany({
        where: {
            channelId,
            isActive: true,
            startAt: { gt: now, lte: in7Days },
        },
        orderBy: { startAt: 'asc' },
    })

    if (activePromos.length === 0 && upcomingPromos.length === 0) return ''

    // Load all referenced product names
    const allProductIds = [
        ...activePromos.flatMap(p => ((p.priceGroups as unknown as PriceGroup[]) || []).flatMap(g => g.productIds || [])),
        ...upcomingPromos.flatMap(p => ((p.priceGroups as unknown as PriceGroup[]) || []).flatMap(g => g.productIds || [])),
    ]

    let productMap: Record<string, { name: string; price: number | null }> = {}
    if (allProductIds.length > 0) {
        const products = await prisma.productCatalog.findMany({
            where: { channelId, id: { in: [...new Set(allProductIds)] } },
            select: { id: true, name: true, price: true },
        })
        productMap = Object.fromEntries(products.map(p => [p.id, { name: p.name, price: p.price }]))
    }

    const lines: string[] = ['--- PROMOTIONS & UPCOMING DEALS ---']

    if (activePromos.length > 0) {
        lines.push('🔥 ĐANG HOẠT ĐỘNG — Hãy CHỦ ĐỘNG thông báo cho khách khi nói về giá.')
        lines.push('QUAN TRỌNG: Dùng giá sau khi áp dụng khuyến mãi khi báo cho khách.\n')
        for (const promo of activePromos) {
            appendPromoBlock(lines, promo, productMap, false)
        }
    }

    if (upcomingPromos.length > 0) {
        lines.push('\n📅 SẮP DIỄN RA — Thông báo cho khách để họ biết và chuẩn bị.')
        for (const promo of upcomingPromos) {
            appendPromoBlock(lines, promo, productMap, true)
        }
    }

    lines.push('--- END PROMOTIONS ---')
    return lines.join('\n')
}

function appendPromoBlock(
    lines: string[],
    promo: { name: string; description: string | null; startAt: Date; endAt: Date; priceGroups: unknown },
    productMap: Record<string, { name: string; price: number | null }>,
    isUpcoming: boolean
) {
    const start = promo.startAt.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    const end = promo.endAt.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    lines.push(`${isUpcoming ? '⏳' : '📌'} ${promo.name}`)
    lines.push(`   Thời gian: ${start} → ${end}`)
    if (promo.description) lines.push(`   Mô tả: ${promo.description}`)

    const groups = (promo.priceGroups as unknown as PriceGroup[]) || []
    for (const g of groups) {
        const dir = g.direction === 'increase' ? 'tăng' : 'giảm'
        const amount = g.adjustType === 'fixed' ? `${formatPrice(g.adjustment)}` : `${g.adjustment}%`
        const productNames = (g.productIds || []).map(id => productMap[id]?.name || id).join(', ')

        const priceExamples: string[] = []
        for (const id of (g.productIds || [])) {
            const prod = productMap[id]
            if (prod?.price) {
                let adjusted = prod.price
                if (g.adjustType === 'fixed') {
                    adjusted = g.direction === 'increase' ? prod.price + g.adjustment : prod.price - g.adjustment
                } else {
                    const delta = Math.round(prod.price * g.adjustment / 100)
                    adjusted = g.direction === 'increase' ? prod.price + delta : prod.price - delta
                }
                priceExamples.push(`${prod.name}: ${formatPrice(prod.price)} → ${formatPrice(adjusted)}`)
            }
        }

        lines.push(`   • Nhóm "${g.groupName}": ${dir} ${amount} — áp dụng cho: ${productNames}`)
        if (priceExamples.length > 0) {
            lines.push(`     Giá${isUpcoming ? ' sắp có' : ' sau KM'}: ${priceExamples.join(', ')}`)
        }
    }
    lines.push('')
}

