import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBrandingServer } from '@/lib/use-branding-server'
import { decrypt, encrypt } from '@/lib/encryption'
import {
    exchangeCodeForTokens,
    getGoogleUserEmail,
    getUserRedirectUri,
    createFolder,
} from '@/lib/gdrive'

// GET /api/user/gdrive/callback — Google OAuth2 callback for user-level connection
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')
    const error = searchParams.get('error')

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    if (error) {
        return NextResponse.redirect(`${baseUrl}/dashboard/integrations?gdrive=error&message=${encodeURIComponent(error)}`)
    }

    if (!code || !stateParam) {
        return NextResponse.redirect(`${baseUrl}/dashboard/integrations?gdrive=error&message=${encodeURIComponent('Missing params')}`)
    }

    // Parse state to get user ID
    let state: { userId: string; csrf: string }
    try {
        state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    } catch {
        return NextResponse.redirect(`${baseUrl}/dashboard/integrations?gdrive=error&message=${encodeURIComponent('Invalid state')}`)
    }

    try {
        // Get admin's Google OAuth Client ID/Secret
        const integration = await prisma.apiIntegration.findFirst({
            where: { provider: 'gdrive' },
        })

        if (!integration) {
            return NextResponse.redirect(`${baseUrl}/dashboard/integrations?gdrive=error&message=${encodeURIComponent('Integration not found')}`)
        }

        const config = (integration.config || {}) as Record<string, string>
        const clientId = config.gdriveClientId

        if (!clientId || !integration.apiKeyEncrypted) {
            return NextResponse.redirect(`${baseUrl}/dashboard/integrations?gdrive=error&message=${encodeURIComponent('Not configured')}`)
        }

        const clientSecret = decrypt(integration.apiKeyEncrypted)
        const redirectUri = getUserRedirectUri()

        // Exchange code for tokens
        const { accessToken, refreshToken } = await exchangeCodeForTokens(
            code,
            clientId,
            clientSecret,
            redirectUri
        )

        // Get user email from Google
        const email = await getGoogleUserEmail(accessToken)

        // Get user info to create folder with their name
        const user = await prisma.user.findUnique({
            where: { id: state.userId },
            select: { name: true, email: true },
        })

        const userName = user?.name || user?.email?.split('@')[0] || 'User'
        const brand = await getBrandingServer()
        const folderName = `${brand.appName || 'NeeFlow'} - ${userName}`

        // Search for existing root folder to avoid duplicates on reconnect
        const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'
        const searchQuery = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`
        const searchRes = await fetch(
            `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const searchData = await searchRes.json()

        let folder: { id: string; name: string }
        if (searchData.files && searchData.files.length > 0) {
            // Reuse existing folder
            folder = { id: searchData.files[0].id, name: searchData.files[0].name }
            console.log('GDrive connect: reusing existing folder', folder.name, folder.id)
        } else {
            // Create new folder only if none exists
            folder = await createFolder(accessToken, folderName)
            console.log('GDrive connect: created new folder', folder.name, folder.id)
        }

        // Store refresh token and folder info on User record
        await prisma.user.update({
            where: { id: state.userId },
            data: {
                gdriveRefreshToken: encrypt(refreshToken),
                gdriveFolderId: folder.id,
                gdriveFolderName: folder.name,
                gdriveEmail: email,
                gdriveConnectedAt: new Date(),
            },
        })

        return NextResponse.redirect(`${baseUrl}/dashboard/integrations?gdrive=connected`)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed'
        return NextResponse.redirect(`${baseUrl}/dashboard/integrations?gdrive=error&message=${encodeURIComponent(message)}`)
    }
}
