import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/admin/integrations/seed — create missing integration records
export async function POST() {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const missingProviders = [
        {
            category: 'AI' as const,
            provider: 'openrouter',
            name: 'OpenRouter',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://openrouter.ai/api/v1',
        },
        {
            category: 'AI' as const,
            provider: 'synthetic',
            name: 'Synthetic',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://api.synthetic.new/openai/v1',
        },
        {
            category: 'DESIGN' as const,
            provider: 'robolly',
            name: 'Robolly',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://api.robolly.com',
        },
        {
            category: 'DESIGN' as const,
            provider: 'canva',
            name: 'Canva',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://api.canva.com/rest/v1',
        },
        {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            category: 'BILLING' as any,
            provider: 'stripe',
            name: 'Stripe',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://api.stripe.com',
        },
        {
            category: 'AUTH' as const,
            provider: 'google_oauth',
            name: 'Google OAuth',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://accounts.google.com',
        },
        {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            category: 'SOCIAL' as any,
            provider: 'shopify',
            name: 'Shopify',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://shopify.com',
        },
        {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            category: 'SOCIAL' as any,
            provider: 'etsy',
            name: 'Etsy',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://openapi.etsy.com/v3',
        },
        {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            category: 'WEBHOOK' as any,
            provider: 'whatsapp',
            name: 'WhatsApp Business',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://graph.facebook.com/v19.0',
        },
        {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            category: 'WEBHOOK' as any,
            provider: 'zalo',
            name: 'Zalo OA',
            isActive: false,
            isDefault: false,
            status: 'INACTIVE' as const,
            baseUrl: 'https://openapi.zalo.me',
        },
    ]

    const results = []

    for (const p of missingProviders) {
        const result = await prisma.apiIntegration.upsert({
            where: {
                category_provider: {
                    category: p.category,
                    provider: p.provider,
                },
            },
            update: { baseUrl: p.baseUrl },
            create: p,
        })
        results.push({ provider: result.provider, id: result.id, created: true })
    }

    return NextResponse.json({ success: true, results })
}
