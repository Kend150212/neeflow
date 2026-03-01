/**
 * RAG (Retrieval Augmented Generation) — Semantic Search
 *
 * Uses vector embeddings to find the most relevant Knowledge Base entries
 * and Products for a given customer query, instead of dumping ALL data.
 *
 * Embedding storage: Json (number[]) in Prisma — no pgvector extension needed.
 * Similarity: cosine similarity computed in TypeScript.
 *
 * Providers:
 *   openai      → text-embedding-3-small (1536 dims)
 *   gemini      → text-embedding-004 (768 dims)
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
        // Gemini Embedding API
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
        return data.embedding?.values as number[]
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

// ─── Semantic search for Knowledge Base ──────────────────────────
export async function semanticSearchKnowledge(
    channelId: string,
    query: string,
    provider: string,
    apiKey: string,
    topK = 5
): Promise<Array<{ id: string; title: string; content: string }>> {
    // Load all entries that have embeddings
    const entries = await prisma.knowledgeBase.findMany({
        where: { channelId, embeddedAt: { not: null } },
        select: { id: true, title: true, content: true, embedding: true },
    })

    // If none have embeddings yet, fallback to latest N entries
    if (entries.length === 0) {
        const fallback = await prisma.knowledgeBase.findMany({
            where: { channelId },
            select: { id: true, title: true, content: true },
            orderBy: { updatedAt: 'desc' },
            take: topK,
        })
        return fallback
    }

    // Generate query embedding
    let queryVec: number[]
    try {
        queryVec = await generateEmbedding(query, provider, apiKey)
    } catch {
        // Fallback if embedding fails
        const fallback = await prisma.knowledgeBase.findMany({
            where: { channelId },
            select: { id: true, title: true, content: true },
            orderBy: { updatedAt: 'desc' },
            take: topK,
        })
        return fallback
    }

    // Score each entry
    const scored = entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        score: cosineSimilarity(queryVec, entry.embedding as number[]),
    }))

    // Sort by score descending, take topK
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK).map(({ id, title, content }) => ({ id, title, content }))
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
    tags: string[]; inStock: boolean; productId: string | null
}>> {
    const products = await prisma.productCatalog.findMany({
        where: { channelId, inStock: true, embeddedAt: { not: null } },
        select: {
            id: true, name: true, category: true, price: true, salePrice: true,
            description: true, features: true, tags: true, inStock: true,
            productId: true, embedding: true,
        },
    })

    if (products.length === 0) {
        // Fallback: all in-stock products, newest first
        return prisma.productCatalog.findMany({
            where: { channelId, inStock: true },
            select: {
                id: true, name: true, category: true, price: true, salePrice: true,
                description: true, features: true, tags: true, inStock: true, productId: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: topK,
        })
    }

    let queryVec: number[]
    try {
        queryVec = await generateEmbedding(query, provider, apiKey)
    } catch {
        return prisma.productCatalog.findMany({
            where: { channelId, inStock: true },
            select: {
                id: true, name: true, category: true, price: true, salePrice: true,
                description: true, features: true, tags: true, inStock: true, productId: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: topK,
        })
    }

    const scored = products.map(p => ({
        ...p,
        score: cosineSimilarity(queryVec, p.embedding as number[]),
    }))

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK).map(({ score: _s, embedding: _e, ...p }) => p)
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

    await prisma.knowledgeBase.update({
        where: { id: entryId },
        data: { embedding: embedding as any, embeddedAt: new Date() },
    })
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

    await prisma.productCatalog.update({
        where: { id: productId },
        data: { embedding: embedding as any, embeddedAt: new Date() },
    })
}
