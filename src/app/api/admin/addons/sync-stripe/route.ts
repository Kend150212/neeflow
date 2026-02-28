import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * POST /api/admin/addons/sync-stripe
 *
 * Validates and syncs all addons to the CURRENT Stripe account.
 * Same logic as plans/sync-stripe — validates existing IDs first,
 * recreates stale ones (e.g. after switching test → live keys).
 *
 * Each addon gets:
 *   - 1 Stripe Product
 *   - 1 Monthly Price (if priceMonthly > 0)
 *   - 1 Annual Price  (if priceAnnual > 0)
 *
 * Safe to call any time. Idempotent.
 */
export async function POST(_req: NextRequest) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const addons = await db.addon.findMany({ orderBy: { sortOrder: 'asc' } })
    const stripe = await getStripe()

    const results: {
        addonId: string
        name: string
        status: 'synced' | 'already_synced' | 'skipped_free' | 'error'
        stripeProductId?: string
        stripePriceIdMonthly?: string | null
        stripePriceIdAnnual?: string | null
        rebuilt?: string[]
        error?: string
    }[] = []

    for (const addon of addons) {
        // Free addons (price = 0) — no Stripe needed
        if (addon.priceMonthly === 0 && addon.priceAnnual === 0) {
            results.push({ addonId: addon.id, name: addon.displayName, status: 'skipped_free' })
            continue
        }

        try {
            const updates: Record<string, string | null> = {}
            const rebuilt: string[] = []

            // ── 1. Validate / create Product ────────────────────────────────
            let productId: string | null = addon.stripeProductId || null
            const productValid = productId && await stripeProductExists(stripe, productId)

            if (!productValid) {
                const product = await stripe.products.create({
                    name: addon.displayName,
                    description: addon.description || undefined,
                    metadata: { source: 'neeflow-admin', type: 'addon', addonId: addon.id },
                })
                productId = product.id
                updates.stripeProductId = productId
                // Force price recreation since product is new
                updates.stripePriceIdMonthly = null
                updates.stripePriceIdAnnual = null
                rebuilt.push('product')
            }

            // ── 2. Validate / create Monthly Price ──────────────────────────
            if (addon.priceMonthly > 0 && productId) {
                const curMonthly = updates.stripePriceIdMonthly !== undefined
                    ? updates.stripePriceIdMonthly
                    : addon.stripePriceIdMonthly
                const monthlyValid = curMonthly && await stripePriceExists(stripe, curMonthly, productId)

                if (!monthlyValid) {
                    const mp = await stripe.prices.create({
                        product: productId,
                        unit_amount: Math.round(addon.priceMonthly * 100),
                        currency: 'usd',
                        recurring: { interval: 'month' },
                        metadata: { addonName: addon.name, addonDisplayName: addon.displayName, interval: 'monthly' },
                    })
                    updates.stripePriceIdMonthly = mp.id
                    rebuilt.push('monthly')
                }
            }

            // ── 3. Validate / create Annual Price ───────────────────────────
            if (addon.priceAnnual > 0 && productId) {
                const curAnnual = updates.stripePriceIdAnnual !== undefined
                    ? updates.stripePriceIdAnnual
                    : addon.stripePriceIdAnnual
                const annualValid = curAnnual && await stripePriceExists(stripe, curAnnual, productId)

                if (!annualValid) {
                    const ap = await stripe.prices.create({
                        product: productId,
                        unit_amount: Math.round(addon.priceAnnual * 100),
                        currency: 'usd',
                        recurring: { interval: 'year' },
                        metadata: { addonName: addon.name, addonDisplayName: addon.displayName, interval: 'annual' },
                    })
                    updates.stripePriceIdAnnual = ap.id
                    rebuilt.push('annual')
                }
            }

            if (Object.keys(updates).length > 0) {
                await db.addon.update({ where: { id: addon.id }, data: updates })
            }

            const status = rebuilt.length > 0 ? 'synced' : 'already_synced'
            results.push({
                addonId: addon.id,
                name: addon.displayName,
                status,
                stripeProductId: productId!,
                stripePriceIdMonthly: updates.stripePriceIdMonthly ?? addon.stripePriceIdMonthly,
                stripePriceIdAnnual: updates.stripePriceIdAnnual ?? addon.stripePriceIdAnnual,
                ...(rebuilt.length > 0 && { rebuilt }),
            })

        } catch (err) {
            console.error(`[Addon Stripe Sync] Failed for "${addon.displayName}":`, err)
            results.push({ addonId: addon.id, name: addon.displayName, status: 'error', error: (err as Error).message })
        }
    }

    const synced = results.filter(r => r.status === 'synced').length
    const alreadySynced = results.filter(r => r.status === 'already_synced').length
    const skipped = results.filter(r => r.status === 'skipped_free').length
    const errors = results.filter(r => r.status === 'error').length

    return NextResponse.json({
        ok: true,
        summary: { total: addons.length, synced, alreadySynced, skipped, errors },
        results,
    })
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
