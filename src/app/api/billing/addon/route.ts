import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * POST /api/billing/addon — purchase or cancel an add-on via Stripe Subscription Items
 *
 * Body: { addonId, action: 'purchase' | 'cancel', quantity?: number }
 *
 * Add-ons are added as subscription items to the existing Stripe subscription.
 * Stripe handles proration automatically (charges the prorated amount immediately).
 *
 * If user has no Stripe subscription (free plan), they cannot add paid add-ons.
 * If addon has no Stripe price configured, falls back to DB-only (free addons).
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { addonId, action, quantity = 1 } = await req.json()

    if (!addonId || !action) {
        return NextResponse.json({ error: 'addonId and action are required' }, { status: 400 })
    }

    // Verify addon exists
    const addon = await db.addon.findUnique({ where: { id: addonId } })
    if (!addon || !addon.isActive) {
        return NextResponse.json({ error: 'Add-on not found' }, { status: 404 })
    }

    // Get active subscription
    const sub = await db.subscription.findUnique({
        where: { userId: session.user.id },
        include: {
            addons: {
                where: { addonId },
            },
        },
    })

    if (!sub) {
        return NextResponse.json(
            { error: 'You need an active subscription to purchase add-ons' },
            { status: 400 }
        )
    }

    // ── PURCHASE ─────────────────────────────────────────────────────────────
    if (action === 'purchase') {
        // Check if already active
        const existing = sub.addons[0]
        if (existing?.status === 'active') {
            return NextResponse.json({ error: 'Add-on is already active' }, { status: 400 })
        }

        let stripeSubscriptionItemId: string | null = null

        // If user has a Stripe subscription AND addon has a Stripe price → add via Stripe
        if (sub.stripeSubscriptionId && addon.stripePriceIdMonthly) {
            try {
                const stripe = await getStripe()

                // Determine price ID based on billing interval
                const priceId = sub.billingInterval === 'annual' && addon.stripePriceIdAnnual
                    ? addon.stripePriceIdAnnual
                    : addon.stripePriceIdMonthly

                if (!priceId) {
                    return NextResponse.json(
                        { error: 'No Stripe price configured for this add-on. Contact support.' },
                        { status: 400 }
                    )
                }

                // Add item to existing subscription (Stripe handles proration)
                const item = await stripe.subscriptionItems.create({
                    subscription: sub.stripeSubscriptionId,
                    price: priceId,
                    quantity,
                    proration_behavior: 'always_invoice', // charge prorated amount immediately
                })

                stripeSubscriptionItemId = item.id
                console.log(`[Addon] Added Stripe subscription item ${item.id} for addon ${addon.name}`)
            } catch (err: unknown) {
                const stripeErr = err as { message?: string }
                console.error('[Addon] Stripe error adding item:', err)
                return NextResponse.json(
                    { error: stripeErr.message || 'Failed to add add-on via Stripe' },
                    { status: 400 }
                )
            }
        }

        // Upsert in DB
        const sa = await db.subscriptionAddon.upsert({
            where: {
                subscriptionId_addonId: {
                    subscriptionId: sub.id,
                    addonId,
                },
            },
            update: {
                quantity,
                status: 'active',
                stripeSubscriptionItemId,
            },
            create: {
                subscriptionId: sub.id,
                addonId,
                quantity,
                status: 'active',
                stripeSubscriptionItemId,
            },
            include: { addon: true },
        })

        return NextResponse.json({
            success: true,
            action: 'purchased',
            addon: sa.addon,
            quantity: sa.quantity,
            viaStripe: !!stripeSubscriptionItemId,
        })
    }

    // ── CANCEL ───────────────────────────────────────────────────────────────
    if (action === 'cancel') {
        const existing = sub.addons[0]

        // If it has a Stripe item → remove from subscription (cancels billing at period end by default)
        if (existing?.stripeSubscriptionItemId) {
            try {
                const stripe = await getStripe()
                // Delete subscription item — Stripe will prorate/credit on next invoice
                await stripe.subscriptionItems.del(existing.stripeSubscriptionItemId, {
                    proration_behavior: 'always_invoice',
                    clear_usage: true,
                })
                console.log(`[Addon] Removed Stripe subscription item ${existing.stripeSubscriptionItemId}`)
            } catch (err: unknown) {
                const stripeErr = err as { message?: string; code?: string }
                // If item not found on Stripe (already deleted), proceed to DB update
                if (stripeErr.code !== 'resource_missing') {
                    console.error('[Addon] Stripe error removing item:', err)
                    return NextResponse.json(
                        { error: stripeErr.message || 'Failed to remove add-on from Stripe' },
                        { status: 400 }
                    )
                }
            }
        }

        // Update DB
        await db.subscriptionAddon.updateMany({
            where: {
                subscriptionId: sub.id,
                addonId,
            },
            data: {
                status: 'canceled',
                stripeSubscriptionItemId: null,
            },
        })

        return NextResponse.json({
            success: true,
            action: 'canceled',
            addonId,
        })
    }

    return NextResponse.json({ error: 'Invalid action. Use "purchase" or "cancel".' }, { status: 400 })
}
