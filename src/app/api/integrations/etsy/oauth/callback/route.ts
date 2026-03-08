import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'

// GET /api/integrations/etsy/oauth/callback?code=...&state=...
// Exchanges authorization code for tokens, saves EtsyConfig and redirects to dashboard
export async function GET(req: NextRequest) {
    const url = req.nextUrl
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Handle user denial
    if (error) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?error=${encodeURIComponent(error)}`
        )
    }

    if (!code || !state) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?error=missing_params`
        )
    }

    // Read + validate the PKCE state cookie
    const stateCookie = req.cookies.get('etsy_oauth_state')?.value
    if (!stateCookie) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?error=session_expired`
        )
    }

    let parsed: { codeVerifier: string; channelId: string; state: string }
    try {
        parsed = JSON.parse(Buffer.from(stateCookie, 'base64').toString('utf8'))
    } catch {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?error=invalid_state`
        )
    }

    if (parsed.state !== state) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?error=state_mismatch`
        )
    }

    const { codeVerifier, channelId } = parsed

    // Read Etsy credentials from Admin API Hub (DB), fallback to env vars
    let clientId: string | undefined
    let clientSecret: string | undefined
    try {
        const etsyIntegration = await prisma.apiIntegration.findFirst({
            where: { provider: 'etsy' },
            select: { config: true, apiKeyEncrypted: true },
        })
        const cfg = etsyIntegration?.config as Record<string, string> | null
        clientId = cfg?.etsyClientId ?? undefined
        if (etsyIntegration?.apiKeyEncrypted) {
            clientSecret = decrypt(etsyIntegration.apiKeyEncrypted)
        }
    } catch { /* ignore, fall through to env */ }
    if (!clientId) clientId = process.env.ETSY_CLIENT_ID
    if (!clientSecret) clientSecret = process.env.ETSY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?error=not_configured`
        )
    }

    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/integrations/etsy/oauth/callback`

    try {
        // Exchange code for tokens
        const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId,
                redirect_uri: callbackUrl,
                code,
                code_verifier: codeVerifier,
            }),
        })

        if (!tokenRes.ok) {
            const errText = await tokenRes.text()
            console.error('Etsy token exchange failed:', errText)
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?channelId=${channelId}&error=token_exchange_failed`
            )
        }

        const tokenData = await tokenRes.json() as {
            access_token: string
            refresh_token: string
            expires_in: number
            token_type: string
        }

        const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        // Fetch shop info with the new access token
        const meRes = await fetch('https://openapi.etsy.com/v3/application/users/me', {
            headers: {
                'x-api-key': clientId,
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        })
        const meData = await meRes.json() as { user_id: number; primary_email?: string; login_name?: string }
        const userId = String(meData.user_id)

        // Get shops for this user
        const shopsRes = await fetch(
            `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
            {
                headers: {
                    'x-api-key': clientId,
                    Authorization: `Bearer ${tokenData.access_token}`,
                },
            }
        )
        const shopsData = await shopsRes.json() as { shop_id: number; shop_name: string } | { results?: { shop_id: number; shop_name: string }[] }
        // Handle both single shop and array responses
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shop = (shopsData as any).shop_id
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (shopsData as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (shopsData as any).results?.[0]

        if (!shop) {
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?channelId=${channelId}&error=no_shop`
            )
        }

        // Encrypt and save tokens
        await (prisma as any).etsyConfig.upsert({
            where: { channelId },
            create: {
                channelId,
                accessToken: encrypt(tokenData.access_token),
                refreshToken: encrypt(tokenData.refresh_token),
                tokenExpiresAt,
                shopId: String(shop.shop_id),
                shopName: shop.shop_name,
            },
            update: {
                accessToken: encrypt(tokenData.access_token),
                refreshToken: encrypt(tokenData.refresh_token),
                tokenExpiresAt,
                shopId: String(shop.shop_id),
                shopName: shop.shop_name,
            },
        })

        // Clear the state cookie
        const response = NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?channelId=${channelId}&connected=1`
        )
        response.cookies.set('etsy_oauth_state', '', { maxAge: 0, path: '/' })
        return response
    } catch (err) {
        console.error('Etsy OAuth callback error:', err)
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/dashboard/integrations/etsy?channelId=${channelId}&error=server_error`
        )
    }
}
