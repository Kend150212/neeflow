import { getCurrentMonth } from '@/lib/plans'
import { prisma } from '@/lib/prisma'
import { getEffectiveLimits } from '@/lib/addon-resolver'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export type ImageQuotaResult = {
    allowed: boolean
    used: number
    limit: number         // -1 = unlimited, 0 = BYOK-only
    usingByok: boolean
    reason?: string
}

export type TextQuotaResult = {
    allowed: boolean
    used: number
    limit: number         // -1 = unlimited, 0 = BYOK-only
    usingByok: boolean
    reason?: string
}

/**
 * Check if user can generate an AI image using admin's API key.
 * If they have their own key (BYOK), quota is bypassed.
 */
export async function checkImageQuota(
    userId: string,
    hasByok: boolean,
): Promise<ImageQuotaResult> {
    // BYOK users are never quota-limited
    if (hasByok) {
        return { allowed: true, used: 0, limit: -1, usingByok: true }
    }

    // Get effective limits (plan + add-ons)
    const limits = await getEffectiveLimits(userId)
    const limit = limits.maxAiImagesPerMonth

    // Free plan or no plan → 0 quota
    if (limit === 0) {
        return {
            allowed: false,
            used: 0,
            limit: 0,
            usingByok: false,
            reason: 'Your plan does not include AI image generation. Add your own Runware/OpenAI API key or upgrade your plan.',
        }
    }

    // Get current month usage
    const sub = await db.subscription.findUnique({
        where: { userId },
        include: { usages: { where: { month: getCurrentMonth() } } },
    })
    const usage = sub?.usages?.[0] ?? null
    const used: number = usage?.imagesGenerated ?? 0

    // -1 = unlimited
    if (limit === -1) {
        return { allowed: true, used, limit: -1, usingByok: false }
    }

    if (used >= limit) {
        return {
            allowed: false,
            used,
            limit,
            usingByok: false,
            reason: `Monthly AI image quota reached (${used}/${limit}). Upgrade your plan, purchase an add-on, or add your own API key.`,
        }
    }

    return { allowed: true, used, limit, usingByok: false }
}

/**
 * Increment the image generation counter for the current month.
 * Call AFTER a successful generation.
 */
export async function incrementImageUsage(userId: string): Promise<void> {
    const sub = await db.subscription.findUnique({ where: { userId } })
    if (!sub) return

    const month = getCurrentMonth()

    await db.usage.upsert({
        where: { subscriptionId_month: { subscriptionId: sub.id, month } },
        update: { imagesGenerated: { increment: 1 } },
        create: {
            subscriptionId: sub.id,
            month,
            postsCreated: 0,
            imagesGenerated: 1,
            aiTextGenerated: 0,
        },
    })
}

/**
 * Get image usage for display.
 */
export async function getUserImageQuota(userId: string): Promise<{ used: number; limit: number }> {
    const sub = await db.subscription.findUnique({
        where: { userId },
        include: { plan: true, usages: { where: { month: getCurrentMonth() } } },
    })

    const limit: number = sub?.plan?.maxAiImagesPerMonth ?? 0
    const used: number = sub?.usages?.[0]?.imagesGenerated ?? 0

    return { used, limit }
}

// ─── AI Text Quota ───────────────────────────────────────────────────────────

/**
 * Check if user can run an AI text generation (description, analysis, caption, etc.)
 * using admin's shared API key.
 *
 * BYOK: if the channel owner has their own key, bypass quota entirely.
 * Plan limit: maxAiTextPerMonth (-1 = unlimited, default 20 for free plan)
 */
export async function checkTextQuota(
    _userId: string,
    _hasByok: boolean,
): Promise<TextQuotaResult> {
    // Text quota not enforced — only posts and AI images are tracked.
    return { allowed: true, used: 0, limit: -1, usingByok: false }
}

/**
 * Increment AI text generation counter for the current month.
 * Call AFTER a successful generation. No-op if user has BYOK.
 */
export async function incrementTextUsage(_userId: string, _hasByok: boolean): Promise<void> {
    // Text usage is not tracked — only posts and AI images are counted.
}

/**
 * Get AI text generation usage for display on billing / dashboard.
 */
export async function getUserTextQuota(userId: string): Promise<{ used: number; limit: number }> {
    const sub = await db.subscription.findUnique({
        where: { userId },
        include: { plan: true, usages: { where: { month: getCurrentMonth() } } },
    })

    const limit: number = sub?.plan?.maxAiTextPerMonth ?? 20
    const used: number = sub?.usages?.[0]?.aiTextGenerated ?? 0

    return { used, limit }
}
