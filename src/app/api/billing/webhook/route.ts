import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * POST /api/billing/webhook
 *
 * ALL Stripe events handled here. Register these in Stripe Dashboard:
 *
 * Subscription:
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   customer.subscription.paused
 *   customer.subscription.resumed
 *   customer.subscription.trial_will_end
 *
 * Checkout:
 *   checkout.session.completed
 *   checkout.session.expired
 *
 * Invoice:
 *   invoice.created
 *   invoice.finalized
 *   invoice.paid
 *   invoice.payment_succeeded
 *   invoice.payment_failed
 *   invoice.payment_action_required
 *   invoice.voided
 *   invoice.marked_uncollectible
 *   invoice.upcoming
 *
 * Charge / Refund / Dispute:
 *   charge.refunded
 *   charge.dispute.created
 *   charge.dispute.closed
 *
 * Customer:
 *   customer.deleted
 */
export async function POST(req: NextRequest) {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature') ?? ''

    const webhookSecret = await getStripeWebhookSecret()
    if (!webhookSecret) {
        console.error('[Webhook] No webhook secret configured')
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    let event: Stripe.Event
    try {
        const stripe = await getStripe()
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
        console.error('[Webhook] Invalid signature:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    try {
        await dispatchEvent(event)
    } catch (err) {
        console.error(`[Webhook] Unhandled error for ${event.type}:`, err)
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

async function dispatchEvent(event: Stripe.Event) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = event.data.object as any

    switch (event.type) {

        // ══════════════════════════════════════════════════════
        // CHECKOUT
        // ══════════════════════════════════════════════════════
        case 'checkout.session.completed':
            await onCheckoutCompleted(obj as Stripe.Checkout.Session)
            break

        case 'checkout.session.expired':
            // Nothing to do — just log
            console.log(`[Webhook] checkout.session.expired — session ${obj.id}`)
            break

        // ══════════════════════════════════════════════════════
        // SUBSCRIPTION LIFECYCLE
        // ══════════════════════════════════════════════════════
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.resumed':
            await onSubscriptionUpdated(obj)
            break

        case 'customer.subscription.deleted':
            await onSubscriptionDeleted(obj)
            break

        case 'customer.subscription.paused':
            await onSubscriptionPaused(obj)
            break

        case 'customer.subscription.trial_will_end':
            await onTrialWillEnd(obj)
            break

        // ══════════════════════════════════════════════════════
        // INVOICE
        // ══════════════════════════════════════════════════════
        case 'invoice.created':
            // Stripe auto-creates draft invoices. Log but don't act.
            console.log(`[Webhook] invoice.created — ${obj.id}, customer ${obj.customer}`)
            break

        case 'invoice.finalized':
            // Invoice is finalized (ready to be paid). Log.
            console.log(`[Webhook] invoice.finalized — ${obj.id}, amount ${obj.amount_due}`)
            break

        case 'invoice.upcoming':
            // Sent 3 days before next billing — good for "upcoming charge" email
            console.log(`[Webhook] invoice.upcoming — customer ${obj.customer}, due ${obj.amount_due}`)
            // TODO: send "upcoming charge" email notification
            break

        case 'invoice.paid':
        case 'invoice.payment_succeeded':
            await onInvoicePaid(obj as Stripe.Invoice)
            break

        case 'invoice.payment_failed':
            await onPaymentFailed(obj as Stripe.Invoice)
            break

        case 'invoice.payment_action_required':
            // Customer needs to complete 3D Secure
            await onPaymentActionRequired(obj as Stripe.Invoice)
            break

        case 'invoice.voided':
        case 'invoice.marked_uncollectible':
            await onInvoiceVoidedOrUncollectible(obj as Stripe.Invoice)
            break

        // ══════════════════════════════════════════════════════
        // CHARGE / REFUND / DISPUTE
        // ══════════════════════════════════════════════════════
        case 'charge.refunded':
            await onChargeRefunded(obj as Stripe.Charge)
            break

        case 'charge.dispute.created':
            await onDisputeCreated(obj as Stripe.Dispute)
            break

        case 'charge.dispute.closed':
            await onDisputeClosed(obj as Stripe.Dispute)
            break

        // ══════════════════════════════════════════════════════
        // CUSTOMER
        // ══════════════════════════════════════════════════════
        case 'customer.deleted':
            await onCustomerDeleted(obj as Stripe.Customer)
            break

        default:
            // Unknown event — acknowledged but not processed
            break
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Checkout ──────────────────────────────────────────────────────────────────

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId
    const planId = session.metadata?.planId
    const interval = session.metadata?.interval ?? 'monthly'

    if (!userId || !planId) {
        console.error('[Webhook] checkout.session.completed — missing metadata', session.id)
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
            planId, stripeCustomerId, stripeSubscriptionId: stripeSubId,
            stripeCouponId: couponId, billingInterval: interval,
            status: stripeSub.status,
            trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
            currentPeriodEnd: new Date(periodEnd * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        },
        create: {
            userId, planId, stripeCustomerId, stripeSubscriptionId: stripeSubId,
            stripeCouponId: couponId, billingInterval: interval,
            status: stripeSub.status,
            trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : null,
            currentPeriodEnd: new Date(periodEnd * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        },
    })

    // Sync subscription items (addons)
    await syncSubscriptionItems(stripeSub, db)

    console.log(`[Webhook] ✅ checkout.session.completed — user ${userId}, plan ${planId}, status ${stripeSub.status}`)
}

// ── Subscription ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onSubscriptionUpdated(stripeSub: any) {
    const userId = stripeSub.metadata?.userId
    if (!userId) return

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

    // Sync addon items on update
    await syncSubscriptionItems(stripeSub, db)

    console.log(`[Webhook] 🔄 subscription.updated — user ${userId}, status ${stripeSub.status}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onSubscriptionDeleted(stripeSub: any) {
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

    // Cancel all subscription addons
    await db.subscriptionAddon.updateMany({
        where: { subscription: { userId } },
        data: { status: 'canceled' },
    })

    console.log(`[Webhook] ❌ subscription.deleted — user ${userId} → Free plan`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onSubscriptionPaused(stripeSub: any) {
    const userId = stripeSub.metadata?.userId
    if (!userId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    await db.subscription.updateMany({
        where: { userId },
        data: { status: 'paused' },
    })

    console.log(`[Webhook] ⏸ subscription.paused — user ${userId}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onTrialWillEnd(stripeSub: any) {
    const userId = stripeSub.metadata?.userId
    const trialEnd = stripeSub.trial_end
    if (!userId || !trialEnd) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    await db.subscription.updateMany({
        where: { userId },
        data: { trialEndsAt: new Date(trialEnd * 1000) },
    })

    // TODO: send "trial ending soon" email
    console.log(`[Webhook] ⏰ trial_will_end — user ${userId}, ends at ${new Date(trialEnd * 1000).toISOString()}`)
}

// ── Invoice ───────────────────────────────────────────────────────────────────

async function onInvoicePaid(invoice: Stripe.Invoice) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = invoice as any
    const customerId = invoice.customer as string
    const subId = inv.subscription as string | null

    if (!customerId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    if (subId) {
        try {
            const stripe = await getStripe()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stripeSub = await stripe.subscriptions.retrieve(subId) as any
            await db.subscription.updateMany({
                where: { stripeCustomerId: customerId },
                data: {
                    status: 'active',
                    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                    trialEndsAt: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
                },
            })
        } catch { /* ignore */ }
    } else {
        // One-time invoice (manual/custom plan)
        await db.subscription.updateMany({
            where: { stripeCustomerId: customerId },
            data: { status: 'active' },
        })
    }

    console.log(`[Webhook] 💰 invoice.paid — customer ${customerId}, amount ${inv.amount_paid}`)
}

async function onPaymentFailed(invoice: Stripe.Invoice) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = invoice as any
    const customerId = invoice.customer as string
    if (!customerId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    await db.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: { status: 'past_due' },
    })

    // TODO: send "payment failed" email with retry link
    console.log(`[Webhook] ⚠️ invoice.payment_failed — customer ${customerId}, amount ${inv.amount_due}`)
}

async function onPaymentActionRequired(invoice: Stripe.Invoice) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = invoice as any
    const customerId = invoice.customer as string
    if (!customerId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    await db.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: { status: 'past_due' },
    })

    // TODO: send "action required" (3D Secure) email
    console.log(`[Webhook] 🔐 invoice.payment_action_required — customer ${customerId}, amount ${inv.amount_due}`)
}

async function onInvoiceVoidedOrUncollectible(invoice: Stripe.Invoice) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = invoice as any
    const customerId = invoice.customer as string
    if (!customerId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    await db.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: { status: 'past_due' },
    })

    console.log(`[Webhook] 🚫 invoice voided/uncollectible — customer ${customerId}, invoice ${inv.id}`)
}

// ── Charge / Refund / Dispute ─────────────────────────────────────────────────

async function onChargeRefunded(charge: Stripe.Charge) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = charge as any
    const customerId = charge.customer as string
    if (!customerId) return

    // Find subscription and check if fully refunded → cancel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const sub = await db.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true, status: true },
    })

    if (sub && ch.refunded) {
        // Full refund — mark as canceled
        await db.subscription.updateMany({
            where: { stripeCustomerId: customerId },
            data: { status: 'canceled' },
        })
        console.log(`[Webhook] 💸 charge.refunded (full) — customer ${customerId}, amount ${ch.amount_refunded}`)
    } else {
        // Partial refund — just log
        console.log(`[Webhook] 💸 charge.refunded (partial) — customer ${customerId}, refunded ${ch.amount_refunded} of ${ch.amount}`)
    }

    // TODO: send refund confirmation email
}

async function onDisputeCreated(dispute: Stripe.Dispute) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dp = dispute as any
    const chargeId = dp.charge as string

    // Find the customer via the charge
    try {
        const stripe = await getStripe()
        const charge = await stripe.charges.retrieve(chargeId)
        const customerId = charge.customer as string

        if (customerId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = prisma as any
            await db.subscription.updateMany({
                where: { stripeCustomerId: customerId },
                data: { status: 'past_due' }, // Freeze until dispute resolves
            })
        }
    } catch { /* ignore */ }

    // TODO: alert admin via email/Slack
    console.log(`[Webhook] 🚨 charge.dispute.created — dispute ${dp.id}, amount ${dp.amount}, reason ${dp.reason}`)
}

async function onDisputeClosed(dispute: Stripe.Dispute) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dp = dispute as any

    if (dp.status === 'won') {
        // Dispute won — restore subscription
        try {
            const stripe = await getStripe()
            const charge = await stripe.charges.retrieve(dp.charge as string)
            const customerId = charge.customer as string
            if (customerId) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const db = prisma as any
                await db.subscription.updateMany({
                    where: { stripeCustomerId: customerId },
                    data: { status: 'active' },
                })
            }
        } catch { /* ignore */ }
        console.log(`[Webhook] ✅ charge.dispute.closed (won) — dispute ${dp.id}`)
    } else {
        // Lost or other — keep as past_due/canceled
        console.log(`[Webhook] ❌ charge.dispute.closed (${dp.status}) — dispute ${dp.id}`)
    }
}

// ── Customer ──────────────────────────────────────────────────────────────────

async function onCustomerDeleted(customer: Stripe.Customer) {
    const customerId = customer.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const freePlan = await db.plan.findFirst({
        where: { priceMonthly: 0 },
        orderBy: { sortOrder: 'asc' },
    })

    await db.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
            planId: freePlan?.id ?? undefined,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            stripeCouponId: null,
            status: 'canceled',
        },
    })

    console.log(`[Webhook] 🗑 customer.deleted — ${customerId}`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Syncs subscription items (addons) from Stripe to our DB.
 * Each Stripe subscription item that corresponds to an addon
 * is tracked via the SubscriptionAddon table.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncSubscriptionItems(stripeSub: any, db: any) {
    const userId = stripeSub.metadata?.userId
    if (!userId) return

    try {
        const sub = await db.subscription.findUnique({
            where: { userId },
            select: { id: true },
        })
        if (!sub) return

        const items: Array<{ price: { id: string }; id: string }> = stripeSub.items?.data ?? []

        for (const item of items) {
            const priceId = item.price?.id
            if (!priceId) continue

            // Check if this price belongs to an addon (not a plan)
            const addon = await db.addon.findFirst({
                where: { OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdAnnual: priceId }] },
                select: { id: true },
            })
            if (!addon) continue // It's the main plan price, skip

            await db.subscriptionAddon.upsert({
                where: { subscriptionId_addonId: { subscriptionId: sub.id, addonId: addon.id } },
                update: {
                    stripeSubscriptionItemId: item.id,
                    status: 'active',
                },
                create: {
                    subscriptionId: sub.id,
                    addonId: addon.id,
                    stripeSubscriptionItemId: item.id,
                    status: 'active',
                    quantity: 1,
                },
            })
        }
    } catch (err) {
        console.error('[Webhook] syncSubscriptionItems failed:', err)
    }
}
