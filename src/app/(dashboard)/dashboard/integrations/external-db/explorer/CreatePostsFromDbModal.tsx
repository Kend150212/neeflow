'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Sparkles, X, ChevronRight, Loader2, Zap } from 'lucide-react'
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
    const [channels, setChannels] = useState<Channel[]>([])
    const [selectedChannel, setSelectedChannel] = useState('')
    const [tone, setTone] = useState('viral')
    const [platform, setPlatform] = useState('facebook')
    const [language, setLanguage] = useState('vi')
    const [creating, setCreating] = useState(false)
    const [step, setStep] = useState<'config' | 'preview' | 'done'>('config')
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

    // Build a text summary of a row for AI
    function rowToText(row: Record<string, unknown>): string {
        return columns
            .map(col => `${col}: ${row[col] ?? ''}`)
            .join(', ')
    }

    async function handleCreate() {
        if (!selectedChannel) { toast.error('Please select a channel'); return }
        setCreating(true)
        setStep('preview')

        let created = 0
        for (const row of rows) {
            try {
                const dataText = rowToText(row)
                const res = await fetch('/api/posts/generate-from-db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: selectedChannel,
                        dataText,
                        tableName,
                        tone,
                        platform,
                        language,
                    }),
                })
                if (res.ok) created++
            } catch {
                // skip failed row
            }
        }

        setCreatedCount(created)
        setStep('done')
        setCreating(false)
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
                        Generate posts from {rows.length} selected record{rows.length !== 1 ? 's' : ''} in <strong>{tableName}</strong>
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
                            <Button onClick={handleCreate} disabled={!selectedChannel} className="flex-1 gap-2">
                                <Zap className="h-4 w-4" />
                                Generate {rows.length} Post{rows.length !== 1 ? 's' : ''}
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="flex flex-col items-center gap-4 py-8 text-center">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            </div>
                        </div>
                        <div>
                            <p className="font-bold text-lg">Generating posts with AI...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Processing {rows.length} record{rows.length !== 1 ? 's' : ''}. This may take a moment.
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
                                Posts have been added to your draft queue.
                            </p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <Button variant="outline" onClick={onClose} className="flex-1">
                                Close
                            </Button>
                            <Button asChild className="flex-1">
                                <a href="/dashboard/posts">View Posts →</a>
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
