/**
 * In-process product sync scheduler using node-cron.
 *
 * Reads the schedule (hour) from /tmp/neeflow-sync-schedule.json
 * (or SYNC_SCHEDULE_PATH env var). Defaults to 2:00 AM daily.
 *
 * Called from instrumentation.ts on server startup.
 * Also called when user updates schedule via /api/user/sync-schedule.
 */

import * as fs from 'fs'
import * as path from 'path'
import cron, { ScheduledTask } from 'node-cron'

const SCHEDULE_FILE = process.env.SYNC_SCHEDULE_PATH
    || path.join(process.cwd(), '.sync-schedule.json')

interface ScheduleConfig {
    hour: number   // 0–23
    enabled: boolean
}

const DEFAULT_CONFIG: ScheduleConfig = { hour: 2, enabled: true }

export function readScheduleConfig(): ScheduleConfig {
    try {
        const raw = fs.readFileSync(SCHEDULE_FILE, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<ScheduleConfig>
        return {
            hour: typeof parsed.hour === 'number' ? Math.max(0, Math.min(23, parsed.hour)) : DEFAULT_CONFIG.hour,
            enabled: parsed.enabled !== false,
        }
    } catch {
        return DEFAULT_CONFIG
    }
}

export function writeScheduleConfig(config: ScheduleConfig): void {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

// ─── Singleton task handle ────────────────────────────────────────────────────
let currentTask: ScheduledTask | null = null

export function startSyncScheduler(): void {
    const config = readScheduleConfig()

    // Stop any existing task
    if (currentTask) {
        currentTask.stop()
        currentTask = null
    }

    if (!config.enabled) {
        console.log('[scheduler] Auto-sync disabled — skipping registration')
        return
    }

    const expression = `0 ${config.hour} * * *`   // e.g. "0 2 * * *" for 2:00 AM
    console.log(`[scheduler] Registering daily product sync at ${String(config.hour).padStart(2, '0')}:00 (${expression})`)

    currentTask = cron.schedule(expression, async () => {
        console.log(`[scheduler] 🔄 Running scheduled product sync — ${new Date().toISOString()}`)
        try {
            const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000'
            const secret = process.env.CRON_SECRET || ''
            const res = await fetch(`${baseUrl}/api/cron/sync-products`, {
                headers: { 'x-cron-secret': secret },
                signal: AbortSignal.timeout(300_000),  // 5 min max
            })
            const data = await res.json().catch(() => ({}))
            console.log(`[scheduler] ✅ Sync complete:`, data)
        } catch (err) {
            console.error('[scheduler] ❌ Sync error:', err)
        }
    }, {
        timezone: 'UTC',
    })
}

/** Re-schedule after user changes the hour. */
export function updateSyncScheduler(hour: number, enabled: boolean): void {
    writeScheduleConfig({ hour, enabled })
    startSyncScheduler()
}
