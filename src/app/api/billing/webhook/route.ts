import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * POST /api/billing/webhook
 *
 * Stripe sends events here. Signature is verified before processing.
 *
 * Subscribed events (register ALL of these in Stripe Dashboard):
 *   checkout.session.completed          → activate subscription after payment
 *   customer.subscription.created       → record new subscription
 *   customer.subscription.updated       → plan change, trial end, cancel update
 *   customer.subscription.deleted       → downgrade to Free
 *   customer.subscription.trial_will_end → (3 days before) log/notify
 *   invoice.payment_succeeded           → renew period end
 *   invoice.payment_failed              → mark past_due
 *   invoice.paid                        → alias for payment_succeeded (Stripe sends both)
 */
export async function POST(req: NextRequest) {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature') ?? ''

    const webhookSecret = await getStripeWebhookSecret()
    if (!webhookSecret) {
        console.error('[BillingWebhook] No webhook secret configured')
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    let event: Stripe.Event
    try {
        const stripe = await getStripe()
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
        console.error('[BillingWebhook] Invalid signature:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    try {
        switch (event.type) {
            // ── Checkout ──────────────────────────────────────────────────────
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
                break

            // ── Subscription lifecycle ────────────────────────────────────────
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await handleSubscriptionUpdated(event.data.object as any)
                break

            case 'customer.subscription.deleted':
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await handleSubscriptionDeleted(event.data.object as any)
                break

            case 'customer.subscription.trial_will_end':
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await handleTrialWillEnd(event.data.object as any)
                break

            // ── Invoices ─────────────────────────────────────────────────────
            case 'invoice.paid':
            case 'invoice.payment_succeeded':
                await handleInvoicePaid(event.data.object as Stripe.Invoice)
                break

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice)
                break

            default:
                // Unhandled events — return 200 so Stripe doesn't retry
                break
        }
    } catch (err) {
        console.error(`[BillingWebhook] Error handling ${event.type}:`, err)
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}

// ─── Handlers ──────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId
    const planId = session.metadata?.planId
    const interval = session.metadata?.interval ?? 'monthly'

    if (!userId || !planId) {
        console.error('[BillingWebhook] Missing metadata:', session.id)
        return
    }

    const stripe = await getStripe()
    const stripeSubId = session.subscription as string
    const stripeCustomerId = session.customer as string

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubId) as any
    const periodEnd = stripeSub.current_period_end ?? 0
    const trialEnd = stripeSub.trial_end ?? null
    const couponId = (stripeSub.discounts as Array<{ coupon?: { id?: string } }>)?.[0]?.coupon?.id ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    await db.subscription.upsert({
        where: { userId },
        update: {
            planId,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubId,
            stripeCouponId: couponId,
            billingInterval: interval,
            status: stripeSub.status,
            trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
            currentPeriodEnd: new Date(periodEnd * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        },
        create: {
            userId,
            planId,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubId,
            stripeCouponId: couponId,
            billingInterval: interval,
            status: stripeSub.status,
            trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
            currentPeriodEnd: new Date(periodEnd * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        },
    })

    console.log(`[BillingWebhook] ✅ checkout.session.completed — user ${userId}, plan ${planId}, status ${stripeSub.status}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(stripeSub: any) {
    const userId = stripeSub.metadata?.userId
    if (!userId) {
        console.warn('[BillingWebhook] subscription.updated missing userId metadata')
        return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const priceId = stripeSub.items?.data?.[0]?.price?.id
    let planId: string | undefined
    let interval: string | undefined

    if (priceId) {
        const plan = await db.plan.findFirst({
            where: { OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdAnnual: priceId }] },
            select: { id: true, stripePriceIdAnnual: true },
        })
        if (plan) {
            planId = plan.id
            interval = plan.stripePriceIdAnnual === priceId ? 'annual' : 'monthly'
        }
    }

    const periodEnd = stripeSub.current_period_end ?? 0
    const trialEnd = stripeSub.trial_end ?? null
    const couponId = (stripeSub.discounts as Array<{ coupon?: { id?: string } }>)?.[0]?.coupon?.id ?? null

    await db.subscription.updateMany({
        where: { userId },
        data: {
            ...(planId && { planId }),
            ...(interval && { billingInterval: interval }),
            status: stripeSub.status,
            trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
            currentPeriodEnd: new Date(periodEnd * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            stripeCouponId: couponId,
        },
    })

    console.log(`[BillingWebhook] 🔄 subscription.updated — user ${userId}, status ${stripeSub.status}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionDeleted(stripeSub: any) {
    const userId = stripeSub.metadata?.userId
    if (!userId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const freePlan = await db.plan.findFirst({
        where: { priceMonthly: 0 },
        orderBy: { sortOrder: 'asc' },
    })

    const periodEnd = stripeSub.current_period_end ?? 0

    await db.subscription.updateMany({
        where: { userId },
        data: {
            planId: freePlan?.id ?? undefined,
            stripeSubscriptionId: null,
            stripeCouponId: null,
            trialEndsAt: null,
            status: 'canceled',
            currentPeriodEnd: new Date(periodEnd * 1000),
            cancelAtPeriodEnd: false,
        },
    })

    console.log(`[BillingWebhook] ❌ subscription.deleted — user ${userId} → Free plan`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTrialWillEnd(stripeSub: any) {
    const userId = stripeSub.metadata?.userId
    const trialEnd = stripeSub.trial_end

    if (!userId || !trialEnd) return

    // Log for now — hook for email notification later
    console.log(`[BillingWebhook] ⏰ trial_will_end — user ${userId}, trial ends ${new Date(trialEnd * 1000).toISOString()}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    await db.subscription.updateMany({
        where: { userId },
        data: { trialEndsAt: new Date(trialEnd * 1000) },
    })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = invoice as any
    const customerId = invoice.customer as string
    const subId = inv.subscription as string | null

    if (!customerId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    // Update period end from invoice subscription
    if (subId) {
        const stripe = await getStripe()
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stripeSub = await stripe.subscriptions.retrieve(subId) as any
            await db.subscription.updateMany({
                where: { stripeCustomerId: customerId },
                data: {
                    status: 'active',
                    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                },
            })
        } catch { /* ignore */ }
    } else {
        await db.subscription.updateMany({
            where: { stripeCustomerId: customerId },
            data: { status: 'active' },
        })
    }

    console.log(`[BillingWebhook] 💰 invoice.paid — customer ${customerId}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string
    if (!customerId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    await db.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: { status: 'past_due' },
    })

    console.log(`[BillingWebhook] ⚠️ invoice.payment_failed — customer ${customerId}`)
}
