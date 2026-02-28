import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'

/**
 * GET  /api/admin/coupons — list all coupons from Stripe
 * POST /api/admin/coupons — create a new coupon on Stripe
 */

export async function GET(_req: NextRequest) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const stripe = await getStripe()
        const coupons = await stripe.coupons.list({ limit: 100 })
        return NextResponse.json(coupons.data)
    } catch (err) {
        console.error('[Admin Coupons] GET failed:', err)
        return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
        id,                 // custom coupon code, e.g. "SAVE20"
        name,               // display name
        discountType,       // 'percent' | 'fixed'
        amount,             // percent_off or amount_off (USD dollars for fixed)
        duration,           // 'once' | 'repeating' | 'forever'
        durationInMonths,   // only for 'repeating'
        maxRedemptions,     // optional limit
        redeemBy,           // optional expiry (ISO date string)
    } = body

    if (!discountType || !amount || !duration) {
        return NextResponse.json({ error: 'discountType, amount, and duration are required' }, { status: 400 })
    }

    try {
        const stripe = await getStripe()
        const coupon = await stripe.coupons.create({
            ...(id ? { id: id.toUpperCase().trim() } : {}),
            ...(name ? { name } : {}),
            ...(discountType === 'percent'
                ? { percent_off: Number(amount) }
                : { amount_off: Math.round(Number(amount) * 100), currency: 'usd' }
            ),
            duration,
            ...(duration === 'repeating' && durationInMonths
                ? { duration_in_months: Number(durationInMonths) }
                : {}
            ),
            ...(maxRedemptions ? { max_redemptions: Number(maxRedemptions) } : {}),
            ...(redeemBy ? { redeem_by: Math.floor(new Date(redeemBy).getTime() / 1000) } : {}),
        })

        return NextResponse.json(coupon, { status: 201 })
    } catch (err: unknown) {
        console.error('[Admin Coupons] POST failed:', err)
        const msg = err instanceof Error ? err.message : 'Failed to create coupon'
        return NextResponse.json({ error: msg }, { status: 400 })
    }
}
