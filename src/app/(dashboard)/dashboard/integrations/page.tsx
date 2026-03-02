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

    // Get user's active plan subscription — include plan to check allowedIntegrations
    const subscription = await prisma.subscription.findFirst({
        where: { userId: session.user.id as string, status: { in: ['active', 'trialing'] } },
        include: {
            plan: {
                select: {
                    id: true,
                    name: true,
                    // allowedIntegrations added via migration — cast via raw
                },
            },
        },
    })

    // After migration: plan.allowedIntegrations will be a JSON array of slugs
    // Until migration runs, access via Prisma raw or cast to any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planRaw = subscription?.plan as any
    const allowedIntegrations: string[] = Array.isArray(planRaw?.allowedIntegrations)
        ? planRaw.allowedIntegrations
        : []

    return <IntegrationsClient allowedIntegrations={allowedIntegrations} />
}
