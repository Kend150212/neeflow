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


// GET /api/oauth/instagram/callback
// Instagram Business accounts are linked to Facebook Pages
// Flow: User token → me/accounts → check each page for instagram_business_account → get IG details
export async function GET(req: NextRequest) {
    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) return popupOrRedirect('/dashboard', 'instagram', false)
    if (!code || !stateParam) return popupOrRedirect('/dashboard?error=missing_params', 'instagram', false)

    let state: { channelId: string; userId: string }
    try { state = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) }
    catch { return popupOrRedirect('/dashboard?error=invalid_state', 'instagram', false) }

    // Get client credentials — try instagram integration first, then fallback to facebook
    let clientId = ''
    let clientSecret = ''

    const igIntegration = await prisma.apiIntegration.findFirst({ where: { provider: 'instagram' } })
    if (igIntegration) {
        const igConfig = (igIntegration.config || {}) as Record<string, string>
        clientId = igConfig.instagramClientId || ''
        if (igIntegration.apiKeyEncrypted) {
            try { clientSecret = decrypt(igIntegration.apiKeyEncrypted) } catch { clientSecret = igIntegration.apiKeyEncrypted }
        }
    }

    // Fallback to Facebook App credentials (Instagram uses the same app)
    if (!clientId || !clientSecret) {
        const fbIntegration = await prisma.apiIntegration.findFirst({ where: { provider: 'facebook' } })
        const fbConfig = (fbIntegration?.config || {}) as Record<string, string>
        if (!clientId) clientId = fbConfig.facebookClientId || process.env.FACEBOOK_CLIENT_ID || ''
        if (!clientSecret && fbIntegration?.apiKeyEncrypted) {
            try { clientSecret = decrypt(fbIntegration.apiKeyEncrypted) } catch { clientSecret = fbIntegration.apiKeyEncrypted }
        }
        if (!clientSecret) clientSecret = process.env.FACEBOOK_CLIENT_SECRET || ''
    }

    if (!clientId || !clientSecret) {
        return popupOrRedirect('/dashboard?error=not_configured', 'instagram', false)
    }

    const redirectUri = `${host}/api/oauth/instagram/callback`

    try {
        // Step 1: Exchange code for user access token
        const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
        tokenUrl.searchParams.set('client_id', clientId)
        tokenUrl.searchParams.set('client_secret', clientSecret)
        tokenUrl.searchParams.set('code', code)
        tokenUrl.searchParams.set('redirect_uri', redirectUri)

        const tokenRes = await fetch(tokenUrl.toString())
        if (!tokenRes.ok) {
            console.error('[Instagram OAuth] Token exchange failed:', await tokenRes.text())
            return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=token_failed`, 'instagram', false)
        }
        const tokens = await tokenRes.json()
        const userAccessToken = tokens.access_token

        // Step 2: Get ALL Facebook pages with pagination (each page may have an IG account)
        let pages: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }> = []
        let pagesUrl: string | null = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${userAccessToken}`

        while (pagesUrl) {
            const pagesRes: Response = await fetch(pagesUrl)
            const pagesData: {
                data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>;
                paging?: { next?: string };
                error?: { message: string }
            } = await pagesRes.json()

            if (pagesData.error) {
                console.error('[Instagram OAuth] API error:', pagesData.error.message)
                break
            }
            if (pagesData.data) {
                // Debug: log each page's raw data
                for (const p of pagesData.data) {
                    console.log(`[Instagram OAuth] 📄 Page: "${p.name}" (${p.id}) | IG linked: ${p.instagram_business_account ? `YES → ${p.instagram_business_account.id}` : 'NO'}`)
                }
                pages = pages.concat(pagesData.data)
            }
            pagesUrl = pagesData.paging?.next || null
        }
        console.log(`[Instagram OAuth] Found ${pages.length} Facebook pages from me/accounts`)

        // FALLBACK: Fetch pages from Business Portfolios (may not appear in me/accounts)
        const seenPageIds = new Set(pages.map(p => p.id))
        try {
            const bizRes: Response = await fetch(
                `https://graph.facebook.com/v19.0/me/businesses?fields=id,name&access_token=${userAccessToken}`
            )
            const bizData: { data?: Array<{ id: string; name: string }>; error?: { message: string } } = await bizRes.json()

            if (bizData.data && bizData.data.length > 0) {
                console.log(`[Instagram OAuth] 🏢 Found ${bizData.data.length} Business Portfolio(s)`)

                for (const biz of bizData.data) {
                    try {
                        let bizPagesUrl: string | null = `https://graph.facebook.com/v19.0/${biz.id}/owned_pages?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${userAccessToken}`

                        while (bizPagesUrl) {
                            const bizPagesRes: Response = await fetch(bizPagesUrl)
                            const bizPagesData: {
                                data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>;
                                paging?: { next?: string };
                                error?: { message: string }
                            } = await bizPagesRes.json()

                            if (bizPagesData.error) {
                                console.log(`[Instagram OAuth] ⚠️ Cannot access ${biz.name} owned_pages: ${bizPagesData.error.message}`)
                                break
                            }

                            if (bizPagesData.data) {
                                for (const bp of bizPagesData.data) {
                                    if (!seenPageIds.has(bp.id)) {
                                        pages.push(bp)
                                        seenPageIds.add(bp.id)
                                        console.log(`[Instagram OAuth] 🏢 Added from ${biz.name}: "${bp.name}" (${bp.id}) | IG linked: ${bp.instagram_business_account ? `YES → ${bp.instagram_business_account.id}` : 'NO'}`)
                                    }
                                }
                            }
                            bizPagesUrl = bizPagesData.paging?.next || null
                        }
                    } catch (bizPageErr) {
                        console.error(`[Instagram OAuth] ❌ Error fetching pages from ${biz.name}:`, bizPageErr)
                    }
                }
            } else if (bizData.error) {
                console.log(`[Instagram OAuth] ⚠️ Cannot access me/businesses: ${bizData.error.message}`)
            }
        } catch (bizErr) {
            console.error(`[Instagram OAuth] ❌ Business Portfolio lookup failed:`, bizErr)
        }

        console.log(`[Instagram OAuth] Total pages (me/accounts + Business Portfolios): ${pages.length}, checking for Instagram accounts...`)

        // Step 3: For each page with an Instagram Business account, get IG details
        let imported = 0
        const errors: string[] = []

        for (const page of pages) {
            const igAccount = page.instagram_business_account
            if (!igAccount) {
                console.log(`[Instagram OAuth]   ⏭️ ${page.name} (${page.id}) — no Instagram account linked. Ensure IG is Business/Creator AND linked via FB Page → Settings → Instagram.`)
                continue
            }

            try {
                // Get Instagram account details
                const igRes = await fetch(
                    `https://graph.facebook.com/v19.0/${igAccount.id}?fields=id,username,name,profile_picture_url,followers_count&access_token=${page.access_token}`
                )
                const igData: { id?: string; username?: string; name?: string; profile_picture_url?: string; followers_count?: number; error?: { message: string } } = await igRes.json()

                if (igData.error) {
                    console.error(`[Instagram OAuth]   ❌ Error fetching IG for ${page.name}:`, igData.error.message)
                    errors.push(`${page.name}: ${igData.error.message}`)
                    continue
                }

                const accountName = igData.username || igData.name || page.name
                const avatarUrl = igData.profile_picture_url || undefined

                await prisma.channelPlatform.upsert({
                    where: {
                        channelId_platform_accountId: {
                            channelId: state.channelId,
                            platform: 'instagram',
                            accountId: igData.id || igAccount.id,
                        },
                    },
                    update: {
                        accountName,
                        avatarUrl,
                        accessToken: page.access_token,
                        connectedBy: state.userId || null,
                        isActive: true,
                        config: { source: 'oauth', pageId: page.id, pageName: page.name },
                    } as any,
                    create: {
                        channelId: state.channelId,
                        platform: 'instagram',
                        accountId: igData.id || igAccount.id,
                        accountName,
                        avatarUrl,
                        accessToken: page.access_token,
                        connectedBy: state.userId || null,
                        isActive: true,
                        config: { source: 'oauth', pageId: page.id, pageName: page.name },
                    } as any,
                })
                imported++
                console.log(`[Instagram OAuth]   ✅ Imported: @${accountName} (${igData.id}) linked to page ${page.name}`)
            } catch (upsertErr) {
                console.error(`[Instagram OAuth]   ❌ Failed to import IG for ${page.name}:`, upsertErr)
                errors.push(`${page.name}: ${upsertErr}`)
            }
        }

        console.log(`[Instagram OAuth] Imported ${imported}/${pages.length} Instagram accounts. Errors: ${errors.length}`)

        // ── Subscribe backing Facebook pages to webhooks ──
        for (const page of pages) {
            if (!page.instagram_business_account) continue
            try {
                const allFields = 'feed,messages,messaging_postbacks,message_deliveries,message_reads,message_echoes'
                const feedOnly = 'feed'

                let subRes = await fetch(
                    `https://graph.facebook.com/v19.0/${page.id}/subscribed_apps`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            subscribed_fields: allFields,
                            access_token: page.access_token,
                        }),
                    }
                )
                let subData = await subRes.json()

                if (!subData.success && JSON.stringify(subData).includes('pages_messaging')) {
                    subRes = await fetch(
                        `https://graph.facebook.com/v19.0/${page.id}/subscribed_apps`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                subscribed_fields: feedOnly,
                                access_token: page.access_token,
                            }),
                        }
                    )
                    subData = await subRes.json()
                }

                if (subData.success) {
                    console.log(`[Instagram OAuth] 🔔 Webhook subscribed for backing page: ${page.name}`)
                } else {
                    console.warn(`[Instagram OAuth] ⚠️ Webhook subscription failed for ${page.name}:`, JSON.stringify(subData))
                }
            } catch (subErr) {
                console.error(`[Instagram OAuth] ❌ Webhook subscription error for ${page.name}:`, subErr)
            }
        }

        if (imported === 0) {
            console.log('[Instagram OAuth] No Instagram Business accounts found on any page')
            const errorUrl = `/dashboard/channels/${state.channelId}?tab=platforms&error=no_ig_accounts`
            return new NextResponse(
                `<!DOCTYPE html><html><head><title>No Instagram Accounts</title></head><body>
                <script>
                    if (window.opener) { window.opener.postMessage({ type: 'oauth-error', platform: 'instagram', error: 'no_ig_accounts' }, '*'); window.close(); }
                    else { window.location.href = '${errorUrl}'; }
                </script><p>No Instagram Business accounts found. Make sure your Instagram is connected to a Facebook Page as a Business or Creator account.</p></body></html>`,
                { headers: { 'Content-Type': 'text/html' } }
            )
        }

        const successUrl = `/dashboard/channels/${state.channelId}?tab=platforms&oauth=instagram&imported=${imported}`
        return new NextResponse(
            `<!DOCTYPE html><html><head><title>Instagram Connected</title></head><body>
            <script>
                if (window.opener) { window.opener.postMessage({ type: 'oauth-success', platform: 'instagram' }, '*'); window.close(); }
                else { window.location.href = '${successUrl}'; }
            </script><p>Instagram connected! ${imported} accounts imported. Redirecting...</p></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
        )
    } catch (err) {
        console.error('[Instagram OAuth] Callback error:', err)
        return popupOrRedirect(`/dashboard/channels/${state.channelId}?tab=platforms&error=oauth_failed`, 'instagram', false)
    }
}
