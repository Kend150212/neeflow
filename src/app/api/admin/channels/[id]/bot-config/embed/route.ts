/**
 * POST /api/admin/channels/[id]/bot-config/embed
 * Generate and save embeddings for all KnowledgeBase entries + Products in this channel.
 * Used by "Re-embed All" UI button and called automatically after content updates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { embedAndSaveKnowledge, embedAndSaveProduct } from '@/lib/rag-search'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params

    // Verify access
    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, defaultAiProvider: true },
    })
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const ownerKey = await getChannelOwnerKey(channelId, channel.defaultAiProvider)
    if (!ownerKey.apiKey) {
        return NextResponse.json({ error: 'No AI API key configured' }, { status: 400 })
    }

    const provider = ownerKey.provider!
    const apiKey = ownerKey.apiKey

    // Load all knowledge entries and products
    const kbEntries = await prisma.knowledgeBase.findMany({
        where: { channelId },
        select: { id: true },
    })
    const products = await prisma.productCatalog.findMany({
        where: { channelId },
        select: { id: true },
    })

    const results = { embedded: 0, failed: 0, total: kbEntries.length + products.length }
    const errors: string[] = []

    // Embed knowledge base entries
    for (const entry of kbEntries) {
        try {
            await embedAndSaveKnowledge(entry.id, provider, apiKey)
            results.embedded++
        } catch (e: any) {
            results.failed++
            errors.push(`KB ${entry.id}: ${e.message}`)
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100))
    }

    // Embed products
    for (const product of products) {
        try {
            await embedAndSaveProduct(product.id, provider, apiKey)
            results.embedded++
        } catch (e: any) {
            results.failed++
            errors.push(`Product ${product.id}: ${e.message}`)
        }
        await new Promise(r => setTimeout(r, 100))
    }

    return NextResponse.json({
        success: true,
        embedded: results.embedded,
        failed: results.failed,
        total: results.total,
        errors: errors.slice(0, 5), // only return first 5 errors
        message: `Embedded ${results.embedded}/${results.total} entries`,
    })
}

/**
 * GET /api/admin/channels/[id]/bot-config/embed
 * Returns embedding coverage stats for this channel.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params

    const [kbTotal, kbEmbedded, productTotal, productEmbedded] = await Promise.all([
        prisma.knowledgeBase.count({ where: { channelId } }),
        prisma.$queryRawUnsafe<[{ count: bigint }]>(
            `SELECT COUNT(*)::bigint AS count FROM knowledge_bases WHERE channel_id = $1 AND embedded_at IS NOT NULL`,
            channelId
        ).then(r => Number(r[0]?.count ?? 0)),
        prisma.productCatalog.count({ where: { channelId } }),
        prisma.$queryRawUnsafe<[{ count: bigint }]>(
            `SELECT COUNT(*)::bigint AS count FROM product_catalog WHERE channel_id = $1 AND embedded_at IS NOT NULL`,
            channelId
        ).then(r => Number(r[0]?.count ?? 0)),
    ])

    return NextResponse.json({
        knowledge: { total: kbTotal, embedded: kbEmbedded },
        products: { total: productTotal, embedded: productEmbedded },
        ready: kbEmbedded + productEmbedded > 0,
    })
}
