/**
 * GET  /api/user/sync-schedule → returns current schedule config
 * POST /api/user/sync-schedule → updates schedule config + restarts in-process cron
 *
 * Body (POST): { hour: number, enabled: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { readScheduleConfig, updateSyncScheduler } from '@/lib/sync-scheduler'

export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const config = readScheduleConfig()
    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || ''
    return NextResponse.json({ ...config, baseUrl })
}

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { hour, enabled } = await req.json()
    if (typeof hour !== 'number' || hour < 0 || hour > 23) {
        return NextResponse.json({ error: 'hour must be 0–23' }, { status: 400 })
    }

    updateSyncScheduler(Math.floor(hour), enabled !== false)

    return NextResponse.json({ ok: true, hour, enabled: enabled !== false })
}
