/**
 * Integration Sync Helpers
 *
 * Shared functions used by:
 *  - Auto-sync on first connect (fire-and-forget via setImmediate)
 *  - Daily cron: /api/cron/sync-products
 *  - Manual sync buttons (existing routes still work independently)
 *
 * Now includes productUrl so the bot can share direct purchase links.
 */

import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/encryption'

// ─── Shopify ────────────────────────────────────────────────────────────────

interface ShopifyProduct {
    id: number
    title: string
    body_html: string
    vendor: string
    product_type: string
    handle: string    // used to construct storefront URL
    tags: string
    status: string
    variants: { price: string; compare_at_price?: string | null; inventory_quantity: number }[]
    images: { src: string }[]
}

export async function syncShopifyProducts(channelId: string): Promise<{ synced: number; failed: number }> {
    const config = await prisma.shopifyConfig.findUnique({ where: { channelId } })
    if (!config?.accessToken) return { synced: 0, failed: 0 }

    const token = decrypt(config.accessToken)
    const domain = config.shopDomain
    let synced = 0
    let failed = 0
    let pageInfo: string | null = null

    try {
        do {
            const url = pageInfo
                ? `https://${domain}/admin/api/2024-10/products.json?limit=250&page_info=${pageInfo}&fields=id,title,body_html,vendor,product_type,handle,tags,status,variants,images`
                : `https://${domain}/admin/api/2024-10/products.json?limit=250&fields=id,title,body_html,vendor,product_type,handle,tags,status,variants,images`

            const res = await fetch(url, {
                headers: { 'X-Shopify-Access-Token': token },
                signal: AbortSignal.timeout(30000),
            })
            if (!res.ok) break

            const linkHeader = res.headers.get('link') || ''
            const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&"]+)[^>]*>;\s*rel="next"/)
            pageInfo = nextMatch ? nextMatch[1] : null

            const data = await res.json()
            const products: ShopifyProduct[] = data.products || []

            for (const p of products) {
                try {
                    const variant = p.variants[0]
                    const price = variant ? parseFloat(variant.price) : 0
                    const salePrice = variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null
                    const totalInventory = p.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0)
                    const images = config.syncImages ? (p.images || []).map(img => img.src) : []
                    const category = [p.vendor, p.product_type].filter(Boolean).join(' · ') || 'General'
                    const tags = p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : []
                    const description = p.body_html?.replace(/<[^>]+>/g, '').trim() || ''
                    // Shopify storefront URL: https://{domain}/products/{handle}
                    const productUrl = p.handle ? `https://${domain}/products/${p.handle}` : null

                    const existing = await prisma.productCatalog.findFirst({
                        where: { channelId, syncSource: 'shopify', externalId: String(p.id) },
                        select: { id: true },
                    })

                    await (prisma.productCatalog as any).upsert({
                        where: { id: existing?.id ?? 'new_' + p.id },
                        create: { channelId, syncSource: 'shopify', externalId: String(p.id), name: p.title, description, price, salePrice, category, tags, images, productUrl, inStock: totalInventory > 0 || p.status === 'active', syncedAt: new Date() },
                        update: { name: p.title, description, price, salePrice, category, tags, images, productUrl, inStock: totalInventory > 0 || p.status === 'active', syncedAt: new Date() },
                    })
                    synced++
                } catch { failed++ }
            }
        } while (pageInfo)

        await prisma.shopifyConfig.update({
            where: { channelId },
            data: { lastSyncedAt: new Date(), productCount: synced },
        })
    } catch (err) {
        console.error(`[AutoSync] Shopify channel=${channelId} error:`, err)
    }

    return { synced, failed }
}

// ─── Etsy ────────────────────────────────────────────────────────────────────

async function refreshEtsyToken(config: {
    accessToken: string; refreshToken: string; tokenExpiresAt: Date; channelId: string
}): Promise<string> {
    const now = new Date()
    if (config.tokenExpiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
        return decrypt(config.accessToken)
    }
    const clientId = process.env.ETSY_CLIENT_ID!
    const clientSecret = process.env.ETSY_CLIENT_SECRET!
    const res = await fetch('https://api.etsy.com/v3/public/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: decrypt(config.refreshToken) }),
    })
    if (!res.ok) throw new Error('Failed to refresh Etsy token')
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000)
    await (prisma as any).etsyConfig.update({
        where: { channelId: config.channelId },
        data: { accessToken: encrypt(data.access_token), ...(data.refresh_token ? { refreshToken: encrypt(data.refresh_token) } : {}), tokenExpiresAt },
    })
    return data.access_token
}

export async function syncEtsyProducts(channelId: string): Promise<{ synced: number; failed: number }> {
    const config = await (prisma as any).etsyConfig.findUnique({ where: { channelId } })
    if (!config) return { synced: 0, failed: 0 }
    const clientId = process.env.ETSY_CLIENT_ID
    if (!clientId) return { synced: 0, failed: 0 }

    let synced = 0
    let failed = 0

    try {
        const accessToken = await refreshEtsyToken(config)
        let offset = 0
        const limit = 100

        while (true) {
            const res = await fetch(
                `https://openapi.etsy.com/v3/application/shops/${config.shopId}/listings/active?limit=${limit}&offset=${offset}&includes[]=Images&includes[]=MainImage`,
                { headers: { 'x-api-key': clientId, Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) }
            )
            if (!res.ok) break
            const data = await res.json() as { results: unknown[]; count: number }
            if (!data.results || data.results.length === 0) break

            for (const listing of data.results as Record<string, unknown>[]) {
                try {
                    const images: string[] = []
                    const imgArr = (listing.images as { url_fullxfull?: string }[] | undefined) ?? []
                    for (const img of imgArr) { if (img.url_fullxfull) images.push(img.url_fullxfull) }
                    const mainImg = (listing.MainImage as { url_fullxfull?: string } | undefined)
                    if (images.length === 0 && mainImg?.url_fullxfull) images.push(mainImg.url_fullxfull)

                    const priceData = listing.price as { amount?: number; divisor?: number } | undefined
                    const price = priceData?.amount && priceData?.divisor ? priceData.amount / priceData.divisor : null
                    const externalId = `etsy_${listing.listing_id}`
                    const existing = await prisma.productCatalog.findFirst({
                        where: { channelId, syncSource: 'etsy', externalId },
                        select: { id: true },
                    })
                    const taxonomyPath = listing.taxonomy_path as string[] | undefined
                    const tagsArr = (listing.tags as string[] | undefined) ?? []
                    const materialsArr = (listing.materials as string[] | undefined) ?? []
                    // Etsy listing URL: https://www.etsy.com/listing/{listing_id}
                    const productUrl = listing.listing_id ? `https://www.etsy.com/listing/${listing.listing_id}` : null

                    await (prisma.productCatalog as any).upsert({
                        where: { id: existing?.id ?? `new_${externalId}` },
                        create: { channelId, externalId, name: String(listing.title || ''), description: String(listing.description || '').substring(0, 5000), price, salePrice: null, images, productUrl, category: String(taxonomyPath?.[0] || ''), tags: [...tagsArr, ...materialsArr], inStock: listing.state === 'active' && Number(listing.quantity) > 0, syncSource: 'etsy', syncedAt: new Date() },
                        update: { name: String(listing.title || ''), description: String(listing.description || '').substring(0, 5000), price, images, productUrl, category: String(taxonomyPath?.[0] || ''), tags: [...tagsArr, ...materialsArr], inStock: listing.state === 'active' && Number(listing.quantity) > 0, syncedAt: new Date() },
                    })
                    synced++
                } catch { failed++ }
            }

            if (data.results.length < limit) break
            offset += limit
        }

        await (prisma as any).etsyConfig.update({
            where: { channelId },
            data: { lastSyncedAt: new Date(), productCount: synced },
        })
    } catch (err) {
        console.error(`[AutoSync] Etsy channel=${channelId} error:`, err)
    }

    return { synced, failed }
}

// ─── WordPress / WooCommerce ─────────────────────────────────────────────────

export async function syncWordPressProducts(channelId: string): Promise<{ synced: number; failed: number }> {
    const config = await (prisma as any).wordPressConfig.findUnique({ where: { channelId } })
    if (!config?.appPassword) return { synced: 0, failed: 0 }

    const password = decrypt(config.appPassword)
    const auth_header = 'Basic ' + Buffer.from(`${config.username}:${password}`).toString('base64')
    const baseUrl = config.siteUrl.replace(/\/$/, '')
    let synced = 0
    let failed = 0

    async function upsertProduct(payload: {
        externalId: string; name: string; description: string
        price: number | null; salePrice: number | null
        category: string; tags: string[]; images: string[]
        inStock: boolean; productUrl: string | null
    }) {
        try {
            const existing = await prisma.productCatalog.findFirst({
                where: { channelId, syncSource: 'wordpress', externalId: payload.externalId },
                select: { id: true },
            })
            await (prisma.productCatalog as any).upsert({
                where: { id: existing?.id ?? 'new_' + payload.externalId },
                create: { channelId, syncSource: 'wordpress', syncedAt: new Date(), ...payload },
                update: { ...payload, syncedAt: new Date() },
            })
            synced++
        } catch { failed++ }
    }

    try {
        // WooCommerce products — URL from product.permalink
        if (config.syncWooProducts) {
            let page = 1, hasMore = true
            while (hasMore) {
                const res = await fetch(`${baseUrl}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`,
                    { headers: { Authorization: auth_header }, signal: AbortSignal.timeout(20000) })
                if (!res.ok) break
                const products = await res.json() as any[]
                if (!products.length) { hasMore = false; break }
                for (const p of products) {
                    await upsertProduct({
                        externalId: `woo_${p.id}`,
                        name: p.name,
                        description: (p.short_description || p.description).replace(/<[^>]+>/g, '').trim(),
                        price: parseFloat(p.regular_price || p.price) || null,
                        salePrice: p.sale_price ? parseFloat(p.sale_price) : null,
                        category: p.categories.map((c: any) => c.name).join(' · ') || 'WooCommerce',
                        tags: p.tags.map((t: any) => t.name),
                        images: p.images.map((i: any) => i.src),
                        inStock: p.stock_status === 'instock',
                        productUrl: p.permalink || null,  // WooCommerce provides permalink directly
                    })
                }
                const total = parseInt(res.headers.get('X-WP-TotalPages') || '1')
                if (page >= total) hasMore = false; else page++
            }
        }

        // WordPress posts — URL from post.link
        if (config.syncWpPosts) {
            let page = 1, hasMore = true
            while (hasMore) {
                const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=100&page=${page}&status=publish&_embed=wp:featuredmedia`,
                    { headers: { Authorization: auth_header }, signal: AbortSignal.timeout(20000) })
                if (!res.ok) break
                const posts = await res.json() as any[]
                if (!posts.length) { hasMore = false; break }
                for (const p of posts) {
                    const featImg = p._embedded?.['wp:featuredmedia']?.[0]?.source_url
                    await upsertProduct({
                        externalId: `post_${p.id}`,
                        name: p.title.rendered.replace(/<[^>]+>/g, ''),
                        description: p.excerpt.rendered.replace(/<[^>]+>/g, '').trim(),
                        price: null, salePrice: null,
                        category: 'WordPress Post',
                        tags: [],
                        images: featImg ? [featImg] : [],
                        inStock: true,
                        productUrl: p.link || null,  // WordPress REST API provides link field
                    })
                }
                const total = parseInt(res.headers.get('X-WP-TotalPages') || '1')
                if (page >= total) hasMore = false; else page++
            }
        }

        await (prisma as any).wordPressConfig.update({
            where: { channelId },
            data: { lastSyncedAt: new Date(), productCount: synced },
        })
    } catch (err) {
        console.error(`[AutoSync] WordPress channel=${channelId} error:`, err)
    }

    return { synced, failed }
}
