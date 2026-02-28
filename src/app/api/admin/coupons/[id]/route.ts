import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'

type Params = { params: Promise<{ id: string }> }

/**
 * GET    /api/admin/coupons/[id] — fetch single coupon from Stripe
 * DELETE /api/admin/coupons/[id] — delete coupon from Stripe
 */

export async function GET(_req: NextRequest, { params }: Params) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    try {
        const stripe = await getStripe()
        const coupon = await stripe.coupons.retrieve(id)
        return NextResponse.json(coupon)
    } catch {
        return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    try {
        const stripe = await getStripe()
        await stripe.coupons.del(id)
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[Admin Coupons] DELETE failed:', err)
        return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 400 })
    }
}
