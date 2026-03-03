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


// GET /api/oauth/gbp/callback — Handle Google Business Profile OAuth callback
export async function GET(req: NextRequest) {
    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) {
        console.error('[GBP OAuth] User denied access or error:', error)
        return popupOrRedirect('/dashboard?error=gbp_denied', 'gbp', false)
    }

    if (!code || !stateParam) {
        return popupOrRedirect('/dashboard?error=missing_params', 'gbp', false)
    }

    let state: { channelId: string; userId: string }
    try {
        state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    } catch {
        return popupOrRedirect('/dashboard?error=invalid_state', 'gbp', false)
    }

    // Read credentials — check DB integration first, fall back to env vars
    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'gbp' } })
    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.gbpClientId || process.env.GOOGLE_CLIENT_ID || ''
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
    if (integration?.apiKeyEncrypted) {
        try { clientSecret = decrypt(integration.apiKeyEncrypted) } catch { clientSecret = integration.apiKeyEncrypted }
    }

    if (!clientId || !clientSecret) {
        return popupOrRedirect(`${host}/dashboard/channels/${state.channelId}?tab=platforms&error=gbp_not_configured`, 'gbp', false)
    }

    const redirectUri = `${host}/api/oauth/gbp/callback`

    try {
        // Step 1: Exchange code for tokens
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
            console.error('[GBP OAuth] Token exchange failed:', await tokenRes.text())
            return popupOrRedirect(`${host}/dashboard/channels/${state.channelId}?tab=platforms&error=token_failed`, 'gbp', false)
        }

        const tokens = await tokenRes.json()
        const accessToken = tokens.access_token
        const refreshToken = tokens.refresh_token
        const expiresIn = tokens.expires_in

        // Step 2: Fetch user info (name, email)
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const userInfo = userRes.ok ? await userRes.json() : {}
        const googleAccountName = userInfo.name || userInfo.email || 'Google Account'
        const googleAccountId = userInfo.id || 'unknown'
        const googleAvatarUrl: string | undefined = userInfo.picture || undefined

        // Step 3: Get Google Business Accounts
        const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        let imported = 0

        if (accountsRes.ok) {
            const accountsData = await accountsRes.json()
            const accounts = accountsData.accounts || []

            for (const account of accounts) {
                const accountId = account.name  // e.g. "accounts/12345678"
                const accountDisplayName = account.accountName || account.name

                // Step 4: Get locations for each account
                const locationsRes = await fetch(
                    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title,storefrontAddress`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                )

                if (locationsRes.ok) {
                    const locData = await locationsRes.json()
                    const locations = locData.locations || []

                    for (const loc of locations) {
                        const locationId = loc.name  // e.g. "locations/987654321"
                        const locationName = loc.title || locationId

                        await prisma.channelPlatform.upsert({
                            where: {
                                channelId_platform_accountId: {
                                    channelId: state.channelId,
                                    platform: 'gbp',
                                    accountId: locationId,
                                },
                            },
                            update: {
                                accountName: locationName,
                                avatarUrl: googleAvatarUrl,
                                accessToken,
                                refreshToken: refreshToken || undefined,
                                tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                                connectedBy: state.userId || null,
                                isActive: true,
                                config: { accountId, googleAccountId, googleAccountName: accountDisplayName },
                            },
                            create: {
                                channelId: state.channelId,
                                platform: 'gbp',
                                accountId: locationId,
                                accountName: locationName,
                                avatarUrl: googleAvatarUrl,
                                accessToken,
                                refreshToken: refreshToken || undefined,
                                tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                                connectedBy: state.userId || null,
                                isActive: true,
                                config: { accountId, googleAccountId, googleAccountName: accountDisplayName },
                            },
                        })
                        imported++
                    }
                } else {
                    console.warn('[GBP OAuth] Failed to fetch locations for', accountId)
                }
            }

            // Fallback: no locations found — store the Google account itself
            if (imported === 0) {
                await prisma.channelPlatform.upsert({
                    where: {
                        channelId_platform_accountId: {
                            channelId: state.channelId,
                            platform: 'gbp',
                            accountId: googleAccountId,
                        },
                    },
                    update: {
                        accountName: googleAccountName,
                        avatarUrl: googleAvatarUrl,
                        accessToken,
                        refreshToken: refreshToken || undefined,
                        tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                        connectedBy: state.userId || null,
                        isActive: true,
                    } as any,
                    create: {
                        channelId: state.channelId,
                        platform: 'gbp',
                        accountId: googleAccountId,
                        accountName: googleAccountName,
                        avatarUrl: googleAvatarUrl,
                        accessToken,
                        refreshToken: refreshToken || undefined,
                        tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                        connectedBy: state.userId || null,
                        isActive: true,
                        config: { noLocationsFound: true },
                    } as any,
                })
                imported = 1
                console.warn('[GBP OAuth] No business locations found — stored Google account as fallback')
            }
        } else {
            console.error('[GBP OAuth] Failed to fetch Business accounts:', await accountsRes.text())
            // Fallback: store google account
            await prisma.channelPlatform.upsert({
                where: {
                    channelId_platform_accountId: {
                        channelId: state.channelId,
                        platform: 'gbp',
                        accountId: googleAccountId,
                    },
                },
                update: {
                    accountName: googleAccountName,
                    avatarUrl: googleAvatarUrl,
                    accessToken,
                    refreshToken: refreshToken || undefined,
                    tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                    connectedBy: state.userId || null,
                    isActive: true,
                } as any,
                create: {
                    channelId: state.channelId,
                    platform: 'gbp',
                    accountId: googleAccountId,
                    accountName: googleAccountName,
                    avatarUrl: googleAvatarUrl,
                    accessToken,
                    refreshToken: refreshToken || undefined,
                    tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                    connectedBy: state.userId || null,
                    isActive: true,
                    config: { noLocationsFound: true },
                } as any,
            })
            imported = 1
        }

        console.log(`[GBP OAuth] ✅ Connected ${imported} location(s) for channel ${state.channelId}`)

        const successUrl = `/dashboard/channels/${state.channelId}?tab=platforms&oauth=gbp&imported=${imported}`
        return new NextResponse(
            `<!DOCTYPE html>
            <html><head><title>Google Business Connected</title></head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'oauth-success', platform: 'gbp' }, '*');
                        window.close();
                    } else {
                        window.location.href = '${successUrl}';
                    }
                </script>
                <p>Google Business Profile connected! Redirecting...</p>
            </body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
        )
    } catch (err) {
        console.error('[GBP OAuth] callback error:', err)
        return popupOrRedirect(`${host}/dashboard/channels/${state.channelId}?tab=platforms&error=oauth_failed`, 'gbp', false)
    }
}
