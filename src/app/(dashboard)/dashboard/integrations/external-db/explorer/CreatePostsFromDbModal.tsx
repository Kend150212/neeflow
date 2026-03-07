'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import { useBulkGen } from '@/lib/bulk-gen-context'
import { useI18n } from '@/lib/i18n'
import { toast } from 'sonner'
import { Sparkles, X, Loader2, Zap, ExternalLink, Check, Calendar, Clock, Image, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { platformIcons } from '@/components/platform-icons'

interface Props {
    open: boolean
    onClose: () => void
    rows: Record<string, unknown>[]
    columns: string[]
    tableName: string
}

// ── Provider / model helpers ──────────────────────────────────────────────────
const MODEL_DISPLAY_NAMES: Record<string, string> = {
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
    { label: '1:1', w: 1024, h: 1024 },
    { label: '16:9', w: 1792, h: 1024 },
    { label: '9:16', w: 1024, h: 1792 },
    { label: '4:3', w: 1024, h: 768 },
    { label: '3:4', w: 768, h: 1024 },
    { label: '4:5', w: 819, h: 1024 },
]

// Ratio SVG shape indicator
function AspectRatioShape({ label, active }: { label: string; active: boolean }) {
    const shapes: Record<string, { w: number; h: number }> = {
        '1:1': { w: 18, h: 18 }, '16:9': { w: 24, h: 13 }, '9:16': { w: 13, h: 24 },
        '4:3': { w: 20, h: 15 }, '3:4': { w: 15, h: 20 }, '4:5': { w: 14, h: 18 },
    }
    const s = shapes[label] ?? { w: 18, h: 18 }
    return (
        <svg width={s.w} height={s.h} viewBox={`0 0 ${s.w} ${s.h}`}>
            <rect x="0.75" y="0.75" width={s.w - 1.5} height={s.h - 1.5} rx="2"
                stroke={active ? 'currentColor' : '#6b7280'} strokeWidth="1.5" fill="none" />
        </svg>
    )
}

// ── Platform logos / labels ───────────────────────────────────────────────────
// Uses official brand SVGs from platform-icons.tsx (shared component)
const PlatformLogo = ({ platform, size = 28 }: { platform: string; size?: number }) => {
    const icon = platformIcons[platform]
    if (!icon) {
        return (
            <div style={{ width: size, height: size }} className="rounded-md bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground">
                {platform.slice(0, 2)}
            </div>
        )
    }
    return (
        <div style={{ width: size, height: size }} className="shrink-0 flex items-center justify-center">
            <div style={{ width: size, height: size }}>{icon}</div>
        </div>
    )
}

const PLATFORM_LABELS: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', twitter: 'X / Twitter',
    tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube',
    pinterest: 'Pinterest', threads: 'Threads', bluesky: 'Bluesky',
}

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

const BEST_HOURS = [8, 12, 18, 20, 9, 15, 21]

function distributeScheduleTimes(startDate: string, endDate: string, count: number, timezone: string): string[] {
    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T23:59:59`)
    const totalMs = end.getTime() - start.getTime()
    if (count === 1) {
        const d = new Date(`${startDate}T${String(BEST_HOURS[0]).padStart(2, '0')}:00:00`)
        return [toChannelTzIso(d, timezone)]
    }
    return Array.from({ length: count }, (_, i) => {
        const fraction = i / (count - 1)
        const d = new Date(start.getTime() + fraction * totalMs)
        d.setHours(BEST_HOURS[i % BEST_HOURS.length], 0, 0, 0)
        return toChannelTzIso(d, timezone)
    })
}

function toChannelTzIso(localDate: Date, timezone: string): string {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        })
        const parts = Object.fromEntries(formatter.formatToParts(localDate).map(p => [p.type, p.value]))
        const target = `${parts.year}-${parts.month}-${parts.day}T${String(localDate.getHours()).padStart(2, '0')}:00:00`
        const utcDate = new Date(new Date(`${target}Z`).toLocaleString('en-US', { timeZone: 'UTC' }))
        const tzDate = new Date(new Date(`${target}Z`).toLocaleString('en-US', { timeZone: timezone }))
        return new Date(new Date(`${target}Z`).getTime() + utcDate.getTime() - tzDate.getTime()).toISOString()
    } catch { return localDate.toISOString() }
}

function toDateInputValue(d: Date) { return d.toISOString().slice(0, 10) }

// ── Main modal ────────────────────────────────────────────────────────────────
export default function CreatePostsFromDbModal({ open, onClose, rows, columns, tableName }: Props) {
    const router = useRouter()
    const { activeChannelId } = useWorkspace()
    const bulkGen = useBulkGen()
    const { t } = useI18n()

    const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([])
    const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
    const [channelTimezone, setChannelTimezone] = useState('UTC')
    const [channelId4Settings, setChannelId4Settings] = useState<string>('')
    const [approvalMode, setApprovalMode] = useState<'none' | 'optional' | 'required'>('none')
    const [requestApproval, setRequestApproval] = useState(false)
    const [tone, setTone] = useState('viral')
    const [language, setLanguage] = useState('vi')
    const [step, setStep] = useState<'config' | 'starting' | 'generating' | 'done'>('config')
    const [localDone, setLocalDone] = useState(0)

    // Date range scheduling
    const [enableSchedule, setEnableSchedule] = useState(false)
    const today = toDateInputValue(new Date())
    const [scheduleStart, setScheduleStart] = useState(today)
    const [scheduleEnd, setScheduleEnd] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 7); return toDateInputValue(d)
    })

    // ── AI Image generation state ─────────────────────────────────────────────
    const [enableAiImage, setEnableAiImage] = useState(false)
    const [imagePrompt, setImagePrompt] = useState('')
    const [selectedAspect, setSelectedAspect] = useState('1:1')
    const [imageProvider, setImageProvider] = useState('') // 'plan:gemini' | 'byok:openai' etc.
    const [imageModel, setImageModel] = useState('')
    const [availableImageModels, setAvailableImageModels] = useState<{ id: string; name: string }[]>([])
    const [loadingModels, setLoadingModels] = useState(false)
    const [imageQuota, setImageQuota] = useState<{ used: number; limit: number }>({ used: 0, limit: -1 })
    const [byokProviders, setByokProviders] = useState<{ provider: string; name: string; source: string }[]>([])
    const [planProviders, setPlanProviders] = useState<{ provider: string; name: string; source: string }[]>([])
    const [providerDropdownOpen, setProviderDropdownOpen] = useState(false)
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
    const [generatingImage, setGeneratingImage] = useState(false)
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

    // Fetch image providers + quota when modal opens
    useEffect(() => {
        if (!open) return
        fetch('/api/user/image-providers')
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((data: { byok: { provider: string; name: string }[]; plan: { provider: string; name: string }[]; quota: { used: number; limit: number } }) => {
                setByokProviders((data.byok || []).map(p => ({ ...p, source: 'byok' })))
                setPlanProviders((data.plan || []).map(p => ({ ...p, source: 'plan' })))
                setImageQuota(data.quota || { used: 0, limit: -1 })
                // Auto-select first
                const all = [
                    ...(data.byok || []).map(p => ({ ...p, source: 'byok' })),
                    ...(data.plan || []).map(p => ({ ...p, source: 'plan' })),
                ]
                if (all.length > 0 && !imageProvider) {
                    const first = all[0]
                    setImageProvider(`${first.source}:${first.provider}`)
                    fetchModels(`${first.source}:${first.provider}`)
                }
            })
            .catch(() => { })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    function fetchModels(providerKey: string) {
        const [source, ...rest] = providerKey.split(':')
        const providerName = rest.join(':')
        setLoadingModels(true)
        setAvailableImageModels([])
        setImageModel('')
        const endpoint = source === 'plan'
            ? fetch('/api/admin/posts/plan-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: providerName }) })
            : fetch('/api/user/api-keys/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: providerName }) })

        endpoint.then(r => r.json()).then(d => {
            const models = (d.models || [])
                .filter((m: { id: string; type?: string }) => source === 'plan' || m.type === 'image')
                .map((m: { id: string; name?: string }) => ({
                    id: m.id,
                    name: m.name || MODEL_DISPLAY_NAMES[m.id] || m.id,
                }))
            setAvailableImageModels(models)
            if (models.length > 0) setImageModel(models[0].id)
        }).catch(() => { }).finally(() => setLoadingModels(false))
    }

    function handleProviderSelect(key: string) {
        setImageProvider(key)
        setProviderDropdownOpen(false)
        fetchModels(key)
    }

    async function handleGenerateImage() {
        if (!activeChannelId) { toast.error('No channel selected'); return }
        if (!imagePrompt.trim()) { toast.error('Enter an image prompt'); return }
        const aspect = ASPECT_RATIOS.find(a => a.label === selectedAspect) ?? ASPECT_RATIOS[0]
        const [source, ...rest] = imageProvider.split(':')
        const providerName = rest.join(':')
        setGeneratingImage(true)
        try {
            const res = await fetch('/api/admin/posts/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: activeChannelId,
                    prompt: imagePrompt,
                    width: aspect.w,
                    height: aspect.h,
                    provider: providerName,
                    model: imageModel || undefined,
                    keySource: source,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Image generation failed')
            setPreviewImageUrl(data.mediaItem?.url || null)
            // Update quota display
            if (data.quota) setImageQuota(data.quota)
            else setImageQuota(q => ({ ...q, used: q.used + 1 }))
            toast.success('Image generated!')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Image generation failed')
        } finally {
            setGeneratingImage(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!open || !activeChannelId) return
        setStep('config'); setLocalDone(0); setRequestApproval(false)
        setPreviewImageUrl(null)
        fetch('/api/admin/channels')
            .then(r => r.json())
            .then((data: any[]) => {
                const channel = data.find((c: any) => c.id === activeChannelId)
                if (channel?.platforms) {
                    const plats = [...new Set(
                        channel.platforms.filter((p: any) => p.isActive !== false)
                            .map((p: any) => (p.platform as string).toLowerCase())
                    )] as string[]
                    setAvailablePlatforms(plats.length > 0 ? plats : ['facebook', 'instagram'])
                    setSelectedPlatforms(new Set(plats))
                }
                if (channel?.timezone) setChannelTimezone(channel.timezone)
                if (channel?.requireApproval) setApprovalMode(channel.requireApproval as 'none' | 'optional' | 'required')
                if (channel?.id) setChannelId4Settings(channel.id)
                if (channel?.requireApproval === 'required') setRequestApproval(true)
            })
            .catch(() => {
                setAvailablePlatforms(['facebook', 'instagram', 'tiktok'])
                setSelectedPlatforms(new Set(['facebook', 'instagram']))
            })
    }, [open, activeChannelId])

    function togglePlatform(p: string) {
        setSelectedPlatforms(prev => {
            const next = new Set(prev)
            if (next.has(p)) { if (next.size === 1) return prev; next.delete(p) } else { next.add(p) }
            return next
        })
    }

    function rowToText(row: Record<string, unknown>): string {
        return columns.map(col => `${col}: ${row[col] ?? ''}`).join(', ')
    }

    async function handleCreate() {
        if (!activeChannelId) { toast.error(t('integrations.aiPostCreator.noChannelError')); return }
        if (selectedPlatforms.size === 0) { toast.error(t('integrations.aiPostCreator.selectPlatformError')); return }

        setStep('generating')
        setLocalDone(0)

        const isSingleRow = rows.length === 1
        const scheduledTimes = (enableSchedule && !isSingleRow)
            ? distributeScheduleTimes(scheduleStart, scheduleEnd, rows.length, channelTimezone) : null
        const singleScheduledAt = (enableSchedule && isSingleRow)
            ? distributeScheduleTimes(scheduleStart, scheduleEnd, 1, channelTimezone)[0] : null

        // Build imageConfig payload — server generates image per-row; prompt is optional (falls back to post content)
        const aiImagePayload = enableAiImage && imageProvider
            ? {
                imageConfig: {
                    provider: imageProvider.split(':').slice(1).join(':'),
                    model: imageModel || undefined,
                    keySource: imageProvider.split(':')[0],
                    prompt: imagePrompt.trim() || undefined,  // undefined = server uses post content
                    width: (ASPECT_RATIOS.find(a => a.label === selectedAspect) ?? ASPECT_RATIOS[0]).w,
                    height: (ASPECT_RATIOS.find(a => a.label === selectedAspect) ?? ASPECT_RATIOS[0]).h,
                },
            }
            : {}

        try {
            if (isSingleRow) {
                const res = await fetch('/api/posts/generate-from-db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: activeChannelId, dataText: rowToText(rows[0]), tableName,
                        tone, platforms: [...selectedPlatforms], language, rowData: rows[0], columns,
                        scheduledAt: singleScheduledAt,
                        ...aiImagePayload,
                    }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error ?? 'Generation failed')
                const params = new URLSearchParams(); params.set('edit', data.postId)
                onClose()
                router.push(`/dashboard/posts/compose?${params.toString()}`)
                return
            }

            bulkGen.start(rows.length, `${tableName}`)
            setStep('starting')
            setTimeout(() => { onClose() }, 2500)

            let created = 0
            for (let i = 0; i < rows.length; i++) {
                if (bulkGen.isStopped()) break
                try {
                    const res = await fetch('/api/posts/generate-from-db', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channelId: activeChannelId, dataText: rowToText(rows[i]), tableName,
                            tone, platforms: [...selectedPlatforms], language, rowData: rows[i], columns,
                            scheduledAt: scheduledTimes ? scheduledTimes[i] : null,
                            requestApproval,
                            ...aiImagePayload,
                        }),
                    })
                    if (res.ok) created++
                } catch { /* skip */ }
                bulkGen.tick()
                setLocalDone(i + 1)
            }

            if (bulkGen.isStopped()) {
                bulkGen.stop()
                toast.info(t('integrations.aiPostCreator.stoppedToast').replace('{created}', String(created)).replace('{total}', String(rows.length)))
            } else {
                bulkGen.finish()
                toast.success(t('integrations.aiPostCreator.doneToast').replace('{created}', String(created)).replace('{table}', tableName), { duration: 5000 })
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('integrations.aiPostCreator.errorToast'))
            setStep('config')
        }
    }

    const isSingleRow = rows.length === 1
    const pct = rows.length > 0 ? Math.round((localDone / rows.length) * 100) : 0

    const schedulePreview = (() => {
        if (!enableSchedule || isSingleRow || !scheduleStart || !scheduleEnd || scheduleStart > scheduleEnd) return null
        return distributeScheduleTimes(scheduleStart, scheduleEnd, rows.length, channelTimezone).slice(0, 3).map(t =>
            new Date(t).toLocaleString('vi-VN', {
                timeZone: channelTimezone, day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit',
            })
        )
    })()

    // Provider display helpers
    const allImgProviders = [
        ...byokProviders.map(p => ({ ...p, source: 'byok' })),
        ...planProviders.map(p => ({ ...p, source: 'plan' })),
    ]
    const selectedProviderEntry = allImgProviders.find(p => `${p.source}:${p.provider}` === imageProvider)
    const selectedModelEntry = availableImageModels.find(m => m.id === imageModel)

    const quotaLabel = imageQuota.limit === -1
        ? null
        : imageQuota.limit === 0
            ? null
            : `${imageQuota.used}/${imageQuota.limit} used`

    return (
        <Dialog open={open} onOpenChange={v => !v && step !== 'generating' && onClose()}>
            <DialogContent className="max-w-md bg-background/95 backdrop-blur border border-border/60 shadow-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-1">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" /> AI Post Creator
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Generate from <strong>{rows.length} record{rows.length > 1 ? 's' : ''}</strong> in <strong>{tableName}</strong>
                        {isSingleRow && ' → Compose Editor'}
                    </DialogDescription>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Sparkles className="h-2.5 w-2.5" />
                            {t('integrations.aiPostCreator.kbBadge')}
                        </span>
                    </div>
                </DialogHeader>

                {/* CONFIG */}
                {step === 'config' && (
                    <div className="space-y-5 pt-1">
                        {isSingleRow && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Sẽ mở Compose Editor với nội dung đã điền sẵn
                            </div>
                        )}

                        {/* PLATFORMS */}
                        <div className="space-y-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Platforms</p>
                            {availablePlatforms.length === 0 ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading platforms...
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {availablePlatforms.map(p => (
                                        <button key={p} type="button" onClick={() => togglePlatform(p)}
                                            className={cn(
                                                'relative flex flex-col items-center gap-2 px-3 py-3 rounded-xl border transition-all text-xs font-medium',
                                                selectedPlatforms.has(p)
                                                    ? 'border-primary bg-primary/10 text-primary shadow-[0_0_0_1px] shadow-primary'
                                                    : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:bg-card'
                                            )}>
                                            {selectedPlatforms.has(p) && (
                                                <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
                                                    <Check className="h-2 w-2 text-primary-foreground" />
                                                </span>
                                            )}
                                            <PlatformLogo platform={p} size={28} />
                                            <span>{PLATFORM_LABELS[p] || p}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <p className="text-[10px] text-muted-foreground">{selectedPlatforms.size} selected — AI will generate content for each</p>
                        </div>

                        {/* TONE */}
                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tone</p>
                            <div className="flex flex-wrap gap-1.5">
                                {TONES.map(tone_ => (
                                    <button key={tone_.value} type="button" onClick={() => setTone(tone_.value)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all',
                                            tone === tone_.value
                                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                                : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground'
                                        )}>
                                        {tone_.icon}
                                        {tone_.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* LANGUAGE */}
                        <div className="grid grid-cols-2 gap-2">
                            {[{ value: 'vi', label: '🇻🇳 Tiếng Việt' }, { value: 'en', label: '🇺🇸 English' }].map(l => (
                                <button key={l.value} type="button" onClick={() => setLanguage(l.value)}
                                    className={cn(
                                        'py-2 rounded-xl text-xs border transition-all font-medium',
                                        language === l.value
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground'
                                    )}>
                                    {l.label}
                                </button>
                            ))}
                        </div>

                        {/* ── AI IMAGE GENERATION ─────────────────────────────── */}
                        <div className="space-y-3">
                            {/* Toggle header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Image className="h-3.5 w-3.5 text-muted-foreground" />
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Image</p>
                                    {quotaLabel && (
                                        <span className={cn(
                                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                            imageQuota.used >= imageQuota.limit
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-emerald-500/20 text-emerald-400'
                                        )}>
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
                                    {/* Provider + Model row */}
                                    <div className="flex items-center gap-2">
                                        {/* Provider dropdown */}
                                        <div className="relative flex-1">
                                            <button
                                                type="button"
                                                onClick={() => { setProviderDropdownOpen(v => !v); setModelDropdownOpen(false) }}
                                                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs hover:border-border transition-colors"
                                            >
                                                <span className="truncate font-medium">
                                                    {selectedProviderEntry
                                                        ? selectedProviderEntry.name || selectedProviderEntry.provider
                                                        : allImgProviders.length === 0 ? 'No providers' : 'Select provider'}
                                                </span>
                                                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                                            </button>
                                            {providerDropdownOpen && allImgProviders.length > 0 && (
                                                <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden">
                                                    <div className="py-1">
                                                        {byokProviders.length > 0 && (
                                                            <>
                                                                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                                    Your Keys (unlimited)
                                                                </div>
                                                                {byokProviders.map(p => (
                                                                    <button key={`byok:${p.provider}`} type="button"
                                                                        onClick={() => handleProviderSelect(`byok:${p.provider}`)}
                                                                        className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors',
                                                                            imageProvider === `byok:${p.provider}` ? 'text-primary font-medium' : 'text-foreground')}>
                                                                        {p.name || p.provider}
                                                                        {imageProvider === `byok:${p.provider}` && <Check className="h-3 w-3" />}
                                                                    </button>
                                                                ))}
                                                            </>
                                                        )}
                                                        {planProviders.length > 0 && (
                                                            <>
                                                                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                                                    Plan ({imageQuota.limit === -1 ? '∞' : `${Math.max(0, imageQuota.limit - imageQuota.used)} left`})
                                                                </div>
                                                                {planProviders.map(p => (
                                                                    <button key={`plan:${p.provider}`} type="button"
                                                                        onClick={() => handleProviderSelect(`plan:${p.provider}`)}
                                                                        className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors',
                                                                            imageProvider === `plan:${p.provider}` ? 'text-primary font-medium' : 'text-foreground')}>
                                                                        {p.name || p.provider}
                                                                        {imageProvider === `plan:${p.provider}` && <Check className="h-3 w-3" />}
                                                                    </button>
                                                                ))}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Model dropdown */}
                                        <div className="relative flex-1">
                                            <button
                                                type="button"
                                                onClick={() => { setModelDropdownOpen(v => !v); setProviderDropdownOpen(false) }}
                                                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-background text-xs hover:border-border transition-colors"
                                                disabled={loadingModels}
                                            >
                                                <span className="truncate font-medium">
                                                    {loadingModels ? 'Loading…'
                                                        : selectedModelEntry ? selectedModelEntry.name
                                                            : availableImageModels.length === 0 ? 'No models' : 'Select model'}
                                                </span>
                                                {loadingModels
                                                    ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                                                    : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
                                            </button>
                                            {modelDropdownOpen && availableImageModels.length > 0 && (
                                                <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                                    <div className="py-1">
                                                        {availableImageModels.map(m => (
                                                            <button key={m.id} type="button"
                                                                onClick={() => { setImageModel(m.id); setModelDropdownOpen(false) }}
                                                                className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors',
                                                                    imageModel === m.id ? 'text-primary font-medium' : 'text-foreground')}>
                                                                {m.name}
                                                                {imageModel === m.id && <Check className="h-3 w-3" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Aspect Ratio */}
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Aspect Ratio</p>
                                        <div className="flex gap-1.5">
                                            {ASPECT_RATIOS.map(ar => (
                                                <button key={ar.label} type="button"
                                                    onClick={() => setSelectedAspect(ar.label)}
                                                    className={cn(
                                                        'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[10px] font-medium',
                                                        selectedAspect === ar.label
                                                            ? 'border-primary bg-primary/10 text-primary'
                                                            : 'border-border/60 bg-background text-muted-foreground hover:border-border'
                                                    )}>
                                                    <AspectRatioShape label={ar.label} active={selectedAspect === ar.label} />
                                                    {ar.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Prompt */}
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Image Prompt</p>
                                        <textarea
                                            value={imagePrompt}
                                            onChange={e => setImagePrompt(e.target.value)}
                                            placeholder="Describe the image you want to generate..."
                                            rows={2}
                                            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:border-primary placeholder:text-muted-foreground/60"
                                        />
                                    </div>

                                    {/* Preview button + preview image */}
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={handleGenerateImage}
                                            disabled={generatingImage || !imagePrompt.trim() || !imageProvider}
                                            className={cn(
                                                'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all',
                                                generatingImage || !imagePrompt.trim() || !imageProvider
                                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                                    : 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30'
                                            )}>
                                            {generatingImage
                                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating preview…</>
                                                : <><Sparkles className="h-3.5 w-3.5" /> Preview Image (optional)</>}
                                        </button>
                                        <p className="text-[10px] text-muted-foreground text-center">
                                            Image generates automatically when you create posts
                                        </p>

                                        {previewImageUrl && (
                                            <div className="relative rounded-lg overflow-hidden border border-primary/30">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={previewImageUrl} alt="Preview" className="w-full object-cover max-h-40" />
                                                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/90 text-[9px] text-white font-semibold">
                                                    <Check className="h-2.5 w-2.5" /> Preview
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* AUTO SCHEDULE */}
                        {!isSingleRow && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Auto Schedule</p>
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
                                            AI phân bổ {rows.length} bài đều trong khoảng thời gian này
                                            {channelTimezone !== 'UTC' && <span className="ml-1 text-primary/70">· {channelTimezone}</span>}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Từ ngày</label>
                                                <input type="date" value={scheduleStart} min={today}
                                                    onChange={e => setScheduleStart(e.target.value)}
                                                    className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-primary" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Đến ngày</label>
                                                <input type="date" value={scheduleEnd} min={scheduleStart || today}
                                                    onChange={e => setScheduleEnd(e.target.value)}
                                                    className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-primary" />
                                            </div>
                                        </div>
                                        {schedulePreview && (
                                            <div className="flex flex-wrap gap-1">
                                                {schedulePreview.map((t, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] text-muted-foreground">
                                                        <Clock className="h-2.5 w-2.5" /> Bài {i + 1}: {t}
                                                    </span>
                                                ))}
                                                {rows.length > 3 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-background border border-border/60 text-[10px] text-muted-foreground">
                                                        +{rows.length - 3} bài nữa...
                                                    </span>
                                                )}
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
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Approval</p>
                            </div>

                            {approvalMode === 'none' && (
                                <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border/60 bg-muted/30 px-3 py-2.5">
                                    <svg className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Enable <strong>Approval Mode</strong> on this channel to request approval for bulk posts.
                                        </p>
                                        {channelId4Settings && (
                                            <a href={`/dashboard/channels/${channelId4Settings}`} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-primary hover:underline">
                                                Open Channel Settings
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {approvalMode === 'optional' && (
                                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium">Request Approval</p>
                                        <p className="text-[10px] text-muted-foreground">Posts will be sent to approvers before publishing</p>
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
                                        <p className="text-xs font-medium text-orange-400">Approval Required</p>
                                        <p className="text-[10px] text-muted-foreground">All posts must be approved before publishing</p>
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
                                <X className="h-3.5 w-3.5 mr-1" /> Cancel
                            </Button>
                            <Button size="sm" className="flex-1 font-semibold" onClick={handleCreate} disabled={selectedPlatforms.size === 0}>
                                <Zap className="h-3.5 w-3.5 mr-1" />
                                {isSingleRow ? 'Generate & Edit' : `Create ${rows.length} Drafts`}
                            </Button>
                        </div>
                    </div>
                )}

                {/* GENERATING — single row */}
                {step === 'generating' && isSingleRow && (
                    <div className="py-10 flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="h-14 w-14 rounded-full border-2 border-primary/20 flex items-center justify-center">
                                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                            </div>
                            <Loader2 className="absolute inset-0 m-auto h-14 w-14 text-primary/30 animate-spin" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="font-semibold text-sm">Đang tạo nội dung…</p>
                            <p className="text-xs text-muted-foreground">{[...selectedPlatforms].map(p => PLATFORM_LABELS[p] || p).join(', ')}</p>
                        </div>
                    </div>
                )}

                {/* STARTING — batch mode */}
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
                            <span className="text-xs font-bold text-primary">{rows.length} posts</span>
                        </div>
                        <div className="space-y-1.5 px-2">
                            <p className="font-bold text-base">{t('integrations.aiPostCreator.startingTitle')}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {t('integrations.aiPostCreator.startingDesc').replace('{count}', String(rows.length))}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 border border-border/50 text-xs text-muted-foreground">
                            <span>{t('integrations.aiPostCreator.startingHint')}</span>
                            <span className="text-primary font-semibold">↗</span>
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-1" onClick={onClose}>
                            <X className="h-3.5 w-3.5 mr-1" />
                            {t('integrations.aiPostCreator.cancel')}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
