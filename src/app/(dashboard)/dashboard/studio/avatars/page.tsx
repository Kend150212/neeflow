'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    User, Plus, Loader2, Sparkles, ChevronLeft,
    CheckCircle2, AlertCircle, Trash2, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface StudioAvatar {
    id: string
    name: string
    description: string | null
    prompt: string
    style: string
    referenceImages: string[]
    coverImage: string | null
    status: string
    createdAt: string
}

const STYLES = [
    { value: 'realistic', label: 'Realistic', hint: 'Photorealistic, natural look' },
    { value: 'anime', label: 'Anime', hint: 'Japanese animation style' },
    { value: 'cartoon', label: 'Cartoon', hint: 'Fun, vibrant cartoon style' },
    { value: '3d', label: '3D Render', hint: 'Pixar / cinema 3D style' },
]

export default function StudioAvatarsPage() {
    const [avatars, setAvatars] = useState<StudioAvatar[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [selectedAvatar, setSelectedAvatar] = useState<StudioAvatar | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [prompt, setPrompt] = useState('')
    const [style, setStyle] = useState('realistic')
    const [numAngles, setNumAngles] = useState(4)
    const [creating, setCreating] = useState(false)

    useEffect(() => { fetchAvatars() }, [])

    async function fetchAvatars() {
        setLoading(true)
        try {
            const res = await fetch('/api/studio/avatars')
            if (res.ok) {
                const data = await res.json()
                setAvatars(data.avatars || [])
            }
        } finally {
            setLoading(false)
        }
    }

    async function createAvatar() {
        if (!name.trim() || !prompt.trim()) return
        setCreating(true)
        try {
            const res = await fetch('/api/studio/avatars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, prompt: prompt.trim(), style, numAngles }),
            })
            if (res.ok) {
                const data = await res.json()
                setAvatars(prev => [data.avatar, ...prev])
                setShowCreate(false)
                resetForm()
                toast.success('Avatar is being generated! This takes ~30 seconds.')
                // Poll for completion
                pollAvatarStatus(data.avatar.id)
            } else {
                toast.error('Failed to create avatar')
            }
        } finally {
            setCreating(false)
        }
    }

    async function pollAvatarStatus(id: string) {
        let attempts = 0
        const interval = setInterval(async () => {
            attempts++
            if (attempts > 60) { clearInterval(interval); return }
            try {
                const res = await fetch('/api/studio/avatars')
                if (res.ok) {
                    const data = await res.json()
                    const updated = data.avatars?.find((a: StudioAvatar) => a.id === id)
                    if (updated && updated.status !== 'generating') {
                        clearInterval(interval)
                        setAvatars(data.avatars || [])
                        if (updated.status === 'done') toast.success(`Avatar "${updated.name}" is ready!`)
                        else if (updated.status === 'failed') toast.error(`Avatar generation failed`)
                    }
                }
            } catch { }
        }, 5000)
    }

    async function deleteAvatar(id: string) {
        const res = await fetch(`/api/studio/avatars/${id}`, { method: 'DELETE' })
        if (res.ok) {
            setAvatars(prev => prev.filter(a => a.id !== id))
            if (selectedAvatar?.id === id) setSelectedAvatar(null)
            toast.success('Avatar deleted')
        }
    }

    function resetForm() {
        setName(''); setDescription(''); setPrompt(''); setStyle('realistic'); setNumAngles(4)
    }

    const statusIcon = (s: string) => {
        if (s === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        if (s === 'generating') return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
        if (s === 'failed') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
        return null
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#080d0b]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0, 255, 149, 0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }}>
            {/* Left: Avatar grid */}
            <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 px-8 py-5 border-b border-white/5 bg-[#080d0b]/90 backdrop-blur-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/studio">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">Avatars</h1>
                            <p className="text-slate-400 text-xs mt-0.5">Shared across all projects & channels</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={fetchAvatars} className="gap-2 text-slate-400 hover:text-white">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            className="gap-2 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold shadow-[0_0_20px_rgba(0,255,149,0.2)]"
                            onClick={() => setShowCreate(true)}
                        >
                            <Plus className="h-4 w-4" />
                            Create Avatar
                        </Button>
                    </div>
                </header>

                <div className="px-8 py-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                        </div>
                    ) : avatars.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                                <User className="h-8 w-8 text-emerald-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-bold mb-1">No avatars yet</p>
                                <p className="text-slate-400 text-sm max-w-xs">Create your first AI character to use as a reference in all your projects</p>
                            </div>
                            <Button
                                onClick={() => setShowCreate(true)}
                                className="gap-2 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold mt-2"
                            >
                                <Sparkles className="h-4 w-4" />
                                Create First Avatar
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                            {/* Add new card */}
                            <button
                                onClick={() => setShowCreate(true)}
                                className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-colors group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-emerald-400/10 transition-colors">
                                    <Plus className="h-5 w-5 text-slate-500 group-hover:text-emerald-400" />
                                </div>
                                <span className="text-xs text-slate-500 group-hover:text-emerald-400 transition-colors font-medium">New Avatar</span>
                            </button>

                            {avatars.map((av) => (
                                <button
                                    key={av.id}
                                    onClick={() => setSelectedAvatar(av)}
                                    className={cn(
                                        'aspect-[3/4] rounded-2xl overflow-hidden border relative group text-left transition-all',
                                        selectedAvatar?.id === av.id
                                            ? 'border-emerald-400 shadow-[0_0_20px_rgba(0,255,149,0.2)]'
                                            : 'border-white/10 hover:border-emerald-400/40'
                                    )}
                                >
                                    {av.coverImage ? (
                                        <img src={av.coverImage} alt={av.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-2">
                                            {av.status === 'generating'
                                                ? <><Loader2 className="h-6 w-6 text-emerald-400 animate-spin" /><span className="text-xs text-slate-500">Generating...</span></>
                                                : av.status === 'failed'
                                                    ? <><AlertCircle className="h-6 w-6 text-red-400" /><span className="text-xs text-red-400">Failed</span></>
                                                    : <User className="h-8 w-8 text-slate-700" />
                                            }
                                        </div>
                                    )}
                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                        <p className="text-white text-xs font-bold truncate">{av.name}</p>
                                        <p className="text-slate-400 text-[10px] capitalize">{av.style}</p>
                                    </div>
                                    {/* Status dot */}
                                    <div className="absolute top-2 right-2">
                                        {statusIcon(av.status)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Detail panel */}
            {selectedAvatar && (
                <aside className="w-80 border-l border-white/5 bg-[#0a120d] flex flex-col overflow-y-auto">
                    <div className="p-5 border-b border-white/5 flex items-start justify-between">
                        <div>
                            <h3 className="text-white font-bold">{selectedAvatar.name}</h3>
                            <p className="text-slate-400 text-xs capitalize mt-0.5">{selectedAvatar.style} style</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-400" onClick={() => deleteAvatar(selectedAvatar.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Reference Images ({selectedAvatar.referenceImages.length} angles)</p>
                            <div className="grid grid-cols-2 gap-2">
                                {selectedAvatar.referenceImages.length > 0
                                    ? selectedAvatar.referenceImages.map((url, i) => (
                                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10">
                                            <img src={url} alt={`angle-${i}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))
                                    : Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="aspect-square rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                            {selectedAvatar.status === 'generating'
                                                ? <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                                                : <User className="h-4 w-4 text-slate-700" />
                                            }
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Prompt</p>
                            <p className="text-xs text-slate-400 leading-relaxed">{selectedAvatar.prompt}</p>
                        </div>
                        {selectedAvatar.description && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Description</p>
                                <p className="text-xs text-slate-400">{selectedAvatar.description}</p>
                            </div>
                        )}
                    </div>
                </aside>
            )}

            {/* Create Avatar Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-lg bg-[#0f1a14] border-emerald-400/20">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-emerald-400" />
                            Create Avatar
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                        <div>
                            <Label className="text-slate-300 text-xs">Avatar Name *</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Linh — Brand Ambassador"
                                className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-400/40" />
                        </div>
                        <div>
                            <Label className="text-slate-300 text-xs">Prompt * <span className="text-slate-600 normal-case font-normal">— describe your character</span></Label>
                            <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
                                placeholder="A young Vietnamese woman, 25 years old, casual style, warm smile, modern fashion, holding products naturally..."
                                className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-400/40 resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-slate-300 text-xs">Art Style</Label>
                                <Select value={style} onValueChange={setStyle}>
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10 text-white focus:border-emerald-400/40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STYLES.map(s => (
                                            <SelectItem key={s.value} value={s.value}>
                                                <div>
                                                    <p className="font-medium">{s.label}</p>
                                                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-slate-300 text-xs">Angles to Generate</Label>
                                <Select value={String(numAngles)} onValueChange={v => setNumAngles(Number(v))}>
                                    <SelectTrigger className="mt-1.5 bg-white/5 border-white/10 text-white focus:border-emerald-400/40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2">2 angles (faster)</SelectItem>
                                        <SelectItem value="4">4 angles (recommended)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label className="text-slate-300 text-xs">Description <span className="text-slate-600">(optional)</span></Label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes about this avatar..."
                                className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-400/40" />
                        </div>
                        <div className="bg-emerald-400/5 border border-emerald-400/15 rounded-lg p-3 text-xs text-slate-400">
                            <p className="text-emerald-400 font-medium mb-1">💡 Tips for best results:</p>
                            <ul className="space-y-0.5 list-disc pl-4">
                                <li>Include ethnicity, age, hair color, clothing style</li>
                                <li>Mention what they'll be doing (holding product, smiling, etc.)</li>
                                <li>White background works best for later product compositing</li>
                            </ul>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm() }} className="text-slate-400">Cancel</Button>
                            <Button
                                onClick={createAvatar}
                                disabled={!name.trim() || !prompt.trim() || creating}
                                className="gap-2 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold"
                            >
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Generate Avatar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
