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
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Get user's subscription
    const subscription = await db.subscription.findFirst({
        where: { userId },
        select: { id: true },
    }).catch(() => null)

    const [limits, usageRow] = await Promise.all([
        getEffectiveLimits(userId),

        // Read all usage fields from the Usage table for this month
        subscription
            ? db.usage.findUnique({
                where: {
                    subscriptionId_month: {
                        subscriptionId: subscription.id,
                        month: currentMonth,
                    },
                },
                select: {
                    imagesGenerated: true,
                    postsCreated: true,
                    apiCalls: true,
                },
            }).catch(() => null)
            : Promise.resolve(null),
    ])

    return NextResponse.json({
        aiImage: {
            used: usageRow?.imagesGenerated ?? 0,
            limit: limits.maxAiImagesPerMonth,
        },
        posts: {
            used: usageRow?.postsCreated ?? 0,
            limit: limits.maxPostsPerMonth,
        },
        apiCalls: {
            used: usageRow?.apiCalls ?? 0,
            limit: limits.maxApiCallsPerMonth,
        },
    })
}
