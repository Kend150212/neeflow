import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'

const APP_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/billing/checkout
 * Body: { planId, interval: 'monthly' | 'annual', couponCode? }
 *
 * Creates a Stripe Checkout session.
 * Auto-heals stale Price IDs (e.g., after switching Stripe keys test→live):
 *   - Validates price ID exists on current Stripe account
 *   - If invalid → recreates Product + Price on current account → saves to DB → proceeds
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    const body = await req.json()
    const { planId, interval = 'monthly', couponCode, guestEmail: rawGuestEmail } = body

    // Auth check: must be logged in OR provide a guest email
    const guestEmail = rawGuestEmail?.trim()?.toLowerCase() || null
    if (!session?.user?.id && !guestEmail) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!planId) {
        return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    let plan = await db.plan.findUnique({ where: { id: planId } })
    if (!plan || !plan.isActive) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const stripe = await getStripe()

    // ─── Auto-heal: ensure Price ID is valid for current Stripe account ───
    plan = await ensureValidStripePrices(stripe, db, plan)

    const priceId = interval === 'annual'
        ? plan.stripePriceIdAnnual
        : plan.stripePriceIdMonthly

    if (!priceId) {
        return NextResponse.json(
            { error: 'This plan has no Stripe price configured. Please contact support.', noStripePrice: true },
            { status: 400 }
        )
    }

    // ─── Resolve trial: per-plan first, fallback to global SiteSettings ───
    let trialDays = 0
    if (plan.trialEnabled && plan.trialDays > 0) {
        trialDays = plan.trialDays
    } else {
        try {
            const settings = await db.siteSettings.findUnique({ where: { id: 'default' } })
            if (settings?.trialEnabled && settings?.trialDays > 0) {
                trialDays = settings.trialDays
            }
        } catch { /* ignore */ }
    }

    // ─── Resolve Stripe customer ──────────────────────────────────────────────
    let stripeCustomerId: string | undefined

    if (session?.user?.id) {
        // Logged-in user: look up their existing Stripe customer
        const existingSub = await db.subscription.findUnique({
            where: { userId: session.user.id },
            select: { stripeCustomerId: true },
        })
        if (existingSub?.stripeCustomerId) {
            stripeCustomerId = existingSub.stripeCustomerId
        } else {
            const customer = await stripe.customers.create({
                email: session.user.email ?? undefined,
                name: session.user.name ?? undefined,
                metadata: { userId: session.user.id },
            })
            stripeCustomerId = customer.id
        }
    } else {
        // Guest user: find or create customer by email
        const existing = await stripe.customers.list({ email: guestEmail!, limit: 1 })
        if (existing.data.length > 0) {
            stripeCustomerId = existing.data[0].id
        } else {
            const customer = await stripe.customers.create({
                email: guestEmail!,
                metadata: { guestEmail: guestEmail! },
            })
            stripeCustomerId = customer.id
        }
    }

    // Resolve coupon
    let discounts: Stripe.Checkout.SessionCreateParams['discounts'] | undefined
    if (couponCode) {
        try {
            const coupon = await stripe.coupons.retrieve(couponCode)
            if (coupon.valid) {
                discounts = [{ coupon: coupon.id }]
            }
        } catch {
            return NextResponse.json({ error: 'Invalid coupon code', errorVi: 'Mã giảm giá không hợp lệ' }, { status: 400 })
        }
    }

    // ─── Build checkout session ───────────────────────────────────────────────
    const isGuest = !session?.user?.id
    const successUrl = isGuest
        ? `${APP_URL}/register/complete?session_id={CHECKOUT_SESSION_ID}`
        : `${APP_URL}/dashboard/billing?success=1`

    const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        ...(discounts ? { discounts } : {}),
        success_url: successUrl,
        cancel_url: `${APP_URL}/pricing?canceled=1`,
        metadata: {
            ...(session?.user?.id ? { userId: session.user.id } : { guestEmail: guestEmail! }),
            planId,
            interval,
        },
        subscription_data: {
            metadata: {
                ...(session?.user?.id ? { userId: session.user.id } : { guestEmail: guestEmail! }),
                planId,
            },
            ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        },
    })

    return NextResponse.json({ url: checkoutSession.url })
}

/**
 * Validates existing Stripe Product + Price IDs against the current Stripe account.
 * If any are stale (wrong account / deleted), recreates them and updates the DB.
 * Returns the updated plan object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureValidStripePrices(stripe: Stripe, db: any, plan: any) {
    const updates: Record<string, string | null> = {}

    // 1. Validate / recreate product
    let productId: string | null = plan.stripeProductId || null
    const productValid = productId && await stripeProductExists(stripe, productId)

    if (!productValid && (plan.priceMonthly > 0 || plan.priceAnnual > 0)) {
        try {
            const product = await stripe.products.create({
                name: plan.name,
                description: plan.description || undefined,
                metadata: { source: 'neeflow-auto-heal', planId: plan.id },
            })
            productId = product.id
            updates.stripeProductId = productId
            // Force recreate prices since product is new
            updates.stripePriceIdMonthly = null
            updates.stripePriceIdAnnual = null
            console.log(`[Stripe Auto-Heal] Recreated product for plan "${plan.name}": ${productId}`)
        } catch (err) {
            console.error(`[Stripe Auto-Heal] Failed to recreate product for plan "${plan.name}":`, err)
            return plan // Return unchanged if heal fails
        }
    }

    // 2. Validate / recreate monthly price
    const curMonthly = updates.stripePriceIdMonthly !== undefined ? updates.stripePriceIdMonthly : plan.stripePriceIdMonthly
    if (plan.priceMonthly > 0 && productId) {
        const monthlyValid = curMonthly && await stripePriceExists(stripe, curMonthly, productId)
        if (!monthlyValid) {
            try {
                const mp = await stripe.prices.create({
                    product: productId,
                    unit_amount: Math.round(plan.priceMonthly * 100),
                    currency: 'usd',
                    recurring: {
                        interval: 'month',
                        ...(plan.trialEnabled && plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
                    },
                    metadata: { planName: plan.name, interval: 'monthly' },
                })
                updates.stripePriceIdMonthly = mp.id
                console.log(`[Stripe Auto-Heal] Recreated monthly price for plan "${plan.name}": ${mp.id}`)
            } catch (err) {
                console.error(`[Stripe Auto-Heal] Failed to recreate monthly price for plan "${plan.name}":`, err)
            }
        }
    }

    // 3. Validate / recreate annual price
    const curAnnual = updates.stripePriceIdAnnual !== undefined ? updates.stripePriceIdAnnual : plan.stripePriceIdAnnual
    if (plan.priceAnnual > 0 && productId) {
        const annualValid = curAnnual && await stripePriceExists(stripe, curAnnual, productId)
        if (!annualValid) {
            try {
                const ap = await stripe.prices.create({
                    product: productId,
                    unit_amount: Math.round(plan.priceAnnual * 100),
                    currency: 'usd',
                    recurring: {
                        interval: 'year',
                        ...(plan.trialEnabled && plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
                    },
                    metadata: { planName: plan.name, interval: 'annual' },
                })
                updates.stripePriceIdAnnual = ap.id
                console.log(`[Stripe Auto-Heal] Recreated annual price for plan "${plan.name}": ${ap.id}`)
            } catch (err) {
                console.error(`[Stripe Auto-Heal] Failed to recreate annual price for plan "${plan.name}":`, err)
            }
        }
    }

    // 4. Persist any updates to DB
    if (Object.keys(updates).length > 0) {
        const updated = await db.plan.update({ where: { id: plan.id }, data: updates })
        return updated
    }

    return plan
}

async function stripeProductExists(stripe: Stripe, productId: string): Promise<boolean> {
    try {
        const p = await stripe.products.retrieve(productId)
        return !p.deleted
    } catch { return false }
}

async function stripePriceExists(stripe: Stripe, priceId: string, expectedProductId: string): Promise<boolean> {
    try {
        const p = await stripe.prices.retrieve(priceId)
        return p.active && p.product === expectedProductId
    } catch { return false }
}
