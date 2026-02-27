import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveLimits } from '@/lib/addon-resolver'
import { getCurrentMonth } from '@/lib/plans'

// Image-capable providers
const IMAGE_CAPABLE_PROVIDERS = ['runware', 'openai', 'gemini']

const PROVIDER_LABELS: Record<string, string> = {
    runware: 'Runware',
    openai: 'OpenAI',
    gemini: 'Gemini',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * GET /api/user/image-providers
 *
 * Returns both BYOK and Plan-included image providers for the current user,
 * along with the user's image generation quota and per-plan allowed models.
 */
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    try {
        // 1. Fetch user's BYOK keys
        const userKeys = await prisma.userApiKey.findMany({
            where: { userId },
            orderBy: { provider: 'asc' },
            select: { provider: true, name: true },
        })

        const byok = userKeys
            .filter(k => IMAGE_CAPABLE_PROVIDERS.includes(k.provider))
            .map(k => ({
                provider: k.provider,
                name: k.name || PROVIDER_LABELS[k.provider] || k.provider,
                source: 'byok' as const,
            }))

        // 2. Fetch platform providers (plan-based, always shown if ACTIVE)
        const platformKeys = await prisma.apiIntegration.findMany({
            where: {
                provider: { in: IMAGE_CAPABLE_PROVIDERS },
                category: 'AI',
                status: 'ACTIVE',
                apiKeyEncrypted: { not: null },
            },
            select: { provider: true, name: true },
            orderBy: { provider: 'asc' },
        })

        const plan = platformKeys.map((pk: { provider: string; name: string }) => ({
            provider: pk.provider,
            name: pk.name || PROVIDER_LABELS[pk.provider] || pk.provider,
            source: 'plan' as const,
        }))

        // 3. Check plan quota (informational — UI decides whether to block)
        let quota = { used: 0, limit: 0 }
        try {
            const limits = await getEffectiveLimits(userId)
            const imageLimit = limits.maxAiImagesPerMonth

            const sub = await db.subscription.findUnique({
                where: { userId },
                include: { usages: { where: { month: getCurrentMonth() } } },
            })
            const used: number = sub?.usages?.[0]?.imagesGenerated ?? 0
            quota = { used, limit: imageLimit }
        } catch {
            // Subscription/quota tables not ready — fail open
        }

        // 4. Read allowedImageModels from user's Plan
        // Format: [{ provider: "gemini", models: ["model-id-1"] }, ...]
        let allowedImageModels: { provider: string; models: string[] }[] = []
        try {
            const sub = await db.subscription.findUnique({
                where: { userId },
                include: { plan: { select: { allowedImageModels: true } } },
            })
            const planModels = sub?.plan?.allowedImageModels
            if (Array.isArray(planModels) && planModels.length > 0) {
                allowedImageModels = planModels as { provider: string; models: string[] }[]
            }
        } catch {
            // Plan doesn't have allowedImageModels yet — fail open (all models)
        }

        return NextResponse.json({ byok, plan, quota, allowedImageModels })
    } catch (err) {
        console.error('[image-providers] Error:', err)
        return NextResponse.json({ byok: [], plan: [], quota: { used: 0, limit: 0 }, allowedImageModels: [] })
    }
}
