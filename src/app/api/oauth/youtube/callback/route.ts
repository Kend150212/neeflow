import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

// Helper: tries postMessage (popup flow) then fallback redirect
function popupOrRedirect(url: string, platform: string, success: boolean) {
    return new NextResponse(
        `<!DOCTYPE html><html><head><title>${success ? 'Connected' : 'Error'}</title></head><body>
        <script>
            if (window.opener) { window.opener.postMessage({ type: '${success ? 'oauth-success' : 'oauth-error'}', platform: '${platform}' }, '*'); window.close(); }
            else { window.location.href = '${url}'; }
        </script><p>${success ? 'Connected!' : 'Error occurred.'} Redirecting...</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
    )
}


// GET /api/oauth/youtube/callback — Handle Google OAuth callback
export async function GET(req: NextRequest) {
    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) {
        return popupOrRedirect('/dashboard', 'youtube', true)
    }

    if (!code || !stateParam) {
        return popupOrRedirect('/dashboard?error=missing_params', 'youtube', false)
    }

    // Decode state
    let state: { channelId: string; userId: string }
    try {
        state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    } catch {
        return popupOrRedirect('/dashboard?error=invalid_state', 'youtube', false)
    }

    // Read credentials from database (API Hub)
    const integration = await prisma.apiIntegration.findFirst({
        where: { provider: 'youtube' },
    })

    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.youtubeClientId || process.env.GOOGLE_CLIENT_ID
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''

    // Client secret is stored encrypted as apiKeyEncrypted
    if (integration?.apiKeyEncrypted) {
        try {
            clientSecret = decrypt(integration.apiKeyEncrypted)
        } catch {
            clientSecret = integration.apiKeyEncrypted
        }
    }

    if (!clientId || !clientSecret) {
        return popupOrRedirect('/dashboard?error=not_configured', 'youtube', false)
    }

    const redirectUri = `${host}/api/oauth/youtube/callback`

    try {
        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        })

        if (!tokenRes.ok) {
            const err = await tokenRes.text()
            console.error('YouTube token exchange failed:', err)
            return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=token_failed`, 'youtube', false)
        }

        const tokens = await tokenRes.json()
        const accessToken = tokens.access_token
        const refreshToken = tokens.refresh_token
        const expiresIn = tokens.expires_in

        // Fetch YouTube channels — both owned and managed (brand accounts)
        const channelMap = new Map<string, { id: string; snippet: Record<string, string> }>()

        // 1. Channels owned by the user (mine=true)
        const ytRes = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50',
            { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (ytRes.ok) {
            const data = await ytRes.json()
            for (const ch of (data.items || [])) {
                channelMap.set(ch.id, ch)
            }
        } else {
            console.error('YouTube API (mine) failed:', await ytRes.text())
        }

        // 2. Channels managed by the user (brand accounts)
        const managedRes = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet&managedByMe=true&maxResults=50',
            { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (managedRes.ok) {
            const data = await managedRes.json()
            for (const ch of (data.items || [])) {
                channelMap.set(ch.id, ch) // dedup by channel ID
            }
        } else {
            console.warn('YouTube API (managed) failed — may not have manager access')
        }

        if (channelMap.size === 0) {
            return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=no_youtube_channels`, 'youtube', false)
        }

        const channels = Array.from(channelMap.values())

        let imported = 0
        for (const ch of channels) {
            const channelIdYT = ch.id
            const channelTitle = ch.snippet?.title || 'YouTube Channel'
            const avatarUrl = ch.snippet?.thumbnails?.['default']?.url || ch.snippet?.thumbnails?.medium?.url || undefined

            await prisma.channelPlatform.upsert({
                where: {
                    channelId_platform_accountId: {
                        channelId: state.channelId,
                        platform: 'youtube',
                        accountId: channelIdYT,
                    },
                },
                update: {
                    accountName: channelTitle,
                    avatarUrl: avatarUrl || undefined,
                    accessToken,
                    refreshToken: refreshToken || undefined,
                    tokenExpiresAt: expiresIn
                        ? new Date(Date.now() + expiresIn * 1000)
                        : null,
                    connectedBy: state.userId || null,
                    isActive: true,
                } as any,
                create: {
                    channelId: state.channelId,
                    platform: 'youtube',
                    accountId: channelIdYT,
                    accountName: channelTitle,
                    avatarUrl: avatarUrl || undefined,
                    accessToken,
                    refreshToken: refreshToken || undefined,
                    tokenExpiresAt: expiresIn
                        ? new Date(Date.now() + expiresIn * 1000)
                        : null,
                    connectedBy: state.userId || null,
                    isActive: true,
                    config: { source: 'oauth' },
                } as any,
            })
            imported++
        }

        // Redirect — close popup or redirect to channel page
        const successUrl = `/dashboard/channels/${state.channelId}?tab=platforms&oauth=youtube&imported=${imported}`

        return new NextResponse(
            `<!DOCTYPE html>
            <html><head><title>YouTube Connected</title></head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'oauth-success', platform: 'youtube' }, '*');
                        window.close();
                    } else {
                        window.location.href = '${successUrl}';
                    }
                </script>
                <p>YouTube connected! Redirecting...</p>
            </body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
        )
    } catch (err) {
        console.error('YouTube OAuth callback error:', err)
        return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=oauth_failed`, 'youtube', false)
    }
}
