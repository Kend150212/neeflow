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


// GET /api/oauth/tiktok/callback — Handle TikTok OAuth callback with PKCE
export async function GET(req: NextRequest) {
    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) {
        return popupOrRedirect('/dashboard', 'tiktok', false)
    }

    if (!code || !stateParam) {
        return popupOrRedirect('/dashboard?error=missing_params', 'tiktok', false)
    }

    // Decode state (includes codeVerifier for PKCE)
    let state: { channelId: string; userId: string; codeVerifier: string }
    try {
        state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    } catch {
        return popupOrRedirect('/dashboard?error=invalid_state', 'tiktok', false)
    }

    // Read credentials from database (API Hub)
    const integration = await prisma.apiIntegration.findFirst({
        where: { provider: 'tiktok' },
    })

    const config = (integration?.config || {}) as Record<string, string>
    const clientKey = config.tiktokClientKey || process.env.TIKTOK_CLIENT_KEY
    let clientSecret = process.env.TIKTOK_CLIENT_SECRET || ''

    // Client secret is stored encrypted as apiKeyEncrypted
    if (integration?.apiKeyEncrypted) {
        try {
            clientSecret = decrypt(integration.apiKeyEncrypted)
        } catch {
            clientSecret = integration.apiKeyEncrypted
        }
    }

    if (!clientKey || !clientSecret) {
        return popupOrRedirect('/dashboard?error=not_configured', 'tiktok', false)
    }

    const redirectUri = `${host}/api/oauth/tiktok/callback`

    try {
        // Exchange code for tokens (with PKCE code_verifier)
        const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_key: clientKey,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code_verifier: state.codeVerifier,
            }),
        })

        if (!tokenRes.ok) {
            const err = await tokenRes.text()
            console.error('TikTok token exchange failed:', err)
            return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=token_failed`, 'tiktok', false)
        }

        const tokens = await tokenRes.json()
        const accessToken = tokens.access_token
        const refreshToken = tokens.refresh_token
        const expiresIn = tokens.expires_in
        const openId = tokens.open_id

        // Fetch TikTok user info
        const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        let displayName = 'TikTok Account'
        let avatarUrl: string | undefined
        if (userRes.ok) {
            const userData = await userRes.json()
            displayName = userData?.data?.user?.display_name || displayName
            avatarUrl = userData?.data?.user?.avatar_url || undefined
        }

        // ── Check if account can post publicly ──────────────────────────────
        // Fetches creator_info to detect personal accounts that can only post
        // to SELF_ONLY — we surface a warning immediately at connect time
        // so users know they need a Business/Creator account.
        let accountWarning = ''
        try {
            const creatorRes = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({}),
            })
            if (creatorRes.ok) {
                const creatorData = await creatorRes.json()
                const privacyOptions: string[] = creatorData?.data?.privacy_level_options || []
                // Only SELF_ONLY available → personal account, cannot post publicly
                if (privacyOptions.length > 0 && privacyOptions.every((p: string) => p === 'SELF_ONLY')) {
                    accountWarning = 'Tài khoản TikTok này là tài khoản cá nhân thông thường — chỉ có thể đăng bài riêng tư. Để đăng công khai, hãy chuyển sang Business hoặc Creator (TikTok App → Cài đặt → Quản lý tài khoản → Chuyển sang Business).'
                }
            }
        } catch {
            // Non-blocking — ignore creator_info errors
        }

        // Upsert the TikTok channel platform entry
        await prisma.channelPlatform.upsert({
            where: {
                channelId_platform_accountId: {
                    channelId: state.channelId,
                    platform: 'tiktok',
                    accountId: openId,
                },
            },
            update: {
                accountName: displayName,
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
                platform: 'tiktok',
                accountId: openId,
                accountName: displayName,
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

        // Build success URL (include warning param for redirect flow)
        const warningParam = accountWarning ? `&tiktok_warning=${encodeURIComponent(accountWarning)}` : ''
        const successUrl = `/dashboard/channels/${state.channelId}?tab=platforms&oauth=tiktok&imported=1${warningParam}`

        // Build safe JS string for warning (escape for inline script)
        const warningJs = accountWarning
            ? `, warning: ${JSON.stringify(accountWarning)}`
            : ''

        // Return HTML that closes popup and notifies parent window
        return new NextResponse(
            `<!DOCTYPE html>
            <html><head><title>TikTok Connected</title></head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'oauth-success', platform: 'tiktok'${warningJs} }, '*');
                        window.close();
                    } else {
                        window.location.href = '${successUrl}';
                    }
                </script>
                <p>TikTok connected! Redirecting...</p>
            </body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
        )
    } catch (err) {
        console.error('TikTok OAuth callback error:', err)
        return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=oauth_failed`, 'tiktok', false)
    }
}
