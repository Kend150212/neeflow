import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { embedAndSaveKnowledge } from '@/lib/rag-search'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'

// GET /api/admin/channels/[id]/knowledge — list knowledge base entries
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const entries = await prisma.knowledgeBase.findMany({
        where: { channelId: id },
        orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(entries)
}

// POST /api/admin/channels/[id]/knowledge — add knowledge base entry
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { title, sourceType, sourceUrl, content } = body

    if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Validate based on source type
    if ((sourceType === 'url' || sourceType === 'google_sheet') && !sourceUrl) {
        return NextResponse.json({ error: 'URL is required for this source type' }, { status: 400 })
    }

    const entry = await prisma.knowledgeBase.create({
        data: {
            channelId: id,
            title,
            sourceType: sourceType || 'text',
            sourceUrl: sourceUrl || null,
            content: content || '',
        },
    })

    // ── Auto-embed in background (non-blocking) ──────────────────
    if (content) {
        setImmediate(async () => {
            try {
                const ownerKey = await getChannelOwnerKey(id, null)
                if (ownerKey.apiKey && ownerKey.provider) {
                    await embedAndSaveKnowledge(entry.id, ownerKey.provider, ownerKey.apiKey)
                }
            } catch (err) {
                console.error('[KB] Auto-embed failed for entry:', entry.id, err)
            }
        })
    }

    return NextResponse.json(entry, { status: 201 })
}

// PUT /api/admin/channels/[id]/knowledge — update a knowledge base entry
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { entryId, title, sourceType, sourceUrl, content } = body

    if (!entryId) {
        return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    const entry = await prisma.knowledgeBase.update({
        where: { id: entryId },
        data: {
            ...(title !== undefined && { title }),
            ...(sourceType !== undefined && { sourceType }),
            ...(sourceUrl !== undefined && { sourceUrl }),
            ...(content !== undefined && { content }),
            // Reset embedding so it gets re-generated
            ...(content !== undefined && { embeddedAt: null }),
        },
    })

    // ── Re-embed in background if content changed ────────────────
    if (content !== undefined) {
        setImmediate(async () => {
            try {
                const ownerKey = await getChannelOwnerKey(id, null)
                if (ownerKey.apiKey && ownerKey.provider) {
                    await embedAndSaveKnowledge(entryId, ownerKey.provider, ownerKey.apiKey)
                }
            } catch (err) {
                console.error('[KB] Auto-re-embed failed for entry:', entryId, err)
            }
        })
    }

    return NextResponse.json(entry)
}

// DELETE /api/admin/channels/[id]/knowledge — delete a knowledge base entry
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await params
    const { searchParams } = new URL(req.url)
    const entryId = searchParams.get('entryId')

    if (!entryId) {
        return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    await prisma.knowledgeBase.delete({ where: { id: entryId } })

    return NextResponse.json({ success: true })
}
