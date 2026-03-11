import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

function requireAdmin(session: { user?: { role?: string; id?: string } } | null) {
    return !session?.user || session.user.role !== 'ADMIN'
}

// GET /api/admin/support/tickets/[id] — full thread including internal notes
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const ticket = await db.supportTicket.findFirst({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    createdAt: true,
                    isActive: true,
                    subscription: {
                        select: {
                            status: true,
                            currentPeriodEnd: true,
                            plan: { select: { name: true } },
                        },
                    },
                },
            },
            agent: { select: { id: true, name: true, image: true } },
            messages: {
                orderBy: { createdAt: 'asc' },
                include: { sender: { select: { id: true, name: true, image: true, role: true } } },
            },
        },
    })

    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(ticket)
}

// PATCH /api/admin/support/tickets/[id]
// Actions: reply | internalNote | assign | status | priority
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { action } = body

    const ticket = await db.supportTicket.findFirst({ where: { id } })
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'reply' || action === 'internalNote') {
        const msg = await db.ticketMessage.create({
            data: {
                ticketId: id,
                senderId: session!.user!.id,
                content: body.message,
                isInternal: action === 'internalNote',
                isBotMsg: false,
                attachments: body.attachments || [],
            },
            include: { sender: { select: { id: true, name: true, image: true, role: true } } },
        })
        // Move to pending when agent replies
        if (action === 'reply') {
            await db.supportTicket.update({ where: { id }, data: { status: 'pending' } })
        }
        return NextResponse.json(msg, { status: 201 })
    }

    if (action === 'assign') {
        const updated = await db.supportTicket.update({
            where: { id },
            data: { assignedTo: body.agentId || null },
        })
        return NextResponse.json(updated)
    }

    if (action === 'status') {
        const data: Record<string, unknown> = { status: body.status }
        if (body.status === 'resolved') data.resolvedAt = new Date()
        const updated = await db.supportTicket.update({ where: { id }, data })
        return NextResponse.json(updated)
    }

    if (action === 'priority') {
        const updated = await db.supportTicket.update({ where: { id }, data: { priority: body.priority } })
        return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
