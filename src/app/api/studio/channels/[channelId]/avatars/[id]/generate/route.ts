import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// Resolve image generation key for a provider: user Studio key → env fallback
// Studio keys use provider prefix: fal_ai, studio_runware, studio_openai
async function resolveKey(userId: string, provider: string): Promise<string | null> {
    // Map provider → userApiKey provider field (Studio-specific keys don't collide with AI text keys)
    const dbProvider = provider === 'runware' ? 'studio_runware'
        : provider === 'openai' ? 'studio_openai'
            : provider // fal_ai stays as fal_ai

    const userKey = await prisma.userApiKey.findFirst({
        where: { userId, provider: dbProvider },
        select: { apiKeyEncrypted: true },
    })
    if (userKey?.apiKeyEncrypted) {
        try { return decrypt(userKey.apiKeyEncrypted) } catch { /* fall through */ }
    }

    // env fallbacks
    const envMap: Record<string, string | undefined> = {
        fal_ai: process.env.FAL_AI_KEY,
        runware: process.env.RUNWARE_API_KEY,
        openai: process.env.OPENAI_API_KEY,
    }
    return envMap[provider] || null
}

// POST /api/studio/channels/[channelId]/avatars/[id]/generate
// Supports: fal_ai (default), runware, openai (DALL-E 3)
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

    const body = await req.json().catch(() => ({}))
    const numAngles = (body.numAngles as number) || 4
    const provider: string = (body.provider as string) || 'fal_ai'
    const model: string = body.model || ''

    const apiKey = await resolveKey(session.user.id, provider)
    if (!apiKey) {
        return NextResponse.json({
            error: `No API key found for ${provider}. Go to Dashboard → API Keys → Studio Image Generation.`,
        }, { status: 400 })
    }

    const basePrompt = `${avatar.prompt}, ${avatar.style} style, character reference sheet, ${numAngles} views: front, side, back${numAngles >= 4 ? ', 3/4 view' : ''}, white background, high detail, character design`

    await prisma.studioAvatar.update({ where: { id }, data: { status: 'generating' } })

    try {
        let jobId: string

        if (provider === 'fal_ai') {
            const falModel = model || 'fal-ai/flux/schnell'
            const falRes = await fetch(`https://queue.fal.run/${falModel}`, {
                method: 'POST',
                headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: basePrompt,
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
            jobId = falData.request_id || falData.id || 'unknown'
            await prisma.studioAvatar.update({ where: { id }, data: { falJobId: jobId, status: 'generating' } })
            return NextResponse.json({ jobId, status: 'generating' })

        } else if (provider === 'runware') {
            const runwareModel = model || 'runware:100@1'
            const rwRes = await fetch('https://api.runware.ai/v1', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify([{
                    taskType: 'imageInference',
                    taskUUID: crypto.randomUUID(),
                    positivePrompt: basePrompt,
                    model: runwareModel,
                    width: 1024,
                    height: 768,
                    numberResults: numAngles <= 2 ? 2 : 4,
                    outputType: ['URL'],
                }]),
            })
            if (!rwRes.ok) {
                const err = await rwRes.text()
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return NextResponse.json({ error: `Runware error: ${err}` }, { status: 500 })
            }
            const rwData = await rwRes.json()
            const imageUrls: string[] = (rwData.data || []).map((r: { imageURL?: string }) => r.imageURL).filter(Boolean)
            await prisma.studioAvatar.update({
                where: { id },
                data: { coverImage: imageUrls[0] || null, status: 'idle' },
            })
            return NextResponse.json({ status: 'done', imageUrls })

        } else if (provider === 'openai') {
            const dalleModel = model || 'dall-e-3'
            const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: dalleModel,
                    prompt: basePrompt.slice(0, 4000),
                    n: 1,
                    size: '1792x1024',
                    quality: 'standard',
                }),
            })
            if (!dalleRes.ok) {
                const err = await dalleRes.text()
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 })
            }
            const dalleData = await dalleRes.json()
            const imageUrl: string = dalleData.data?.[0]?.url || ''
            await prisma.studioAvatar.update({
                where: { id },
                data: { coverImage: imageUrl || null, status: 'idle' },
            })
            return NextResponse.json({ status: 'done', imageUrls: [imageUrl] })

        } else {
            await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
            return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })
        }

    } catch (err) {
        await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
