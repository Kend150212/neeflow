import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPlan, getCurrentMonth } from '@/lib/plans'
import { getEffectiveLimits, getUserActiveAddons } from '@/lib/addon-resolver'

/**
 * GET /api/billing — current user's plan, subscription, usage
 */
export async function GET(_req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const plan = await getUserPlan(userId)

    // Get usage this month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const sub = await db.subscription.findUnique({
        where: { userId },
        include: { plan: true },
    })

    const month = getCurrentMonth()
    let postsThisMonth = 0
    let imagesThisMonth = 0
    let smartFlowJobsThisMonth = 0

    if (sub) {
        const usage = await db.usage.findUnique({
            where: { subscriptionId_month: { subscriptionId: sub.id, month } },
        })
        postsThisMonth = usage?.postsCreated ?? 0
        imagesThisMonth = usage?.imagesGenerated ?? 0
        smartFlowJobsThisMonth = usage?.smartFlowJobs ?? 0
    } else {
        const startOfMonth = new Date(`${month}-01T00:00:00.000Z`)
        postsThisMonth = await prisma.post.count({
            where: { authorId: userId, createdAt: { gte: startOfMonth } },
        })
    }

    // Count channels
    const channelCount = await prisma.channelMember.count({
        where: { userId, role: { in: ['ADMIN', 'OWNER'] } },
    })

    // Check BYOK — does user have any image provider key configured?
    const byokKey = await prisma.userApiKey.findFirst({
        where: { userId, provider: { in: ['runware', 'openai', 'gemini'] } },
        select: { provider: true },
    })

    // API calls this month
    let apiCallsThisMonth = 0
    if (sub) {
        const usageRecord = await db.usage.findUnique({
            where: { subscriptionId_month: { subscriptionId: sub.id, month } },
        })
        apiCallsThisMonth = usageRecord?.apiCalls ?? 0
    }

    // Get active add-ons and effective limits
    let activeAddons: { addon: { id: string; displayName: string; displayNameVi: string; category: string; quotaField: string | null; quotaAmount: number; featureField: string | null; icon: string; priceMonthly: number }; quantity: number }[] = []
    let effectiveLimits = null
    try {
        const [addons, limits] = await Promise.all([
            getUserActiveAddons(userId),
            getEffectiveLimits(userId),
        ])
        activeAddons = addons
        effectiveLimits = limits
    } catch {
        // Add-on tables may not exist yet
    }

    return NextResponse.json({
        plan,
        subscription: sub
            ? {
                id: sub.id,
                status: sub.status,
                billingInterval: sub.billingInterval,
                currentPeriodEnd: sub.currentPeriodEnd,
                cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                hasStripeSubscription: !!sub.stripeSubscriptionId,
            }
            : null,
        usage: {
            postsThisMonth,
            channelCount,
            month,
            imagesThisMonth,
            apiCallsThisMonth,
            smartFlowJobsThisMonth,
        },
        aiImage: {
            hasByokKey: !!byokKey,
            byokProvider: byokKey?.provider ?? null,
            maxPerMonth: effectiveLimits?.maxAiImagesPerMonth ?? sub?.plan?.maxAiImagesPerMonth ?? 0,
        },
        smartFlow: {
            hasAccess: plan.hasSmartFlow,
            maxPerMonth: effectiveLimits?.maxSmartFlowJobsPerMonth ?? plan.maxSmartFlowJobsPerMonth,
            usedThisMonth: smartFlowJobsThisMonth,
            hasByokKey: !!byokKey,
        },
        activeAddons: activeAddons.map((sa: { addon: { id: string; displayName: string; displayNameVi: string; category: string; quotaField: string | null; quotaAmount: number; featureField: string | null; icon: string; priceMonthly: number }; quantity: number }) => ({
            id: sa.addon.id,
            displayName: sa.addon.displayName,
            displayNameVi: sa.addon.displayNameVi,
            category: sa.addon.category,
            quotaField: sa.addon.quotaField,
            quotaAmount: sa.addon.quotaAmount,
            featureField: sa.addon.featureField,
            icon: sa.addon.icon,
            priceMonthly: sa.addon.priceMonthly,
            quantity: sa.quantity,
        })),
        effectiveLimits,
    })
}
