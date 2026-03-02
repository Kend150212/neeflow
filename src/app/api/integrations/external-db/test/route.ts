import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getConnector } from '@/lib/external-db'
import type { ExternalDBConfig } from '@/lib/external-db'

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
