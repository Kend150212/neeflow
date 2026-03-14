import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveImageAIKey } from '@/lib/resolve-ai-key'
import { randomUUID } from 'crypto'
import { uploadToR2, generateR2Key, isR2Configured } from '@/lib/r2'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// POST /api/studio/channels/[channelId]/projects/[id]/run
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ channelId: string; id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId, id } = await params

    const [project, member] = await Promise.all([
        prisma.studioProject.findFirst({ where: { id, channelId }, include: { workflow: true } }),
        prisma.channelMember.findFirst({ where: { channelId, userId: session.user.id } }),
    ])

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!project.workflow) return NextResponse.json({ error: 'No workflow saved' }, { status: 400 })

    const nodes = project.workflow.nodesJson as Array<{ type: string; data: Record<string, unknown> }>

    const imageGenNode = nodes.find(n => n.type === 'imageGenNode')
    const promptNode = nodes.find(n => n.type === 'promptNode')
    const avatarNode = nodes.find(n => n.type === 'avatarNode')
    const productNode = nodes.find(n => n.type === 'productNode')

    if (!imageGenNode) {
        return NextResponse.json({ error: 'No Image Generation node found in workflow' }, { status: 400 })
    }

    // ── Combine prompts ──────────────────────────────────────────────────────────
    // PromptNode = master/shared prompt (style, mood, brand voice)
    // ImageGenNode.imagePrompt = image-specific prompt
    // Final: masterPrompt + ", " + imageSpecificPrompt
    const masterPrompt = (promptNode?.data?.prompt as string | undefined)?.trim() || ''
    const imagePrompt = (imageGenNode.data?.imagePrompt as string | undefined)?.trim() || ''
    let combinedPrompt = [masterPrompt, imagePrompt].filter(Boolean).join(', ')
    if (!combinedPrompt) combinedPrompt = 'a professional marketing image'

    const provider = (imageGenNode.data?.provider as string) || 'fal_ai'
    const model = (imageGenNode.data?.model as string) || 'fal-ai/flux/schnell'
    const imageSize = (imageGenNode.data?.imageSize as string) || 'landscape_4_3'
    const numImages = (imageGenNode.data?.numImages as number) || 1

    const job = await prisma.studioJob.create({
        data: { projectId: id, status: 'running', provider },
    })

    await prisma.studioProject.update({
        where: { id },
        data: { lastRunAt: new Date() },
    })

    executeWorkflow({
        userId: session.user.id,
        channelId,
        projectId: id,
        jobId: job.id,
        provider,
        model,
        combinedPrompt,
        rawPrompt: combinedPrompt, // stored in output metadata
        imageSize,
        numImages,
        avatarNodeData: avatarNode?.data,
        productNodeData: productNode?.data,
    }).catch(console.error)

    return NextResponse.json({ job })
}

// ─── Workflow executor ─────────────────────────────────────────────────────────

interface WorkflowOpts {
    userId: string
    channelId: string
    projectId: string
    jobId: string
    provider: string
    model: string
    combinedPrompt: string
    rawPrompt: string
    imageSize: string
    numImages: number
    avatarNodeData?: Record<string, unknown>
    productNodeData?: Record<string, unknown>
}

async function executeWorkflow(opts: WorkflowOpts) {
    try {
        let finalPrompt = opts.combinedPrompt

        // Inject avatar context
        if (opts.avatarNodeData?.avatarPrompt) {
            finalPrompt = `${opts.avatarNodeData.avatarPrompt as string}, ${finalPrompt}`
        }

        // Inject product context
        if (opts.productNodeData?.productName) {
            const productPart = opts.productNodeData.description
                ? `featuring product: ${opts.productNodeData.productName} — ${String(opts.productNodeData.description).slice(0, 200)}`
                : `featuring product: ${opts.productNodeData.productName}`
            finalPrompt = `${finalPrompt}, ${productPart}`
        }

        let imageUrls: string[] = []

        if (opts.provider === 'fal_ai') {
            // ── Fal.ai path ─────────────────────────────────────────────────────
            const { falRunSync } = await import('@/lib/studio/fal-client')
            const result = await falRunSync({
                userId: opts.userId,
                model: opts.model,
                input: {
                    prompt: finalPrompt,
                    num_images: opts.numImages,
                    image_size: opts.imageSize,
                    num_inference_steps: opts.model.includes('schnell') ? 4 : 20,
                },
            }) as { images?: Array<{ url: string; width: number; height: number }> }

            const images = result.images || []
            for (const img of images) {
                const stored = await storeToR2(img.url, opts.channelId, 'image/png')
                imageUrls.push(stored || img.url)
                await prisma.studioOutput.create({
                    data: {
                        projectId: opts.projectId, jobId: opts.jobId, type: 'image',
                        url: stored || img.url, prompt: opts.rawPrompt,
                        metadata: { provider: 'fal_ai', model: opts.model, size: opts.imageSize, width: img.width, height: img.height },
                    },
                })
            }
        } else {
            // ── Multi-provider path (runware / openai / gemini) ──────────────────
            const keyResult = await resolveImageAIKey(opts.channelId, opts.provider, opts.model)
            if (!keyResult.ok) throw new Error(keyResult.data.error)

            const { apiKey, provider: resolvedProvider, model: resolvedModel } = keyResult.data

            // Map imageSize (fal format) → width/height
            const { width, height } = falSizeToPixels(opts.imageSize)

            for (let i = 0; i < opts.numImages; i++) {
                let url: string
                let mimeType = 'image/png'

                switch (resolvedProvider) {
                    case 'runware':
                        url = await generateRunware(apiKey, finalPrompt, resolvedModel || opts.model, width, height)
                        break
                    case 'openai': {
                        const r = await generateOpenAI(apiKey, finalPrompt, resolvedModel || opts.model, width, height)
                        url = r.url
                        break
                    }
                    case 'gemini': {
                        const aspect = pixelsToGeminiAspect(width, height)
                        const r = await generateGemini(apiKey, finalPrompt, resolvedModel || opts.model, aspect)
                        url = r.url
                        mimeType = r.mimeType || 'image/png'
                        break
                    }
                    default:
                        throw new Error(`Unsupported provider: ${resolvedProvider}`)
                }

                const stored = await storeToR2(url, opts.channelId, mimeType)
                imageUrls.push(stored || url)
                await prisma.studioOutput.create({
                    data: {
                        projectId: opts.projectId, jobId: opts.jobId, type: 'image',
                        url: stored || url, prompt: opts.rawPrompt,
                        metadata: { provider: resolvedProvider, model: resolvedModel || opts.model, size: opts.imageSize },
                    },
                })
            }
        }

        // Update cover image
        if (imageUrls[0]) {
            const count = await prisma.studioOutput.count({ where: { projectId: opts.projectId } })
            if (count <= opts.numImages) {
                await prisma.studioProject.update({ where: { id: opts.projectId }, data: { coverImage: imageUrls[0] } })
            }
        }

        await prisma.studioJob.update({ where: { id: opts.jobId }, data: { status: 'done', finishedAt: new Date() } })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        await prisma.studioJob.update({ where: { id: opts.jobId }, data: { status: 'failed', error: message, finishedAt: new Date() } })
    }
}

// ─── Store URL into R2 (optional, best-effort) ────────────────────────────────
async function storeToR2(url: string, channelId: string, mimeType: string): Promise<string | null> {
    try {
        const useR2 = await isR2Configured()
        if (!useR2) return null

        const tmpPath = path.join(os.tmpdir(), `studio_${randomUUID()}.png`)
        try {
            if (url.startsWith('data:')) {
                const base64 = url.split(',')[1]
                fs.writeFileSync(tmpPath, Buffer.from(base64, 'base64'))
            } else {
                const res = await fetch(url)
                if (!res.ok || !res.body) return null
                const writer = fs.createWriteStream(tmpPath)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await pipeline(Readable.fromWeb(res.body as any), writer)
            }
            const buf = fs.readFileSync(tmpPath)
            const r2Key = generateR2Key(channelId, `studio-output-${randomUUID()}.png`)
            return await uploadToR2(buf, r2Key, mimeType)
        } finally {
            fs.unlink(tmpPath, () => { })
        }
    } catch {
        return null
    }
}

// ─── Size utilities ───────────────────────────────────────────────────────────
function falSizeToPixels(size: string): { width: number; height: number } {
    switch (size) {
        case 'square_hd': return { width: 1024, height: 1024 }
        case 'portrait_4_3': return { width: 768, height: 1024 }
        case 'landscape_4_3': return { width: 1024, height: 768 }
        case 'landscape_16_9': return { width: 1280, height: 720 }
        case 'portrait_16_9': return { width: 720, height: 1280 }
        default: return { width: 1024, height: 1024 }
    }
}

function pixelsToGeminiAspect(width: number, height: number): string {
    const ratio = width / height
    if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9'
    if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16'
    if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3'
    if (Math.abs(ratio - 3 / 4) < 0.05) return '3:4'
    return '1:1'
}

// ─── Provider implementations (inline — no code duplication needed here) ──────

async function generateRunware(apiKey: string, prompt: string, model: string, width: number, height: number): Promise<string> {
    const { randomUUID: uuid } = await import('crypto')
    const res = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify([{
            taskType: 'imageInference',
            taskUUID: uuid(),
            positivePrompt: prompt,
            model,
            width,
            height,
            numberResults: 1,
            outputFormat: 'PNG',
        }]),
    })
    if (!res.ok) throw new Error(`Runware error: ${res.status} ${await res.text()}`)
    const data = await res.json()
    const img = data.data?.[0]
    if (!img?.imageURL) throw new Error('Runware returned no image')
    return img.imageURL
}

async function generateOpenAI(apiKey: string, prompt: string, model: string, width: number, height: number): Promise<{ url: string }> {
    let size = '1024x1024'
    if (width > height) size = model === 'gpt-image-1' ? '1536x1024' : '1792x1024'
    else if (height > width) size = model === 'gpt-image-1' ? '1024x1536' : '1024x1792'

    const body: Record<string, unknown> = { model, prompt, n: 1, size }
    if (model !== 'gpt-image-1') body.response_format = 'url'

    const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(`OpenAI error: ${err.error?.message || res.statusText}`)
    }
    const data = await res.json() as { data: Array<{ url?: string; b64_json?: string }> }
    const item = data.data[0]
    if (item.b64_json) return { url: `data:image/png;base64,${item.b64_json}` }
    return { url: item.url! }
}

async function generateGemini(apiKey: string, prompt: string, model: string, aspectRatio: string): Promise<{ url: string; mimeType?: string }> {
    const isImagen = model.includes('imagen')
    if (isImagen) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio } }),
        })
        if (!res.ok) throw new Error(`Gemini Imagen error: ${res.status}`)
        const data = await res.json() as { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> }
        const pred = data.predictions?.[0]
        if (!pred?.bytesBase64Encoded) throw new Error('Gemini Imagen returned no image')
        const mime = pred.mimeType || 'image/png'
        return { url: `data:${mime};base64,${pred.bytesBase64Encoded}`, mimeType: mime }
    } else {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Create a visually striking marketing image: ${prompt}` }] }],
                generationConfig: { responseModalities: ['Text', 'Image'], imageConfig: { aspectRatio } },
            }),
        })
        if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
        const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> }
        for (const part of data.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) {
                const mime = part.inlineData.mimeType || 'image/png'
                return { url: `data:${mime};base64,${part.inlineData.data}`, mimeType: mime }
            }
        }
        throw new Error('Gemini returned no image')
    }
}
