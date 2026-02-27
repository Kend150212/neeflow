/**
 * Quota-Aware AI Key Resolution
 *
 * Unified helper for all AI features (text + image).
 * Follows the SmartFlow pattern:
 *   1. Try BYOK (channel owner's key) — no quota consumed
 *   2. No BYOK → check quota
 *   3. Within quota → use platform ApiIntegration key → will increment usage
 *   4. Over quota and no BYOK → return error
 *
 * ChatBot is excluded — it always requires BYOK.
 */

import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { getDefaultModel } from '@/lib/ai-caller'
import { getEffectiveLimits } from '@/lib/addon-resolver'
import { getCurrentMonth } from '@/lib/plans'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export interface ResolvedAIKey {
    apiKey: string
    provider: string
    model: string
    usingPlatformKey: boolean  // true = platform pays (increment usage), false = BYOK
    ownerId: string | null
    integrationId: string | null  // ApiIntegration.id when using platform key
    baseUrl?: string | null
    config?: Record<string, string>
}

export interface ResolvedAIKeyError {
    error: string
    errorType: 'no_owner' | 'no_api_key' | 'quota_exceeded' | 'no_platform_key'
    used?: number
    limit?: number
}

export type ResolveResult =
    | { ok: true; data: ResolvedAIKey }
    | { ok: false; data: ResolvedAIKeyError; status: number }

// ─── Text Key Resolution ──────────────────────────────────────────────────────

export async function resolveTextAIKey(
    channelId: string,
    preferredProvider?: string | null,
    requestedModel?: string | null,
): Promise<ResolveResult> {
    // 1. Try BYOK — channel owner's key
    const ownerKey = await getChannelOwnerKey(channelId, preferredProvider)

    if (ownerKey.apiKey) {
        const provider = ownerKey.provider!
        return {
            ok: true,
            data: {
                apiKey: ownerKey.apiKey,
                provider,
                model: requestedModel || ownerKey.model || getDefaultModel(provider, {}),
                usingPlatformKey: false,
                ownerId: ownerKey.ownerId,
                integrationId: null,
            },
        }
    }

    // 2. No BYOK → check text quota
    const ownerId = ownerKey.ownerId
    if (!ownerId) {
        return {
            ok: false,
            status: 403,
            data: {
                error: 'Channel has no owner configured.',
                errorType: 'no_owner',
            },
        }
    }

    const quotaResult = await checkTextQuotaForPlatformKey(ownerId)

    if (!quotaResult.allowed) {
        return {
            ok: false,
            status: 429,
            data: {
                error: quotaResult.reason!,
                errorType: 'quota_exceeded',
                used: quotaResult.used,
                limit: quotaResult.limit,
            },
        }
    }

    // 3. Within quota → get platform ApiIntegration key
    const platformKey = await getPlatformAIKey(preferredProvider)
    if (!platformKey) {
        return {
            ok: false,
            status: 400,
            data: {
                error: 'No AI provider configured on the platform. Please add your own AI API key in Settings → AI API Keys, or contact the admin.',
                errorType: 'no_platform_key',
            },
        }
    }

    const resolvedModel = requestedModel || getDefaultModel(platformKey.provider, platformKey.config)
    console.log(`[resolveTextAIKey] Platform key path — provider: ${platformKey.provider}, model: ${resolvedModel}, keyPrefix: ${platformKey.apiKey.slice(0, 8)}..., baseUrl: ${platformKey.baseUrl ?? 'none'}`)

    return {
        ok: true,
        data: {
            apiKey: platformKey.apiKey,
            provider: platformKey.provider,
            model: resolvedModel,
            usingPlatformKey: true,
            ownerId,
            integrationId: platformKey.id,
            baseUrl: platformKey.baseUrl,
            config: platformKey.config,
        },
    }
}

// ─── Image Key Resolution ─────────────────────────────────────────────────────

export async function resolveImageAIKey(
    channelId: string,
    preferredProvider?: string | null,
    requestedModel?: string | null,
    keySource?: string | null,   // 'byok' | 'plan' | undefined — sent by frontend
): Promise<ResolveResult> {
    // Find the channel owner for quota purposes
    const ownerMember = await db.channelMember.findFirst({
        where: { channelId, role: 'OWNER' },
        select: { userId: true },
    })

    const ownerId: string | null = ownerMember?.userId ?? null

    if (!ownerId) {
        return {
            ok: false,
            status: 403,
            data: { error: 'Channel has no owner configured.', errorType: 'no_owner' },
        }
    }

    // 1. Try BYOK — but ONLY when:
    //    a) The user explicitly chose BYOK source, OR no source was specified (legacy path)
    //    b) AND only for the exact requested provider (no cross-provider fallback)
    const forcePlan = keySource === 'plan'

    let byokKey: { apiKeyEncrypted: string; provider: string; defaultModel: string | null } | null = null

    if (!forcePlan) {
        if (preferredProvider) {
            // Strict match: only accept BYOK for the chosen provider
            byokKey = await prisma.userApiKey.findFirst({
                where: { userId: ownerId, provider: preferredProvider, isActive: true },
                select: { apiKeyEncrypted: true, provider: true, defaultModel: true },
            })
        } else {
            // No provider preference → use owner's default key (any provider)
            byokKey = await prisma.userApiKey.findFirst({
                where: { userId: ownerId, isDefault: true, isActive: true },
                select: { apiKeyEncrypted: true, provider: true, defaultModel: true },
            }) ?? await prisma.userApiKey.findFirst({
                where: { userId: ownerId, isActive: true },
                select: { apiKeyEncrypted: true, provider: true, defaultModel: true },
            })
        }
    }

    if (byokKey) {
        const { decrypt } = await import('@/lib/encryption')
        return {
            ok: true,
            data: {
                apiKey: decrypt(byokKey.apiKeyEncrypted),
                provider: byokKey.provider,
                model: requestedModel || byokKey.defaultModel || '',
                usingPlatformKey: false,
                ownerId,
                integrationId: null,
            },
        }
    }

    // 2. No matching BYOK (or forcePlan) → check image quota before using platform key
    const quotaResult = await checkImageQuotaForPlatformKey(ownerId)

    if (!quotaResult.allowed) {
        return {
            ok: false,
            status: 429,
            data: {
                error: quotaResult.reason!,
                errorType: 'quota_exceeded',
                used: quotaResult.used,
                limit: quotaResult.limit,
            },
        }
    }

    // 3. Within quota → get platform image key
    const platformKey = await getPlatformImageKey(preferredProvider)
    if (!platformKey) {
        return {
            ok: false,
            status: 400,
            data: {
                error: 'No AI image provider configured on the platform. Please add your own API key in Settings → AI API Keys.',
                errorType: 'no_platform_key',
            },
        }
    }

    return {
        ok: true,
        data: {
            apiKey: platformKey.apiKey,
            provider: platformKey.provider,
            model: requestedModel || '',
            usingPlatformKey: true,
            ownerId,
            integrationId: platformKey.id,
            baseUrl: platformKey.baseUrl,
            config: platformKey.config,
        },
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface QuotaCheckResult {
    allowed: boolean
    used: number
    limit: number
    reason?: string
}

async function checkTextQuotaForPlatformKey(_userId: string): Promise<QuotaCheckResult> {
    // Text quota is not enforced — only post and image quotas are tracked.
    return { allowed: true, used: 0, limit: -1 }
}

async function checkImageQuotaForPlatformKey(userId: string): Promise<QuotaCheckResult> {
    try {
        const limits = await getEffectiveLimits(userId)
        const limit = limits.maxAiImagesPerMonth

        if (limit === 0) {
            return {
                allowed: false,
                used: 0,
                limit: 0,
                reason: 'Your plan does not include AI image generation. Add your own API key or upgrade your plan.',
            }
        }

        const sub = await db.subscription.findUnique({
            where: { userId },
            include: { usages: { where: { month: getCurrentMonth() } } },
        })
        const used: number = sub?.usages?.[0]?.imagesGenerated ?? 0

        if (limit === -1) {
            return { allowed: true, used, limit: -1 }
        }

        if (used >= limit) {
            return {
                allowed: false,
                used,
                limit,
                reason: `Monthly AI image quota reached (${used}/${limit}). Add your own API key or upgrade your plan.`,
            }
        }

        return { allowed: true, used, limit }
    } catch {
        return { allowed: true, used: 0, limit: -1 }
    }
}

// Text-specific: exclude image-only providers that don't support chat/completions
const TEXT_CAPABLE_PROVIDERS = ['gemini', 'openai', 'openrouter', 'synthetic']
const IMAGE_ONLY_PROVIDERS = ['runware']

async function getPlatformAIKey(preferredProvider?: string | null): Promise<{
    id: string
    apiKey: string
    provider: string
    baseUrl: string | null
    config: Record<string, string>
} | null> {
    let integration = null

    // 1. Try preferred provider (only if it's text-capable)
    if (preferredProvider && !IMAGE_ONLY_PROVIDERS.includes(preferredProvider)) {
        integration = await prisma.apiIntegration.findFirst({
            where: { provider: preferredProvider, category: 'AI', status: 'ACTIVE', apiKeyEncrypted: { not: null } },
        })
    }

    // 2. Fallback: any text-capable provider
    if (!integration) {
        integration = await prisma.apiIntegration.findFirst({
            where: {
                provider: { in: TEXT_CAPABLE_PROVIDERS },
                category: 'AI',
                status: 'ACTIVE',
                apiKeyEncrypted: { not: null },
            },
            orderBy: { provider: 'asc' },
        })
    }

    if (!integration?.apiKeyEncrypted) return null

    return {
        id: integration.id,
        apiKey: decrypt(integration.apiKeyEncrypted),
        provider: integration.provider,
        baseUrl: integration.baseUrl,
        config: (integration.config as Record<string, string>) || {},
    }
}

// Image-specific: only look for providers that can generate images
const IMAGE_CAPABLE_PROVIDERS = ['runware', 'openai', 'gemini']

async function getPlatformImageKey(preferredProvider?: string | null): Promise<{
    id: string
    apiKey: string
    provider: string
    baseUrl: string | null
    config: Record<string, string>
} | null> {
    let integration = null

    // 1. Try preferred provider first
    if (preferredProvider && IMAGE_CAPABLE_PROVIDERS.includes(preferredProvider)) {
        integration = await prisma.apiIntegration.findFirst({
            where: { provider: preferredProvider, category: 'AI', status: 'ACTIVE', apiKeyEncrypted: { not: null } },
        })
    }

    // 2. Fallback: any image-capable provider
    if (!integration) {
        integration = await prisma.apiIntegration.findFirst({
            where: {
                provider: { in: IMAGE_CAPABLE_PROVIDERS },
                category: 'AI',
                status: 'ACTIVE',
                apiKeyEncrypted: { not: null },
            },
            orderBy: { provider: 'asc' },
        })
    }

    if (!integration?.apiKeyEncrypted) return null

    return {
        id: integration.id,
        apiKey: decrypt(integration.apiKeyEncrypted),
        provider: integration.provider,
        baseUrl: integration.baseUrl,
        config: (integration.config as Record<string, string>) || {},
    }
}
