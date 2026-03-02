import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * Check whether a user has access to a specific integration slug.
 * Access can come from:
 *   1. The plan's allowedIntegrations JSON array
 *   2. An active add-on whose integrationSlug matches
 *
 * Returns true if access is granted, false otherwise.
 */
export async function checkIntegrationAccess(
    userId: string,
    slug: string
): Promise<boolean> {
    try {
        const sub = await db.subscription.findFirst({
            where: { userId, status: { in: ['active', 'trialing'] } },
            select: {
                plan: { select: { allowedIntegrations: true } },
                addons: {
                    where: { status: 'active' },
                    select: { addon: { select: { integrationSlug: true } } },
                },
            },
        })

        if (!sub) return false

        // Check plan
        const planSlugs: string[] = Array.isArray(sub.plan?.allowedIntegrations)
            ? sub.plan.allowedIntegrations as string[]
            : []
        if (planSlugs.includes(slug)) return true

        // Check add-ons
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addonSlugs: string[] = (sub.addons ?? []).map((sa: any) => sa.addon?.integrationSlug).filter(Boolean)
        if (addonSlugs.includes(slug)) return true

        return false
    } catch {
        return false
    }
}
