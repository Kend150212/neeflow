'use client'

import { useState, useEffect, useRef } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
    Image as ImageIcon, PenTool, Users, Code2,
    Plus, Check, Loader2, X, Sparkles, Shield,
    Building2, Palette, ChevronDown,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

/* ─── Types ─────────────────────────── */
type Addon = {
    id: string
    name: string
    displayName: string
    displayNameVi: string
    description: string | null
    descriptionVi: string | null
    category: string
    quotaField: string | null
    quotaAmount: number
    featureField: string | null
    priceMonthly: number
    priceAnnual: number
    icon: string
    sortOrder: number
}

type Props = {
    open: boolean
    onClose: () => void
    onPurchased?: () => void
}

/* ─── Catalog definition ─────────────────────────── */
type CatalogEntry = {
    key: string                            // quotaField or featureField or '*'
    label: string
    labelVi: string
    desc: string
    descVi: string
    iconBg: string                         // tailwind bg
    iconColor: string                      // tailwind text
    Icon: React.ComponentType<{ className?: string }>
    match: (a: Addon) => boolean
}

const CATALOG: CatalogEntry[] = [
    {
        key: 'maxAiImagesPerMonth',
        label: 'AI Media Credits',
        labelVi: 'AI Media Credits',
        desc: 'Generate images and videos',
        descVi: 'Tạo hình ảnh và video',
        iconBg: 'bg-blue-500',
        iconColor: 'text-white',
        Icon: ImageIcon,
        match: (a) => a.quotaField === 'maxAiImagesPerMonth',
    },
    {
        key: 'maxAiTextPerMonth',
        label: 'Add AI Text Credits',
        labelVi: 'AI Text Credits',
        desc: 'Generate content and captions',
        descVi: 'Tạo nội dung và caption',
        iconBg: 'bg-emerald-500',
        iconColor: 'text-white',
        Icon: PenTool,
        match: (a) => a.quotaField === 'maxAiTextPerMonth',
    },
    {
        key: 'maxMembersPerChannel',
        label: 'Add Users',
        labelVi: 'Thêm người dùng',
        desc: 'Invite more team members',
        descVi: 'Mời thêm thành viên nhóm',
        iconBg: 'bg-violet-500',
        iconColor: 'text-white',
        Icon: Users,
        match: (a) => a.quotaField === 'maxMembersPerChannel',
    },
    {
        key: 'maxChannels',
        label: 'Add Companies',
        labelVi: 'Thêm công ty',
        desc: 'Manage multiple companies',
        descVi: 'Quản lý nhiều công ty',
        iconBg: 'bg-orange-500',
        iconColor: 'text-white',
        Icon: Building2,
        match: (a) => a.quotaField === 'maxChannels',
    },
    {
        key: 'maxApiCallsPerMonth',
        label: 'API Access',
        labelVi: 'Truy cập API',
        desc: 'Integrate with your apps',
        descVi: 'Tích hợp với ứng dụng',
        iconBg: 'bg-slate-600',
        iconColor: 'text-white',
        Icon: Code2,
        match: (a) => a.quotaField === 'maxApiCallsPerMonth',
    },
    {
        key: 'whiteLabel',
        label: 'White Label',
        labelVi: 'White Label',
        desc: 'Custom branding options',
        descVi: 'Tùy chỉnh thương hiệu',
        iconBg: 'bg-pink-500',
        iconColor: 'text-white',
        Icon: Palette,
        match: (a) => a.featureField === 'whiteLabel' || a.name?.toLowerCase().includes('white'),
    },
]

/* ─── Main Component ─────────────────────────── */
export function AddonModal({ open, onClose, onPurchased }: Props) {
    const t = useTranslation()
    const isVi = t('lang') === 'vi'

    const [addons, setAddons] = useState<Addon[]>([])
    const [activeAddons, setActiveAddons] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)

    // Catalog popover
    const [catalogOpen, setCatalogOpen] = useState(false)
    const catalogRef = useRef<HTMLDivElement>(null)

    // Tier picker
    const [selectedCatalog, setSelectedCatalog] = useState<CatalogEntry | null>(null)
    const [selectedTier, setSelectedTier] = useState<Addon | null>(null)
    const [purchasing, setPurchasing] = useState(false)

    useEffect(() => {
        if (!open) return
        setLoading(true)
        fetch('/api/addons')
            .then(r => r.json())
            .then(data => {
                setAddons(data.addons ?? [])
                setActiveAddons(data.activeAddons ?? {})
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [open])

    // Close catalog on outside click
    useEffect(() => {
        if (!catalogOpen) return
        const handler = (e: MouseEvent) => {
            if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) {
                setCatalogOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [catalogOpen])

    const handleSelectCatalog = (entry: CatalogEntry) => {
        setCatalogOpen(false)
        const tiers = addons.filter(entry.match)
        if (tiers.length === 0) {
            toast.info(isVi ? 'Không có tùy chọn cho danh mục này.' : 'No options for this category yet.')
            return
        }
        setSelectedCatalog(entry)
        setSelectedTier(tiers[0]) // default select first
    }

    const handlePurchaseTier = async () => {
        if (!selectedTier) return
        setPurchasing(true)
        try {
            const res = await fetch('/api/billing/addon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addonId: selectedTier.id, action: 'purchase' }),
            })
            const data = await res.json()
            if (!res.ok) { toast.error(data.error || 'Failed'); return }
            setActiveAddons(prev => ({ ...prev, [selectedTier.id]: data.quantity ?? 1 }))
            toast.success(`${selectedTier.displayName} ${isVi ? 'đã kích hoạt!' : 'activated!'}`)
            onPurchased?.()
            setSelectedCatalog(null)
            setSelectedTier(null)
        } catch { toast.error('Something went wrong') }
        finally { setPurchasing(false) }
    }

    const handleRemoveAddon = async (addonId: string, name: string) => {
        if (!confirm(isVi ? `Hủy "${name}"?` : `Remove "${name}"?`)) return
        try {
            const res = await fetch('/api/billing/addon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addonId, action: 'cancel' }),
            })
            const data = await res.json()
            if (!res.ok) { toast.error(data.error || 'Failed'); return }
            setActiveAddons(prev => { const n = { ...prev }; delete n[addonId]; return n })
            toast.success(isVi ? 'Đã hủy add-on' : 'Add-on removed')
            onPurchased?.()
        } catch { toast.error('Something went wrong') }
    }

    const activeList = addons.filter(a => !!activeAddons[a.id])
    const getName = (a: Addon) => isVi && a.displayNameVi ? a.displayNameVi : a.displayName

    /* ── Tier picker dialog ── */
    const tierItems = selectedCatalog ? addons.filter(selectedCatalog.match) : []

    /* ── Catalog icons mapping ── */
    const getCatalogForAddon = (a: Addon) =>
        CATALOG.find(c => c.match(a)) ?? { iconBg: 'bg-slate-600', iconColor: 'text-white', Icon: Plus }

    return (
        <>
            {/* ── Main panel (active add-ons + new button) ── */}
            <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
                <DialogContent className="max-w-lg p-0">
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 py-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2.5 text-base">
                                <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                </div>
                                {isVi ? 'Add-ons của bạn' : 'Your Add-Ons'}
                                {activeList.length > 0 && (
                                    <Badge variant="secondary" className="text-xs ml-1">
                                        {activeList.length} {isVi ? 'đang dùng' : 'active'}
                                    </Badge>
                                )}
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-xs text-muted-foreground mt-1">
                            {isVi ? 'Quản lý add-on đang dùng và thêm mới.' : 'Manage active add-ons and add new ones.'}
                        </p>
                    </div>

                    <div className="px-6 pb-6 pt-4 space-y-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : activeList.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">{isVi ? 'Chưa có add-on nào.' : 'No add-ons yet.'}</p>
                                <p className="text-xs mt-1">{isVi ? 'Thêm credits, thành viên, tính năng premium...' : 'Add credits, team members, premium features...'}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeList.map(addon => {
                                    const cat = getCatalogForAddon(addon)
                                    return (
                                        <div key={addon.id}
                                            className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card/80">
                                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${cat.iconBg}`}>
                                                <cat.Icon className={`h-4 w-4 ${cat.iconColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{getName(addon)}</p>
                                                <p className="text-xs text-muted-foreground">${addon.priceMonthly}/mo</p>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5">
                                                <Check className="h-2.5 w-2.5 mr-0.5" /> Active
                                            </Badge>
                                            <button
                                                onClick={() => handleRemoveAddon(addon.id, getName(addon))}
                                                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 text-muted-foreground transition-colors">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* ── "+ New Add-Ons" catalog trigger ── */}
                        <div className="relative" ref={catalogRef}>
                            <button
                                onClick={() => setCatalogOpen(v => !v)}
                                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all"
                                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)', color: 'white' }}
                            >
                                <Plus className="h-4 w-4" />
                                {isVi ? 'Thêm Add-On mới' : 'New Add-Ons'}
                                <ChevronDown className={`h-4 w-4 transition-transform ${catalogOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Catalog popover */}
                            {catalogOpen && (
                                <div className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-2xl border border-border/60 bg-popover/95 backdrop-blur-md shadow-2xl overflow-hidden">
                                    {CATALOG.map((entry, i) => {
                                        const tiers = addons.filter(entry.match)
                                        if (tiers.length === 0) return null
                                        return (
                                            <button
                                                key={entry.key}
                                                onClick={() => handleSelectCatalog(entry)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/60 transition-colors text-left ${i < CATALOG.length - 1 ? 'border-b border-border/30' : ''}`}
                                            >
                                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${entry.iconBg}`}>
                                                    <entry.Icon className={`h-4 w-4 ${entry.iconColor}`} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">{isVi ? entry.labelVi : entry.label}</p>
                                                    <p className="text-xs text-muted-foreground">{isVi ? entry.descVi : entry.desc}</p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                            <Shield className="h-3.5 w-3.5 shrink-0" />
                            <span>{isVi ? 'Tính vào hóa đơn hàng tháng. Hủy bất cứ lúc nào.' : 'Billed monthly. Cancel anytime with no penalty.'}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Tier Picker Dialog ── */}
            <Dialog open={!!selectedCatalog} onOpenChange={v => { if (!v) { setSelectedCatalog(null); setSelectedTier(null) } }}>
                <DialogContent className="max-w-md p-0 bg-[#1a1f2e] border-border/40" style={{ borderRadius: '18px' }}>
                    {selectedCatalog && (
                        <>
                            {/* Header */}
                            <div className="px-6 pt-6 pb-4">
                                <div className="flex items-center gap-4 mb-1">
                                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${selectedCatalog.iconBg}`}>
                                        <selectedCatalog.Icon className="h-7 w-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">
                                            {isVi ? `Thêm ${selectedCatalog.labelVi}` : `Add ${selectedCatalog.label}`}
                                        </h2>
                                        <p className="text-sm text-slate-400">
                                            {isVi ? selectedCatalog.descVi : selectedCatalog.desc}!
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Tier list */}
                            <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
                                {tierItems.map((addon, i) => {
                                    const isSelected = selectedTier?.id === addon.id
                                    // Pick an icon variant based on index
                                    const tierIcons = [ImageIcon, PenTool, Building2, Code2, Sparkles]
                                    const TierIcon = tierIcons[Math.min(i, tierIcons.length - 1)]
                                    return (
                                        <button
                                            key={addon.id}
                                            onClick={() => setSelectedTier(addon)}
                                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${isSelected
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-slate-700/60 bg-slate-800/50 hover:border-slate-600'
                                                }`}
                                        >
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? selectedCatalog.iconBg : 'bg-slate-700'}`}>
                                                <TierIcon className="h-5 w-5 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-white">{getName(addon)}</p>
                                                <p className="text-xs text-slate-400">+${addon.priceMonthly}/month</p>
                                            </div>
                                            <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? `border-blue-500 ${selectedCatalog.iconBg}` : 'border-slate-600'}`}>
                                                {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 px-4 pb-6">
                                <Button
                                    variant="outline"
                                    className="flex-1 rounded-xl bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700"
                                    onClick={() => { setSelectedCatalog(null); setSelectedTier(null) }}
                                >
                                    {isVi ? 'Hủy' : 'Cancel'}
                                </Button>
                                <Button
                                    className="flex-1 rounded-xl font-semibold"
                                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                                    disabled={!selectedTier || purchasing}
                                    onClick={handlePurchaseTier}
                                >
                                    {purchasing ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Sparkles className="h-4 w-4 mr-2" />
                                    )}
                                    {isVi ? 'Thêm Credits' : 'Add Credits'}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
