import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// GET /api/admin/email-templates/[key]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { key } = await params
    try {
        const template = await db.emailTemplate.findUnique({ where: { key } })
        if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json(template)
    } catch (error) {
        console.error('[email-templates GET key]', error)
        return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
    }
}

// PATCH /api/admin/email-templates/[key]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { key } = await params
    try {
        const body = await req.json()
        const { name, description, subject, htmlBody, variables, isActive } = body
        const template = await db.emailTemplate.update({
            where: { key },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(subject !== undefined && { subject }),
                ...(htmlBody !== undefined && { htmlBody }),
                ...(variables !== undefined && { variables }),
                ...(isActive !== undefined && { isActive }),
            },
        })
        return NextResponse.json(template)
    } catch (error: unknown) {
        if ((error as { code?: string })?.code === 'P2025') {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }
        console.error('[email-templates PATCH key]', error)
        return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }
}

// DELETE /api/admin/email-templates/[key]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { key } = await params
    try {
        await db.emailTemplate.delete({ where: { key } })
        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        if ((error as { code?: string })?.code === 'P2025') {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }
        console.error('[email-templates DELETE key]', error)
        return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }
}
