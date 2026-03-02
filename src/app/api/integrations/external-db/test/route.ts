import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getConnector } from '@/lib/external-db'
import type { ExternalDBConfig } from '@/lib/external-db'
import { checkIntegrationAccess } from '@/lib/integration-access'

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id as string
    if (!await checkIntegrationAccess(userId, 'external_db'))
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.', messageVi: 'Nâng cấp gói để sử dụng tính năng External DB.' }, { status: 403 })

    const body = await req.json()
    const { dbType, host, port, database, username, password, ssl, queryTimeout } = body

    if (!dbType || !database) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const config: ExternalDBConfig = {
        dbType,
        host,
        port: port ? parseInt(port) : undefined,
        database,
        username,
        password,
        ssl: !!ssl,
        queryTimeout: queryTimeout ?? 5000,
    }

    try {
        const connector = getConnector(dbType)
        const result = await connector.testConnection(config)
        return NextResponse.json(result)
    } catch (e) {
        return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
    }
}
