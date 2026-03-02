import type { IExternalDBConnector, ExternalDBConfig, ConnectionTestResult, TableInfo, QueryResult } from '../interface'

// MySQL blocklist — prevent write/destructive queries from chatbot
const BLOCKED_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE', '--', '/*']

function validateSelectOnly(sql: string) {
    const upper = sql.trim().toUpperCase()
    if (!upper.startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed')
    }
    for (const kw of BLOCKED_KEYWORDS) {
        if (upper.includes(kw)) {
            throw new Error(`Blocked keyword detected: ${kw}`)
        }
    }
}

async function createConnection(config: ExternalDBConfig) {
    const mysql = await import('mysql2/promise')
    return mysql.createConnection({
        host: config.host ?? 'localhost',
        port: config.port ?? 3306,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
        connectTimeout: config.queryTimeout ?? 5000,
        multipleStatements: false,
    })
}

export const mysqlAdapter: IExternalDBConnector = {
    async testConnection(config: ExternalDBConfig): Promise<ConnectionTestResult> {
        const start = Date.now()
        let conn
        try {
            conn = await createConnection(config)
            const [rows] = await conn.execute('SHOW TABLES')
            const latencyMs = Date.now() - start

            const tables: TableInfo[] = []
            for (const row of rows as Record<string, unknown>[]) {
                const tableName = Object.values(row)[0] as string
                try {
                    const [countRows] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${tableName}\``)
                    tables.push({
                        name: tableName,
                        rowCount: (countRows as { cnt: number }[])[0]?.cnt ?? 0,
                    })
                } catch {
                    tables.push({ name: tableName, rowCount: 0 })
                }
            }

            return { ok: true, latencyMs, tables }
        } catch (e) {
            return { ok: false, error: (e as Error).message }
        } finally {
            if (conn) await conn.end().catch(() => { })
        }
    },

    async getTables(config: ExternalDBConfig): Promise<TableInfo[]> {
        let conn
        try {
            conn = await createConnection(config)
            const [rows] = await conn.execute('SHOW TABLES')
            const tables: TableInfo[] = []
            for (const row of rows as Record<string, unknown>[]) {
                const tableName = Object.values(row)[0] as string
                try {
                    const [countRows] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${tableName}\``)
                    tables.push({ name: tableName, rowCount: (countRows as { cnt: number }[])[0]?.cnt ?? 0 })
                } catch {
                    tables.push({ name: tableName, rowCount: 0 })
                }
            }
            return tables
        } finally {
            if (conn) await conn.end().catch(() => { })
        }
    },

    async query(config: ExternalDBConfig, sql: string, params?: unknown[]): Promise<QueryResult> {
        validateSelectOnly(sql)
        let conn
        try {
            conn = await createConnection(config)
            const timeout = config.queryTimeout ?? 5000
            type ExecResult = [Record<string, unknown>[], import('mysql2').FieldPacket[]]
            const [rows, fields] = await Promise.race([
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                conn.execute(sql, (params ?? []) as any) as Promise<ExecResult>,
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), timeout)),
            ])

            return {
                rows: rows.slice(0, 50),
                fields: fields.map(f => f.name),
                rowCount: rows.length,
            }
        } finally {
            if (conn) await conn.end().catch(() => { })
        }
    },

    async getRows(config, table, { page, pageSize, search }) {
        let conn
        try {
            conn = await createConnection(config)
            // Get column info
            const [colRows] = await conn.execute(`DESCRIBE \`${table}\``)
            const fields = (colRows as { Field: string }[]).map(r => r.Field)

            const offset = (page - 1) * pageSize
            let sql = `SELECT * FROM \`${table}\``
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const params: any[] = []

            if (search) {
                // Search across all varchar/text columns
                const [colInfo] = await conn.execute(
                    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND DATA_TYPE IN ('varchar','text','char','tinytext','mediumtext','longtext')`,
                    [config.database, table]
                )
                const searchCols = (colInfo as { COLUMN_NAME: string }[]).map(r => r.COLUMN_NAME)
                if (searchCols.length > 0) {
                    sql += ` WHERE ` + searchCols.map(c => `\`${c}\` LIKE ?`).join(' OR ')
                    params.push(...searchCols.map(() => `%${search}%`))
                }
            }

            type CountResult = [{ cnt: number }[], import('mysql2').FieldPacket[]]
            const [countRows] = await conn.execute(
                `SELECT COUNT(*) as cnt FROM \`${table}\`` + (search && params.length > 0 ? ` WHERE ${sql.split('WHERE')[1]?.split('LIMIT')[0]}` : ''),
                params
            ) as unknown as CountResult
            const total = countRows[0]?.cnt ?? 0

            sql += ` LIMIT ${pageSize} OFFSET ${offset}`
            const [rows] = await conn.execute(sql, params) as unknown as [Record<string, unknown>[], import('mysql2').FieldPacket[]]

            return { rows: rows as Record<string, unknown>[], total, fields }
        } finally {
            if (conn) await conn.end().catch(() => { })
        }
    },
}
