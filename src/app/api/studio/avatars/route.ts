import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/studio/avatars — list all avatars for the current user
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const avatars = await prisma.studioAvatar.findMany({
        where: { userId: session.user.id, isActive: true },
        orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ avatars })
}

// POST /api/studio/avatars — create a new avatar (metadata only, generate separately)
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, description, prompt, style, numAngles } = body

    if (!name || !prompt) {
        return NextResponse.json({ error: 'name and prompt are required' }, { status: 400 })
    }

    const avatar = await prisma.studioAvatar.create({
        data: {
            userId: session.user.id,
            name,
            description: description || null,
            prompt,
            style: style || 'realistic',
            status: 'idle',
        },
    })

    // If numAngles is provided, kick off generation immediately
    if (numAngles && numAngles > 0) {
        // Non-blocking generation (don't await)
        generateAvatarAsync(avatar.id, session.user.id, prompt, style || 'realistic', numAngles).catch(console.error)
    }

    return NextResponse.json({ avatar })
}

async function generateAvatarAsync(
    avatarId: string,
    userId: string,
    prompt: string,
    style: string,
    numAngles: number
) {
    const { generateAvatarImages } = await import('@/lib/studio/fal-client')

    await prisma.studioAvatar.update({
        where: { id: avatarId },
        data: { status: 'generating' },
    })

    try {
        const images = await generateAvatarImages({ userId, prompt, style, numAngles })

        await prisma.studioAvatar.update({
            where: { id: avatarId },
            data: {
                referenceImages: images,
                coverImage: images[0] || null,
                status: 'done',
            },
        })
    } catch (err) {
        await prisma.studioAvatar.update({
            where: { id: avatarId },
            data: { status: 'failed' },
        })
        throw err
    }
}
