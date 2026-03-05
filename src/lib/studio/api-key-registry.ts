// src/lib/studio/api-key-registry.ts
// Registry pattern — thêm provider mới chỉ cần thêm 1 entry ở đây
// UI sẽ tự render, không cần sửa code khác

export interface ApiKeyEntry {
    label: string
    provider: string          // matches UserApiKey.provider in DB
    description: string
    descriptionVi: string
    docsUrl: string
    usedBy: string[]          // human-readable list of features
    icon: string              // emoji icon
    placeholder?: string      // example key format
    category: 'studio' | 'ai' | 'social' | 'other'
}

export const API_KEY_REGISTRY: Record<string, ApiKeyEntry> = {
    fal_ai: {
        label: 'Fal.ai',
        provider: 'fal_ai',
        description: 'AI image & video generation for Studio',
        descriptionVi: 'Tạo ảnh & video AI cho Neeflow Studio',
        docsUrl: 'https://fal.ai/dashboard/keys',
        usedBy: ['Studio — Avatar Generation', 'Studio — Image Gen', 'Studio — Video Gen'],
        icon: '🎨',
        placeholder: 'fal-...',
        category: 'studio',
    },
    replicate: {
        label: 'Replicate',
        provider: 'replicate',
        description: 'Image upscale, background removal',
        descriptionVi: 'Upscale ảnh, xóa nền (Studio)',
        docsUrl: 'https://replicate.com/account/api-tokens',
        usedBy: ['Studio — Upscale', 'Studio — Background Remove'],
        icon: '🔁',
        placeholder: 'r8_...',
        category: 'studio',
    },
    // ─── Future providers — add here ────────────────────
    // runway: {
    //   label: 'Runway ML',
    //   provider: 'runway',
    //   description: 'Cinematic video generation',
    //   descriptionVi: 'Tạo video điện ảnh',
    //   docsUrl: 'https://app.runwayml.com/settings/api-tokens',
    //   usedBy: ['Studio — Video Gen (15s)'],
    //   icon: '🎬',
    //   category: 'studio',
    // },
    // stability_ai: {
    //   label: 'Stability AI',
    //   provider: 'stability_ai',
    //   description: 'High-quality image generation via Stable Diffusion',
    //   descriptionVi: 'Tạo ảnh chất lượng cao',
    //   docsUrl: 'https://platform.stability.ai/account/keys',
    //   usedBy: ['Studio — Image Gen'],
    //   icon: '🌊',
    //   category: 'studio',
    // },
}

// Helper: get all entries for a given category
export function getRegistryByCategory(category: ApiKeyEntry['category']): ApiKeyEntry[] {
    return Object.values(API_KEY_REGISTRY).filter(e => e.category === category)
}

// Helper: get entry by provider string
export function getRegistryEntry(provider: string): ApiKeyEntry | undefined {
    return API_KEY_REGISTRY[provider]
}
