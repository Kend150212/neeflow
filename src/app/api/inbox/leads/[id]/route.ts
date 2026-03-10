import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/inbox/leads/[id]
 * Update a lead's fields (status, name, phone, etc.)
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const allowed = ['fullName', 'phone', 'email', 'address', 'note', 'tags', 'customFields', 'status']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    for (const key of allowed) {
        if (body[key] !== undefined) data[key] = body[key]
    }

    const contact = await prisma.inboxContact.update({
        where: { id },
        data,
    })

    return NextResponse.json(contact)
}

/**
 * DELETE /api/inbox/leads/[id]
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await prisma.inboxContact.delete({ where: { id } })

    return NextResponse.json({ ok: true })
}
