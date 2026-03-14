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

// Edge type from ReactFlow
interface WorkflowEdge { source: string; target: string; targetHandle?: string | null }
// Node snapshot stored in workflow
interface WorkflowNode { id: string; type: string; data: Record<string, unknown> }

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

    const nodes = project.workflow.nodesJson as unknown as WorkflowNode[]
    const edges = project.workflow.edgesJson as unknown as WorkflowEdge[]

    const imageGenNodes = nodes.filter(n => n.type === 'imageGenNode')
    if (imageGenNodes.length === 0) {
        return NextResponse.json({ error: 'No Image Generation node found in workflow' }, { status: 400 })
    }

    // For now process first imageGenNode (can be extended for multiple)
    const imageGenNode = imageGenNodes[0]

    // ── Resolve connected nodes via edges ────────────────────────────────────
    // Find all nodes connected TO imageGenNode (by target)
    const connectedNodeIds = new Set(
        edges.filter(e => e.target === imageGenNode.id).map(e => e.source)
    )

    const promptNode = nodes.find(n => n.type === 'promptNode' && connectedNodeIds.has(n.id))
    const productNode = nodes.find(n => n.type === 'productNode' && connectedNodeIds.has(n.id))
    // ALL connected avatar nodes (sorted by id for determinism)
    const avatarNodes = nodes
        .filter(n => n.type === 'avatarNode' && connectedNodeIds.has(n.id))
        .sort((a, b) => a.id.localeCompare(b.id))

    // ── Build prompts ─────────────────────────────────────────────────────────
    const masterPrompt = (promptNode?.data?.prompt as string | undefined)?.trim() || ''
    const imagePrompt = (imageGenNode.data?.imagePrompt as string | undefined)?.trim() || ''
    let basePrompt = [masterPrompt, imagePrompt].filter(Boolean).join(', ')
    if (!basePrompt) basePrompt = 'a professional marketing image, ultra detailed, cinematic lighting'

    const provider = (imageGenNode.data?.provider as string) || 'fal_ai'
    const model = (imageGenNode.data?.model as string) || 'fal-ai/flux/dev'
    const imageSize = (imageGenNode.data?.imageSize as string) || 'landscape_4_3'
    const numImages = (imageGenNode.data?.numImages as number) || 1

    // Inject product context into prompt
    let finalBasePrompt = basePrompt
    if (productNode?.data?.productName) {
        const desc = productNode.data.description
            ? `${productNode.data.productName} — ${String(productNode.data.description).slice(0, 150)}`
            : String(productNode.data.productName)
        finalBasePrompt = `${finalBasePrompt}, featuring product: ${desc}`
    }

    const job = await prisma.studioJob.create({
        data: { projectId: id, status: 'running', provider },
    })
    await prisma.studioProject.update({ where: { id }, data: { lastRunAt: new Date() } })

    // Run async — 1 generation per avatar (or once if no avatar connected)
    executeWorkflow({
        userId: session.user.id,
        channelId,
        projectId: id,
        jobId: job.id,
        provider,
        model,
        basePrompt: finalBasePrompt,
        avatarNodes,
        productNode: productNode?.data,
        imageSize,
        numImages,
    }).catch(console.error)

    return NextResponse.json({ job })
}

// ─── Main executor ────────────────────────────────────────────────────────────
interface WorkflowOpts {
    userId: string
    channelId: string
    projectId: string
    jobId: string
    provider: string
    model: string
    basePrompt: string
    avatarNodes: WorkflowNode[]
    productNode?: Record<string, unknown>
    imageSize: string
    numImages: number
}


// ─── Avatar DB record type ─────────────────────────────────────────────────────
interface AvatarRecord {
    id: string
    name: string
    prompt: string
    coverImage: string | null
    poseImages: unknown   // JSON array: [{url, label?, prompt?}] or [url, url, ...]
    assets: Array<{ id: string; type: string; name: string; prompt: string | null; images: unknown }>
}

async function executeWorkflow(opts: WorkflowOpts) {
    try {
        let generatedAny = false

        if (opts.avatarNodes.length === 0) {
            // No avatar connected → plain generation without reference
            await runGeneration({ ...opts, avatarData: null, refImageBase64: null, finalPrompt: opts.basePrompt })
            generatedAny = true
        } else {
            // 1 generation per connected avatar — each uses its own reference image
            for (const avatarNode of opts.avatarNodes) {
                const nodeData = avatarNode.data
                const avatarId = nodeData.avatarId as string | undefined

                // ── Fetch full avatar from DB to get poseImages, outfit/accessory prompts
                let avatarRecord: AvatarRecord | null = null
                if (avatarId) {
                    avatarRecord = await prisma.studioAvatar.findUnique({
                        where: { id: avatarId },
                        select: {
                            id: true,
                            name: true,
                            prompt: true,
                            coverImage: true,
                            poseImages: true,
                            assets: {
                                select: { id: true, type: true, name: true, prompt: true, images: true },
                            },
                        },
                    }) as AvatarRecord | null
                }

                // ── Build combined prompt ─────────────────────────────────────
                // Order: Avatar prompt + Outfit prompt + Accessory prompt + base prompt
                const promptParts: string[] = []

                // Avatar base prompt (from DB preferred, fallback to node.data)
                const avatarBasePrompt = avatarRecord?.prompt || (nodeData.avatarPrompt as string | undefined) || ''
                if (avatarBasePrompt) promptParts.push(avatarBasePrompt)

                // Outfit prompt — only if user selected an outfit on this avatar node
                const selectedOutfitId = nodeData.outfitId as string | undefined
                if (selectedOutfitId && avatarRecord) {
                    const outfitAsset = avatarRecord.assets.find(a => a.id === selectedOutfitId && a.type === 'outfit')
                    if (outfitAsset?.prompt) {
                        promptParts.push(`wearing: ${outfitAsset.prompt}`)
                    } else if (outfitAsset?.name) {
                        promptParts.push(`wearing: ${outfitAsset.name}`)
                    }
                } else if (nodeData.outfitName) {
                    // Fallback: outfit name only (no prompt in DB)
                    promptParts.push(`wearing: ${nodeData.outfitName}`)
                }

                // Accessory prompt — only if user selected an accessory
                const selectedAccessoryId = nodeData.accessoryId as string | undefined
                if (selectedAccessoryId && avatarRecord) {
                    const accessoryAsset = avatarRecord.assets.find(a => a.id === selectedAccessoryId && a.type === 'accessory')
                    if (accessoryAsset?.prompt) {
                        promptParts.push(`with accessory: ${accessoryAsset.prompt}`)
                    } else if (accessoryAsset?.name) {
                        promptParts.push(`with accessory: ${accessoryAsset.name}`)
                    }
                } else if (nodeData.accessoryName) {
                    promptParts.push(`with accessory: ${nodeData.accessoryName}`)
                }

                // Append base (master + image-specific) prompt
                if (opts.basePrompt) promptParts.push(opts.basePrompt)
                const finalPrompt = promptParts.join(', ')

                // ── Select reference image ────────────────────────────────────
                // Priority: 1) front-face pose (poseImages[0]), 2) coverImage, 3) node.data.avatarCover
                let refImageUrl: string | null = null

                if (avatarRecord?.poseImages) {
                    const poseArray = avatarRecord.poseImages as unknown[]
                    // poseImages can be [{url, label?}] or [url, ...]
                    const firstPose = poseArray[0]
                    if (typeof firstPose === 'string') {
                        refImageUrl = firstPose
                    } else if (firstPose && typeof firstPose === 'object' && 'url' in firstPose) {
                        refImageUrl = (firstPose as { url: string }).url
                    }
                }
                // Fallback to coverImage
                if (!refImageUrl && avatarRecord?.coverImage) refImageUrl = avatarRecord.coverImage
                // Final fallback: node.data.avatarCover
                if (!refImageUrl && nodeData.avatarCover) refImageUrl = String(nodeData.avatarCover)

                const refImageBase64 = refImageUrl ? await fetchImageAsBase64(refImageUrl) : null

                await runGeneration({
                    ...opts,
                    avatarData: nodeData,
                    refImageBase64,
                    finalPrompt,
                })
                generatedAny = true
            }
        }

        if (generatedAny) {
            await prisma.studioJob.update({ where: { id: opts.jobId }, data: { status: 'done', finishedAt: new Date() } })
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        await prisma.studioJob.update({ where: { id: opts.jobId }, data: { status: 'failed', error: message, finishedAt: new Date() } })
    }
}



// ─── Single generation run (for one avatar reference) ─────────────────────────
interface RunOpts extends WorkflowOpts {
    avatarData: Record<string, unknown> | null
    refImageBase64: string | null
    finalPrompt: string
}

async function runGeneration(opts: RunOpts) {
    const { width, height } = falSizeToPixels(opts.imageSize)
    const outputs: string[] = []

    if (opts.provider === 'fal_ai') {
        // ── Fal.ai path ───────────────────────────────────────────────────────
        const { falRunSync } = await import('@/lib/studio/fal-client')

        // When we have a ref image, use flux/dev (supports image_url img2img)
        // flux/schnell does NOT support image_url, so we auto-upgrade
        let effectiveModel = opts.model
        if (opts.refImageBase64 && effectiveModel.includes('schnell')) {
            effectiveModel = 'fal-ai/flux/dev'
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const input: Record<string, any> = {
            prompt: opts.finalPrompt,
            num_images: opts.numImages,
            image_size: opts.imageSize,
            num_inference_steps: effectiveModel.includes('schnell') ? 4 : 28,
        }

        // Pass avatar image as reference (img2img strength ~0.65 — enough to look like avatar, still creative)
        if (opts.refImageBase64) {
            input.image_url = opts.refImageBase64
            input.strength = 0.65
        }

        const result = await falRunSync({
            userId: opts.userId,
            model: effectiveModel,
            input,
        }) as { images?: Array<{ url: string; width: number; height: number }> }

        for (const img of (result.images || [])) {
            const stored = await storeToR2(img.url, opts.channelId, 'image/png')
            const finalUrl = stored || img.url
            outputs.push(finalUrl)
            await prisma.studioOutput.create({
                data: {
                    projectId: opts.projectId, jobId: opts.jobId, type: 'image',
                    url: finalUrl, prompt: opts.finalPrompt,
                    metadata: {
                        provider: 'fal_ai', model: effectiveModel, size: opts.imageSize,
                        avatarName: opts.avatarData?.avatarName || null,
                        avatarId: opts.avatarData?.avatarId || null,
                        usedRefImage: !!opts.refImageBase64,
                        width: img.width, height: img.height,
                    },
                },
            })
        }
    } else {
        // ── Multi-provider path (runware / openai / gemini) ───────────────────
        const keyResult = await resolveImageAIKey(opts.channelId, opts.provider, opts.model)
        if (!keyResult.ok) throw new Error(keyResult.data.error)

        const { apiKey, provider: resolvedProvider, model: resolvedModel } = keyResult.data
        const effectiveModel = resolvedModel || opts.model

        for (let i = 0; i < opts.numImages; i++) {
            let url: string
            let mimeType = 'image/png'

            switch (resolvedProvider) {
                case 'runware':
                    url = await generateRunware(apiKey, opts.finalPrompt, effectiveModel, width, height, opts.refImageBase64)
                    break
                case 'openai': {
                    const r = await generateOpenAI(apiKey, opts.finalPrompt, effectiveModel, width, height, opts.refImageBase64)
                    url = r.url
                    break
                }
                case 'gemini': {
                    const aspect = pixelsToGeminiAspect(width, height)
                    const r = await generateGemini(apiKey, opts.finalPrompt, effectiveModel, aspect, opts.refImageBase64)
                    url = r.url
                    mimeType = r.mimeType || 'image/png'
                    break
                }
                default:
                    throw new Error(`Unsupported provider: ${resolvedProvider}`)
            }

            const stored = await storeToR2(url, opts.channelId, mimeType)
            const finalUrl = stored || url
            outputs.push(finalUrl)
            await prisma.studioOutput.create({
                data: {
                    projectId: opts.projectId, jobId: opts.jobId, type: 'image',
                    url: finalUrl, prompt: opts.finalPrompt,
                    metadata: {
                        provider: resolvedProvider, model: effectiveModel, size: opts.imageSize,
                        avatarName: opts.avatarData?.avatarName || null,
                        usedRefImage: !!opts.refImageBase64,
                    },
                },
            })
        }
    }

    // Update cover with first output ever generated for this project
    if (outputs[0]) {
        const count = await prisma.studioOutput.count({ where: { projectId: opts.projectId } })
        if (count <= opts.numImages) {
            await prisma.studioProject.update({ where: { id: opts.projectId }, data: { coverImage: outputs[0] } })
        }
    }
}

// ─── Fetch remote image → base64 data URI ─────────────────────────────────────
async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
        if (!res.ok) return null
        const buf = Buffer.from(await res.arrayBuffer())
        const mime = res.headers.get('content-type') || 'image/jpeg'
        return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
        return null
    }
}

// ─── Store URL into R2 (best-effort) ─────────────────────────────────────────
async function storeToR2(url: string, channelId: string, mimeType: string): Promise<string | null> {
    try {
        const useR2 = await isR2Configured()
        if (!useR2) return null
        const tmpPath = path.join(os.tmpdir(), `studio_${randomUUID()}.tmp`)
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
            const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
            const r2Key = generateR2Key(channelId, `studio-output-${randomUUID()}.${ext}`)
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

function pixelsToGeminiAspect(w: number, h: number): string {
    const r = w / h
    if (Math.abs(r - 16 / 9) < 0.05) return '16:9'
    if (Math.abs(r - 9 / 16) < 0.05) return '9:16'
    if (Math.abs(r - 4 / 3) < 0.05) return '4:3'
    if (Math.abs(r - 3 / 4) < 0.05) return '3:4'
    return '1:1'
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function generateRunware(
    apiKey: string, prompt: string, model: string, width: number, height: number,
    refImageBase64?: string | null
): Promise<string> {
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
        task.seedImage = refImageBase64.split(',')[1]   // raw base64, no data URI prefix
        task.strength = 0.38   // Runware: lower = closer to ref
    }
    const res = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify([task]),
    })
    if (!res.ok) throw new Error(`Runware error: ${res.status} ${await res.text()}`)
    const data = await res.json() as { data?: Array<{ imageURL?: string }> }
    const img = data.data?.[0]
    if (!img?.imageURL) throw new Error('Runware returned no image')
    return img.imageURL
}

async function generateOpenAI(
    apiKey: string, prompt: string, model: string, width: number, height: number,
    refImageBase64?: string | null
): Promise<{ url: string }> {
    let size = '1024x1024'
    if (width > height) size = model === 'gpt-image-1' ? '1536x1024' : '1792x1024'
    else if (height > width) size = model === 'gpt-image-1' ? '1024x1536' : '1024x1792'

    // If ref image present, use /images/edits (img2img)
    if (refImageBase64 && (model === 'gpt-image-1' || model === 'dall-e-2')) {
        try {
            const base64 = refImageBase64.split(',')[1]
            const mime = refImageBase64.split(';')[0].split(':')[1] || 'image/png'
            const form = new FormData()
            form.append('image', new Blob([Buffer.from(base64, 'base64')], { type: mime }), 'ref.png')
            form.append('model', model === 'gpt-image-1' ? 'gpt-image-1' : 'dall-e-2')
            form.append('prompt', `Use the reference image as the main character/subject. ${prompt}`)
            form.append('n', '1')
            form.append('size', size)
            const res = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                body: form,
            })
            if (res.ok) {
                const data = await res.json() as { data: Array<{ url?: string; b64_json?: string }> }
                const item = data.data[0]
                if (item.b64_json) return { url: `data:image/png;base64,${item.b64_json}` }
                if (item.url) return { url: item.url }
            }
        } catch { /* fall through */ }
    }

    // Standard text-to-image with avatar description injected in prompt
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

async function generateGemini(
    apiKey: string, prompt: string, model: string, aspectRatio: string,
    refImageBase64?: string | null,
): Promise<{ url: string; mimeType?: string }> {
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
    }

    // Gemini native — send ref image inline so model can "see" the avatar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = []
    if (refImageBase64) {
        const base64 = refImageBase64.split(',')[1]
        const mime = refImageBase64.split(';')[0].split(':')[1] || 'image/jpeg'
        parts.push({ inlineData: { mimeType: mime, data: base64 } })
        parts.push({ text: `The reference image shows the character/subject. Generate a creative, high-quality marketing image where THIS EXACT PERSON (same face, same look) is the central subject. Apply this concept: ${prompt}` })
    } else {
        parts.push({ text: `Create a visually striking marketing image: ${prompt}` })
    }

    const urlG = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const res = await fetch(urlG, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
            contents: [{ parts }],
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
