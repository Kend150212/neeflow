import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'
import { getConnector } from '@/lib/external-db'
import type { ExternalDBConfig } from '@/lib/external-db'
import { checkIntegrationAccess } from '@/lib/integration-access'

function decryptPassword(encrypted: string): string {
    try { return Buffer.from(encrypted, 'base64').toString('utf-8') } catch { return encrypted }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id as string
    if (!await checkIntegrationAccess(userId, 'external_db'))
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.' }, { status: 403 })
    const dbConfig = await db.externalDbConfig.findFirst({ where: { userId, isActive: true } })
    if (!dbConfig) return NextResponse.json({ error: 'No active DB config' }, { status: 404 })

    const config: ExternalDBConfig = {
        dbType: dbConfig.dbType as ExternalDBConfig['dbType'],
        host: dbConfig.host ?? undefined,
        port: dbConfig.port ?? undefined,
        database: dbConfig.database,
        username: dbConfig.username ?? undefined,
        password: dbConfig.password ? decryptPassword(dbConfig.password) : undefined,
        ssl: dbConfig.ssl,
        queryTimeout: dbConfig.queryTimeout,
    }

    try {
        const connector = getConnector(config.dbType)
        const tables = await connector.getTables(config)
        return NextResponse.json({ tables, tablePermissions: dbConfig.tablePermissions })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}

// PUT — save table permissions
export async function PUT(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id as string
    if (!await checkIntegrationAccess(userId, 'external_db'))
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.' }, { status: 403 })
    const { tablePermissions } = await req.json()

    const dbConfig = await db.externalDbConfig.findFirst({ where: { userId } })
    if (!dbConfig) return NextResponse.json({ error: 'No config found' }, { status: 404 })

    await db.externalDbConfig.update({
        where: { id: dbConfig.id },
        data: { tablePermissions },
    })

    return NextResponse.json({ success: true })
}
