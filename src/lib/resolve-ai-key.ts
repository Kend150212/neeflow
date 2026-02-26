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

    return {
        ok: true,
        data: {
            apiKey: platformKey.apiKey,
            provider: platformKey.provider,
            model: requestedModel || getDefaultModel(platformKey.provider, platformKey.config),
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

    // 2. No BYOK → check image quota
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

    // 3. Within quota → get platform image key (only image-capable providers)
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
            model: requestedModel || getDefaultModel(platformKey.provider, platformKey.config),
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

async function checkTextQuotaForPlatformKey(userId: string): Promise<QuotaCheckResult> {
    try {
        const limits = await getEffectiveLimits(userId)
        const limit = limits.maxPostsPerMonth

        // 0 = no quota, BYOK only
        if (limit === 0) {
            return {
                allowed: false,
                used: 0,
                limit: 0,
                reason: 'Your plan does not include AI content generation. Add your own AI API key or upgrade your plan.',
            }
        }

        // Get current month usage
        const sub = await db.subscription.findUnique({
            where: { userId },
            include: { usages: { where: { month: getCurrentMonth() } } },
        })
        const used: number = sub?.usages?.[0]?.postsCreated ?? 0

        // -1 = unlimited
        if (limit === -1) {
            return { allowed: true, used, limit: -1 }
        }

        if (used >= limit) {
            return {
                allowed: false,
                used,
                limit,
                reason: `Monthly AI content quota reached (${used}/${limit}). Add your own API key or upgrade your plan.`,
            }
        }

        return { allowed: true, used, limit }
    } catch {
        // DB not migrated — fail open
        return { allowed: true, used: 0, limit: -1 }
    }
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

async function getPlatformAIKey(preferredProvider?: string | null): Promise<{
    id: string
    apiKey: string
    provider: string
    baseUrl: string | null
    config: Record<string, string>
} | null> {
    let integration = null

    if (preferredProvider) {
        integration = await prisma.apiIntegration.findFirst({
            where: { provider: preferredProvider, category: 'AI', status: 'ACTIVE', apiKeyEncrypted: { not: null } },
        })
    }

    if (!integration) {
        integration = await prisma.apiIntegration.findFirst({
            where: { category: 'AI', status: 'ACTIVE', apiKeyEncrypted: { not: null } },
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
