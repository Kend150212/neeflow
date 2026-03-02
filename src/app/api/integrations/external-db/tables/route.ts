import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getConnector } from '@/lib/external-db'
import type { ExternalDBConfig } from '@/lib/external-db'
import { checkIntegrationAccess } from '@/lib/integration-access'
import { decrypt } from '@/lib/encryption'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id as string
    if (!await checkIntegrationAccess(userId, 'external_db'))
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.', messageVi: 'Nâng cấp gói để sử dụng tính năng External DB.' }, { status: 403 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })

    const dbConfig = await db.externalDbConfig.findUnique({
        where: { userId_channelId: { userId, channelId }, isActive: true },
    })
    if (!dbConfig) return NextResponse.json({ error: 'No active DB config for this channel' }, { status: 404 })

    const config: ExternalDBConfig = {
        dbType: dbConfig.dbType as ExternalDBConfig['dbType'],
        host: dbConfig.host ?? undefined,
        port: dbConfig.port ?? undefined,
        database: dbConfig.database,
        username: dbConfig.username ?? undefined,
        password: dbConfig.password ? decrypt(dbConfig.password) : undefined,
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
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.', messageVi: 'Nâng cấp gói để sử dụng tính năng External DB.' }, { status: 403 })

    const body = await req.json()
    const { channelId, tablePermissions } = body
    if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })

    const dbConfig = await db.externalDbConfig.findUnique({ where: { userId_channelId: { userId, channelId } } })
    if (!dbConfig) return NextResponse.json({ error: 'No config found for this channel' }, { status: 404 })

    await db.externalDbConfig.update({
        where: { id: dbConfig.id },
        data: { tablePermissions },
    })

    return NextResponse.json({ success: true })
}
