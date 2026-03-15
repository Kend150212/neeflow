import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getGDriveAccessToken } from '@/lib/gdrive'

/**
 * GET /api/user/gdrive/proxy-thumb?fileId=xxx
 *
 * Server-side proxy that fetches a Google Drive file thumbnail using the admin
 * access token and streams the image bytes back to the browser.
 * This lets the compose editor display Drive images without requiring
 * the browser to have Google auth cookies.
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const fileId = req.nextUrl.searchParams.get('fileId')
    if (!fileId) {
        return new NextResponse('fileId required', { status: 400 })
    }

    try {
        const accessToken = await getGDriveAccessToken()

        // Try thumbnail first (smaller, faster), fallback to full file
        // Google Drive thumbnail: accounts.google.com thumbnail via drive API
        const thumbUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&fields=thumbnailLink`

        // Actually fetch the thumbnail link metadata first
        const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,mimeType`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        let imageUrl: string
        let mimeType = 'image/jpeg'

        if (metaRes.ok) {
            const meta = await metaRes.json() as { thumbnailLink?: string; mimeType?: string }
            mimeType = meta.mimeType || 'image/jpeg'

            if (meta.thumbnailLink) {
                // thumbnailLink is a direct CDN URL — no auth needed but use admin token via referrer
                imageUrl = meta.thumbnailLink.replace('=s220', '=s800') // get larger size
            } else {
                // Fallback: download the actual file content
                imageUrl = thumbUrl
            }
        } else {
            imageUrl = thumbUrl
        }

        // If it's an external CDN thumbnail (no auth needed), pass through
        if (!imageUrl.includes('googleapis.com/drive')) {
            const cdnRes = await fetch(imageUrl)
            if (!cdnRes.ok) {
                return new NextResponse('Image not found', { status: 404 })
            }
            const buf = await cdnRes.arrayBuffer()
            return new NextResponse(buf, {
                headers: {
                    'Content-Type': mimeType,
                    'Cache-Control': 'public, max-age=3600',
                },
            })
        }

        // Drive API download
        const fileRes = await fetch(imageUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!fileRes.ok) {
            return new NextResponse('Failed to fetch from Drive', { status: fileRes.status })
        }

        const buf = await fileRes.arrayBuffer()
        const contentType = fileRes.headers.get('content-type') || mimeType

        return new NextResponse(buf, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
            },
        })
    } catch (error) {
        console.error('proxy-thumb error:', error)
        return new NextResponse('Internal error', { status: 500 })
    }
}
