import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// POST /api/studio/channels/[channelId]/projects/[id]/push-to-post
// Creates a draft Post with studio output URLs in metadata,
// then redirects user to Compose editor pre-loaded with those images.
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const project = await prisma.studioProject.findFirst({
        where: { id, channelId },
        include: { outputs: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const body = await req.json()
    const { outputIds } = body as { outputIds?: string[] }

    // Get selected outputs (or all if no specific IDs given)
    const outputs = project.outputs.filter(o =>
        !outputIds || outputIds.includes(o.id)
    )
    if (!outputs.length) {
        return NextResponse.json({ error: 'No outputs selected' }, { status: 400 })
    }

    const mediaUrls = outputs.map(o => o.url).filter(Boolean) as string[]
    const hasVideo = outputs.some(o => o.type === 'video')

    // Create a DRAFT Post with studio media in metadata.
    // The Compose editor reads ?studio_draft=<postId> and pre-loads the images.
    const draft = await prisma.post.create({
        data: {
            channelId,
            authorId: session.user.id,
            status: 'DRAFT',
            content: '',
            metadata: JSON.stringify({
                source: 'studio',
                projectId: id,
                projectName: project.name,
                studioMediaUrls: mediaUrls,
                mediaType: hasVideo ? 'video' : 'image',
                outputIds: outputs.map(o => o.id),
            }),
        },
    })

    // Mark selected outputs as pushed
    await prisma.studioOutput.updateMany({
        where: { id: { in: outputs.map(o => o.id) } },
        data: { pushedToPost: true },
    })

    return NextResponse.json({
        success: true,
        draftPostId: draft.id,
        composeUrl: `/dashboard/posts/compose?studio_draft=${draft.id}`,
    })
}
