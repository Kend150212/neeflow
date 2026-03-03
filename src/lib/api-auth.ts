import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

/**
 * Generate a new API key.
 * Returns { rawKey, keyHash, keyPrefix } — rawKey is shown once to user.
 */
export async function generateApiKey(): Promise<{ rawKey: string; keyHash: string; keyPrefix: string }> {
    const raw = `ask_${randomBytes(24).toString('hex')}` // ask_ + 48 hex chars
    const hash = await bcrypt.hash(raw, 10)
    const prefix = raw.slice(0, 12) // "ask_a1b2c3d4" for display
    return { rawKey: raw, keyHash: hash, keyPrefix: prefix }
}

/**
 * Authenticate an API request by X-API-Key header.
 * Returns the user context or a NextResponse error.
 */
export async function authenticateApiKey(req: NextRequest): Promise<
    | { user: { id: string; name: string | null; email: string; role: string }; plan: { maxApiCallsPerMonth: number;[key: string]: unknown }; usage: { apiCalls: number; postsCreated: number; usageId: string; month: string }; keyId: string }
    | NextResponse
> {
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
        return NextResponse.json(
            { success: false, error: { code: 'MISSING_API_KEY', message: 'X-API-Key header is required' } },
            { status: 401 },
        )
    }

    // Find all active keys and check against hash
    const activeKeys = await prisma.appApiKey.findMany({
        where: { isActive: true },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    subscription: {
                        include: {
                            plan: true,
                            usages: {
                                where: { month: getCurrentMonth() },
                                take: 1,
                            },
                        },
                    },
                },
            },
        },
    })

    // Check each key (we use bcrypt so we need to compare one by one)
    // Optimization: filter by prefix first
    const prefix = apiKey.slice(0, 12)
    const candidates = activeKeys.filter(k => k.keyPrefix === prefix)

    let matchedKey = null
    for (const key of candidates) {
        const match = await bcrypt.compare(apiKey, key.keyHash)
        if (match) {
            matchedKey = key
            break
        }
    }

    if (!matchedKey) {
        return NextResponse.json(
            { success: false, error: { code: 'INVALID_API_KEY', message: 'Invalid or revoked API key' } },
            { status: 401 },
        )
    }

    // Check expiration
    if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
        return NextResponse.json(
            { success: false, error: { code: 'EXPIRED_API_KEY', message: 'API key has expired' } },
            { status: 401 },
        )
    }

    // Check user is active
    if (!matchedKey.user.isActive) {
        return NextResponse.json(
            { success: false, error: { code: 'USER_INACTIVE', message: 'User account is deactivated' } },
            { status: 403 },
        )
    }

    // Check subscription & plan
    const subscription = matchedKey.user.subscription
    if (!subscription) {
        return NextResponse.json(
            { success: false, error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription' } },
            { status: 403 },
        )
    }

    const plan = subscription.plan as { maxApiCallsPerMonth: number;[key: string]: unknown }
    const maxCalls = plan.maxApiCallsPerMonth ?? 0

    if (maxCalls === 0) {
        return NextResponse.json(
            { success: false, error: { code: 'API_NOT_INCLUDED', message: 'API access is not included in your plan. Please upgrade.' } },
            { status: 403 },
        )
    }

    // Get or create usage for current month
    const month = getCurrentMonth()
    let usage = subscription.usages[0]

    if (!usage) {
        usage = await prisma.usage.create({
            data: { subscriptionId: subscription.id, month },
        })
    }

    // Check quota (skip if unlimited = -1)
    if (maxCalls !== -1 && usage.apiCalls >= maxCalls) {
        return NextResponse.json(
            {
                success: false,
                error: { code: 'QUOTA_EXCEEDED', message: `API call limit reached (${maxCalls}/month). Resets on ${getResetDate()}.` },
                meta: { apiCalls: { used: usage.apiCalls, limit: maxCalls, reset: getResetDate() } },
            },
            { status: 429 },
        )
    }

    // Update last used + increment usage (fire-and-forget)
    prisma.$transaction([
        prisma.appApiKey.update({ where: { id: matchedKey.id }, data: { lastUsedAt: new Date() } }),
        prisma.usage.update({ where: { id: usage.id }, data: { apiCalls: { increment: 1 } } }),
    ]).catch(() => { })

    return {
        user: { id: matchedKey.user.id, name: matchedKey.user.name, email: matchedKey.user.email, role: matchedKey.user.role },
        plan,
        usage: { apiCalls: usage.apiCalls + 1, postsCreated: usage.postsCreated, usageId: usage.id, month },
        keyId: matchedKey.id,
    }
}

/**
 * Add rate-limit headers to a response.
 */
export function withRateLimitHeaders(
    res: NextResponse,
    used: number,
    limit: number,
): NextResponse {
    if (limit === -1) {
        res.headers.set('X-RateLimit-Limit', 'unlimited')
        res.headers.set('X-RateLimit-Remaining', 'unlimited')
    } else {
        res.headers.set('X-RateLimit-Limit', String(limit))
        res.headers.set('X-RateLimit-Remaining', String(Math.max(0, limit - used)))
    }
    res.headers.set('X-RateLimit-Reset', String(getResetTimestamp()))
    return res
}

/**
 * Create a success response with rate-limit metadata.
 */
export function apiSuccess(data: unknown, used: number, limit: number, status = 200) {
    const res = NextResponse.json(
        {
            success: true,
            data,
            meta: {
                apiCalls: {
                    used,
                    limit: limit === -1 ? 'unlimited' : limit,
                    reset: getResetDate(),
                },
            },
        },
        { status },
    )
    return withRateLimitHeaders(res, used, limit)
}

/** YYYY-MM format */
function getCurrentMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** ISO date of next month start */
function getResetDate(): string {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return next.toISOString().slice(0, 10)
}

/** Unix timestamp of next month start */
function getResetTimestamp(): number {
    const now = new Date()
    return Math.floor(new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() / 1000)
}
