import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/media/[id]/thumbnail
 * Returns the MediaItem (specifically thumbnailUrl) for polling.
 * Used by the client to check if background transcode has generated a thumbnail.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const mediaItem = await prisma.mediaItem.findUnique({
        where: { id },
        select: {
            id: true,
            thumbnailUrl: true,
            url: true,
            type: true,
            mimeType: true,
            originalName: true,
            source: true,
            aiMetadata: true,
        },
    })

    if (!mediaItem) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(mediaItem)
}
