import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/portal/posts/[id]/edit
// Body: { content: string }
// Client can only edit the text content of a post
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: postId } = await params
    const { content } = await req.json()

    if (typeof content !== 'string') {
        return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
    }

    // Verify customer has access to this post's channel
    const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { channelId: true, status: true },
    })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    // Only allow editing posts that are pending review
    if (!['PENDING_APPROVAL', 'CLIENT_REVIEW'].includes(post.status)) {
        return NextResponse.json({ error: 'Can only edit posts pending review' }, { status: 400 })
    }

    const membership = await prisma.channelMember.findUnique({
        where: { userId_channelId: { userId: session.user.id, channelId: post.channelId } },
    })
    if (!membership) return NextResponse.json({ error: 'Not authorized for this channel' }, { status: 403 })

    // Update content only
    const updated = await prisma.post.update({
        where: { id: postId },
        data: { content },
        select: { id: true, content: true },
    })

    return NextResponse.json({ ok: true, post: updated })
}
