import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'
import { ExternalDbSetupClient } from './client'

export const metadata = {
    title: 'External Database · Integrations',
}

const db = prisma as any // cast until Prisma types regenerate post-migration

export default async function ExternalDbPage() {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const userId = session.user.id as string

    // Load existing DB config for this user
    const config = await db.externalDbConfig.findFirst({
        where: { userId },
        include: {
            channelLinks: { select: { channelId: true } },
        },
    })

    // Get channels available via ChannelMember
    const memberships = await prisma.channelMember.findMany({
        where: { userId },
        select: { channel: { select: { id: true, displayName: true } } },
    })
    const channels = memberships.map(m => m.channel)

    return (
        <ExternalDbSetupClient
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
                channelIds: config.channelLinks.map((l: { channelId: string }) => l.channelId),
            } : null}
            channels={channels}
        />
    )
}
