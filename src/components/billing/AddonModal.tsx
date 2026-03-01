'use client'

import { useState, useEffect, useRef } from 'react'
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
    HardDrive, Tv, Sparkles, Users, Code2,
    Zap, Shield, Check, Loader2, X, Plus,
    ChevronDown, PenLine, FileBarChart, HeadphonesIcon, CalendarClock,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

/* ─── Types ─────────────────────────────── */
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
    icon: string
    priceMonthly: number
    priceAnnual: number
    sortOrder: number
}

type Props = {
    open: boolean
    onClose: () => void
    onPurchased?: () => void
}

/* ─── Icon map (SVG from lucide) ──────────── */
const ICON_MAP: Record<string, React.ReactNode> = {
    'hard-drive': <HardDrive className="h-5 w-5" />,
    'tv': <Tv className="h-5 w-5" />,
    'image': <Sparkles className="h-5 w-5" />,
    'pen-tool': <PenLine className="h-5 w-5" />,
    'users': <Users className="h-5 w-5" />,
    'code-2': <Code2 className="h-5 w-5" />,
    'calendar-clock': <CalendarClock className="h-5 w-5" />,
    'bar-chart-3': <FileBarChart className="h-5 w-5" />,
    'headphones': <HeadphonesIcon className="h-5 w-5" />,
    'zap': <Zap className="h-5 w-5" />,
    'plus': <Plus className="h-5 w-5" />,
}

const getIcon = (icon: string) => ICON_MAP[icon] ?? <Plus className="h-5 w-5" />

/* ─── Group definitions (mirrors backend catalog) ── */
type GroupDef = {
    key: string
    label: string
    labelVi: string
    match: (a: Addon) => boolean
    iconBg: string
    textColor: string
    CatalogIcon: React.ComponentType<{ className?: string }>
    barColor: string
}

const GROUPS: GroupDef[] = [
    {
        key: 'storage',
        label: '💾 Storage',
        labelVi: '💾 Lưu trữ',
        match: (a) => a.quotaField === 'maxStorageMB',
        iconBg: 'bg-blue-500',
        textColor: 'text-blue-400',
        CatalogIcon: HardDrive,
        barColor: 'from-blue-500 to-cyan-400',
    },
    {
        key: 'channels',
        label: '📺 Channels',
        labelVi: '📺 Kênh',
        match: (a) => a.quotaField === 'maxChannels',
        iconBg: 'bg-violet-500',
        textColor: 'text-violet-400',
        CatalogIcon: Tv,
        barColor: 'from-violet-500 to-purple-400',
    },
    {
        key: 'ai',
        label: '✨ AI Credits',
        labelVi: '✨ AI Credits',
        match: (a) => a.quotaField === 'maxAiImagesPerMonth' || a.quotaField === 'maxAiTextPerMonth',
        iconBg: 'bg-amber-500',
        textColor: 'text-amber-400',
        CatalogIcon: Sparkles,
        barColor: 'from-amber-500 to-orange-400',
    },
    {
        key: 'members',
        label: '👥 Team Members',
        labelVi: '👥 Thành viên',
        match: (a) => a.quotaField === 'maxMembersPerChannel',
        iconBg: 'bg-emerald-500',
        textColor: 'text-emerald-400',
        CatalogIcon: Users,
        barColor: 'from-emerald-500 to-teal-400',
    },
    {
        key: 'api',
        label: '🔌 API Access',
        labelVi: '🔌 Truy cập API',
        match: (a) => a.quotaField === 'maxApiCallsPerMonth',
        iconBg: 'bg-rose-500',
        textColor: 'text-rose-400',
        CatalogIcon: Code2,
        barColor: 'from-rose-500 to-pink-400',
    },
    {
        key: 'features',
        label: '⚡ Premium Features',
        labelVi: '⚡ Tính năng Premium',
        match: (a) => a.category === 'feature',
        iconBg: 'bg-teal-500',
        textColor: 'text-teal-400',
        CatalogIcon: Zap,
        barColor: 'from-teal-500 to-cyan-400',
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
    const [selectedGroup, setSelectedGroup] = useState<GroupDef | null>(null)
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
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [open])

    // Close popover on outside click
    useEffect(() => {
        if (!catalogOpen) return
        const handler = (e: MouseEvent) => {
            if (catalogRef.current && !catalogRef.current.contains(e.target as Node))
                setCatalogOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [catalogOpen])

    // Build available groups (only those with real addons from API)
    const availableGroups = GROUPS.map(g => ({
        ...g,
        tiers: addons.filter(g.match).sort((a, b) => a.sortOrder - b.sortOrder),
    })).filter(g => g.tiers.length > 0)

    const handleSelectGroup = (group: typeof availableGroups[0]) => {
        setCatalogOpen(false)
        setSelectedGroup(group)
        setSelectedTier(group.tiers[0])
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
            toast.success(`${isVi && selectedTier.displayNameVi ? selectedTier.displayNameVi : selectedTier.displayName} ${isVi ? 'đã kích hoạt!' : 'activated!'}`)
            onPurchased?.()
            setSelectedGroup(null)
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

    const getName = (a: Addon) => isVi && a.displayNameVi ? a.displayNameVi : a.displayName
    const getDesc = (a: Addon) => isVi && a.descriptionVi ? a.descriptionVi : (a.description ?? '')

    const activeList = addons.filter(a => !!activeAddons[a.id])

    /* Find which group an active addon belongs to */
    const getGroupForAddon = (a: Addon) =>
        GROUPS.find(g => g.match(a)) ?? null

    /* ── Tier items for selected group ── */
    const tierItems = selectedGroup
        ? addons.filter(selectedGroup.match).sort((a, b) => a.sortOrder - b.sortOrder)
        : []

    return (
        <>
            {/* ─── Main Panel ─────────────────────────────── */}
            <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
                <DialogContent className="max-w-lg p-0">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 py-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                                <Sparkles className="h-4 w-4 text-primary" />
                            </div>
                            <h2 className="text-base font-semibold">
                                {isVi ? 'Add-ons của bạn' : 'Your Add-Ons'}
                            </h2>
                            {activeList.length > 0 && (
                                <Badge variant="secondary" className="text-xs ml-1">
                                    {activeList.length} {isVi ? 'đang dùng' : 'active'}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {isVi ? 'Quản lý add-on và thêm mới bất cứ lúc nào.' : 'Manage add-ons and add new ones anytime.'}
                        </p>
                    </div>

                    <div className="px-5 pb-5 pt-4 space-y-3">
                        {/* Active list */}
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : activeList.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Shield className="h-8 w-8 mx-auto mb-2 opacity-25" />
                                <p className="text-sm font-medium">{isVi ? 'Chưa có add-on nào' : 'No add-ons yet'}</p>
                                <p className="text-xs mt-1 opacity-70">
                                    {isVi ? 'Thêm credits, thành viên, tính năng premium...' : 'Add credits, team members, premium features...'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeList.map(addon => {
                                    const grp = getGroupForAddon(addon)
                                    return (
                                        <div key={addon.id}
                                            className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card/60">
                                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${grp?.iconBg ?? 'bg-slate-600'}`}>
                                                <span className="text-white">{getIcon(addon.icon)}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{getName(addon)}</p>
                                                <p className="text-xs text-muted-foreground">${addon.priceMonthly}/mo</p>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 shrink-0">
                                                <Check className="h-2.5 w-2.5 mr-0.5" /> Active
                                            </Badge>
                                            <button
                                                onClick={() => handleRemoveAddon(addon.id, getName(addon))}
                                                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 text-muted-foreground transition-colors shrink-0"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* ── "+ New Add-Ons" catalog trigger ── */}
                        {!loading && (
                            <div className="relative" ref={catalogRef}>
                                <button
                                    onClick={() => setCatalogOpen(v => !v)}
                                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-sm font-semibold transition-all shadow-lg"
                                    style={{
                                        background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)',
                                        color: 'white',
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                    {isVi ? 'Thêm Add-On mới' : 'New Add-Ons'}
                                    <ChevronDown className={`h-4 w-4 transition-transform ${catalogOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Catalog drop-UP popover */}
                                {catalogOpen && (
                                    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-2xl border border-border/50 bg-popover shadow-2xl overflow-hidden">
                                        {availableGroups.map((grp, i) => (
                                            <button
                                                key={grp.key}
                                                onClick={() => handleSelectGroup(grp)}
                                                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/60 transition-colors text-left ${i < availableGroups.length - 1 ? 'border-b border-border/30' : ''}`}
                                            >
                                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${grp.iconBg}`}>
                                                    <grp.CatalogIcon className="h-5 w-5 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold">{isVi ? grp.labelVi : grp.label}</p>
                                                    <p className="text-xs text-muted-foreground">{grp.tiers.length} {isVi ? 'tùy chọn' : 'options'}</p>
                                                </div>
                                                <span className={`text-xs font-medium ${grp.textColor}`}>
                                                    {grp.tiers.filter(a => !!activeAddons[a.id]).length}/{grp.tiers.length}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                            <Shield className="h-3.5 w-3.5 shrink-0" />
                            <span>{isVi ? 'Tính vào hóa đơn hàng tháng. Hủy bất cứ lúc nào.' : 'Billed monthly. Cancel anytime with no penalty.'}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Tier Picker Dialog ─────────────────────── */}
            <Dialog open={!!selectedGroup} onOpenChange={v => {
                if (!v) { setSelectedGroup(null); setSelectedTier(null) }
            }}>
                <DialogContent
                    className="max-w-sm p-0 overflow-hidden"
                    style={{
                        background: 'hsl(222 28% 11%)',
                        border: '1px solid hsl(222 20% 20%)',
                        borderRadius: '20px',
                    }}
                >
                    {selectedGroup && (
                        <>
                            {/* Header */}
                            <div className="px-5 pt-6 pb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${selectedGroup.iconBg} shadow-lg`}>
                                        <selectedGroup.CatalogIcon className="h-7 w-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white leading-tight">
                                            {isVi ? `Thêm ${selectedGroup.labelVi.replace(/[^\w\s]/g, '').trim()}` : `Add ${selectedGroup.label.replace(/[^\w\s]/g, '').trim()}`}
                                        </h2>
                                        <p className="text-sm text-slate-400 mt-0.5">
                                            {isVi ? 'Chọn gói phù hợp với nhu cầu!' : 'Pick the tier that fits your needs!'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Tier list */}
                            <div className="px-4 pb-2 space-y-2 max-h-72 overflow-y-auto">
                                {tierItems.map(addon => {
                                    const isSelected = selectedTier?.id === addon.id
                                    const isActive = !!activeAddons[addon.id]
                                    return (
                                        <button
                                            key={addon.id}
                                            onClick={() => setSelectedTier(addon)}
                                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${isSelected
                                                ? `border-${selectedGroup.iconBg.replace('bg-', '')}/80 bg-white/5`
                                                : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
                                                }`}
                                            style={isSelected ? { borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)' } : {}}
                                        >
                                            {/* Tier icon */}
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? selectedGroup.iconBg : 'bg-white/10'}`}>
                                                <span className="text-white">{getIcon(addon.icon)}</span>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-white">{getName(addon)}</p>
                                                <p className="text-xs text-slate-400">+${addon.priceMonthly}/month
                                                    {isActive && <span className="ml-2 text-emerald-400 font-medium">● Active</span>}
                                                </p>
                                            </div>

                                            {/* Radio */}
                                            <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? `${selectedGroup.iconBg} border-transparent` : 'border-slate-600'}`}>
                                                {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Selected tier description */}
                            {selectedTier && (
                                <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                                    <p className="text-xs text-slate-300">{getDesc(selectedTier)}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 px-4 pb-6 pt-1">
                                <Button
                                    variant="outline"
                                    className="flex-1 rounded-xl border-slate-600 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                    onClick={() => { setSelectedGroup(null); setSelectedTier(null) }}
                                >
                                    {isVi ? 'Hủy' : 'Cancel'}
                                </Button>
                                <Button
                                    className="flex-1 rounded-xl font-semibold text-white shadow-lg"
                                    style={{ background: `linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)` }}
                                    disabled={!selectedTier || purchasing}
                                    onClick={handlePurchaseTier}
                                >
                                    {purchasing ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Sparkles className="h-4 w-4 mr-2" />
                                    )}
                                    {isVi ? 'Thêm ngay' : 'Add Credits'}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
