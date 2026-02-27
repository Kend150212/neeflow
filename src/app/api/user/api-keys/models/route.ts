import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

interface ModelInfo {
    id: string
    name: string
    type: 'text' | 'image' | 'video' | 'audio' | 'embedding' | 'other'
    description?: string
}

// POST /api/user/api-keys/models — fetch available models using user's key
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider } = await req.json()
    if (!provider) {
        return NextResponse.json({ error: 'Provider required' }, { status: 400 })
    }

    // Get user's key
    const userKey = await prisma.userApiKey.findFirst({
        where: { userId: session.user.id, provider },
    })

    if (!userKey) {
        return NextResponse.json({ error: 'No API key saved for this provider' }, { status: 400 })
    }

    const apiKey = decrypt(userKey.apiKeyEncrypted)

    try {
        let models: ModelInfo[] = []

        switch (provider) {
            case 'openai':
                models = await fetchOpenAIModels(apiKey)
                break
            case 'gemini':
                models = await fetchGeminiModels(apiKey)
                break
            case 'openrouter':
                models = await fetchOpenRouterModels(apiKey)
                break
            case 'anthropic':
                models = getAnthropicModels()
                break
            case 'runware':
                models = getRunwareModels()
                break
            case 'synthetic':
                models = await fetchSyntheticModels(apiKey)
                break
            default:
                return NextResponse.json({ models: [], message: 'Model listing not supported' })
        }

        return NextResponse.json({ models })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch models' },
            { status: 500 }
        )
    }
}

function classifyOpenAIModel(id: string): ModelInfo['type'] {
    if (id.includes('dall-e') || id.includes('image')) return 'image'
    if (id.includes('sora') || id.includes('video')) return 'video'
    if (id.includes('tts') || id.includes('whisper') || id.includes('audio')) return 'audio'
    if (id.includes('embedding')) return 'embedding'
    if (id.includes('gpt') || id.includes('o1') || id.includes('o3') || id.includes('o4') || id.includes('chatgpt')) return 'text'
    return 'other'
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
    const data = await res.json()
    return (data.data || [])
        .map((m: { id: string; owned_by?: string }) => ({
            id: m.id,
            name: m.id,
            type: classifyOpenAIModel(m.id),
            description: `by ${m.owned_by || 'openai'}`,
        }))
        .filter((m: ModelInfo) => ['text', 'image', 'video'].includes(m.type))
        .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id))
}

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
    const data = await res.json()
    return (data.models || [])
        .map((m: { name: string; displayName?: string; description?: string }) => {
            const id = m.name.replace('models/', '')
            let type: ModelInfo['type'] = 'text'
            // Strict ID-based classification — only model IDs containing 'imagen' or 'image' are image models
            // e.g. gemini-3.1-flash-image-preview, imagen-3.0-generate-002
            // NOT gemini-3-flash-preview (text model whose description may mention images)
            if (id.includes('imagen') || id.includes('image')) type = 'image'
            else if (id.includes('veo') || id.includes('video')) type = 'video'
            else if (id.includes('embedding')) type = 'embedding'
            return { id, name: m.displayName || id, type, description: m.description?.slice(0, 100) }
        })
        .filter((m: ModelInfo) => ['text', 'image', 'video'].includes(m.type))
}

async function fetchOpenRouterModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`)
    const data = await res.json()
    return (data.data || [])
        .map((m: { id: string; name?: string }) => ({
            id: m.id,
            name: m.name || m.id,
            type: 'text' as const,
        }))
        .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name))
}

function getAnthropicModels(): ModelInfo[] {
    return [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', type: 'text' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', type: 'text' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', type: 'text' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', type: 'text' },
    ]
}

function getRunwareModels(): ModelInfo[] {
    return [
        { id: 'runware:100@1', name: 'FLUX.1 [Dev]', type: 'image', description: 'High quality' },
        { id: 'runware:101@1', name: 'FLUX.1 [Schnell]', type: 'image', description: 'Fast' },
        { id: 'civitai:133005@1', name: 'Juggernaut XL', type: 'image', description: 'Photorealistic' },
        { id: 'runware:5@1', name: 'Stable Diffusion XL', type: 'image', description: 'Base model' },
    ]
}

async function fetchSyntheticModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetch('https://api.synthetic.new/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`Synthetic API error: ${res.status}`)
    const data = await res.json()
    return (data.data || [])
        .map((m: { id: string; name?: string }) => ({
            id: m.id,
            name: m.name || m.id,
            type: 'text' as const,
        }))
        .filter((m: ModelInfo) => ['text', 'image', 'video'].includes(m.type))
        .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name))
}
