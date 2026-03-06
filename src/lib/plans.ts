/**
 * Billing & Plans library
 * - Get user's current plan + limits
 * - Check limits before creating resources
 */
import { prisma } from '@/lib/prisma'

// Default FREE plan limits (fallback when no subscription found)
export const FREE_PLAN_DEFAULTS = {
    maxChannels: 1,
    maxPostsPerMonth: 50,
    maxMembersPerChannel: 2,
    maxStorageMB: 512,
    maxAiImagesPerMonth: 0,
    maxAiTextPerMonth: 20,
    maxApiCallsPerMonth: 0,
    hasAutoSchedule: false,
    hasWebhooks: false,
    hasAdvancedReports: false,
    hasPrioritySupport: false,
    hasWhiteLabel: false,
    hasSmartFlow: false,
    hasBotUsageAnalytics: false,
    maxSmartFlowJobsPerMonth: 0,
}

export type PlanLimits = typeof FREE_PLAN_DEFAULTS & {
    planName: string
    planNameVi: string
    priceMonthly: number
    priceAnnual: number
    billingInterval: string
    status: string
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
    isInTrial: boolean
    trialEndsAt: Date | null
    daysLeftInTrial: number
}

/**
 * Days remaining in trial (0 if expired or no trial)
 */
export function getDaysLeftInTrial(trialEndsAt: Date | null | undefined): number {
    if (!trialEndsAt) return 0
    const diff = trialEndsAt.getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Get user's current plan limits.
 * - Active paid subscription → use that plan's limits
 * - 14-day trial active → apply Pro plan limits
 * - Otherwise → FREE defaults
 */
export async function getUserPlan(userId: string): Promise<PlanLimits> {
    const [sub, user] = await Promise.all([
        prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true },
        }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { trialEndsAt: true },
        }),
    ])

    const trialEndsAt = user?.trialEndsAt ?? null
    const daysLeftInTrial = getDaysLeftInTrial(trialEndsAt)
    const isInTrial = daysLeftInTrial > 0

    // ── Active paid subscription or Stripe-managed trial ──────────────────────
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
        const p = sub.plan
        const isStripeTrial = sub.status === 'trialing'

        // Bug fix: during trial, Stripe may set current_period_end = 0 (epoch).
        // Use trial_end (stored as trialEndsAt) as the effective period end instead.
        const effectivePeriodEnd = (() => {
            if (!sub.currentPeriodEnd) return sub.trialEndsAt ?? null
            const ts = new Date(sub.currentPeriodEnd).getTime()
            if (ts <= 0) return sub.trialEndsAt ?? null
            return sub.currentPeriodEnd
        })()

        return {
            planName: p.name,
            planNameVi: p.nameVi,
            priceMonthly: p.priceMonthly,
            priceAnnual: p.priceAnnual,
            billingInterval: sub.billingInterval,
            status: sub.status,
            currentPeriodEnd: effectivePeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            maxChannels: p.maxChannels,
            maxPostsPerMonth: p.maxPostsPerMonth,
            maxMembersPerChannel: p.maxMembersPerChannel,
            maxStorageMB: (p as any).maxStorageMB ?? 512,
            maxAiImagesPerMonth: (p as any).maxAiImagesPerMonth ?? 0,
            maxAiTextPerMonth: (p as any).maxAiTextPerMonth ?? 20,
            maxApiCallsPerMonth: (p as any).maxApiCallsPerMonth ?? 0,
            hasAutoSchedule: p.hasAutoSchedule,
            hasWebhooks: p.hasWebhooks,
            hasAdvancedReports: p.hasAdvancedReports,
            hasPrioritySupport: p.hasPrioritySupport,
            hasWhiteLabel: p.hasWhiteLabel,
            hasSmartFlow: !!(p as any).hasSmartFlow || ((p as any).maxSmartFlowJobsPerMonth !== 0),
            hasBotUsageAnalytics: !!(p as any).hasBotUsageAnalytics,
            maxSmartFlowJobsPerMonth: (p as any).maxSmartFlowJobsPerMonth ?? 0,
            isInTrial: isStripeTrial
                || daysLeftInTrial > 0
                || (!!sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() > Date.now()),
            trialEndsAt: sub.trialEndsAt ?? trialEndsAt,
            daysLeftInTrial: isStripeTrial || (!!sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() > Date.now())
                ? getDaysLeftInTrial(sub.trialEndsAt ?? trialEndsAt)
                : daysLeftInTrial,
        }
    }

    // ── Free trial active — apply trial plan limits ────────────────────────────
    if (isInTrial) {
        // Read trial plan config from SiteSettings
        const siteSettings = await (prisma as any).siteSettings.findUnique({ where: { id: 'default' } })
        const trialPlanId = siteSettings?.trialPlanId ?? null

        // Use configured trial plan, or fallback to first Pro plan
        const trialPlan = trialPlanId
            ? await prisma.plan.findUnique({ where: { id: trialPlanId } })
            : await prisma.plan.findFirst({ where: { name: 'Pro' } })

        if (trialPlan) {
            return {
                planName: `${trialPlan.name} (Trial)`,
                planNameVi: `${trialPlan.nameVi || trialPlan.name} (Dùng thử)`,
                priceMonthly: trialPlan.priceMonthly,
                priceAnnual: trialPlan.priceAnnual,
                billingInterval: 'monthly',
                status: 'trialing',
                currentPeriodEnd: trialEndsAt,
                cancelAtPeriodEnd: false,
                maxChannels: trialPlan.maxChannels,
                maxPostsPerMonth: trialPlan.maxPostsPerMonth,
                maxMembersPerChannel: trialPlan.maxMembersPerChannel,
                maxStorageMB: (trialPlan as any).maxStorageMB ?? 10240,
                maxAiImagesPerMonth: (trialPlan as any).maxAiImagesPerMonth ?? 50,
                maxAiTextPerMonth: (trialPlan as any).maxAiTextPerMonth ?? 100,
                maxApiCallsPerMonth: (trialPlan as any).maxApiCallsPerMonth ?? 0,
                hasAutoSchedule: trialPlan.hasAutoSchedule,
                hasWebhooks: trialPlan.hasWebhooks,
                hasAdvancedReports: trialPlan.hasAdvancedReports,
                hasPrioritySupport: trialPlan.hasPrioritySupport,
                hasWhiteLabel: trialPlan.hasWhiteLabel,
                hasSmartFlow: (trialPlan as any).hasSmartFlow ?? true,
                hasBotUsageAnalytics: (trialPlan as any).hasBotUsageAnalytics ?? true,
                maxSmartFlowJobsPerMonth: (trialPlan as any).maxSmartFlowJobsPerMonth ?? 10,
                isInTrial: true,
                trialEndsAt,
                daysLeftInTrial,
            }
        }
    }

    // ── Subscription exists but canceled/paused — show real plan, not Free ──
    if (sub?.plan) {
        const p = sub.plan
        const statusLabel = sub.status === 'canceled' ? ' (Canceled)' : sub.status === 'paused' ? ' (Paused)' : ''
        return {
            planName: p.name + statusLabel,
            planNameVi: (p.nameVi || p.name) + (sub.status === 'canceled' ? ' (Hủy)' : sub.status === 'paused' ? ' (Tạm dừng)' : ''),
            priceMonthly: p.priceMonthly,
            priceAnnual: p.priceAnnual,
            billingInterval: sub.billingInterval,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            maxChannels: p.maxChannels,
            maxPostsPerMonth: p.maxPostsPerMonth,
            maxMembersPerChannel: p.maxMembersPerChannel,
            maxStorageMB: (p as any).maxStorageMB ?? 512,
            maxAiImagesPerMonth: (p as any).maxAiImagesPerMonth ?? 0,
            maxAiTextPerMonth: (p as any).maxAiTextPerMonth ?? 20,
            maxApiCallsPerMonth: (p as any).maxApiCallsPerMonth ?? 0,
            hasAutoSchedule: p.hasAutoSchedule,
            hasWebhooks: p.hasWebhooks,
            hasAdvancedReports: p.hasAdvancedReports,
            hasPrioritySupport: p.hasPrioritySupport,
            hasWhiteLabel: p.hasWhiteLabel,
            hasSmartFlow: !!(p as any).hasSmartFlow || ((p as any).maxSmartFlowJobsPerMonth !== 0),
            hasBotUsageAnalytics: !!(p as any).hasBotUsageAnalytics,
            maxSmartFlowJobsPerMonth: (p as any).maxSmartFlowJobsPerMonth ?? 0,
            isInTrial: false,
            trialEndsAt,
            daysLeftInTrial: 0,
        }
    }

    // ── True free plan fallback (no subscription record at all) ─────────────
    return {
        ...FREE_PLAN_DEFAULTS,
        planName: 'Free',
        planNameVi: 'Miễn phí',
        priceMonthly: 0,
        priceAnnual: 0,
        billingInterval: 'monthly',
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        isInTrial: false,
        trialEndsAt,
        daysLeftInTrial: 0,
    }
}

/**
 * Get current month string: "2026-02"
 */
export function getCurrentMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get or create usage record for this month
 */
export async function getOrCreateUsage(subscriptionId: string) {
    const month = getCurrentMonth()
    return prisma.usage.upsert({
        where: { subscriptionId_month: { subscriptionId, month } },
        update: {},
        create: { subscriptionId, month, postsCreated: 0 },
    })
}
