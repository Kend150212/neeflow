import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/youtube/reply-comment
// Body: { channelPlatformId, parentId, text }
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelPlatformId, parentId, text } = await req.json()
    if (!channelPlatformId || !parentId || !text?.trim()) {
        return NextResponse.json({ error: 'channelPlatformId, parentId, and text are required' }, { status: 400 })
    }

    // Get access token for the channel
    const cp = await prisma.channelPlatform.findFirst({
        where: { id: channelPlatformId, platform: 'youtube' },
        select: { accessToken: true },
    })
    if (!cp?.accessToken) {
        return NextResponse.json({ error: 'YouTube account not connected or no access token' }, { status: 400 })
    }

    const body = {
        snippet: {
            parentId,
            textOriginal: text.trim(),
        },
    }

    const res = await fetch(
        'https://www.googleapis.com/youtube/v3/comments?part=snippet',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cp.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    )

    const data = await res.json()

    if (!res.ok || data.error) {
        console.error('[YouTube] reply comment error:', data.error)
        return NextResponse.json(
            { error: data.error?.message || 'Failed to post reply' },
            { status: res.status }
        )
    }

    return NextResponse.json({
        success: true,
        comment: {
            commentId: data.id,
            authorName: data.snippet?.authorDisplayName,
            text: data.snippet?.textDisplay,
            publishedAt: data.snippet?.publishedAt,
        },
    })
}
