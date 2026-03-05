import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// POST /api/studio/channels/[channelId]/avatars/[id]/generate
// Trigger Fal.ai image generation for the avatar (4 reference angles)
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

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id, channelId, isActive: true },
    })
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })

    // Resolve Fal.ai API key: user key → env fallback
    const userKey = await prisma.userApiKey.findFirst({
        where: { userId: session.user.id, provider: 'fal_ai' },
    })
    const falKey = userKey?.apiKeyEncrypted || process.env.FAL_AI_KEY
    if (!falKey) {
        return NextResponse.json({ error: 'No Fal.ai API key configured' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const numAngles = (body.numAngles as number) || 4

    // Update status to generating
    await prisma.studioAvatar.update({ where: { id }, data: { status: 'generating' } })

    // Submit async job to Fal.ai
    try {
        const prompt = `${avatar.prompt}, ${avatar.style} style, character reference sheet, ${numAngles} views: front, side, back${numAngles >= 4 ? ', 3/4 view' : ''}, white background, high detail, character design`

        const falRes = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${falKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                image_size: 'landscape_4_3',
                num_images: numAngles <= 2 ? 2 : 4,
                num_inference_steps: 4,
            }),
        })

        if (!falRes.ok) {
            const err = await falRes.text()
            await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
            return NextResponse.json({ error: `Fal.ai error: ${err}` }, { status: 500 })
        }

        const falData = await falRes.json()
        const falJobId = falData.request_id || falData.id || 'unknown'

        await prisma.studioAvatar.update({
            where: { id },
            data: { falJobId, status: 'generating' },
        })

        return NextResponse.json({ jobId: falJobId, status: 'generating' })
    } catch (err) {
        await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
