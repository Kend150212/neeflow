import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { getEffectiveLimits } from '@/lib/addon-resolver'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// Image-capable providers
const IMAGE_CAPABLE_PROVIDERS = ['runware', 'openai', 'gemini']

interface ModelInfo {
    id: string
    name: string
    type: 'text' | 'image' | 'video' | 'audio' | 'embedding' | 'other'
}

/**
 * POST /api/admin/posts/plan-models
 *
 * Fetch image models for a given provider using the PLATFORM's API Hub key
 * (apiIntegration), filtered by the plan's allowedImageModels whitelist.
 *
 * Body: { provider: string }
 * Returns: { models: ModelInfo[], restricted: boolean }
 *
 * - restricted: true = admin has an explicit whitelist for this provider
 * - restricted: false = all models are available (empty whitelist = all)
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider } = await req.json()
    if (!provider || !IMAGE_CAPABLE_PROVIDERS.includes(provider)) {
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    try {
        // 1. Get platform API Hub key for this provider
        const integration = await prisma.apiIntegration.findFirst({
            where: {
                provider,
                category: 'AI',
                status: 'ACTIVE',
                apiKeyEncrypted: { not: null },
            },
        })

        if (!integration?.apiKeyEncrypted) {
            return NextResponse.json({ error: `No platform API key configured for ${provider}` }, { status: 400 })
        }

        const apiKey = decrypt(integration.apiKeyEncrypted)

        // 2. Get user's plan allowed models whitelist
        let allowedModels: string[] = []
        let restricted = false
        try {
            const limits = await getEffectiveLimits(session.user.id)
            // getEffectiveLimits doesn't expose allowedImageModels directly, read from plan
            const sub = await db.subscription.findUnique({
                where: { userId: session.user.id },
                include: { plan: { select: { allowedImageModels: true } } },
            })
            const planModels = sub?.plan?.allowedImageModels
            if (Array.isArray(planModels)) {
                const entry = planModels.find((e: { provider: string; models: string[] }) => e.provider === provider)
                if (entry?.models && entry.models.length > 0) {
                    allowedModels = entry.models
                    restricted = true
                }
            }
            void limits // suppress unused warning
        } catch {
            // Fallback: no restrictions
        }

        // 3. If restricted, return whitelist directly (no need to call provider API)
        if (restricted) {
            return NextResponse.json({ models: allowedModels.map(id => ({ id, type: 'image' })), restricted: true })
        }

        // 4. Fetch all models from provider using platform key, filter to image only
        let models: ModelInfo[] = []

        switch (provider) {
            case 'gemini': {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
                if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
                const data = await res.json()
                models = (data.models || [])
                    .map((m: { name: string; displayName?: string }) => {
                        const id = m.name.replace('models/', '')
                        const isImage = id.includes('imagen') || id.includes('image')
                        return { id, name: m.displayName || id, type: isImage ? 'image' : 'text' }
                    })
                    .filter((m: ModelInfo) => m.type === 'image')
                break
            }
            case 'openai': {
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${apiKey}` },
                })
                if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
                const data = await res.json()
                models = (data.data || [])
                    .filter((m: { id: string }) => m.id.includes('dall-e') || m.id.includes('image'))
                    .map((m: { id: string }) => ({ id: m.id, name: m.id, type: 'image' as const }))
                break
            }
            case 'runware': {
                // Runware doesn't have a model listing API — return known models
                models = [
                    { id: 'runware:100@1', name: 'FLUX.1 [Dev]', type: 'image' },
                    { id: 'runware:101@1', name: 'FLUX.1 [Schnell]', type: 'image' },
                    { id: 'civitai:133005@1', name: 'Juggernaut XL', type: 'image' },
                    { id: 'runware:5@1', name: 'Stable Diffusion XL', type: 'image' },
                ]
                break
            }
        }

        return NextResponse.json({ models, restricted: false })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch models'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
