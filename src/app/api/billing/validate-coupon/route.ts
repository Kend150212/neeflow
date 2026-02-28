import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/billing/validate-coupon
 * Body: { code: string }
 * Public — no auth needed (user is entering coupon at checkout)
 * Returns coupon details if valid, error if not.
 */
export async function POST(req: NextRequest) {
    const { code } = await req.json()
    if (!code?.trim()) {
        return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
    }

    try {
        const stripe = await getStripe()
        const coupon = await stripe.coupons.retrieve(code.toUpperCase().trim())

        if (!coupon.valid) {
            return NextResponse.json(
                { error: 'Coupon is expired or invalid', errorVi: 'Mã đã hết hạn hoặc không hợp lệ' },
                { status: 400 }
            )
        }

        // Return safe subset to client
        return NextResponse.json({
            id: coupon.id,
            name: coupon.name,
            valid: coupon.valid,
            discountType: coupon.percent_off ? 'percent' : 'fixed',
            percentOff: coupon.percent_off ?? null,
            amountOff: coupon.amount_off ? coupon.amount_off / 100 : null, // cents → dollars
            currency: coupon.currency ?? 'usd',
            duration: coupon.duration,
            durationInMonths: coupon.duration_in_months ?? null,
            timesRedeemed: coupon.times_redeemed,
            maxRedemptions: coupon.max_redemptions ?? null,
            redeemBy: coupon.redeem_by ? new Date(coupon.redeem_by * 1000).toISOString() : null,
        })
    } catch {
        return NextResponse.json(
            { error: 'Invalid coupon code', errorVi: 'Mã giảm giá không hợp lệ' },
            { status: 400 }
        )
    }
}
