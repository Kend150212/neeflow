import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/admin/billing/cancel
 * Body: { subscriptionId, immediately: boolean }
 *
 * Admin-only. Cancels a subscription immediately or at period end.
 * - immediately = true  → stripe.subscriptions.cancel() + status = 'canceled'
 * - immediately = false → cancel_at_period_end = true + cancelAtPeriodEnd = true
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    })
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { subscriptionId, immediately = false } = await req.json()

    if (!subscriptionId) {
        return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const sub = await db.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
            id: true,
            stripeSubscriptionId: true,
            user: { select: { id: true, email: true, name: true } },
            plan: { select: { id: true } },
        },
    })

    if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

    try {
        if (sub.stripeSubscriptionId) {
            const stripe = await getStripe()

            if (immediately) {
                await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
            } else {
                await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                    cancel_at_period_end: true,
                })
            }
        }

        if (immediately) {
            // Downgrade to free plan
            const freePlan = await db.plan.findFirst({
                where: { priceMonthly: 0, isActive: true },
                select: { id: true },
                orderBy: { sortOrder: 'asc' },
            })
            await db.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'canceled',
                    cancelAtPeriodEnd: false,
                    stripeSubscriptionId: null,
                    planId: freePlan?.id ?? sub.plan.id,
                },
            })
        } else {
            await db.subscription.update({
                where: { id: subscriptionId },
                data: { cancelAtPeriodEnd: true },
            })
        }

        return NextResponse.json({
            success: true,
            message: immediately
                ? `Subscription canceled immediately for ${sub.user.email}`
                : `Subscription will cancel at period end for ${sub.user.email}`,
        })
    } catch (err) {
        console.error('[Admin Cancel] Stripe error:', err)
        const msg = err instanceof Error ? err.message : 'Failed to cancel subscription'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
