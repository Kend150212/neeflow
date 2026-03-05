import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// Unified key resolution — reads from userApiKey (shared with AI Providers section)
// provider names: fal_ai | runware | openai | gemini
async function resolveKey(userId: string, provider: string): Promise<string | null> {
    const userKey = await prisma.userApiKey.findFirst({
        where: { userId, provider },
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
        gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
    }
    return envMap[provider] ?? null
}

// POST /api/studio/channels/[channelId]/avatars/[id]/generate
// Supported providers: fal_ai | runware | openai | gemini
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
            error: `No API key found for "${provider}". Go to Dashboard → API Keys and add your key.`,
        }, { status: 400 })
    }

    const basePrompt = `${avatar.prompt}, ${avatar.style} style, character reference sheet, ${numAngles} views: front, side, back${numAngles >= 4 ? ', 3/4 view' : ''}, white background, high detail, character design`

    await prisma.studioAvatar.update({ where: { id }, data: { status: 'generating' } })

    try {
        // ─── Fal.ai (async queue) ───────────────────────────────────
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
            const jobId = falData.request_id || falData.id || 'unknown'
            await prisma.studioAvatar.update({ where: { id }, data: { falJobId: jobId, status: 'generating' } })
            return NextResponse.json({ jobId, status: 'generating' })
        }

        // ─── Runware (sync) ─────────────────────────────────────────
        if (provider === 'runware') {
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
            if (rwData.errors?.length) {
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return NextResponse.json({ error: `Runware error: ${JSON.stringify(rwData.errors)}` }, { status: 500 })
            }
            const imageUrls: string[] = (rwData.data || []).map((r: { imageURL?: string }) => r.imageURL).filter(Boolean)
            await prisma.studioAvatar.update({
                where: { id },
                data: { coverImage: imageUrls[0] || null, status: 'idle' },
            })
            return NextResponse.json({ status: 'done', imageUrls })
        }

        // ─── OpenAI Images (sync) ────────────────────────────────────
        if (provider === 'openai') {
            const oaiModel = model || 'gpt-image-1'
            const isGptImage = oaiModel === 'gpt-image-1'
            const body: Record<string, unknown> = {
                model: oaiModel,
                prompt: basePrompt.slice(0, 4000),
                n: 1,
            }
            if (isGptImage) {
                // gpt-image-1: quality=high, no size constraint (auto)
                body.quality = 'high'
            } else if (oaiModel === 'dall-e-3') {
                body.size = '1792x1024'
                body.quality = 'standard'
            } else {
                // dall-e-2
                body.size = '1024x1024'
            }
            const oaiRes = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!oaiRes.ok) {
                const err = await oaiRes.text()
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 })
            }
            const oaiData = await oaiRes.json()
            // gpt-image-1 may return b64_json, DALL-E returns url
            const item = oaiData.data?.[0]
            let imageUrl = item?.url || ''
            if (!imageUrl && item?.b64_json) {
                imageUrl = `data:image/png;base64,${item.b64_json}`
            }
            await prisma.studioAvatar.update({
                where: { id },
                data: { coverImage: imageUrl || null, status: 'idle' },
            })
            return NextResponse.json({ status: 'done', imageUrls: [imageUrl] })
        }

        // ─── Gemini Imagen / Flash native image gen ──────────────────
        if (provider === 'gemini') {
            const gemModel = model || 'imagen-3.0-generate-001'
            const isFlash = gemModel.startsWith('gemini-')

            let imageUrls: string[] = []

            if (isFlash) {
                // Gemini 2.0 Flash: uses generateContent with responseModalities: ['IMAGE','TEXT']
                const flashRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${gemModel}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: basePrompt.slice(0, 2000) }] }],
                            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
                        }),
                    }
                )
                if (!flashRes.ok) {
                    const err = await flashRes.text()
                    await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                    return NextResponse.json({ error: `Gemini Flash error: ${err}` }, { status: 500 })
                }
                const flashData = await flashRes.json()
                const parts = flashData.candidates?.[0]?.content?.parts || []
                for (const part of parts) {
                    if (part.inlineData?.data) {
                        imageUrls.push(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`)
                    }
                }
            } else {
                // Imagen models: use :predict endpoint
                const imagenRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${gemModel}:predict?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            instances: [{ prompt: basePrompt.slice(0, 2000) }],
                            parameters: { sampleCount: 1, aspectRatio: '1:1' },
                        }),
                    }
                )
                if (!imagenRes.ok) {
                    const err = await imagenRes.text()
                    await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                    return NextResponse.json({ error: `Gemini Imagen error: ${err}` }, { status: 500 })
                }
                const imagenData = await imagenRes.json()
                const predictions = imagenData.predictions || []
                imageUrls = predictions
                    .map((p: { bytesBase64Encoded?: string; mimeType?: string }) =>
                        p.bytesBase64Encoded ? `data:${p.mimeType || 'image/png'};base64,${p.bytesBase64Encoded}` : ''
                    )
                    .filter(Boolean)
            }

            await prisma.studioAvatar.update({
                where: { id },
                data: { coverImage: imageUrls[0] || null, status: 'idle' },
            })
            return NextResponse.json({ status: 'done', imageUrls })
        }

        // ─── Unknown provider ────────────────────────────────────────
        await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
        return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })

    } catch (err) {
        await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
