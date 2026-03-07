import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

interface ShopifyProduct {
    id: number
    title: string
    body_html: string
    vendor: string
    product_type: string
    tags: string
    status: string
    variants: { price: string; compare_at_price?: string | null; inventory_quantity: number }[]
    images: { src: string }[]
}

// POST /api/integrations/shopify/sync?channelId=xxx — pull all products from Shopify
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await req.json()
    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })

    const config = await prisma.shopifyConfig.findUnique({ where: { channelId } })
    if (!config || !config.accessToken) {
        return NextResponse.json({ error: 'No Shopify config found' }, { status: 404 })
    }

    const token = decrypt(config.accessToken)
    const domain = config.shopDomain

    let synced = 0
    let failed = 0
    let pageInfo: string | null = null

    try {
        // Cursor-based pagination (Shopify 2024-10)
        do {
            const url: string = pageInfo
                ? `https://${domain}/admin/api/2024-10/products.json?limit=250&page_info=${pageInfo}&fields=id,title,body_html,vendor,product_type,tags,status,variants,images`
                : `https://${domain}/admin/api/2024-10/products.json?limit=250&fields=id,title,body_html,vendor,product_type,tags,status,variants,images`

            const res = await fetch(url, {
                headers: { 'X-Shopify-Access-Token': token },
            })

            if (!res.ok) {
                return NextResponse.json({ error: `Shopify API error: ${res.status}` }, { status: 502 })
            }

            // Extract cursor from Link header
            const linkHeader = res.headers.get('link') || ''
            const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&"]+)[^>]*>;\s*rel="next"/)
            pageInfo = nextMatch ? nextMatch[1] : null

            const data = await res.json()
            const products: ShopifyProduct[] = data.products || []

            // Upsert each product into ProductCatalog
            for (const p of products) {
                try {
                    const variant = p.variants[0]
                    const price = variant ? parseFloat(variant.price) : 0
                    const salePrice = variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null
                    const totalInventory = p.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0)
                    const images = config.syncImages
                        ? (p.images || []).map((img) => img.src)
                        : []
                    const category = [p.vendor, p.product_type].filter(Boolean).join(' · ') || 'General'
                    const tags = p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
                    const description = p.body_html?.replace(/<[^>]+>/g, '').trim() || ''

                    await prisma.productCatalog.upsert({
                        where: {
                            // Use channelId + externalId via a findFirst then upsert by id
                            id: (await prisma.productCatalog.findFirst({
                                where: { channelId, syncSource: 'shopify', externalId: String(p.id) },
                                select: { id: true },
                            }))?.id ?? 'new_' + p.id,
                        },
                        create: {
                            channelId,
                            syncSource: 'shopify',
                            externalId: String(p.id),
                            name: p.title,
                            description,
                            price,
                            salePrice,
                            category,
                            tags,
                            images,
                            inStock: totalInventory > 0 || p.status === 'active',
                            syncedAt: new Date(),
                        },
                        update: {
                            name: p.title,
                            description,
                            price,
                            salePrice,
                            category,
                            tags,
                            images,
                            inStock: totalInventory > 0 || p.status === 'active',
                            syncedAt: new Date(),
                        },
                    })
                    synced++
                } catch {
                    failed++
                }
            }
        } while (pageInfo)

        // Update config stats
        await prisma.shopifyConfig.update({
            where: { channelId },
            data: { lastSyncedAt: new Date(), productCount: synced },
        })

        return NextResponse.json({ success: true, synced, failed })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
