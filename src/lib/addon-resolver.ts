/**
 * Add-on Resolver — calculates effective limits for a user.
 *
 * Effective Limit = Plan Base Limit + Σ(addon.quotaAmount × quantity)
 *
 * For features: if the plan has the feature OR any active feature add-on → true.
 */
import { prisma } from '@/lib/prisma'
import { FREE_PLAN_DEFAULTS } from '@/lib/plans'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export type EffectiveLimits = {
    // Quotas
    maxChannels: number
    maxPostsPerMonth: number
    maxMembersPerChannel: number
    maxStorageMB: number
    maxAiImagesPerMonth: number
    maxAiTextPerMonth: number
    maxApiCallsPerMonth: number
    maxSmartFlowJobsPerMonth: number
    // Features
    hasAutoSchedule: boolean
    hasWebhooks: boolean
    hasAdvancedReports: boolean
    hasPrioritySupport: boolean
    hasWhiteLabel: boolean
    hasSmartFlow: boolean
}

// Fields that can be boosted by addons
const QUOTA_FIELDS = [
    'maxChannels',
    'maxPostsPerMonth',
    'maxMembersPerChannel',
    'maxStorageMB',
    'maxAiImagesPerMonth',
    'maxAiTextPerMonth',
    'maxApiCallsPerMonth',
    'maxSmartFlowJobsPerMonth',
] as const

const FEATURE_FIELDS = [
    'hasAutoSchedule',
    'hasWebhooks',
    'hasAdvancedReports',
    'hasPrioritySupport',
    'hasWhiteLabel',
    'hasSmartFlow',
] as const

/**
 * Get the effective (plan + add-ons) limits for a user.
 */
export async function getEffectiveLimits(userId: string): Promise<EffectiveLimits> {
    const sub = await db.subscription.findUnique({
        where: { userId },
        include: {
            plan: true,
            addons: {
                where: { status: 'active' },
                include: { addon: true },
            },
        },
    })

    // Base plan limits (fallback to free defaults)
    const plan = sub?.plan ?? null
    const baseLimits: EffectiveLimits = {
        maxChannels: plan?.maxChannels ?? FREE_PLAN_DEFAULTS.maxChannels,
        maxPostsPerMonth: plan?.maxPostsPerMonth ?? FREE_PLAN_DEFAULTS.maxPostsPerMonth,
        maxMembersPerChannel: plan?.maxMembersPerChannel ?? FREE_PLAN_DEFAULTS.maxMembersPerChannel,
        maxStorageMB: plan?.maxStorageMB ?? FREE_PLAN_DEFAULTS.maxStorageMB,
        maxAiImagesPerMonth: plan?.maxAiImagesPerMonth ?? FREE_PLAN_DEFAULTS.maxAiImagesPerMonth,
        maxAiTextPerMonth: plan?.maxAiTextPerMonth ?? FREE_PLAN_DEFAULTS.maxAiTextPerMonth,
        maxApiCallsPerMonth: plan?.maxApiCallsPerMonth ?? FREE_PLAN_DEFAULTS.maxApiCallsPerMonth,
        maxSmartFlowJobsPerMonth: plan?.maxSmartFlowJobsPerMonth ?? FREE_PLAN_DEFAULTS.maxSmartFlowJobsPerMonth,
        hasAutoSchedule: plan?.hasAutoSchedule ?? FREE_PLAN_DEFAULTS.hasAutoSchedule,
        hasWebhooks: plan?.hasWebhooks ?? FREE_PLAN_DEFAULTS.hasWebhooks,
        hasAdvancedReports: plan?.hasAdvancedReports ?? FREE_PLAN_DEFAULTS.hasAdvancedReports,
        hasPrioritySupport: plan?.hasPrioritySupport ?? FREE_PLAN_DEFAULTS.hasPrioritySupport,
        hasWhiteLabel: plan?.hasWhiteLabel ?? FREE_PLAN_DEFAULTS.hasWhiteLabel,
        hasSmartFlow: plan?.hasSmartFlow ?? FREE_PLAN_DEFAULTS.hasSmartFlow,
    }

    // No active add-ons → return base
    const activeAddons = sub?.addons ?? []
    if (activeAddons.length === 0) return baseLimits

    // Apply quota add-ons
    for (const sa of activeAddons) {
        const addon = sa.addon
        if (!addon) continue

        // Quota add-on
        if (addon.category === 'quota' && addon.quotaField) {
            const field = addon.quotaField as typeof QUOTA_FIELDS[number]
            if (QUOTA_FIELDS.includes(field)) {
                const current = baseLimits[field]
                // -1 means unlimited — don't add to unlimited
                if (current !== -1) {
                    baseLimits[field] = current + addon.quotaAmount * sa.quantity
                }
            }
        }

        // Feature add-on
        if (addon.category === 'feature' && addon.featureField) {
            const field = addon.featureField as typeof FEATURE_FIELDS[number]
            if (FEATURE_FIELDS.includes(field)) {
                baseLimits[field] = true
            }
        }
    }

    return baseLimits
}

/**
 * Get active add-ons for a user's subscription.
 */
export async function getUserActiveAddons(userId: string) {
    const sub = await db.subscription.findUnique({
        where: { userId },
        select: {
            addons: {
                where: { status: 'active' },
                include: { addon: true },
            },
        },
    })
    return sub?.addons ?? []
}
