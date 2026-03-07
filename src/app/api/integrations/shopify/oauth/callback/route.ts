import { NextRequest, NextResponse } from 'next/server'
import { prisma as prismaClient } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = prismaClient as any

// GET /api/integrations/shopify/oauth/callback?code=xxx&shop=xxx&state=xxx&hmac=xxx
// Shopify redirects here after user authorizes the app
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const code = searchParams.get('code')
    const shop = searchParams.get('shop')
    const state = searchParams.get('state')
    const hmac = searchParams.get('hmac')

    if (!code || !shop || !state || !hmac) {
        return NextResponse.redirect(
            new URL('/dashboard/integrations/shopify?error=missing_params', req.url)
        )
    }

    // Decode state → channelId:userId
    let channelId: string
    let userId: string
    try {
        const decoded = Buffer.from(state, 'base64url').toString('utf-8')
        const [cId, uId] = decoded.split(':')
        channelId = cId
        userId = uId
        if (!channelId || !userId) throw new Error('invalid state')
    } catch {
        return NextResponse.redirect(
            new URL('/dashboard/integrations/shopify?error=invalid_state', req.url)
        )
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
    if (!clientId || !clientSecret) {
        return NextResponse.redirect(
            new URL('/dashboard/integrations/shopify?error=not_configured', req.url)
        )
    }

    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })

    if (!tokenRes.ok) {
        return NextResponse.redirect(
            new URL(`/dashboard/integrations/shopify?channelId=${channelId}&error=token_exchange_failed`, req.url)
        )
    }

    const tokenData = await tokenRes.json()
    const accessToken: string = tokenData.access_token

    if (!accessToken) {
        return NextResponse.redirect(
            new URL(`/dashboard/integrations/shopify?channelId=${channelId}&error=no_token`, req.url)
        )
    }

    // Save to DB (encrypted)
    const shopDomain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '')
    await prisma.shopifyConfig.upsert({
        where: { channelId },
        create: {
            channelId,
            shopDomain,
            accessToken: encrypt(accessToken),
            syncInventory: true,
            syncCollections: true,
            syncImages: true,
        },
        update: {
            shopDomain,
            accessToken: encrypt(accessToken),
        },
    })

    // Redirect back to Shopify settings page with success
    return NextResponse.redirect(
        new URL(`/dashboard/integrations/shopify?channelId=${channelId}&connected=1`, req.url)
    )
}
