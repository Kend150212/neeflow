import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { to } = await req.json()
    if (!to) return NextResponse.json({ error: 'Missing recipient' }, { status: 400 })

    // Load support SMTP config
    const rec = await prisma.apiIntegration.findFirst({
        where: { provider: 'support_smtp', category: 'EMAIL' },
    })
    if (!rec) return NextResponse.json({ error: 'Support email not configured' }, { status: 400 })

    const config = (rec.config ?? {}) as Record<string, string>
    const encryptedPassword = rec.apiKeyEncrypted
    if (!config.username || !encryptedPassword) {
        return NextResponse.json({ error: 'SMTP username or password missing' }, { status: 400 })
    }

    const password = decrypt(encryptedPassword)
    const port = parseInt(config.port || '465')
    const secure = config.secure !== 'tls' && config.secure !== 'none'

    const transporter = nodemailer.createTransport({
        host: config.host || 'smtp.gmail.com',
        port,
        secure,
        auth: { user: config.username, pass: password },
    })

    const fromName = config.fromName || 'Support'
    const fromEmail = config.fromEmail || config.username

    await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: 'Test Email from Support System',
        html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
                <h2 style="color:#1a1a1a">✅ SMTP Connection Test</h2>
                <p style="color:#555">Your Support Email SMTP is configured correctly.</p>
                <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
                <p style="font-size:12px;color:#999">Sent from Neeflow Support System</p>
            </div>
        `,
    })

    return NextResponse.json({ success: true })
}
