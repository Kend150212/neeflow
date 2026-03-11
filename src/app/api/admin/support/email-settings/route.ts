import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption'

const PROVIDER = 'support_smtp'
const CATEGORY = 'EMAIL' as const

async function ensureRecord() {
    return prisma.apiIntegration.upsert({
        where: { category_provider: { category: CATEGORY, provider: PROVIDER } },
        update: {},
        create: {
            category: CATEGORY,
            provider: PROVIDER,
            name: 'Support Email (SMTP)',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE',
            baseUrl: null,
        },
    })
}

// GET — return current config (masked password)
export async function GET() {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rec = await ensureRecord()
    const config = (rec.config ?? {}) as Record<string, string>
    const hasPassword = !!rec.apiKeyEncrypted

    return NextResponse.json({
        id: rec.id,
        isActive: rec.isActive,
        status: rec.status,
        hasPassword,
        apiKeyMasked: rec.apiKeyEncrypted ? maskApiKey(decrypt(rec.apiKeyEncrypted)) : null,
        host: config.host ?? 'smtp.gmail.com',
        port: config.port ?? '465',
        secure: config.secure ?? 'ssl',
        username: config.username ?? '',
        fromName: config.fromName ?? '',
        fromEmail: config.fromEmail ?? '',
    })
}

// PATCH — save config
export async function PATCH(req: Request) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { host, port, secure, username, password, fromName, fromEmail, isActive } = body

    const rec = await ensureRecord()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
        config: { host, port, secure, username, fromName, fromEmail },
        isActive: isActive ?? rec.isActive,
        status: (isActive ?? rec.isActive) ? 'ACTIVE' : 'INACTIVE',
    }

    // Only update encrypted password if provided
    if (password && password.trim()) {
        updateData.apiKeyEncrypted = encrypt(password)
    }

    const updated = await prisma.apiIntegration.update({
        where: { id: rec.id },
        data: updateData,
    })

    return NextResponse.json({
        success: true,
        id: updated.id,
        isActive: updated.isActive,
        hasPassword: !!updated.apiKeyEncrypted,
    })
}
