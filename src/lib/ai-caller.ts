/**
 * Shared AI caller utility — supports OpenAI, Gemini, OpenRouter, Synthetic,
 * and any OpenAI-compatible provider.
 */

// Providers that use the OpenAI-compatible /v1/chat/completions API
const OPENAI_COMPATIBLE_PROVIDERS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    synthetic: 'https://api.synthetic.new/openai/v1',
}

/**
 * Call an AI provider to generate text from system + user prompts.
 * Returns the raw string response.
 */
export async function callAI(
    provider: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    baseUrl?: string | null,
): Promise<string> {
    if (provider === 'gemini') {
        return callGemini(apiKey, model, systemPrompt, userPrompt)
    }

    // All other providers use OpenAI-compatible API
    const base = baseUrl || OPENAI_COMPATIBLE_PROVIDERS[provider]
    if (!base) {
        throw new Error(`Unsupported AI provider: ${provider}`)
    }
    return callOpenAICompatible(base, apiKey, model, systemPrompt, userPrompt)
}

// ─── OpenAI-Compatible (OpenAI, OpenRouter, Synthetic, etc.) ────────
async function callOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    system: string,
    user: string,
): Promise<string> {
    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            temperature: 0.7,
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err.error?.message || err.message || res.statusText
        throw new Error(`AI error (${res.status}): ${msg}`)
    }

    const data = await res.json()
    return data.choices[0].message.content
}

// ─── Google Gemini ──────────────────────────────────────────────────
async function callGemini(
    apiKey: string,
    model: string,
    system: string,
    user: string,
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: user }] }],
            generationConfig: {
                temperature: 0.7,
            },
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Gemini error: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json()
    return data.candidates[0].content.parts[0].text
}

/**
 * Helper to determine default model for a provider if none specified.
 */
export function getDefaultModel(provider: string, config: Record<string, string>): string {
    if (config.defaultTextModel) return config.defaultTextModel
    switch (provider) {
        case 'openai': return 'gpt-4o-mini'
        case 'gemini': return 'gemini-2.0-flash'
        case 'openrouter': return 'google/gemini-2.0-flash-001'
        case 'synthetic': return 'google/gemini-2.0-flash'
        default: return 'gpt-4o-mini'
    }
}
