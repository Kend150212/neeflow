/**
 * external-db-context.ts
 * Builds a live context block from External DB for bot prompts (Option C).
 * Searches configured tables using the user's message and returns top matching rows.
 * Token-efficient: only injects relevant rows, not entire tables.
 */

import { prisma } from '@/lib/prisma'
import { getConnector } from '@/lib/external-db'
import type { ExternalDBConfig } from '@/lib/external-db/interface'

// Simple base64 decode (same as in API route)
function decodePassword(encoded: string): string {
    try {
        return Buffer.from(encoded, 'base64').toString('utf-8')
    } catch {
        return encoded
    }
}

function formatRowsAsText(tableName: string, rows: Record<string, unknown>[], fields: string[]): string {
    if (rows.length === 0) return ''

    const header = `| ${fields.join(' | ')} |`
    const divider = `| ${fields.map(() => '---').join(' | ')} |`
    const rowLines = rows.map(r =>
        `| ${fields.map(f => {
            const v = r[f]
            if (v === null || v === undefined) return ''
            return String(v).slice(0, 80).replace(/\|/g, '／')
        }).join(' | ')} |`
    )
    return `### ${tableName}\n${header}\n${divider}\n${rowLines.join('\n')}`
}

/**
 * Build External DB context for bot prompt.
 * Returns empty string if bot query is not configured/enabled.
 */
export async function buildExternalDbContext(
    channelId: string,
    userMessage: string
): Promise<string> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any

        // Find config linked to this channel with bot query enabled
        const link = await db.externalDbChannelLink.findFirst({
            where: { channelId },
            include: { config: true },
        })

        if (!link?.config) return ''

        const config = link.config
        if (!config.botQueryEnabled) return ''

        // Decode password
        const password = config.password ? decodePassword(config.password) : ''

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

        // Get tables to search: use botQueryTables if set, otherwise all visible+readable from permissions
        const botQueryTables = (config.botQueryTables as string[]) || []
        const perms = (config.tablePermissions ?? {}) as Record<string, { visible: boolean; readable: boolean }>

        let tablesToSearch: string[]
        if (botQueryTables.length > 0) {
            tablesToSearch = botQueryTables
        } else {
            tablesToSearch = Object.entries(perms)
                .filter(([, p]) => p.visible && p.readable)
                .map(([name]) => name)
                .slice(0, 5) // Safety: max 5 tables when no specific config
        }

        if (tablesToSearch.length === 0) return ''

        const maxRows = config.botMaxRows ?? 10
        const connector = getConnector(config.dbType)
        const contextBlocks: string[] = []

        // Search each table in parallel (max concurrency 3)
        const chunks: string[][] = []
        for (let i = 0; i < tablesToSearch.length; i += 3) {
            chunks.push(tablesToSearch.slice(i, i + 3))
        }

        for (const chunk of chunks) {
            const results = await Promise.allSettled(
                chunk.map(table =>
                    connector.getRows(dbConfig, table, {
                        page: 1,
                        pageSize: maxRows,
                        search: userMessage,
                    })
                )
            )

            for (let i = 0; i < chunk.length; i++) {
                const result = results[i]
                if (result.status === 'fulfilled' && result.value.rows.length > 0) {
                    const block = formatRowsAsText(chunk[i], result.value.rows, result.value.fields)
                    if (block) contextBlocks.push(block)
                }
            }
        }

        if (contextBlocks.length === 0) return ''

        return `## Live Database Results (searched: "${userMessage.slice(0, 50)}")\n\n${contextBlocks.join('\n\n')}`
    } catch (err) {
        // Silently fail — don't break bot if DB is down
        console.error('[ExternalDbContext] Error:', err)
        return ''
    }
}
