import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/admin/billing/pause
 * Body: { subscriptionId, resume: boolean }
 *
 * Admin-only.
 * - resume = false → pause (pause_collection: void)
 * - resume = true  → resume (clear pause_collection)
 *
 * Webhook customer.subscription.paused/resumed will auto-sync.
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    })
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { subscriptionId, resume = false } = await req.json()

    if (!subscriptionId) {
        return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const sub = await db.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
            id: true,
            stripeSubscriptionId: true,
            user: { select: { id: true, email: true, name: true } },
        },
    })

    if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

    try {
        if (sub.stripeSubscriptionId) {
            const stripe = await getStripe()

            if (resume) {
                // Resume: clear pause_collection
                await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pause_collection: '' as any,
                })
            } else {
                // Pause: void future invoices
                await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                    pause_collection: { behavior: 'void' },
                })
            }
        }

        // Update DB status
        await db.subscription.update({
            where: { id: subscriptionId },
            data: { status: resume ? 'active' : 'paused' },
        })

        return NextResponse.json({
            success: true,
            message: resume
                ? `Subscription resumed for ${sub.user.email}`
                : `Subscription paused for ${sub.user.email}`,
        })
    } catch (err) {
        console.error('[Admin Pause] Stripe error:', err)
        const msg = err instanceof Error ? err.message : 'Failed to pause/resume subscription'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
