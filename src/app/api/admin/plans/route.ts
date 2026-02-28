import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

/**
 * GET /api/admin/plans — list all plans
 * POST /api/admin/plans — create a new plan (auto-creates Stripe Product + Prices)
 */

export async function GET(_req: NextRequest) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plans = await prisma.plan.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { subscriptions: true } } },
    })

    return NextResponse.json(plans)
}

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
        name, nameVi = '', description, descriptionVi,
        priceMonthly = 0, priceAnnual = 0,
        maxChannels = 1, maxPostsPerMonth = 50, maxMembersPerChannel = 2,
        maxAiImagesPerMonth = 0, maxAiTextPerMonth = 20, maxStorageMB = 512,
        maxApiCallsPerMonth = 0,
        hasAutoSchedule = false, hasWebhooks = false, hasAdvancedReports = false,
        hasPrioritySupport = false, hasWhiteLabel = false,
        hasSmartFlow = false, maxSmartFlowJobsPerMonth = 0,
        allowedImageModels = null,
        isActive = true, isPublic = true, sortOrder = 0,
        // ─── Per-plan trial config ─────────────────────────────
        trialEnabled = false, trialDays = 14,
    } = body

    if (!name) {
        return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
    }

    // ─── Auto-create Stripe Product + Prices ────────────────────────────
    let stripeProductId: string | null = null
    let stripePriceIdMonthly: string | null = null
    let stripePriceIdAnnual: string | null = null

    try {
        const stripe = await getStripe()

        // Create Stripe Product
        const product = await stripe.products.create({
            name,
            description: description || undefined,
            metadata: {
                source: 'neeflow-admin',
                trialEnabled: String(trialEnabled),
                trialDays: String(trialDays),
            },
        })
        stripeProductId = product.id

        // Create monthly price if > 0
        if (priceMonthly > 0) {
            const monthlyPrice = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(priceMonthly * 100), // dollars → cents
                currency: 'usd',
                recurring: {
                    interval: 'month',
                    // Attach trial days directly on the price recurring config
                    ...(trialEnabled && trialDays > 0 ? { trial_period_days: trialDays } : {}),
                },
                metadata: { planName: name, interval: 'monthly' },
            })
            stripePriceIdMonthly = monthlyPrice.id
        }

        // Create annual price if > 0
        if (priceAnnual > 0) {
            const annualPrice = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(priceAnnual * 100),
                currency: 'usd',
                recurring: {
                    interval: 'year',
                    ...(trialEnabled && trialDays > 0 ? { trial_period_days: trialDays } : {}),
                },
                metadata: { planName: name, interval: 'annual' },
            })
            stripePriceIdAnnual = annualPrice.id
        }
    } catch (err) {
        console.error('[Admin Plans] Stripe auto-create failed:', err)
        // Plan is still saved locally, admin can retry Stripe sync later
    }

    const plan = await prisma.plan.create({
        data: {
            name, nameVi, description, descriptionVi,
            priceMonthly, priceAnnual,
            stripeProductId,
            stripePriceIdMonthly,
            stripePriceIdAnnual,
            maxChannels, maxPostsPerMonth, maxMembersPerChannel,
            maxAiImagesPerMonth, maxAiTextPerMonth, maxStorageMB,
            maxApiCallsPerMonth,
            hasAutoSchedule, hasWebhooks, hasAdvancedReports,
            hasPrioritySupport, hasWhiteLabel,
            hasSmartFlow, maxSmartFlowJobsPerMonth,
            allowedImageModels,
            isActive, isPublic, sortOrder,
            trialEnabled, trialDays,
        },
    })

    return NextResponse.json(plan, { status: 201 })
}
