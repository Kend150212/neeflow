import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

// GET /api/support/tickets — list my tickets
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') || ''
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const limit = 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId: session.user.id }
    if (status) where.status = status

    const [tickets, total] = await Promise.all([
        db.supportTicket.findMany({
            where,
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            include: {
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                _count: { select: { messages: true } },
            },
        }),
        db.supportTicket.count({ where }),
    ])

    return NextResponse.json({ tickets, total, page, limit })
}

// POST /api/support/tickets — create ticket
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subject, category, priority, message } = await req.json()

    if (!subject || !category || !message) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const ticket = await db.supportTicket.create({
        data: {
            userId: session.user.id,
            subject,
            category,
            priority: priority || 'medium',
            status: 'open',
            messages: {
                create: {
                    senderId: session.user.id,
                    content: message,
                    isInternal: false,
                    isBotMsg: false,
                    attachments: [],
                },
            },
        },
        include: {
            messages: true,
        },
    })

    return NextResponse.json(ticket, { status: 201 })
}
