import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// GET /api/admin/email-templates
export async function GET() {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const templates = await db.emailTemplate.findMany({
            orderBy: { key: 'asc' },
        })
        return NextResponse.json(templates)
    } catch (error) {
        console.error('[email-templates] GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }
}

// POST /api/admin/email-templates  (create)
export async function POST(req: NextRequest) {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { key, name, description, subject, htmlBody, variables } = body

        if (!key || !name || !subject || !htmlBody) {
            return NextResponse.json({ error: 'key, name, subject, and htmlBody are required' }, { status: 400 })
        }

        const template = await db.emailTemplate.create({
            data: { key, name, description, subject, htmlBody, variables: variables ?? [] },
        })
        return NextResponse.json(template, { status: 201 })
    } catch (error: unknown) {
        if ((error as { code?: string })?.code === 'P2002') {
            return NextResponse.json({ error: 'A template with that key already exists' }, { status: 409 })
        }
        console.error('[email-templates] POST error:', error)
        return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }
}
