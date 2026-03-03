import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/oauth/bluesky — Connect a Bluesky account using handle + app password
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { handle, appPassword, channelId } = await req.json()

    if (!handle || !appPassword || !channelId) {
        return NextResponse.json({ error: 'handle, appPassword, and channelId are required' }, { status: 400 })
    }

    // Normalize handle: strip leading @ if present
    const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle

    try {
        // Create a Bluesky session via AT Protocol
        const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: normalizedHandle,
                password: appPassword,
            }),
        })

        if (!sessionRes.ok) {
            const err = await sessionRes.json().catch(() => ({ message: 'Unknown error' }))
            const msg = err.message || err.error || 'Failed to authenticate with Bluesky'
            return NextResponse.json({ error: msg }, { status: 400 })
        }

        const sessionData = await sessionRes.json()
        const { accessJwt, refreshJwt, did, handle: resolvedHandle, displayName } = sessionData

        // Fetch profile to get avatar URL
        let avatarUrl: string | undefined
        try {
            const profileRes = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`, {
                headers: { 'Accept': 'application/json' },
            })
            if (profileRes.ok) {
                const profileData = await profileRes.json()
                avatarUrl = profileData.avatar || undefined
            }
        } catch { /* ignore avatar fetch failure */ }

        // Upsert the channel platform
        await prisma.channelPlatform.upsert({
            where: {
                channelId_platform_accountId: {
                    channelId,
                    platform: 'bluesky',
                    accountId: did,
                },
            },
            update: {
                accountName: displayName || resolvedHandle || normalizedHandle,
                avatarUrl: avatarUrl || undefined,
                accessToken: accessJwt,
                refreshToken: refreshJwt,
                // Bluesky JWTs expire in ~2 hours; set a 90-minute expiry and rely on cron refresh
                tokenExpiresAt: new Date(Date.now() + 90 * 60 * 1000),
                connectedBy: session.user.id,
                isActive: true,
            } as any,
            create: {
                channelId,
                platform: 'bluesky',
                accountId: did,
                accountName: displayName || resolvedHandle || normalizedHandle,
                avatarUrl: avatarUrl || undefined,
                accessToken: accessJwt,
                refreshToken: refreshJwt,
                tokenExpiresAt: new Date(Date.now() + 90 * 60 * 1000),
                connectedBy: session.user.id,
                isActive: true,
                config: { handle: normalizedHandle },
            } as any,
        })

        return NextResponse.json({
            success: true,
            platform: 'bluesky',
            accountId: did,
            accountName: displayName || resolvedHandle || normalizedHandle,
            handle: resolvedHandle || normalizedHandle,
        })
    } catch (err) {
        console.error('[Bluesky] Connection error:', err)
        return NextResponse.json({ error: 'Failed to connect Bluesky account' }, { status: 500 })
    }
}
