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

    // Fetch user's active subscription + plan allowedIntegrations
    const subscription = await prisma.subscription.findFirst({
        where: { userId, status: { in: ['active', 'trialing'] } },
        select: {
            plan: {
                select: { allowedIntegrations: true }
            }
        },
    })

    // Strictly use what admin configured on the plan.
    // null / not subscribed → no integrations unlocked → cards show Upgrade button
    const raw = subscription?.plan?.allowedIntegrations
    const allowedIntegrations: string[] = Array.isArray(raw) ? (raw as string[]) : []

    return <IntegrationsClient allowedIntegrations={allowedIntegrations} />
}
