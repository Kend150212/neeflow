import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { IntegrationsClient } from './client'

export const metadata = {
    title: 'Integrations',
    description: 'Plug in any data. Let AI do the rest.',
}

export default async function IntegrationsPage() {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const userId = session.user.id as string

    // Fetch user's active subscription + plan + add-ons
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const subscription = await db.subscription.findFirst({
        where: { userId, status: { in: ['active', 'trialing'] } },
        select: {
            plan: { select: { allowedIntegrations: true } },
            addons: {
                where: { status: 'active' },
                select: {
                    addon: { select: { integrationSlug: true } }
                }
            }
        },
    })

    // Integrations unlocked via plan
    const planIntegrations: string[] = Array.isArray(subscription?.plan?.allowedIntegrations)
        ? (subscription.plan.allowedIntegrations as string[])
        : []

    // Integrations unlocked via purchased add-ons
    const addonIntegrations: string[] = (subscription?.addons ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((sa: any) => sa.addon?.integrationSlug)
        .filter(Boolean) as string[]

    // Merge: plan + addon access
    const allowedIntegrations = [...new Set([...planIntegrations, ...addonIntegrations])]

    // Fetch all active integration add-ons available for purchase
    // (so cards can show "Get Add-on" when an add-on exists for that slug)
    const availableAddonsList = await db.addon.findMany({
        where: { isActive: true, integrationSlug: { not: null } },
        select: {
            integrationSlug: true,
            displayName: true,
            priceMonthly: true,
            name: true,
        }
    })
    // Map slug → addon info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addonsBySlug: Record<string, { name: string; displayName: string; priceMonthly: number }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of (availableAddonsList as any[])) {
        if (a.integrationSlug) addonsBySlug[a.integrationSlug] = a
    }

    return (
        <IntegrationsClient
            allowedIntegrations={allowedIntegrations}
            addonsBySlug={addonsBySlug}
        />
    )
}
