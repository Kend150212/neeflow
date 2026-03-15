import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/encryption'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'

// Admin scopes: manage files created by the app (used for Drive folder backup)
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
]

// User picker scopes: read-only access to ALL files the user owns
// Required to download files selected via Google Picker
const USER_PICKER_SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
]

/**
 * Build Google OAuth2 authorization URL (admin / system Drive connection)
 */
export function getGDriveAuthUrl(clientId: string, redirectUri: string, state: string) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state,
    })
    return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Build Google OAuth2 authorization URL for USER-level Drive picker connection.
 * Uses drive.readonly so users can pick and download any file from their Drive.
 */
export function getUserGDriveAuthUrl(clientId: string, redirectUri: string, state: string) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: USER_PICKER_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state,
    })
    return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access + refresh tokens
 */
export async function exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
) {
    const res = await fetch(GOOGLE_TOKEN_URL, {
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

    const data = await res.json()

    if (data.error) {
        throw new Error(`Token exchange failed: ${data.error_description || data.error}`)
    }

    return {
        accessToken: data.access_token as string,
        refreshToken: data.refresh_token as string,
        expiresIn: data.expires_in as number,
    }
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
) {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
        }),
    })

    const data = await res.json()

    if (data.error) {
        throw new Error(`Token refresh failed: ${data.error_description || data.error}`)
    }

    return {
        accessToken: data.access_token as string,
        expiresIn: data.expires_in as number,
    }
}

/**
 * Get a valid access token for Google Drive API calls.
 * Reads credentials from the ApiIntegration record, refreshes the token.
 */
export async function getGDriveAccessToken() {
    const integration = await prisma.apiIntegration.findFirst({
        where: { provider: 'gdrive' },
    })

    if (!integration) {
        throw new Error('Google Drive integration not found')
    }

    const config = (integration.config || {}) as Record<string, string>
    const clientId = config.gdriveClientId
    const refreshTokenEncrypted = config.gdriveRefreshToken

    if (!clientId || !refreshTokenEncrypted) {
        throw new Error('Google Drive not connected — please connect first')
    }

    // Client Secret is stored as the encrypted API key
    if (!integration.apiKeyEncrypted) {
        throw new Error('Google Drive Client Secret not configured')
    }

    const clientSecret = decrypt(integration.apiKeyEncrypted)
    const refreshToken = decrypt(refreshTokenEncrypted)

    const { accessToken } = await refreshAccessToken(refreshToken, clientId, clientSecret)
    return accessToken
}

/**
 * Create a folder in Google Drive
 */
export async function createFolder(
    accessToken: string,
    name: string,
    parentId?: string
) {
    const metadata: Record<string, unknown> = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
    }

    if (parentId) {
        metadata.parents = [parentId]
    }

    const res = await fetch(`${GOOGLE_DRIVE_API}/files`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
    })

    const data = await res.json()

    if (data.error) {
        throw new Error(`Failed to create folder: ${data.error.message}`)
    }

    return {
        id: data.id as string,
        name: data.name as string,
        webViewLink: `https://drive.google.com/drive/folders/${data.id}`,
    }
}

/**
 * Get user info (email) from Google
 */
export async function getGoogleUserEmail(accessToken: string) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    return data.email as string
}

/**
 * Store the refresh token + connected email in the integration config
 */
export async function storeGDriveTokens(
    integrationId: string,
    refreshToken: string,
    email: string
) {
    const integration = await prisma.apiIntegration.findUnique({
        where: { id: integrationId },
    })

    const existingConfig = (integration?.config as Record<string, unknown>) || {}

    await prisma.apiIntegration.update({
        where: { id: integrationId },
        data: {
            config: {
                ...existingConfig,
                gdriveRefreshToken: encrypt(refreshToken),
                gdriveEmail: email,
                gdriveConnectedAt: new Date().toISOString(),
            },
            status: 'ACTIVE',
        },
    })
}

/**
 * Build the OAuth2 redirect URI from the app's base URL
 */
export function getRedirectUri() {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return `${baseUrl}/api/admin/gdrive/callback`
}

/**
 * Upload a file to Google Drive using resumable upload.
 * Works for any file size — no base64 overhead.
 */
export async function uploadFile(
    accessToken: string,
    fileName: string,
    mimeType: string,
    fileBuffer: Buffer,
    parentFolderId?: string,
) {
    const metadata: Record<string, unknown> = {
        name: fileName,
        mimeType,
    }
    if (parentFolderId) {
        metadata.parents = [parentFolderId]
    }

    // Step 1: Initiate resumable upload session
    const initRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,webViewLink,webContentLink,size',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': mimeType,
                'X-Upload-Content-Length': String(fileBuffer.length),
            },
            body: JSON.stringify(metadata),
        },
    )

    if (!initRes.ok) {
        const errData = await initRes.json()
        throw new Error(`GDrive upload init failed: ${errData.error?.message || initRes.statusText}`)
    }

    const uploadUri = initRes.headers.get('Location')
    if (!uploadUri) {
        throw new Error('GDrive upload: no upload URI returned')
    }

    // Step 2: Upload the actual file bytes
    const uploadRes = await fetch(uploadUri, {
        method: 'PUT',
        headers: {
            'Content-Type': mimeType,
            'Content-Length': String(fileBuffer.length),
        },
        body: new Uint8Array(fileBuffer),
    })

    const data = await uploadRes.json()
    if (data.error) {
        throw new Error(`GDrive upload failed: ${data.error.message}`)
    }

    return {
        id: data.id as string,
        name: data.name as string,
        mimeType: data.mimeType as string,
        webViewLink: data.webViewLink as string,
        webContentLink: data.webContentLink as string | undefined,
        size: data.size as string,
    }
}

/**
 * Make a file publicly readable (anyone with the link can view).
 * Returns a direct-content URL that works as <img src> or <video src>.
 */
export async function makeFilePublic(accessToken: string, fileId: string, mimeType: string) {
    await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            role: 'reader',
            type: 'anyone',
        }),
    })

    // Use lh3.googleusercontent.com for images — works as <img src> without redirect issues
    // Use drive.google.com/uc?export=download for videos — allows direct streaming
    if (mimeType.startsWith('image/')) {
        return `https://lh3.googleusercontent.com/d/${fileId}`
    }
    return `https://drive.google.com/uc?export=download&id=${fileId}`
}

/**
 * Get or create a channel-specific subfolder inside the parent folder
 */
export async function getOrCreateChannelFolder(
    accessToken: string,
    parentFolderId: string,
    channelName: string,
) {
    // Search for existing folder
    const query = `name='${channelName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const searchRes = await fetch(
        `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    )
    const searchData = await searchRes.json()

    if (searchData.files && searchData.files.length > 0) {
        return {
            id: searchData.files[0].id as string,
            name: searchData.files[0].name as string,
        }
    }

    // Create new folder
    return createFolder(accessToken, channelName, parentFolderId)
}

/**
 * Build the OAuth2 redirect URI for user-level Google Drive connection
 */
export function getUserRedirectUri() {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return `${baseUrl}/api/user/gdrive/callback`
}

/**
 * Get a valid access token for a specific user's Google Drive.
 * Reads the refresh token from the User record and uses the admin's Client ID/Secret.
 */
export async function getUserGDriveAccessToken(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { gdriveRefreshToken: true },
    })

    if (!user?.gdriveRefreshToken) {
        throw new Error('Google Drive not connected — please connect your Google Drive first')
    }

    // Use admin's Google OAuth Client ID/Secret from ApiIntegration
    const integration = await prisma.apiIntegration.findFirst({
        where: { provider: 'gdrive' },
    })

    if (!integration) {
        throw new Error('Google Drive integration not configured by admin')
    }

    const config = (integration.config || {}) as Record<string, string>
    const clientId = config.gdriveClientId

    if (!clientId || !integration.apiKeyEncrypted) {
        throw new Error('Google Drive Client ID/Secret not configured in API Hub')
    }

    const clientSecret = decrypt(integration.apiKeyEncrypted)
    const refreshToken = decrypt(user.gdriveRefreshToken)

    const { accessToken } = await refreshAccessToken(refreshToken, clientId, clientSecret)
    return accessToken
}

/**
 * Get or create a monthly subfolder (YYYY-MM) inside the user's root folder
 */
export async function getOrCreateMonthlyFolder(
    accessToken: string,
    parentFolderId: string,
) {
    const now = new Date()
    const monthFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Search for existing monthly folder
    const query = `name='${monthFolder}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const searchRes = await fetch(
        `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    )
    const searchData = await searchRes.json()

    if (searchData.files && searchData.files.length > 0) {
        return {
            id: searchData.files[0].id as string,
            name: searchData.files[0].name as string,
        }
    }

    // Create new monthly folder
    return createFolder(accessToken, monthFolder, parentFolderId)
}

/**
 * List files in a Google Drive folder.
 * Returns image/video files with id, name, mimeType, size, thumbnailLink.
 */
export async function listDriveFiles(
    accessToken: string,
    folderId: string,
    pageToken?: string,
): Promise<Array<{ id: string; name: string; mimeType: string; size?: string; thumbnailLink?: string }>> {
    const q = `'${folderId}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`
    const fields = 'nextPageToken,files(id,name,mimeType,size,thumbnailLink)'
    const params = new URLSearchParams({ q, fields, pageSize: '200' })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = await res.json()
    if (data.error) throw new Error(`GDrive listFiles failed: ${data.error.message}`)

    const files = data.files || []

    // Paginate if more results exist
    if (data.nextPageToken) {
        const nextFiles = await listDriveFiles(accessToken, folderId, data.nextPageToken)
        return [...files, ...nextFiles]
    }

    return files
}

