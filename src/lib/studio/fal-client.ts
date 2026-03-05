// src/lib/studio/fal-client.ts
// Fal.ai REST API wrapper for Neeflow Studio
// Docs: https://fal.ai/docs/api

import { prisma } from '@/lib/prisma'

const FAL_BASE = 'https://fal.run'
const FAL_QUEUE_BASE = 'https://queue.fal.run'

interface FalRunOptions {
    userId: string
    model: string
    input: Record<string, unknown>
}

interface FalQueueResult {
    requestId: string
    status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
    output?: Record<string, unknown>
    error?: string
}

// Resolve API key: user's own key → fallback to env
async function resolveFalApiKey(userId: string): Promise<string> {
    const userKey = await prisma.userApiKey.findFirst({
        where: { userId, provider: 'fal_ai', isActive: true },
        select: { apiKeyEncrypted: true },
    })

    if (userKey?.apiKeyEncrypted) {
        const { decrypt } = await import('@/lib/encryption')
        return decrypt(userKey.apiKeyEncrypted)
    }

    const envKey = process.env.FAL_AI_KEY
    if (!envKey) throw new Error('No Fal.ai API key configured. Please add your Fal.ai key in Settings → API Keys.')
    return envKey
}

// Submit a job to Fal.ai queue (async — returns requestId)
export async function falSubmitJob(opts: FalRunOptions): Promise<{ requestId: string }> {
    const apiKey = await resolveFalApiKey(opts.userId)

    const res = await fetch(`${FAL_QUEUE_BASE}/${opts.model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(opts.input),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Fal.ai submit error: ${res.status} ${err}`)
    }

    const data = await res.json()
    return { requestId: data.request_id }
}

// Poll job status
export async function falPollJob(userId: string, model: string, requestId: string): Promise<FalQueueResult> {
    const apiKey = await resolveFalApiKey(userId)

    const res = await fetch(`${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${apiKey}` },
    })

    if (!res.ok) throw new Error(`Fal.ai poll error: ${res.status}`)

    const data = await res.json()
    return {
        requestId,
        status: data.status,
        output: data.status === 'COMPLETED' ? await falGetResult(userId, model, requestId) : undefined,
        error: data.error,
    }
}

// Get final result
export async function falGetResult(userId: string, model: string, requestId: string): Promise<Record<string, unknown>> {
    const apiKey = await resolveFalApiKey(userId)

    const res = await fetch(`${FAL_QUEUE_BASE}/${model}/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${apiKey}` },
    })

    if (!res.ok) throw new Error(`Fal.ai result error: ${res.status}`)
    return res.json()
}

// Synchronous run (for fast models, <30s)
export async function falRunSync(opts: FalRunOptions): Promise<Record<string, unknown>> {
    const apiKey = await resolveFalApiKey(opts.userId)

    const res = await fetch(`${FAL_BASE}/${opts.model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(opts.input),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Fal.ai run error: ${res.status} ${err}`)
    }

    return res.json()
}

// Avatar generation: text-to-image with multiple angles
export async function generateAvatarImages(opts: {
    userId: string
    prompt: string
    style: string
    numAngles: number // 2 or 4
}): Promise<string[]> {
    const styleModifiers: Record<string, string> = {
        realistic: 'photorealistic, ultra detailed, 8k, professional photography',
        anime: 'anime art style, vibrant colors, Studio Ghibli inspired',
        cartoon: 'cartoon style, clean lines, bold colors, flat design',
        '3d': '3D render, Pixar style, soft lighting, high quality',
    }

    const styleHint = styleModifiers[opts.style] || styleModifiers.realistic

    const anglePrompts = [
        'front view, facing camera',
        'side profile view, 90 degrees',
        '3/4 view, slightly turned',
        'back view',
    ].slice(0, opts.numAngles)

    const images: string[] = []

    for (const angle of anglePrompts) {
        const result = await falRunSync({
            userId: opts.userId,
            model: 'fal-ai/flux/schnell',
            input: {
                prompt: `${opts.prompt}, ${angle}, ${styleHint}, white background, full body portrait`,
                num_inference_steps: 4,
                image_size: 'portrait_4_3',
                num_images: 1,
            },
        })
        const imgs = (result as { images?: Array<{ url: string }> }).images
        if (imgs?.[0]?.url) images.push(imgs[0].url)
    }

    return images
}
