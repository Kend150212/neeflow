/**
 * In-process product sync scheduler using node-cron.
 *
 * Reads the schedule (hour + timezone) from .sync-schedule.json.
 * Defaults to 2:00 AM in the channel's local timezone (or UTC).
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
    hour: number       // 0–23 in the given timezone
    timezone: string   // IANA timezone, e.g. 'Asia/Ho_Chi_Minh', 'America/New_York'
    enabled: boolean
}

const DEFAULT_CONFIG: ScheduleConfig = { hour: 2, timezone: 'UTC', enabled: true }

export function readScheduleConfig(): ScheduleConfig {
    try {
        const raw = fs.readFileSync(SCHEDULE_FILE, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<ScheduleConfig>
        return {
            hour: typeof parsed.hour === 'number' ? Math.max(0, Math.min(23, parsed.hour)) : DEFAULT_CONFIG.hour,
            timezone: typeof parsed.timezone === 'string' && parsed.timezone ? parsed.timezone : DEFAULT_CONFIG.timezone,
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

    // Validate timezone — node-cron will throw if the timezone is invalid
    const timezone = cron.validate(`0 ${config.hour} * * *`) ? config.timezone : 'UTC'

    const expression = `0 ${config.hour} * * *`
    console.log(`[scheduler] Registering daily sync at ${String(config.hour).padStart(2, '0')}:00 ${timezone} (${expression})`)

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
        timezone,
    })
}

/** Re-schedule after user changes the config. */
export function updateSyncScheduler(hour: number, timezone: string, enabled: boolean): void {
    writeScheduleConfig({ hour, timezone, enabled })
    startSyncScheduler()
}
