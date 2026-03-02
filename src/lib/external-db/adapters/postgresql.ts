import type { IExternalDBConnector, ExternalDBConfig } from '../interface'

// Stub — implement when PostgreSQL is needed
export const postgresqlAdapter: IExternalDBConnector = {
    async testConnection(_config: ExternalDBConfig) {
        return { ok: false, error: 'PostgreSQL adapter coming soon' }
    },
    async getTables() { return [] },
    async query() { return { rows: [], fields: [], rowCount: 0 } },
    async getRows() { return { rows: [], total: 0, fields: [] } },
}
