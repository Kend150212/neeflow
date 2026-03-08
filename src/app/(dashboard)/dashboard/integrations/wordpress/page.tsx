import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { WordPressClient } from './client'
import { checkIntegrationAccess } from '@/lib/integration-access'

export const metadata = {
    title: 'WordPress Integration · Neeflow',
}

export default async function WordPressIntegrationPage({
    searchParams,
}: {
    searchParams?: Promise<{ channelId?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const hasAccess = await checkIntegrationAccess(session.user.id as string, 'wordpress')
    if (!hasAccess) redirect('/dashboard/integrations?upgrade=wordpress')

    const resolvedParams = await searchParams
    const channelId = resolvedParams?.channelId ?? null

    return (
        <WordPressClient
            key={channelId ?? 'no-channel'}
            userId={session.user.id as string}
            serverChannelId={channelId}
        />
    )
}
