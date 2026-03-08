import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

function makeBasicAuth(username: string, appPassword: string): string {
    return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64')
}

interface WooProduct {
    id: number
    name: string
    description: string
    short_description: string
    price: string
    regular_price: string
    sale_price: string
    status: string
    stock_status: string  // 'instock' | 'outofstock' | 'onbackorder'
    categories: { id: number; name: string }[]
    tags: { id: number; name: string }[]
    images: { src: string }[]
}

interface WpPost {
    id: number
    title: { rendered: string }
    excerpt: { rendered: string }
    content: { rendered: string }
    status: string
    featured_media: number
    _embedded?: { 'wp:featuredmedia'?: { source_url: string }[] }
}

// POST /api/integrations/wordpress/sync — pull products+posts from WP/WooCommerce into ProductCatalog
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await req.json()
    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma as any).wordPressConfig.findUnique({ where: { channelId } })
    if (!config || !config.appPassword) {
        return NextResponse.json({ error: 'No WordPress config found for this channel' }, { status: 404 })
    }

    const password = decrypt(config.appPassword)
    const auth_header = makeBasicAuth(config.username, password)
    const baseUrl = config.siteUrl.replace(/\/$/, '')

    let synced = 0
    let failed = 0

    async function upsertProduct(payload: {
        externalId: string
        name: string
        description: string
        price: number | null
        salePrice: number | null
        category: string
        tags: string[]
        images: string[]
        inStock: boolean
    }) {
        try {
            const existing = await prisma.productCatalog.findFirst({
                where: { channelId, syncSource: 'wordpress', externalId: payload.externalId },
                select: { id: true },
            })
            await prisma.productCatalog.upsert({
                where: { id: existing?.id ?? 'new_' + payload.externalId },
                create: { channelId, syncSource: 'wordpress', syncedAt: new Date(), ...payload },
                update: { ...payload, syncedAt: new Date() },
            })
            synced++
        } catch { failed++ }
    }

    try {
        // ── WooCommerce products ──────────────────────────────────────────────
        if (config.syncWooProducts) {
            let wooPage = 1
            let hasMore = true
            while (hasMore) {
                const res = await fetch(
                    `${baseUrl}/wp-json/wc/v3/products?per_page=100&page=${wooPage}&status=publish`,
                    { headers: { Authorization: auth_header }, signal: AbortSignal.timeout(20000) },
                )
                if (!res.ok) break
                const products: WooProduct[] = await res.json()
                if (products.length === 0) { hasMore = false; break }

                for (const p of products) {
                    const price = parseFloat(p.regular_price || p.price) || null
                    const salePrice = p.sale_price ? parseFloat(p.sale_price) : null
                    const category = p.categories.map(c => c.name).join(' · ') || 'WooCommerce'
                    const tags = p.tags.map(t => t.name)
                    const images = p.images.map(i => i.src)
                    const desc = (p.short_description || p.description)
                        .replace(/<[^>]+>/g, '').trim()
                    await upsertProduct({
                        externalId: `woo_${p.id}`,
                        name: p.name,
                        description: desc,
                        price,
                        salePrice,
                        category,
                        tags,
                        images,
                        inStock: p.stock_status === 'instock',
                    })
                }

                const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1')
                if (wooPage >= totalPages) hasMore = false
                else wooPage++
            }
        }

        // ── WordPress posts ───────────────────────────────────────────────────
        if (config.syncWpPosts) {
            let wpPage = 1
            let hasMore = true
            while (hasMore) {
                const res = await fetch(
                    `${baseUrl}/wp-json/wp/v2/posts?per_page=100&page=${wpPage}&status=publish&_embed=wp:featuredmedia`,
                    { headers: { Authorization: auth_header }, signal: AbortSignal.timeout(20000) },
                )
                if (!res.ok) break
                const posts: WpPost[] = await res.json()
                if (posts.length === 0) { hasMore = false; break }

                for (const p of posts) {
                    const title = p.title.rendered.replace(/<[^>]+>/g, '')
                    const excerpt = p.excerpt.rendered.replace(/<[^>]+>/g, '').trim()
                    const featImg = p._embedded?.['wp:featuredmedia']?.[0]?.source_url
                    await upsertProduct({
                        externalId: `post_${p.id}`,
                        name: title,
                        description: excerpt,
                        price: null,
                        salePrice: null,
                        category: 'WordPress Post',
                        tags: [],
                        images: featImg ? [featImg] : [],
                        inStock: true, // published = active
                    })
                }

                const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1')
                if (wpPage >= totalPages) hasMore = false
                else wpPage++
            }
        }

        // Update stats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).wordPressConfig.update({
            where: { channelId },
            data: { lastSyncedAt: new Date(), productCount: synced },
        })

        return NextResponse.json({ success: true, synced, failed })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
