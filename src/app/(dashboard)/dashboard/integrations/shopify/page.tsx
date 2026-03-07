import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ShopifyClient } from './client'

export const metadata = {
    title: 'Shopify Integration · Neeflow',
}

export default async function ShopifyIntegrationPage({
    searchParams,
}: {
    searchParams?: Promise<{ channelId?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const resolvedParams = await searchParams
    const channelId = resolvedParams?.channelId ?? null

    return (
        <ShopifyClient
            key={channelId ?? 'no-channel'}
            userId={session.user.id as string}
            serverChannelId={channelId}
        />
    )
}
