/**
 * RAG (Retrieval Augmented Generation) — Semantic Search
 *
 * Uses pgvector for DB-side ANN search (fast, memory-efficient).
 * Falls back to PostgreSQL full-text search (tsvector) if embedding fails.
 *
 * Flow: embed query → pgvector TOP 20 → cosine re-rank → TOP 5
 *
 * Providers:
 *   openai      → text-embedding-3-small (1536 dims)
 *   gemini      → text-embedding-004 (768 dims, zero-padded to 1536)
 *   openrouter  → openai/text-embedding-3-small via OpenAI-compatible API
 *   synthetic   → openai/text-embedding-3-small via OpenAI-compatible API
 */

import { prisma } from '@/lib/prisma'

// ─── Embedding dimensions by provider ────────────────────────────
const EMBEDDING_DIMS: Record<string, number> = {
    openai: 1536,
    gemini: 768,
    openrouter: 1536,
    synthetic: 1536,
}

// ─── Generate embedding via provider API ─────────────────────────
export async function generateEmbedding(
    text: string,
    provider: string,
    apiKey: string
): Promise<number[]> {
    // Truncate to avoid token limit (most embedding models: 8191 tokens)
    const truncated = text.slice(0, 8000)

    if (provider === 'gemini') {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'models/text-embedding-004',
                    content: { parts: [{ text: truncated }] },
                }),
            }
        )
        if (!res.ok) {
            const err = await res.text()
            throw new Error(`Gemini embedding error: ${err}`)
        }
        const data = await res.json()
        const vec = data.embedding?.values as number[]
        // Zero-pad Gemini 768-dim vectors to 1536 for unified column storage
        if (vec && vec.length < 1536) {
            return [...vec, ...new Array(1536 - vec.length).fill(0)]
        }
        return vec
    }

    // OpenAI-compatible (openai, openrouter, synthetic)
    const baseUrls: Record<string, string> = {
        openai: 'https://api.openai.com/v1',
        openrouter: 'https://openrouter.ai/api/v1',
        synthetic: 'https://api.synthetic.new/openai/v1',
    }
    const baseUrl = baseUrls[provider] || baseUrls.openai

    const res = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: truncated,
        }),
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Embedding error (${provider}): ${err}`)
    }
    const data = await res.json()
    return data.data?.[0]?.embedding as number[]
}

// ─── Cosine similarity (–1 to 1, higher = more similar) ──────────
export function cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
}

// ─── Format vector for pgvector SQL ──────────────────────────────
function toVectorLiteral(vec: number[]): string {
    return `[${vec.join(',')}]`
}

// ─── Semantic search for Knowledge Base ──────────────────────────
export async function semanticSearchKnowledge(
    channelId: string,
    query: string,
    provider: string,
    apiKey: string,
    topK = 5
): Promise<Array<{ id: string; title: string; content: string }>> {
    // Try semantic search via pgvector
    try {
        const queryVec = await generateEmbedding(query, provider, apiKey)
        const vecLiteral = toVectorLiteral(queryVec)

        // pgvector: fetch top 20 candidates using HNSW ANN search
        // <=> = cosine distance operator (1 - cosine_similarity)
        const candidates = await prisma.$queryRawUnsafe<Array<{
            id: string; title: string; content: string; embedding: string
        }>>(
            `SELECT id, title, content, embedding::text
             FROM knowledge_bases
             WHERE channel_id = $1 AND embedding IS NOT NULL
             ORDER BY embedding <=> $2::vector
             LIMIT 20`,
            channelId,
            vecLiteral
        )

        if (candidates.length === 0) {
            // No embedded entries — fall back to full-text search
            return fullTextSearchKnowledge(channelId, query, topK)
        }

        // Re-rank top 20 with exact cosine similarity
        const reranked = candidates
            .map(entry => {
                // Parse embedding string back to number array
                const vec = parseVectorString(entry.embedding)
                return {
                    id: entry.id,
                    title: entry.title,
                    content: entry.content,
                    score: vec.length > 0 ? cosineSimilarity(queryVec, vec) : 0,
                }
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)

        return reranked.map(({ id, title, content }) => ({ id, title, content }))

    } catch {
        // pgvector not available yet — fall back to full-text search
        return fullTextSearchKnowledge(channelId, query, topK)
    }
}

// ─── Full-text search fallback (no embedding needed) ─────────────
async function fullTextSearchKnowledge(
    channelId: string,
    query: string,
    topK: number
): Promise<Array<{ id: string; title: string; content: string }>> {
    try {
        // Use PostgreSQL full-text search with simple dictionary (works for all languages)
        const results = await prisma.$queryRawUnsafe<Array<{
            id: string; title: string; content: string
        }>>(
            `SELECT id, title, content
             FROM knowledge_bases
             WHERE channel_id = $1
               AND search_vector @@ plainto_tsquery('simple', $2)
             ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $2)) DESC
             LIMIT $3`,
            channelId,
            query,
            topK
        )
        if (results.length > 0) return results
    } catch {
        // search_vector column not yet added — use latest entries
    }

    // Last resort: latest N entries
    return prisma.knowledgeBase.findMany({
        where: { channelId },
        select: { id: true, title: true, content: true },
        orderBy: { updatedAt: 'desc' },
        take: topK,
    })
}

// ─── Semantic search for Products ────────────────────────────────
export async function semanticSearchProducts(
    channelId: string,
    query: string,
    provider: string,
    apiKey: string,
    topK = 5
): Promise<Array<{
    id: string; name: string; category: string | null; price: number | null
    salePrice: number | null; description: string | null; features: string[]
    tags: string[]; inStock: boolean; productId: string | null; images: string[]
}>> {
    try {
        const queryVec = await generateEmbedding(query, provider, apiKey)
        const vecLiteral = toVectorLiteral(queryVec)

        const candidates = await prisma.$queryRawUnsafe<Array<{
            id: string; name: string; category: string | null; price: number | null
            sale_price: number | null; description: string | null; features: string[]
            tags: string[]; in_stock: boolean; product_id: string | null; images: string[]; embedding: string
        }>>(
            `SELECT id, name, category, price, sale_price, description, features, tags, in_stock, product_id, images, embedding::text
             FROM product_catalog
             WHERE channel_id = $1 AND in_stock = true AND embedding IS NOT NULL
             ORDER BY embedding <=> $2::vector
             LIMIT 20`,
            channelId,
            vecLiteral
        )

        if (candidates.length === 0) {
            return fullTextSearchProducts(channelId, query, topK)
        }

        const reranked = candidates
            .map(p => {
                const vec = parseVectorString(p.embedding)
                return {
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    price: p.price,
                    salePrice: p.sale_price,
                    description: p.description,
                    features: p.features || [],
                    tags: p.tags || [],
                    inStock: p.in_stock,
                    productId: p.product_id,
                    images: p.images || [],
                    score: vec.length > 0 ? cosineSimilarity(queryVec, vec) : 0,
                }
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)

        return reranked.map(({ score: _s, ...p }) => p)

    } catch {
        return fullTextSearchProducts(channelId, query, topK)
    }
}

// ─── Full-text search fallback for Products ───────────────────────
async function fullTextSearchProducts(
    channelId: string,
    query: string,
    topK: number
): Promise<Array<{
    id: string; name: string; category: string | null; price: number | null
    salePrice: number | null; description: string | null; features: string[]
    tags: string[]; inStock: boolean; productId: string | null; images: string[]
}>> {
    try {
        const results = await prisma.$queryRawUnsafe<Array<{
            id: string; name: string; category: string | null; price: number | null
            sale_price: number | null; description: string | null; features: string[]
            tags: string[]; in_stock: boolean; product_id: string | null; images: string[]
        }>>(
            `SELECT id, name, category, price, sale_price, description, features, tags, in_stock, product_id, images
             FROM product_catalog
             WHERE channel_id = $1 AND in_stock = true
               AND search_vector @@ plainto_tsquery('simple', $2)
             ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $2)) DESC
             LIMIT $3`,
            channelId,
            query,
            topK
        )
        if (results.length > 0) {
            return results.map(p => ({
                id: p.id,
                name: p.name,
                category: p.category,
                price: p.price,
                salePrice: p.sale_price,
                description: p.description,
                features: p.features || [],
                tags: p.tags || [],
                inStock: p.in_stock,
                productId: p.product_id,
                images: p.images || [],
            }))
        }
    } catch {
        // search_vector not yet added
    }

    // Last resort
    const fallback = await prisma.productCatalog.findMany({
        where: { channelId, inStock: true },
        select: {
            id: true, name: true, category: true, price: true, salePrice: true,
            description: true, features: true, tags: true, inStock: true, productId: true,
            images: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: topK,
    })
    return fallback
}

// ─── Parse pgvector string "[0.1,-0.2,...]" to number[] ──────────
function parseVectorString(str: string): number[] {
    if (!str) return []
    try {
        return JSON.parse(str.replace(/^\[/, '[').replace(/\]$/, ']'))
    } catch {
        return []
    }
}

// ─── Generate and save embedding for a KnowledgeBase entry ───────
export async function embedAndSaveKnowledge(
    entryId: string,
    provider: string,
    apiKey: string
): Promise<void> {
    const entry = await prisma.knowledgeBase.findUnique({
        where: { id: entryId },
        select: { title: true, content: true },
    })
    if (!entry) return

    const text = `${entry.title}\n\n${entry.content}`
    const embedding = await generateEmbedding(text, provider, apiKey)
    const vecLiteral = toVectorLiteral(embedding)

    await prisma.$executeRawUnsafe(
        `UPDATE knowledge_bases SET embedding = $1::vector, embedded_at = now() WHERE id = $2`,
        vecLiteral,
        entryId
    )
}

// ─── Generate and save embedding for a Product ───────────────────
export async function embedAndSaveProduct(
    productId: string,
    provider: string,
    apiKey: string
): Promise<void> {
    const product = await prisma.productCatalog.findUnique({
        where: { id: productId },
        select: { name: true, category: true, description: true, features: true, tags: true },
    })
    if (!product) return

    const text = [
        product.name,
        product.category,
        product.description,
        product.features.join(', '),
        product.tags.join(', '),
    ].filter(Boolean).join('\n')

    const embedding = await generateEmbedding(text, provider, apiKey)
    const vecLiteral = toVectorLiteral(embedding)

    await prisma.$executeRawUnsafe(
        `UPDATE product_catalog SET embedding = $1::vector, embedded_at = now() WHERE id = $2`,
        vecLiteral,
        productId
    )
}
