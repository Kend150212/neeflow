import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEffectiveLimits } from '@/lib/addon-resolver'

/**
 * GET /api/user/plan
 * Returns effective plan limits + feature flags for the current user.
 * Used by ChatBotTab to gate features like hasBotUsageAnalytics.
 */
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limits = await getEffectiveLimits(session.user.id)
    return NextResponse.json(limits)
}
