import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { checkIntegrationAccess } from '@/lib/integration-access'
import EtsyClient from './client'

export default async function EtsyIntegrationPage({
    searchParams,
}: {
    searchParams: Promise<{ channelId?: string; connected?: string; error?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const hasAccess = await checkIntegrationAccess(session.user.id, 'etsy')
    if (!hasAccess) redirect('/dashboard/integrations?upgrade=etsy')

    const params = await searchParams
    const serverChannelId = params.channelId ?? null
    const connected = params.connected === '1'
    const error = params.error ?? null

    return (
        <EtsyClient
            userId={session.user.id}
            serverChannelId={serverChannelId}
            initialConnected={connected}
            initialError={error}
        />
    )
}
