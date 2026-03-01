import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/billing
 * Returns full billing overview: subscriptions (with coupon, trial, cancel info),
 * MRR history, plan breakdown, and trial stats.
 *
 * Internal/test accounts (isInternal=true) are included in the subs list
 * but EXCLUDED from MRR, plan distribution, and trial stats counts.
 */
export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    })
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    // ─── Subscriptions (ALL – including internal, shown in table) ────────────
    const subs = await db.subscription.findMany({
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    role: true,
                    trialEndsAt: true,
                    createdAt: true,
                },
            },
            plan: {
                select: {
                    id: true,
                    name: true,
                    priceMonthly: true,
                    priceAnnual: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    })

    // Fix: correct epoch-0 currentPeriodEnd and expose sub.trialEndsAt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subsFixed = subs.map((s: any) => {
        const rawEnd = s.currentPeriodEnd
        // Use sub.trialEndsAt (from Stripe) first, then user.trialEndsAt as effective trial date
        const effectiveTrialEnd = s.trialEndsAt ?? s.user.trialEndsAt ?? null
        const effectivePeriodEnd = (!rawEnd || new Date(rawEnd).getTime() <= 0)
            ? effectiveTrialEnd
            : rawEnd
        return {
            ...s,
            currentPeriodEnd: effectivePeriodEnd,
            // Expose unified trial end for UI
            trialEndsAt: effectiveTrialEnd,
        }
    })

    // Reporting subs = exclude internal/test accounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reportingSubs = subsFixed.filter((s: any) => !s.isInternal)

    // ─── MRR History (last 6 months) — reporting only ────────────────────────
    const now = new Date()
    const mrrHistory = []
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monthSubs = reportingSubs.filter((s: any) =>
            s.status === 'active' && new Date(s.createdAt) <= d
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mrr = monthSubs.reduce((sum: number, s: any) => {
            const price = s.billingInterval === 'annual' ? s.plan.priceAnnual / 12 : s.plan.priceMonthly
            return sum + price
        }, 0)
        mrrHistory.push({ month: label, mrr: Math.round(mrr), subs: monthSubs.length })
    }

    // ─── Plan Breakdown — reporting only ─────────────────────────────────────
    const planMap: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of reportingSubs as any[]) {
        if (s.status === 'active' || s.status === 'trialing') {
            planMap[s.plan.name] = (planMap[s.plan.name] ?? 0) + 1
        }
    }
    const planBreakdown = Object.entries(planMap).map(([name, count]) => ({ name, count }))

    // ─── MRR Summary (current) ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeSubs = reportingSubs.filter((s: any) => s.status === 'active')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentMrr = activeSubs.reduce((sum: number, s: any) => {
        const price = s.billingInterval === 'annual' ? s.plan.priceAnnual / 12 : s.plan.priceMonthly
        return sum + price
    }, 0)

    // ─── Trial Stats — reporting only ────────────────────────────────────────
    // A "trial" account is one that has trialEndsAt set (from Stripe trial_end or user.trialEndsAt)
    const now2 = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allWithTrial = reportingSubs.filter((s: any) => s.trialEndsAt)

    // Active trial: trialEndsAt still in the future AND status is trialing or active-with-trial
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeTrial = allWithTrial.filter((s: any) => {
        const trialEnd = s.trialEndsAt ? new Date(s.trialEndsAt) : null
        if (!trialEnd) return false
        const trialStillActive = trialEnd > now2
        return trialStillActive && (s.status === 'trialing' || s.status === 'active')
    })

    // Expired trial: trialEndsAt is in the past AND never converted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expiredTrial = allWithTrial.filter((s: any) => {
        const trialEnd = s.trialEndsAt ? new Date(s.trialEndsAt) : null
        if (!trialEnd) return false
        return trialEnd <= now2 && s.status !== 'active'
    })

    // Converted: had trial AND now active (and trial has ended or is still pending charge)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const converted = allWithTrial.filter((s: any) => {
        const trialEnd = s.trialEndsAt ? new Date(s.trialEndsAt) : null
        if (!trialEnd) return false
        return s.status === 'active' && trialEnd <= now2
    })

    const total = allWithTrial.length
    const conversionRate = total > 0 ? Math.round((converted.length / total) * 100) : 0

    // Count of internal subs (for display in table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalCount = subs.filter((s: any) => s.isInternal).length

    return NextResponse.json({
        subs: subsFixed,
        mrrHistory,
        planBreakdown,
        currentMrr: Math.round(currentMrr),
        internalCount,
        trialStats: {
            active: activeTrial.length,
            expired: expiredTrial.length,
            converted: converted.length,
            conversionRate,
        },
    })
}
