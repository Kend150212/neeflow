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


// GET /api/oauth/x/callback
export async function GET(req: NextRequest) {
    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) return popupOrRedirect('/dashboard', 'x', false)
    if (!code || !stateParam) return popupOrRedirect('/dashboard?error=missing_params', 'x', false)

    let state: { channelId: string; userId: string; codeVerifier: string }
    try { state = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) }
    catch { return popupOrRedirect('/dashboard?error=invalid_state', 'x', false) }

    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'x' } })
    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.xClientId || process.env.X_CLIENT_ID
    let clientSecret = process.env.X_CLIENT_SECRET || ''
    if (integration?.apiKeyEncrypted) {
        try { clientSecret = decrypt(integration.apiKeyEncrypted) } catch { clientSecret = integration.apiKeyEncrypted }
    }
    if (!clientId || !clientSecret) return popupOrRedirect('/dashboard?error=not_configured', 'x', false)

    const redirectUri = `${host}/api/oauth/x/callback`

    try {
        // X OAuth 2.0 uses Basic Auth for confidential clients
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: state.codeVerifier,
            }),
        })
        if (!tokenRes.ok) {
            console.error('X token exchange failed:', await tokenRes.text())
            return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=token_failed`, 'x', false)
        }
        const tokens = await tokenRes.json()
        const accessToken = tokens.access_token
        const refreshToken = tokens.refresh_token
        const expiresIn = tokens.expires_in

        // Get X user info including profile image
        const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name', {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        let username = 'X Account'
        let userId = 'unknown'
        let avatarUrl: string | undefined
        if (userRes.ok) {
            const userData = await userRes.json()
            username = userData.data?.username || username
            userId = userData.data?.id || userId
            // X returns _normal (48px) — replace with _400x400 for a bigger version
            const profileImg = userData.data?.profile_image_url
            avatarUrl = profileImg ? profileImg.replace('_normal', '_400x400') : undefined
        }

        await prisma.channelPlatform.upsert({
            where: {
                channelId_platform_accountId: {
                    channelId: state.channelId,
                    platform: 'x',
                    accountId: userId,
                },
            },
            update: { accountName: `@${username}`, avatarUrl: avatarUrl || undefined, accessToken, refreshToken: refreshToken || undefined, tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null, connectedBy: state.userId || null, isActive: true } as any,
            create: {
                channelId: state.channelId, platform: 'x', accountId: userId, accountName: `@${username}`,
                avatarUrl: avatarUrl || undefined,
                accessToken, refreshToken: refreshToken || undefined, tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                connectedBy: state.userId || null, isActive: true, config: { source: 'oauth' },
            } as any,
        })

        const successUrl = `/dashboard/channels/${state.channelId}?tab=platforms&oauth=x&imported=1`
        return new NextResponse(
            `<!DOCTYPE html><html><head><title>X Connected</title></head><body>
            <script>
                if (window.opener) { window.opener.postMessage({ type: 'oauth-success', platform: 'x' }, '*'); window.close(); }
                else { window.location.href = '${successUrl}'; }
            </script><p>X connected! Redirecting...</p></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
        )
    } catch (err) {
        console.error('X OAuth callback error:', err)
        return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=oauth_failed`, 'x', false)
    }
}
