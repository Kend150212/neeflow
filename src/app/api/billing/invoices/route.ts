import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * GET /api/billing/invoices
 * Returns the user's invoice history from Stripe (last 24 invoices).
 * Requires an active Stripe customer ID on the subscription.
 */
export async function GET(_req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sub = await db.subscription.findUnique({
        where: { userId: session.user.id },
        select: { stripeCustomerId: true },
    })

    if (!sub?.stripeCustomerId) {
        // No Stripe customer — return empty list
        return NextResponse.json({ invoices: [] })
    }

    try {
        const stripe = await getStripe()
        const invoiceList = await stripe.invoices.list({
            customer: sub.stripeCustomerId,
            limit: 24,
            expand: ['data.subscription'],
        })

        const invoices = invoiceList.data.map(inv => ({
            id: inv.id,
            number: inv.number,
            status: inv.status,
            amountPaid: inv.amount_paid,    // in cents
            amountDue: inv.amount_due,       // in cents
            currency: inv.currency,
            periodStart: inv.period_start,   // unix timestamp
            periodEnd: inv.period_end,        // unix timestamp
            created: inv.created,            // unix timestamp
            invoicePdf: inv.invoice_pdf,
            hostedInvoiceUrl: inv.hosted_invoice_url,
            description: inv.description,
            // Lines: show what was charged
            lines: inv.lines.data.slice(0, 5).map(line => ({
                description: line.description,
                amount: line.amount,
                currency: line.currency,
                period: {
                    start: line.period.start,
                    end: line.period.end,
                },
            })),
        }))

        return NextResponse.json({ invoices })
    } catch (err: unknown) {
        const stripeErr = err as { message?: string }
        console.error('[Invoices] Stripe error:', err)
        return NextResponse.json(
            { error: stripeErr.message || 'Failed to fetch invoices' },
            { status: 500 }
        )
    }
}
