import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const prompt = (promptNode?.data?.prompt as string) || ''
    const model = (imageGenNode.data?.model as string) || 'fal-ai/flux/schnell'
    const imageSize = (imageGenNode.data?.imageSize as string) || 'landscape_4_3'
    const numImages = (imageGenNode.data?.numImages as number) || 1

    const job = await prisma.studioJob.create({
        data: { projectId: id, status: 'running', provider: 'fal_ai' },
    })

    await prisma.studioProject.update({
        where: { id },
        data: { lastRunAt: new Date() },
    })

    executeWorkflow({
        userId: session.user.id,
        projectId: id,
        jobId: job.id,
        model,
        prompt,
        imageSize,
        numImages,
        avatarNodeData: avatarNode?.data,
        productNodeData: productNode?.data,
    }).catch(console.error)

    return NextResponse.json({ job })
}

async function executeWorkflow(opts: {
    userId: string; projectId: string; jobId: string
    model: string; prompt: string; imageSize: string; numImages: number
    avatarNodeData?: Record<string, unknown>
    productNodeData?: Record<string, unknown>
}) {
    const { falRunSync } = await import('@/lib/studio/fal-client')
    try {
        let finalPrompt = opts.prompt

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
        const firstUrl = images[0]?.url ?? null

        for (const img of images) {
            await prisma.studioOutput.create({
                data: {
                    projectId: opts.projectId, jobId: opts.jobId, type: 'image',
                    url: img.url, prompt: opts.prompt,
                    metadata: { model: opts.model, size: opts.imageSize, width: img.width, height: img.height },
                },
            })
        }

        if (firstUrl) {
            const count = await prisma.studioOutput.count({ where: { projectId: opts.projectId } })
            if (count <= images.length) {
                await prisma.studioProject.update({ where: { id: opts.projectId }, data: { coverImage: firstUrl } })
            }
        }

        await prisma.studioJob.update({
            where: { id: opts.jobId },
            data: { status: 'done', finishedAt: new Date() },
        })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        await prisma.studioJob.update({
            where: { id: opts.jobId },
            data: { status: 'failed', error: message, finishedAt: new Date() },
        })
    }
}
