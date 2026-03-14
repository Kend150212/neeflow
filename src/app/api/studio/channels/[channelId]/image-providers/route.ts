import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Static catalog of models per provider
// These are shown in the ImageGenNode model dropdown
export const PROVIDER_MODEL_CATALOG: Record<string, { value: string; label: string; hint: string }[]> = {
    fal_ai: [
        { value: 'fal-ai/flux/schnell', label: 'FLUX Schnell', hint: 'Fast · 4 steps' },
        { value: 'fal-ai/flux/dev', label: 'FLUX Dev', hint: 'High quality · 20 steps' },
        { value: 'fal-ai/flux-realism', label: 'FLUX Realism', hint: 'Photorealistic' },
        { value: 'fal-ai/stable-diffusion-v3-medium', label: 'SD3 Medium', hint: 'Balanced' },
        { value: 'fal-ai/imagen4/preview', label: 'Imagen 4', hint: 'Google · Best quality' },
    ],
    runware: [
        { value: 'runware:100@1', label: 'FLUX.1 Dev', hint: 'High quality' },
        { value: 'runware:101@1', label: 'FLUX.1 Schnell', hint: 'Fast generation' },
        { value: 'civitai:101055@128078', label: 'SDXL Base', hint: 'Stable Diffusion XL' },
    ],
    openai: [
        { value: 'dall-e-3', label: 'DALL-E 3', hint: 'Best quality' },
        { value: 'gpt-image-1', label: 'GPT Image 1', hint: 'Latest model' },
        { value: 'dall-e-2', label: 'DALL-E 2', hint: 'Faster · cheaper' },
    ],
    gemini: [
        { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', hint: 'Fast · versatile' },
        { value: 'imagen-3.0-generate-002', label: 'Imagen 3', hint: 'Google · Best quality' },
    ],
}

export const PROVIDER_LABELS: Record<string, string> = {
    fal_ai: 'Fal.ai',
    runware: 'Runware',
    openai: 'OpenAI',
    gemini: 'Google Gemini',
}

// Image-capable providers (subset of all providers)
const IMAGE_PROVIDERS = ['fal_ai', 'runware', 'openai', 'gemini']
// ApiIntegration providers for image (platform-level keys)
const IMAGE_INTEGRATION_PROVIDERS = ['runware', 'openai', 'gemini']

/**
 * GET /api/studio/channels/[channelId]/image-providers
 * Returns list of image-capable providers available for this channel:
 * 1. User's own BYOK keys (UserApiKey)
 * 2. Platform-level ApiIntegration keys (for non-fal providers)
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ channelId: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await params

    // Must be a channel member
    const member = await prisma.channelMember.findFirst({
        where: { channelId, userId: session.user.id },
    })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Find channel owner to resolve BYOK
    const ownerMember = await prisma.channelMember.findFirst({
        where: { channelId, role: 'OWNER' },
        select: { userId: true },
    })
    const ownerId = ownerMember?.userId ?? session.user.id

    // 1. User's BYOK keys for image providers
    const userKeys = await prisma.userApiKey.findMany({
        where: { userId: ownerId, provider: { in: IMAGE_PROVIDERS }, isActive: true },
        select: { provider: true },
    })

    // 2. Platform-level ApiIntegration keys
    const platformKeys = await prisma.apiIntegration.findMany({
        where: {
            provider: { in: IMAGE_INTEGRATION_PROVIDERS },
            category: 'AI',
            status: 'ACTIVE',
            apiKeyEncrypted: { not: null },
        },
        select: { provider: true },
    })

    // Merge and deduplicate
    const providerSet = new Set<string>()
    for (const k of userKeys) providerSet.add(k.provider)
    for (const k of platformKeys) providerSet.add(k.provider)

    // If user has fal_ai key → always available (handled by fal-client.ts)
    // Check env fallback for fal_ai
    if (!providerSet.has('fal_ai') && process.env.FAL_AI_KEY) {
        providerSet.add('fal_ai')
    }

    const providers = Array.from(providerSet).map(provider => ({
        provider,
        label: PROVIDER_LABELS[provider] || provider,
        models: PROVIDER_MODEL_CATALOG[provider] || [],
    }))

    return NextResponse.json({ providers })
}
