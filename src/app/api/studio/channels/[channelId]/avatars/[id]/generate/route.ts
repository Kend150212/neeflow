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
async function resolveKey(userId: string, provider: string): Promise<string | null> {
    const userKey = await prisma.userApiKey.findFirst({
        where: { userId, provider },
        select: { apiKeyEncrypted: true },
    })
    if (userKey?.apiKeyEncrypted) {
        try { return decrypt(userKey.apiKeyEncrypted) } catch { /* fall through */ }
    }
    const envMap: Record<string, string | undefined> = {
        fal_ai: process.env.FAL_AI_KEY,
        runware: process.env.RUNWARE_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
    }
    return envMap[provider] ?? null
}

// ─── 6 Angular Definitions ─────────────────────────────────────────────────
// Matches the reference example: 6 separate portrait photos, same character
const ANGLES = [
    {
        label: 'Chính diện bán thân',
        prompt: 'full body front view, standing upright, neutral pose, head to toe visible, looking directly at camera',
        aspectRatio: 'portrait_4_3' as const,
        rwWidth: 768, rwHeight: 1024,
    },
    {
        label: 'Cận mặt',
        prompt: 'face portrait close-up, front facing, shoulders and above visible, direct eye contact, highly detailed facial features',
        aspectRatio: 'portrait_4_3' as const,
        rwWidth: 768, rwHeight: 1024,
    },
    {
        label: 'Chính diện cận bán thân',
        prompt: 'upper body front view, chest and head framing, arms slightly visible, elegant pose, looking at camera',
        aspectRatio: 'portrait_4_3' as const,
        rwWidth: 768, rwHeight: 1024,
    },
    {
        label: 'Nghiêng trái',
        prompt: 'full body side profile view facing left, head to toe, standing straight, 90 degree side angle',
        aspectRatio: 'portrait_4_3' as const,
        rwWidth: 768, rwHeight: 1024,
    },
    {
        label: '3/4 sau',
        prompt: 'three-quarter rear angle view, 3/4 back perspective, slightly turned, head to toe visible',
        aspectRatio: 'portrait_4_3' as const,
        rwWidth: 768, rwHeight: 1024,
    },
    {
        label: 'Sau lưng',
        prompt: 'full back view, rear facing, head to toe, standing straight, showing full back of outfit',
        aspectRatio: 'portrait_4_3' as const,
        rwWidth: 768, rwHeight: 1024,
    },
]

// Build prompt for a single angle
function buildAnglePrompt(
    characterDesc: string,
    style: string,
    anglePromptDesc: string,
    referenceImage?: string,
    outfitLock?: string,
): string {
    const isRealistic = style === 'realistic'
    const qualityDesc = isRealistic
        ? 'hyperrealistic photography, professional photo studio lighting, 8K ultra-sharp, lifelike skin texture, cinematic lighting'
        : `${style} character illustration, high detail, concept art quality`

    const bgDesc = 'dark gradient studio background, professional dark backdrop, soft dramatic lighting from front'

    // Strong consistency instruction when we have a reference image
    const consistencyNote = referenceImage
        ? ` CRITICAL CONSISTENCY RULES: (1) Face must be IDENTICAL — same facial structure, skin tone, age, beauty marks. (2) Hair must be IDENTICAL — same color, length, style, and texture. (3) Outfit must be IDENTICAL — same exact garments, colors, fabric, and accessories as shown in reference. Do NOT invent or change any clothing. ${outfitLock ? `Outfit detail: ${outfitLock}.` : ''}`
        : outfitLock
            ? ` Wear exactly this outfit: ${outfitLock}. Keep outfit IDENTICAL across all shots.`
            : ''

    return [
        isRealistic
            ? 'Hyperrealistic professional studio photography, NOT illustration, NOT cartoon, NOT 3D render.'
            : `${style} style illustration, single panel.`,
        `Character: ${characterDesc}.`,
        `Shot type: ${anglePromptDesc}.`,
        `Background: ${bgDesc}.`,
        `${qualityDesc}.`,
        consistencyNote,
    ].filter(Boolean).join(' ')
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

    const body = await req.json().catch(() => ({}))
    const provider: string = (body.provider as string) || 'fal_ai'
    const model: string = body.model || ''
    const referenceImage: string | undefined = body.referenceImage

    // Single-angle override from Pose Matrix "AI Generate" button
    const angleIndex: number | undefined = body.angleIndex !== undefined ? Number(body.angleIndex) : undefined
    const anglePromptOverride: string | undefined = body.anglePrompt // legacy per-slot override

    const apiKey = await resolveKey(session.user.id, provider)
    if (!apiKey) {
        return NextResponse.json({
            error: `No API key found for "${provider}". Go to Dashboard → API Keys and add your key.`,
        }, { status: 400 })
    }

    // Mark as generating
    await prisma.studioAvatar.update({ where: { id }, data: { status: 'generating' } })

    const style = avatar.style || 'realistic'
    const characterDesc = avatar.prompt

    // Determine which angles to generate
    const anglesToGenerate = angleIndex !== undefined
        ? [{ index: angleIndex, angle: ANGLES[angleIndex] }]
        : ANGLES.map((angle, index) => ({ index, angle }))

    // Start background generation (fire-and-forget to avoid HTTP timeout on 6 calls)
    runGenerationBackground({
        id, channelId, provider, model, apiKey, style, characterDesc,
        referenceImage, anglesToGenerate, anglePromptOverride,
        existingPoseImages: ((avatar as unknown as Record<string, unknown>).poseImages as string[]) || [],
    }).catch(console.error)

    return NextResponse.json({ status: 'generating', totalAngles: anglesToGenerate.length })
}

// ─── Background worker ────────────────────────────────────────────────────────
async function runGenerationBackground(opts: {
    id: string
    channelId: string
    provider: string
    model: string
    apiKey: string
    style: string
    characterDesc: string
    referenceImage?: string
    anglesToGenerate: Array<{ index: number; angle: typeof ANGLES[0] }>
    anglePromptOverride?: string
    existingPoseImages: string[]
}) {
    const { id, channelId, provider, model, apiKey, style, characterDesc, referenceImage,
        anglesToGenerate, anglePromptOverride, existingPoseImages } = opts

    // Start from existing poseImages array (6 slots), preserving already-done slots
    const poseImages: string[] = Array.from({ length: 6 }, (_, i) => existingPoseImages[i] || '')

    const FRONT_INDEX = 0  // "Chính diện bán thân" — shows FULL outfit (head-to-toe)
    const isGeneratingAll = anglesToGenerate.length > 1

    // Extract outfit hint from character description (keywords after common separators)
    const outfitHint = (() => {
        const m = characterDesc.match(/wear(?:ing)?\s+([^.]+)/i)
            || characterDesc.match(/outfit[:\s]+([^.]+)/i)
            || characterDesc.match(/dress(?:ed)?[\s]+(?:in|with)[:\s]+([^.]+)/i)
        return m?.[1]?.trim() ?? ''
    })()

    console.log(`[generate:bg] Start ${provider} — ${anglesToGenerate.length} angle(s) for avatar ${id}`)

    // Helper: generate one angle, save to DB immediately when done
    const generateAndSave = async (index: number, angle: typeof ANGLES[0], refImage?: string): Promise<string | null> => {
        const prompt = buildAnglePrompt(
            characterDesc, style,
            (anglePromptOverride && !isGeneratingAll) ? anglePromptOverride : angle.prompt,
            refImage,
            outfitHint,
        )
        console.log(`[generate:bg] Angle ${index} "${angle.label}" ref=${refImage ? '✓' : 'none'}`)

        try {
            const imageUrl = await generateSingleImage({
                provider, model, apiKey, prompt,
                referenceImage: refImage,
                aspectRatio: angle.aspectRatio,
                rwWidth: angle.rwWidth, rwHeight: angle.rwHeight,
                id, channelId, angleIndex: index,
            })
            if (imageUrl) {
                poseImages[index] = imageUrl
                // Save incrementally so UI can show partial results while others are still running
                const coverImage = poseImages[1] || poseImages.find(u => !!u) || undefined
                await (prisma.studioAvatar.update as (args: unknown) => Promise<unknown>)({
                    where: { id },
                    data: { poseImages: [...poseImages], coverImage },
                })
                console.log(`[generate:bg] Angle ${index} ✓ → ${imageUrl.slice(0, 60)}`)
                return imageUrl
            }
        } catch (err) {
            console.error(`[generate:bg] Angle ${index} failed: ${err}`)
        }
        return null
    }

    let anySuccess = false

    if (isGeneratingAll) {
        // ── Strategy: Front-View-first → then ALL others in PARALLEL ──────────
        // Front View (index 0) shows FULL outfit head-to-toe → best anchor for consistency.
        // Face close-up (index 1) shows NO outfit → poor choice as reference anchor.
        const frontEntry = anglesToGenerate.find(a => a.index === FRONT_INDEX)
        const otherEntries = anglesToGenerate.filter(a => a.index !== FRONT_INDEX)

        let sharedRef: string | undefined = referenceImage // user-supplied ref wins

        if (frontEntry) {
            const frontUrl = await generateAndSave(frontEntry.index, frontEntry.angle, referenceImage)
            if (frontUrl) {
                anySuccess = true
                // If no user-supplied reference, use the front-view shot (shows full outfit)
                // as the shared reference for all remaining angles.
                if (!referenceImage) {
                    sharedRef = frontUrl
                    console.log(`[generate:bg] Front view ✓ — using as outfit reference for ${otherEntries.length} parallel jobs`)
                }
            }
        }

        // Generate remaining angles in parallel
        if (otherEntries.length > 0) {
            const results = await Promise.allSettled(
                otherEntries.map(({ index, angle }) => generateAndSave(index, angle, sharedRef))
            )
            for (const r of results) {
                if (r.status === 'fulfilled' && r.value) anySuccess = true
            }
        }
    } else {
        // ── Single-angle mode (individual regenerate button) ──────────────────
        // Use user-supplied reference OR fall back to first already-generated pose image
        const singleRef = referenceImage || poseImages.find(u => !!u) || undefined
        for (const { index, angle } of anglesToGenerate) {
            const url = await generateAndSave(index, angle, singleRef)
            if (url) anySuccess = true
        }
    }

    // Final status update — cover = face close-up (index 1) preferred
    const finalCover = poseImages[1] || poseImages.find(u => !!u) || null
    await (prisma.studioAvatar.update as (args: unknown) => Promise<unknown>)({
        where: { id },
        data: {
            status: anySuccess ? 'idle' : 'failed',
            poseImages,
            coverImage: finalCover,
        },
    })

    console.log(`[generate:bg] Done ✓ avatar=${id} poses=${poseImages.filter(Boolean).length}/6`)
}



// ─── Single-image generator per provider ─────────────────────────────────────
async function generateSingleImage(opts: {
    provider: string
    model: string
    apiKey: string
    prompt: string
    referenceImage?: string
    aspectRatio: 'portrait_4_3'
    rwWidth: number
    rwHeight: number
    id: string
    channelId: string
    angleIndex: number
}): Promise<string | null> {
    const { provider, model, apiKey, prompt, referenceImage, rwWidth, rwHeight, id, channelId, angleIndex } = opts

    // ─── Fal.ai ─────────────────────────────────────────────────────────────
    if (provider === 'fal_ai') {
        const falModel = model || 'fal-ai/flux/dev'
        const falRes = await fetch(`https://queue.fal.run/${falModel}`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt.slice(0, 4000),
                image_size: 'portrait_4_3',
                num_images: 1,
                num_inference_steps: 28,
            }),
        })
        if (!falRes.ok) {
            const err = await falRes.text()
            throw new Error(`Fal.ai error: ${err.slice(0, 300)}`)
        }
        const falData = await falRes.json()
        const jobId: string = falData.request_id || falData.id || ''
        if (!jobId) throw new Error('Fal.ai: no request_id returned')

        // Poll for Fal.ai async result
        return await pollFalJob(jobId, apiKey, falModel)
    }

    // ─── Runware ─────────────────────────────────────────────────────────────
    if (provider === 'runware') {
        const runwareModel = model || 'runware:100@1'
        const rwRes = await fetch('https://api.runware.ai/v1', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([{
                taskType: 'imageInference',
                taskUUID: crypto.randomUUID(),
                positivePrompt: prompt.slice(0, 4000),
                model: runwareModel,
                width: rwWidth,
                height: rwHeight,
                numberResults: 1,
                outputType: ['URL'],
            }]),
        })
        if (!rwRes.ok) throw new Error(`Runware error: ${await rwRes.text()}`)
        const rwData = await rwRes.json()
        if (rwData.errors?.length) throw new Error(`Runware: ${JSON.stringify(rwData.errors)}`)
        const url: string = (rwData.data || [])[0]?.imageURL || ''
        return url || null
    }

    // ─── OpenAI ──────────────────────────────────────────────────────────────
    if (provider === 'openai') {
        const oaiModel = model || 'gpt-image-1'
        const isGptImage = oaiModel === 'gpt-image-1'
        const oaiBody: Record<string, unknown> = {
            model: oaiModel,
            prompt: prompt.slice(0, 4000),
            n: 1,
        }
        if (isGptImage) {
            oaiBody.quality = 'high'
        } else if (oaiModel === 'dall-e-3') {
            oaiBody.size = '1024x1792'
            oaiBody.quality = 'standard'
        } else {
            oaiBody.size = '1024x1024'
        }
        const oaiRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(oaiBody),
        })
        if (!oaiRes.ok) throw new Error(`OpenAI error: ${await oaiRes.text()}`)
        const oaiData = await oaiRes.json()
        const item = oaiData.data?.[0]
        if (item?.url) return item.url
        if (item?.b64_json) {
            // Upload base64 to R2
            const buf = Buffer.from(item.b64_json, 'base64')
            const key = generateR2Key(channelId, `avatar-oai-${id}-angle${angleIndex}-${Date.now()}.png`)
            return await uploadToR2(buf, key, 'image/png')
        }
        return null
    }

    // ─── Gemini Flash / Imagen ───────────────────────────────────────────────
    if (provider === 'gemini') {
        const gemModel = model || 'gemini-3.1-flash-image-preview'
        const isFlash = gemModel.startsWith('gemini-')

        if (isFlash) {
            const parts: unknown[] = []

            if (referenceImage && referenceImage.startsWith('http')) {
                try {
                    const imgRes = await fetch(referenceImage)
                    if (imgRes.ok) {
                        const imgBuf = await imgRes.arrayBuffer()
                        const imgB64 = Buffer.from(imgBuf).toString('base64')
                        const imgMime = imgRes.headers.get('content-type') || 'image/jpeg'
                        parts.push({ inlineData: { data: imgB64, mimeType: imgMime } })
                    }
                } catch { /* ok */ }
            }
            parts.push({ text: prompt.slice(0, 2000) })

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
            if (!flashRes.ok) throw new Error(`Gemini Flash ${flashRes.status}: ${(await flashRes.text()).slice(0, 300)}`)
            const flashData = await flashRes.json() as {
                candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> } }>
            }
            const responseParts = flashData.candidates?.[0]?.content?.parts || []
            for (const part of responseParts) {
                if (part.inlineData?.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png'
                    const ext = mimeType.split('/')[1] || 'png'
                    const buffer = Buffer.from(part.inlineData.data, 'base64')
                    const key = generateR2Key(channelId, `avatar-gem-${id}-angle${angleIndex}-${Date.now()}.${ext}`)
                    return await uploadToR2(buffer, key, mimeType)
                }
            }
            throw new Error('Gemini Flash: no image in response')
        } else {
            // Imagen
            const imagenRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${gemModel}:predict?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [{ prompt: prompt.slice(0, 2000) }],
                        parameters: { sampleCount: 1, aspectRatio: '3:4' },
                    }),
                }
            )
            if (!imagenRes.ok) throw new Error(`Imagen ${imagenRes.status}: ${(await imagenRes.text()).slice(0, 300)}`)
            const imagenData = await imagenRes.json() as {
                predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
            }
            const pred = imagenData.predictions?.[0]
            if (pred?.bytesBase64Encoded) {
                const mimeType = pred.mimeType || 'image/png'
                const ext = mimeType.split('/')[1] || 'png'
                const buffer = Buffer.from(pred.bytesBase64Encoded, 'base64')
                const key = generateR2Key(channelId, `avatar-img-${id}-angle${angleIndex}-${Date.now()}.${ext}`)
                return await uploadToR2(buffer, key, mimeType)
            }
            throw new Error('Imagen: no prediction')
        }
    }

    throw new Error(`Unsupported provider: ${provider}`)
}

// ─── Fal.ai async job poller ─────────────────────────────────────────────────
async function pollFalJob(jobId: string, apiKey: string, falModel: string, maxWaitMs = 180000): Promise<string | null> {
    const start = Date.now()
    const baseModel = falModel.split('/').slice(-2).join('/')
    const statusUrl = `https://queue.fal.run/${falModel}/requests/${jobId}/status`
    const resultUrl = `https://queue.fal.run/${falModel}/requests/${jobId}`

    while (Date.now() - start < maxWaitMs) {
        await new Promise(r => setTimeout(r, 3000))
        const statusRes = await fetch(statusUrl, { headers: { 'Authorization': `Key ${apiKey}` } })
        if (!statusRes.ok) continue
        const statusData = await statusRes.json() as { status?: string }
        console.log(`[fal:poll] ${baseModel} job=${jobId.slice(0, 8)} status=${statusData.status}`)

        if (statusData.status === 'COMPLETED') {
            const resultRes = await fetch(resultUrl, { headers: { 'Authorization': `Key ${apiKey}` } })
            if (!resultRes.ok) return null
            const resultData = await resultRes.json() as { images?: Array<{ url?: string }> }
            return resultData.images?.[0]?.url || null
        }
        if (statusData.status === 'FAILED') {
            throw new Error(`Fal.ai job failed: ${jobId}`)
        }
    }
    throw new Error(`Fal.ai poll timeout after ${maxWaitMs / 1000}s`)
}
