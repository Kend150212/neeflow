import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { getBrandingServer } from '@/lib/use-branding-server'
import { getPinterestApiBase } from '@/lib/pinterest'

// ─── Check if Sandbox mode is enabled ────────────────────────────────────────
async function isPinterestSandbox(): Promise<boolean> {
    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'pinterest' } })
    const config = (integration?.config || {}) as Record<string, string>
    return config.pinterestSandbox === 'true'
}

// ─── Token refresh helper ─────────────────────────────────────────────────────
// NOTE: This always returns a PRODUCTION token (Pinterest OAuth is always production).
// Do NOT use this refresh in Sandbox mode — sandbox tokens cannot be refreshed via OAuth.
async function refreshPinterestToken(platformId: string, refreshToken: string): Promise<string | null> {
    const integration = await prisma.apiIntegration.findFirst({ where: { provider: 'pinterest' } })
    const config = (integration?.config || {}) as Record<string, string>
    const clientId = config.pinterestClientId || process.env.PINTEREST_CLIENT_ID
    let clientSecret = process.env.PINTEREST_CLIENT_SECRET || ''
    if (integration?.apiKeyEncrypted) {
        try { clientSecret = decrypt(integration.apiKeyEncrypted) } catch { clientSecret = integration.apiKeyEncrypted }
    }
    if (!clientId || !clientSecret) return null

    // Pinterest OAuth token endpoint always uses production URL
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    })

    if (!res.ok) {
        console.error('[Pinterest] Refresh token failed:', await res.text())
        return null
    }

    const tokens = await res.json()
    const newAccessToken = tokens.access_token
    const newRefreshToken = tokens.refresh_token
    const expiresIn = tokens.expires_in

    if (!newAccessToken) return null

    // Save new tokens to DB
    await prisma.channelPlatform.update({
        where: { id: platformId },
        data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken || refreshToken,
            tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        },
    })

    console.log('[Pinterest] Token refreshed successfully')
    return newAccessToken
}

// ─── GET /api/admin/channels/[id]/pinterest-boards?accountId=xxx ──────────────
// Fetches the user's Pinterest boards for the board selector in compose
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params
    const accountId = req.nextUrl.searchParams.get('accountId')

    if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

    // Find the Pinterest platform connection for this channel
    const platform = await prisma.channelPlatform.findFirst({
        where: { channelId, platform: 'pinterest', accountId, isActive: true },
    })

    if (!platform?.accessToken) {
        return NextResponse.json({ error: 'Pinterest not connected or token missing' }, { status: 404 })
    }

    const sandbox = await isPinterestSandbox()
    let accessToken = platform.accessToken

    // Sandbox tokens expire in ~1 hour and CANNOT be refreshed via OAuth.
    // If token is expired in sandbox mode → immediately ask user to reconnect (generate new sandbox token).
    if (sandbox) {
        if (platform.tokenExpiresAt && platform.tokenExpiresAt.getTime() < Date.now()) {
            console.log('[Pinterest Boards] Sandbox token expired — manual reconnect required')
            return NextResponse.json({
                error: 'Pinterest Sandbox token expired. Please generate a new Sandbox token in Developer portal.',
                needsReconnect: true,
            }, { status: 401 })
        }
    } else {
        // Production mode: proactively refresh if near expiry
        if (platform.tokenExpiresAt && platform.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
            if (platform.refreshToken) {
                const refreshed = await refreshPinterestToken(platform.id, platform.refreshToken)
                if (refreshed) accessToken = refreshed
            }
        }
    }

    try {
        const pinterestBase = await getPinterestApiBase()
        console.log(`[Pinterest Boards] Using base: ${pinterestBase}, token starts: ${accessToken?.slice(0, 20)}...`)
        const res = await fetch(`${pinterestBase}/v5/boards?page_size=50`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        // If 401 in sandbox mode → token invalid/expired, must reconnect manually
        if (res.status === 401) {
            if (sandbox) {
                const errBody = await res.text()
                console.log('[Pinterest Boards] Sandbox token rejected — needs new sandbox token. Pinterest response:', errBody)
                return NextResponse.json({
                    error: 'Pinterest Sandbox token rejected. Please generate a new Sandbox token.',
                    needsReconnect: true,
                }, { status: 401 })
            }
            // Production: try to refresh token once
            if (platform.refreshToken) {
                console.log('[Pinterest Boards] Access token expired, attempting refresh...')
                const refreshed = await refreshPinterestToken(platform.id, platform.refreshToken)
                if (!refreshed) {
                    return NextResponse.json({
                        error: 'Pinterest session expired. Please reconnect your Pinterest account.',
                        needsReconnect: true,
                    }, { status: 401 })
                }
                accessToken = refreshed

                // Retry with new token
                const retryRes = await fetch(`${pinterestBase}/v5/boards?page_size=50`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                })
                if (!retryRes.ok) {
                    return NextResponse.json({ error: 'Pinterest authentication failed after refresh. Please reconnect.', needsReconnect: true }, { status: 401 })
                }
                const retryData = await retryRes.json()
                return NextResponse.json({ boards: (retryData.items || []).map((b: { id: string; name: string; description?: string; privacy?: string }) => ({ id: b.id, name: b.name, description: b.description || '', privacy: b.privacy || 'PUBLIC' })) })
            }
            return NextResponse.json({ error: 'Pinterest session expired. Please reconnect.', needsReconnect: true }, { status: 401 })
        }

        if (!res.ok) {
            const errText = await res.text()
            console.error('[Pinterest Boards] API error:', errText)
            return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 502 })
        }

        const data = await res.json()
        let boards = (data.items || []).map((b: { id: string; name: string; description?: string; privacy?: string }) => ({
            id: b.id,
            name: b.name,
            description: b.description || '',
            privacy: b.privacy || 'PUBLIC',
        }))

        // Auto-create a default board if none exist (e.g. in sandbox mode)
        if (boards.length === 0) {
            console.log('[Pinterest Boards] No boards found, auto-creating default board...')
            const appName = (await getBrandingServer()).appName
            const createRes = await fetch(`${pinterestBase}/v5/boards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    name: appName,
                    description: `Auto-created board for ${appName} publishing`,
                    privacy: 'PUBLIC',
                }),
            })
            if (createRes.ok) {
                const newBoard = await createRes.json()
                console.log('[Pinterest Boards] Created default board:', newBoard.id, newBoard.name)
                boards = [{ id: newBoard.id, name: newBoard.name || appName, description: newBoard.description || '', privacy: newBoard.privacy || 'PUBLIC' }]
            } else {
                const errText = await createRes.text()
                console.error('[Pinterest Boards] Failed to create default board:', errText)
            }
        }

        return NextResponse.json({ boards })
    } catch (err) {
        console.error('[Pinterest Boards] Error:', err)
        return NextResponse.json({ error: 'Failed to fetch Pinterest boards' }, { status: 500 })
    }
}

// ─── POST /api/admin/channels/[id]/pinterest-boards ──────────────────────────
// Create a new Pinterest board
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params
    const { accountId, name, description = '', privacy = 'PUBLIC' } = await req.json()

    if (!accountId || !name?.trim()) {
        return NextResponse.json({ error: 'accountId and board name are required' }, { status: 400 })
    }

    const platform = await prisma.channelPlatform.findFirst({
        where: { channelId, platform: 'pinterest', accountId, isActive: true },
    })

    if (!platform?.accessToken) {
        return NextResponse.json({ error: 'Pinterest not connected' }, { status: 404 })
    }

    const sandbox = await isPinterestSandbox()
    let accessToken = platform.accessToken

    // Sandbox: token expired → needsReconnect immediately (no refresh possible)
    if (sandbox) {
        if (platform.tokenExpiresAt && platform.tokenExpiresAt.getTime() < Date.now()) {
            return NextResponse.json({
                error: 'Pinterest Sandbox token expired. Please generate a new Sandbox token.',
                needsReconnect: true,
            }, { status: 401 })
        }
    } else {
        // Production: proactive token refresh if near expiry
        if (platform.tokenExpiresAt && platform.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
            if (platform.refreshToken) {
                const refreshed = await refreshPinterestToken(platform.id, platform.refreshToken)
                if (refreshed) accessToken = refreshed
            }
        }
    }

    try {
        const pinterestBase = await getPinterestApiBase()
        const res = await fetch(`${pinterestBase}/v5/boards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ name: name.trim(), description, privacy }),
        })

        // If 401 in sandbox → no refresh, must reconnect
        if (res.status === 401) {
            if (sandbox) {
                console.log('[Pinterest Boards] Sandbox token rejected on create — needs new sandbox token')
                return NextResponse.json({ error: 'Pinterest Sandbox token expired. Please generate a new token.', needsReconnect: true }, { status: 401 })
            }
            // Production: try refresh once
            if (platform.refreshToken) {
                const refreshed = await refreshPinterestToken(platform.id, platform.refreshToken)
                if (!refreshed) {
                    return NextResponse.json({ error: 'Pinterest session expired. Please reconnect.', needsReconnect: true }, { status: 401 })
                }
                accessToken = refreshed
                const retry = await fetch(`${pinterestBase}/v5/boards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({ name: name.trim(), description, privacy }),
                })
                const retryData = await retry.json()
                if (!retry.ok) {
                    if (retry.status === 401 || retryData?.code === 2) {
                        return NextResponse.json({ error: 'Pinterest session expired. Please reconnect your account.', needsReconnect: true }, { status: 401 })
                    }
                    return NextResponse.json({ error: retryData.message || 'Failed to create board' }, { status: 502 })
                }
                return NextResponse.json({ board: { id: retryData.id, name: retryData.name, description: retryData.description || '', privacy: retryData.privacy || 'PUBLIC' } })
            }
            return NextResponse.json({ error: 'Pinterest session expired. Please reconnect.', needsReconnect: true }, { status: 401 })
        }

        const data = await res.json()
        if (!res.ok) {
            console.error('[Pinterest Boards] Create failed:', JSON.stringify(data))
            if (data?.code === 2 || res.status === 401) {
                return NextResponse.json({ error: 'Pinterest session expired. Please reconnect your account.', needsReconnect: true }, { status: 401 })
            }
            return NextResponse.json({ error: data.message || 'Failed to create board' }, { status: 502 })
        }

        console.log('[Pinterest Boards] Created board:', data.id, data.name)
        return NextResponse.json({
            board: { id: data.id, name: data.name, description: data.description || '', privacy: data.privacy || 'PUBLIC' }
        })
    } catch (err) {
        console.error('[Pinterest Boards] Create error:', err)
        return NextResponse.json({ error: 'Failed to create board' }, { status: 500 })
    }
}
