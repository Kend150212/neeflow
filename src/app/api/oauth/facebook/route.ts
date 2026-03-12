import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/oauth/facebook — Initiate Facebook OAuth flow
// Supports both authenticated (admin) and EasyConnect (easyToken) flows.
export async function GET(req: NextRequest) {
    const channelId = req.nextUrl.searchParams.get('channelId')
    const easyToken = req.nextUrl.searchParams.get('easyToken')

    if (!channelId) {
        return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
    }

    // EasyConnect flow: validate token instead of session
    let userId: string | null = null
    if (easyToken) {
        const link = await prisma.easyConnectLink.findUnique({ where: { token: easyToken } })
        if (!link || !link.isEnabled || link.channelId !== channelId) {
            return NextResponse.json({ error: 'Invalid or expired EasyConnect link' }, { status: 403 })
        }
        userId = link.createdBy // Use the admin who created the link
    } else {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        userId = session.user.id
    }

    const integration = await prisma.apiIntegration.findFirst({
        where: { provider: 'facebook' },
    })

    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.facebookClientId || process.env.FACEBOOK_CLIENT_ID

    if (!clientId) {
        return NextResponse.json(
            { error: 'Facebook OAuth is not configured. Please add Facebook App ID in API Hub → Social Media → Facebook.' },
            { status: 400 }
        )
    }

    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const redirectUri = `${host}/api/oauth/facebook/callback`

    const stateData: Record<string, string> = { channelId, userId: userId || '' }
    if (easyToken) stateData.easyToken = easyToken
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url')

    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'pages_show_list,pages_read_engagement,pages_manage_engagement,pages_manage_posts,pages_manage_metadata,pages_read_user_content,pages_messaging,business_management,read_insights')
    authUrl.searchParams.set('auth_type', 'rerequest')
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
}
