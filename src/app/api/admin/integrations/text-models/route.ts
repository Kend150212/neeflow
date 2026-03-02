import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

interface ModelEntry {
    id: string
    name: string
}

interface ProviderGroup {
    provider: string
    label: string
    models: ModelEntry[]
}

// GET /api/admin/integrations/text-models
// Returns all available text/chat models from all configured AI integrations
export async function GET() {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const integrations = await prisma.apiIntegration.findMany({
        where: {
            category: 'AI',
            status: 'ACTIVE',
            provider: { in: ['gemini', 'openai', 'openrouter', 'synthetic'] },
            apiKeyEncrypted: { not: null },
        },
        select: { id: true, provider: true, name: true, apiKeyEncrypted: true },
    })

    const groups: ProviderGroup[] = []

    for (const integration of integrations) {
        if (!integration.apiKeyEncrypted) continue
        const apiKey = decrypt(integration.apiKeyEncrypted)

        try {
            let models: ModelEntry[] = []

            if (integration.provider === 'gemini') {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
                    { next: { revalidate: 3600 } }
                )
                if (res.ok) {
                    const data = await res.json()
                    models = (data.models || [])
                        .filter((m: { name: string; supportedGenerationMethods?: string[] }) => {
                            const id = m.name.replace('models/', '')
                            // Keep only text/chat models
                            return (
                                !id.includes('imagen') &&
                                !id.includes('image') &&
                                !id.includes('embedding') &&
                                !id.includes('veo') &&
                                !id.includes('video') &&
                                !id.includes('aqa') &&
                                (m.supportedGenerationMethods?.includes('generateContent') ?? true)
                            )
                        })
                        .map((m: { name: string; displayName?: string }) => ({
                            id: m.name.replace('models/', ''),
                            name: m.displayName || m.name.replace('models/', ''),
                        }))
                }
            }

            if (integration.provider === 'openai') {
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { Authorization: `Bearer ${apiKey}` },
                    next: { revalidate: 3600 },
                })
                if (res.ok) {
                    const data = await res.json()
                    models = (data.data || [])
                        .filter((m: { id: string }) => {
                            const id = m.id
                            return (
                                (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4') || id.startsWith('chatgpt')) &&
                                !id.includes('instruct') &&
                                !id.includes('vision') &&
                                !id.includes('dall-e') &&
                                !id.includes('image') &&
                                !id.includes('embedding') &&
                                !id.includes('tts') &&
                                !id.includes('whisper') &&
                                !id.includes('audio') &&
                                !id.includes('realtime')
                            )
                        })
                        .map((m: { id: string }) => ({ id: m.id, name: m.id }))
                        .sort((a: ModelEntry, b: ModelEntry) => b.id.localeCompare(a.id))
                }
            }

            if (integration.provider === 'openrouter') {
                const res = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { Authorization: `Bearer ${apiKey}` },
                    next: { revalidate: 3600 },
                })
                if (res.ok) {
                    const data = await res.json()
                    models = (data.data || [])
                        .filter((m: { id: string; architecture?: { modality?: string } }) => {
                            const modality = m.architecture?.modality || ''
                            return !modality.includes('image') && !modality.includes('video') &&
                                !m.id.includes('embedding') &&
                                !m.id.includes('dalle') &&
                                !m.id.includes('image')
                        })
                        .map((m: { id: string; name?: string }) => ({
                            id: m.id,
                            name: m.name || m.id,
                        }))
                        .sort((a: ModelEntry, b: ModelEntry) => a.name.localeCompare(b.name))
                }
            }

            if (integration.provider === 'synthetic') {
                const res = await fetch('https://api.synthetic.new/openai/v1/models', {
                    headers: { Authorization: `Bearer ${apiKey}` },
                    next: { revalidate: 3600 },
                })
                if (res.ok) {
                    const data = await res.json()
                    models = (data.data || [])
                        .filter((m: { id: string }) => !m.id.includes('embed'))
                        .map((m: { id: string; name?: string }) => ({
                            id: m.id,
                            name: m.name || m.id,
                        }))
                        .sort((a: ModelEntry, b: ModelEntry) => a.name.localeCompare(b.name))
                }
            }

            if (models.length > 0) {
                const label =
                    integration.provider === 'gemini' ? 'Google Gemini' :
                        integration.provider === 'openai' ? 'OpenAI' :
                            integration.provider === 'openrouter' ? 'OpenRouter' :
                                integration.provider === 'synthetic' ? 'Synthetic' :
                                    integration.name || integration.provider

                groups.push({ provider: integration.provider, label, models })
            }
        } catch {
            // Skip failed providers silently
        }
    }

    return NextResponse.json(groups)
}
