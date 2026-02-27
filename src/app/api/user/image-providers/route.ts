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
 * along with the user's image generation quota.
 *
 * Response:
 * {
 *   byok: [{ provider, name, source: 'byok' }],
 *   plan: [{ provider, name, source: 'plan' }],
 *   quota: { used, limit }  // -1 = unlimited, 0 = not included
 * }
 */
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // 1. Fetch user's BYOK keys (only image-capable providers)
    const userKeys = await prisma.userApiKey.findMany({
        where: {
            userId,
            isActive: true,
            provider: { in: IMAGE_CAPABLE_PROVIDERS },
        },
        select: { provider: true, name: true },
        orderBy: { provider: 'asc' },
    })

    const byok = userKeys.map(k => ({
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

        // 3. If plan has image quota and still available, show platform providers
        const hasQuota = imageLimit === -1 || (imageLimit > 0 && used < imageLimit)

        if (hasQuota) {
            // Fetch active platform ApiIntegration keys for image providers
            const platformKeys = await prisma.apiIntegration.findMany({
                where: {
                    provider: { in: IMAGE_CAPABLE_PROVIDERS },
                    category: 'AI',
                    status: 'ACTIVE',
                    apiKeyEncrypted: { not: null },
                },
                select: { provider: true },
                orderBy: { provider: 'asc' },
            })

            for (const pk of platformKeys) {
                // Don't duplicate if user already has BYOK for this provider
                plan.push({
                    provider: pk.provider,
                    name: PROVIDER_LABELS[pk.provider] || pk.provider,
                    source: 'plan' as const,
                })
            }
        }
    } catch {
        // DB not migrated — fail open with no plan providers
    }

    return NextResponse.json({ byok, plan, quota })
}
