import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { embedAndSaveProduct } from '@/lib/rag-search'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'

/**
 * GET /api/admin/channels/[id]/products
 * List all products for a channel (with optional search)
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const category = searchParams.get('category')
    const inStock = searchParams.get('inStock')

    const where: any = { channelId }
    if (category) where.category = category
    if (inStock === 'true') where.inStock = true
    if (inStock === 'false') where.inStock = false

    const products = await prisma.productCatalog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    })

    // Apply keyword search in memory (simple, fast for <10k products)
    let result = products
    if (q) {
        result = searchProducts(products, q)
    }

    return NextResponse.json(result)
}

/**
 * POST /api/admin/channels/[id]/products
 * Create a single product
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params
    const body = await req.json()

    const product = await prisma.productCatalog.create({
        data: {
            channelId,
            productId: body.productId || null,
            name: body.name,
            category: body.category || null,
            price: body.price ? parseFloat(body.price) : null,
            salePrice: body.salePrice ? parseFloat(body.salePrice) : null,
            description: body.description || null,
            features: Array.isArray(body.features) ? body.features : [],
            images: Array.isArray(body.images) ? body.images : [],
            tags: Array.isArray(body.tags) ? body.tags : buildAutoTags(body),
            inStock: body.inStock !== false,
            syncSource: 'manual',
        },
    })

    // ── Auto-embed in background (non-blocking) ──────────────────
    setImmediate(async () => {
        try {
            const ownerKey = await getChannelOwnerKey(channelId, null)
            if (ownerKey.apiKey && ownerKey.provider) {
                await embedAndSaveProduct(product.id, ownerKey.provider, ownerKey.apiKey)
            }
        } catch (err) {
            console.error('[Product] Auto-embed failed for product:', product.id, err)
        }
    })

    return NextResponse.json(product, { status: 201 })
}

/**
 * Auto-generate search tags from product fields
 */
function buildAutoTags(body: any): string[] {
    const parts: string[] = []
    if (body.name) parts.push(...body.name.toLowerCase().split(/\s+/))
    if (body.category) parts.push(body.category.toLowerCase())
    if (Array.isArray(body.features)) parts.push(...body.features.map((f: string) => f.toLowerCase()))
    return [...new Set(parts.filter(p => p.length > 1))]
}

/**
 * Multi-field keyword search (no AI tokens needed)
 * Handles: exact match, partial match, multi-token, basic typo tolerance
 */
export function searchProducts(
    products: any[],
    query: string,
    topK = 10
): any[] {
    const normalise = (s: string) => s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics for fuzzy compare
        .replace(/[^\w\s]/g, ' ')

    const tokens = normalise(query).split(/\s+/).filter(t => t.length > 1)
    if (tokens.length === 0) return products.slice(0, topK)

    const scored = products.map(p => {
        const haystack = normalise([
            p.name,
            p.category || '',
            p.description || '',
            ...(p.tags || []),
            ...(p.features || []),
            p.productId || '',
        ].join(' '))

        let score = 0
        for (const token of tokens) {
            if (haystack.includes(token)) score += 3        // substring match
            else if (levenshteinSimilarity(token, haystack) > 0.7) score += 1 // fuzzy
        }
        return { product: p, score }
    })

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(s => s.product)
}

/**
 * Simple similarity check: does haystack contain something close to needle?
 * Uses sliding window bigram comparison.
 */
function levenshteinSimilarity(needle: string, haystack: string): number {
    if (needle.length < 3) return 0
    // Scan windows of size needle.length ± 2 across haystack
    const wLen = needle.length
    let bestSim = 0
    for (let i = 0; i <= haystack.length - wLen + 2; i++) {
        const window = haystack.slice(i, i + wLen + 2)
        const sim = bigramSimilarity(needle, window)
        if (sim > bestSim) bestSim = sim
    }
    return bestSim
}

function bigramSimilarity(a: string, b: string): number {
    const getBigrams = (s: string) => {
        const set = new Set<string>()
        for (let i = 0; i < s.length - 1; i++) set.add(s[i] + s[i + 1])
        return set
    }
    const ba = getBigrams(a)
    const bb = getBigrams(b)
    let intersection = 0
    for (const bg of ba) if (bb.has(bg)) intersection++
    return (2 * intersection) / (ba.size + bb.size || 1)
}
