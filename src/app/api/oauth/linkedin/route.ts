import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/oauth/linkedin — Initiate LinkedIn OAuth flow
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

    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'linkedin' } })
    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.linkedinClientId || process.env.LINKEDIN_CLIENT_ID

    if (!clientId) {
        return NextResponse.json({ error: 'LinkedIn OAuth is not configured. Please add LinkedIn Client ID in API Hub.' }, { status: 400 })
    }

    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const redirectUri = `${host}/api/oauth/linkedin/callback`

    const stateData: Record<string, string> = { channelId, userId: userId || '' }
    if (easyToken) stateData.easyToken = easyToken
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url')

    // Always request r_organization_social for follower stats; org posting scope is conditional
    let scopes = 'openid profile w_member_social r_organization_social'
    if (config.linkedinOrgEnabled === 'true') {
        scopes += ' w_organization_social'
    }

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
}
