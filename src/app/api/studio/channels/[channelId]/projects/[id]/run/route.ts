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
        if (opts.avatarNodes.length === 0) {
            // No avatar connected → plain text generation
            await runGeneration({
                ...opts,
                avatarDataList: [],
                avatarRefSets: [],
                finalPrompt: opts.basePrompt,
            })
        } else {
            // ── Fetch ALL avatar records from DB in parallel ──────────────────
            const avatarRecords = await Promise.all(
                opts.avatarNodes.map(async (avatarNode) => {
                    const nodeData = avatarNode.data
                    const avatarId = nodeData.avatarId as string | undefined
                    let record: AvatarRecord | null = null
                    if (avatarId) {
                        record = await prisma.studioAvatar.findUnique({
                            where: { id: avatarId },
                            select: {
                                id: true, name: true, prompt: true, coverImage: true,
                                poseImages: true,
                                assets: { select: { id: true, type: true, name: true, prompt: true, images: true } },
                            },
                        }) as AvatarRecord | null
                    }
                    return { nodeData, record }
                })
            )

            // ── Build COMBINED prompt — all avatars in one ────────────────────
            // If only 1 avatar: "AvatarDesc, wearing: ..., with accessory: ..., base"
            // If 2+ avatars: "Person 1 (Davis): ..., Person 2 (Hana): ..., [base prompt]"
            const isMulti = avatarRecords.length > 1

            const avatarDescriptions = avatarRecords.map(({ nodeData, record }, idx) => {
                const parts: string[] = []
                // Label for multi-avatar (e.g. "Person 1 (Davis)")
                const label = isMulti
                    ? `Character ${idx + 1} (${record?.name || (nodeData.avatarName as string) || `Avatar ${idx + 1}`})`
                    : ''

                const baseDesc = record?.prompt || (nodeData.avatarPrompt as string | undefined) || ''
                if (baseDesc) parts.push(isMulti ? `${label}: ${baseDesc}` : baseDesc)

                // Outfit
                const outfitId = nodeData.outfitId as string | undefined
                if (outfitId && record) {
                    const asset = record.assets.find(a => a.id === outfitId && a.type === 'outfit')
                    if (asset) parts.push(`wearing: ${asset.prompt || asset.name}`)
                } else if (nodeData.outfitName) {
                    parts.push(`wearing: ${nodeData.outfitName as string}`)
                }

                // Accessory
                const accessoryId = nodeData.accessoryId as string | undefined
                if (accessoryId && record) {
                    const asset = record.assets.find(a => a.id === accessoryId && a.type === 'accessory')
                    if (asset) parts.push(`with: ${asset.prompt || asset.name}`)
                } else if (nodeData.accessoryName) {
                    parts.push(`with: ${nodeData.accessoryName as string}`)
                }

                return parts.join(', ')
            }).filter(Boolean)

            // Final prompt structure
            const promptParts = [...avatarDescriptions]
            if (opts.basePrompt) promptParts.push(opts.basePrompt)
            const finalPrompt = promptParts.join('. ')

            // ── Fetch ALL reference images in parallel ────────────────────────
            // Per avatar: face image + outfit image + accessory image
            const avatarRefSets = await Promise.all(
                avatarRecords.map(async ({ nodeData, record }) => {
                    // 1. Face / identity image
                    let faceUrl: string | null = null
                    if (record?.poseImages) {
                        const arr = record.poseImages as unknown[]
                        const first = arr[0]
                        if (typeof first === 'string') faceUrl = first
                        else if (first && typeof first === 'object' && 'url' in first)
                            faceUrl = (first as { url: string }).url
                    }
                    if (!faceUrl && record?.coverImage) faceUrl = record.coverImage
                    if (!faceUrl && nodeData.avatarCover) faceUrl = String(nodeData.avatarCover)

                    // 2. Outfit image (from node data — already the selected asset image)
                    const outfitUrl = nodeData.outfitImage ? String(nodeData.outfitImage) : null

                    // 3. Accessory image
                    const accessoryUrl = nodeData.accessoryImage ? String(nodeData.accessoryImage) : null

                    // Fetch all in parallel
                    const [faceB64, outfitB64, accessoryB64] = await Promise.all([
                        faceUrl ? fetchImageAsBase64(faceUrl) : Promise.resolve(null),
                        outfitUrl ? fetchImageAsBase64(outfitUrl) : Promise.resolve(null),
                        accessoryUrl ? fetchImageAsBase64(accessoryUrl) : Promise.resolve(null),
                    ])

                    return {
                        name: record?.name || (nodeData.avatarName as string) || 'Character',
                        faceB64,
                        outfitB64,
                        outfitName: nodeData.outfitName ? String(nodeData.outfitName) : null,
                        accessoryB64,
                        accessoryName: nodeData.accessoryName ? String(nodeData.accessoryName) : null,
                    }
                })
            )

            // ── Single combined generation ────────────────────────────────────
            await runGeneration({
                ...opts,
                avatarDataList: avatarRecords.map(r => r.nodeData),
                avatarRefSets,
                finalPrompt,
            })
        }

        await prisma.studioJob.update({ where: { id: opts.jobId }, data: { status: 'done', finishedAt: new Date() } })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        await prisma.studioJob.update({ where: { id: opts.jobId }, data: { status: 'failed', error: message, finishedAt: new Date() } })
    }
}





// ─── Per-avatar image reference bundle ────────────────────────────────────────
interface AvatarRefSet {
    name: string
    faceB64: string | null
    outfitB64: string | null
    outfitName: string | null
    accessoryB64: string | null
    accessoryName: string | null
}

// ─── Generation run (combined, supports multi-avatar) ─────────────────────────
interface RunOpts extends WorkflowOpts {
    avatarDataList: Array<Record<string, unknown>>
    avatarRefSets: AvatarRefSet[]   // one set per avatar (face + outfit + accessory images)
    finalPrompt: string
}

async function runGeneration(opts: RunOpts) {
    const { width, height } = falSizeToPixels(opts.imageSize)
    const outputs: string[] = []

    // Primary reference image (face of first avatar — for single-ref providers)
    const primaryRef = opts.avatarRefSets[0]?.faceB64 ?? null

    if (opts.provider === 'fal_ai') {
        // ── Fal.ai path — supports 1 img2img ref (first avatar) ───────────────
        const { falRunSync } = await import('@/lib/studio/fal-client')

        // flux/schnell doesn't support image_url → auto-upgrade to flux/dev
        let effectiveModel = opts.model
        if (primaryRef && effectiveModel.includes('schnell')) {
            effectiveModel = 'fal-ai/flux/dev'
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const input: Record<string, any> = {
            prompt: opts.finalPrompt,
            num_images: opts.numImages,
            image_size: opts.imageSize,
            num_inference_steps: effectiveModel.includes('schnell') ? 4 : 28,
        }

        // Img2img with primary avatar reference (strength ~0.65)
        if (primaryRef) {
            input.image_url = primaryRef
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
                        avatarCount: opts.avatarDataList.length,
                        usedRefImage: !!primaryRef,
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
                    // Runware: use primary ref only
                    url = await generateRunware(apiKey, opts.finalPrompt, effectiveModel, width, height, primaryRef)
                    break
                case 'openai': {
                    // OpenAI: use primary ref only
                    const r = await generateOpenAI(apiKey, opts.finalPrompt, effectiveModel, width, height, primaryRef)
                    url = r.url
                    break
                }
                case 'gemini': {
                    const aspect = pixelsToGeminiAspect(width, height)
                    // Gemini: send all ref sets (face + outfit + accessory per avatar)
                    const r = await generateGemini(apiKey, opts.finalPrompt, effectiveModel, aspect, opts.avatarRefSets)
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
                        avatarCount: opts.avatarDataList.length,
                        usedRefImages: opts.avatarRefSets.length,
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
    refImages?: AvatarRefSet[] | string[] | string | null,
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

    // Helper: push a base64 data URI as inlineData part
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = []

    const addImage = (dataUri: string) => {
        const base64 = dataUri.split(',')[1]
        const mime = dataUri.split(';')[0].split(':')[1] || 'image/jpeg'
        parts.push({ inlineData: { mimeType: mime, data: base64 } })
    }

    // Determine if we have structured AvatarRefSet[] or legacy string refs
    const isRefSets = Array.isArray(refImages) && refImages.length > 0 && typeof refImages[0] === 'object'

    if (isRefSets) {
        // ── Structured path: per-avatar face + outfit + accessory ─────────────
        const sets = refImages as AvatarRefSet[]
        const isMulti = sets.length > 1

        for (let i = 0; i < sets.length; i++) {
            const s = sets[i]
            const label = isMulti ? `Character ${i + 1} (${s.name})` : s.name

            if (s.faceB64) {
                parts.push({ text: `[REFERENCE - FACE of ${label}]: Use this image for the face, hair, and physical identity ONLY.` })
                addImage(s.faceB64)
            }
            if (s.outfitB64) {
                parts.push({ text: `[REFERENCE - OUTFIT for ${label}]: ${label} must wear EXACTLY this outfit/clothing in the generated image.` })
                addImage(s.outfitB64)
            }
            if (s.accessoryB64) {
                parts.push({ text: `[REFERENCE - ACCESSORY for ${label}]: ${label} must use/wear EXACTLY this accessory in the generated image.` })
                addImage(s.accessoryB64)
            }
        }

        // Build instruction text
        const faceRule = `- FACE: Keep exact face, hair color, ethnicity from the FACE reference image(s).`
        const outfitRule = `- OUTFIT: If an OUTFIT reference image is provided, reproduce that exact outfit/clothing on the character. DO NOT copy clothing from the FACE image.`
        const accessoryRule = `- ACCESSORY: If an ACCESSORY reference image is provided, include that exact accessory on the character.`
        const noSpecRule = `- If no outfit or accessory reference is provided for a character, FREELY CREATE stylish clothing and accessories that fit the scene mood and prompt context.`
        const taskRule = isMulti
            ? `TASK: Generate a single creative, high-quality image featuring ALL ${sets.length} CHARACTERS TOGETHER in one scene.`
            : `TASK: Generate a creative, high-quality image of THIS CHARACTER.`

        parts.push({ text: [taskRule, 'RULES:', faceRule, outfitRule, accessoryRule, noSpecRule, `PROMPT: ${prompt}`].join('\n') })

    } else if (refImages) {
        // ── Legacy flat string path ───────────────────────────────────────────
        const refArr: string[] = Array.isArray(refImages)
            ? (refImages as string[]).filter(Boolean)
            : [refImages as string]

        for (const dataUri of refArr) addImage(dataUri)

        const subjectDesc = refArr.length === 1
            ? 'THIS EXACT PERSON (same face, same look) as the central subject'
            : `ALL ${refArr.length} PEOPLE shown in the reference images together in one scene`
        parts.push({
            text: [
                `REFERENCE IMAGE(S): Face/identity only.`,
                `TASK: Generate a creative, high-quality image featuring ${subjectDesc}.`,
                `- Keep exact face from reference. IGNORE clothing in reference image.`,
                `- If no outfit specified in prompt, create stylish clothing that fits the scene.`,
                `PROMPT: ${prompt}`,
            ].join('\n')
        })
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
