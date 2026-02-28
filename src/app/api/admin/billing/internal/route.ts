import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

/**
 * POST /api/admin/billing/internal
 * Toggle isInternal flag on one or more subscriptions.
 *
 * Body: { subscriptionIds: string[], isInternal: boolean }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    })
    if (admin?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { subscriptionIds, isInternal } = body

    if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
        return NextResponse.json({ error: 'subscriptionIds must be a non-empty array' }, { status: 400 })
    }

    if (typeof isInternal !== 'boolean') {
        return NextResponse.json({ error: 'isInternal must be a boolean' }, { status: 400 })
    }

    const updated = await db.subscription.updateMany({
        where: { id: { in: subscriptionIds } },
        data: { isInternal },
    })

    return NextResponse.json({
        success: true,
        count: updated.count,
        isInternal,
        message: isInternal
            ? `${updated.count} subscription(s) marked as internal — excluded from reports.`
            : `${updated.count} subscription(s) unmarked — will appear in reports again.`,
    })
}
