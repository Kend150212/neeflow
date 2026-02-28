import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * POST /api/billing/cancel
 * Cancels the current user's subscription at period end.
 * User keeps access until currentPeriodEnd.
 *
 * Body: {} (no required fields)
 */
export async function POST(_req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sub = await db.subscription.findUnique({
        where: { userId: session.user.id },
    })

    if (!sub) {
        return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    if (sub.cancelAtPeriodEnd) {
        return NextResponse.json({ error: 'Subscription is already scheduled for cancellation' }, { status: 400 })
    }

    // Update Stripe if connected
    if (sub.stripeSubscriptionId) {
        try {
            const stripe = await getStripe()
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                cancel_at_period_end: true,
            })
        } catch (err: unknown) {
            const stripeErr = err as { message?: string }
            console.error('[Cancel] Stripe error:', err)
            return NextResponse.json(
                { error: stripeErr.message || 'Failed to cancel Stripe subscription' },
                { status: 400 }
            )
        }
    }

    // Update DB (webhook will also sync this, but update immediately for UI)
    await db.subscription.update({
        where: { id: sub.id },
        data: { cancelAtPeriodEnd: true },
    })

    return NextResponse.json({
        success: true,
        cancelAt: sub.currentPeriodEnd,
        message: 'Subscription will be canceled at the end of the current billing period.',
    })
}
