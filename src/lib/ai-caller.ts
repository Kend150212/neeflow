/**
 * Shared AI caller utility — supports OpenAI, Gemini, OpenRouter, Synthetic,
 * and any OpenAI-compatible provider.
 *
 * callAI()          → returns string (backward-compatible)
 * callAIWithUsage() → returns { text, promptTokens, completionTokens, model }
 */

// Providers that use the OpenAI-compatible /v1/chat/completions API
const OPENAI_COMPATIBLE_PROVIDERS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    synthetic: 'https://api.synthetic.new/openai/v1',
}

export type AIUsageResult = {
    text: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    model: string
}

/**
 * Call an AI provider and return text + token usage.
 */
export async function callAIWithUsage(
    provider: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    baseUrl?: string | null,
): Promise<AIUsageResult> {
    if (provider === 'gemini') {
        return callGeminiWithUsage(apiKey, model, systemPrompt, userPrompt)
    }

    const base = baseUrl || OPENAI_COMPATIBLE_PROVIDERS[provider]
    if (!base) {
        throw new Error(`Unsupported AI provider: ${provider}`)
    }
    return callOpenAICompatibleWithUsage(base, apiKey, model, systemPrompt, userPrompt, provider)
}

/**
 * Backward-compatible wrapper — returns just the text string.
 */
export async function callAI(
    provider: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    baseUrl?: string | null,
): Promise<string> {
    const result = await callAIWithUsage(provider, apiKey, model, systemPrompt, userPrompt, baseUrl)
    return result.text
}

// ─── OpenAI-Compatible (OpenAI, OpenRouter, Synthetic, etc.) ────────
async function callOpenAICompatibleWithUsage(
    baseUrl: string,
    apiKey: string,
    model: string,
    system: string,
    user: string,
    provider?: string,
): Promise<AIUsageResult> {
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
        let msg = res.statusText
        try {
            const err = await res.json()
            msg = err.error?.message || err.error?.code || err.message || err.detail || JSON.stringify(err)
        } catch {
            try { msg = await res.text() } catch { /* keep statusText */ }
        }
        console.error(`[AI ${provider ?? 'unknown'}] ${res.status} — ${msg}`)
        throw new Error(`AI error (${res.status}): ${msg}`)
    }

    const data = await res.json()
    const text = data.choices[0].message.content
    const usage = data.usage || {}

    return {
        text,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
        model: data.model || model,
    }
}

// ─── Google Gemini ──────────────────────────────────────────────────
async function callGeminiWithUsage(
    apiKey: string,
    model: string,
    system: string,
    user: string,
): Promise<AIUsageResult> {
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
    const text = data.candidates[0].content.parts[0].text
    const meta = data.usageMetadata || {}

    return {
        text,
        promptTokens: meta.promptTokenCount ?? 0,
        completionTokens: meta.candidatesTokenCount ?? 0,
        totalTokens: meta.totalTokenCount ?? (meta.promptTokenCount ?? 0) + (meta.candidatesTokenCount ?? 0),
        model,
    }
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
        case 'synthetic': return 'hf:google/gemini-2.0-flash-001'
        default: return 'gpt-4o-mini'
    }
}
