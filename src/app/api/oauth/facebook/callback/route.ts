import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

// Helper: return HTML that tries postMessage (popup) then fallback redirect
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

// GET /api/oauth/facebook/callback
export async function GET(req: NextRequest) {
    const host = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const error = req.nextUrl.searchParams.get('error')

    if (error) return popupOrRedirect(`${host}/dashboard`, 'facebook', false)
    if (!code || !stateParam) return popupOrRedirect(`${host}/dashboard?error=missing_params`, 'facebook', false)

    let state: { channelId: string; userId: string; easyToken?: string }
    try { state = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) }
    catch { return popupOrRedirect(`${host}/dashboard?error=invalid_state`, 'facebook', false) }

    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'facebook' } })
    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.facebookClientId || process.env.FACEBOOK_CLIENT_ID
    let clientSecret = process.env.FACEBOOK_CLIENT_SECRET || ''
    if (integration?.apiKeyEncrypted) {
        try { clientSecret = decrypt(integration.apiKeyEncrypted) } catch { clientSecret = integration.apiKeyEncrypted }
    }
    if (!clientId || !clientSecret) return popupOrRedirect(`${host}/dashboard?error=not_configured`, 'facebook', false)

    const redirectUri = `${host}/api/oauth/facebook/callback`

    try {
        // Exchange code for user access token
        const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
        tokenUrl.searchParams.set('client_id', clientId)
        tokenUrl.searchParams.set('client_secret', clientSecret)
        tokenUrl.searchParams.set('code', code)
        tokenUrl.searchParams.set('redirect_uri', redirectUri)

        const tokenRes = await fetch(tokenUrl.toString())
        if (!tokenRes.ok) {
            console.error('Facebook token exchange failed:', await tokenRes.text())
            return popupOrRedirect(`${host}/dashboard/channels/${state.channelId}?tab=platforms&error=token_failed`, 'facebook', false)
        }
        const tokens = await tokenRes.json()
        const userAccessToken = tokens.access_token

        // Save user token for debugging (separate from page tokens)
        if (integration) {
            await prisma.apiIntegration.update({
                where: { id: integration.id },
                data: { config: { ...config, facebookUserToken: userAccessToken } },
            })
        }

        // Get ALL user's Facebook pages (with pagination + explicit fields)
        let pages: Array<{ id: string; name: string; access_token: string }> = []
        let pagesUrl: string | null = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture{url}&limit=100&access_token=${userAccessToken}`
        let pageNum = 0
        while (pagesUrl) {
            pageNum++
            const pagesRes: Response = await fetch(pagesUrl)
            const pagesData: { data?: Array<{ id: string; name: string; access_token: string }>; paging?: { next?: string; cursors?: { after?: string } }; error?: { message: string } } = await pagesRes.json()

            console.log(`[Facebook OAuth] Page batch ${pageNum}: ${pagesData.data?.length || 0} pages returned`)
            if (pagesData.error) {
                console.error(`[Facebook OAuth] API error on batch ${pageNum}:`, pagesData.error.message)
                break
            }
            if (pagesData.data) {
                for (const p of pagesData.data) {
                    console.log(`[Facebook OAuth]   - ${p.name} (${p.id})`)
                }
                pages = pages.concat(pagesData.data)
            }
            pagesUrl = pagesData.paging?.next || null
        }
        console.log(`[Facebook OAuth] Total pages from me/accounts: ${pages.length}`)

        // FALLBACK 1: Fetch pages from Business Portfolios (me/businesses → owned_pages)
        // Pages managed in Meta Business Suite may not appear in me/accounts
        const meAccountIds = new Set(pages.map(p => p.id))
        try {
            const bizRes: Response = await fetch(
                `https://graph.facebook.com/v19.0/me/businesses?fields=id,name&access_token=${userAccessToken}`
            )
            const bizData: { data?: Array<{ id: string; name: string }>; error?: { message: string } } = await bizRes.json()

            if (bizData.data && bizData.data.length > 0) {
                console.log(`[Facebook OAuth] 🏢 Found ${bizData.data.length} Business Portfolio(s): ${bizData.data.map(b => `${b.name} (${b.id})`).join(', ')}`)

                for (const biz of bizData.data) {
                    try {
                        let bizPagesUrl: string | null = `https://graph.facebook.com/v19.0/${biz.id}/owned_pages?fields=id,name,access_token,picture{url}&limit=100&access_token=${userAccessToken}`

                        while (bizPagesUrl) {
                            const bizPagesRes: Response = await fetch(bizPagesUrl)
                            const bizPagesData: {
                                data?: Array<{ id: string; name: string; access_token: string }>;
                                paging?: { next?: string };
                                error?: { message: string }
                            } = await bizPagesRes.json()

                            if (bizPagesData.error) {
                                console.log(`[Facebook OAuth] ⚠️ Cannot access ${biz.name} owned_pages: ${bizPagesData.error.message}`)
                                break
                            }

                            if (bizPagesData.data) {
                                for (const bp of bizPagesData.data) {
                                    if (!meAccountIds.has(bp.id)) {
                                        pages.push(bp)
                                        meAccountIds.add(bp.id)
                                        console.log(`[Facebook OAuth] 🏢 Added from ${biz.name}: ${bp.name} (${bp.id})`)
                                    }
                                }
                            }
                            bizPagesUrl = bizPagesData.paging?.next || null
                        }
                    } catch (bizPageErr) {
                        console.error(`[Facebook OAuth] ❌ Error fetching pages from ${biz.name}:`, bizPageErr)
                    }
                }
            } else if (bizData.error) {
                console.log(`[Facebook OAuth] ⚠️ Cannot access me/businesses: ${bizData.error.message}`)
            } else {
                console.log(`[Facebook OAuth] No Business Portfolios found`)
            }
        } catch (bizErr) {
            console.error(`[Facebook OAuth] ❌ Business Portfolio lookup failed:`, bizErr)
        }

        console.log(`[Facebook OAuth] Total pages after Business Portfolio: ${pages.length}`)

        // FALLBACK 2: Try to access existing DB pages directly by ID
        const existingDbPages = await prisma.channelPlatform.findMany({
            where: { channelId: state.channelId, platform: 'facebook' },
            select: { accountId: true, accountName: true },
        })

        for (const dbPage of existingDbPages) {
            if (meAccountIds.has(dbPage.accountId)) continue
            try {
                const directRes: Response = await fetch(
                    `https://graph.facebook.com/v19.0/${dbPage.accountId}?fields=id,name,access_token,picture{url}&access_token=${userAccessToken}`
                )
                const directData: { id?: string; name?: string; access_token?: string; picture?: { data?: { url?: string } }; error?: { message: string } } = await directRes.json()
                if (directData.id && directData.access_token) {
                    pages.push({ id: directData.id, name: directData.name || dbPage.accountName, access_token: directData.access_token, ...(directData.picture ? { picture: directData.picture } : {}) } as any)
                    meAccountIds.add(directData.id)
                    console.log(`[Facebook OAuth] 🔄 Recovered via direct access: ${directData.name} (${directData.id})`)
                } else {
                    console.log(`[Facebook OAuth] ⚠️ Cannot access ${dbPage.accountName} (${dbPage.accountId}): ${directData.error?.message || 'no access_token'}`)
                }
            } catch (err) {
                console.error(`[Facebook OAuth] ❌ Direct access failed for ${dbPage.accountId}:`, err)
            }
        }
        console.log(`[Facebook OAuth] Total pages after all fallbacks: ${pages.length}`)

        let imported = 0
        const errors: string[] = []
        for (const page of pages) {
            try {
                // ── Validate token before saving ──
                // Call a basic FB API endpoint to verify the token actually works
                let tokenValid = false
                try {
                    const checkRes = await fetch(
                        `https://graph.facebook.com/v19.0/${page.id}?fields=id,name&access_token=${page.access_token}`
                    )
                    const checkData = await checkRes.json()
                    tokenValid = !!checkData.id && !checkData.error
                    if (!tokenValid) {
                        console.warn(`[Facebook OAuth] ⚠️ Token validation failed for ${page.name}: ${checkData.error?.message || 'no id returned'}`)
                    }
                } catch {
                    console.warn(`[Facebook OAuth] ⚠️ Token validation network error for ${page.name}`)
                }

                const fbAvatarUrl: string | undefined = (page as any).picture?.data?.url || undefined
                console.log(`[Facebook OAuth] 🖼️ Avatar for ${page.name}: ${fbAvatarUrl || 'none'} (raw picture: ${JSON.stringify((page as any).picture || null)})`)

                await prisma.channelPlatform.upsert({
                    where: {
                        channelId_platform_accountId: {
                            channelId: state.channelId,
                            platform: 'facebook',
                            accountId: page.id,
                        },
                    },
                    update: {
                        accountName: page.name,
                        avatarUrl: fbAvatarUrl,
                        accessToken: page.access_token,
                        connectedBy: state.userId || null,
                        isActive: true,
                        config: { source: 'oauth', needsReconnect: false, tokenValidatedAt: new Date().toISOString() },
                    } as any,
                    create: {
                        channelId: state.channelId,
                        platform: 'facebook',
                        accountId: page.id,
                        accountName: page.name,
                        avatarUrl: fbAvatarUrl,
                        accessToken: page.access_token,
                        connectedBy: state.userId || null,
                        isActive: true,
                        config: { source: 'oauth', needsReconnect: false, tokenValidatedAt: new Date().toISOString() },
                    } as any,
                })

                // Only update other channels' tokens if the new token is verified valid
                if (tokenValid) {
                    const updated = await prisma.channelPlatform.updateMany({
                        where: {
                            platform: 'facebook',
                            accountId: page.id,
                            channelId: { not: state.channelId },
                        },
                        data: {
                            accessToken: page.access_token,
                            ...(fbAvatarUrl ? { avatarUrl: fbAvatarUrl } : {}),
                            config: { source: 'oauth', needsReconnect: false, tokenValidatedAt: new Date().toISOString() },
                        } as any,
                    })
                    if (updated.count > 0) {
                        console.log(`[Facebook OAuth] 🔄 Also updated token for ${updated.count} other channel(s) with page ${page.name}`)
                    }
                } else {
                    console.warn(`[Facebook OAuth] ⚠️ Skipping token update for other channels — new token for ${page.name} failed validation`)
                }

                imported++
                console.log(`[Facebook OAuth] ✅ Imported: ${page.name} (${page.id}) [token ${tokenValid ? 'valid ✅' : 'NOT validated ⚠️'}]`)
            } catch (upsertErr) {
                console.error(`[Facebook OAuth] ❌ Failed to import ${page.name} (${page.id}):`, upsertErr)
                errors.push(`${page.name}: ${upsertErr}`)
            }
        }
        console.log(`[Facebook OAuth] Successfully imported ${imported}/${pages.length} pages. Errors: ${errors.length}`)

        // ── Detect cross-channel token invalidation ──
        // When a Facebook user re-authenticates, their OLD user token is revoked by Facebook.
        // This means page tokens derived from the old user token (in OTHER channels) also become invalid.
        // We detect this by finding other channels that share the same page IDs as the current OAuth batch,
        // then mark any pages in those channels that were NOT in this batch as needsReconnect.
        try {
            const currentPageIds = pages.map(p => p.id)

            // Find other channels that have at least one matching page (= same FB user connected)
            const overlappingOtherChannels = await prisma.channelPlatform.findMany({
                where: {
                    platform: 'facebook',
                    channelId: { not: state.channelId },
                    accountId: { in: currentPageIds }, // overlap = same FB user
                },
                select: { channelId: true },
            })

            if (overlappingOtherChannels.length > 0) {
                const affectedChannelIds = [...new Set(overlappingOtherChannels.map(p => p.channelId))]
                console.log(`[Facebook OAuth] ⚠️ Detected ${affectedChannelIds.length} other channel(s) sharing same FB user — checking for stale page tokens...`)

                // In those channels, pages NOT in the current OAuth batch now have invalidated tokens
                const staleResult = await prisma.channelPlatform.updateMany({
                    where: {
                        platform: 'facebook',
                        channelId: { in: affectedChannelIds },
                        accountId: { notIn: currentPageIds }, // pages NOT refreshed by this OAuth
                    },
                    data: {
                        config: {
                            needsReconnect: true,
                            lastError: 'Token invalidated: same Facebook account re-authenticated on another channel without selecting this page. Please reconnect.',
                            lastErrorAt: new Date().toISOString(),
                        } as any,
                    },
                })

                if (staleResult.count > 0) {
                    console.warn(`[Facebook OAuth] ⚠️ Marked ${staleResult.count} page(s) in other channel(s) as needsReconnect (token invalidated by new OAuth session)`)
                } else {
                    console.log(`[Facebook OAuth] ✅ No stale pages found in other channels — all pages were covered by this OAuth`)
                }
            }
        } catch (crossErr) {
            console.error('[Facebook OAuth] ❌ Error during cross-channel invalidation check:', crossErr)
        }


        // ── Subscribe pages to webhook for real-time events ──
        for (const page of pages) {
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

                // Fallback to feed-only if pages_messaging not granted
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
                    console.log(`[Facebook OAuth] 🔔 Webhook subscribed: ${page.name}`)
                } else {
                    console.warn(`[Facebook OAuth] ⚠️ Webhook subscription failed for ${page.name}:`, JSON.stringify(subData))
                }
            } catch (subErr) {
                console.error(`[Facebook OAuth] ❌ Webhook subscription error for ${page.name}:`, subErr)
            }
        }

        // If no pages were imported, show error — do NOT save personal profile
        if (imported === 0) {
            console.log('[Facebook OAuth] ⚠️ No pages imported. User may not have granted page access during OAuth.')
            const errorUrl = `${host}/dashboard/channels/${state.channelId}?tab=platforms&error=no_pages`
            return new NextResponse(
                `<!DOCTYPE html><html><head><title>No Pages Found</title></head><body>
                <script>
                    if (window.opener) { window.opener.postMessage({ type: 'oauth-error', platform: 'facebook', error: 'no_pages' }, '*'); window.close(); }
                    else { window.location.href = '${errorUrl}'; }
                </script>
                <p>No Facebook Pages found. Please try again and make sure to select your pages when Facebook asks "What pages do you want to use?"</p>
                </body></html>`,
                { headers: { 'Content-Type': 'text/html' } }
            )
        }

        const successUrl = `${host}/dashboard/channels/${state.channelId}?tab=platforms&oauth=facebook&imported=${imported}`
        return popupOrRedirect(successUrl, 'facebook', true)
    } catch (err) {
        console.error('Facebook OAuth callback error:', err)
        return popupOrRedirect(`${host}/dashboard/channels/${state.channelId}?tab=platforms&error=oauth_failed`, 'facebook', false)
    }
}
