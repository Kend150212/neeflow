import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import type Stripe from 'stripe'

const APP_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * GET  /api/billing/register-complete?session_id=cs_xxx
 *   → Verifies Stripe session and returns { email, planName, trialDays }
 *
 * POST /api/billing/register-complete?session_id=cs_xxx&resend=true
 *   → Resends welcome email for the session
 */
export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
        return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    try {
        const stripe = await getStripe()
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['subscription', 'customer'],
        }) as Stripe.Checkout.Session

        if (checkoutSession.payment_status === 'unpaid' && checkoutSession.status !== 'complete') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 402 })
        }

        const guestEmail = checkoutSession.metadata?.guestEmail
        const planId = checkoutSession.metadata?.planId

        if (!guestEmail) {
            return NextResponse.json({ error: 'Not a guest checkout session' }, { status: 400 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const plan = await db.plan.findUnique({
            where: { id: planId },
            select: { name: true },
        })

        const sub = checkoutSession.subscription as Stripe.Subscription | null
        const trialEnd = sub?.trial_end ?? null
        const trialDays = trialEnd ? Math.max(0, Math.ceil((trialEnd * 1000 - Date.now()) / 86400000)) : 0

        return NextResponse.json({
            email: guestEmail,
            planName: plan?.name ?? 'Your Plan',
            trialDays,
        })
    } catch (error) {
        console.error('[register-complete] GET error:', error)
        return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('session_id')
    const resend = req.nextUrl.searchParams.get('resend')

    if (!sessionId || resend !== 'true') {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    try {
        const stripe = await getStripe()
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)

        const guestEmail = checkoutSession.metadata?.guestEmail
        const planId = checkoutSession.metadata?.planId
        const interval = checkoutSession.metadata?.interval ?? 'monthly'

        if (!guestEmail) {
            return NextResponse.json({ error: 'Not a guest checkout session' }, { status: 400 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const user = await db.user.findUnique({
            where: { email: guestEmail },
            select: { name: true, inviteToken: true, inviteExpiresAt: true },
        })

        if (!user?.inviteToken) {
            return NextResponse.json({ error: 'Account not found or already set up' }, { status: 404 })
        }

        // Refresh invite token if expired
        let token = user.inviteToken
        if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
            const crypto = await import('crypto')
            token = crypto.randomUUID()
            await db.user.update({
                where: { email: guestEmail },
                data: {
                    inviteToken: token,
                    inviteExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
                },
            })
        }

        const plan = await db.plan.findUnique({
            where: { id: planId },
            select: { name: true, priceMonthly: true, priceAnnual: true },
        })

        const planName = plan?.name ?? 'Your Plan'
        const planPrice = interval === 'annual'
            ? (plan?.priceAnnual ?? 0).toString()
            : (plan?.priceMonthly ?? 0).toString()
        const setupUrl = `${APP_URL}/setup-password?token=${token}`

        await sendWelcomeEmail({
            toEmail: guestEmail,
            userName: user.name ?? guestEmail.split('@')[0],
            planName,
            planPrice,
            billingInterval: interval,
            setupUrl,
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[register-complete] POST error:', error)
        return NextResponse.json({ error: 'Failed to resend email' }, { status: 500 })
    }
}
