import type { IExternalDBConnector, ExternalDBConfig } from '../interface'

// Stub — implement when SQLite is needed
export const sqliteAdapter: IExternalDBConnector = {
    async testConnection(_config: ExternalDBConfig) {
        return { ok: false, error: 'SQLite adapter coming soon' }
    },
    async getTables() { return [] },
    async query() { return { rows: [], fields: [], rowCount: 0 } },
    async getRows() { return { rows: [], total: 0, fields: [] } },
}
