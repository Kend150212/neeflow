import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/admin/billing/grant-trial
 * Body: { subscriptionId, trialDays: number }
 *
 * Admin-only. Extends/grants trial for a user.
 * - If user has a Stripe subscription: updates trial_end on Stripe
 * - Always updates user.trialEndsAt in DB
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    })
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { subscriptionId, trialDays } = await req.json()

    if (!subscriptionId || !trialDays || trialDays <= 0) {
        return NextResponse.json({ error: 'subscriptionId and trialDays (>0) are required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const sub = await db.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
            id: true,
            stripeSubscriptionId: true,
            userId: true,
            user: { select: { id: true, email: true, name: true, trialEndsAt: true } },
        },
    })

    if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

    // Calculate new trial end: extend from today
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + Number(trialDays))
    const trialEndTimestamp = Math.floor(trialEnd.getTime() / 1000)

    try {
        if (sub.stripeSubscriptionId) {
            const stripe = await getStripe()
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                trial_end: trialEndTimestamp,
                // Don't prorate or charge for extending trial
                proration_behavior: 'none',
            })
        }

        // Update DB: user.trialEndsAt + subscription.trialEndsAt + status
        await db.user.update({
            where: { id: sub.userId },
            data: { trialEndsAt: trialEnd },
        })

        await db.subscription.update({
            where: { id: subscriptionId },
            data: {
                trialEndsAt: trialEnd,
                status: 'trialing',
            },
        })

        return NextResponse.json({
            success: true,
            trialEndsAt: trialEnd.toISOString(),
            message: `Trial extended to ${trialEnd.toLocaleDateString()} for ${sub.user.email}`,
        })
    } catch (err) {
        console.error('[Admin Grant Trial] Stripe error:', err)
        const msg = err instanceof Error ? err.message : 'Failed to grant trial'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
