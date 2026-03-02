import type { IExternalDBConnector, ExternalDBConfig } from './interface'
import { mysqlAdapter } from './adapters/mysql'
import { postgresqlAdapter } from './adapters/postgresql'
import { sqliteAdapter } from './adapters/sqlite'

export function getConnector(dbType: ExternalDBConfig['dbType']): IExternalDBConnector {
    switch (dbType) {
        case 'mysql':
        case 'mariadb':
            return mysqlAdapter
        case 'postgresql':
            return postgresqlAdapter
        case 'sqlite':
            return sqliteAdapter
        default:
            throw new Error(`Unsupported database type: ${dbType}`)
    }
}

export type { IExternalDBConnector, ExternalDBConfig, ConnectionTestResult, TableInfo, QueryResult } from './interface'
