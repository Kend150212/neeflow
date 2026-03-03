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


// GET /api/oauth/pinterest/callback
export async function GET(req: NextRequest) {
    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) return popupOrRedirect('/dashboard', 'pinterest', false)
    if (!code || !stateParam) return popupOrRedirect('/dashboard?error=missing_params', 'pinterest', false)

    let state: { channelId: string; userId: string }
    try { state = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) }
    catch { return popupOrRedirect('/dashboard?error=invalid_state', 'pinterest', false) }

    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'pinterest' } })
    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.pinterestClientId || process.env.PINTEREST_CLIENT_ID
    let clientSecret = process.env.PINTEREST_CLIENT_SECRET || ''
    if (integration?.apiKeyEncrypted) {
        try { clientSecret = decrypt(integration.apiKeyEncrypted) } catch { clientSecret = integration.apiKeyEncrypted }
    }
    if (!clientId || !clientSecret) return popupOrRedirect('/dashboard?error=not_configured', 'pinterest', false)

    const redirectUri = `${host}/api/oauth/pinterest/callback`

    try {
        // Always use PRODUCTION URL for token exchange — sandbox tokens are specific to sandbox API
        // The Sandbox flag only controls where pins/boards are created, not OAuth
        const PINTEREST_PRODUCTION = 'https://api.pinterest.com'
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const tokenRes = await fetch(`${PINTEREST_PRODUCTION}/v5/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }),
        })
        if (!tokenRes.ok) {
            console.error('Pinterest token exchange failed:', await tokenRes.text())
            return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=token_failed`, 'pinterest', false)
        }
        const tokens = await tokenRes.json()
        const accessToken = tokens.access_token
        const refreshToken = tokens.refresh_token
        const expiresIn = tokens.expires_in

        // Get Pinterest user info — always use production for user_account
        const userRes = await fetch(`${PINTEREST_PRODUCTION}/v5/user_account`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        let username = 'Pinterest Account'
        let userId = 'unknown'
        let avatarUrl: string | undefined
        if (userRes.ok) {
            const userData = await userRes.json()
            username = userData.username || userData.business_name || username
            userId = userData.id || userId
            avatarUrl = userData.profile_picture || userData.profile_image || undefined
        }

        await prisma.channelPlatform.upsert({
            where: {
                channelId_platform_accountId: {
                    channelId: state.channelId,
                    platform: 'pinterest',
                    accountId: userId,
                },
            },
            update: { accountName: username, avatarUrl: avatarUrl || undefined, accessToken, refreshToken: refreshToken || undefined, tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null, connectedBy: state.userId || null, isActive: true } as any,
            create: {
                channelId: state.channelId, platform: 'pinterest', accountId: userId, accountName: username,
                avatarUrl: avatarUrl || undefined,
                accessToken, refreshToken: refreshToken || undefined, tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                connectedBy: state.userId || null, isActive: true, config: { source: 'oauth' },
            } as any,
        })

        const successUrl = `/dashboard/channels/${state.channelId}?tab=platforms&oauth=pinterest&imported=1`
        return new NextResponse(
            `<!DOCTYPE html><html><head><title>Pinterest Connected</title></head><body>
            <script>
                if (window.opener) { window.opener.postMessage({ type: 'oauth-success', platform: 'pinterest' }, '*'); window.close(); }
                else { window.location.href = '${successUrl}'; }
            </script><p>Pinterest connected! Redirecting...</p></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
        )
    } catch (err) {
        console.error('Pinterest OAuth callback error:', err)
        return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=oauth_failed`, 'pinterest', false)
    }
}
