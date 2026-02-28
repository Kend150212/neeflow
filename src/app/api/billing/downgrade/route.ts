import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * POST /api/billing/downgrade
 * Body: { planId, interval: 'monthly' | 'annual' }
 *
 * Switches the user's Stripe subscription to a lower plan at the end of the
 * current billing period (no proration). Updates the local DB immediately so
 * the UI reflects the pending change.
 *
 * Response:
 *   { ok: true, effectiveDate: ISO-string, newPrice: number, currency: string }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId, interval = 'monthly' } = await req.json()
    if (!planId) {
        return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    // Load target plan
    const plan = await db.plan.findUnique({ where: { id: planId } })
    if (!plan || !plan.isActive) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const newPriceId = interval === 'annual'
        ? plan.stripePriceIdAnnual
        : plan.stripePriceIdMonthly

    if (!newPriceId) {
        return NextResponse.json(
            { error: 'Stripe price not configured for this plan.', noStripePrice: true },
            { status: 400 }
        )
    }

    // Load current subscription
    const sub = await db.subscription.findUnique({
        where: { userId: session.user.id },
        select: {
            id: true,
            stripeSubscriptionId: true,
            stripeCustomerId: true,
            currentPeriodEnd: true,
        },
    })

    if (!sub?.stripeSubscriptionId) {
        // No Stripe sub — user is on a manual plan; update DB directly
        await db.subscription.update({
            where: { userId: session.user.id },
            data: {
                planId: plan.id,
                billingInterval: interval,
                status: 'active',
            },
        })
        return NextResponse.json({
            ok: true,
            manual: true,
            effectiveDate: null,
            newPrice: interval === 'annual' ? plan.priceAnnual : plan.priceMonthly,
            currency: 'usd',
        })
    }

    try {
        const stripe = await getStripe()

        // Retrieve the subscription to get current item ID
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)

        if (!stripeSub || stripeSub.status === 'canceled') {
            return NextResponse.json({ error: 'Stripe subscription not found or already canceled' }, { status: 400 })
        }

        const itemId = stripeSub.items.data[0]?.id
        if (!itemId) {
            return NextResponse.json({ error: 'No subscription item found' }, { status: 400 })
        }

        // Schedule the downgrade at period end — no proration
        const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            proration_behavior: 'none',
            billing_cycle_anchor: 'unchanged',
            items: [{ id: itemId, price: newPriceId }],
        })

        // The change takes effect immediately in Stripe (billed next cycle due to proration_behavior: none)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const effectiveDate = new Date((stripeSub as any).current_period_end * 1000).toISOString()

        // Update our DB to reflect the new plan immediately
        await db.subscription.update({
            where: { userId: session.user.id },
            data: {
                planId: plan.id,
                billingInterval: interval,
                // Keep status as-is; Stripe will handle the next billing
            },
        })

        return NextResponse.json({
            ok: true,
            effectiveDate,
            newPrice: interval === 'annual' ? plan.priceAnnual : plan.priceMonthly,
            newPlanName: plan.name,
            currency: (updated.currency ?? 'usd').toUpperCase(),
        })
    } catch (err: unknown) {
        const stripeErr = err as { message?: string }
        console.error('[Downgrade] Stripe error:', err)
        return NextResponse.json(
            { error: stripeErr.message || 'Failed to downgrade subscription' },
            { status: 500 }
        )
    }
}
