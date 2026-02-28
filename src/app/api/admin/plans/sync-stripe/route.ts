import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/admin/plans/sync-stripe
 * Bulk-sync all plans that are missing Stripe Product or Price IDs.
 * Safe to run multiple times — skips plans already synced.
 */
export async function POST(_req: NextRequest) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } })

    const results: {
        planId: string
        name: string
        status: 'synced' | 'already_synced' | 'skipped_free' | 'error'
        stripeProductId?: string
        stripePriceIdMonthly?: string | null
        stripePriceIdAnnual?: string | null
        error?: string
    }[] = []

    for (const plan of plans) {
        // Free plans (price = 0) — create product but no prices
        if (plan.priceMonthly === 0 && plan.priceAnnual === 0) {
            if (plan.stripeProductId) {
                results.push({ planId: plan.id, name: plan.name, status: 'already_synced', stripeProductId: plan.stripeProductId })
                continue
            }
            // Create Stripe product for free plan (needed for future upgrades/comparisons)
            try {
                const stripe = await getStripe()
                const product = await stripe.products.create({
                    name: plan.name,
                    description: plan.description || undefined,
                    metadata: { source: 'neeflow-admin', planId: plan.id, tier: 'free' },
                })
                await prisma.plan.update({
                    where: { id: plan.id },
                    data: { stripeProductId: product.id },
                })
                results.push({ planId: plan.id, name: plan.name, status: 'synced', stripeProductId: product.id })
            } catch (err) {
                results.push({ planId: plan.id, name: plan.name, status: 'error', error: (err as Error).message })
            }
            continue
        }

        // Already fully synced?
        const needsMonthly = plan.priceMonthly > 0 && !plan.stripePriceIdMonthly
        const needsAnnual = plan.priceAnnual > 0 && !plan.stripePriceIdAnnual
        const needsProduct = !plan.stripeProductId

        if (!needsProduct && !needsMonthly && !needsAnnual) {
            results.push({
                planId: plan.id, name: plan.name, status: 'already_synced',
                stripeProductId: plan.stripeProductId!,
                stripePriceIdMonthly: plan.stripePriceIdMonthly,
                stripePriceIdAnnual: plan.stripePriceIdAnnual,
            })
            continue
        }

        // Sync missing parts
        try {
            const stripe = await getStripe()
            const updates: Record<string, string | null> = {}

            // Create product if missing
            let productId = plan.stripeProductId
            if (!productId) {
                const product = await stripe.products.create({
                    name: plan.name,
                    description: plan.description || undefined,
                    metadata: { source: 'neeflow-admin', planId: plan.id },
                })
                productId = product.id
                updates.stripeProductId = productId
            }

            // Create monthly price if missing
            if (needsMonthly && productId) {
                const mp = await stripe.prices.create({
                    product: productId,
                    unit_amount: Math.round(plan.priceMonthly * 100),
                    currency: 'usd',
                    recurring: { interval: 'month' },
                    metadata: { planName: plan.name, interval: 'monthly' },
                })
                updates.stripePriceIdMonthly = mp.id
            }

            // Create annual price if missing
            if (needsAnnual && productId) {
                const ap = await stripe.prices.create({
                    product: productId,
                    unit_amount: Math.round(plan.priceAnnual * 100),
                    currency: 'usd',
                    recurring: { interval: 'year' },
                    metadata: { planName: plan.name, interval: 'annual' },
                })
                updates.stripePriceIdAnnual = ap.id
            }

            await prisma.plan.update({ where: { id: plan.id }, data: updates })

            results.push({
                planId: plan.id, name: plan.name, status: 'synced',
                stripeProductId: productId,
                stripePriceIdMonthly: updates.stripePriceIdMonthly ?? plan.stripePriceIdMonthly,
                stripePriceIdAnnual: updates.stripePriceIdAnnual ?? plan.stripePriceIdAnnual,
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
