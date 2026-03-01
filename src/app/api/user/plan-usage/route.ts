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

    const [limits, imageUsageRow, postCount, apiKeyCount] = await Promise.all([
        getEffectiveLimits(userId),

        // AI Image usage this month — from UsageRecord
        db.usageRecord.aggregate({
            where: {
                userId,
                type: 'AI_IMAGE',
                createdAt: { gte: startOfMonth },
            },
            _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),

        // Posts published this month
        db.post.count({
            where: {
                channel: { userId },
                status: 'PUBLISHED',
                publishedAt: { gte: startOfMonth },
            },
        }).catch(() => 0),

        // Active API keys saved by user
        db.userApiKey.count({
            where: { userId },
        }).catch(() => 0),
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
        apiKeys: {
            count: apiKeyCount,
        },
        planName: null, // optional, can extend later
    })
}
