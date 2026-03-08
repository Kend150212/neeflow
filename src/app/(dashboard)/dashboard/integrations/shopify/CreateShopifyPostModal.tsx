'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import { useBulkGen } from '@/lib/bulk-gen-context'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import {
    Sparkles, X, Loader2, Zap, ExternalLink, Check,
    Image as ImageIcon, Package, ShoppingBag, Settings2,
    ChevronDown, Calendar, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import NextImage from 'next/image'
import { platformIcons } from '@/components/platform-icons'
import { PlatformSettingsPanel, DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from '@/components/PlatformSettingsPanel'

// ── Constants ─────────────────────────────────────────────────────────────────
const BULK_LIMIT = 25 // max products per batch to avoid AI API overload

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ShopifyProduct {
    id: string
    name: string
    description: string | null
    price: number | null
    category: string | null
    tags: string[]
    images: string[]
    inStock: boolean
}

interface Props {
    open: boolean
    onClose: () => void
    products: ShopifyProduct[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const MODEL_DISPLAY: Record<string, string> = {
    'gemini-3.1-flash-image-preview': 'Nano Banana 2',
    'gemini-2.0-flash-exp': 'Flash Exp',
    'gemini-3-pro-image-preview': 'Gemini 3 Pro Image',
    'gemini-2.5-flash-image': 'Gemini 2.5 Flash Image',
    'imagen-3.0-generate-002': 'Imagen 3',
    'dall-e-3': 'DALL·E 3',
    'gpt-image-1': 'GPT Image 1',
    'runware:100@1': 'FLUX.1 Dev',
    'runware:5@1': 'FLUX.1 Schnell',
}
const ASPECT_RATIOS = [
    { label: '1:1', w: 1024, h: 1024 }, { label: '16:9', w: 1792, h: 1024 },
    { label: '9:16', w: 1024, h: 1792 }, { label: '4:3', w: 1024, h: 768 },
    { label: '3:4', w: 768, h: 1024 }, { label: '4:5', w: 819, h: 1024 },
]
const TONES: { value: string; label: string; icon: React.ReactNode }[] = [
    {
        value: 'viral', label: 'Viral',
        icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
    },
    {
        value: 'promotional', label: 'Promo',
        icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
    },
    {
        value: 'casual', label: 'Casual',
        icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 13s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
    },
    {
        value: 'professional', label: 'Pro',
        icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" /><polyline points="16 2 12 6 8 2" /></svg>
    },
    {
        value: 'storytelling', label: 'Story',
        icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
    },
]
const PLATFORM_LABELS: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', twitter: 'X / Twitter',
    tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube',
    pinterest: 'Pinterest', threads: 'Threads', bluesky: 'Bluesky',
}
const BEST_HOURS = [8, 12, 18, 20, 9, 15, 21]

function toDateVal(d: Date) { return d.toISOString().slice(0, 10) }
function distributeSchedule(start: string, end: string, count: number, tz: string): string[] {
    const s = new Date(`${start}T00:00:00`), e = new Date(`${end}T23:59:59`)
    const total = e.getTime() - s.getTime()
    if (count === 1) return [new Date(`${start}T${String(BEST_HOURS[0]).padStart(2, '0')}:00:00`).toISOString()]
    return Array.from({ length: count }, (_, i) => {
        const d = new Date(s.getTime() + (i / (count - 1)) * total)
        d.setHours(BEST_HOURS[i % BEST_HOURS.length], 0, 0, 0)
        try {
            const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
            const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]))
            const iso = `${p.year}-${p.month}-${p.day}T${String(d.getHours()).padStart(2, '0')}:00:00Z`
            return new Date(iso).toISOString()
        } catch { return d.toISOString() }
    })
}

// PlatformIcon — uses official brand SVGs from platform-icons.tsx
function PlatformIcon({ platform, size = 28 }: { platform: string; size?: number }) {
    const icon = platformIcons[platform]
    if (!icon) {
        return (
            <div
                style={{ width: size, height: size }}
                className="rounded-md bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground"
            >
                {platform.slice(0, 2)}
            </div>
        )
    }
    // Wrap in a fixed-size box; SVGs use fill/stroke so they scale fine
    return (
        <div style={{ width: size, height: size }} className="shrink-0 flex items-center justify-center">
            <div style={{ width: size, height: size }}>
                {icon}
            </div>
        </div>
    )
}

function RatioShape({ label, active }: { label: string; active: boolean }) {
    const s: Record<string, { w: number; h: number }> = { '1:1': { w: 18, h: 18 }, '16:9': { w: 24, h: 13 }, '9:16': { w: 13, h: 24 }, '4:3': { w: 20, h: 15 }, '3:4': { w: 15, h: 20 }, '4:5': { w: 14, h: 18 } }
    const d = s[label] ?? { w: 18, h: 18 }
    return <svg width={d.w} height={d.h} viewBox={`0 0 ${d.w} ${d.h}`}><rect x=".75" y=".75" width={d.w - 1.5} height={d.h - 1.5} rx="2" stroke={active ? 'currentColor' : '#6b7280'} strokeWidth="1.5" fill="none" /></svg>
}

// ── Per-product image picker row ──────────────────────────────────────────────
function ProductImagePicker({
    product, selectedImages, onToggle,
}: {
    product: ShopifyProduct
    selectedImages: string[]
    onToggle: (url: string) => void
}) {
    if (product.images.length === 0) return null
    return (
        <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/30 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Package className="h-3 w-3" />
                <span className="truncate">{product.name}</span>
                <span className="ml-auto text-muted-foreground font-normal">{selectedImages.length}/{product.images.length}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
                {product.images.map((url, i) => {
                    const selected = selectedImages.includes(url)
                    return (
                        <button key={i} type="button" onClick={() => onToggle(url)}
                            className={cn('relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all',
                                selected ? 'border-primary shadow-[0_0_0_1px] shadow-primary' : 'border-border/40 hover:border-border')}>
                            <NextImage src={url} alt={`img-${i}`} fill className="object-cover" unoptimized />
                            {selected && (
                                <span className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <Check className="h-4 w-4 text-primary" />
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function CreateShopifyPostModal({ open, onClose, products }: Props) {
    const router = useRouter()
    const { activeChannelId } = useWorkspace()
    const bulkGen = useBulkGen()
    const t = useTranslation()

    // Channel / platforms
    const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([])
    const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
    const [channelTimezone, setChannelTimezone] = useState('UTC')
    const [channelId4Settings, setChannelId4Settings] = useState('')
    const [approvalMode, setApprovalMode] = useState<'none' | 'optional' | 'required'>('none')
    const [requestApproval, setRequestApproval] = useState(false)

    // Content
    const [tone, setTone] = useState('viral')
    const [language, setLanguage] = useState('vi')  // auto-set from channel
    const [step, setStep] = useState<'config' | 'generating' | 'starting'>('config')
    const [localDone, setLocalDone] = useState(0)

    // Image import — per-product selected images { [productId]: url[] }
    const [enableImport, setEnableImport] = useState(true)
    const [selectedImagesMap, setSelectedImagesMap] = useState<Record<string, string[]>>({})

    // AI Image
    const [enableAiImage, setEnableAiImage] = useState(false)
    const [imagePrompt, setImagePrompt] = useState('')
    const [selectedAspect, setSelectedAspect] = useState('1:1')
    const [imageProvider, setImageProvider] = useState('')
    const [imageModel, setImageModel] = useState('')
    const [availableImageModels, setAvailableImageModels] = useState<{ id: string; name: string }[]>([])
    const [loadingModels, setLoadingModels] = useState(false)
    const [imageQuota, setImageQuota] = useState<{ used: number; limit: number }>({ used: 0, limit: -1 })
    const [byokProviders, setByokProviders] = useState<{ provider: string; name: string }[]>([])
    const [planProviders, setPlanProviders] = useState<{ provider: string; name: string }[]>([])
    const [providerDropOpen, setProviderDropOpen] = useState(false)
    const [modelDropOpen, setModelDropOpen] = useState(false)
    const [useProductImageAsRef, setUseProductImageAsRef] = useState(false)
    const [refImageUrl, setRefImageUrl] = useState<string | null>(null)  // selected single ref image

    // Platform settings (post type, collaborators, schedule, etc.)
    const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS)
    function patchSettings(patch: Partial<PlatformSettings>) {
        setPlatformSettings(prev => ({ ...prev, ...patch }))
    }

    // Wizard step (config only)
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)

    // Bulk schedule (auto-distribute across date range)
    const [enableSchedule, setEnableSchedule] = useState(false)
    const today = toDateVal(new Date())
    const [scheduleStart, setScheduleStart] = useState(today)
    const [scheduleEnd, setScheduleEnd] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return toDateVal(d) })

    const isSingle = products.length === 1
    // Enforce bulk limit
    const cappedProducts = products.slice(0, BULK_LIMIT)
    const isCapped = products.length > BULK_LIMIT

    // Init selected images to ALL when products change
    useEffect(() => {
        const map: Record<string, string[]> = {}
        products.forEach(p => { map[p.id] = [...p.images] })
        setSelectedImagesMap(map)
    }, [products])

    // Fetch channel info
    useEffect(() => {
        if (!open || !activeChannelId) return
        setStep('config'); setLocalDone(0); setRequestApproval(false)
        fetch('/api/admin/channels')
            .then(r => r.json())
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((data: any[]) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ch = data.find((c: any) => c.id === activeChannelId)
                if (ch?.platforms) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const plats = [...new Set(ch.platforms.filter((p: any) => p.isActive !== false).map((p: any) => (p.platform as string).toLowerCase()))] as string[]
                    setAvailablePlatforms(plats.length > 0 ? plats : ['facebook', 'instagram'])
                    setSelectedPlatforms(new Set(plats))
                }
                if (ch?.timezone) setChannelTimezone(ch.timezone)
                if (ch?.requireApproval) setApprovalMode(ch.requireApproval as 'none' | 'optional' | 'required')
                if (ch?.id) setChannelId4Settings(ch.id)
                if (ch?.requireApproval === 'required') setRequestApproval(true)
                // Auto-set language from channel setting
                if (ch?.language) setLanguage(ch.language)
            }).catch(() => {
                setAvailablePlatforms(['facebook', 'instagram'])
                setSelectedPlatforms(new Set(['facebook', 'instagram']))
            })
    }, [open, activeChannelId])

    // Fetch image providers
    useEffect(() => {
        if (!open) return
        fetch('/api/user/image-providers')
            .then(r => r.ok ? r.json() : Promise.reject())
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((data: any) => {
                const byok = (data.byok || [])
                const plan = (data.plan || [])
                setByokProviders(byok)
                setPlanProviders(plan)
                setImageQuota(data.quota || { used: 0, limit: -1 })
                const all = [...byok, ...plan]
                if (all.length > 0 && !imageProvider) {
                    const src = byok.length > 0 ? 'byok' : 'plan'
                    const first = all[0]
                    const key = `${src}:${first.provider}`
                    setImageProvider(key)
                    fetchModels(key)
                }
            }).catch(() => { })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    function fetchModels(providerKey: string) {
        const [source, ...rest] = providerKey.split(':')
        const prov = rest.join(':')
        setLoadingModels(true); setAvailableImageModels([]); setImageModel('')
        const ep = source === 'plan'
            ? fetch('/api/admin/posts/plan-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: prov }) })
            : fetch('/api/user/api-keys/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: prov }) })
        ep.then(r => r.json()).then(d => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const models = (d.models || []).filter((m: any) => source === 'plan' || m.type === 'image').map((m: any) => ({ id: m.id, name: m.name || MODEL_DISPLAY[m.id] || m.id }))
            setAvailableImageModels(models)
            if (models.length > 0) setImageModel(models[0].id)
        }).catch(() => { }).finally(() => setLoadingModels(false))
    }

    function togglePlatform(p: string) {
        setSelectedPlatforms(prev => {
            const next = new Set(prev)
            if (next.has(p)) { if (next.size === 1) return prev; next.delete(p) } else { next.add(p) }
            return next
        })
    }

    function toggleProductImage(productId: string, url: string) {
        setSelectedImagesMap(prev => {
            const current = prev[productId] || []
            const next = current.includes(url) ? current.filter(u => u !== url) : [...current, url]
            return { ...prev, [productId]: next }
        })
    }

    function selectAllImages(productId: string, images: string[]) {
        setSelectedImagesMap(prev => ({ ...prev, [productId]: [...images] }))
    }

    function clearAllImages(productId: string) {
        setSelectedImagesMap(prev => ({ ...prev, [productId]: [] }))
    }

    async function handleCreate() {
        if (!activeChannelId) { toast.error(t('integrations.shopify.modal.noChannelError')); return }
        if (selectedPlatforms.size === 0) { toast.error(t('integrations.shopify.modal.noPlatformError')); return }

        setStep('generating'); setLocalDone(0)

        // Build single-post scheduledAt from panel date/time picker
        let singleScheduledAt: string | null = null
        if (isSingle && platformSettings.scheduleDate) {
            const dt = `${platformSettings.scheduleDate}T${platformSettings.scheduleTime || '09:00'}:00`
            singleScheduledAt = new Date(dt).toISOString()
        }

        // Bulk: use auto-distribute across date range
        const scheduledTimes = (enableSchedule && !isSingle)
            ? distributeSchedule(scheduleStart, scheduleEnd, cappedProducts.length, channelTimezone) : null

        const aiImagePayload = enableAiImage && imageProvider ? {
            imageConfig: {
                provider: imageProvider.split(':').slice(1).join(':'),
                model: imageModel || undefined,
                keySource: imageProvider.split(':')[0],
                prompt: imagePrompt.trim() || undefined,
                width: (ASPECT_RATIOS.find(a => a.label === selectedAspect) ?? ASPECT_RATIOS[0]).w,
                height: (ASPECT_RATIOS.find(a => a.label === selectedAspect) ?? ASPECT_RATIOS[0]).h,
                referenceImageUrl: useProductImageAsRef ? undefined : undefined,
            }
        } : {}

        // Build platformConfig from panel settings — keys are platform slugs
        const platformConfig: Record<string, Record<string, unknown>> = {}
        if (selectedPlatforms.has('facebook')) {
            platformConfig.facebook = { postType: platformSettings.fbPostType, firstComment: platformSettings.fbFirstComment || undefined }
        }
        if (selectedPlatforms.has('instagram')) {
            platformConfig.instagram = { postType: platformSettings.igPostType, shareToStory: platformSettings.igShareToStory, collaborators: platformSettings.igCollaborators || undefined }
        }
        if (selectedPlatforms.has('youtube')) {
            platformConfig.youtube = { postType: platformSettings.ytPostType, videoTitle: platformSettings.ytVideoTitle || undefined, category: platformSettings.ytCategory || undefined, privacy: platformSettings.ytPrivacy, tags: platformSettings.ytTags || undefined, notifySubscribers: platformSettings.ytNotifySubscribers, madeForKids: platformSettings.ytMadeForKids }
        }
        if (selectedPlatforms.has('tiktok')) {
            platformConfig.tiktok = { postType: platformSettings.ttPostType }
        }
        if (selectedPlatforms.has('pinterest')) {
            platformConfig.pinterest = { pinTitle: platformSettings.pinTitle || undefined, pinLink: platformSettings.pinLink || undefined }
        }

        try {
            if (isSingle) {
                const product = cappedProducts[0]
                const importUrls = enableImport ? (selectedImagesMap[product.id] || []) : []
                const refUrl = (useProductImageAsRef && enableAiImage && refImageUrl) ? refImageUrl
                    : (useProductImageAsRef && enableAiImage && product.images.length > 0) ? product.images[0] : undefined

                const payload = {
                    channelId: activeChannelId,
                    productId: product.id,
                    productData: { name: product.name, price: product.price, description: product.description, category: product.category, tags: product.tags, images: product.images },
                    importImageUrls: importUrls,
                    tone, platforms: [...selectedPlatforms], language,
                    scheduledAt: singleScheduledAt,
                    platformConfig,
                    ...(enableAiImage && imageProvider ? {
                        imageConfig: {
                            ...aiImagePayload.imageConfig,
                            referenceImageUrl: refUrl,
                        }
                    } : {}),
                }
                const res = await fetch('/api/posts/generate-from-shopify', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error ?? 'Generation failed')
                onClose()
                router.push(`/dashboard/posts/compose?edit=${data.postId}`)
                return
            }

            // Bulk — queue sequential, capped at BULK_LIMIT
            bulkGen.start(cappedProducts.length, 'Shopify Products')
            setStep('starting')
            setTimeout(() => { onClose() }, 2500)

            let created = 0
            for (let i = 0; i < cappedProducts.length; i++) {
                if (bulkGen.isStopped()) break
                const product = cappedProducts[i]
                const importUrls = enableImport ? (selectedImagesMap[product.id] || []) : []
                const refUrl = (useProductImageAsRef && enableAiImage) ? (refImageUrl || (product.images[0] ?? undefined)) : undefined
                try {
                    const res = await fetch('/api/posts/generate-from-shopify', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channelId: activeChannelId,
                            productId: product.id,
                            productData: { name: product.name, price: product.price, description: product.description, category: product.category, tags: product.tags },
                            importImageUrls: importUrls,
                            tone, platforms: [...selectedPlatforms], language,
                            scheduledAt: scheduledTimes ? scheduledTimes[i] : null,
                            requestApproval,
                            platformConfig,
                            ...(enableAiImage && imageProvider ? {
                                imageConfig: { ...aiImagePayload.imageConfig, referenceImageUrl: refUrl }
                            } : {}),
                        }),
                    })
                    if (res.ok) created++
                } catch { /* skip */ }
                bulkGen.tick()
                setLocalDone(i + 1)
            }

            if (bulkGen.isStopped()) {
                bulkGen.stop()
                toast.info(t('integrations.shopify.modal.stoppedToast').replace('{created}', String(created)).replace('{total}', String(cappedProducts.length)))
            } else {
                bulkGen.finish()
                toast.success(t('integrations.shopify.modal.doneToast').replace('{created}', String(created)), { duration: 5000 })
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('integrations.shopify.modal.errorToast'))
            setStep('config')
        }
    }

    const pct = products.length > 0 ? Math.round((localDone / products.length) * 100) : 0
    const allProviders = [
        ...byokProviders.map(p => ({ ...p, source: 'byok' })),
        ...planProviders.map(p => ({ ...p, source: 'plan' })),
    ]
    const selProvider = allProviders.find(p => `${p.source}:${p.provider}` === imageProvider)
    const selModel = availableImageModels.find(m => m.id === imageModel)
    const quotaLabel = imageQuota.limit > 0 ? t('integrations.shopify.modal.quotaUsed').replace('{used}', String(imageQuota.used)).replace('{limit}', String(imageQuota.limit)) : null
    const anyProductHasImages = products.some(p => p.images.length > 0)
    const schedulePreview = (!enableSchedule || isSingle) ? null
        : distributeSchedule(scheduleStart, scheduleEnd, products.length, channelTimezone).slice(0, 3)
            .map(t => new Date(t).toLocaleString('vi-VN', { timeZone: channelTimezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))


        const WIZARD_STEPS = [
            { id: 1, label: 'Platforms' },
            { id: 2, label: 'Media' },
            { id: 3, label: 'Settings' },
        ] as const

        return (
            <Dialog open={open} onOpenChange={v => !v && step === 'config' && onClose()}>
                <DialogContent className="max-w-2xl bg-background/95 backdrop-blur border border-border/60 shadow-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col">

                    {/* ── Header ─────────────────────────────── */}
                    <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b shrink-0">
                        <div className="space-y-0.5">
                            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                                <ShoppingBag className="h-4 w-4 text-[#96bf47]" />
                                {t('integrations.shopify.modal.title')}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                {cappedProducts.length > 1
                                    ? t('integrations.shopify.modal.generateFromPlural').replace('{count}', String(cappedProducts.length))
                                    : t('integrations.shopify.modal.generateFrom').replace('{count}', String(cappedProducts.length))}
                                {isSingle && ` — ${cappedProducts[0].name}`}
                            </DialogDescription>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    <Sparkles className="h-2.5 w-2.5" /> {t('integrations.shopify.modal.kbBadge')}
                                </span>
                                {isCapped && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                        ⚠ Limited to {BULK_LIMIT} posts
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Wizard stepper ─────────────────────── */}
                    {step === 'config' && (
                        <div className="flex items-center px-5 py-3 gap-0 shrink-0 border-b">
                            {WIZARD_STEPS.map((ws, idx) => (
                                <React.Fragment key={ws.id}>
                                    <button
                                        type="button"
                                        onClick={() => setWizardStep(ws.id)}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <span className={cn(
                                            'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all',
                                            wizardStep === ws.id
                                                ? 'bg-primary text-primary-foreground'
                                                : wizardStep > ws.id
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'bg-muted text-muted-foreground'
                                        )}>
                                            {wizardStep > ws.id ? <Check className="h-3 w-3" /> : ws.id}
                                        </span>
                                        <span className={cn(
                                            'text-xs font-medium transition-colors',
                                            wizardStep === ws.id ? 'text-foreground' : 'text-muted-foreground'
                                        )}>{ws.label}</span>
                                    </button>
                                    {idx < WIZARD_STEPS.length - 1 && (
                                        <div className={cn('flex-1 h-px mx-3 transition-colors', wizardStep > ws.id ? 'bg-primary/40' : 'bg-border/60')} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}

                    {/* ── Body ───────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto px-5 py-4">

                        {/* STEP 1: Platforms + Tone */}
                        {step === 'config' && wizardStep === 1 && (
                            <div className="space-y-5">
                                {isSingle && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                        {t('integrations.shopify.modal.willOpenCompose')}
                                    </div>
                                )}

                                {/* PLATFORMS */}
                                <div className="space-y-2.5">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('integrations.shopify.modal.platforms')}</p>
                                    {availablePlatforms.length === 0 ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('integrations.shopify.modal.loadingPlatforms')}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {availablePlatforms.map(p => (
                                                <button key={p} type="button" onClick={() => togglePlatform(p)}
                                                    className={cn('relative flex flex-col items-center gap-2 px-3 py-3 rounded-xl border transition-all text-xs font-medium',
                                                        selectedPlatforms.has(p)
                                                            ? 'border-primary bg-primary/10 text-primary shadow-[0_0_0_1px] shadow-primary'
                                                            : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:bg-card')}>
                                                    {selectedPlatforms.has(p) && (
                                                        <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
                                                            <Check className="h-2 w-2 text-primary-foreground" />
                                                        </span>
                                                    )}
                                                    <PlatformIcon platform={p} size={28} />
                                                    <span>{PLATFORM_LABELS[p] || p}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-[10px] text-muted-foreground">{t('integrations.shopify.modal.selectedCount').replace('{count}', String(selectedPlatforms.size))}</p>
                                </div>

                                {/* TONE */}
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('integrations.shopify.modal.tone')}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {TONES.map(tone_ => (
                                            <button key={tone_.value} type="button" onClick={() => setTone(tone_.value)}
                                                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all',
                                                    tone === tone_.value ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground')}>
                                                {tone_.icon}
                                                {tone_.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Images + AI Image */}
                        {step === 'config' && wizardStep === 2 && (
                            <div className="space-y-5">
                                {anyProductHasImages && (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <ImageIcon className="h-3.5 w-3.5" />{t('integrations.shopify.modal.importImages')}
                                            </p>
                                            <button type="button" onClick={() => setEnableImport(!enableImport)}
                                                className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer', enableImport ? 'bg-primary' : 'bg-muted')}>
                                                <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform', enableImport ? 'translate-x-[17px]' : 'translate-x-[2px]')} />
                                            </button>
                                        </div>
                                        {enableImport && cappedProducts.map(prod => (
                                            <div key={prod.id}>
                                                <div className="flex gap-1 mb-1 text-[10px] text-muted-foreground">
                                                    <button type="button" className="hover:text-primary cursor-pointer" onClick={() => selectAllImages(prod.id, prod.images)}>Select all</button>
                                                    <span>·</span>
                                                    <button type="button" className="hover:text-destructive cursor-pointer" onClick={() => clearAllImages(prod.id)}>Clear</button>
                                                </div>
                                                <ProductImagePicker product={prod} selectedImages={selectedImagesMap[prod.id] || []} onToggle={url => toggleProductImage(prod.id, url)} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* AI IMAGE */}
                                <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5" />{t('integrations.shopify.modal.aiImage')}
                                            {quotaLabel && <span className="text-[9px] font-normal ml-1 text-muted-foreground/60">{quotaLabel}</span>}
                                        </p>
                                        <button type="button" onClick={() => setEnableAiImage(!enableAiImage)}
                                            className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer', enableAiImage ? 'bg-primary' : 'bg-muted')}>
                                            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform', enableAiImage ? 'translate-x-[17px]' : 'translate-x-[2px]')} />
                                        </button>
                                    </div>
                                    {enableAiImage && (
                                        <div className="space-y-2.5 pt-1">
                                            <div className="relative">
                                                <button type="button" onClick={() => setProviderDropOpen(!providerDropOpen)}
                                                    className="w-full flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs cursor-pointer hover:border-border">
                                                    <span>{selProvider ? selProvider.name : t('integrations.shopify.modal.selectProvider')}</span>
                                                    <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', providerDropOpen && 'rotate-180')} />
                                                </button>
                                                {providerDropOpen && (
                                                    <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
                                                        {allProviders.map(p => (
                                                            <button key={`${p.source}:${p.provider}`} type="button"
                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted cursor-pointer"
                                                                onClick={() => { setImageProvider(`${p.source}:${p.provider}`); fetchModels(`${p.source}:${p.provider}`); setProviderDropOpen(false) }}>
                                                                <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold', p.source === 'byok' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary')}>
                                                                    {p.source === 'byok' ? 'BYOK' : 'Plan'}
                                                                </span>
                                                                {p.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {imageProvider && (
                                                <div className="relative">
                                                    <button type="button" onClick={() => setModelDropOpen(!modelDropOpen)}
                                                        className="w-full flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs cursor-pointer hover:border-border">
                                                        <span>{loadingModels ? t('integrations.shopify.modal.loadingModels') : (selModel?.name || imageModel || t('integrations.shopify.modal.selectModel'))}</span>
                                                        {loadingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', modelDropOpen && 'rotate-180')} />}
                                                    </button>
                                                    {modelDropOpen && !loadingModels && (
                                                        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md max-h-40 overflow-y-auto">
                                                            {availableImageModels.map(m => (
                                                                <button key={m.id} type="button"
                                                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted cursor-pointer"
                                                                    onClick={() => { setImageModel(m.id); setModelDropOpen(false) }}>
                                                                    {m.name || MODEL_DISPLAY[m.id] || m.id}
                                                                    {m.id === imageModel && <Check className="h-3 w-3 text-primary ml-auto" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)}
                                                placeholder={t('integrations.shopify.modal.imagePlaceholder')}
                                                className="w-full min-h-[52px] resize-y rounded-lg border bg-transparent px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" rows={2} />
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                {ASPECT_RATIOS.map(r => (
                                                    <button key={r.label} type="button" onClick={() => setSelectedAspect(r.label)}
                                                        className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] transition-all cursor-pointer',
                                                            selectedAspect === r.label ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-border')}>
                                                        <RatioShape label={r.label} active={selectedAspect === r.label} />
                                                        {r.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {anyProductHasImages && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] text-muted-foreground">{t('integrations.shopify.modal.useProductRef')}</p>
                                                        <button type="button" onClick={() => setUseProductImageAsRef(!useProductImageAsRef)}
                                                            className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer', useProductImageAsRef ? 'bg-primary' : 'bg-muted')}>
                                                            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform', useProductImageAsRef ? 'translate-x-[17px]' : 'translate-x-[2px]')} />
                                                        </button>
                                                    </div>
                                                    {useProductImageAsRef && isSingle && cappedProducts[0]?.images.length > 1 && (
                                                        <div className="flex gap-1.5 flex-wrap">
                                                            {cappedProducts[0].images.slice(0, 6).map((url, i) => (
                                                                <button key={i} type="button" onClick={() => setRefImageUrl(url)}
                                                                    className={cn('relative w-10 h-10 rounded-md overflow-hidden border-2 transition-all cursor-pointer',
                                                                        refImageUrl === url ? 'border-primary' : 'border-border/40 hover:border-border')}>
                                                                    <NextImage src={url} alt="" fill className="object-cover" unoptimized />
                                                                    {refImageUrl === url && <span className="absolute inset-0 bg-primary/20 flex items-center justify-center"><Check className="h-3 w-3 text-primary" /></span>}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Platform Settings + Schedule + Approval */}
                        {step === 'config' && wizardStep === 3 && (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <Settings2 className="h-3.5 w-3.5 text-primary" />
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            {isSingle ? 'Post Settings' : 'Post Settings (all posts)'}
                                        </p>
                                    </div>
                                    <PlatformSettingsPanel
                                        selectedPlatforms={[...selectedPlatforms]}
                                        settings={platformSettings}
                                        onChange={patchSettings}
                                        isBulk={!isSingle}
                                    />
                                </div>

                                {!isSingle && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5" />{t('integrations.shopify.modal.autoSchedule')}
                                            </p>
                                            <button type="button" onClick={() => setEnableSchedule(!enableSchedule)}
                                                className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer', enableSchedule ? 'bg-primary' : 'bg-muted')}>
                                                <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform', enableSchedule ? 'translate-x-[17px]' : 'translate-x-[2px]')} />
                                            </button>
                                        </div>
                                        {enableSchedule && (
                                            <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3">
                                                <p className="text-[10px] text-muted-foreground">
                                                    {t('integrations.shopify.modal.scheduleDesc').replace('{count}', String(cappedProducts.length)).replace('{tz}', channelTimezone)}
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground mb-1">{t('integrations.shopify.modal.fromDate')}</p>
                                                        <input type="date" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)}
                                                            className="w-full h-7 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground mb-1">{t('integrations.shopify.modal.toDate')}</p>
                                                        <input type="date" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)}
                                                            className="w-full h-7 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                                                    </div>
                                                </div>
                                                {schedulePreview && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {schedulePreview.map((t_, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                                                <Clock className="h-2.5 w-2.5" /> Post {i + 1}: {t_}
                                                            </span>
                                                        ))}
                                                        {cappedProducts.length > 3 && <span className="text-[9px] text-muted-foreground self-center">+{cappedProducts.length - 3} more…</span>}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('integrations.shopify.modal.approval')}</p>
                                    {approvalMode === 'optional' && (
                                        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-medium">{t('integrations.shopify.modal.requestApproval')}</p>
                                                <p className="text-[10px] text-muted-foreground">{t('integrations.shopify.modal.requestApprovalDesc')}</p>
                                            </div>
                                            <button type="button"
                                                className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0', requestApproval ? 'bg-primary' : 'bg-muted')}
                                                onClick={() => setRequestApproval(!requestApproval)}>
                                                <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                                                    requestApproval ? 'translate-x-[17px]' : 'translate-x-[2px]')} />
                                            </button>
                                        </div>
                                    )}
                                    {approvalMode === 'required' && (
                                        <div className="flex items-center justify-between rounded-xl border border-orange-500/30 bg-orange-500/5 px-3 py-2.5">
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-medium text-orange-400">{t('integrations.shopify.modal.approvalRequired')}</p>
                                                <p className="text-[10px] text-muted-foreground">{t('integrations.shopify.modal.approvalRequiredDesc')}</p>
                                            </div>
                                            <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-primary border-primary border opacity-70 cursor-not-allowed shrink-0">
                                                <span className="inline-block h-3.5 w-3.5 translate-x-[17px] rounded-full bg-white shadow" />
                                            </div>
                                        </div>
                                    )}
                                    {approvalMode === 'none' && (
                                        <p className="text-[10px] text-muted-foreground py-1">No approval required for this channel.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* GENERATING — single */}
                        {step === 'generating' && (
                            <div className="py-10 flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="h-14 w-14 rounded-full border-2 border-primary/20 flex items-center justify-center">
                                        <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                                    </div>
                                    <Loader2 className="absolute inset-0 m-auto h-14 w-14 text-primary/30 animate-spin" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="font-semibold text-sm">{t('integrations.shopify.modal.generating')}</p>
                                    <p className="text-xs text-muted-foreground">{[...selectedPlatforms].map(p => PLATFORM_LABELS[p] || p).join(', ')}</p>
                                </div>
                            </div>
                        )}

                        {/* STARTING — bulk */}
                        {step === 'starting' && (
                            <div className="py-8 flex flex-col items-center gap-5 text-center">
                                <div className="relative flex items-center justify-center">
                                    <span className="absolute h-20 w-20 rounded-full bg-primary/10 animate-ping opacity-60" />
                                    <span className="absolute h-16 w-16 rounded-full bg-primary/10" />
                                    <div className="relative h-14 w-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                                        <Sparkles className="h-6 w-6 text-primary" />
                                    </div>
                                </div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                                    <Zap className="h-3 w-3 text-primary" />
                                    <span className="text-xs font-bold text-primary">{t('integrations.shopify.modal.postsProgress').replace('{count}', String(cappedProducts.length)).replace('{pct}', String(pct))}</span>
                                </div>
                                <div className="space-y-1.5 px-2">
                                    <p className="font-bold text-base">{t('integrations.shopify.modal.bulkStarted')}</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {t('integrations.shopify.modal.bulkDesc').replace('{count}', String(cappedProducts.length))}
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" className="w-full mt-1" onClick={onClose}>
                                    <X className="h-3.5 w-3.5 mr-1" /> {t('integrations.shopify.modal.closeAndContinue')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* ── Footer nav ─────────────────────────── */}
                    {step === 'config' && (
                        <div className="flex items-center gap-2 px-5 py-3 border-t shrink-0">
                            {wizardStep > 1 ? (
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => setWizardStep((wizardStep - 1) as 1 | 2 | 3)}>
                                    ← Back
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
                                    <X className="h-3.5 w-3.5 mr-1" /> {t('integrations.shopify.modal.cancel')}
                                </Button>
                            )}
                            {wizardStep < 3 ? (
                                <Button size="sm" className="flex-1" onClick={() => setWizardStep((wizardStep + 1) as 1 | 2 | 3)} disabled={selectedPlatforms.size === 0}>
                                    Next →
                                </Button>
                            ) : (
                                <Button size="sm" className="flex-1 font-semibold" onClick={handleCreate} disabled={selectedPlatforms.size === 0}>
                                    <Zap className="h-3.5 w-3.5 mr-1" />
                                    {isSingle ? t('integrations.shopify.modal.generateAndEdit') : t('integrations.shopify.modal.createDrafts').replace('{count}', String(cappedProducts.length))}
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        )
}
