import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/encryption'

async function getValidToken(config: {
    accessToken: string
    refreshToken: string
    tokenExpiresAt: Date
    channelId: string
}): Promise<string> {
    const now = new Date()
    // If token still valid (with 5-min buffer), return as-is
    if (config.tokenExpiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
        return decrypt(config.accessToken)
    }

    // Refresh the token
    const clientId = process.env.ETSY_CLIENT_ID!
    const clientSecret = process.env.ETSY_CLIENT_SECRET!
    const res = await fetch('https://api.etsy.com/v3/public/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: decrypt(config.refreshToken),
        }),
    })
    if (!res.ok) throw new Error('Failed to refresh Etsy token')
    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }

    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000)
    await (prisma as any).etsyConfig.update({
        where: { channelId: config.channelId },
        data: {
            accessToken: encrypt(data.access_token),
            ...(data.refresh_token ? { refreshToken: encrypt(data.refresh_token) } : {}),
            tokenExpiresAt,
        },
    })
    return data.access_token
}

// POST /api/integrations/etsy/sync — fetch active listings from Etsy and upsert to ProductCatalog
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await req.json()
    if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

    const config = await (prisma as any).etsyConfig.findUnique({ where: { channelId } })
    if (!config) return NextResponse.json({ error: 'Etsy not connected' }, { status: 404 })

    const clientId = process.env.ETSY_CLIENT_ID
    if (!clientId) return NextResponse.json({ error: 'Etsy not configured' }, { status: 503 })

    try {
        const accessToken = await getValidToken(config)
        let synced = 0

        // Paginate through all active listings
        let offset = 0
        const limit = 100
        while (true) {
            const res = await fetch(
                `https://openapi.etsy.com/v3/application/shops/${config.shopId}/listings/active?limit=${limit}&offset=${offset}&includes[]=Images&includes[]=MainImage`,
                {
                    headers: {
                        'x-api-key': clientId,
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            )
            if (!res.ok) break
            const data = await res.json() as { results: unknown[]; count: number }
            if (!data.results || data.results.length === 0) break

            for (const listing of data.results as Record<string, unknown>[]) {
                const images: string[] = []
                // Collect all listing images
                const imgArr = (listing.images as { url_fullxfull?: string }[] | undefined) ?? []
                for (const img of imgArr) {
                    if (img.url_fullxfull) images.push(img.url_fullxfull)
                }
                // Fallback to MainImage
                const mainImg = (listing.MainImage as { url_fullxfull?: string } | undefined)
                if (images.length === 0 && mainImg?.url_fullxfull) {
                    images.push(mainImg.url_fullxfull)
                }

                const priceData = listing.price as { amount?: number; divisor?: number; currency_code?: string } | undefined
                const price = priceData?.amount && priceData?.divisor
                    ? priceData.amount / priceData.divisor : null

                const tagsArr = (listing.tags as string[] | undefined) ?? []
                const materialsArr = (listing.materials as string[] | undefined) ?? []

                const externalId = `etsy_${listing.listing_id}`
                const existing = await prisma.productCatalog.findFirst({
                    where: { channelId, syncSource: 'etsy', externalId },
                    select: { id: true },
                })

                const taxonomyPath = listing.taxonomy_path as string[] | undefined
                const category = String(taxonomyPath?.[0] || '')

                await prisma.productCatalog.upsert({
                    where: { id: existing?.id ?? `new_${externalId}` },
                    create: {
                        channelId,
                        externalId,
                        name: String(listing.title || ''),
                        description: String(listing.description || '').substring(0, 5000),
                        price,
                        salePrice: null,
                        images,
                        category,
                        tags: [...tagsArr, ...materialsArr],
                        inStock: listing.state === 'active' && Number(listing.quantity) > 0,
                        syncSource: 'etsy',
                        syncedAt: new Date(),
                    },
                    update: {
                        name: String(listing.title || ''),
                        description: String(listing.description || '').substring(0, 5000),
                        price,
                        images,
                        category,
                        tags: [...tagsArr, ...materialsArr],
                        inStock: listing.state === 'active' && Number(listing.quantity) > 0,
                        syncedAt: new Date(),
                    },
                })
                synced++
            }

            if (data.results.length < limit) break
            offset += limit
        }

        await (prisma as any).etsyConfig.update({
            where: { channelId },
            data: { lastSyncedAt: new Date(), productCount: synced },
        })

        return NextResponse.json({ ok: true, synced })
    } catch (err) {
        console.error('Etsy sync error:', err)
        return NextResponse.json({ error: 'Sync failed', detail: String(err) }, { status: 500 })
    }
}
