import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inbox/leads/export?channelId=xxx
 * Export all leads for a channel as CSV
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')

    let channelIds: string[]
    if (channelId) {
        channelIds = [channelId]
    } else {
        const memberships = await prisma.channelMember.findMany({
            where: { userId: session.user.id },
            select: { channelId: true },
        })
        channelIds = memberships.map(m => m.channelId)
    }

    const leads = await prisma.inboxContact.findMany({
        where: { channelId: { in: channelIds } },
        orderBy: { createdAt: 'desc' },
    })

    // Build CSV
    const headers = ['ID', 'Platform', 'Full Name', 'Phone', 'Email', 'Address', 'Status', 'Capture Method', 'Tags', 'Note', 'Created At']
    const rows = leads.map((l: { id: string; platform: string; fullName: string | null; phone: string | null; email: string | null; address: string | null; status: string; captureMethod: string; tags: unknown; note: string | null; createdAt: Date }) => [
        l.id,
        l.platform,
        l.fullName || '',
        l.phone || '',
        l.email || '',
        l.address || '',
        l.status,
        l.captureMethod,
        (Array.isArray(l.tags) ? l.tags : []).join('; '),
        (l.note || '').replace(/\n/g, ' '),
        l.createdAt.toISOString(),
    ])

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

    return new NextResponse(csvContent, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="leads-${channelId || 'all'}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
    })
}
