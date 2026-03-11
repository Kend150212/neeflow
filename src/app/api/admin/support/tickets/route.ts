import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

function requireAdmin(session: { user?: { role?: string } } | null) {
    return !session?.user || session.user.role !== 'ADMIN'
}

// GET /api/admin/support/tickets?status=&priority=&assignedTo=&q=&page=1
export async function GET(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const assignedTo = searchParams.get('assignedTo') || '' // 'me' | userId | ''
    const q = searchParams.get('q') || ''
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const limit = 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (assignedTo === 'me') where.assignedTo = session!.user!.id
    else if (assignedTo === 'unassigned') where.assignedTo = null
    else if (assignedTo) where.assignedTo = assignedTo

    if (q) {
        where.OR = [
            { subject: { contains: q, mode: 'insensitive' } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
        ]
    }

    const [tickets, total] = await Promise.all([
        db.supportTicket.findMany({
            where,
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        createdAt: true,
                        subscription: {
                            select: { plan: { select: { name: true } } },
                        },
                    },
                },
                agent: { select: { id: true, name: true, image: true } },
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                _count: { select: { messages: true } },
            },
        }),
        db.supportTicket.count({ where }),
    ])

    return NextResponse.json({ tickets, total, page, limit })
}
