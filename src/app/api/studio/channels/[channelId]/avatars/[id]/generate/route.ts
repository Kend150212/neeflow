import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { uploadToR2, generateR2Key } from '@/lib/r2'

async function verifyMembership(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
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
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id } = await params

    if (!(await verifyMembership(session.user.id, channelId, session.user.role as string))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const avatar = await prisma.studioAvatar.findFirst({
        where: { id, channelId, isActive: true },
    })
    if (!avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })

    const numAngles = (body.numAngles as number) || 5
    const provider: string = (body.provider as string) || 'fal_ai'
    const model: string = body.model || ''
    const referenceImage: string | undefined = body.referenceImage
    const anglePrompt: string = body.anglePrompt || '' // per-slot override from Pose Matrix AI Generate

    const apiKey = await resolveKey(session.user.id, provider)
    if (!apiKey) {
        return NextResponse.json({
            error: `No API key found for "${provider}". Go to Dashboard → API Keys and add your key.`,
        }, { status: 400 })
    }

    // ── Character Reference Sheet prompt ─────────────────────────────────────
    // Always: white-grey studio background, 5 clearly separated panels, full body visible.
    // We IGNORE any background descriptors in avatar.prompt — the studio bg is hardcoded.
    const characterDesc = avatar.prompt
    const styleLabel = avatar.style || 'realistic'

    // Per-slot angle generation (from Pose Matrix "AI Generate" button)
    const isSingleAngle = numAngles === 1 && !!anglePrompt
    const basePrompt = isSingleAngle
        ? [
            `Character reference sheet, ${styleLabel} style, single panel.`,
            `Character: ${characterDesc}.`,
            `Pose / angle: ${anglePrompt}.`,
            `MANDATORY background: clean white-grey studio backdrop, soft gradient, no props, no environment, neutral soft shadow below feet.`,
            `Full body visible from head to toe. High detail, sharp, professional character design render.`,
        ].join(' ')
        : [
            `CHARACTER REFERENCE SHEET — ${styleLabel} style.`,
            `Character description: ${characterDesc}.`,
            `LAYOUT: exactly 5 clearly separated panels arranged side by side in a single wide image, each panel has a thin white divider line:`,
            `Panel 1 (leftmost): FULL BODY front view, head to toe.`,
            `Panel 2: FACE CLOSE-UP (portrait), front facing.`,
            `Panel 3: FULL BODY side profile (90 degrees), head to toe.`,
            `Panel 4: FULL BODY 3/4 dynamic angle, head to toe.`,
            `Panel 5 (rightmost): FULL BODY back view, head to toe.`,
            `MANDATORY for ALL panels: pure white-grey studio background, subtle soft gradient from white to very light grey, professional studio lighting, soft shadow below feet, NO environment, NO props, NO scenery.`,
            `Same character, same outfit, same face in every panel. High detail, sharp edges, professional character design sheet, concept art quality.`,
        ].join(' ')

    const consistencyClause = referenceImage
        ? ` MUST maintain identical face features, skin tone, hair color, outfit, accessories from the provided reference image.`
        : ''
    const finalPrompt = basePrompt + consistencyClause

    await prisma.studioAvatar.update({ where: { id }, data: { status: 'generating' } })

    try {
        // ─── Fal.ai (async queue) ───────────────────────────────────
        if (provider === 'fal_ai') {
            const falModel = model || 'fal-ai/flux/schnell'
            const falRes = await fetch(`https://queue.fal.run/${falModel}`, {
                method: 'POST',
                headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: finalPrompt,
                    image_size: isSingleAngle ? 'portrait_4_3' : 'landscape_16_9',
                    num_images: 1,
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
                    positivePrompt: finalPrompt,
                    model: runwareModel,
                    width: isSingleAngle ? 768 : 1568,
                    height: 896,
                    numberResults: 1,
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
            const oaiBody: Record<string, unknown> = {
                model: oaiModel,
                prompt: finalPrompt.slice(0, 4000),
                n: 1,
            }
            if (isGptImage) {
                oaiBody.quality = 'high'
            } else if (oaiModel === 'dall-e-3') {
                oaiBody.size = '1792x1024'
                oaiBody.quality = 'standard'
            } else {
                oaiBody.size = '1024x1024'
            }
            const oaiRes = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(oaiBody),
            })
            if (!oaiRes.ok) {
                const err = await oaiRes.text()
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 })
            }
            const oaiData = await oaiRes.json()
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

        // ─── Gemini Imagen / Flash (fire-and-forget async bg) ────────
        if (provider === 'gemini') {
            const gemModel = model || 'gemini-3.1-flash-image-preview'
            const isFlash = gemModel.startsWith('gemini-')
            runGeminiBackground({ id, channelId, apiKey, gemModel, isFlash, basePrompt: finalPrompt, referenceImage }).catch(console.error)
            return NextResponse.json({ status: 'generating' })
        }

        // ─── Unknown provider ────────────────────────────────────────
        await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
        return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })

    } catch (err) {
        console.error(`[generate] Unhandled error provider=${provider} model=${model} avatarId=${id}:`, err)
        await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
        return NextResponse.json({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }
}

// ─── Background Gemini worker ─────────────────────────────────────────────
// Runs entirely after the HTTP response is sent to avoid browser timeout.
async function runGeminiBackground(opts: {
    id: string
    channelId: string
    apiKey: string
    gemModel: string
    isFlash: boolean
    basePrompt: string
    referenceImage?: string
}) {
    const { id, channelId, apiKey, gemModel, isFlash, basePrompt, referenceImage } = opts
    console.log(`[generate:bg] Gemini start: model=${gemModel} isFlash=${isFlash} ref=${!!referenceImage} avatarId=${id}`)
    const imageUrls: string[] = []

    try {
        if (isFlash) {
            // Gemini Flash: generateContent with responseModalities: ['IMAGE','TEXT']
            // Phase 2: include reference image inline for character consistency
            const parts: unknown[] = [{ text: basePrompt.slice(0, 2000) }]
            if (referenceImage && referenceImage.startsWith('http')) {
                try {
                    const imgRes = await fetch(referenceImage)
                    if (imgRes.ok) {
                        const imgBuf = await imgRes.arrayBuffer()
                        const imgB64 = Buffer.from(imgBuf).toString('base64')
                        const imgMime = imgRes.headers.get('content-type') || 'image/jpeg'
                        parts.unshift({ inlineData: { data: imgB64, mimeType: imgMime } })
                        console.log(`[generate:bg] Included reference image (${imgBuf.byteLength}b) in Gemini Flash prompt`)
                    }
                } catch (e) {
                    console.warn(`[generate:bg] Failed to fetch referenceImage: ${e}`)
                }
            }
            const flashRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${gemModel}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
                    }),
                }
            )
            const flashText = await flashRes.text()
            if (!flashRes.ok) {
                console.error(`[generate:bg] Gemini Flash HTTP ${flashRes.status} model=${gemModel}: ${flashText.slice(0, 500)}`)
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return
            }
            let flashData: Record<string, unknown>
            try {
                flashData = JSON.parse(flashText)
            } catch {
                console.error(`[generate:bg] Gemini Flash JSON parse error: ${flashText.slice(0, 300)}`)
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return
            }
            console.log(`[generate:bg] Gemini Flash response keys: ${Object.keys(flashData).join(', ')}`)
            const candidates = flashData.candidates as Array<{
                content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> }
            }> | undefined
            const responseParts = candidates?.[0]?.content?.parts || []
            console.log(`[generate:bg] Gemini Flash parts count: ${responseParts.length}`)
            for (const part of responseParts) {
                if (part.inlineData?.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png'
                    const ext = mimeType.split('/')[1] || 'png'
                    const buffer = Buffer.from(part.inlineData.data, 'base64')
                    console.log(`[generate:bg] Flash image: ${mimeType} ${buffer.length} bytes`)
                    try {
                        const key = generateR2Key(channelId, `avatar-gemini-${id}-${Date.now()}.${ext}`)
                        const r2Url = await uploadToR2(buffer, key, mimeType)
                        imageUrls.push(r2Url)
                        console.log(`[generate:bg] Flash image → R2: ${r2Url}`)
                    } catch (r2Err) {
                        console.error(`[generate:bg] R2 upload failed: ${r2Err}`)
                        imageUrls.push(`data:${mimeType};base64,${part.inlineData.data}`)
                    }
                }
            }
            if (imageUrls.length === 0) {
                console.error(`[generate:bg] Flash 0 images. Response: ${JSON.stringify(flashData).slice(0, 500)}`)
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return
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
                        parameters: { sampleCount: 1, aspectRatio: '16:9' },
                    }),
                }
            )
            const imagenText = await imagenRes.text()
            if (!imagenRes.ok) {
                console.error(`[generate:bg] Imagen HTTP ${imagenRes.status} model=${gemModel}: ${imagenText.slice(0, 500)}`)
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return
            }
            let imagenData: Record<string, unknown>
            try {
                imagenData = JSON.parse(imagenText)
            } catch {
                console.error(`[generate:bg] Imagen JSON parse error`)
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return
            }
            const predictions = (imagenData.predictions as Array<{ bytesBase64Encoded?: string; mimeType?: string }>) || []
            console.log(`[generate:bg] Imagen predictions: ${predictions.length}`)
            for (const p of predictions) {
                if (p.bytesBase64Encoded) {
                    const mimeType = p.mimeType || 'image/png'
                    const ext = mimeType.split('/')[1] || 'png'
                    const buffer = Buffer.from(p.bytesBase64Encoded, 'base64')
                    try {
                        const key = generateR2Key(channelId, `avatar-imagen-${id}-${Date.now()}.${ext}`)
                        const r2Url = await uploadToR2(buffer, key, mimeType)
                        imageUrls.push(r2Url)
                        console.log(`[generate:bg] Imagen image → R2: ${r2Url}`)
                    } catch (r2Err) {
                        console.error(`[generate:bg] R2 upload failed: ${r2Err}`)
                        imageUrls.push(`data:${mimeType};base64,${p.bytesBase64Encoded}`)
                    }
                }
            }
            if (imageUrls.length === 0) {
                console.error(`[generate:bg] Imagen 0 predictions. Response: ${JSON.stringify(imagenData).slice(0, 500)}`)
                await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } })
                return
            }
        }

        await prisma.studioAvatar.update({
            where: { id },
            data: { coverImage: imageUrls[0] || null, status: 'idle' },
        })
        console.log(`[generate:bg] Gemini done ✓ coverImage=${imageUrls[0]?.slice(0, 80)}`)
    } catch (err) {
        console.error(`[generate:bg] Unhandled Gemini error avatarId=${id}:`, err)
        await prisma.studioAvatar.update({ where: { id }, data: { status: 'failed' } }).catch(() => { })
    }
}
