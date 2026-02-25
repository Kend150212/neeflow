import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/oauth/instagram — Initiate Instagram OAuth (via Facebook/Meta)
// Supports both authenticated (admin) and EasyConnect (easyToken) flows.
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

    // Instagram uses the SAME Facebook App (App ID + Secret)
    let integration = await prisma.apiIntegration.findFirst({ where: { provider: 'instagram' } })
    let clientId = ''

    if (integration) {
        const config = (integration.config || {}) as Record<string, string>
        clientId = config.instagramClientId || ''
    }

    if (!clientId) {
        const fbIntegration = await prisma.apiIntegration.findFirst({ where: { provider: 'facebook' } })
        const fbConfig = (fbIntegration?.config || {}) as Record<string, string>
        clientId = fbConfig.facebookClientId || process.env.FACEBOOK_CLIENT_ID || ''
    }

    if (!clientId) {
        return NextResponse.json({
            error: 'Instagram OAuth is not configured. Instagram uses the same Facebook App — please add Facebook App ID in API Hub → Social Media → Facebook first.',
        }, { status: 400 })
    }

    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const redirectUri = `${host}/api/oauth/instagram/callback`

    const stateData: Record<string, string> = { channelId, userId: userId || '' }
    if (easyToken) stateData.easyToken = easyToken
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url')

    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'instagram_basic,instagram_manage_messages,instagram_manage_comments,instagram_content_publish,pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_metadata,business_management')
    authUrl.searchParams.set('auth_type', 'rerequest')
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
}
