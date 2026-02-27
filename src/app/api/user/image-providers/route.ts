import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveLimits } from '@/lib/addon-resolver'
import { getCurrentMonth } from '@/lib/plans'

// Image-capable providers (same list as resolve-ai-key.ts)
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
 * along with the user's image generation quota.
 */
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    try {
        // 1. Fetch user's BYOK keys — same query as /api/user/api-keys but filtered to image-capable
        const userKeys = await prisma.userApiKey.findMany({
            where: { userId },
            orderBy: { provider: 'asc' },
            select: { provider: true, name: true, isActive: true },
        })

        // Filter to image-capable providers (don't require isActive — match channel setup behavior)
        const byok = userKeys
            .filter(k => IMAGE_CAPABLE_PROVIDERS.includes(k.provider))
            .map(k => ({
                provider: k.provider,
                name: k.name || PROVIDER_LABELS[k.provider] || k.provider,
                source: 'byok' as const,
            }))

        // 2. Check plan quota
        let quota = { used: 0, limit: 0 }
        const plan: { provider: string; name: string; source: 'plan' }[] = []

        try {
            const limits = await getEffectiveLimits(userId)
            const imageLimit = limits.maxAiImagesPerMonth

            // Get current usage
            const sub = await db.subscription.findUnique({
                where: { userId },
                include: { usages: { where: { month: getCurrentMonth() } } },
            })
            const used: number = sub?.usages?.[0]?.imagesGenerated ?? 0
            quota = { used, limit: imageLimit }

            // 3. If plan includes image quota, show platform providers
            const hasQuota = imageLimit === -1 || (imageLimit > 0 && used < imageLimit)

            if (hasQuota) {
                // Fetch platform API Hub integrations — same as /api/user/ai-providers but filtered
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

                for (const pk of platformKeys) {
                    plan.push({
                        provider: pk.provider,
                        name: pk.name || PROVIDER_LABELS[pk.provider] || pk.provider,
                        source: 'plan' as const,
                    })
                }
            }
        } catch {
            // Subscription/quota tables not ready — fail open with no plan providers
        }

        return NextResponse.json({ byok, plan, quota })
    } catch (err) {
        console.error('[image-providers] Error:', err)
        return NextResponse.json({ byok: [], plan: [], quota: { used: 0, limit: 0 } })
    }
}
