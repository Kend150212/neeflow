import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/studio/projects/[id]/run — execute the workflow
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await prisma.studioProject.findFirst({
        where: { id: params.id, userId: session.user.id },
        include: { workflow: true },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!project.workflow) return NextResponse.json({ error: 'No workflow saved' }, { status: 400 })

    const nodes = project.workflow.nodesJson as Array<{ type: string; data: Record<string, unknown> }>

    // Find the ImageGenNode — it drives the generation
    const imageGenNode = nodes.find(n => n.type === 'imageGenNode')
    const promptNode = nodes.find(n => n.type === 'promptNode')
    const avatarNode = nodes.find(n => n.type === 'avatarNode')

    if (!imageGenNode) {
        return NextResponse.json({ error: 'No Image Generation node found in workflow' }, { status: 400 })
    }

    const prompt = (promptNode?.data?.prompt as string) || ''
    const model = (imageGenNode.data?.model as string) || 'fal-ai/flux/schnell'
    const imageSize = (imageGenNode.data?.imageSize as string) || 'landscape_4_3'
    const numImages = (imageGenNode.data?.numImages as number) || 1

    // Create the job optimistically
    const job = await prisma.studioJob.create({
        data: {
            projectId: params.id,
            status: 'running',
            provider: 'fal_ai',
        },
    })

    // Update project lastRunAt
    await prisma.studioProject.update({
        where: { id: params.id },
        data: { lastRunAt: new Date() },
    })

    // Non-blocking execution
    executeWorkflow({
        userId: session.user.id,
        projectId: params.id,
        jobId: job.id,
        model,
        prompt,
        imageSize,
        numImages,
        avatarNodeData: avatarNode?.data,
    }).catch(console.error)

    return NextResponse.json({ job })
}

async function executeWorkflow(opts: {
    userId: string
    projectId: string
    jobId: string
    model: string
    prompt: string
    imageSize: string
    numImages: number
    avatarNodeData?: Record<string, unknown>
}) {
    const { falRunSync } = await import('@/lib/studio/fal-client')

    try {
        // Build prompt: combine avatar description + user prompt
        let finalPrompt = opts.prompt
        if (opts.avatarNodeData?.avatarPrompt) {
            finalPrompt = `${opts.avatarNodeData.avatarPrompt as string}, ${finalPrompt}`
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

        // Save outputs
        const images = result.images || []
        const firstOutputUrl = images[0]?.url ?? null

        for (const img of images) {
            await prisma.studioOutput.create({
                data: {
                    projectId: opts.projectId,
                    jobId: opts.jobId,
                    type: 'image',
                    url: img.url,
                    prompt: opts.prompt,
                    metadata: { model: opts.model, size: opts.imageSize, width: img.width, height: img.height },
                },
            })
        }

        // If this is the first output ever, set as project cover
        if (firstOutputUrl) {
            const existingCount = await prisma.studioOutput.count({ where: { projectId: opts.projectId } })
            if (existingCount <= images.length) {
                await prisma.studioProject.update({
                    where: { id: opts.projectId },
                    data: { coverImage: firstOutputUrl },
                })
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
