import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Templates stored as JSON in a dedicated settings record
const SETTINGS_KEY = 'support_email_templates'

// GET — return all templates
export async function GET() {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // We store templates in the apiIntegration config field of the support_smtp record
    const rec = await prisma.apiIntegration.findFirst({
        where: { provider: 'support_smtp', category: 'EMAIL' },
    })

    const config = (rec?.config ?? {}) as Record<string, unknown>
    const templates = config[SETTINGS_KEY]

    return NextResponse.json(templates || {})
}

// PATCH — save a single template
export async function PATCH(req: Request) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { key, subject, html } = body
    if (!key || !subject || !html) {
        return NextResponse.json({ error: 'Missing key, subject, or html' }, { status: 400 })
    }

    // Upsert support_smtp record
    const rec = await prisma.apiIntegration.upsert({
        where: { category_provider: { category: 'EMAIL', provider: 'support_smtp' } },
        update: {},
        create: {
            category: 'EMAIL',
            provider: 'support_smtp',
            name: 'Support Email (SMTP)',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE',
        },
    })

    const existingConfig = (rec.config ?? {}) as Record<string, unknown>
    const existingTemplates = (existingConfig[SETTINGS_KEY] ?? {}) as Record<string, unknown>

    await prisma.apiIntegration.update({
        where: { id: rec.id },
        data: {
            config: {
                ...existingConfig,
                [SETTINGS_KEY]: {
                    ...existingTemplates,
                    [key]: { key, subject, html },
                },
            },
        },
    })

    return NextResponse.json({ success: true })
}
