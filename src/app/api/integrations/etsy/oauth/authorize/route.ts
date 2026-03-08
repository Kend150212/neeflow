import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// GET /api/integrations/etsy/oauth/authorize?channelId=xxx
// Reads Etsy ClientId from Admin API Hub (DB), generates PKCE challenge, redirects to Etsy consent page
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 })

    // 1. Try to read Etsy clientId from Admin API Hub (DB)
    let clientId: string | undefined
    try {
        const etsyIntegration = await prisma.apiIntegration.findFirst({
            where: { provider: 'etsy' },
            select: { config: true, isActive: true },
        })
        const cfg = etsyIntegration?.config as Record<string, string> | null
        clientId = cfg?.etsyClientId ?? undefined
    } catch {
        // DB lookup failed, fall through to env var
    }

    // 2. Fallback to env var (legacy support)
    if (!clientId) clientId = process.env.ETSY_CLIENT_ID

    if (!clientId) {
        return NextResponse.json({
            error: 'Etsy is not configured. Admin must set Etsy Keystring in Admin → Integrations → Etsy.',
            errorVi: 'Etsy chưa được cấu hình. Admin cần nhập Etsy Keystring trong Admin → Integrations → Etsy.',
        }, { status: 503 })
    }

    // Generate PKCE code_verifier (random 64-byte base64url string)
    const codeVerifier = crypto.randomBytes(64).toString('base64url')

    // Compute code_challenge = base64url(SHA256(code_verifier))
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url')

    // Random state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex')

    // Store verifier + channelId + state in a short-lived signed cookie
    const cookieValue = Buffer.from(JSON.stringify({ codeVerifier, channelId, state })).toString('base64')

    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/integrations/etsy/oauth/callback`
    const scopes = 'listings_r shops_r'

    const authUrl = new URL('https://www.etsy.com/oauth/connect')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', callbackUrl)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    const response = NextResponse.redirect(authUrl.toString())
    response.cookies.set('etsy_oauth_state', cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
    })
    return response
}
