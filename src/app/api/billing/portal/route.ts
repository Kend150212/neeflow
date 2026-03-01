import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

const APP_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session.
 * User can manage/cancel/change subscription there.
 */
export async function POST(_req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const sub = await db.subscription.findUnique({
        where: { userId: session.user.id },
        select: { stripeCustomerId: true },
    })

    if (!sub?.stripeCustomerId) {
        return NextResponse.json(
            { error: 'No Stripe billing account found. Please contact support.', errorVi: 'Không tìm thấy tài khoản thanh toán Stripe.' },
            { status: 404 }
        )
    }

    try {
        const stripe = await getStripe()
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: sub.stripeCustomerId,
            return_url: `${APP_URL}/dashboard/billing`,
        })
        return NextResponse.json({ url: portalSession.url })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create portal session'
        console.error('[Portal] Stripe error:', msg)
        // Common cause: Customer Portal not configured in Stripe Dashboard
        const isMissingConfig = msg.includes('configuration') || msg.includes('portal')
        return NextResponse.json({
            error: isMissingConfig
                ? 'Stripe Customer Portal is not configured. Go to Stripe Dashboard → Billing → Customer portal to enable it.'
                : msg,
            errorVi: isMissingConfig
                ? 'Stripe Customer Portal chưa được cấu hình. Vào Stripe Dashboard → Billing → Customer portal để bật.'
                : msg,
        }, { status: 500 })
    }
}
