import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'
import { ExternalDbSetupClient } from './client'

export const metadata = {
    title: 'External Database · Integrations',
}

const db = prisma as any // cast until Prisma types regenerate post-migration

export default async function ExternalDbPage({
    searchParams,
}: {
    searchParams?: Promise<{ channelId?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const userId = session.user.id as string
    const resolvedParams = await searchParams
    const channelId = resolvedParams?.channelId ?? null

    // Get channels available via ChannelMember
    const memberships = await prisma.channelMember.findMany({
        where: { userId },
        select: { channel: { select: { id: true, displayName: true } } },
    })
    const channels = memberships.map(m => m.channel)

    // Load config for the active channel (if channelId is known)
    const config = channelId
        ? await db.externalDbConfig.findUnique({
            where: { userId_channelId: { userId, channelId } },
            include: {
                channelLinks: { select: { channelId: true } },
            },
        })
        : null

    return (
        <ExternalDbSetupClient
            activeChannelId={channelId}
            initialConfig={config ? {
                id: config.id,
                dbType: config.dbType,
                host: config.host ?? '',
                port: config.port?.toString() ?? '',
                database: config.database,
                username: config.username ?? '',
                ssl: config.ssl,
                queryTimeout: config.queryTimeout,
                schemaHint: config.schemaHint ?? '',
                testStatus: config.testStatus ?? null,
                lastTestedAt: config.lastTestedAt?.toISOString() ?? null,
                tablePermissions: config.tablePermissions as Record<string, { visible: boolean; readable: boolean; writable: boolean }>,
                botQueryEnabled: config.botQueryEnabled ?? false,
                botQueryTables: (config.botQueryTables as string[]) ?? [],
                botMaxRows: config.botMaxRows ?? 10,
            } : null}
            channels={channels}
        />
    )
}
