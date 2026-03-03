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


// GET /api/oauth/threads/callback — Threads OAuth Callback
// Exchanges code for access token and stores Threads account info
export async function GET(req: NextRequest) {
    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) return popupOrRedirect('/dashboard', 'threads', false)
    if (!code || !stateParam) return popupOrRedirect('/dashboard?error=missing_params', 'threads', false)

    let state: { channelId: string; userId: string }
    try { state = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) }
    catch { return popupOrRedirect('/dashboard?error=invalid_state', 'threads', false) }

    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'threads' } })
    if (!integration) {
        return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=not_configured`, 'threads', false)
    }

    const config = (integration.config || {}) as Record<string, string>
    const clientId = config.threadsClientId
    const clientSecret = integration.apiKeyEncrypted ? (() => { try { return decrypt(integration.apiKeyEncrypted!) } catch { return integration.apiKeyEncrypted! } })() : ''

    if (!clientId || !clientSecret) {
        return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=not_configured`, 'threads', false)
    }

    const redirectUri = `${host}/api/oauth/threads/callback`

    try {
        // Step 1: Exchange short-lived code for short-lived token
        const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
        })

        if (!tokenRes.ok) {
            console.error('[Threads OAuth] Short-lived token exchange failed:', await tokenRes.text())
            return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=token_failed`, 'threads', false)
        }

        const shortToken = await tokenRes.json()
        const shortAccessToken = shortToken.access_token
        const userId = shortToken.user_id

        // Step 2: Exchange for long-lived token (valid 60 days)
        const longTokenRes = await fetch(
            `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${clientSecret}&access_token=${shortAccessToken}`
        )
        const longToken = await longTokenRes.json()
        const accessToken = longToken.access_token || shortAccessToken

        // Step 3: Get user profile via /me (resolves correct Threads user ID from token)
        const profileRes = await fetch(
            `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url,threads_biography&access_token=${accessToken}`
        )
        const profile = await profileRes.json()
        if (!profileRes.ok || profile.error) {
            console.error('[Threads OAuth] Profile fetch failed:', JSON.stringify(profile))
        }

        const accountId = profile.id || String(userId)
        // Use username first, then name, then bare numeric ID (no prefix)
        const accountName = profile.username || profile.name || String(userId)

        // Step 4: Upsert into channelPlatform
        await prisma.channelPlatform.upsert({
            where: {
                channelId_platform_accountId: {
                    channelId: state.channelId,
                    platform: 'threads',
                    accountId,
                },
            },
            update: {
                accountName,
                avatarUrl: profile.threads_profile_picture_url || undefined,
                accessToken,
                connectedBy: state.userId || null,
                isActive: true,
                config: {
                    source: 'oauth',
                    biography: profile.threads_biography || null,
                },
            } as any,
            create: {
                channelId: state.channelId,
                platform: 'threads',
                accountId,
                accountName,
                avatarUrl: profile.threads_profile_picture_url || undefined,
                accessToken,
                connectedBy: state.userId || null,
                isActive: true,
                config: {
                    source: 'oauth',
                    biography: profile.threads_biography || null,
                },
            } as any,
        })

        console.log(`[Threads OAuth] ✅ Connected: @${accountName} (${accountId})`)

        return new NextResponse(
            `<!DOCTYPE html><html><head><title>Threads Connected</title></head><body>
            <script>
                if (window.opener) { window.opener.postMessage({ type: 'oauth-success', platform: 'threads' }, '*'); window.close(); }
                else { window.location.href = '/dashboard/channels/${state.channelId}?tab=platforms&oauth=threads'; }
            </script><p>Threads connected! Redirecting...</p></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
        )
    } catch (err) {
        console.error('[Threads OAuth] Callback error:', err)
        return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=oauth_failed`, 'threads', false)
    }
}
