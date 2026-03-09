/**
 * GET  /api/user/sync-schedule → returns current schedule config (hour, timezone, enabled)
 * POST /api/user/sync-schedule → updates config + restarts in-process cron with new timezone
 *
 * Body (POST): { hour: number, timezone: string, enabled: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readScheduleConfig, updateSyncScheduler } from '@/lib/sync-scheduler'

export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const config = readScheduleConfig()
    return NextResponse.json(config)
}

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { hour, timezone, enabled } = await req.json()
    if (typeof hour !== 'number' || hour < 0 || hour > 23) {
        return NextResponse.json({ error: 'hour must be 0–23' }, { status: 400 })
    }
    const tz = typeof timezone === 'string' && timezone ? timezone : 'UTC'

    updateSyncScheduler(Math.floor(hour), tz, enabled !== false)

    return NextResponse.json({ ok: true, hour, timezone: tz, enabled: enabled !== false })
}
