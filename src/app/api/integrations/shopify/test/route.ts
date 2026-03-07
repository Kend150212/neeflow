import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

// POST /api/integrations/shopify/test — verify shop domain + token
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId, shopDomain, accessToken } = await req.json()
    if (!shopDomain || !accessToken) {
        return NextResponse.json({ ok: false, error: 'Missing shopDomain or accessToken' })
    }

    const domain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')

    try {
        const res = await fetch(`https://${domain}/admin/api/2024-10/shop.json`, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
        })

        if (!res.ok) {
            const errText = await res.text()
            return NextResponse.json({ ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` })
        }

        const data = await res.json()
        const shop = data.shop
        return NextResponse.json({
            ok: true,
            shopName: shop.name,
            email: shop.email,
            currency: shop.currency,
            planName: shop.plan_display_name ?? shop.plan_name,
            timezone: shop.iana_timezone,
        })
    } catch (e) {
        return NextResponse.json({ ok: false, error: (e as Error).message })
    }
}
