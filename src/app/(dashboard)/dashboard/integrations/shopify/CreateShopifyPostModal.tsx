'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import { useBulkGen } from '@/lib/bulk-gen-context'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import {
    Sparkles, X, Loader2, Zap, ExternalLink, Check, Calendar, Clock,
    Image as ImageIcon, ChevronDown, Package, ShoppingBag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import NextImage from 'next/image'

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
const TONES = [
    { value: 'viral', label: '🚀 Viral' }, { value: 'promotional', label: '🛍️ Promo' },
    { value: 'casual', label: '😊 Casual' }, { value: 'professional', label: '💼 Pro' },
    { value: 'storytelling', label: '📖 Story' },
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

function PlatformIcon({ platform, size = 28 }: { platform: string; size?: number }) {
    const icons: Record<string, React.ReactNode> = {
        facebook: <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#1877F2" /><path d="M16.5 8H14.5C14.2 8 14 8.2 14 8.5V10H16.5L16.1 12.5H14V19H11.5V12.5H9.5V10H11.5V8.5C11.5 6.8 12.8 5.5 14.5 5.5H16.5V8Z" fill="white" /></svg>,
        instagram: <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><defs><linearGradient id="ig-sm" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#FFDC80" /><stop offset="50%" stopColor="#E1306C" /><stop offset="100%" stopColor="#833AB4" /></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig-sm)" /><rect x="6" y="6" width="12" height="12" rx="3.5" stroke="white" strokeWidth="1.5" fill="none" /><circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none" /><circle cx="16" cy="8" r="0.8" fill="white" /></svg>,
        tiktok: <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#010101" /><path d="M17.5 9.5a5.5 5.5 0 0 1-3.5-1.2V15a4 4 0 1 1-4-4v2a2 2 0 1 0 2 2V5.5h2a3.5 3.5 0 0 0 3.5 3.5v.5z" fill="white" /></svg>,
        linkedin: <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#0A66C2" /><path d="M7.5 9H9.5V17H7.5V9ZM8.5 8C7.9 8 7.5 7.6 7.5 7C7.5 6.4 7.9 6 8.5 6C9.1 6 9.5 6.4 9.5 7C9.5 7.6 9.1 8 8.5 8ZM11 9H12.9V10C13.3 9.4 14 9 15 9C16.9 9 17.5 10.2 17.5 12V17H15.5V12.5C15.5 11.7 15.3 11 14.5 11C13.7 11 13 11.6 13 12.5V17H11V9Z" fill="white" /></svg>,
        youtube: <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#FF0000" /><path d="M10.3 14.4V9.6L15.3 12L10.3 14.4Z" fill="white" /></svg>,
        twitter: <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#000" /><path d="M13.96 10.68L18.52 5.5H17.42L13.47 9.99L10.3 5.5H6.5L11.27 12.33L6.5 17.74H7.6L11.78 13.01L15.14 17.74H18.94L13.96 10.68Z" fill="white" /></svg>,
    }
    return icons[platform] ?? (
        <div style={{ width: size, height: size }} className="rounded-md bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground">
            {platform.slice(0, 2)}
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
    const [language, setLanguage] = useState('vi')
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

    // Schedule
    const [enableSchedule, setEnableSchedule] = useState(false)
    const today = toDateVal(new Date())
    const [scheduleStart, setScheduleStart] = useState(today)
    const [scheduleEnd, setScheduleEnd] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return toDateVal(d) })

    const isSingle = products.length === 1

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

        const scheduledTimes = (enableSchedule && !isSingle)
            ? distributeSchedule(scheduleStart, scheduleEnd, products.length, channelTimezone) : null
        const singleScheduledAt = (enableSchedule && isSingle)
            ? distributeSchedule(scheduleStart, scheduleEnd, 1, channelTimezone)[0] : null

        const aiImagePayload = enableAiImage && imageProvider ? {
            imageConfig: {
                provider: imageProvider.split(':').slice(1).join(':'),
                model: imageModel || undefined,
                keySource: imageProvider.split(':')[0],
                prompt: imagePrompt.trim() || undefined,
                width: (ASPECT_RATIOS.find(a => a.label === selectedAspect) ?? ASPECT_RATIOS[0]).w,
                height: (ASPECT_RATIOS.find(a => a.label === selectedAspect) ?? ASPECT_RATIOS[0]).h,
                referenceImageUrl: useProductImageAsRef ? undefined : undefined, // will be set per-product below
            }
        } : {}

        try {
            if (isSingle) {
                const product = products[0]
                const importUrls = enableImport ? (selectedImagesMap[product.id] || []) : []
                const refUrl = (useProductImageAsRef && enableAiImage && product.images.length > 0) ? product.images[0] : undefined

                const payload = {
                    channelId: activeChannelId,
                    productData: { name: product.name, price: product.price, description: product.description, category: product.category, tags: product.tags, images: product.images },
                    importImageUrls: importUrls,
                    tone, platforms: [...selectedPlatforms], language,
                    scheduledAt: singleScheduledAt,
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

            // Bulk
            bulkGen.start(products.length, 'Shopify Products')
            setStep('starting')
            setTimeout(() => { onClose() }, 2500)

            let created = 0
            for (let i = 0; i < products.length; i++) {
                if (bulkGen.isStopped()) break
                const product = products[i]
                const importUrls = enableImport ? (selectedImagesMap[product.id] || []) : []
                const refUrl = (useProductImageAsRef && enableAiImage && product.images.length > 0) ? product.images[0] : undefined
                try {
                    const res = await fetch('/api/posts/generate-from-shopify', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channelId: activeChannelId,
                            productData: { name: product.name, price: product.price, description: product.description, category: product.category, tags: product.tags },
                            importImageUrls: importUrls,
                            tone, platforms: [...selectedPlatforms], language,
                            scheduledAt: scheduledTimes ? scheduledTimes[i] : null,
                            requestApproval,
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
                toast.info(t('integrations.shopify.modal.stoppedToast').replace('{created}', String(created)).replace('{total}', String(products.length)))
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

    return (
        <Dialog open={open} onOpenChange={v => !v && step === 'config' && onClose()}>
            <DialogContent className="max-w-md bg-background/95 backdrop-blur border border-border/60 shadow-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-1">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                        <ShoppingBag className="h-4 w-4 text-[#96bf47]" />
                        {t('integrations.shopify.modal.title')}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        {products.length > 1
                            ? t('integrations.shopify.modal.generateFromPlural').replace('{count}', String(products.length))
                            : t('integrations.shopify.modal.generateFrom').replace('{count}', String(products.length))}
                        {isSingle && ` — ${products[0].name}`}
                        {isSingle && ` ${t('integrations.shopify.modal.toCompose')}`}
                    </DialogDescription>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Sparkles className="h-2.5 w-2.5" /> {t('integrations.shopify.modal.kbBadge')}
                        </span>
                    </div>
                </DialogHeader>

                {/* CONFIG */}
                {step === 'config' && (
                    <div className="space-y-5 pt-1">
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
                                <div className="grid grid-cols-3 gap-2">
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
                                {TONES.map(t => (
                                    <button key={t.value} type="button" onClick={() => setTone(t.value)}
                                        className={cn('px-3 py-1.5 rounded-full text-xs border transition-all',
                                            tone === t.value ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground')}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* LANGUAGE */}
                        <div className="grid grid-cols-2 gap-2">
                            {[{ value: 'vi', label: '🇻🇳 Tiếng Việt' }, { value: 'en', label: '🇺🇸 English' }].map(l => (
                                <button key={l.value} type="button" onClick={() => setLanguage(l.value)}
                                    className={cn('py-2 rounded-xl text-xs border transition-all font-medium',
                                        language === l.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground')}>
                                    {l.label}
                                </button>
                            ))}
                        </div>

                        {/* PRODUCT IMAGES */}
                        {anyProductHasImages && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('integrations.shopify.modal.importImages')}</p>
                                    </div>
                                    <button type="button" onClick={() => setEnableImport(v => !v)}
                                        className={cn('relative inline-flex h-5 w-9 items-center rounded-full border transition-colors',
                                            enableImport ? 'bg-primary border-primary' : 'bg-muted border-border/60')}>
                                        <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                                            enableImport ? 'translate-x-[17px]' : 'translate-x-[2px]')} />
                                    </button>
                                </div>
                                {enableImport && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                                        {products.filter(p => p.images.length > 0).map(product => (
                                            <div key={product.id}>
                                                <ProductImagePicker
                                                    product={product}
                                                    selectedImages={selectedImagesMap[product.id] || []}
                                                    onToggle={(url) => toggleProductImage(product.id, url)}
                                                />
                                                {product.images.length > 1 && (
                                                    <div className="flex gap-2 mt-1 ml-1">
                                                        <button type="button" className="text-[10px] text-primary hover:underline"
                                                            onClick={() => selectAllImages(product.id, product.images)}>{t('integrations.shopify.modal.selectAll')}</button>
                                                        <button type="button" className="text-[10px] text-muted-foreground hover:underline"
                                                            onClick={() => clearAllImages(product.id)}>{t('integrations.shopify.modal.clear')}</button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI IMAGE */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('integrations.shopify.modal.aiImage')}</p>
                                    {quotaLabel && (
                                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                            imageQuota.used >= imageQuota.limit ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400')}>
                                            {quotaLabel}
                                        </span>
                                    )}
                                </div>
                                <button type="button" onClick={() => setEnableAiImage(v => !v)}
                                    className={cn('relative inline-flex h-5 w-9 items-center rounded-full border transition-colors',
                                        enableAiImage ? 'bg-primary border-primary' : 'bg-muted border-border/60')}>
                                    <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                                        enableAiImage ? 'translate-x-[17px]' : 'translate-x-[2px]')} />
                                </button>
                            </div>

                            {enableAiImage && (
                                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                                    {/* Provider + Model */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <button type="button" onClick={() => { setProviderDropOpen(v => !v); setModelDropOpen(false) }}
                                                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs hover:border-border transition-colors">
                                                <span className="truncate font-medium">{selProvider ? selProvider.name || selProvider.provider : allProviders.length === 0 ? t('integrations.shopify.modal.noProvider') : t('integrations.shopify.modal.selectProvider')}</span>
                                                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                            </button>
                                            {providerDropOpen && allProviders.length > 0 && (
                                                <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden">
                                                    <div className="py-1">
                                                        {byokProviders.length > 0 && <>
                                                            <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground">📌 {t('integrations.shopify.modal.yourKeys')}</div>
                                                            {byokProviders.map(p => (
                                                                <button key={p.provider} type="button" onClick={() => { setImageProvider(`byok:${p.provider}`); setProviderDropOpen(false); fetchModels(`byok:${p.provider}`) }}
                                                                    className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50', imageProvider === `byok:${p.provider}` ? 'text-primary font-medium' : 'text-foreground')}>
                                                                    {p.name || p.provider}{imageProvider === `byok:${p.provider}` && <Check className="h-3 w-3" />}
                                                                </button>
                                                            ))}
                                                        </>}
                                                        {planProviders.length > 0 && <>
                                                            <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground">⚡ {t('integrations.shopify.modal.planKeys')}</div>
                                                            {planProviders.map(p => (
                                                                <button key={p.provider} type="button" onClick={() => { setImageProvider(`plan:${p.provider}`); setProviderDropOpen(false); fetchModels(`plan:${p.provider}`) }}
                                                                    className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50', imageProvider === `plan:${p.provider}` ? 'text-primary font-medium' : 'text-foreground')}>
                                                                    {p.name || p.provider}{imageProvider === `plan:${p.provider}` && <Check className="h-3 w-3" />}
                                                                </button>
                                                            ))}
                                                        </>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative flex-1">
                                            <button type="button" disabled={loadingModels} onClick={() => { setModelDropOpen(v => !v); setProviderDropOpen(false) }}
                                                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs hover:border-border transition-colors">
                                                <span className="truncate font-medium">{loadingModels ? t('integrations.shopify.modal.loadingModel') : selModel ? selModel.name : t('integrations.shopify.modal.selectModel')}</span>
                                                {loadingModels ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                            </button>
                                            {modelDropOpen && availableImageModels.length > 0 && (
                                                <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                                    <div className="py-1">
                                                        {availableImageModels.map(m => (
                                                            <button key={m.id} type="button" onClick={() => { setImageModel(m.id); setModelDropOpen(false) }}
                                                                className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50', imageModel === m.id ? 'text-primary font-medium' : 'text-foreground')}>
                                                                {m.name}{imageModel === m.id && <Check className="h-3 w-3" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Aspect */}
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('integrations.shopify.modal.aspectRatio')}</p>
                                        <div className="flex gap-1.5">
                                            {ASPECT_RATIOS.map(ar => (
                                                <button key={ar.label} type="button" onClick={() => setSelectedAspect(ar.label)}
                                                    className={cn('flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[10px] font-medium',
                                                        selectedAspect === ar.label ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-background text-muted-foreground hover:border-border')}>
                                                    <RatioShape label={ar.label} active={selectedAspect === ar.label} />
                                                    {ar.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Prompt */}
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('integrations.shopify.modal.imagePromptLabel')}</p>
                                        <textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)}
                                            placeholder={t('integrations.shopify.modal.imagePromptPlaceholder')}
                                            rows={2} className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:border-primary placeholder:text-muted-foreground/60" />
                                    </div>

                                    {/* Use product image as reference */}
                                    {anyProductHasImages && (
                                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                            <input type="checkbox" checked={useProductImageAsRef} onChange={e => setUseProductImageAsRef(e.target.checked)}
                                                className="rounded border-border/60 text-primary accent-primary" />
                                            <span className="text-[11px] text-foreground">
                                                {t('integrations.shopify.modal.useProductRef')}
                                            </span>
                                        </label>
                                    )}
                                    <p className="text-[10px] text-muted-foreground">{t('integrations.shopify.modal.autoGenNote')}</p>
                                </div>
                            )}
                        </div>

                        {/* SCHEDULE */}
                        {!isSingle && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('integrations.shopify.modal.autoSchedule')}</p>
                                    </div>
                                    <button type="button" onClick={() => setEnableSchedule(v => !v)}
                                        className={cn('relative inline-flex h-5 w-9 items-center rounded-full border transition-colors',
                                            enableSchedule ? 'bg-primary border-primary' : 'bg-muted border-border/60')}>
                                        <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                                            enableSchedule ? 'translate-x-[17px]' : 'translate-x-[2px]')} />
                                    </button>
                                </div>
                                {enableSchedule && (
                                    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                                        <p className="text-[10px] text-muted-foreground">
                                            {t('integrations.shopify.modal.scheduleDesc').replace('{count}', String(products.length))}
                                            {channelTimezone !== 'UTC' && <span className="ml-1 text-primary/70">· {channelTimezone}</span>}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('integrations.shopify.modal.fromDate')}</label>
                                                <input type="date" value={scheduleStart} min={today} onChange={e => setScheduleStart(e.target.value)}
                                                    className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-primary" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('integrations.shopify.modal.toDate')}</label>
                                                <input type="date" value={scheduleEnd} min={scheduleStart || today} onChange={e => setScheduleEnd(e.target.value)}
                                                    className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-primary" />
                                            </div>
                                        </div>
                                        {schedulePreview && (
                                            <div className="flex flex-wrap gap-1">
                                                {schedulePreview.map((ts, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] text-muted-foreground">
                                                        <Clock className="h-2.5 w-2.5" /> {t('integrations.shopify.modal.postN').replace('{n}', String(i + 1))}: {ts}
                                                    </span>
                                                ))}
                                                {products.length > 3 && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] text-muted-foreground">{t('integrations.shopify.modal.morePosts').replace('{n}', String(products.length - 3))}</span>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* APPROVAL */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('integrations.shopify.modal.approval')}</p>
                            </div>
                            {approvalMode === 'none' && (
                                <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border/60 bg-muted/30 px-3 py-2.5">
                                    <svg className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">{t('integrations.shopify.modal.enableApproval')}</p>
                                        {channelId4Settings && (
                                            <a href={`/dashboard/channels/${channelId4Settings}`} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-primary hover:underline">
                                                {t('integrations.shopify.modal.openChannelSettings')}
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                            {approvalMode === 'optional' && (
                                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium">{t('integrations.shopify.modal.requestApproval')}</p>
                                        <p className="text-[10px] text-muted-foreground">{t('integrations.shopify.modal.requestApprovalDesc')}</p>
                                    </div>
                                    <button type="button" onClick={() => setRequestApproval(v => !v)}
                                        className={cn('relative inline-flex h-5 w-9 items-center rounded-full border transition-colors shrink-0',
                                            requestApproval ? 'bg-primary border-primary' : 'bg-muted border-border/60')}>
                                        <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
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
                        </div>

                        {/* ACTIONS */}
                        <div className="flex gap-2 pt-1">
                            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
                                <X className="h-3.5 w-3.5 mr-1" /> {t('integrations.shopify.modal.cancel')}
                            </Button>
                            <Button size="sm" className="flex-1 font-semibold" onClick={handleCreate} disabled={selectedPlatforms.size === 0}>
                                <Zap className="h-3.5 w-3.5 mr-1" />
                                {isSingle ? t('integrations.shopify.modal.generateAndEdit') : t('integrations.shopify.modal.createDrafts').replace('{count}', String(products.length))}
                            </Button>
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
                            <span className="text-xs font-bold text-primary">{t('integrations.shopify.modal.postsProgress').replace('{count}', String(products.length)).replace('{pct}', String(pct))}</span>
                        </div>
                        <div className="space-y-1.5 px-2">
                            <p className="font-bold text-base">{t('integrations.shopify.modal.bulkStarted')}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {t('integrations.shopify.modal.bulkDesc').replace('{count}', String(products.length))}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-1" onClick={onClose}>
                            <X className="h-3.5 w-3.5 mr-1" /> {t('integrations.shopify.modal.closeAndContinue')}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
