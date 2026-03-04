/**
 * GET /api/media/tiktok-image?url=<encoded-url>
 *
 * Fetches any image (PNG, GIF, BMP, TIFF, etc.) and converts it to JPEG
 * using Sharp, then returns it. Used when publishing carousel posts to TikTok
 * via PULL_FROM_URL — TikTok only accepts JPEG and WebP for photo posts.
 *
 * The URL must be on our own domain or trusted CDN (R2, GDrive proxy, etc.)
 * so TikTok can pull from our verified domain.
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// Max source image size to fetch (20 MB)
const MAX_BYTES = 20 * 1024 * 1024

export async function GET(req: NextRequest) {
    const rawUrl = req.nextUrl.searchParams.get('url')
    if (!rawUrl) {
        return new NextResponse('Missing url param', { status: 400 })
    }

    let sourceUrl: string
    try {
        sourceUrl = decodeURIComponent(rawUrl)
        new URL(sourceUrl) // throws if invalid
    } catch {
        return new NextResponse('Invalid url param', { status: 400 })
    }

    try {
        const upstream = await fetch(sourceUrl, { next: { revalidate: 0 } })
        if (!upstream.ok) {
            return new NextResponse(`Upstream error: ${upstream.status}`, { status: 502 })
        }

        const contentType = upstream.headers.get('content-type') || ''

        // If already JPEG — stream through without re-encoding
        if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            const body = upstream.body
            return new NextResponse(body, {
                status: 200,
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Cache-Control': 'public, max-age=3600',
                },
            })
        }

        // For all other formats (PNG, WebP, GIF, BMP, TIFF) — convert to JPEG
        const arrayBuffer = await upstream.arrayBuffer()
        if (arrayBuffer.byteLength > MAX_BYTES) {
            return new NextResponse('Source image too large (max 20 MB)', { status: 413 })
        }

        const jpegBuffer = await sharp(Buffer.from(arrayBuffer))
            .flatten({ background: { r: 255, g: 255, b: 255 } }) // handle transparent PNGs → white bg
            .jpeg({ quality: 92, progressive: true })
            .toBuffer()

        return new NextResponse(new Uint8Array(jpegBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=3600',
                'Content-Length': String(jpegBuffer.byteLength),
            },
        })
    } catch (err: unknown) {
        console.error('[TikTok Image Proxy] Error:', err)
        return new NextResponse('Image conversion failed', { status: 500 })
    }
}
