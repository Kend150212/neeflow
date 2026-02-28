import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Edge-compatible setup check.
 * Middleware runs in Edge Runtime — no fs/path/process.cwd().
 * Instead, check if DATABASE_URL env var exists (set by wizard or .env).
 * If no DATABASE_URL → app needs setup → redirect to /setup.
 */
function isSetupComplete(): boolean {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) return false
    // Skip if it's the placeholder from install.sh
    if (dbUrl.includes('temporary') || dbUrl === '') return false
    return true
}

// ── Site Mode cache ──────────────────────────────────────────────
let cachedSiteMode: string = 'live'
let cacheTs = 0
const CACHE_TTL = 10_000 // 10 seconds

async function getSiteMode(origin: string): Promise<string> {
    const now = Date.now()
    if (now - cacheTs < CACHE_TTL) return cachedSiteMode
    try {
        // Use localhost for self-referential calls to avoid DNS/proxy issues
        const port = process.env.PORT || '3000'
        const localUrl = `http://127.0.0.1:${port}/api/site-mode`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)

        const res = await fetch(localUrl, {
            cache: 'no-store',
            signal: controller.signal,
        })
        clearTimeout(timeout)

        if (res.ok) {
            const data = await res.json()
            cachedSiteMode = data.mode || 'live'
            cacheTs = now
            console.log('[Middleware] Site mode fetched:', cachedSiteMode)
        } else {
            console.warn('[Middleware] Site mode fetch status:', res.status)
        }
    } catch (err) {
        console.error('[Middleware] Site mode fetch failed:', err instanceof Error ? err.message : err)
        // If fetch fails, default to live to avoid locking users out
    }
    return cachedSiteMode
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl
    const origin = req.nextUrl.origin

    // ── Setup wizard redirect — if not configured yet ─────────────
    const isSetupRoute = pathname.startsWith('/setup') || pathname.startsWith('/api/setup')
    const setupComplete = isSetupComplete()

    if (!isSetupRoute && !setupComplete) {
        return NextResponse.redirect(new URL('/setup', req.url))
    }

    // ── Site Mode check ───────────────────────────────────────────
    // Allow these paths regardless of site mode
    const isAllowedPath =
        pathname.startsWith('/api') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/setup') ||
        pathname.startsWith('/coming-soon') ||
        pathname.startsWith('/maintenance') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/connect') ||       // EasyConnect — public for clients
        pathname.startsWith('/invite') ||        // Invite links — public
        pathname.startsWith('/setup-password') || // Invite activation — public
        pathname === '/favicon.ico'

    if (!isAllowedPath && setupComplete) {
        const siteMode = await getSiteMode(origin)

        if (siteMode !== 'live') {
            // Check if user has admin session — admins bypass site mode
            const hasSession =
                req.cookies.has('__Secure-authjs.session-token') ||
                req.cookies.has('authjs.session-token') ||
                req.cookies.has('next-auth.session-token')

            if (!hasSession) {
                const target = siteMode === 'coming_soon' ? '/coming-soon' : '/maintenance'
                return NextResponse.redirect(new URL(target, req.url))
            }
        }
    }

    const hasSession =
        req.cookies.has('__Secure-authjs.session-token') ||
        req.cookies.has('authjs.session-token') ||
        req.cookies.has('next-auth.session-token')

    // ── Redirect logged-in users away from /login only (not landing page) ─
    const isAuthPage = pathname === '/login'
    if (isAuthPage && hasSession) {
        return NextResponse.redirect(new URL('/choose', req.url))
    }

    // ── Protect dashboard routes — redirect to login with callbackUrl ─
    const isDashboardRoute = pathname.startsWith('/dashboard')
    if (isDashboardRoute && !hasSession) {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search)
        return NextResponse.redirect(loginUrl)
    }

    // ── Protect portal routes — redirect to login ─────────────────────
    if (pathname.startsWith('/portal') && !hasSession) {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('callbackUrl', '/portal')
        return NextResponse.redirect(loginUrl)
    }

    // ── Protect choose route ──────────────────────────────────────────
    if (pathname === '/choose' && !hasSession) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // ── Protect /admin routes — redirect to login ─────────────────────
    if (pathname.startsWith('/admin') && !hasSession) {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|public|api).*)'],
}
