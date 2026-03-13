import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/oauth/threads — Initiate Threads OAuth
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

    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'threads' } })
    if (!integration) {
        return NextResponse.json({ error: 'Threads is not configured. Add your App ID in Admin → Integrations → Threads.' }, { status: 400 })
    }

    const config = (integration.config || {}) as Record<string, string>
    const clientId = config.threadsClientId

    if (!clientId) {
        return NextResponse.json({ error: 'Threads App ID is missing. Configure it in Admin → Integrations → Threads.' }, { status: 400 })
    }

    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const redirectUri = `${host}/api/oauth/threads/callback`

    const stateData: Record<string, string> = { channelId, userId: userId || '' }
    if (easyToken) stateData.easyToken = easyToken
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url')

    const authUrl = new URL('https://threads.net/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies,threads_manage_mentions')
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
}
