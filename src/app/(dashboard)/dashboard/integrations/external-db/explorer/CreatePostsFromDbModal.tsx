'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import { toast } from 'sonner'
import { Sparkles, X, Loader2, Zap, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Props {
    open: boolean
    onClose: () => void
    rows: Record<string, unknown>[]
    columns: string[]
    tableName: string
}

const PLATFORMS = [
    { value: 'facebook', label: 'Facebook', icon: '📘' },
    { value: 'instagram', label: 'Instagram', icon: '📸' },
    { value: 'twitter', label: 'X / Twitter', icon: '🐦' },
    { value: 'tiktok', label: 'TikTok', icon: '🎵' },
    { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { value: 'youtube', label: 'YouTube', icon: '▶️' },
]

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

    const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(['facebook', 'instagram']))
    const [tone, setTone] = useState('viral')
    const [language, setLanguage] = useState('vi')
    const [step, setStep] = useState<'config' | 'generating' | 'done'>('config')
    const [createdCount, setCreatedCount] = useState(0)

    // Reset when opened
    useEffect(() => {
        if (open) {
            setStep('config')
            setCreatedCount(0)
        }
    }, [open])

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
        // Use first selected platform for single row compose redirect
        const primaryPlatform = [...selectedPlatforms][0]

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
                        platforms: [...selectedPlatforms],  // send all selected platforms
                        language,
                        rowData: row,
                        columns,
                    }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error ?? 'Generation failed')

                const params = new URLSearchParams()
                // Pass per-platform content (not generic content)
                if (data.contentPerPlatform && Object.keys(data.contentPerPlatform).length > 0) {
                    params.set('platformContent', encodeURIComponent(JSON.stringify(data.contentPerPlatform)))
                }
                if (data.imageUrls?.length > 0) {
                    params.set('images', encodeURIComponent(JSON.stringify(data.imageUrls)))
                }
                onClose()
                router.push(`/dashboard/posts/compose?${params.toString()}`)
            } else {
                // Batch: create 1 draft per row (using primary platform)
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
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
            setStep('config')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-primary/10">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </span>
                        AI Post Creator
                    </DialogTitle>
                    <DialogDescription>
                        {rows.length === 1
                            ? <>Generate from <strong>1 record</strong> in <strong>{tableName}</strong> → Compose Editor</>
                            : <>Generate <strong>{rows.length} drafts</strong> from <strong>{tableName}</strong></>}
                    </DialogDescription>
                </DialogHeader>

                {step === 'config' && (
                    <div className="space-y-5 pt-1">

                        {/* Record chips */}
                        <div className="flex flex-wrap gap-1.5">
                            {rows.slice(0, 4).map((row, i) => {
                                const nameCol = columns.find(c => /name|title|product/i.test(c))
                                const label = nameCol ? String(row[nameCol] ?? '').slice(0, 28) : `Record ${i + 1}`
                                return <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">{label}</span>
                            })}
                            {rows.length > 4 && <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">+{rows.length - 4} more</span>}
                        </div>

                        {/* Single row hint */}
                        {rows.length === 1 && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                Sẽ mở Compose Editor với nội dung đã điền sẵn
                            </div>
                        )}

                        {/* Platform multi-select icons */}
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Platforms</p>
                            <div className="grid grid-cols-3 gap-2">
                                {PLATFORMS.map(p => {
                                    const active = selectedPlatforms.has(p.value)
                                    return (
                                        <button
                                            key={p.value}
                                            onClick={() => togglePlatform(p.value)}
                                            className={cn(
                                                'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all',
                                                active
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                                            )}
                                        >
                                            <span className="text-lg leading-none">{p.icon}</span>
                                            <span>{p.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">{selectedPlatforms.size} selected</p>
                        </div>

                        {/* Tone */}
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tone</p>
                            <div className="flex flex-wrap gap-2">
                                {TONES.map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setTone(t.value)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                                            tone === t.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/40'
                                        )}
                                    >{t.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Language */}
                        <div className="flex gap-2">
                            {[{ v: 'vi', l: '🇻🇳 Tiếng Việt' }, { v: 'en', l: '🇺🇸 English' }].map(({ v, l }) => (
                                <button
                                    key={v}
                                    onClick={() => setLanguage(v)}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg border text-sm font-medium transition-all',
                                        language === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                                    )}
                                >{l}</button>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-1">
                            <Button variant="outline" onClick={onClose} className="flex-1"><X className="h-4 w-4 mr-2" />Cancel</Button>
                            <Button onClick={handleCreate} className="flex-1 gap-2">
                                <Zap className="h-4 w-4" />
                                {rows.length === 1 ? 'Generate & Edit' : `Create ${rows.length} Drafts`}
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'generating' && (
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">Generating with AI...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {rows.length === 1 ? 'Almost done...' : `Processing ${rows.length} records...`}
                            </p>
                        </div>
                    </div>
                )}

                {step === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">{createdCount} draft{createdCount !== 1 ? 's' : ''} created!</p>
                            <p className="text-sm text-muted-foreground mt-1">Posts have been saved as drafts.</p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
                            <Button asChild className="flex-1"><a href="/dashboard/posts">View Drafts →</a></Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
