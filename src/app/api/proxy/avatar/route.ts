import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/proxy/avatar?u={externalUserId}&c={channelId}
 *
 * Server-side avatar proxy for Facebook/Instagram profile pictures.
 * - Looks up the real CDN URL from our DB (stored from webhook profile fetch)
 * - Fetches the image server-side (follows FB redirect to real CDN URL)
 * - **Writes the resolved CDN URL back to DB** so next fetch goes direct to CDN
 * - Returns it with Cache-Control: public, max-age=604800 (7 days)
 * - Browser caches → ZERO repeat calls to graph.facebook.com
 *
 * In-memory cache (per server instance) with 6-hour TTL prevents
 * repeated DB lookups and re-fetches within the same server lifetime.
 */

// ─── In-memory cache ──────────────────────────────────────────────────────────
interface CacheEntry {
    buffer: ArrayBuffer
    contentType: string
    expiresAt: number
}

const avatarCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000     // 6 hours in-memory
const BROWSER_CACHE_SECONDS = 60 * 60 * 24 * 7 // 7 days browser cache

// Clean up expired entries every 30 min
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of avatarCache.entries()) {
        if (entry.expiresAt < now) avatarCache.delete(key)
    }
}, 30 * 60 * 1000)

// Generic grey person silhouette fallback
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <circle cx="20" cy="20" r="20" fill="#e5e7eb"/>
  <circle cx="20" cy="15" r="7" fill="#9ca3af"/>
  <ellipse cx="20" cy="35" rx="12" ry="9" fill="#9ca3af"/>
</svg>`

// Whether a URL is a raw FB Graph API picture URL (triggers API quota)
function isFbGraphPictureUrl(url: string) {
    return url.includes('graph.facebook.com') && url.includes('picture')
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const externalUserId = searchParams.get('u')
    const channelId = searchParams.get('c')

    if (!externalUserId) {
        return new NextResponse(FALLBACK_SVG, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': `public, max-age=${BROWSER_CACHE_SECONDS}` },
        })
    }

    const cacheKey = `${channelId || 'any'}:${externalUserId}`

    // ── 1. In-memory cache hit ─────────────────────────────────────────────
    const cached = avatarCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
        return new Response(cached.buffer, {
            status: 200,
            headers: {
                'Content-Type': cached.contentType,
                'Cache-Control': `public, max-age=${BROWSER_CACHE_SECONDS}`,
                'X-Cache': 'HIT',
            },
        })
    }

    // ── 2. DB lookup ──────────────────────────────────────────────────────
    let avatarUrl: string | null = null
    let conversationId: string | null = null
    try {
        const where: any = { externalUserId }
        if (channelId) where.channelId = channelId

        const conv = await prisma.conversation.findFirst({
            where,
            select: { id: true, externalUserAvatar: true },
            orderBy: { lastMessageAt: 'desc' },
        })
        avatarUrl = conv?.externalUserAvatar || null
        conversationId = conv?.id || null
    } catch { /* DB error → fallback */ }

    // ── 3. No URL → fallback ──────────────────────────────────────────────
    if (!avatarUrl) {
        return new NextResponse(FALLBACK_SVG, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
        })
    }

    // ── 4. Fetch image (follow redirects so we land on real CDN URL) ───────
    try {
        const imgRes = await fetch(avatarUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow', // follow FB → fbcdn redirect
            signal: AbortSignal.timeout(5000),
        })

        if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`)

        const arrayBuf = await imgRes.arrayBuffer()
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

        // ── 5. If original URL was a graph.facebook.com/picture URL,
        //        write back the resolved CDN URL to DB so future lookups
        //        skip FB Graph API entirely ─────────────────────────────
        const resolvedUrl = imgRes.url // final URL after redirect
        if (
            conversationId &&
            resolvedUrl &&
            resolvedUrl !== avatarUrl &&
            isFbGraphPictureUrl(avatarUrl) &&
            !isFbGraphPictureUrl(resolvedUrl)
        ) {
            // Fire-and-forget — don't block the response
            prisma.conversation.updateMany({
                where: { externalUserId, ...(channelId ? { channelId } : {}) },
                data: { externalUserAvatar: resolvedUrl },
            }).catch(() => { /* non-critical */ })
        }

        // ── 6. Store in in-memory cache ───────────────────────────────────
        avatarCache.set(cacheKey, { buffer: arrayBuf, contentType, expiresAt: Date.now() + CACHE_TTL_MS })

        return new Response(arrayBuf, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': `public, max-age=${BROWSER_CACHE_SECONDS}`,
                'X-Cache': 'MISS',
            },
        })
    } catch {
        // Fetch failed (expired URL etc.) → fallback
        return new NextResponse(FALLBACK_SVG, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
        })
    }
}
