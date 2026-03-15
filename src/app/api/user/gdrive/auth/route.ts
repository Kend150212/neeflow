import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserGDriveAuthUrl, getUserRedirectUri } from '@/lib/gdrive'
import crypto from 'crypto'

// GET /api/user/gdrive/auth — redirect user to Google OAuth consent screen
export async function GET() {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin's Google Client ID from ApiIntegration
    const integration = await prisma.apiIntegration.findFirst({
        where: { provider: 'gdrive' },
    })

    if (!integration) {
        return NextResponse.json({ error: 'Google Drive not configured by admin. Please contact your administrator.' }, { status: 404 })
    }

    const config = (integration.config || {}) as Record<string, string>
    const clientId = config.gdriveClientId

    if (!clientId) {
        return NextResponse.json(
            { error: 'Google Client ID not configured — admin needs to set it up in API Hub' },
            { status: 400 }
        )
    }

    // Generate state with user ID for the callback
    const state = Buffer.from(JSON.stringify({
        userId: session.user.id,
        csrf: crypto.randomBytes(16).toString('hex'),
    })).toString('base64url')

    const redirectUri = getUserRedirectUri()
    const authUrl = getUserGDriveAuthUrl(clientId, redirectUri, state)

    return NextResponse.json({ authUrl })
}
