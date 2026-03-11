import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

// GET /api/support/tickets/[id] — full thread
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const ticket = await db.supportTicket.findFirst({
        where: { id, userId: session.user.id },
        include: {
            messages: {
                where: { isInternal: false }, // users can't see internal notes
                orderBy: { createdAt: 'asc' },
                include: { sender: { select: { id: true, name: true, image: true, role: true } } },
            },
        },
    })

    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(ticket)
}

// PATCH /api/support/tickets/[id] — user replies to their ticket
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { message } = await req.json()

    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const ticket = await db.supportTicket.findFirst({ where: { id, userId: session.user.id } })
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (ticket.status === 'closed') return NextResponse.json({ error: 'Ticket is closed' }, { status: 400 })

    const msg = await db.ticketMessage.create({
        data: {
            ticketId: id,
            senderId: session.user.id,
            content: message,
            isInternal: false,
            isBotMsg: false,
            attachments: [],
        },
        include: { sender: { select: { id: true, name: true, image: true, role: true } } },
    })

    // Reopen ticket to pending if resolved
    if (ticket.status === 'resolved') {
        await db.supportTicket.update({ where: { id }, data: { status: 'pending' } })
    }

    return NextResponse.json(msg, { status: 201 })
}
