import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

const DEFAULT_SETTINGS = {
    id: 'default',
    appName: 'NeeFlow',
    tagline: 'Social Media Management',
    logoUrl: '/logo.png',
    faviconUrl: '/favicon.ico',
    primaryColor: '#7c3aed',
    supportEmail: '',
    copyrightText: '',
    footerLinks: [],
    trialEnabled: true,
    trialDays: 14,
    trialPlanId: null as string | null,
}

/**
 * GET /api/admin/branding — public (needed for client rendering)
 */
export async function GET() {
    try {
        const settings = await db.siteSettings.findUnique({ where: { id: 'default' } })
        console.log('[Branding GET] DB result:', settings ? 'found' : 'not found (using defaults)')
        return NextResponse.json(settings ?? DEFAULT_SETTINGS)
    } catch (err) {
        console.error('[Branding GET] Error:', err)
        return NextResponse.json(DEFAULT_SETTINGS)
    }
}

/**
 * PUT /api/admin/branding — admin only
 */
export async function PUT(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
    })
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    console.log('[Branding PUT] Received body:', JSON.stringify(body))

    const {
        appName, tagline, logoUrl, faviconUrl,
        primaryColor, supportEmail, copyrightText, footerLinks,
        siteMode,
        trialEnabled, trialDays, trialPlanId,
    } = body

    try {
        const settings = await db.siteSettings.upsert({
            where: { id: 'default' },
            update: {
                ...(appName !== undefined && { appName }),
                ...(tagline !== undefined && { tagline }),
                ...(logoUrl !== undefined && { logoUrl }),
                ...(faviconUrl !== undefined && { faviconUrl }),
                ...(primaryColor !== undefined && { primaryColor }),
                ...(supportEmail !== undefined && { supportEmail }),
                ...(copyrightText !== undefined && { copyrightText }),
                ...(footerLinks !== undefined && { footerLinks }),
                ...(siteMode !== undefined && { siteMode }),
                ...(trialEnabled !== undefined && { trialEnabled }),
                ...(trialDays !== undefined && { trialDays }),
                ...(trialPlanId !== undefined && { trialPlanId }),
            },
            create: {
                id: 'default',
                appName: appName ?? 'NeeFlow',
                tagline: tagline ?? 'Social Media Management',
                logoUrl: logoUrl ?? '/logo.png',
                faviconUrl: faviconUrl ?? '/favicon.ico',
                primaryColor: primaryColor ?? '#7c3aed',
                supportEmail: supportEmail ?? '',
                copyrightText: copyrightText ?? '',
                footerLinks: footerLinks ?? [],
            },
        })

        console.log('[Branding PUT] Saved to DB:', JSON.stringify(settings))
        return NextResponse.json(settings)
    } catch (err) {
        console.error('[Branding PUT] DB Error:', err)
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }
}
