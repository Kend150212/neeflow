/**
 * IExternalDBConnector — interface all adapters must implement
 */

export interface TableInfo {
    name: string
    rowCount: number
}

export interface QueryResult {
    rows: Record<string, unknown>[]
    fields: string[]
    rowCount: number
}

export interface ConnectionTestResult {
    ok: boolean
    latencyMs?: number
    error?: string
    tables?: TableInfo[]
}

export interface ExternalDBConfig {
    dbType: 'mysql' | 'mariadb' | 'postgresql' | 'sqlite'
    host?: string
    port?: number
    database: string
    username?: string
    password?: string
    ssl?: boolean
    queryTimeout?: number
}

export interface IExternalDBConnector {
    /** Test the connection and return table list */
    testConnection(config: ExternalDBConfig): Promise<ConnectionTestResult>

    /** List all tables with approximate row counts */
    getTables(config: ExternalDBConfig): Promise<TableInfo[]>

    /** Execute a read-only SELECT query */
    query(config: ExternalDBConfig, sql: string, params?: unknown[]): Promise<QueryResult>

    /** Get paginated rows from a specific table */
    getRows(
        config: ExternalDBConfig,
        table: string,
        options: { page: number; pageSize: number; search?: string }
    ): Promise<{ rows: Record<string, unknown>[]; total: number; fields: string[] }>
}
