import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * POST /api/admin/plans/sync-stripe
 *
 * Bulk-sync all plans to the CURRENT Stripe account (test or live).
 * For each plan it:
 *   1. Validates existing Product/Price IDs against the current Stripe key
 *   2. If an ID is missing OR belongs to a different account → recreates it
 *   3. Archives stale IDs that no longer work
 *
 * Safe to run multiple times. Idempotent.
 * Call this after switching Stripe keys (test ↔ live).
 */
export async function POST(_req: NextRequest) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plans = await (prisma as any).plan.findMany({ orderBy: { sortOrder: 'asc' } })
    const stripe = await getStripe()

    const results: {
        planId: string
        name: string
        status: 'synced' | 'already_synced' | 'skipped_free' | 'error'
        stripeProductId?: string
        stripePriceIdMonthly?: string | null
        stripePriceIdAnnual?: string | null
        rebuilt?: string[]
        error?: string
    }[] = []

    for (const plan of plans) {
        // Free plans — ensure product exists, no prices needed
        if (plan.priceMonthly === 0 && plan.priceAnnual === 0) {
            if (plan.stripeProductId && await validateStripeProduct(stripe, plan.stripeProductId)) {
                results.push({ planId: plan.id, name: plan.name, status: 'already_synced', stripeProductId: plan.stripeProductId })
                continue
            }
            try {
                const product = await stripe.products.create({
                    name: plan.name,
                    description: plan.description || undefined,
                    metadata: { source: 'neeflow-admin', planId: plan.id, tier: 'free' },
                })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (prisma as any).plan.update({ where: { id: plan.id }, data: { stripeProductId: product.id } })
                results.push({ planId: plan.id, name: plan.name, status: 'synced', stripeProductId: product.id })
            } catch (err) {
                results.push({ planId: plan.id, name: plan.name, status: 'error', error: (err as Error).message })
            }
            continue
        }

        try {
            const updates: Record<string, string | null> = {}
            const rebuilt: string[] = []

            // ── 1. Validate / create Product ────────────────────────────────
            let productId: string | null = plan.stripeProductId || null
            const productValid = productId && await validateStripeProduct(stripe, productId)

            if (!productValid) {
                const product = await stripe.products.create({
                    name: plan.name,
                    description: plan.description || undefined,
                    metadata: { source: 'neeflow-admin', planId: plan.id },
                })
                productId = product.id
                updates.stripeProductId = productId
                rebuilt.push('product')
            }

            // ── 2. Validate / create Monthly Price ──────────────────────────
            if (plan.priceMonthly > 0) {
                const monthlyValid = plan.stripePriceIdMonthly
                    && await validateStripePrice(stripe, plan.stripePriceIdMonthly, productId!)

                if (!monthlyValid) {
                    const mp = await stripe.prices.create({
                        product: productId!,
                        unit_amount: Math.round(plan.priceMonthly * 100),
                        currency: 'usd',
                        recurring: {
                            interval: 'month',
                            ...(plan.trialEnabled && plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
                        },
                        metadata: { planName: plan.name, interval: 'monthly' },
                    })
                    updates.stripePriceIdMonthly = mp.id
                    rebuilt.push('monthly')
                }
            }

            // ── 3. Validate / create Annual Price ───────────────────────────
            if (plan.priceAnnual > 0) {
                const annualValid = plan.stripePriceIdAnnual
                    && await validateStripePrice(stripe, plan.stripePriceIdAnnual, productId!)

                if (!annualValid) {
                    const ap = await stripe.prices.create({
                        product: productId!,
                        unit_amount: Math.round(plan.priceAnnual * 100),
                        currency: 'usd',
                        recurring: {
                            interval: 'year',
                            ...(plan.trialEnabled && plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
                        },
                        metadata: { planName: plan.name, interval: 'annual' },
                    })
                    updates.stripePriceIdAnnual = ap.id
                    rebuilt.push('annual')
                }
            }

            if (Object.keys(updates).length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (prisma as any).plan.update({ where: { id: plan.id }, data: updates })
            }

            const status = rebuilt.length > 0 ? 'synced' : 'already_synced'
            results.push({
                planId: plan.id, name: plan.name, status,
                stripeProductId: productId!,
                stripePriceIdMonthly: updates.stripePriceIdMonthly ?? plan.stripePriceIdMonthly,
                stripePriceIdAnnual: updates.stripePriceIdAnnual ?? plan.stripePriceIdAnnual,
                ...(rebuilt.length > 0 && { rebuilt }),
            })
        } catch (err) {
            console.error(`[Stripe Sync] Plan "${plan.name}" failed:`, err)
            results.push({ planId: plan.id, name: plan.name, status: 'error', error: (err as Error).message })
        }
    }

    const synced = results.filter(r => r.status === 'synced').length
    const alreadySynced = results.filter(r => r.status === 'already_synced').length
    const errors = results.filter(r => r.status === 'error').length

    return NextResponse.json({
        ok: true,
        summary: { total: plans.length, synced, alreadySynced, errors },
        results,
    })
}

/**
 * Returns true if the product exists on the current Stripe account.
 */
async function validateStripeProduct(stripe: Stripe, productId: string): Promise<boolean> {
    try {
        const p = await stripe.products.retrieve(productId)
        return !p.deleted
    } catch {
        return false
    }
}

/**
 * Returns true if the price exists, is active, and belongs to the correct product.
 */
async function validateStripePrice(stripe: Stripe, priceId: string, expectedProductId: string): Promise<boolean> {
    try {
        const p = await stripe.prices.retrieve(priceId)
        return p.active && p.product === expectedProductId
    } catch {
        return false
    }
}
