'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Loader2, Sparkles, Trash2, ImagePlus, X, ZoomIn, FolderOpen, Upload, Search, ChevronRight, MoreHorizontal, Shirt, Glasses, Package } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/* ─── Types ─── */
interface PoseImage { url: string; label?: string; prompt?: string; createdAt?: string }
interface AvatarPose { id: string; name: string; images: PoseImage[]; createdAt: string }
interface AssetImage { url: string; label?: string; createdAt?: string }
interface AvatarAsset { id: string; type: 'outfit' | 'accessory' | 'prop'; name: string; images: AssetImage[]; prompt?: string }
interface StudioAvatar {
    id: string; name: string; description: string | null; prompt: string; style: string
    referenceImages: string[]; poseImages: string[]; coverImage: string | null; status: string; createdAt: string
    poses?: AvatarPose[]; assets?: AvatarAsset[]; _shared?: boolean
}

const STYLES = [
    { value: 'realistic', label: 'Realistic' }, { value: 'anime', label: 'Anime' },
    { value: 'cartoon', label: 'Cartoon' }, { value: '3d', label: '3D Render' },
]
const GEN_PROVIDERS = [
    {
        value: 'fal_ai', label: 'Fal.ai', models: [
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
        ]
    },
    {
        value: 'runware', label: 'Runware', models: [
            { value: 'runware:100@1', label: 'Runware Fast FLUX' },
            { value: 'runware:101@1', label: 'Runware FLUX Dev' },
            { value: 'civitai:4201@501240', label: 'DreamShaper XL' },
            { value: 'civitai:36520@76907', label: 'DREAMIX' },
            { value: 'civitai:133005@782002', label: 'Realistic Vision v6' },
            { value: 'civitai:43331@176425', label: 'AbsoluteReality v1.8.1' },
            { value: 'civitai:25694@143906', label: 'Counterfeit-V3.0 (anime)' },
            { value: 'civitai:7240@46846', label: 'ChilloutMix' },
        ]
    },
    {
        value: 'openai', label: 'OpenAI', models: [
            { value: 'gpt-image-1', label: 'GPT Image 1 (newest)' },
            { value: 'dall-e-3', label: 'DALL-E 3 (1792×1024)' },
            { value: 'dall-e-2', label: 'DALL-E 2 (1024×1024)' },
        ]
    },
    {
        value: 'gemini', label: 'Gemini', models: [
            { value: 'gemini-3.1-flash-image-preview', label: '⚡ Banana 2 (Flash 2) — mới nhất 2026' },
            { value: 'gemini-3-pro-image-preview', label: '✨ Banana Pro — chất lượng studio' },
            { value: 'gemini-2.5-flash-image', label: '⚡ Banana (Flash 1.5) — nhanh & ổn định' },
            { value: 'gemini-2.0-flash-preview-image-generation', label: '⚡ Flash 1 — thế hệ đầu' },
            { value: 'imagen-4.0-ultra-generate-001', label: '🏆 Imagen 4 Ultra — đỉnh nhất, 2K' },
            { value: 'imagen-4.0-generate-001', label: '🎨 Imagen 4 — tiêu chuẩn 2025' },
            { value: 'imagen-4.0-fast-generate-001', label: '🚀 Imagen 4 Fast — nhanh, số lượng lớn' },
            { value: 'imagen-3.0-generate-001', label: '🎨 Imagen 3 — ổn định, phổ biến' },
            { value: 'imagen-3.0-fast-generate-001', label: '🚀 Imagen 3 Fast' },
        ]
    },
]

const ASSET_TYPES = [
    { value: 'outfit', label: 'Outfit', icon: Shirt, color: 'text-violet-400' },
    { value: 'accessory', label: 'Phụ kiện', icon: Glasses, color: 'text-cyan-400' },
    { value: 'prop', label: 'Props', icon: Package, color: 'text-amber-400' },
]
const ANGLE_LABELS = [
    'Chính diện bán thân',       // 0 — full body front
    'Cận mặt',                   // 1 — face close-up
    'Chính diện cận bán thân',   // 2 — close upper body front
    'Nghiêng trái',              // 3 — side profile
    '3/4 sau',                   // 4 — 3/4 rear angle
    'Sau lưng',                  // 5 — full back view
]

/* ─── Lightbox ─── */
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center" onClick={onClose}>
            <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={onClose}><X size={28} /></button>
            <img src={url} className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" alt="lightbox" onClick={e => e.stopPropagation()} />
        </div>
    )
}

/* ─── Main Page ─── */
export default function ChannelAvatarsPage() {
    const { channelId } = useParams<{ channelId: string }>()

    // Avatar list
    const [avatars, setAvatars] = useState<StudioAvatar[]>([])
    const [sharedAvatars, setSharedAvatars] = useState<StudioAvatar[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    // Selected avatar + detail
    const [selected, setSelected] = useState<StudioAvatar | null>(null)

    // Create avatar dialog
    const [showCreate, setShowCreate] = useState(false)
    const [cName, setCName] = useState(''); const [cPrompt, setCPrompt] = useState('')
    const [cStyle, setCStyle] = useState('realistic'); const [cDesc, setCDesc] = useState('')
    const [creating, setCreating] = useState(false)

    // Generation
    const [generating, setGenerating] = useState<string | null>(null)
    const [generatingAngle, setGeneratingAngle] = useState<number | null>(null)
    const [genProvider, setGenProvider] = useState('gemini')
    const [genModel, setGenModel] = useState('gemini-3.1-flash-image-preview')
    const [genPhase, setGenPhase] = useState<Record<string, 'preview' | 'approved' | null>>({})

    // Lightbox
    const [lightbox, setLightbox] = useState<string | null>(null)

    // Asset manager
    const [assetTab, setAssetTab] = useState<'outfit' | 'accessory' | 'prop'>('outfit')
    const [showAddAsset, setShowAddAsset] = useState(false)
    const [assetName, setAssetName] = useState(''); const [assetType, setAssetType] = useState<'outfit' | 'accessory' | 'prop'>('outfit')
    const [assetPrompt, setAssetPrompt] = useState('')
    const [creatingAsset, setCreatingAsset] = useState(false)
    const [uploadingAsset, setUploadingAsset] = useState<string | null>(null)
    const assetFileRefs = useRef<Record<string, HTMLInputElement | null>>({})

    // Pose manager
    const [showAddPose, setShowAddPose] = useState(false)
    const [poseName, setPoseName] = useState(''); const [creatingPose, setCreatingPose] = useState(false)
    const [openPose, setOpenPose] = useState<AvatarPose | null>(null)
    const [uploadingPose, setUploadingPose] = useState(false)
    const poseFileRef = useRef<HTMLInputElement>(null)
    const refCoverRef = useRef<HTMLInputElement>(null)
    const [uploadingRef, setUploadingRef] = useState(false)

    // Edit fields (right panel when shared is false)
    const [editName, setEditName] = useState(''); const [editPrompt, setEditPrompt] = useState('')
    const [editStyle, setEditStyle] = useState('realistic'); const [saving, setSaving] = useState(false)

    useEffect(() => { fetchAvatars() }, [channelId])
    useEffect(() => {
        if (selected && !selected._shared) {
            setEditName(selected.name); setEditPrompt(selected.prompt); setEditStyle(selected.style)
        }
    }, [selected?.id])
    useEffect(() => {
        const first = GEN_PROVIDERS.find(p => p.value === genProvider)?.models[0]?.value
        if (first) setGenModel(first)
    }, [genProvider])

    /* ─── API helpers ─── */
    async function fetchAvatars() {
        setLoading(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars`)
            if (res.ok) {
                const data = await res.json()
                const all: StudioAvatar[] = data.avatars || []
                setAvatars(all); setSharedAvatars(data.sharedAvatars || [])
                setSelected(prev => prev ? (all.find(a => a.id === prev.id) ?? prev) : null)
            }
        } finally { setLoading(false) }
    }

    async function fetchAvatarDetail(id: string) {
        const res = await fetch(`/api/studio/channels/${channelId}/avatars/${id}`)
        if (res.ok) {
            const data = await res.json()
            const av = data.avatar as StudioAvatar
            setSelected(av)
            setAvatars(prev => prev.map(a => a.id === id ? { ...a, ...av } : a))
        }
    }

    async function selectAvatar(av: StudioAvatar) {
        setSelected(av)
        // fetch full detail with poses + assets
        await fetchAvatarDetail(av.id)
    }

    async function createAvatar() {
        if (!cName.trim() || !cPrompt.trim()) return
        setCreating(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: cName.trim(), prompt: cPrompt.trim(), style: cStyle, description: cDesc.trim() || undefined }),
            })
            if (res.ok) {
                const data = await res.json(); const nw = data.avatar
                setAvatars(prev => [nw, ...prev]); setSelected(nw)
                setShowCreate(false); setCName(''); setCPrompt(''); setCDesc('')
                toast.success('Avatar created!')
            } else { const d = await res.json(); toast.error(d.error || 'Failed') }
        } finally { setCreating(false) }
    }

    async function saveAvatar() {
        if (!selected || !editName.trim()) return
        setSaving(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, prompt: editPrompt, style: editStyle }),
            })
            if (res.ok) {
                const data = await res.json(); const up = data.avatar
                setSelected(prev => prev ? { ...prev, ...up } : null)
                setAvatars(prev => prev.map(a => a.id === selected.id ? { ...a, ...up } : a))
                toast.success('Saved!')
            }
        } finally { setSaving(false) }
    }

    async function deleteAvatar(id: string) {
        const res = await fetch(`/api/studio/channels/${channelId}/avatars/${id}`, { method: 'DELETE' })
        if (res.ok) { setAvatars(prev => prev.filter(a => a.id !== id)); if (selected?.id === id) setSelected(null); toast.success('Deleted') }
    }

    async function generateAvatar(avatar: StudioAvatar) {
        setGenerating(avatar.id)
        const toastId = toast.loading(`Đang tạo reference sheet “${avatar.name}” (5 góc nhìn)...`)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${avatar.id}/generate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: genProvider, model: genModel, numAngles: 5 }),
            })
            if (res.ok) {
                const data = await res.json()
                if (data.status === 'done') {
                    toast.success('✅ 6 góc nhìn đã hoàn thành!', { id: toastId })
                    await fetchAvatarDetail(avatar.id)
                } else {
                    toast.success('⏳ Đang tạo 6 ảnh riêng biệt... Poll sẽ cập nhật từng góc', { id: toastId })
                    setAvatars(prev => prev.map(a => a.id === avatar.id ? { ...a, status: 'generating' } : a))
                    if (selected?.id === avatar.id) setSelected(prev => prev ? { ...prev, status: 'generating' } : null)
                    pollAvatarStatus(avatar.id)
                }
            } else { const d = await res.json(); toast.error(d.error || 'Failed', { id: toastId }) }
        } catch (err) { toast.error(`Network error: ${err instanceof Error ? err.message : String(err)}`, { id: toastId }) }
        finally { setGenerating(null) }
    }

    async function pollAvatarStatus(id: string) {
        let attempts = 0
        const interval = setInterval(async () => {
            attempts++
            if (attempts > 120) { clearInterval(interval); toast.error('Generation timed out.'); return }
            try {
                const res = await fetch(`/api/studio/channels/${channelId}/avatars/${id}`)
                if (!res.ok) return
                const data = await res.json(); const updated: StudioAvatar = data.avatar
                if (!updated) return
                if (updated.status !== 'generating') {
                    clearInterval(interval)
                    setAvatars(prev => prev.map(a => a.id === id ? updated : a))
                    setSelected(prev => prev?.id === id ? updated : prev)
                    if (updated.status === 'idle' || updated.status === 'done') {
                        toast.success('✅ Reference sheet (5 góc) đã xong!')
                    } else if (updated.status === 'failed') { toast.error('❌ Generation failed.') }
                }
            } catch { }
        }, 2500)
    }

    async function generateAngle(avatar: StudioAvatar, angleIndex: number, extraPrompt: string) {
        setGeneratingAngle(angleIndex)
        const label = ANGLE_LABELS[angleIndex] || `Góc ${angleIndex}`
        const toastId = toast.loading(`Đang tạo ${label}...`)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${avatar.id}/generate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: genProvider, model: genModel,
                    angleIndex,
                    anglePrompt: extraPrompt || undefined,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                toast.success(`✅ ${label} đang xử lý...`, { id: toastId })
                if (data.status === 'done') { await fetchAvatarDetail(avatar.id) }
                else { pollAvatarStatus(avatar.id) }
            } else { const d = await res.json(); toast.error(d.error || 'Failed', { id: toastId }) }
        } catch (err) { toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`, { id: toastId }) }
        finally { setGeneratingAngle(null) }
    }

    async function uploadRefImage(e: React.ChangeEvent<HTMLInputElement>) {
        if (!selected || !e.target.files?.[0]) return
        setUploadingRef(true)
        try {
            const fd = new FormData(); fd.append('file', e.target.files[0])
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/reference-images`, { method: 'POST', body: fd })
            if (res.ok) { const data = await res.json(); const up = data.avatar as StudioAvatar; setSelected(prev => prev ? { ...prev, ...up } : null); setAvatars(prev => prev.map(a => a.id === selected.id ? { ...a, ...up } : a)) }
            else toast.error('Upload failed')
        } finally { setUploadingRef(false); e.target.value = '' }
    }

    /* ── Asset helpers ── */
    async function createAsset() {
        if (!selected || !assetName.trim()) return
        setCreatingAsset(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/assets`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: assetName, type: assetType, prompt: assetPrompt }),
            })
            if (res.ok) {
                const data = await res.json()
                const newAsset = data.asset as AvatarAsset
                setSelected(prev => prev ? { ...prev, assets: [...(prev.assets || []), newAsset] } : null)
                setShowAddAsset(false); setAssetName(''); setAssetPrompt(''); toast.success('Asset created!')
            }
        } finally { setCreatingAsset(false) }
    }

    async function uploadAssetImages(assetId: string, files: FileList) {
        if (!selected) return
        setUploadingAsset(assetId)
        try {
            const fd = new FormData()
            Array.from(files).forEach(f => fd.append('file', f))
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/assets/${assetId}/upload`, { method: 'POST', body: fd })
            if (res.ok) {
                const data = await res.json(); const up = data.asset as AvatarAsset
                setSelected(prev => prev ? { ...prev, assets: prev.assets?.map(a => a.id === assetId ? up : a) } : null)
                toast.success(`${Array.from(files).length} ảnh đã upload`)
            } else toast.error('Upload failed')
        } finally { setUploadingAsset(null) }
    }

    async function deleteAsset(assetId: string) {
        if (!selected) return
        const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/assets/${assetId}`, { method: 'DELETE' })
        if (res.ok) { setSelected(prev => prev ? { ...prev, assets: prev.assets?.filter(a => a.id !== assetId) } : null); toast.success('Deleted') }
    }

    async function deleteAssetImage(assetId: string, url: string) {
        if (!selected) return
        const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/assets/${assetId}/upload`, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
        })
        if (res.ok) {
            const data = await res.json(); const up = data.asset as AvatarAsset
            setSelected(prev => prev ? { ...prev, assets: prev.assets?.map(a => a.id === assetId ? up : a) } : null)
        }
    }

    /* ── Pose helpers ── */
    async function createPose() {
        if (!selected || !poseName.trim()) return
        setCreatingPose(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/poses`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: poseName }),
            })
            if (res.ok) {
                const data = await res.json(); const np = data.pose as AvatarPose
                setSelected(prev => prev ? { ...prev, poses: [...(prev.poses || []), np] } : null)
                setShowAddPose(false); setPoseName(''); toast.success('Pose folder created!')
            }
        } finally { setCreatingPose(false) }
    }

    async function deletePose(poseId: string) {
        if (!selected) return
        const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/poses/${poseId}`, { method: 'DELETE' })
        if (res.ok) {
            setSelected(prev => prev ? { ...prev, poses: prev.poses?.filter(p => p.id !== poseId) } : null)
            if (openPose?.id === poseId) setOpenPose(null)
        }
    }

    async function uploadPoseImages(files: FileList) {
        if (!selected || !openPose) return
        setUploadingPose(true)
        try {
            const fd = new FormData()
            Array.from(files).forEach(f => fd.append('file', f))
            const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/poses/${openPose.id}/upload`, { method: 'POST', body: fd })
            if (res.ok) {
                const data = await res.json(); const up = data.pose as AvatarPose
                setOpenPose(up)
                setSelected(prev => prev ? { ...prev, poses: prev.poses?.map(p => p.id === openPose.id ? up : p) } : null)
                toast.success(`${Array.from(files).length} ảnh đã upload`)
            }
        } finally { setUploadingPose(false) }
    }

    async function deletePoseImage(url: string) {
        if (!selected || !openPose) return
        const res = await fetch(`/api/studio/channels/${channelId}/avatars/${selected.id}/poses/${openPose.id}/delete-image`, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
        })
        if (res.ok) {
            const data = await res.json(); const up = data.pose as AvatarPose
            setOpenPose(up)
            setSelected(prev => prev ? { ...prev, poses: prev.poses?.map(p => p.id === openPose.id ? up : p) } : null)
        }
    }

    /* ─── Filtered lists ─── */
    const filteredAvatars = [...avatars, ...sharedAvatars].filter(a =>
        search ? a.name.toLowerCase().includes(search.toLowerCase()) : true
    )
    const selectedAssets = selected?.assets?.filter(a => a.type === assetTab) || []

    /* ─── Render ─── */
    return (
        <div className="flex h-screen overflow-hidden bg-[#050807]">

            {/* ══ LEFT SIDEBAR — Avatar List ══ */}
            <aside className="w-64 flex-shrink-0 border-r border-white/5 bg-[#0a0f0d] flex flex-col">
                <div className="p-4 border-b border-white/5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em]">Characters</h2>
                        <button onClick={() => setShowCreate(true)} className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-all">
                            <Plus size={12} />
                        </button>
                    </div>
                    <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search characters..." className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-7 pr-3 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-emerald-500/50 transition-all" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-emerald-500" /></div>
                    ) : filteredAvatars.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-xs text-slate-500 mb-3">No avatars yet</p>
                            <button onClick={() => setShowCreate(true)} className="text-xs text-emerald-400 hover:underline">+ Create first avatar</button>
                        </div>
                    ) : filteredAvatars.map(av => (
                        <button key={av.id} onClick={() => selectAvatar(av)}
                            className={cn('w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all group',
                                selected?.id === av.id ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/5 border border-transparent'
                            )}>
                            <div className={cn('w-10 h-10 rounded-lg bg-slate-800 border overflow-hidden flex-shrink-0 transition-all',
                                selected?.id === av.id ? 'border-emerald-500/40' : 'border-white/10 grayscale group-hover:grayscale-0'
                            )}>
                                {av.coverImage ? <img src={av.coverImage} alt={av.name} className="w-full h-full object-cover" /> :
                                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">{av.name[0]}</div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={cn('text-xs font-bold truncate', selected?.id === av.id ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors')}>{av.name}</p>
                                <p className={cn('text-[10px] uppercase tracking-widest font-bold mt-0.5',
                                    av.status === 'generating' ? 'text-amber-400' : selected?.id === av.id ? 'text-emerald-400' : 'text-slate-600'
                                )}>{av._shared ? 'Shared' : av.status}</p>
                            </div>
                            {av.status === 'generating' && <Loader2 size={12} className="animate-spin text-amber-400 flex-shrink-0" />}
                        </button>
                    ))}
                </div>

                <div className="p-3 border-t border-white/5">
                    <button onClick={() => setShowCreate(true)} className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold hover:bg-emerald-500/5 transition-all">
                        <Plus size={12} /> New Character
                    </button>
                </div>
            </aside>

            {/* ══ CENTER — Character Workspace ══ */}
            <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
                {!selected ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                <Sparkles size={24} className="text-emerald-400" />
                            </div>
                            <p className="text-slate-400 text-sm">Select a character to view details</p>
                            <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-emerald-500 text-black text-xs font-bold rounded-xl hover:bg-emerald-400 transition-all">
                                + Create First Avatar
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#050807]/90 backdrop-blur-md">
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h2 className="text-lg font-black text-white tracking-tight">{selected.name}</h2>
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">{selected.style}</span>
                                    {selected._shared && <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[10px] font-bold uppercase">Shared</span>}
                                </div>
                                <p className="text-slate-500 text-xs">{selected.description || selected.prompt.slice(0, 80)}</p>
                            </div>
                            <div className="flex gap-2">
                                {!selected._shared && (
                                    <>
                                        <select value={genProvider} onChange={e => setGenProvider(e.target.value)} className="bg-white/5 border border-white/10 text-xs text-slate-300 rounded-lg px-2 py-1.5 outline-none">
                                            {GEN_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                        <select value={genModel} onChange={e => setGenModel(e.target.value)} className="bg-white/5 border border-white/10 text-xs text-slate-300 rounded-lg px-2 py-1.5 outline-none max-w-[180px] truncate">
                                            {GEN_PROVIDERS.find(p => p.value === genProvider)?.models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                        <button onClick={() => generateAvatar(selected)}
                                            disabled={!!generating} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-all">
                                            {generating === selected.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            Tạo 6 góc nhìn
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">

                            {/* ── Section 1: Consistency Check ── */}
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Consistency Check</h3>
                                    <div className="flex gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                        <span>Ảnh gốc (trái)</span>
                                        <span>AI Generated (phải)</span>
                                    </div>
                                </div>
                                <div className="relative aspect-[21/9] rounded-2xl overflow-hidden border border-white/10 bg-slate-900">
                                    <div className="flex h-full">
                                        {/* Left: reference (first ref image or placeholder) */}
                                        <div className="w-1/2 h-full relative group">
                                            {selected.referenceImages?.[0] ? (
                                                <>
                                                    <img src={selected.referenceImages[0]} className="w-full h-full object-cover opacity-80" alt="Reference" />
                                                    <button onClick={() => setLightbox(selected.referenceImages[0])} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/30">
                                                        <ZoomIn size={24} className="text-white" />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={() => refCoverRef.current?.click()}>
                                                    <Upload size={20} className="text-slate-600" />
                                                    <p className="text-[10px] text-slate-600">Upload reference image</p>
                                                    {uploadingRef && <Loader2 size={14} className="animate-spin text-emerald-400" />}
                                                </div>
                                            )}
                                            <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/80 backdrop-blur-md rounded text-[10px] font-bold uppercase border border-white/10">Reference</div>
                                        </div>
                                        {/* Divider */}
                                        <div className="relative w-px bg-emerald-500 shadow-[0_0_15px_rgba(0,255,149,0.5)]">
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#050807]">
                                                <ChevronRight size={12} className="text-black" />
                                            </div>
                                        </div>
                                        {/* Right: latest generated */}
                                        <div className="w-1/2 h-full relative group">
                                            {selected.coverImage ? (
                                                <>
                                                    <img src={selected.coverImage} className="w-full h-full object-cover" alt="Generated" />
                                                    <button onClick={() => setLightbox(selected.coverImage!)} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/30">
                                                        <ZoomIn size={24} className="text-white" />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <p className="text-[10px] text-slate-600 uppercase">No generated image yet</p>
                                                </div>
                                            )}
                                            {selected.coverImage && <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-emerald-500/20 backdrop-blur-md rounded text-emerald-400 text-[10px] font-bold uppercase border border-emerald-500/30">AI Generated</div>}
                                        </div>
                                    </div>
                                </div>
                                <input ref={refCoverRef} type="file" accept="image/*" className="hidden" onChange={uploadRefImage} />
                            </section>

                            {/* ── Section 2: Pose Matrix ── */}
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Pose Matrix — 6 Góc Nhìn</h3>
                                        <p className="text-[9px] text-slate-600 mt-0.5">{(selected.poseImages || []).filter(Boolean).length}/6 góc đã tạo</p>
                                    </div>
                                    {!selected._shared && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => generateAvatar(selected)}
                                                disabled={!!generating}
                                                className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
                                            >
                                                {generating === selected.id ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
                                                Generate All
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {/* 3×2 grid — exactly like the reference photo example */}
                                <div className="grid grid-cols-3 gap-3">
                                    {ANGLE_LABELS.map((label, i) => {
                                        const poseImgs: string[] = selected.poseImages || []
                                        const url = poseImgs[i] || ''
                                        return (
                                            <PoseMatrixSlot
                                                key={label}
                                                label={label}
                                                url={url}
                                                isShared={!!selected._shared}
                                                generatingAngle={generatingAngle}
                                                angleIndex={i}
                                                onZoom={() => url && setLightbox(url)}
                                                onUpload={uploadRefImage}
                                                onGenerate={(prompt) => generateAngle(selected, i, prompt)}
                                            />
                                        )
                                    })}
                                </div>
                            </section>

                            {/* ── Section 3: Custom Poses ── */}
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Custom Poses</h3>
                                    {!selected._shared && (
                                        <button onClick={() => setShowAddPose(true)} className="flex items-center gap-1 text-[10px] text-emerald-400 hover:underline">
                                            <Plus size={10} /> New pose folder
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {(selected.poses || []).length === 0 && (
                                        <div className="flex-shrink-0 w-32 h-40 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-600 cursor-pointer hover:border-emerald-500/30 hover:text-emerald-400 transition-all" onClick={() => setShowAddPose(true)}>
                                            <FolderOpen size={20} />
                                            <p className="text-[10px] text-center px-2">Create pose folder</p>
                                        </div>
                                    )}
                                    {(selected.poses || []).map(pose => (
                                        <div key={pose.id} className="flex-shrink-0 w-32 group cursor-pointer" onClick={() => setOpenPose(pose)}>
                                            <div className="w-full h-40 bg-[#0d1411] border border-white/5 rounded-xl overflow-hidden relative hover:border-emerald-500/40 transition-all">
                                                {pose.images[0] ? (
                                                    <img src={pose.images[0].url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={pose.name} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center"><FolderOpen size={20} className="text-slate-700" /></div>
                                                )}
                                                {pose.images.length > 1 && (
                                                    <div className="absolute top-2 right-2 bg-black/80 rounded px-1.5 py-0.5 text-[10px] text-white font-bold">+{pose.images.length}</div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-2">
                                                    <p className="text-[10px] font-bold text-white truncate">{pose.name}</p>
                                                    <p className="text-[9px] text-slate-400">{pose.images.length} ảnh</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                        </div>
                    </>
                )}
            </main>

            {/* ══ RIGHT — Asset Manager ══ */}
            <aside className="w-72 flex-shrink-0 border-l border-white/5 bg-[#0a0f0d] flex flex-col">
                <div className="p-4 border-b border-white/5">
                    <h3 className="text-sm font-bold text-white mb-3">Asset Manager</h3>
                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        {ASSET_TYPES.map(t => (
                            <button key={t.value} onClick={() => setAssetTab(t.value as typeof assetTab)} className={cn('flex-1 pb-2 text-[10px] font-bold uppercase tracking-widest transition-colors',
                                assetTab === t.value ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-white'
                            )}>{t.label}</button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {!selected ? (
                        <p className="text-xs text-slate-600 text-center pt-8">Select a character first</p>
                    ) : selectedAssets.length === 0 ? (
                        <div className="text-center pt-8">
                            <p className="text-xs text-slate-600 mb-2">No {assetTab}s yet</p>
                            {!selected._shared && <button onClick={() => { setAssetType(assetTab); setShowAddAsset(true) }} className="text-xs text-emerald-400 hover:underline">+ Add {assetTab}</button>}
                        </div>
                    ) : selectedAssets.map(asset => (
                        <AssetCard key={asset.id} asset={asset}
                            uploading={uploadingAsset === asset.id}
                            onUpload={files => uploadAssetImages(asset.id, files)}
                            onDeleteImage={url => deleteAssetImage(asset.id, url)}
                            onDelete={() => deleteAsset(asset.id)}
                            onZoom={setLightbox}
                            fileRef={el => { assetFileRefs.current[asset.id] = el }}
                        />
                    ))}
                </div>

                {selected && !selected._shared && (
                    <div className="p-3 border-t border-white/5">
                        <button onClick={() => { setAssetType(assetTab); setShowAddAsset(true) }}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-black font-black text-xs rounded-xl hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(0,255,149,0.3)] transition-all">
                            <Plus size={14} /> Add {assetTab}
                        </button>
                    </div>
                )}
            </aside>

            {/* ══ Lightbox ══ */}
            {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}

            {/* ══ Create Avatar Dialog ══ */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="bg-[#0d1411] border-white/10 max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="text-white">Create New Character</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                        <div><Label className="text-slate-400 text-xs">Name *</Label>
                            <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="e.g. Sophia" className="bg-white/5 border-white/10 text-white mt-1" /></div>
                        <div><Label className="text-slate-400 text-xs">Prompt *</Label>
                            <textarea value={cPrompt} onChange={e => setCPrompt(e.target.value)} placeholder="Describe the character..." rows={4} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/50 resize-none mt-1" /></div>
                        <div><Label className="text-slate-400 text-xs">Art Style</Label>
                            <select value={cStyle} onChange={e => setCStyle(e.target.value)} className="w-full bg-white/5 border border-white/10 text-slate-300 rounded-lg px-2.5 py-2 text-xs mt-1 outline-none">
                                {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select></div>
                        <div><Label className="text-slate-400 text-xs">Description (optional)</Label>
                            <input value={cDesc} onChange={e => setCDesc(e.target.value)} placeholder="Internal notes..." className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none mt-1" /></div>
                        <button onClick={createAvatar} disabled={creating || !cName.trim() || !cPrompt.trim()}
                            className="w-full py-2.5 bg-emerald-500 text-black font-bold text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                            {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Create Character
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ══ Add Asset Dialog ══ */}
            <Dialog open={showAddAsset} onOpenChange={setShowAddAsset}>
                <DialogContent className="bg-[#0d1411] border-white/10 max-w-sm">
                    <DialogHeader><DialogTitle className="text-white">Add {assetType.charAt(0).toUpperCase() + assetType.slice(1)}</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                        <div className="flex gap-2">
                            {ASSET_TYPES.map(t => (
                                <button key={t.value} onClick={() => setAssetType(t.value as typeof assetType)}
                                    className={cn('flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all',
                                        assetType === t.value ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-500'
                                    )}>{t.label}</button>
                            ))}
                        </div>
                        <div><Label className="text-slate-400 text-xs">Name *</Label>
                            <input value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="e.g. Áo Vest Đen" className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white placeholder:text-slate-600 outline-none mt-1" /></div>
                        <div><Label className="text-slate-400 text-xs">Prompt (optional)</Label>
                            <textarea value={assetPrompt} onChange={e => setAssetPrompt(e.target.value)} placeholder="Describe the item for AI reference..." rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-slate-600 outline-none resize-none mt-1" /></div>
                        <button onClick={createAsset} disabled={creatingAsset || !assetName.trim()}
                            className="w-full py-2 bg-emerald-500 text-black font-bold text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                            {creatingAsset ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Asset
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ══ Add Pose Dialog ══ */}
            <Dialog open={showAddPose} onOpenChange={setShowAddPose}>
                <DialogContent className="bg-[#0d1411] border-white/10 max-w-sm">
                    <DialogHeader><DialogTitle className="text-white">New Pose Folder</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                        <div><Label className="text-slate-400 text-xs">Tên pose *</Label>
                            <input value={poseName} onChange={e => setPoseName(e.target.value)} placeholder="e.g. Ngồi café, Đứng hàng hiệu..." className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white placeholder:text-slate-600 outline-none mt-1" onKeyDown={e => e.key === 'Enter' && createPose()} /></div>
                        <button onClick={createPose} disabled={creatingPose || !poseName.trim()}
                            className="w-full py-2 bg-emerald-500 text-black font-bold text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                            {creatingPose ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />} Create Folder
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ══ Pose Detail Modal ══ */}
            <Dialog open={!!openPose} onOpenChange={o => !o && setOpenPose(null)}>
                <DialogContent className="bg-[#0d1411] border-white/10 max-w-2xl max-h-[85vh] overflow-y-auto">
                    {openPose && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center justify-between">
                                    <DialogTitle className="text-white flex items-center gap-2">
                                        <FolderOpen size={16} className="text-emerald-400" /> {openPose.name}
                                        <span className="text-xs text-slate-500 font-normal">({openPose.images.length} ảnh)</span>
                                    </DialogTitle>
                                    <button onClick={() => deletePose(openPose.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                </div>
                            </DialogHeader>
                            <div className="mt-3">
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {openPose.images.map((img, i) => (
                                        <div key={i} className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-white/5">
                                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                                <button onClick={() => setLightbox(img.url)} className="p-1.5 bg-white/10 rounded-lg"><ZoomIn size={12} className="text-white" /></button>
                                                <button onClick={() => deletePoseImage(img.url)} className="p-1.5 bg-red-500/20 rounded-lg"><Trash2 size={12} className="text-red-400" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {/* Upload slot */}
                                    <label className="aspect-square bg-white/5 border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-emerald-500/40 transition-all">
                                        {uploadingPose ? <Loader2 size={16} className="animate-spin text-emerald-400" /> : <><Upload size={16} className="text-slate-500" /><p className="text-[10px] text-slate-500">Upload ảnh</p></>}
                                        <input ref={poseFileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && uploadPoseImages(e.target.files)} />
                                    </label>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    )
}

/* ── Asset Card Component ── */
/* ── Pose Matrix Slot ── */
function PoseMatrixSlot({ label, url, isShared, generatingAngle, angleIndex, onZoom, onUpload, onGenerate }: {
    label: string; url?: string; isShared: boolean; generatingAngle: number | null; angleIndex: number
    onZoom: () => void; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onGenerate: (prompt: string) => void
}) {
    const [showGenInput, setShowGenInput] = useState(false)
    const [prompt, setPrompt] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)
    const isGenerating = generatingAngle === angleIndex
    return (
        <div className={cn('group relative aspect-[3/4] bg-[#0d1411] border rounded-xl overflow-hidden transition-all',
            url ? 'border-white/5 hover:border-emerald-500/50' : 'border-dashed border-white/10 hover:border-emerald-500/30'
        )}>
            {url ? (
                <img src={url} alt={label} className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity cursor-pointer" onClick={onZoom} />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <ImagePlus size={16} className="text-slate-700" />
                </div>
            )}

            {/* Hover actions overlay */}
            {!isShared && !showGenInput && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <p className="text-[9px] font-bold text-white uppercase tracking-wide mb-1">{label}</p>
                    <label className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-lg text-[10px] text-white cursor-pointer hover:bg-white/20 transition-all">
                        <Upload size={10} /> Upload
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
                    </label>
                    <button onClick={() => setShowGenInput(true)} className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-lg text-[10px] text-emerald-400 hover:bg-emerald-500/30 transition-all">
                        <Sparkles size={10} /> AI Generate
                    </button>
                </div>
            )}

            {/* Stable label when no hover */}
            {!isShared && url && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-bold text-white uppercase opacity-80 group-hover:opacity-0 transition-all">{label}</div>
            )}
            {!url && !isShared && (
                <div className="absolute bottom-2 left-0 right-0 text-center text-[9px] text-slate-600 uppercase group-hover:opacity-0 transition-all">{label}</div>
            )}

            {/* AI Gen inline prompt */}
            {showGenInput && (
                <div className="absolute inset-0 bg-black/90 flex flex-col p-2 gap-1.5" onClick={e => e.stopPropagation()}>
                    <p className="text-[9px] font-bold text-emerald-400 uppercase">{label} — AI Generate</p>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Thêm mô tả (optional)..." rows={3}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg p-1.5 text-[10px] text-white placeholder:text-slate-600 outline-none resize-none" />
                    <div className="flex gap-1">
                        <button onClick={() => setShowGenInput(false)} className="flex-1 py-1 bg-white/10 rounded text-[10px] text-slate-400">Cancel</button>
                        <button onClick={() => { onGenerate(prompt); setShowGenInput(false); setPrompt('') }}
                            className="flex-1 py-1 bg-emerald-500 rounded text-[10px] text-black font-bold flex items-center justify-center gap-1">
                            <Sparkles size={10} /> Gen
                        </button>
                    </div>
                </div>
            )}

            {/* Generating spinner */}
            {isGenerating && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-emerald-400" />
                </div>
            )}
        </div>
    )
}

function AssetCard({ asset, uploading, onUpload, onDeleteImage, onDelete, onZoom, fileRef }: {
    asset: AvatarAsset; uploading: boolean
    onUpload: (files: FileList) => void
    onDeleteImage: (url: string) => void
    onDelete: () => void
    onZoom: (url: string) => void
    fileRef: (el: HTMLInputElement | null) => void
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    return (
        <div className="p-3 rounded-xl bg-[#0d1411] border border-white/5 hover:border-white/10 transition-all">
            <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-white">{asset.name}</p>
                <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
            </div>
            {asset.prompt && <p className="text-[10px] text-slate-500 mb-2 line-clamp-2">{asset.prompt}</p>}
            {/* Multi-image grid */}
            <div className="grid grid-cols-3 gap-1 mb-2">
                {(asset.images || []).map((img, i) => (
                    <div key={i} className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-white/5">
                        <img src={img.url} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-all">
                            <button onClick={() => onZoom(img.url)} className="p-1 bg-white/10 rounded"><ZoomIn size={10} className="text-white" /></button>
                            <button onClick={() => onDeleteImage(img.url)} className="p-1 bg-red-500/20 rounded"><X size={10} className="text-red-400" /></button>
                        </div>
                    </div>
                ))}
                {/* Add image slot */}
                <label className="aspect-square bg-white/5 border border-dashed border-white/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-emerald-500/40 transition-all">
                    {uploading ? <Loader2 size={12} className="animate-spin text-emerald-400" /> : <Plus size={12} className="text-slate-500" />}
                    <input ref={el => { inputRef.current = el; fileRef(el) }} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && onUpload(e.target.files)} />
                </label>
            </div>
        </div>
    )
}
