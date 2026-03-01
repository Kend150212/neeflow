import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/admin/channels/[id]/pinterest-sandbox-token
 * Body: { accountId, sandboxToken }
 *
 * Saves a freshly generated Pinterest Sandbox access token into the channel's
 * channelPlatform record so the app can use it immediately without going
 * through the OAuth flow (which sandbox does not support standard OAuth).
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: channelId } = await params
    const { accountId, sandboxToken } = await req.json()

    if (!accountId || !sandboxToken?.trim()) {
        return NextResponse.json({ error: 'accountId and sandboxToken are required' }, { status: 400 })
    }

    const platform = await prisma.channelPlatform.findFirst({
        where: { channelId, platform: 'pinterest', accountId, isActive: true },
    })

    if (!platform) {
        return NextResponse.json({ error: 'Pinterest not connected for this channel' }, { status: 404 })
    }

    // Sandbox tokens from Pinterest Developer Portal typically expire in ~1 hour
    // Set expiry to 55 minutes from now to trigger refresh warnings before expiry
    const expiresAt = new Date(Date.now() + 55 * 60 * 1000)

    await prisma.channelPlatform.update({
        where: { id: platform.id },
        data: {
            accessToken: sandboxToken.trim(),
            tokenExpiresAt: expiresAt,
        },
    })

    console.log(`[Pinterest] Sandbox token updated for channel ${channelId}, account ${accountId}`)
    return NextResponse.json({ success: true, expiresAt })
}
