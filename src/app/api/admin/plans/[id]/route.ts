import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

/**
 * GET /api/admin/plans/[id] — get single plan
 * PUT /api/admin/plans/[id] — update plan (auto-syncs Stripe Product + recreates Prices if changed)
 * DELETE /api/admin/plans/[id] — delete plan (archives Stripe Product)
 */

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const plan = await prisma.plan.findUnique({
        where: { id },
        include: { _count: { select: { subscriptions: true } } },
    })

    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    return NextResponse.json(plan)
}

export async function PUT(req: NextRequest, { params }: Params) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const {
        name, nameVi, description, descriptionVi,
        priceMonthly, priceAnnual,
        maxChannels, maxPostsPerMonth, maxMembersPerChannel,
        maxAiImagesPerMonth, maxAiTextPerMonth, maxStorageMB,
        maxApiCallsPerMonth,
        hasAutoSchedule, hasWebhooks, hasAdvancedReports,
        hasPrioritySupport, hasWhiteLabel,
        hasSmartFlow, maxSmartFlowJobsPerMonth,
        isActive, isPublic, sortOrder,
    } = body

    // Get current plan to compare prices
    const currentPlan = await prisma.plan.findUnique({ where: { id } })
    if (!currentPlan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // ─── Stripe sync ────────────────────────────────────────────────────
    const stripeUpdates: Record<string, string | null> = {}

    try {
        const stripe = await getStripe()

        // Create product if missing (plan was created before auto-sync)
        if (!currentPlan.stripeProductId) {
            const product = await stripe.products.create({
                name: name ?? currentPlan.name,
                description: (description ?? currentPlan.description) || undefined,
                metadata: { source: 'neeflow-admin' },
            })
            stripeUpdates.stripeProductId = product.id
        } else {
            // Update product name/description if changed
            if (name !== undefined || description !== undefined) {
                await stripe.products.update(currentPlan.stripeProductId, {
                    ...(name !== undefined && { name }),
                    ...(description !== undefined && { description: description || '' }),
                })
            }
        }

        const productId = stripeUpdates.stripeProductId || currentPlan.stripeProductId

        // Re-create monthly price if price changed
        const newMonthly = priceMonthly !== undefined ? priceMonthly : currentPlan.priceMonthly
        if (productId && priceMonthly !== undefined && priceMonthly !== currentPlan.priceMonthly) {
            // Archive old price
            if (currentPlan.stripePriceIdMonthly) {
                await stripe.prices.update(currentPlan.stripePriceIdMonthly, { active: false })
            }

            if (newMonthly > 0) {
                const mp = await stripe.prices.create({
                    product: productId,
                    unit_amount: Math.round(newMonthly * 100),
                    currency: 'usd',
                    recurring: { interval: 'month' },
                    metadata: { planName: name ?? currentPlan.name, interval: 'monthly' },
                })
                stripeUpdates.stripePriceIdMonthly = mp.id
            } else {
                stripeUpdates.stripePriceIdMonthly = null
            }
        }
        // Create monthly if product was just created and price exists but no Stripe price yet
        else if (!currentPlan.stripePriceIdMonthly && productId && newMonthly > 0) {
            const mp = await stripe.prices.create({
                product: productId,
                unit_amount: Math.round(newMonthly * 100),
                currency: 'usd',
                recurring: { interval: 'month' },
                metadata: { planName: name ?? currentPlan.name, interval: 'monthly' },
            })
            stripeUpdates.stripePriceIdMonthly = mp.id
        }

        // Re-create annual price if price changed
        const newAnnual = priceAnnual !== undefined ? priceAnnual : currentPlan.priceAnnual
        if (productId && priceAnnual !== undefined && priceAnnual !== currentPlan.priceAnnual) {
            if (currentPlan.stripePriceIdAnnual) {
                await stripe.prices.update(currentPlan.stripePriceIdAnnual, { active: false })
            }

            if (newAnnual > 0) {
                const ap = await stripe.prices.create({
                    product: productId,
                    unit_amount: Math.round(newAnnual * 100),
                    currency: 'usd',
                    recurring: { interval: 'year' },
                    metadata: { planName: name ?? currentPlan.name, interval: 'annual' },
                })
                stripeUpdates.stripePriceIdAnnual = ap.id
            } else {
                stripeUpdates.stripePriceIdAnnual = null
            }
        }
        // Create annual if product was just created and price exists but no Stripe price yet
        else if (!currentPlan.stripePriceIdAnnual && productId && newAnnual > 0) {
            const ap = await stripe.prices.create({
                product: productId,
                unit_amount: Math.round(newAnnual * 100),
                currency: 'usd',
                recurring: { interval: 'year' },
                metadata: { planName: name ?? currentPlan.name, interval: 'annual' },
            })
            stripeUpdates.stripePriceIdAnnual = ap.id
        }
    } catch (err) {
        console.error('[Admin Plans] Stripe sync failed:', err)
        // Continue with local update even if Stripe fails
    }

    const plan = await prisma.plan.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(nameVi !== undefined && { nameVi }),
            ...(description !== undefined && { description }),
            ...(descriptionVi !== undefined && { descriptionVi }),
            ...(priceMonthly !== undefined && { priceMonthly }),
            ...(priceAnnual !== undefined && { priceAnnual }),
            ...(maxChannels !== undefined && { maxChannels }),
            ...(maxPostsPerMonth !== undefined && { maxPostsPerMonth }),
            ...(maxMembersPerChannel !== undefined && { maxMembersPerChannel }),
            ...(maxAiImagesPerMonth !== undefined && { maxAiImagesPerMonth }),
            ...(maxAiTextPerMonth !== undefined && { maxAiTextPerMonth }),
            ...(maxStorageMB !== undefined && { maxStorageMB }),
            ...(maxApiCallsPerMonth !== undefined && { maxApiCallsPerMonth }),
            ...(hasAutoSchedule !== undefined && { hasAutoSchedule }),
            ...(hasWebhooks !== undefined && { hasWebhooks }),
            ...(hasAdvancedReports !== undefined && { hasAdvancedReports }),
            ...(hasPrioritySupport !== undefined && { hasPrioritySupport }),
            ...(hasWhiteLabel !== undefined && { hasWhiteLabel }),
            ...(hasSmartFlow !== undefined && { hasSmartFlow }),
            ...(maxSmartFlowJobsPerMonth !== undefined && { maxSmartFlowJobsPerMonth }),
            ...(isActive !== undefined && { isActive }),
            ...(isPublic !== undefined && { isPublic }),
            ...(sortOrder !== undefined && { sortOrder }),
            // Stripe auto-sync fields
            ...stripeUpdates,
        },
    })

    return NextResponse.json(plan)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if any users are on this plan
    const subscriberCount = await prisma.subscription.count({ where: { planId: id } })
    if (subscriberCount > 0) {
        return NextResponse.json({
            error: `Cannot delete — ${subscriberCount} user(s) on this plan`,
            errorVi: `Không thể xóa — có ${subscriberCount} người dùng đang dùng gói này`,
        }, { status: 409 })
    }

    // Archive Stripe product (don't delete, just deactivate)
    const plan = await prisma.plan.findUnique({ where: { id } })
    if (plan?.stripeProductId) {
        try {
            const stripe = await getStripe()
            await stripe.products.update(plan.stripeProductId, { active: false })
            // Also archive prices
            if (plan.stripePriceIdMonthly) {
                await stripe.prices.update(plan.stripePriceIdMonthly, { active: false })
            }
            if (plan.stripePriceIdAnnual) {
                await stripe.prices.update(plan.stripePriceIdAnnual, { active: false })
            }
        } catch (err) {
            console.error('[Admin Plans] Stripe archive failed:', err)
        }
    }

    await prisma.plan.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
