import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getConnector } from '@/lib/external-db'
import type { ExternalDBConfig } from '@/lib/external-db/interface'
import { checkIntegrationAccess } from '@/lib/integration-access'

/**
 * POST /api/integrations/external-db/query
 * Body: { table, page?, pageSize?, search?, searchColumns? }
 * Returns: { rows, total, columns, page, pageSize }
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const userId = session.user.id as string
        if (!await checkIntegrationAccess(userId, 'external_db'))
            return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.' }, { status: 403 })
        const body = await req.json()
        const { table, page = 1, pageSize = 20, search = '' } = body

        if (!table) return NextResponse.json({ error: 'table is required' }, { status: 400 })

        // Load config
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = await (prisma as any).externalDbConfig.findFirst({ where: { userId } })
        if (!config) return NextResponse.json({ error: 'No database configured' }, { status: 404 })

        // Decode password
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

        const connector = getConnector(config.dbType)

        // Use built-in getRows for paginated access
        const result = await connector.getRows(dbConfig, table, {
            page,
            pageSize,
            search: search || undefined,
        })

        return NextResponse.json({
            rows: result.rows,
            total: result.total,
            columns: result.fields,
            page,
            pageSize,
        })
    } catch (err: unknown) {
        console.error('[/api/integrations/external-db/query] error:', err)
        const msg = err instanceof Error ? err.message : 'Query failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
