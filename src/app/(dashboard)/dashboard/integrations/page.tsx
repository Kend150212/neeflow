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

    // Check if user has any active subscription
    const subscription = await prisma.subscription.findFirst({
        where: { userId, status: { in: ['active', 'trialing'] } },
        select: { id: true, planId: true },
    })

    let allowedIntegrations: string[] = []

    if (subscription?.planId) {
        // Try to read allowedIntegrations via raw SQL — column may not exist yet if migration hasn't run
        try {
            const rows = await prisma.$queryRaw<{ allowed_integrations: unknown }[]>`
                SELECT allowed_integrations FROM plans WHERE id = ${subscription.planId} LIMIT 1
            `
            const raw = rows[0]?.allowed_integrations
            if (Array.isArray(raw)) {
                allowedIntegrations = raw as string[]
            } else if (raw === null || raw === undefined) {
                // Column exists but null — no integrations configured yet on this plan.
                // Default: allow external_db for all paid subscribers.
                allowedIntegrations = ['external_db']
            }
        } catch {
            // Column doesn't exist yet (migration pending) — allow external_db for all subscribers
            allowedIntegrations = ['external_db']
        }
    }

    return <IntegrationsClient allowedIntegrations={allowedIntegrations} />
}
