'use client'

import { useState, useEffect } from 'react'
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
    HardDrive, Tv, Image as ImageIcon, PenTool, Users, Code2,
    CalendarClock, BarChart3, Tag, Headphones, Plus, Check, Loader2, X,
    Sparkles, Zap, Shield,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

// Icon map for add-on icons
const iconMap: Record<string, React.ReactNode> = {
    'hard-drive': <HardDrive className="h-5 w-5" />,
    'tv': <Tv className="h-5 w-5" />,
    'image': <ImageIcon className="h-5 w-5" />,
    'pen-tool': <PenTool className="h-5 w-5" />,
    'users': <Users className="h-5 w-5" />,
    'code-2': <Code2 className="h-5 w-5" />,
    'calendar-clock': <CalendarClock className="h-5 w-5" />,
    'bar-chart-3': <BarChart3 className="h-5 w-5" />,
    'tag': <Tag className="h-5 w-5" />,
    'headphones': <Headphones className="h-5 w-5" />,
    'plus': <Plus className="h-5 w-5" />,
}

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

// Group definitions with visual styling
const QUOTA_GROUPS = [
    {
        key: 'maxStorageMB',
        label: '💾 Storage',
        labelVi: '💾 Lưu trữ',
        gradient: 'from-blue-500/10 to-cyan-500/10',
        border: 'border-blue-500/20',
        iconBg: 'bg-blue-500/10 text-blue-400',
        activeBg: 'bg-blue-500/5 border-blue-500/40',
        activeBadge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    {
        key: 'maxChannels',
        label: '📺 Channels',
        labelVi: '📺 Kênh',
        gradient: 'from-violet-500/10 to-purple-500/10',
        border: 'border-violet-500/20',
        iconBg: 'bg-violet-500/10 text-violet-400',
        activeBg: 'bg-violet-500/5 border-violet-500/40',
        activeBadge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    },
    {
        key: 'ai',
        match: (a: Addon) => a.quotaField === 'maxAiImagesPerMonth' || a.quotaField === 'maxAiTextPerMonth',
        label: '✨ AI Credits',
        labelVi: '✨ AI Credits',
        gradient: 'from-amber-500/10 to-orange-500/10',
        border: 'border-amber-500/20',
        iconBg: 'bg-amber-500/10 text-amber-400',
        activeBg: 'bg-amber-500/5 border-amber-500/40',
        activeBadge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
        key: 'maxMembersPerChannel',
        label: '👥 Team Members',
        labelVi: '👥 Thành viên',
        gradient: 'from-green-500/10 to-emerald-500/10',
        border: 'border-green-500/20',
        iconBg: 'bg-green-500/10 text-green-400',
        activeBg: 'bg-green-500/5 border-green-500/40',
        activeBadge: 'bg-green-500/10 text-green-400 border-green-500/20',
    },
    {
        key: 'maxApiCallsPerMonth',
        label: '🔌 API Access',
        labelVi: '🔌 Truy cập API',
        gradient: 'from-rose-500/10 to-pink-500/10',
        border: 'border-rose-500/20',
        iconBg: 'bg-rose-500/10 text-rose-400',
        activeBg: 'bg-rose-500/5 border-rose-500/40',
        activeBadge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
]

const FEATURE_GROUP = {
    label: '⚡ Premium Features',
    labelVi: '⚡ Tính năng Premium',
    gradient: 'from-emerald-500/10 to-teal-500/10',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
    activeBg: 'bg-emerald-500/5 border-emerald-500/40',
    activeBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export function AddonModal({ open, onClose, onPurchased }: Props) {
    const t = useTranslation()
    const [addons, setAddons] = useState<Addon[]>([])
    const [activeAddons, setActiveAddons] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [purchasing, setPurchasing] = useState<string | null>(null)

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

    const handlePurchase = async (addon: Addon) => {
        setPurchasing(addon.id)
        try {
            const isActive = activeAddons[addon.id]
            const res = await fetch('/api/billing/addon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    addonId: addon.id,
                    action: isActive ? 'cancel' : 'purchase',
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Failed')
                return
            }

            if (data.action === 'purchased') {
                setActiveAddons(prev => ({ ...prev, [addon.id]: data.quantity }))
                toast.success(`${addon.displayName} activated!`)
            } else {
                setActiveAddons(prev => {
                    const next = { ...prev }
                    delete next[addon.id]
                    return next
                })
                toast.success(`${addon.displayName} canceled`)
            }

            onPurchased?.()
        } catch {
            toast.error('Something went wrong')
        } finally {
            setPurchasing(null)
        }
    }

    const locale = t('lang') || 'en'
    const isVi = locale === 'vi'
    const getName = (a: Addon) => isVi && a.displayNameVi ? a.displayNameVi : a.displayName
    const getDesc = (a: Addon) => isVi && a.descriptionVi ? a.descriptionVi : a.description

    // Group quota addons by field
    const quotaAddons = addons.filter(a => a.category === 'quota')
    const featureAddons = addons.filter(a => a.category === 'feature')

    const groupedQuotas = QUOTA_GROUPS.map(group => {
        const items = group.match
            ? quotaAddons.filter(group.match)
            : quotaAddons.filter(a => a.quotaField === group.key)
        return { ...group, items }
    }).filter(g => g.items.length > 0)

    // Count active add-ons
    const totalActive = Object.keys(activeAddons).length

    const renderAddonCard = (addon: Addon, style: typeof FEATURE_GROUP) => {
        const isActive = !!activeAddons[addon.id]
        const isProcessing = purchasing === addon.id
        return (
            <div
                key={addon.id}
                className={`group relative flex flex-col gap-2 p-3.5 rounded-xl border transition-all duration-200 ${isActive
                        ? style.activeBg
                        : 'border-border/60 hover:border-border hover:bg-accent/30'
                    }`}
            >
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 transition-colors ${isActive ? style.iconBg : 'bg-muted/60 text-muted-foreground group-hover:bg-muted'
                        }`}>
                        {iconMap[addon.icon] ?? <Plus className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{getName(addon)}</span>
                            {isActive && (
                                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${style.activeBadge}`}>
                                    <Check className="h-2.5 w-2.5 mr-0.5" /> Active
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{getDesc(addon)}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold">${addon.priceMonthly}</span>
                        <span className="text-[10px] text-muted-foreground">/mo</span>
                    </div>
                    <Button
                        size="sm"
                        variant={isActive ? 'outline' : 'default'}
                        className={`h-7 text-xs gap-1 rounded-lg ${!isActive ? 'shadow-sm' : ''}`}
                        disabled={isProcessing}
                        onClick={() => handlePurchase(addon)}
                    >
                        {isProcessing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isActive ? (
                            <><X className="h-3 w-3" /> {isVi ? 'Hủy' : 'Remove'}</>
                        ) : (
                            <><Plus className="h-3 w-3" /> {isVi ? 'Thêm' : 'Add'}</>
                        )}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 py-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-lg">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                                <Sparkles className="h-5 w-5 text-primary" />
                            </div>
                            {isVi ? 'Nâng cấp Add-ons' : 'Power-up Add-ons'}
                            {totalActive > 0 && (
                                <Badge variant="secondary" className="text-xs ml-1">
                                    {totalActive} {isVi ? 'đang dùng' : 'active'}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground mt-1">
                        {isVi
                            ? 'Mở rộng plan của bạn với các add-on linh hoạt. Thêm hoặc hủy bất cứ lúc nào.'
                            : 'Extend your plan with flexible add-ons. Add or remove anytime.'}
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="px-6 pb-6 space-y-5 pt-4">
                        {/* Quota Groups */}
                        {groupedQuotas.map(group => (
                            <div key={group.key}>
                                <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${group.border}`}>
                                    <h3 className="text-sm font-semibold tracking-wide">
                                        {isVi ? group.labelVi : group.label}
                                    </h3>
                                    <div className="flex-1" />
                                    <span className="text-[10px] text-muted-foreground">
                                        {group.items.filter(a => !!activeAddons[a.id]).length}/{group.items.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {group.items.map(addon => renderAddonCard(addon, group))}
                                </div>
                            </div>
                        ))}

                        {/* Feature Add-ons */}
                        {featureAddons.length > 0 && (
                            <div>
                                <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${FEATURE_GROUP.border}`}>
                                    <h3 className="text-sm font-semibold tracking-wide">
                                        {isVi ? FEATURE_GROUP.labelVi : FEATURE_GROUP.label}
                                    </h3>
                                    <div className="flex-1" />
                                    <span className="text-[10px] text-muted-foreground">
                                        {featureAddons.filter(a => !!activeAddons[a.id]).length}/{featureAddons.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {featureAddons.map(addon => renderAddonCard(addon, FEATURE_GROUP))}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-2 pt-3 border-t text-xs text-muted-foreground">
                            <Shield className="h-3.5 w-3.5 shrink-0" />
                            <span>
                                {isVi
                                    ? 'Add-on sẽ được tính vào hóa đơn hàng tháng. Hủy bất cứ lúc nào.'
                                    : 'Add-ons are billed monthly. Cancel anytime with no penalty.'}
                            </span>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
