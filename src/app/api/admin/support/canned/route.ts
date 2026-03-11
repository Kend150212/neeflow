import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'

const db = prisma as any

function requireAdmin(session: { user?: { role?: string } } | null) {
    return !session?.user || session.user.role !== 'ADMIN'
}

// GET /api/admin/support/canned — list all canned responses
export async function GET() {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const responses = await db.cannedResponse.findMany({
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
    })

    return NextResponse.json(responses)
}

// POST /api/admin/support/canned
export async function POST(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, content, category, shortcut } = await req.json()

    if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })

    const response = await db.cannedResponse.create({
        data: { title, content, category: category || 'general', shortcut: shortcut || '' },
    })

    return NextResponse.json(response, { status: 201 })
}

// PATCH /api/admin/support/canned — update one
export async function PATCH(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updated = await db.cannedResponse.update({ where: { id }, data })
    return NextResponse.json(updated)
}

// DELETE /api/admin/support/canned?id=
export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (requireAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await db.cannedResponse.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
