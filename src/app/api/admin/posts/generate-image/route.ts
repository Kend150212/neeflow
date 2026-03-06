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
        // Runware `strength` is inverted: 0 = use ref exactly, 1 = ignore ref
        // So we invert: imageStrength=1.0 → strength=0.0 (copy), imageStrength=0.0 → strength=1.0 (creative)
        task.strength = Math.max(0, Math.min(1, 1 - imageStrength))
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
    const enhancedPrompt = refImageBase64
        ? buildRefPrompt(prompt, imageStrength)
        : prompt

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
                            prompt: buildRefPrompt(prompt, imageStrength),
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
                instances: [{ prompt: refImageBase64 ? buildRefPrompt(prompt, imageStrength) : prompt }],
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
            // Send reference image FIRST so the model anchors to it
            parts.push({ inlineData: { mimeType: mime, data: base64 } })
            // Then add the instruction
            parts.push({ text: buildGeminiRefPrompt(prompt, imageStrength) })
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
function buildRefPrompt(prompt: string, imageStrength: number): string {
    if (imageStrength >= 0.9) {
        return `Reproduce the provided reference image as closely as possible. Maintain the same composition, color palette, lighting, style, and subjects. ${prompt}`
    } else if (imageStrength >= 0.7) {
        return `Using the provided reference image as your primary guide, generate an image that closely matches its style, composition, and visual elements. ${prompt}`
    } else if (imageStrength >= 0.4) {
        return `Inspired by the provided reference image, generate an image that borrows its general style and color palette while adapting to: ${prompt}`
    } else {
        return `Using the reference image only as a loose aesthetic inspiration, generate a creative image for: ${prompt}`
    }
}

/**
 * Gemini-specific ref prompt — more explicit since we're passing the image as inlineData.
 */
function buildGeminiRefPrompt(prompt: string, imageStrength: number): string {
    if (imageStrength >= 0.9) {
        return `Look at the image I provided above. Generate a new image that is as close to the reference image as possible — same composition, colors, style, subjects, and layout. Additional instruction: ${prompt}`
    } else if (imageStrength >= 0.7) {
        return `Using the image I provided above as a strong reference, generate a new image that closely follows its visual style, composition, and subjects. Additional instruction: ${prompt}`
    } else if (imageStrength >= 0.4) {
        return `Using the image I provided above as general style inspiration, generate an image for: ${prompt}`
    } else {
        return `The image I provided is just a loose reference for mood and aesthetic. Create an original image for: ${prompt}`
    }
}
