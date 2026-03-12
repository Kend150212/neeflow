import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/oauth/tiktok — Initiate TikTok OAuth flow with PKCE
// Supports both authenticated (admin) and EasyConnect (easyToken) flows.
import crypto from 'crypto'

export async function GET(req: NextRequest) {
    const channelId = req.nextUrl.searchParams.get('channelId')
    const easyToken = req.nextUrl.searchParams.get('easyToken')

    if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })

    let userId: string | null = null
    if (easyToken) {
        const link = await prisma.easyConnectLink.findUnique({ where: { token: easyToken } })
        if (!link || !link.isEnabled || link.channelId !== channelId) {
            return NextResponse.json({ error: 'Invalid EasyConnect link' }, { status: 403 })
        }
        userId = link.createdBy // Use admin who created the link
    } else {
        const session = await auth()
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        userId = session.user.id
    }

    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'tiktok' } })
    const config = (integration?.config || {}) as Record<string, string>
    const clientKey = config.tiktokClientKey || process.env.TIKTOK_CLIENT_KEY

    if (!clientKey) {
        return NextResponse.json(
            { error: 'TikTok OAuth is not configured. Please add TikTok Client Key in API Hub → Social Media → TikTok.' },
            { status: 400 }
        )
    }

    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const redirectUri = `${host}/api/oauth/tiktok/callback`

    const stateData: Record<string, string> = { channelId, userId, codeVerifier }
    if (easyToken) stateData.easyToken = easyToken
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url')

    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/')
    authUrl.searchParams.set('client_key', clientKey)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'user.info.basic,video.upload,video.publish,user.info.stats,video.list')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    return NextResponse.redirect(authUrl.toString())
}
