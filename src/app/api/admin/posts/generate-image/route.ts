import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { incrementImageUsage } from '@/lib/ai-quota'
import { resolveImageAIKey } from '@/lib/resolve-ai-key'
import { randomUUID } from 'crypto'
import {
    getGDriveAccessToken,
    getUserGDriveAccessToken,
    getOrCreateChannelFolder,
    getOrCreateMonthlyFolder,
    uploadFile,
    makeFilePublic,
} from '@/lib/gdrive'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'
import { checkStorageQuota } from '@/lib/storage-quota'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

/**
 * POST /api/admin/posts/generate-image
 * AI-generates an image from a prompt using the channel's configured image provider.
 * Supports image-to-image via refImageBase64 + imageStrength (0.0–1.0).
 *
 * Body: { channelId, prompt, width?, height?, refImageBase64?, imageStrength? }
 * Returns: { mediaItem, provider }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
        channelId,
        prompt,
        width = 1024,
        height = 1024,
        provider: requestedProvider,
        model: requestedModel,
        keySource,
        refImageBase64,          // base64 data URI: "data:image/png;base64,..."
        imageStrength = 0.7,     // 0.0 = ignore ref, 1.0 = copy exactly
    } = await req.json()

    if (!channelId || !prompt) {
        return NextResponse.json({ error: 'channelId and prompt are required' }, { status: 400 })
    }

    // ─── Resolve image provider ───────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = await prisma.channel.findUnique({
        where: { id: channelId },
    }) as any

    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // ─── Quota-aware image key resolution ────────────────────
    const preferredProvider = requestedProvider || channel.defaultImageProvider || null
    const keyResult = await resolveImageAIKey(channelId, preferredProvider, requestedModel, keySource)
    if (!keyResult.ok) {
        return NextResponse.json(
            { error: keyResult.data.error, errorType: keyResult.data.errorType, used: keyResult.data.used, limit: keyResult.data.limit },
            { status: keyResult.status }
        )
    }
    const { apiKey, provider: resolvedProvider, usingPlatformKey, ownerId } = keyResult.data
    console.log(`[generate-image] Provider: ${resolvedProvider}, usingPlatformKey: ${usingPlatformKey}, ownerId: ${ownerId}, refImage: ${!!refImageBase64}, strength: ${imageStrength}`)
    // Build model fallback chain, but validate for Gemini — only models with 'image'/'imagen' in ID
    let imageModel = requestedModel || keyResult.data.model || channel.defaultImageModel || null
    if (resolvedProvider === 'gemini' && imageModel && !imageModel.includes('image') && !imageModel.includes('imagen')) {
        // Stored model is not an image model — ignore it (use provider default)
        imageModel = null
    }

    // ─── Generate image via provider ──────────────────
    let imageUrl: string
    let mimeType = 'image/png'

    try {
        switch (resolvedProvider) {
            case 'runware': {
                const model = imageModel || 'runware:100@1' // FLUX.1 [Dev]
                imageUrl = await generateWithRunware(apiKey, prompt, model, width, height, refImageBase64, imageStrength)
                break
            }
            case 'openai': {
                const model = imageModel || 'dall-e-3'
                const result = await generateWithOpenAI(apiKey, prompt, model, width, height, refImageBase64, imageStrength)
                imageUrl = result.url
                break
            }
            case 'gemini': {
                // Default: Nano Banana 2 (gemini-3.1-flash-image-preview) — best all-around
                const model = imageModel || 'gemini-3.1-flash-image-preview'
                // Server-side validation: only models with 'image' or 'imagen' in ID support image gen
                if (!model.includes('image') && !model.includes('imagen')) {
                    return NextResponse.json(
                        { error: `Model "${model}" does not support image generation. Please select an image model (e.g. Nano Banana 2, Imagen 3).` },
                        { status: 400 }
                    )
                }
                // Convert width/height to Gemini aspect ratio string
                const ratio = width / height
                let geminiAspect = '1:1'
                if (Math.abs(ratio - 16 / 9) < 0.05) geminiAspect = '16:9'
                else if (Math.abs(ratio - 9 / 16) < 0.05) geminiAspect = '9:16'
                else if (Math.abs(ratio - 4 / 3) < 0.05) geminiAspect = '4:3'
                else if (Math.abs(ratio - 3 / 4) < 0.05) geminiAspect = '3:4'
                else if (Math.abs(ratio - 4 / 5) < 0.05) geminiAspect = '4:5'
                else if (Math.abs(ratio - 1) < 0.05) geminiAspect = '1:1'
                const result = await generateWithGemini(apiKey, prompt, model, geminiAspect, refImageBase64, imageStrength)
                imageUrl = result.url
                mimeType = result.mimeType || 'image/png'
                break
            }
            default:
                return NextResponse.json({ error: `Unsupported image provider: ${resolvedProvider}` }, { status: 400 })
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Image generation failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }

    // ─── Download / decode to disk → upload to R2 (or GDrive) → cleanup ───
    const tmpPath = path.join(os.tmpdir(), `asoc_img_${randomUUID()}.png`)
    try {
        if (imageUrl.startsWith('data:')) {
            // Base64 data URI — decode directly to file
            const base64Data = imageUrl.split(',')[1]
            fs.writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))
        } else {
            // Remote URL — stream download to disk
            const downloadRes = await fetch(imageUrl)
            if (!downloadRes.ok || !downloadRes.body) {
                throw new Error('Failed to download generated image')
            }
            const writer = fs.createWriteStream(tmpPath)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await pipeline(Readable.fromWeb(downloadRes.body as any), writer)
        }

        // Read file for upload
        const fileBuffer = fs.readFileSync(tmpPath)
        const fileSize = fs.statSync(tmpPath).size
        const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
        const shortId = randomUUID().slice(0, 6)
        const now = new Date()
        const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`
        const uniqueName = `ai-image ${shortId} - ${dateStr}.${ext}`
        const usedModel = imageModel || (resolvedProvider === 'gemini' ? 'gemini-2.0-flash-exp' : resolvedProvider === 'openai' ? 'dall-e-3' : 'runware:100@1')

        // ─── Check storage quota ──────────────────────────
        const quota = await checkStorageQuota(session.user.id, fileSize)
        if (!quota.allowed) {
            return NextResponse.json(
                { error: quota.reason, code: 'STORAGE_LIMIT_REACHED', usedMB: quota.usedMB, limitMB: quota.limitMB },
                { status: 429 }
            )
        }

        // ─── Try R2 first ────────────────────────────────
        const useR2 = await isR2Configured()

        if (useR2) {
            const r2Key = generateR2Key(channelId, uniqueName)
            const publicUrl = await uploadToR2(fileBuffer, r2Key, mimeType)

            const mediaItem = await prisma.mediaItem.create({
                data: {
                    channelId,
                    url: publicUrl,
                    thumbnailUrl: publicUrl,
                    storageFileId: r2Key,
                    type: 'image',
                    source: 'ai_generated',
                    originalName: uniqueName,
                    fileSize,
                    mimeType,
                    aiMetadata: {
                        storage: 'r2',
                        r2Key,
                        provider: resolvedProvider,
                        model: usedModel,
                        prompt,
                        usedRefImage: !!refImageBase64,
                        imageStrength: refImageBase64 ? imageStrength : undefined,
                    },
                },
            })

            // Increment quota usage ONLY on success and ONLY for platform key (BYOK = unlimited)
            if (usingPlatformKey && ownerId) {
                await incrementImageUsage(ownerId).catch(() => { })
            }

            return NextResponse.json({ mediaItem, provider: resolvedProvider, model: usedModel })
        }

        // ─── Fallback: Google Drive ──────────────────────
        let accessToken: string
        let targetFolderId: string

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { gdriveRefreshToken: true, gdriveFolderId: true },
        })

        if (user?.gdriveRefreshToken && user?.gdriveFolderId) {
            accessToken = await getUserGDriveAccessToken(session.user.id)
            const channelName = channel.displayName || channel.name || 'General'
            const channelFolder = await getOrCreateChannelFolder(accessToken, user.gdriveFolderId, channelName)
            const monthlyFolder = await getOrCreateMonthlyFolder(accessToken, channelFolder.id)
            targetFolderId = monthlyFolder.id
        } else {
            accessToken = await getGDriveAccessToken()
            const integration = await prisma.apiIntegration.findFirst({
                where: { provider: 'gdrive' },
            })
            const gdriveConfig = (integration?.config || {}) as Record<string, string>
            if (!gdriveConfig.parentFolderId) {
                throw new Error('No storage configured. Set up Cloudflare R2 or Google Drive in API Hub.')
            }
            const channelName = channel.displayName || channel.name || 'General'
            const channelFolder = await getOrCreateChannelFolder(accessToken, gdriveConfig.parentFolderId, channelName)
            targetFolderId = channelFolder.id
        }

        const driveFile = await uploadFile(accessToken, uniqueName, mimeType, fileBuffer, targetFolderId)
        const publicUrl = await makeFilePublic(accessToken, driveFile.id, mimeType)
        const thumbnailUrl = `https://lh3.googleusercontent.com/d/${driveFile.id}=s400`

        const mediaItem = await prisma.mediaItem.create({
            data: {
                channelId,
                url: publicUrl,
                thumbnailUrl,
                storageFileId: driveFile.id,
                type: 'image',
                source: 'ai_generated',
                originalName: uniqueName,
                fileSize,
                mimeType,
                aiMetadata: {
                    storage: 'gdrive',
                    provider: resolvedProvider,
                    model: usedModel,
                    prompt,
                    gdriveFolderId: targetFolderId,
                    webViewLink: driveFile.webViewLink,
                    usedRefImage: !!refImageBase64,
                    imageStrength: refImageBase64 ? imageStrength : undefined,
                },
            },
        })

        // Increment quota usage ONLY on success and ONLY for platform key (BYOK = unlimited)
        if (usingPlatformKey && ownerId) {
            await incrementImageUsage(ownerId).catch(() => { })
        }

        // Return updated quota in response for frontend
        let updatedQuota: { used: number; limit: number } | undefined
        if (usingPlatformKey && ownerId) {
            try {
                const { getUserImageQuota } = await import('@/lib/ai-quota')
                updatedQuota = await getUserImageQuota(ownerId)
            } catch { /* ignore */ }
        }

        return NextResponse.json({
            mediaItem,
            provider: resolvedProvider,
            model: usedModel,
            usingPlatformKey,
            quota: updatedQuota,
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to process image'
        return NextResponse.json({ error: msg }, { status: 500 })
    } finally {
        // Always clean up temp file
        fs.unlink(tmpPath, () => { })
    }
}

// ─── Provider implementations ──────────────────────────

/** Extract raw base64 string and mime type from data URI */
function parseDataUri(dataUri: string): { base64: string; mime: string } {
    const [header, base64] = dataUri.split(',')
    const mime = header.match(/data:([^;]+);/)?.[1] || 'image/png'
    return { base64, mime }
}

async function generateWithRunware(
    apiKey: string,
    prompt: string,
    model: string,
    width: number,
    height: number,
    refImageBase64?: string,
    imageStrength = 0.7,
): Promise<string> {
    // Runware supports image-to-image via `seedImage` (base64) + `strength` (0.0–1.0)
    // strength: 0.0 = ignore ref entirely, 1.0 = copy ref exactly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task: Record<string, any> = {
        taskType: 'imageInference',
        taskUUID: randomUUID(),
        positivePrompt: prompt,
        model,
        width,
        height,
        numberResults: 1,
        outputFormat: 'PNG',
    }

    if (refImageBase64) {
        // Runware expects base64 string (no data URI prefix) for seedImage
        const { base64 } = parseDataUri(refImageBase64)
        task.seedImage = base64
        // Runware strength: 0.0 = copy ref exactly, 1.0 = fully ignore ref (pure generation)
        // Non-linear mapping so the slider feels meaningful:
        //   100% (clone)   → 0.05 (nearly identical)
        //    70% (similar) → 0.55 (recognizable subject, creative scene)
        //    30% (creative) → 0.82 (very free, just vibes)
        //    10%            → 0.92
        const s = 1 - imageStrength  // 0.0..1.0 (linear inverse)
        // Apply curve: lower strengths get more deviation than a straight line would give
        task.strength = imageStrength >= 0.95
            ? 0.05
            : imageStrength >= 0.60
                ? 0.45 + (1 - imageStrength) * 0.55
                : 0.75 + (1 - imageStrength) * 0.20
        task.strength = Math.max(0.02, Math.min(0.95, task.strength))
    }

    const res = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify([task]),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Runware error: ${err.error || res.statusText}`)
    }

    const data = await res.json()
    const imageData = data.data?.[0]
    if (!imageData?.imageURL) {
        throw new Error('Runware returned no image')
    }
    return imageData.imageURL
}

async function generateWithOpenAI(
    apiKey: string,
    prompt: string,
    model: string,
    width: number,
    height: number,
    refImageBase64?: string,
    imageStrength = 0.7,
): Promise<{ url: string }> {
    const isGptImage1 = model === 'gpt-image-1'

    // Map dimensions to supported OpenAI sizes
    let size = '1024x1024'
    if (width > height) size = '1792x1024'
    else if (height > width) size = '1024x1792'
    if (isGptImage1) {
        if (width > height) size = '1536x1024'
        else if (height > width) size = '1024x1536'
        else size = '1024x1024'
    }

    // If reference image provided, use /images/edits for img2img
    if (refImageBase64) {
        try {
            const { base64, mime } = parseDataUri(refImageBase64)
            const imageBuffer = Buffer.from(base64, 'base64')

            // Build multipart form
            const form = new FormData()
            const blob = new Blob([imageBuffer], { type: mime })
            form.append('image', blob, 'reference.png')
            form.append('model', isGptImage1 ? 'gpt-image-1' : 'dall-e-2') // edits only supports gpt-image-1 or dall-e-2

            // Adjust prompt based on strength
            let editPrompt = prompt
            if (imageStrength >= 0.9) {
                editPrompt = `Reproduce this image as closely as possible, keeping the same composition, colors, style, and subjects. ${prompt}`
            } else if (imageStrength >= 0.6) {
                editPrompt = `Use this image as a reference for composition and style. ${prompt}`
            } else {
                editPrompt = `Take inspiration from this image's general aesthetic. ${prompt}`
            }

            form.append('prompt', editPrompt)
            form.append('n', '1')
            form.append('size', size)

            const res = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                body: form,
            })

            if (res.ok) {
                const data = await res.json()
                const item = data.data[0]
                if (item.b64_json) return { url: `data:image/png;base64,${item.b64_json}` }
                return { url: item.url }
            }
            // If edits endpoint fails (unsupported model etc.), fall through to standard generation
            console.warn('[generate-image] OpenAI edits failed, falling back to standard generation')
        } catch (err) {
            console.warn('[generate-image] OpenAI img2img error, falling back:', err)
        }
    }

    // Standard text-to-image generation (with ref image injected into prompt as description)
    let enhancedPrompt = prompt
    if (refImageBase64) {
        const { base64: refB64, mime: refMime } = parseDataUri(refImageBase64)
        const imageDescription = await analyzeImageWithGemini(apiKey, refB64, refMime)
        enhancedPrompt = buildRefPrompt(prompt, imageDescription, imageStrength)
    }

    const requestBody: Record<string, unknown> = {
        model,
        prompt: enhancedPrompt,
        n: 1,
        size,
    }

    if (!isGptImage1) {
        requestBody.response_format = 'url'
    }

    const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`OpenAI error: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json()
    const item = data.data[0]
    if (item.b64_json) return { url: `data:image/png;base64,${item.b64_json}` }
    return { url: item.url }
}

async function generateWithGemini(
    apiKey: string,
    prompt: string,
    model: string,
    aspectRatio: string = '1:1',
    refImageBase64?: string,
    imageStrength = 0.7,
): Promise<{ url: string; mimeType?: string }> {
    const isImagen = model.includes('imagen')

    if (isImagen) {
        // Imagen API — image-to-image via editImage endpoint if ref provided
        if (refImageBase64) {
            try {
                const { base64, mime } = parseDataUri(refImageBase64)
                // Imagen 3 edit: editImage endpoint
                const editUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:editImage`
                const editRes = await fetch(editUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey,
                    },
                    body: JSON.stringify({
                        instances: [{
                            prompt: buildRefPrompt(prompt, await analyzeImageWithGemini(apiKey, base64, mime), imageStrength),
                            referenceImages: [{
                                referenceType: 'REFERENCE_TYPE_RAW',
                                referenceId: 1,
                                referenceImage: { bytesBase64Encoded: base64, mimeType: mime },
                            }],
                        }],
                        parameters: { sampleCount: 1, aspectRatio },
                    }),
                })

                if (editRes.ok) {
                    const editData = await editRes.json()
                    const prediction = editData.predictions?.[0]
                    if (prediction?.bytesBase64Encoded) {
                        const mimeOut = prediction.mimeType || 'image/png'
                        return { url: `data:${mimeOut};base64,${prediction.bytesBase64Encoded}`, mimeType: mimeOut }
                    }
                }
                console.warn('[generate-image] Imagen editImage failed, falling back to predict')
            } catch (err) {
                console.warn('[generate-image] Imagen img2img error, falling back:', err)
            }
        }

        // Standard Imagen text-to-image (with ref in prompt if available)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                instances: [{ prompt: refImageBase64 ? buildRefPrompt(prompt, await analyzeImageWithGemini(apiKey, parseDataUri(refImageBase64).base64, parseDataUri(refImageBase64).mime), imageStrength) : prompt }],
                parameters: { sampleCount: 1, aspectRatio },
            }),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(`Gemini Imagen error: ${err.error?.message || res.statusText}`)
        }

        const data = await res.json()
        const prediction = data.predictions?.[0]
        if (!prediction?.bytesBase64Encoded) {
            throw new Error('Gemini Imagen returned no image')
        }

        const mime = prediction.mimeType || 'image/png'
        return { url: `data:${mime};base64,${prediction.bytesBase64Encoded}`, mimeType: mime }
    } else {
        // Gemini native image generation (Nano Banana / gemini-*-image-*)
        // Supports image-to-image by sending the reference image as inlineData alongside the text prompt
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

        // Build parts array — always include text prompt; add reference image if provided
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = []

        if (refImageBase64) {
            const { base64, mime } = parseDataUri(refImageBase64)
            // For non-clone strengths: run a quick vision pre-pass to describe the image
            // so the generation prompt can reference the subject by name
            const imageDescription = imageStrength < 0.92
                ? await analyzeImageWithGemini(apiKey, base64, mime)
                : ''
            // Send reference image FIRST so the model anchors to it
            parts.push({ inlineData: { mimeType: mime, data: base64 } })
            // Then add the instruction with context-aware prompt
            parts.push({ text: buildGeminiRefPrompt(prompt, imageStrength, imageDescription) })
        } else {
            parts.push({ text: `Create a visually striking image that represents this concept:\n\n${prompt}` })
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    responseModalities: ['Text', 'Image'],
                    imageConfig: { aspectRatio },
                },
            }),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(`Gemini error: ${err.error?.message || res.statusText}`)
        }

        const data = await res.json()

        if (data.promptFeedback?.blockReason) {
            throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`)
        }

        const candidates = data.candidates
        if (!candidates?.[0]?.content?.parts) {
            const reason = candidates?.[0]?.finishReason || 'unknown'
            throw new Error(`Gemini returned no content (finishReason: ${reason}). Model: ${model}`)
        }

        for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
                const mime = part.inlineData.mimeType || 'image/png'
                const dataUrl = `data:${mime};base64,${part.inlineData.data}`
                return { url: dataUrl, mimeType: mime }
            }
        }

        throw new Error(`Gemini returned no image in response. Model: ${model}`)
    }
}

/**
 * Build a prompt that instructs the AI to use the reference image at a given strength level.
 * Used when the native API doesn't support binary img2img (e.g. DALL-E 3, Imagen text-only endpoint).
 */
function buildRefPrompt(prompt: string, imageDescription: string, imageStrength: number): string {
    if (imageStrength >= 0.92) {
        return `Reproduce the reference image as closely as possible: same composition, subjects, colors, lighting, and style. ${prompt}`
    } else if (imageStrength >= 0.60) {
        return `The reference image shows: ${imageDescription}. Create a creative marketing scene or poster where this subject is the central focus, placed in a fresh and engaging new context or environment. The subject should be clearly recognizable. ${prompt}`
    } else if (imageStrength >= 0.30) {
        return `Inspired by the aesthetic and mood of a reference that shows: ${imageDescription}. Capture a similar visual style and color palette while creating an original image for: ${prompt}`
    } else {
        return `Using a very loose aesthetic inspiration from a reference showing: ${imageDescription}. Create an original creative image for: ${prompt}`
    }
}

/**
 * Gemini-specific ref prompt — more explicit since we're passing the image as inlineData.
 * The image is included in the same request so Gemini can actually see it.
 * We explicitly instruct it HOW to use the image based on strength.
 */
function buildGeminiRefPrompt(prompt: string, imageStrength: number, imageDescription?: string): string {
    if (imageStrength >= 0.92) {
        // 100% clone: faithfully reproduce the image
        return `Look at the reference image I provided. Generate a new image that reproduces it as closely as possible — same subjects, composition, colors, lighting, and overall style. Apply this additional instruction if any: ${prompt}`
    } else if (imageStrength >= 0.60) {
        // 60–91%: creative scene placement — identify the subject and build a new scene around it
        const subjectHint = imageDescription ? ` Based on analysis, the image shows: ${imageDescription}.` : ''
        return `Look at the reference image I provided carefully.${subjectHint}

Step 1 — Identify: What is the main subject, product, or object shown in this image?
Step 2 — Create: Design a creative, professional marketing poster or scene where this exact subject is the central, clearly recognizable element, but placed in a new, dynamic, or storytelling context. Examples: the subject displayed on a computer screen while someone works, a person interacting with it, the subject incorporated into a lifestyle scene, etc.
Step 3 — Apply: ${prompt}

Important: The result should be visually fresh and creative, NOT a direct copy. The reference subject must be clearly present and recognizable.`
    } else if (imageStrength >= 0.30) {
        // 30–59%: style/mood inspiration — capture the aesthetic, not the content
        return `Look at the reference image I provided. Borrow its visual style, color palette, and mood — but create an entirely new original image for this concept: ${prompt}. The reference is for aesthetic inspiration only; do not copy its subjects or composition directly.`
    } else {
        // <30%: very loose — just vibes
        return `Using the reference image as a very loose mood board, create a completely original creative image for: ${prompt}`
    }
}

/**
 * Use Gemini Flash (vision) to describe what a reference image shows.
 * This description is then used to build smarter prompts for other providers.
 */
async function analyzeImageWithGemini(apiKey: string, base64: string, mime: string): Promise<string> {
    try {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: mime, data: base64 } },
                        { text: 'Describe this image concisely in 1-2 sentences. Focus on: what the main subject/object is, key visual elements, colors, and style/mood. Do NOT use phrases like "the image shows" — just describe directly. Max 60 words.' },
                    ],
                }],
            }),
        })
        if (!res.ok) return ''
        const data = await res.json()
        return data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text?.trim() || ''
    } catch {
        return ''
    }
}
