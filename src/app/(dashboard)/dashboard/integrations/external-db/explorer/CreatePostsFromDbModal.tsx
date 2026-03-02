'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import { toast } from 'sonner'
import { Sparkles, X, Loader2, Zap, ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Props {
    open: boolean
    onClose: () => void
    rows: Record<string, unknown>[]
    columns: string[]
    tableName: string
}

// SVG logos per platform
const PlatformLogo = ({ platform, size = 28 }: { platform: string; size?: number }) => {
    const logos: Record<string, JSX.Element> = {
        facebook: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#1877F2" />
                <path d="M16.5 8H14.5C14.2 8 14 8.2 14 8.5V10H16.5L16.1 12.5H14V19H11.5V12.5H9.5V10H11.5V8.5C11.5 6.8 12.8 5.5 14.5 5.5H16.5V8Z" fill="white" />
            </svg>
        ),
        instagram: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <defs>
                    <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FFDC80" />
                        <stop offset="25%" stopColor="#FCAF45" />
                        <stop offset="50%" stopColor="#F77737" />
                        <stop offset="75%" stopColor="#E1306C" />
                        <stop offset="100%" stopColor="#833AB4" />
                    </linearGradient>
                </defs>
                <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
                <rect x="6" y="6" width="12" height="12" rx="3.5" stroke="white" strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none" />
                <circle cx="16" cy="8" r="0.8" fill="white" />
            </svg>
        ),
        twitter: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#000" />
                <path d="M13.96 10.68L18.52 5.5H17.42L13.47 9.99L10.3 5.5H6.5L11.27 12.33L6.5 17.74H7.6L11.78 13.01L15.14 17.74H18.94L13.96 10.68ZM12.33 12.38L11.85 11.71L8 6.28H9.77L12.77 10.62L13.25 11.29L17.41 17.01H15.64L12.33 12.38Z" fill="white" />
            </svg>
        ),
        tiktok: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#010101" />
                <path d="M17.5 9.5a5.5 5.5 0 0 1-3.5-1.2V15a4 4 0 1 1-4-4v2a2 2 0 1 0 2 2V5.5h2a3.5 3.5 0 0 0 3.5 3.5v0.5z" fill="white" />
                <path d="M14 7.5a3.5 3.5 0 0 0 2.5 1.5v0.5a5.5 5.5 0 0 1-3.5-1.2" fill="#69C9D0" opacity="0.8" />
            </svg>
        ),
        linkedin: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#0A66C2" />
                <path d="M7.5 9H9.5V17H7.5V9ZM8.5 8C7.9 8 7.5 7.6 7.5 7C7.5 6.4 7.9 6 8.5 6C9.1 6 9.5 6.4 9.5 7C9.5 7.6 9.1 8 8.5 8ZM11 9H12.9V10C13.3 9.4 14 9 15 9C16.9 9 17.5 10.2 17.5 12V17H15.5V12.5C15.5 11.7 15.3 11 14.5 11C13.7 11 13 11.6 13 12.5V17H11V9Z" fill="white" />
            </svg>
        ),
        youtube: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#FF0000" />
                <path d="M19.5 8.5C19.5 8.5 19.3 7.3 18.7 6.7C17.9 5.9 17 5.9 16.6 5.8C14.5 5.7 12 5.7 12 5.7C12 5.7 9.5 5.7 7.4 5.8C7 5.9 6.1 5.9 5.3 6.7C4.7 7.3 4.5 8.5 4.5 8.5C4.5 8.5 4.3 9.9 4.3 11.3V12.6C4.3 14 4.5 15.4 4.5 15.4C4.5 15.4 4.7 16.6 5.3 17.2C6.1 18 7.1 17.9 7.6 18C9.1 18.2 12 18.2 12 18.2C12 18.2 14.5 18.2 16.6 18C17 17.9 17.9 17.9 18.7 17.1C19.3 16.5 19.5 15.3 19.5 15.3C19.5 15.3 19.7 13.9 19.7 12.5V11.2C19.7 9.8 19.5 8.5 19.5 8.5Z" fill="#FF0000" />
                <path d="M10.3 14.4V9.6L15.3 12L10.3 14.4Z" fill="white" />
            </svg>
        ),
    }
    return logos[platform] ?? (
        <div style={{ width: size, height: size }} className="rounded-md bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground">
            {platform.slice(0, 2)}
        </div>
    )
}

const PLATFORM_LABELS: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'X / Twitter',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
}

const TONES = [
    { value: 'viral', label: '🚀 Viral' },
    { value: 'promotional', label: '🛍️ Promo' },
    { value: 'casual', label: '😊 Casual' },
    { value: 'professional', label: '💼 Pro' },
    { value: 'storytelling', label: '📖 Story' },
]

export default function CreatePostsFromDbModal({ open, onClose, rows, columns, tableName }: Props) {
    const router = useRouter()
    const { activeChannelId } = useWorkspace()

    const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([])
    const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
    const [tone, setTone] = useState('viral')
    const [language, setLanguage] = useState('vi')
    const [step, setStep] = useState<'config' | 'generating' | 'done'>('config')
    const [createdCount, setCreatedCount] = useState(0)

    // Reset and fetch channel platforms when modal opens
    useEffect(() => {
        if (!open || !activeChannelId) return
        setStep('config')
        setCreatedCount(0)

        // Fetch platforms connected to this channel
        fetch('/api/admin/channels')
            .then(r => r.json())
            .then((data: any[]) => {
                const channel = data.find((c: any) => c.id === activeChannelId)
                if (channel?.platforms) {
                    // Get unique platform types that have active accounts
                    const plats = [...new Set(
                        channel.platforms
                            .filter((p: any) => p.isActive !== false)
                            .map((p: any) => (p.platform as string).toLowerCase())
                    )] as string[]
                    setAvailablePlatforms(plats.length > 0 ? plats : ['facebook', 'instagram'])
                    // Default: select all available
                    setSelectedPlatforms(new Set(plats))
                }
            })
            .catch(() => {
                setAvailablePlatforms(['facebook', 'instagram', 'tiktok'])
                setSelectedPlatforms(new Set(['facebook', 'instagram']))
            })
    }, [open, activeChannelId])

    function togglePlatform(p: string) {
        setSelectedPlatforms(prev => {
            const next = new Set(prev)
            if (next.has(p)) {
                if (next.size === 1) return prev // keep at least 1
                next.delete(p)
            } else {
                next.add(p)
            }
            return next
        })
    }

    function rowToText(row: Record<string, unknown>): string {
        return columns.map(col => `${col}: ${row[col] ?? ''}`).join(', ')
    }

    async function handleCreate() {
        if (!activeChannelId) { toast.error('No workspace channel selected'); return }
        if (selectedPlatforms.size === 0) { toast.error('Select at least one platform'); return }

        setStep('generating')

        const isSingleRow = rows.length === 1

        try {
            if (isSingleRow) {
                const row = rows[0]
                const res = await fetch('/api/posts/generate-from-db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: activeChannelId,
                        dataText: rowToText(row),
                        tableName,
                        tone,
                        platforms: [...selectedPlatforms],
                        language,
                        rowData: row,
                        columns,
                    }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error ?? 'Generation failed')

                const params = new URLSearchParams()
                if (data.contentPerPlatform && Object.keys(data.contentPerPlatform).length > 0) {
                    params.set('platformContent', encodeURIComponent(JSON.stringify(data.contentPerPlatform)))
                }
                if (data.imageUrls?.length > 0) {
                    params.set('images', encodeURIComponent(JSON.stringify(data.imageUrls)))
                }
                onClose()
                router.push(`/dashboard/posts/compose?${params.toString()}`)
            } else {
                // Batch: create 1 draft per row
                let created = 0
                for (const row of rows) {
                    try {
                        const res = await fetch('/api/posts/generate-from-db', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                channelId: activeChannelId,
                                dataText: rowToText(row),
                                tableName,
                                tone,
                                platforms: [...selectedPlatforms],
                                language,
                                rowData: row,
                                columns,
                            }),
                        })
                        if (res.ok) created++
                    } catch { /* skip */ }
                }
                setCreatedCount(created)
                setStep('done')
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to generate'
            toast.error(msg)
            setStep('config')
        }
    }

    const isSingleRow = rows.length === 1

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md bg-background/95 backdrop-blur border border-border/60 shadow-2xl">
                <DialogHeader className="pb-1">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Post Creator
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Generate from <strong>{rows.length} record{rows.length > 1 ? 's' : ''}</strong> in <strong>{tableName}</strong>
                        {isSingleRow && ' → Compose Editor'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'config' && (
                    <div className="space-y-5 pt-1">
                        {/* Channel badge */}
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
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Loading platforms...
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {availablePlatforms.map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => togglePlatform(p)}
                                            className={cn(
                                                'relative flex flex-col items-center gap-2 px-3 py-3 rounded-xl border transition-all text-xs font-medium',
                                                selectedPlatforms.has(p)
                                                    ? 'border-primary bg-primary/10 text-primary shadow-[0_0_0_1px] shadow-primary'
                                                    : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:bg-card'
                                            )}
                                        >
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
                                {TONES.map(t => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => setTone(t.value)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-xs border transition-all',
                                            tone === t.value
                                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                                : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground'
                                        )}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* LANGUAGE */}
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { value: 'vi', label: '🇻🇳 Tiếng Việt' },
                                { value: 'en', label: '🇺🇸 English' },
                            ].map(l => (
                                <button
                                    key={l.value}
                                    type="button"
                                    onClick={() => setLanguage(l.value)}
                                    className={cn(
                                        'py-2 rounded-xl text-xs border transition-all font-medium',
                                        language === l.value
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground'
                                    )}
                                >
                                    {l.label}
                                </button>
                            ))}
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

                {step === 'generating' && (
                    <div className="py-10 flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="h-14 w-14 rounded-full border-2 border-primary/20 flex items-center justify-center">
                                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                            </div>
                            <Loader2 className="absolute inset-0 m-auto h-14 w-14 text-primary/30 animate-spin" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="font-semibold text-sm">Generating platform content…</p>
                            <p className="text-xs text-muted-foreground">
                                Creating {selectedPlatforms.size} version{selectedPlatforms.size > 1 ? 's' : ''} for{' '}
                                {[...selectedPlatforms].map(p => PLATFORM_LABELS[p] || p).join(', ')}
                            </p>
                        </div>
                    </div>
                )}

                {step === 'done' && (
                    <div className="py-8 flex flex-col items-center gap-4 text-center">
                        <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Check className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <p className="font-semibold">{createdCount} drafts created!</p>
                            <p className="text-xs text-muted-foreground mt-1">Check your Posts page to review &amp; publish.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
                            <Button size="sm" onClick={() => router.push('/dashboard/posts')}>View Drafts</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
