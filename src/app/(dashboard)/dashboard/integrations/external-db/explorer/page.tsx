import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DataExplorerClient } from './client'

export const metadata = {
    title: 'Data Explorer · External DB',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export default async function DataExplorerPage() {
    const session = await auth()
    if (!session?.user) redirect('/login')

    const userId = session.user.id as string

    // Load db config
    const config = await db.externalDbConfig.findFirst({ where: { userId } })
    if (!config || config.testStatus !== 'ok') {
        redirect('/dashboard/integrations/external-db')
    }

    // Get visible tables from permissions
    const perms = (config.tablePermissions ?? {}) as Record<string, { visible: boolean; readable: boolean }>
    const visibleTables = Object.entries(perms)
        .filter(([, p]) => p.visible && p.readable)
        .map(([name]) => name)

    return (
        <DataExplorerClient
            dbName={config.database}
            dbType={config.dbType}
            configId={config.id}
            tables={visibleTables}
        />
    )
}
