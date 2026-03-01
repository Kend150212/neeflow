import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveLimits } from '@/lib/addon-resolver'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * GET /api/user/plan-usage
 * Returns plan limits + current usage counts for sidebar widget.
 */
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [limits, imageUsageRow, postCount, apiCallsUsage] = await Promise.all([
        getEffectiveLimits(userId),

        // AI Image usage — UsageRecord model not in schema yet, return 0
        Promise.resolve({ _sum: { amount: 0 } }),

        // Posts published this month
        db.post.count({
            where: {
                channel: { userId },
                status: 'PUBLISHED',
                publishedAt: { gte: startOfMonth },
            },
        }).catch(() => 0),

        // API Calls this month from Usage table
        db.usage.findFirst({
            where: {
                subscription: { userId },
                month: currentMonth,
            },
            select: { apiCalls: true },
        }).catch(() => null),
    ])

    return NextResponse.json({
        aiImage: {
            used: imageUsageRow._sum?.amount ?? 0,
            limit: limits.maxAiImagesPerMonth,
        },
        posts: {
            used: postCount,
            limit: limits.maxPostsPerMonth,
        },
        apiCalls: {
            used: apiCallsUsage?.apiCalls ?? 0,
            limit: limits.maxApiCallsPerMonth,
        },
        planName: null, // optional, can extend later
    })
}
