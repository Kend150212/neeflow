import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

// GET /api/integrations/shopify/oauth/install?channelId=xxx&shop=your-store.myshopify.com
// Redirects user to Shopify OAuth authorization page
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    const shop = req.nextUrl.searchParams.get('shop')?.replace(/^https?:\/\//, '').replace(/\/$/, '')

    if (!channelId || !shop) {
        return NextResponse.json({ error: 'Missing channelId or shop' }, { status: 400 })
    }

    // Resolve CLIENT_ID: env var takes priority, then DB (ApiIntegration shopify record)
    let clientId = process.env.SHOPIFY_CLIENT_ID

    if (!clientId) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const integration = await (prisma as any).apiIntegration.findFirst({
                where: { provider: 'shopify' },
            })
            if (integration?.config) {
                const cfg = integration.config as Record<string, string>
                clientId = cfg.shopifyClientId || ''
            }
        } catch { /* ignore */ }
    }

    if (!clientId) {
        return NextResponse.json({ error: 'SHOPIFY_CLIENT_ID not configured — set it in Admin → Integrations → Shopify' }, { status: 500 })
    }

    const appUrl = process.env.NEXTAUTH_URL || 'https://neeflow.com'
    const redirectUri = `${appUrl}/api/integrations/shopify/oauth/callback`
    const scopes = 'read_products,read_inventory'

    // State = base64(channelId:userId) — verified on callback
    const state = Buffer.from(`${channelId}:${session.user.id}`).toString('base64url')

    const authUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
        client_id: clientId,
        scope: scopes,
        redirect_uri: redirectUri,
        state,
        'grant_options[]': 'per-user',
    }).toString()

    return NextResponse.redirect(authUrl)
}
