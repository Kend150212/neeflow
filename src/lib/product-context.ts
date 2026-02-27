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
 * Searches product catalog and returns formatted string + image URLs found.
 */
export async function buildProductContext(
    channelId: string,
    customerMessage: string
): Promise<{ contextText: string; imageUrls: string[] }> {
    const keywords = extractProductKeywords(customerMessage)
    if (!keywords.trim()) return { contextText: '', imageUrls: [] }

    // Load all in-stock products for this channel (cached per request, <10k is fast)
    const products = await prisma.productCatalog.findMany({
        where: { channelId, inStock: true },
        select: {
            productId: true, name: true, category: true,
            price: true, salePrice: true, description: true,
            features: true, images: true, tags: true,
        },
    })

    if (products.length === 0) return { contextText: '', imageUrls: [] }

    const matches = searchProducts(products, keywords, 5)
    if (matches.length === 0) return { contextText: '', imageUrls: [] }

    // Format for system prompt
    const lines: string[] = ['--- PRODUCT CATALOG (matching results) ---']
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
        imageUrls: [...new Set(allImages)].slice(0, 3), // max 3 unique images
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
