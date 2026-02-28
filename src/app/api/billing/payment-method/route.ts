import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * GET /api/billing/payment-method
 * Returns the default payment method on the user's Stripe customer.
 */
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sub = await db.subscription.findUnique({
        where: { userId: session.user.id },
        select: { stripeCustomerId: true, stripeSubscriptionId: true },
    })

    if (!sub?.stripeCustomerId) {
        return NextResponse.json({ paymentMethod: null })
    }

    try {
        const stripe = await getStripe()

        // Try to get default payment method from the subscription first
        let paymentMethod = null

        if (sub.stripeSubscriptionId) {
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId, {
                expand: ['default_payment_method'],
            })
            if (stripeSub.default_payment_method && typeof stripeSub.default_payment_method !== 'string') {
                paymentMethod = stripeSub.default_payment_method
            }
        }

        // Fallback: get default from customer
        if (!paymentMethod) {
            const customer = await stripe.customers.retrieve(sub.stripeCustomerId, {
                expand: ['invoice_settings.default_payment_method'],
            })
            if (customer.deleted) {
                return NextResponse.json({ paymentMethod: null })
            }
            const pm = customer.invoice_settings?.default_payment_method
            if (pm && typeof pm !== 'string') {
                paymentMethod = pm
            }
        }

        // Fallback: list payment methods
        if (!paymentMethod) {
            const list = await stripe.paymentMethods.list({
                customer: sub.stripeCustomerId,
                type: 'card',
                limit: 1,
            })
            if (list.data.length > 0) {
                paymentMethod = list.data[0]
            }
        }

        if (!paymentMethod) {
            return NextResponse.json({ paymentMethod: null })
        }

        // Return just what we need for the UI
        return NextResponse.json({
            paymentMethod: {
                id: paymentMethod.id,
                type: paymentMethod.type,
                card: paymentMethod.card
                    ? {
                        brand: paymentMethod.card.brand,
                        last4: paymentMethod.card.last4,
                        expMonth: paymentMethod.card.exp_month,
                        expYear: paymentMethod.card.exp_year,
                        funding: paymentMethod.card.funding,
                    }
                    : null,
                billingDetails: {
                    name: paymentMethod.billing_details?.name ?? null,
                    email: paymentMethod.billing_details?.email ?? null,
                },
            },
        })
    } catch (err: unknown) {
        console.error('[PaymentMethod] Error:', err)
        return NextResponse.json({ paymentMethod: null })
    }
}
