import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/billing
 * Returns full billing overview: subscriptions (with coupon, trial, cancel info),
 * MRR history, plan breakdown, and trial stats.
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

    // ─── Subscriptions ────────────────────────────────────────────────────────
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

    // ─── MRR History (last 6 months) ─────────────────────────────────────────
    const now = new Date()
    const mrrHistory = []
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
        const monthSubs = subs.filter((s: { status: string; createdAt: string | Date; billingInterval: string; plan: { priceMonthly: number; priceAnnual: number } }) =>
            s.status === 'active' && new Date(s.createdAt) <= d
        )
        const mrr = monthSubs.reduce((sum: number, s: { billingInterval: string; plan: { priceMonthly: number; priceAnnual: number } }) => {
            const price = s.billingInterval === 'annual' ? s.plan.priceAnnual / 12 : s.plan.priceMonthly
            return sum + price
        }, 0)
        mrrHistory.push({ month: label, mrr: Math.round(mrr), subs: monthSubs.length })
    }

    // ─── Plan Breakdown ───────────────────────────────────────────────────────
    const planMap: Record<string, number> = {}
    for (const s of subs) {
        if (s.status === 'active' || s.status === 'trialing') {
            planMap[s.plan.name] = (planMap[s.plan.name] ?? 0) + 1
        }
    }
    const planBreakdown = Object.entries(planMap).map(([name, count]) => ({ name, count }))

    // ─── Trial Stats ──────────────────────────────────────────────────────────
    const now2 = new Date()
    const allWithTrial = subs.filter((s: { user: { trialEndsAt: string | Date | null } }) => s.user.trialEndsAt)
    const activeTrial = allWithTrial.filter((s: { user: { trialEndsAt: string | Date | null }; status: string }) =>
        s.user.trialEndsAt && new Date(s.user.trialEndsAt) > now2 && s.status === 'trialing'
    )
    const expiredTrial = allWithTrial.filter((s: { user: { trialEndsAt: string | Date | null }; status: string }) =>
        s.user.trialEndsAt && new Date(s.user.trialEndsAt) <= now2 && s.status !== 'active'
    )
    const converted = allWithTrial.filter((s: { user: { trialEndsAt: string | Date | null }; status: string }) =>
        s.status === 'active'
    )
    const total = allWithTrial.length
    const conversionRate = total > 0 ? Math.round((converted.length / total) * 100) : 0

    return NextResponse.json({
        subs,
        mrrHistory,
        planBreakdown,
        trialStats: {
            active: activeTrial.length,
            expired: expiredTrial.length,
            converted: converted.length,
            conversionRate,
        },
    })
}
