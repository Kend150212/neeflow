// ─── Shared Types for Channel Detail Page ──────────────

export interface KnowledgeEntry {
    id: string
    title: string
    sourceType: string
    sourceUrl: string | null
    content: string
    createdAt: string
}

export interface ContentTemplate {
    id: string
    name: string
    platform: string | null
    templateContent: string
    variables: string[]
    createdAt: string
}

export interface HashtagGroup {
    id: string
    name: string
    hashtags: string[]
    usageCount: number
}

export interface AiProviderInfo {
    id: string
    provider: string
    name: string
    status: string
    hasApiKey: boolean
}

export interface AiModelInfo {
    id: string
    name: string
    type: string
    description?: string
}

export interface ChannelPlatformEntry {
    id: string
    platform: string
    accountId: string
    accountName: string
    isActive: boolean
    config?: Record<string, unknown>
}

export interface EasyLink {
    id: string
    title: string
    token: string
    isEnabled: boolean
    expiresAt?: string | null
    createdAt: string
}

export interface ChannelDetail {
    id: string
    name: string
    displayName: string
    description: string | null
    isActive: boolean
    language: string
    descriptionsPerPlatform: Record<string, string>
    vibeTone: Record<string, string>
    seoTags: string[]
    colorPalette: string[]
    notificationEmail: string | null
    requireApproval: string  // 'none' | 'optional' | 'required'
    storageProvider: string | null
    useDefaultStorage: boolean
    webhookDiscord: Record<string, string>
    webhookTelegram: Record<string, string>
    webhookSlack: Record<string, string>
    webhookCustom: Record<string, string>
    knowledgeBase: KnowledgeEntry[]
    contentTemplates: ContentTemplate[]
    hashtagGroups: HashtagGroup[]
    _count: { posts: number; mediaItems: number }
    defaultAiProvider: string | null
    defaultAiModel: string | null
    defaultImageProvider: string | null
    defaultImageModel: string | null
    brandProfile: {
        targetAudience?: string
        contentTypes?: string
        brandValues?: string
        communicationStyle?: string
    } | null
    businessInfo: {
        phone?: string
        address?: string
        website?: string
        socials?: Record<string, string>
        custom?: { label: string; url: string }[]
    } | null
}
