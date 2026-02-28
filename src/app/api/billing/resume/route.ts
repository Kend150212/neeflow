import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * POST /api/billing/resume
 * Resumes a subscription that was scheduled to cancel at period end.
 * (Undoes the cancel_at_period_end flag)
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
        return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    if (!sub.cancelAtPeriodEnd) {
        return NextResponse.json({ error: 'Subscription is not scheduled for cancellation' }, { status: 400 })
    }

    // Update Stripe
    if (sub.stripeSubscriptionId) {
        try {
            const stripe = await getStripe()
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                cancel_at_period_end: false,
            })
        } catch (err: unknown) {
            const stripeErr = err as { message?: string }
            console.error('[Resume] Stripe error:', err)
            return NextResponse.json(
                { error: stripeErr.message || 'Failed to resume Stripe subscription' },
                { status: 400 }
            )
        }
    }

    // Update DB
    await db.subscription.update({
        where: { id: sub.id },
        data: { cancelAtPeriodEnd: false },
    })

    return NextResponse.json({
        success: true,
        message: 'Subscription resumed. You will continue to be billed normally.',
    })
}
