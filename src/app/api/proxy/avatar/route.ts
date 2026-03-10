import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/proxy/avatar?u={externalUserId}&c={channelId}
 *
 * Server-side avatar proxy for Facebook/Instagram profile pictures.
 * - Looks up the real CDN URL from our DB (stored from webhook profile fetch)
 * - Fetches the image server-side
 * - Returns it with Cache-Control: public, max-age=604800 (7 days)
 * - Browser caches → ZERO repeat calls to graph.facebook.com
 *
 * In-memory cache (per server instance) with 6-hour TTL prevents
 * repeated DB lookups and re-fetches within the same server lifetime.
 */

// ─── In-memory cache (URL → image blob buffer) ──────────────────────────────
interface CacheEntry {
    buffer: ArrayBuffer
    contentType: string
    expiresAt: number
}

const avatarCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
const BROWSER_CACHE_SECONDS = 60 * 60 * 24 * 7 // 7 days

// Clean up expired entries periodically
const cleanCache = () => {
    const now = Date.now()
    for (const [key, entry] of avatarCache.entries()) {
        if (entry.expiresAt < now) avatarCache.delete(key)
    }
}
setInterval(cleanCache, 30 * 60 * 1000) // every 30 min

// Generic grey person silhouette as fallback (1x1 transparent PNG → inline)
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <circle cx="20" cy="20" r="20" fill="#e5e7eb"/>
  <circle cx="20" cy="15" r="7" fill="#9ca3af"/>
  <ellipse cx="20" cy="35" rx="12" ry="9" fill="#9ca3af"/>
</svg>`

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

    // ── 1. Check in-memory cache ───────────────────────────────────────────
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

    // ── 2. Look up avatar URL from DB ─────────────────────────────────────
    let avatarUrl: string | null = null
    try {
        const where: any = { externalUserId }
        if (channelId) where.channelId = channelId

        const conv = await prisma.conversation.findFirst({
            where,
            select: { externalUserAvatar: true },
            orderBy: { lastMessageAt: 'desc' },
        })
        avatarUrl = conv?.externalUserAvatar || null
    } catch { /* DB error → use fallback */ }

    // ── 3. If no good URL, return fallback SVG ────────────────────────────
    if (!avatarUrl) {
        return new NextResponse(FALLBACK_SVG, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': `public, max-age=3600` },
        })
    }

    // ── 4. Fetch the image from the stored CDN URL ─────────────────────────
    try {
        const imgRes = await fetch(avatarUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            // 5 second timeout
            signal: AbortSignal.timeout(5000),
        })

        if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`)

        const arrayBuf = await imgRes.arrayBuffer()
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

        // Store in in-memory cache
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
        // If fetch fails (expired URL etc.), return fallback
        return new NextResponse(FALLBACK_SVG, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
        })
    }
}
