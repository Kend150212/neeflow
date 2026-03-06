import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/integrations/pinterest-sandbox-token
 * Body: { sandboxToken }
 *
 * Applies a Pinterest Sandbox access token to ALL channel platforms
 * that have Pinterest connected, so admins don't need to pick each channel manually.
 * Sandbox tokens from the Pinterest Dev Portal expire in ~1 hour.
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sandboxToken } = await req.json()
    if (!sandboxToken?.trim()) {
        return NextResponse.json({ error: 'sandboxToken is required' }, { status: 400 })
    }

    // Sandbox tokens from Developer Portal typically expire in 1 hour
    const expiresAt = new Date(Date.now() + 55 * 60 * 1000)

    const platforms = await prisma.channelPlatform.findMany({
        where: { platform: 'pinterest', isActive: true },
    })

    if (platforms.length === 0) {
        return NextResponse.json({ error: 'No Pinterest accounts connected to any channel' }, { status: 404 })
    }

    await prisma.channelPlatform.updateMany({
        where: { platform: 'pinterest', isActive: true },
        data: {
            accessToken: sandboxToken.trim(),
            tokenExpiresAt: expiresAt,
        },
    })

    console.log(`[Pinterest] Sandbox token applied to ${platforms.length} platform(s)`)
    return NextResponse.json({
        success: true,
        updated: platforms.length,
        expiresAt,
    })
}
