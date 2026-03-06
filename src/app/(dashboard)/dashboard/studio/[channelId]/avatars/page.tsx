'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
    User, Plus, Loader2, Sparkles, ChevronLeft,
    CheckCircle2, AlertCircle, Trash2, RefreshCw, ImagePlus, X, ZoomIn
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    _shared?: boolean
}

const STYLES = [
    { value: 'realistic', label: 'Realistic', hint: 'Photorealistic, natural look' },
    { value: 'anime', label: 'Anime', hint: 'Japanese animation style' },
    { value: 'cartoon', label: 'Cartoon', hint: 'Fun, vibrant cartoon style' },
    { value: '3d', label: '3D Render', hint: 'Pixar / cinema 3D style' },
]

// Full model lists for each provider
const GEN_PROVIDERS = [
    {
        value: 'fal_ai', label: 'Fal.ai',
        models: [
            { value: 'fal-ai/flux/schnell', label: 'FLUX Schnell (fastest)' },
            { value: 'fal-ai/flux/dev', label: 'FLUX Dev (quality)' },
            { value: 'fal-ai/flux-pro', label: 'FLUX Pro' },
            { value: 'fal-ai/flux-pro/v1.1', label: 'FLUX Pro v1.1' },
            { value: 'fal-ai/flux-realism', label: 'FLUX Realism' },
            { value: 'fal-ai/flux-lora', label: 'FLUX LoRA' },
            { value: 'fal-ai/stable-diffusion-v3-medium', label: 'Stable Diffusion 3 Medium' },
            { value: 'fal-ai/stable-diffusion-xl', label: 'SDXL' },
            { value: 'fal-ai/aura-flow', label: 'AuraFlow' },
            { value: 'fal-ai/kolors', label: 'Kolors (Kwai)' },
            { value: 'fal-ai/pixart-sigma', label: 'PixArt Sigma' },
            { value: 'fal-ai/ideogram/v2', label: 'Ideogram v2' },
            { value: 'fal-ai/recraft-v3', label: 'Recraft v3' },
        ],
    },
    {
        value: 'runware', label: 'Runware',
        models: [
            { value: 'runware:100@1', label: 'Runware Fast FLUX' },
            { value: 'runware:101@1', label: 'Runware FLUX Dev' },
            { value: 'civitai:4201@501240', label: 'DreamShaper XL' },
            { value: 'civitai:36520@76907', label: 'DREAMIX' },
            { value: 'civitai:133005@782002', label: 'Realistic Vision v6' },
            { value: 'civitai:43331@176425', label: 'AbsoluteReality v1.8.1' },
            { value: 'civitai:25694@143906', label: 'Counterfeit-V3.0 (anime)' },
            { value: 'civitai:7240@46846', label: 'ChilloutMix' },
        ],
    },
    {
        value: 'openai', label: 'OpenAI Images',
        models: [
            { value: 'gpt-image-1', label: 'GPT Image 1 (newest)' },
            { value: 'dall-e-3', label: 'DALL-E 3 (1792×1024)' },
            { value: 'dall-e-2', label: 'DALL-E 2 (1024×1024)' },
        ],
    },
    {
        value: 'gemini', label: 'Gemini Imagen',
        models: [
            // ── Gemini native image gen (generateContent API) ──
            { value: 'gemini-3.1-flash-image-preview', label: '⚡ Flash 2 (Banana 2) — mới nhất 2026' },
            { value: 'gemini-3-pro-image-preview', label: '✨ Banana Pro — chất lượng studio' },
            { value: 'gemini-2.5-flash-image', label: '⚡ Banana (Flash 1.5) — nhanh & ổn định' },
            { value: 'gemini-2.0-flash-preview-image-generation', label: '⚡ Flash 1 — thế hệ đầu' },
            // ── Imagen 4 (predict API) ──
            { value: 'imagen-4.0-ultra-generate-001', label: '🏆 Imagen 4 Ultra — đỉnh nhất, 2K' },
            { value: 'imagen-4.0-generate-001', label: '🎨 Imagen 4 — tiêu chuẩn 2025' },
            { value: 'imagen-4.0-fast-generate-001', label: '🚀 Imagen 4 Fast — nhanh, số lượng lớn' },
            // ── Imagen 3 ──
            { value: 'imagen-3.0-generate-001', label: '🎨 Imagen 3 — ổn định, phổ biến' },
            { value: 'imagen-3.0-fast-generate-001', label: '🚀 Imagen 3 Fast' },
            // ── Legacy ──
            { value: 'imagen-2.0-generate-001', label: '📷 Imagen 2 — thế hệ cũ' },
        ],
    },
]

export default function ChannelAvatarsPage() {
    const { channelId } = useParams<{ channelId: string }>()
    const [avatars, setAvatars] = useState<StudioAvatar[]>([])
    const [sharedAvatars, setSharedAvatars] = useState<StudioAvatar[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [selectedAvatar, setSelectedAvatar] = useState<StudioAvatar | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [prompt, setPrompt] = useState('')
    const [style, setStyle] = useState('realistic')
    const [creating, setCreating] = useState(false)
    const [generating, setGenerating] = useState<string | null>(null)

    // AI provider picker state (now inline in panel)
    const [genProvider, setGenProvider] = useState('fal_ai')
    const [genModel, setGenModel] = useState('fal-ai/flux/schnell')

    // Reference image upload
    const refInputRef = useRef<HTMLInputElement>(null)
    const [uploadingRef, setUploadingRef] = useState(false)

    // Cover image upload (manual external photo)
    const coverInputRef = useRef<HTMLInputElement>(null)
    const [uploadingCover, setUploadingCover] = useState(false)

    // Lightbox
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

    // 2-phase generation: 'preview' = 1 front-view, 'full' = all angles
    const [genPhase, setGenPhase] = useState<Record<string, 'preview' | 'approved' | null>>({})

    // Save edits state (right panel is editable)
    const [saving, setSaving] = useState(false)
    const [editName, setEditName] = useState('')
    const [editPrompt, setEditPrompt] = useState('')
    const [editStyle, setEditStyle] = useState('realistic')
    const [editDescription, setEditDescription] = useState('')

    // Structured prompt builder (HO SO NHAN VAT system)
    const [builderMode, setBuilderMode] = useState(false) // false = free text, true = structured
    const [bGender, setBGender] = useState('')
    const [bAge, setBAge] = useState('')
    const [bSkin, setBSkin] = useState('')
    const [bBody, setBBody] = useState('')
    const [bFace, setBFace] = useState('')
    const [bHair, setBHair] = useState('')
    const [bOutfit, setBOutfit] = useState('')
    const [bVibe, setBVibe] = useState('')
    const [bNote, setBNote] = useState('')

    useEffect(() => { fetchAvatars() }, [channelId])

    // Sync edit fields when selectedAvatar changes
    useEffect(() => {
        if (selectedAvatar && !selectedAvatar._shared) {
            setEditName(selectedAvatar.name)
            setEditPrompt(selectedAvatar.prompt)
            setEditStyle(selectedAvatar.style)
            setEditDescription(selectedAvatar.description || '')
        }
    }, [selectedAvatar?.id])

    // keep genModel in sync when provider changes
    useEffect(() => {
        const firstModel = GEN_PROVIDERS.find(p => p.value === genProvider)?.models[0]?.value
        if (firstModel) setGenModel(firstModel)
    }, [genProvider])

    async function fetchAvatars() {
        setLoading(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars`)
            if (res.ok) {
                const data = await res.json()
                const allFetched: StudioAvatar[] = data.avatars || []
                setAvatars(allFetched)
                setSharedAvatars(data.sharedAvatars || [])
                // sync selectedAvatar so new image shows up in panel
                setSelectedAvatar(prev => prev ? (allFetched.find(a => a.id === prev.id) ?? prev) : null)
                return allFetched
            }
        } finally {
            setLoading(false)
        }
        return []
    }

    async function createAvatar() {
        if (!name.trim() || !prompt.trim()) return
        setCreating(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, prompt: prompt.trim(), style }),
            })
            if (res.ok) {
                const data = await res.json()
                const newAvatar = data.avatar
                setAvatars(prev => [newAvatar, ...prev])
                setSelectedAvatar(newAvatar)
                setEditName(newAvatar.name)
                setEditPrompt(newAvatar.prompt)
                setEditStyle(newAvatar.style)
                setEditDescription(newAvatar.description || '')
                setShowCreate(false)
                resetForm()
                toast.success('Avatar created! Select a provider and click Generate.')
            } else {
                const d = await res.json()
                toast.error(d.error || 'Failed to create avatar')
            }
        } finally {
            setCreating(false)
        }
    }

    async function saveAvatar() {
        if (!selectedAvatar || !editName.trim() || !editPrompt.trim()) return
        setSaving(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selectedAvatar.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName.trim(),
                    prompt: editPrompt.trim(),
                    style: editStyle,
                    description: editDescription.trim() || undefined,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                const updated = data.avatar as StudioAvatar
                setSelectedAvatar(prev => prev ? { ...prev, ...updated } : null)
                setAvatars(prev => prev.map(a => a.id === selectedAvatar.id ? { ...a, ...updated } : a))
                toast.success('✅ Avatar saved!')
            } else {
                const d = await res.json()
                toast.error(d.error || 'Failed to save')
            }
        } finally {
            setSaving(false)
        }
    }

    // phase: 'preview' = generate 1 front-view first, 'full' = generate all angles with reference
    async function generateAvatar(avatar: StudioAvatar, phase: 'preview' | 'full' = 'preview', referenceImage?: string) {
        setGenerating(avatar.id)
        const label = phase === 'preview' ? 'Tạo ảnh xem trước...' : 'Tạo toàn bộ góc nhìn...'
        const toastId = toast.loading(`${label} "${avatar.name}"`)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${avatar.id}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: genProvider,
                    model: genModel,
                    // Phase 1: single front view. Phase 2: all 4 angles
                    numAngles: phase === 'preview' ? 1 : 4,
                    referenceImage: referenceImage || undefined,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                if (data.status === 'done') {
                    toast.success(`✅ Xong! "${avatar.name}"`, { id: toastId })
                    const latest = await fetchAvatars()
                    if (phase === 'preview') {
                        setGenPhase(prev => ({ ...prev, [avatar.id]: 'preview' }))
                    } else {
                        setGenPhase(prev => ({ ...prev, [avatar.id]: null }))
                    }
                } else {
                    toast.success('⏳ Đang tạo... (~30 giây)', { id: toastId })
                    setAvatars(prev => prev.map(a => a.id === avatar.id ? { ...a, status: 'generating' } : a))
                    if (selectedAvatar?.id === avatar.id) {
                        setSelectedAvatar(prev => prev ? { ...prev, status: 'generating' } : null)
                    }
                    if (phase === 'preview') {
                        setGenPhase(prev => ({ ...prev, [avatar.id]: 'preview' }))
                    }
                    pollAvatarStatus(avatar.id, phase)
                }
            } else {
                const d = await res.json()
                toast.error(`❌ ${d.error || 'Failed to start generation'}`, { id: toastId })
            }
        } catch (err) {
            toast.error(`❌ Network error: ${err instanceof Error ? err.message : String(err)}`, { id: toastId })
        } finally {
            setGenerating(null)
        }
    }

    async function pollAvatarStatus(id: string, phase: 'preview' | 'full' = 'preview') {
        let attempts = 0
        const interval = setInterval(async () => {
            attempts++
            if (attempts > 120) { // 5 min timeout at 2.5s interval
                clearInterval(interval)
                toast.error('Generation timed out. Please try again.')
                return
            }
            try {
                // Poll individual avatar — much faster than fetching the whole list
                const res = await fetch(`/api/studio/channels/${channelId}/avatars/${id}`)
                if (!res.ok) return
                const data = await res.json()
                const updated: StudioAvatar = data.avatar
                if (!updated) return
                if (updated.status !== 'generating') {
                    clearInterval(interval)
                    // Update avatar in list and panel immediately
                    setAvatars(prev => prev.map(a => a.id === id ? updated : a))
                    setSelectedAvatar(prev => prev?.id === id ? updated : prev)
                    if (updated.status === 'idle' || updated.status === 'done') {
                        if (phase === 'preview') {
                            toast.success(`✅ Ảnh xem trước sẵn sàng! Xem và approve để tạo toàn bộ góc nhìn.`)
                            setGenPhase(prev => ({ ...prev, [id]: 'preview' }))
                        } else {
                            toast.success(`✅ Avatar "${updated.name}" đã tạo xong tất cả góc nhìn!`)
                            setGenPhase(prev => ({ ...prev, [id]: null }))
                        }
                    } else if (updated.status === 'failed') {
                        toast.error(`❌ Avatar "${updated.name}" generation failed. Check your API key.`)
                    }
                }
            } catch { }
        }, 2500) // poll every 2.5s instead of 5s
    }

    async function deleteAvatar(id: string) {
        const res = await fetch(`/api/studio/channels/${channelId}/avatars/${id}`, { method: 'DELETE' })
        if (res.ok) {
            setAvatars(prev => prev.filter(a => a.id !== id))
            if (selectedAvatar?.id === id) setSelectedAvatar(null)
            toast.success('Avatar deleted')
        }
    }

    // Upload reference image to R2 / API
    async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !selectedAvatar) return
        setUploadingCover(true)
        const toastId = toast.loading('Uploading cover image...')
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch(
                `/api/studio/channels/${channelId}/avatars/${selectedAvatar.id}/cover`,
                { method: 'POST', body: formData }
            )
            if (res.ok) {
                const data = await res.json()
                const updatedAvatar = { ...selectedAvatar, coverImage: data.coverImage, status: 'idle' }
                setSelectedAvatar(updatedAvatar)
                setAvatars(prev => prev.map(a => a.id === selectedAvatar.id ? updatedAvatar : a))
                toast.success('✅ Cover image uploaded!', { id: toastId })
            } else {
                const d = await res.json()
                toast.error(`❌ ${d.error || 'Upload failed'}`, { id: toastId })
            }
        } catch (err) {
            toast.error(`❌ Network error: ${err instanceof Error ? err.message : String(err)}`, { id: toastId })
        } finally {
            setUploadingCover(false)
            if (coverInputRef.current) coverInputRef.current.value = ''
        }
    }

    async function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !selectedAvatar) return
        if (selectedAvatar.referenceImages?.length >= 4) {
            toast.error('Maximum 4 reference images')
            return
        }
        setUploadingRef(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch(
                `/api/studio/channels/${channelId}/avatars/${selectedAvatar.id}/reference-images`,
                { method: 'POST', body: formData }
            )
            if (res.ok) {
                const data = await res.json()
                const updatedAvatar = { ...selectedAvatar, referenceImages: data.referenceImages }
                setSelectedAvatar(updatedAvatar)
                setAvatars(prev => prev.map(a => a.id === selectedAvatar.id ? updatedAvatar : a))
                toast.success('Reference image uploaded')
            } else {
                const d = await res.json()
                toast.error(d.error || 'Upload failed')
            }
        } finally {
            setUploadingRef(false)
            if (refInputRef.current) refInputRef.current.value = ''
        }
    }

    async function removeRefImage(idx: number) {
        if (!selectedAvatar) return
        const res = await fetch(
            `/api/studio/channels/${channelId}/avatars/${selectedAvatar.id}/reference-images`,
            {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: idx }),
            }
        )
        if (res.ok) {
            const data = await res.json()
            const updatedAvatar = { ...selectedAvatar, referenceImages: data.referenceImages }
            setSelectedAvatar(updatedAvatar)
            setAvatars(prev => prev.map(a => a.id === selectedAvatar.id ? updatedAvatar : a))
        }
    }

    function resetForm() {
        setName(''); setDescription(''); setPrompt(''); setStyle('realistic')
        setBGender(''); setBAge(''); setBSkin(''); setBBody(''); setBFace(''); setBHair(''); setBOutfit(''); setBVibe(''); setBNote('')
        setBuilderMode(false)
    }

    function buildPromptFromFields() {
        const parts = [
            bGender && bAge ? `${bGender}, ${bAge} tuổi` : (bGender || ''),
            bSkin && `da ${bSkin}`,
            bBody && `vóc dáng ${bBody}`,
            bFace && `khuôn mặt: ${bFace}`,
            bHair && `tóc: ${bHair}`,
            bOutfit && `trang phục: ${bOutfit}`,
            bVibe && `vibe: ${bVibe}`,
            bNote && `ghi chú: ${bNote}`,
        ].filter(Boolean).join(', ')
        return parts + ', character is 18+ years old'
    }

    const statusIcon = (s: string) => {
        if (s === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        if (s === 'generating') return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
        if (s === 'failed') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
        return null
    }

    const allAvatars = [...avatars, ...sharedAvatars]
    const currentProviderModels = GEN_PROVIDERS.find(p => p.value === genProvider)?.models || []

    return (
        <div className="flex h-screen overflow-hidden bg-[#080d0b]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0, 255, 149, 0.04) 1px, transparent 0)', backgroundSize: '32px 32px' }}>
            {/* Left: Avatar grid */}
            <div className="flex-1 flex flex-col overflow-y-auto">
                <header className="sticky top-0 z-10 px-8 py-5 border-b border-white/5 bg-[#080d0b]/90 backdrop-blur-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/dashboard/studio/${channelId}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">Avatars</h1>
                            <p className="text-slate-400 text-xs mt-0.5">Channel-scoped AI characters</p>
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
                    ) : allAvatars.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                                <User className="h-8 w-8 text-emerald-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-bold mb-1">No avatars yet</p>
                                <p className="text-slate-400 text-sm max-w-xs">Create your first AI character to use as a reference in projects</p>
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
                        <div className="space-y-6">
                            <div>
                                {sharedAvatars.length > 0 && (
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">This Channel</p>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
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
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                                <p className="text-white text-xs font-bold truncate">{av.name}</p>
                                                <p className="text-slate-400 text-[10px] capitalize">{av.style}</p>
                                            </div>
                                            <div className="absolute top-2 right-2">{statusIcon(av.status)}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {sharedAvatars.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Shared with this Channel</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {sharedAvatars.map((av) => (
                                            <button
                                                key={av.id}
                                                onClick={() => setSelectedAvatar(av)}
                                                className={cn(
                                                    'aspect-[3/4] rounded-2xl overflow-hidden border relative group text-left transition-all',
                                                    selectedAvatar?.id === av.id
                                                        ? 'border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                                                        : 'border-white/10 hover:border-violet-400/40'
                                                )}
                                            >
                                                {av.coverImage ? (
                                                    <img src={av.coverImage} alt={av.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                                        <User className="h-8 w-8 text-slate-700" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                                    <p className="text-white text-xs font-bold truncate">{av.name}</p>
                                                    <p className="text-violet-400 text-[10px]">Shared</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Detail panel */}
            {selectedAvatar && (
                <aside className="w-80 border-l border-white/5 bg-[#0a120d] flex flex-col overflow-y-auto">
                    {/* Header */}
                    <div className="p-5 border-b border-white/5 flex items-start justify-between">
                        <div className="flex-1 mr-2">
                            {!selectedAvatar._shared ? (
                                <input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="bg-transparent text-white font-bold text-base w-full focus:outline-none focus:border-b focus:border-emerald-400/50 pb-0.5 border-b border-transparent transition-colors"
                                    placeholder="Avatar name..."
                                />
                            ) : (
                                <h3 className="text-white font-bold">{selectedAvatar.name}</h3>
                            )}
                            <p className="text-slate-400 text-xs capitalize mt-0.5">{selectedAvatar.style} style</p>
                            {selectedAvatar._shared && (
                                <span className="text-[10px] text-violet-400 font-medium">Shared avatar</span>
                            )}
                        </div>
                        {!selectedAvatar._shared && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-400" onClick={() => deleteAvatar(selectedAvatar.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    <div className="p-5 space-y-5 flex-1">

                        {/* ── AI Generation ── */}
                        {!selectedAvatar._shared && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AI Generation</p>

                                {/* Provider selector */}
                                <div className="grid grid-cols-2 gap-1.5">
                                    {GEN_PROVIDERS.map(p => (
                                        <button
                                            key={p.value}
                                            onClick={() => setGenProvider(p.value)}
                                            className={cn(
                                                'py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border',
                                                genProvider === p.value
                                                    ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30'
                                                    : 'bg-white/5 text-slate-500 border-white/5 hover:text-slate-300 hover:border-white/15'
                                            )}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Model selector */}
                                <Select value={genModel} onValueChange={setGenModel}>
                                    <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white">
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-64 overflow-y-auto">
                                        {currentProviderModels.map(m => (
                                            <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Generate button */}
                                <Button
                                    className="w-full gap-2 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold h-8 text-xs shadow-[0_0_16px_rgba(0,255,149,0.15)]"
                                    onClick={() => generateAvatar(selectedAvatar, 'preview')}
                                    disabled={!!generating || selectedAvatar.status === 'generating'}
                                >
                                    {generating === selectedAvatar.id
                                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo...</>
                                        : <><Sparkles className="h-3.5 w-3.5" /> Tạo ảnh xem trước (1 góc)</>
                                    }
                                </Button>
                                <p className="text-[10px] text-slate-600 text-center">
                                    Key from Dashboard → API Keys
                                </p>
                            </div>
                        )}

                        {/* ── Reference Images ── */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reference Images</p>
                                {!selectedAvatar._shared && (
                                    <>
                                        <input
                                            ref={refInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleRefUpload}
                                        />
                                        <button
                                            onClick={() => refInputRef.current?.click()}
                                            disabled={uploadingRef || (selectedAvatar.referenceImages?.length >= 4)}
                                            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
                                        >
                                            {uploadingRef
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <ImagePlus className="h-3 w-3" />
                                            }
                                            Upload ({selectedAvatar.referenceImages?.length || 0}/4)
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {/* Uploaded images */}
                                {(selectedAvatar.referenceImages || []).map((url, i) => (
                                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10 relative group">
                                        <img src={url} alt={`ref-${i}`} className="w-full h-full object-cover" />
                                        {!selectedAvatar._shared && (
                                            <button
                                                onClick={() => removeRefImage(i)}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                                            >
                                                <X className="h-3 w-3 text-white" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Empty slots */}
                                {Array.from({ length: Math.max(0, 4 - (selectedAvatar.referenceImages?.length || 0)) }).map((_, i) => (
                                    <button
                                        key={`empty-${i}`}
                                        onClick={() => !selectedAvatar._shared && refInputRef.current?.click()}
                                        disabled={uploadingRef || selectedAvatar._shared}
                                        className={cn(
                                            'aspect-square rounded-lg bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center gap-1 transition-colors',
                                            !selectedAvatar._shared && 'hover:border-emerald-400/30 hover:bg-emerald-400/5 cursor-pointer',
                                        )}
                                    >
                                        {uploadingRef && i === 0
                                            ? <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                                            : <>
                                                <ImagePlus className="h-4 w-4 text-slate-700" />
                                                <span className="text-[9px] text-slate-700">Add photo</span>
                                            </>
                                        }
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1.5">Upload reference photos to guide the AI style</p>
                        </div>

                        {/* ── Generated Image ── */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avatar Image</p>
                                {!selectedAvatar._shared && (
                                    <>
                                        <input
                                            ref={coverInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleCoverUpload}
                                        />
                                        <button
                                            onClick={() => coverInputRef.current?.click()}
                                            disabled={uploadingCover || selectedAvatar.status === 'generating'}
                                            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
                                        >
                                            {uploadingCover
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <ImagePlus className="h-3 w-3" />
                                            }
                                            Upload Photo
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="rounded-xl overflow-hidden border border-white/10 relative">
                                {selectedAvatar.coverImage ? (
                                    <button
                                        className="w-full block cursor-zoom-in group relative"
                                        onClick={() => setLightboxUrl(selectedAvatar.coverImage!)}
                                        title="Click để phóng to"
                                    >
                                        <img src={selectedAvatar.coverImage} alt="avatar" className="w-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                        </div>
                                    </button>
                                ) : (
                                    <div className="w-full aspect-video bg-white/5 flex flex-col items-center justify-center gap-2">
                                        {selectedAvatar.status === 'generating' ? null : (
                                            <>
                                                <Sparkles className="h-6 w-6 text-slate-700" />
                                                <span className="text-[11px] text-slate-600">Generate or upload a photo</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {/* Overlay while generating */}
                                {selectedAvatar.status === 'generating' && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="h-7 w-7 text-emerald-400 animate-spin" />
                                        <span className="text-xs text-emerald-400 font-medium">Đang tạo...</span>
                                    </div>
                                )}
                                {/* Overlay while uploading cover */}
                                {uploadingCover && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="h-7 w-7 text-sky-400 animate-spin" />
                                        <span className="text-xs text-sky-400 font-medium">Uploading...</span>
                                    </div>
                                )}
                            </div>

                            {/* ── Phase 1 approve/reject bar ── */}
                            {!selectedAvatar._shared && selectedAvatar.coverImage && genPhase[selectedAvatar.id] === 'preview' && selectedAvatar.status !== 'generating' && (
                                <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 space-y-2">
                                    <p className="text-[11px] text-emerald-300 font-medium text-center">Ảnh xem trước — hài lòng chưa?</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setGenPhase(prev => ({ ...prev, [selectedAvatar.id!]: null }))
                                                generateAvatar(selectedAvatar, 'preview')
                                            }}
                                            disabled={!!generating}
                                            className="flex-1 h-8 rounded-lg border border-white/10 text-[11px] text-slate-400 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <RefreshCw className="h-3 w-3" /> Thử lại
                                        </button>
                                        <button
                                            onClick={() => {
                                                setGenPhase(prev => ({ ...prev, [selectedAvatar.id!]: 'approved' }))
                                                generateAvatar(selectedAvatar, 'full', selectedAvatar.coverImage!)
                                            }}
                                            disabled={!!generating}
                                            className="flex-1 h-8 rounded-lg bg-emerald-400 text-[#080d0b] text-[11px] font-bold hover:bg-emerald-300 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle2 className="h-3 w-3" /> Approve & 4 góc nhìn
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-600 text-center">AI sẽ tạo Front, Side, Back, 3/4 đồng bộ từ ảnh này</p>
                                </div>
                            )}
                        </div>



                        {/* ── Prompt ── */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Prompt</p>
                            {!selectedAvatar._shared ? (
                                <>
                                    <textarea
                                        value={editPrompt}
                                        onChange={e => setEditPrompt(e.target.value)}
                                        rows={5}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-slate-300 resize-none focus:outline-none focus:border-emerald-400/40 leading-relaxed"
                                        placeholder="Describe your character in detail..."
                                    />
                                    <div className="mt-2 space-y-1.5">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Art Style</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {STYLES.map(s => (
                                                <button
                                                    key={s.value}
                                                    onClick={() => setEditStyle(s.value)}
                                                    className={cn(
                                                        'py-1.5 px-2 rounded-lg text-xs font-medium transition-all border text-left',
                                                        editStyle === s.value
                                                            ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30'
                                                            : 'bg-white/5 text-slate-500 border-white/5 hover:text-slate-300'
                                                    )}
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Notes</p>
                                        <input
                                            value={editDescription}
                                            onChange={e => setEditDescription(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-400/40"
                                            placeholder="Internal notes about this avatar..."
                                        />
                                    </div>
                                    <button
                                        onClick={saveAvatar}
                                        disabled={saving || editName === selectedAvatar.name && editPrompt === selectedAvatar.prompt && editStyle === selectedAvatar.style && editDescription === (selectedAvatar.description || '')}
                                        className="mt-3 w-full h-8 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-400/20 text-xs font-bold hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                        Save Changes
                                    </button>
                                </>
                            ) : (
                                <p className="text-xs text-slate-400 leading-relaxed">{selectedAvatar.prompt}</p>
                            )}
                        </div>

                        {selectedAvatar.description && selectedAvatar._shared && (
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
                <DialogContent className="sm:max-w-xl bg-[#0f1a14] border-emerald-400/20 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-emerald-400" />
                            Create Avatar
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                        {/* Name */}
                        <div>
                            <Label className="text-slate-300 text-xs">Avatar Name *</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Linh — Brand Ambassador"
                                className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-400/40" />
                        </div>

                        {/* Mode toggle */}
                        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                            <button
                                onClick={() => { setBuilderMode(false) }}
                                className={cn('flex-1 py-1.5 rounded-md text-xs font-semibold transition-all', !builderMode ? 'bg-emerald-400/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300')}
                            >✍️ Free Text</button>
                            <button
                                onClick={() => { setBuilderMode(true) }}
                                className={cn('flex-1 py-1.5 rounded-md text-xs font-semibold transition-all', builderMode ? 'bg-emerald-400/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300')}
                            >🧬 Structured Builder</button>
                        </div>

                        {builderMode ? (
                            /* ── Structured HO SO NHAN VAT builder ── */
                            <div className="space-y-3">
                                <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3">
                                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-2.5">🧬 Hồ Sơ Nhân Vật [HO SO NHAN VAT]</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">Giới tính</label>
                                            <Input value={bGender} onChange={e => setBGender(e.target.value)} placeholder="Nữ / Nam / Phi nhị nguyên"
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">Tuổi</label>
                                            <Input value={bAge} onChange={e => setBAge(e.target.value)} placeholder="25"
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">Màu da</label>
                                            <Input value={bSkin} onChange={e => setBSkin(e.target.value)} placeholder="trắng hồng / olive / nâu"
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">Vóc dáng</label>
                                            <Input value={bBody} onChange={e => setBBody(e.target.value)} placeholder="thon gọn / cao ráo / đậm người"
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] text-slate-500 block mb-1">Khuôn mặt</label>
                                            <Input value={bFace} onChange={e => setBFace(e.target.value)} placeholder="mắt to tròn, mũi cao, môi trái tim..."
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] text-slate-500 block mb-1">Kiểu tóc</label>
                                            <Input value={bHair} onChange={e => setBHair(e.target.value)} placeholder="dài uốn nhẹ, màu nâu hạt dẻ..."
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] text-slate-500 block mb-1">Trang phục</label>
                                            <Input value={bOutfit} onChange={e => setBOutfit(e.target.value)} placeholder="áo crop top trắng, quần jean xanh..."
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">Vibe / Ánh sáng</label>
                                            <Input value={bVibe} onChange={e => setBVibe(e.target.value)} placeholder="casual, natural light"
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">Ghi chú thêm</label>
                                            <Input value={bNote} onChange={e => setBNote(e.target.value)} placeholder="cầm sản phẩm, mỉm cười..."
                                                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-700" />
                                        </div>
                                    </div>
                                    {/* Live preview */}
                                    {(bGender || bSkin || bOutfit) && (
                                        <div className="mt-3 rounded-lg bg-black/30 p-2.5">
                                            <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Generated Prompt Preview</p>
                                            <p className="text-[10px] text-slate-400 leading-relaxed">{buildPromptFromFields()}</p>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => { setPrompt(buildPromptFromFields()); setBuilderMode(false) }}
                                        disabled={!bGender && !bOutfit}
                                        className="mt-3 w-full h-8 rounded-lg bg-emerald-400/15 text-emerald-400 border border-emerald-400/20 text-xs font-bold hover:bg-emerald-400/25 disabled:opacity-40 transition-colors"
                                    >
                                        ✅ Dùng prompt này →
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── Free text mode ── */
                            <div>
                                <Label className="text-slate-300 text-xs">Prompt * <span className="text-slate-600 normal-case font-normal">— describe your character</span></Label>
                                <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                                    placeholder="Nhân vật nữ, 25 tuổi, da trắng hồng, vóc dáng thon gọn, mắt to tròn, tóc nâu uốn nhẹ, áo crop top trắng, quần jean cạp cao, vibe casual..."
                                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-400/40 resize-none" />
                            </div>
                        )}

                        {/* Style + Notes */}
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
                                <Label className="text-slate-300 text-xs">Notes <span className="text-slate-600">(optional)</span></Label>
                                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal notes..."
                                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-400/40" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm() }} className="text-slate-400">Cancel</Button>
                            <Button
                                onClick={createAvatar}
                                disabled={!name.trim() || !prompt.trim() || creating}
                                className="gap-2 bg-emerald-400 text-[#080d0b] hover:bg-emerald-300 font-bold"
                            >
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Create
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Lightbox Modal ── */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setLightboxUrl(null)}
                    onKeyDown={e => e.key === 'Escape' && setLightboxUrl(null)}
                >
                    <button
                        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt="Avatar preview"
                        className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    )
}
