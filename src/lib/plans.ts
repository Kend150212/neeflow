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

    // ── Active paid subscription ─────────────────────────────────────────────
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
        const p = sub.plan
        return {
            planName: p.name,
            planNameVi: p.nameVi,
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
            hasSmartFlow: (p as any).hasSmartFlow ?? false,
            maxSmartFlowJobsPerMonth: (p as any).maxSmartFlowJobsPerMonth ?? 0,
            isInTrial: false,
            trialEndsAt,
            daysLeftInTrial: 0,
        }
    }

    // ── Free trial active — apply Pro limits ─────────────────────────────────
    if (isInTrial) {
        const proPlan = await prisma.plan.findFirst({ where: { name: 'Pro' } })
        if (proPlan) {
            return {
                planName: 'Pro',
                planNameVi: 'Pro (Dùng thử)',
                priceMonthly: proPlan.priceMonthly,
                priceAnnual: proPlan.priceAnnual,
                billingInterval: 'monthly',
                status: 'trialing',
                currentPeriodEnd: trialEndsAt,
                cancelAtPeriodEnd: false,
                maxChannels: proPlan.maxChannels,
                maxPostsPerMonth: proPlan.maxPostsPerMonth,
                maxMembersPerChannel: proPlan.maxMembersPerChannel,
                maxStorageMB: (proPlan as any).maxStorageMB ?? 10240,
                maxAiImagesPerMonth: (proPlan as any).maxAiImagesPerMonth ?? 50,
                maxAiTextPerMonth: (proPlan as any).maxAiTextPerMonth ?? 100,
                maxApiCallsPerMonth: (proPlan as any).maxApiCallsPerMonth ?? 0,
                hasAutoSchedule: proPlan.hasAutoSchedule,
                hasWebhooks: proPlan.hasWebhooks,
                hasAdvancedReports: proPlan.hasAdvancedReports,
                hasPrioritySupport: proPlan.hasPrioritySupport,
                hasWhiteLabel: proPlan.hasWhiteLabel,
                hasSmartFlow: (proPlan as any).hasSmartFlow ?? true,
                maxSmartFlowJobsPerMonth: (proPlan as any).maxSmartFlowJobsPerMonth ?? 10,
                isInTrial: true,
                trialEndsAt,
                daysLeftInTrial,
            }
        }
    }

    // ── Free plan fallback ───────────────────────────────────────────────────
    return {
        ...FREE_PLAN_DEFAULTS,
        planName: 'Free',
        planNameVi: 'Miễn phí',
        priceMonthly: 0,
        priceAnnual: 0,
        billingInterval: 'monthly',
        status: sub?.status ?? 'active',
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
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
