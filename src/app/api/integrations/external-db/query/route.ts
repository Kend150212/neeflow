import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getConnector } from '@/lib/external-db'

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
        const body = await req.json()
        const { table, page = 1, pageSize = 20, search = '', searchColumns = [] } = body

        if (!table) return NextResponse.json({ error: 'table is required' }, { status: 400 })

        // Load config
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = await (prisma as any).externalDbConfig.findFirst({ where: { userId } })
        if (!config) return NextResponse.json({ error: 'No database configured' }, { status: 404 })

        // Decode password
        const password = config.password
            ? Buffer.from(config.password, 'base64').toString('utf-8')
            : ''

        const connector = getConnector(config.dbType)
        await connector.connect({
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            password,
            ssl: config.ssl,
        })

        try {
            // Get total count
            let countSql = `SELECT COUNT(*) as cnt FROM \`${table}\``
            const whereClause = buildWhere(search, searchColumns)
            if (whereClause) countSql += ` WHERE ${whereClause}`

            const countRows = await connector.query(countSql, [])
            const total = Number((countRows[0] as Record<string, unknown>)?.cnt ?? 0)

            // Get paginated rows
            const offset = (page - 1) * pageSize
            let sql = `SELECT * FROM \`${table}\``
            if (whereClause) sql += ` WHERE ${whereClause}`
            sql += ` LIMIT ${pageSize} OFFSET ${offset}`

            const rows = await connector.query(sql, [])

            // Extract columns from first row
            const columns = rows.length > 0
                ? Object.keys(rows[0] as Record<string, unknown>)
                : []

            return NextResponse.json({ rows, total, columns, page, pageSize })
        } finally {
            await connector.disconnect()
        }
    } catch (err: unknown) {
        console.error('[/api/integrations/external-db/query] error:', err)
        const msg = err instanceof Error ? err.message : 'Query failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

function buildWhere(search: string, columns: string[]): string {
    if (!search || columns.length === 0) return ''
    const safe = search.replace(/'/g, "''")
    return columns.map(c => `\`${c}\` LIKE '%${safe}%'`).join(' OR ')
}
