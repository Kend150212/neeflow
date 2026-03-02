import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DataExplorerClient } from './client'
import { getConnector } from '@/lib/external-db'
import type { ExternalDBConfig } from '@/lib/external-db/interface'

export const metadata = {
    title: 'Data Explorer · External DB',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export default async function DataExplorerPage({
    searchParams,
}: {
    searchParams?: Promise<{ channelId?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const userId = session.user.id as string
    const resolvedParams = await searchParams
    const channelId = resolvedParams?.channelId

    // Must have a channelId to look up per-channel config
    if (!channelId) {
        redirect('/dashboard/integrations/external-db')
    }

    // Load db config scoped to this channel
    const config = await db.externalDbConfig.findUnique({
        where: { userId_channelId: { userId, channelId } },
    })
    if (!config || config.testStatus !== 'ok') {
        redirect(`/dashboard/integrations/external-db?channelId=${channelId}`)
    }

    // Decode password (base64)
    const password = config.password
        ? Buffer.from(config.password, 'base64').toString('utf-8')
        : ''

    const dbConfig: ExternalDBConfig = {
        dbType: config.dbType,
        host: config.host ?? undefined,
        port: config.port ?? undefined,
        database: config.database,
        username: config.username ?? undefined,
        password,
        ssl: config.ssl,
        queryTimeout: config.queryTimeout ?? 5000,
    }

    // Get visible tables from permissions
    const perms = (config.tablePermissions ?? {}) as Record<string, { visible: boolean; readable: boolean; imageColumn?: string }>
    let visibleTables: string[] = Object.entries(perms)
        .filter(([, p]) => p.visible && p.readable)
        .map(([name]) => name)

    // Fallback: if no permissions saved yet, query live from connector
    if (visibleTables.length === 0) {
        try {
            const connector = getConnector(config.dbType)
            const liveTablesResult = await connector.getTables(dbConfig)
            visibleTables = liveTablesResult.map(t => t.name)
        } catch {
            // If live query fails, redirect back to setup
            redirect(`/dashboard/integrations/external-db?channelId=${channelId}`)
        }
    }

    return (
        <DataExplorerClient
            channelId={channelId}
            dbName={config.database}
            dbType={config.dbType}
            configId={config.id}
            tables={visibleTables}
            tablePermissions={config.tablePermissions as Record<string, { imageColumn?: string }> ?? {}}
        />
    )
}
