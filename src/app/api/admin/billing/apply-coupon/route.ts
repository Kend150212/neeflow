import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/admin/billing/apply-coupon
 * Body: { subscriptionId, couponId }
 *
 * Admin-only. Applies a Stripe coupon to an existing subscription.
 * Webhook customer.discount.created will automatically update stripeCouponId in DB.
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    })
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { subscriptionId, couponId } = await req.json()

    if (!subscriptionId || !couponId) {
        return NextResponse.json({ error: 'subscriptionId and couponId are required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const sub = await db.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
            id: true,
            stripeSubscriptionId: true,
            stripeCustomerId: true,
            user: { select: { id: true, email: true, name: true } },
        },
    })

    if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

    try {
        if (sub.stripeSubscriptionId) {
            // Apply to Stripe subscription via discounts
            const stripe = await getStripe()
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                discounts: [{ coupon: couponId }] as any,
            })
        }

        // Also update DB directly (webhook may lag)
        await db.subscription.update({
            where: { id: subscriptionId },
            data: { stripeCouponId: couponId },
        })

        return NextResponse.json({
            success: true,
            message: `Coupon ${couponId} applied to ${sub.user.email}`,
        })
    } catch (err) {
        console.error('[Admin Apply Coupon] Stripe error:', err)
        const msg = err instanceof Error ? err.message : 'Failed to apply coupon'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
