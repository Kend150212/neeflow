'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, X, ChevronRight, Loader2, Zap, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

interface Props {
    open: boolean
    onClose: () => void
    rows: Record<string, unknown>[]
    columns: string[]
    tableName: string
}

interface Channel {
    id: string
    displayName: string
}

const TONES = [
    { value: 'professional', label: '💼 Professional' },
    { value: 'casual', label: '😊 Casual & friendly' },
    { value: 'viral', label: '🚀 Viral / Hype' },
    { value: 'promotional', label: '🛍️ Promotional' },
    { value: 'storytelling', label: '📖 Storytelling' },
]

const PLATFORMS = [
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'twitter', label: 'Twitter / X' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'tiktok', label: 'TikTok' },
]

export default function CreatePostsFromDbModal({ open, onClose, rows, columns, tableName }: Props) {
    const router = useRouter()
    const [channels, setChannels] = useState<Channel[]>([])
    const [selectedChannel, setSelectedChannel] = useState('')
    const [tone, setTone] = useState('viral')
    const [platform, setPlatform] = useState('facebook')
    const [language, setLanguage] = useState('vi')
    const [creating, setCreating] = useState(false)
    const [step, setStep] = useState<'config' | 'generating' | 'done'>('config')
    const [createdCount, setCreatedCount] = useState(0)

    useEffect(() => {
        if (open) {
            fetch('/api/channels')
                .then(r => r.json())
                .then(data => {
                    setChannels(data.channels ?? data ?? [])
                    if (data.channels?.[0]) setSelectedChannel(data.channels[0].id)
                    else if (data[0]) setSelectedChannel(data[0].id)
                })
                .catch(() => { })
            setStep('config')
            setCreatedCount(0)
        }
    }, [open])

    // Build text summary of a row for AI
    function rowToText(row: Record<string, unknown>): string {
        return columns
            .map(col => `${col}: ${row[col] ?? ''}`)
            .join(', ')
    }

    async function handleCreate() {
        if (!selectedChannel) { toast.error('Please select a channel'); return }
        setCreating(true)
        setStep('generating')

        const isSingleRow = rows.length === 1

        try {
            if (isSingleRow) {
                // Single row → generate + redirect to compose with pre-filled content
                const row = rows[0]
                const res = await fetch('/api/posts/generate-from-db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: selectedChannel,
                        dataText: rowToText(row),
                        tableName,
                        tone,
                        platform,
                        language,
                        rowData: row,
                        columns,
                    }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error ?? 'Generation failed')

                // Build compose URL with pre-filled content + images
                const params = new URLSearchParams()
                params.set('content', encodeURIComponent(data.content))
                if (data.imageUrls?.length > 0) {
                    params.set('images', encodeURIComponent(JSON.stringify(data.imageUrls)))
                }
                onClose()
                router.push(`/dashboard/posts/compose?${params.toString()}`)
            } else {
                // Multiple rows → batch create drafts
                let created = 0
                for (const row of rows) {
                    try {
                        const res = await fetch('/api/posts/generate-from-db', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                channelId: selectedChannel,
                                dataText: rowToText(row),
                                tableName,
                                tone,
                                platform,
                                language,
                                rowData: row,
                                columns,
                            }),
                        })
                        if (res.ok) created++
                    } catch {
                        // skip failed row
                    }
                }
                setCreatedCount(created)
                setStep('done')
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed'
            toast.error(msg)
            setStep('config')
        } finally {
            setCreating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-primary/10">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </span>
                        AI Post Creator
                    </DialogTitle>
                    <DialogDescription>
                        {rows.length === 1
                            ? <>Generate a post from <strong>1 record</strong> in <strong>{tableName}</strong> → opens in Compose Editor</>
                            : <>Generate posts from <strong>{rows.length} records</strong> in <strong>{tableName}</strong> → saved as drafts</>
                        }
                    </DialogDescription>
                </DialogHeader>

                {step === 'config' && (
                    <div className="space-y-5 pt-2">

                        {/* Row preview chips */}
                        <div className="flex flex-wrap gap-2">
                            {rows.slice(0, 5).map((row, i) => {
                                const nameCol = columns.find(c => /name|title|product/i.test(c))
                                const label = nameCol ? String(row[nameCol] ?? '').slice(0, 30) : `Record ${i + 1}`
                                return (
                                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                                        {label}
                                    </span>
                                )
                            })}
                            {rows.length > 5 && (
                                <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                                    +{rows.length - 5} more
                                </span>
                            )}
                        </div>

                        {/* Single row info */}
                        {rows.length === 1 && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                Sẽ mở Compose Editor với nội dung đã điền sẵn để bạn chỉnh sửa trước khi đăng
                            </div>
                        )}

                        {/* Channel */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold">Post to Channel</label>
                            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select channel..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {channels.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.displayName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Platform + Tone */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold">Platform</label>
                                <Select value={platform} onValueChange={setPlatform}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLATFORMS.map(p => (
                                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold">Tone</label>
                                <Select value={tone} onValueChange={setTone}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TONES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Language */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold">Language</label>
                            <div className="flex gap-2">
                                {[{ v: 'vi', l: '🇻🇳 Tiếng Việt' }, { v: 'en', l: '🇺🇸 English' }].map(({ v, l }) => (
                                    <button
                                        key={v}
                                        onClick={() => setLanguage(v)}
                                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${language === v
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border text-muted-foreground hover:border-primary/40'
                                            }`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-1">
                            <Button variant="outline" onClick={onClose} className="flex-1">
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={!selectedChannel || creating} className="flex-1 gap-2">
                                <Zap className="h-4 w-4" />
                                {rows.length === 1 ? 'Generate & Open Editor' : `Generate ${rows.length} Drafts`}
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'generating' && (
                    <div className="flex flex-col items-center gap-4 py-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">Generating with AI...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {rows.length === 1
                                    ? 'Processing 1 record. Almost done...'
                                    : `Processing ${rows.length} records. This may take a moment.`
                                }
                            </p>
                        </div>
                    </div>
                )}

                {step === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">
                                {createdCount} post{createdCount !== 1 ? 's' : ''} created!
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Posts have been saved as drafts.
                            </p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <Button variant="outline" onClick={onClose} className="flex-1">
                                Close
                            </Button>
                            <Button asChild className="flex-1">
                                <a href="/dashboard/posts">View Drafts →</a>
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
