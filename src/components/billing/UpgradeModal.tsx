'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Zap, Building2, Rocket, Crown, AlertTriangle, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Simple locale detection — reads from localStorage (same as sidebar lang switcher)
function useLocale() {
    const [locale, setLocale] = useState('en')
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setLocale(localStorage.getItem('language') || 'en')
        }
    }, [])
    return locale
}

export type UpgradeReason = {
    feature: string
    limit?: number
    current?: number
    message: string
    messageVi: string
}

interface UpgradeModalProps {
    open: boolean
    onClose: () => void
    reason?: UpgradeReason
}

type Plan = {
    id: string
    name: string
    nameVi: string
    priceMonthly: number
    priceAnnual: number
    maxChannels: number
    maxPostsPerMonth: number
    maxMembersPerChannel: number
    hasAutoSchedule: boolean
    hasWebhooks: boolean
    hasAdvancedReports: boolean
    hasPrioritySupport: boolean
    hasWhiteLabel: boolean
    stripePriceIdMonthly: string | null
    stripePriceIdAnnual: string | null
}

// Per-plan color config
const planStyles: Record<string, {
    gradient: string
    border: string
    glow: string
    badge: string
    button: string
    icon: React.ReactNode
    tag?: string
    tagColor?: string
}> = {
    Pro: {
        gradient: 'from-blue-600/20 via-blue-500/10 to-transparent',
        border: 'border-blue-500/40',
        glow: 'shadow-blue-500/20',
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        button: 'bg-blue-600 hover:bg-blue-500 text-white',
        icon: <Rocket className="h-5 w-5 text-blue-400" />,
    },
    Business: {
        gradient: 'from-violet-600/20 via-violet-500/10 to-transparent',
        border: 'border-violet-500/40',
        glow: 'shadow-violet-500/20',
        badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
        button: 'bg-violet-600 hover:bg-violet-500 text-white',
        icon: <Building2 className="h-5 w-5 text-violet-400" />,
        tag: 'Most Popular',
        tagColor: 'bg-violet-500',
    },
    Enterprise: {
        gradient: 'from-amber-500/20 via-amber-400/10 to-transparent',
        border: 'border-amber-500/40',
        glow: 'shadow-amber-500/20',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        button: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white',
        icon: <Crown className="h-5 w-5 text-amber-400" />,
        tag: 'Enterprise',
        tagColor: 'bg-amber-500',
    },
}

const defaultStyle = {
    gradient: 'from-slate-600/20 to-transparent',
    border: 'border-slate-500/30',
    glow: 'shadow-slate-500/10',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    button: 'bg-slate-600 hover:bg-slate-500 text-white',
    icon: <Zap className="h-5 w-5 text-slate-400" />,
}

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
    const locale = useLocale()
    const [plans, setPlans] = useState<Plan[]>([])
    const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
    const [loading, setLoading] = useState<string | null>(null)
    const [coupon, setCoupon] = useState('')
    const [currentPlanName, setCurrentPlanName] = useState<string | null>(null)
    const [currentPlanPrice, setCurrentPlanPrice] = useState<number>(0)
    const [downgradeConfirm, setDowngradeConfirm] = useState<{
        planId: string
        planName: string
        price: number
    } | null>(null)

    useEffect(() => {
        if (open) {
            fetch('/api/billing/plans')
                .then(r => r.json())
                .then(setPlans)
                .catch(console.error)
            // Get current user plan for button state
            fetch('/api/billing')
                .then(r => r.json())
                .then(data => {
                    setCurrentPlanName(data?.plan?.planName ?? null)
                    setCurrentPlanPrice(data?.plan?.priceMonthly ?? 0)
                })
                .catch(console.error)
        }
    }, [open])

    const handleUpgrade = async (planId: string) => {
        setLoading(planId)
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, interval, couponCode: coupon || undefined }),
            })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            } else if (data.noStripePrice) {
                toast.error(
                    locale === 'vi'
                        ? 'Stripe chưa được thiết lập cho gói này. Vui lòng liên hệ admin.'
                        : 'Stripe not configured for this plan. Please contact your admin or set up Stripe price IDs.'
                )
            } else {
                toast.error(data.error ?? 'Checkout failed')
            }
        } catch (err) {
            console.error('Checkout error:', err)
            toast.error('Something went wrong')
        } finally {
            setLoading(null)
        }
    }

    const handleDowngrade = async () => {
        if (!downgradeConfirm) return
        setLoading(downgradeConfirm.planId)
        try {
            const res = await fetch('/api/billing/downgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: downgradeConfirm.planId, interval }),
            })
            const data = await res.json()
            if (data.ok) {
                if (data.effectiveDate) {
                    const date = new Date(data.effectiveDate).toLocaleDateString(
                        locale === 'vi' ? 'vi-VN' : 'en-US',
                        { year: 'numeric', month: 'long', day: 'numeric' }
                    )
                    const price = data.newPrice
                    const currency = (data.currency ?? 'USD').toUpperCase()
                    toast.success(
                        locale === 'vi'
                            ? `Đã hạ cấp xuống gói ${downgradeConfirm.planName}. Kể từ ${date}, bạn sẽ được tính phí $${price}/${interval === 'annual' ? 'năm' : 'tháng'} (${currency}).`
                            : `Downgraded to ${downgradeConfirm.planName}. Starting ${date}, you will be charged $${price}/${interval === 'annual' ? 'yr' : 'mo'} (${currency}).`,
                        { duration: 8000 }
                    )
                } else {
                    toast.success(
                        locale === 'vi'
                            ? `Đã chuyển xuống gói ${downgradeConfirm.planName} thành công.`
                            : `Switched to ${downgradeConfirm.planName} plan.`
                    )
                }
                setDowngradeConfirm(null)
                onClose()
            } else if (data.noStripePrice) {
                toast.error(
                    locale === 'vi'
                        ? 'Stripe chưa được thiết lập cho gói này.'
                        : 'Stripe not configured for this plan.'
                )
            } else {
                toast.error(data.error ?? 'Downgrade failed')
            }
        } catch (err) {
            console.error('Downgrade error:', err)
            toast.error('Something went wrong')
        } finally {
            setLoading(null)
        }
    }

    // Show all paid plans (priceMonthly > 0 OR has a Stripe price configured)
    const paidPlans = plans.filter(p => p.priceMonthly > 0 || !!p.stripePriceIdMonthly)
    // A plan is "contact sales" only if it has no price at all (custom pricing)
    const isContactSales = (plan: Plan) => plan.priceMonthly === 0 && !plan.stripePriceIdMonthly

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                style={{ maxWidth: 'min(1024px, 95vw)', width: '95vw' }}
                className="max-h-[92vh] overflow-y-auto bg-[#0d0d0d] border border-white/10 p-0 rounded-2xl [&>button:last-of-type]:hidden">
                {/* Header */}
                <div className="px-8 pt-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-2xl font-bold">
                            <span className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <Zap className="h-5 w-5 text-yellow-400" />
                            </span>
                            {currentPlanName && currentPlanName !== 'Free'
                                ? (locale === 'vi' ? 'Thay đổi gói dịch vụ' : 'Change Your Plan')
                                : (locale === 'vi' ? 'Nâng cấp gói dịch vụ' : 'Upgrade Your Plan')
                            }
                        </DialogTitle>
                        {reason && (
                            <DialogDescription className="text-sm text-red-400 mt-1">
                                {locale === 'vi' ? reason.messageVi : reason.message}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {/* Toggle */}
                    <div className="flex items-center gap-1 mt-5 bg-white/5 rounded-full p-1 w-fit">
                        {['monthly', 'annual'].map((v) => (
                            <button
                                key={v}
                                onClick={() => setInterval(v as 'monthly' | 'annual')}
                                className={`text-sm px-5 py-1.5 rounded-full transition-all duration-200 font-medium ${interval === v
                                    ? 'bg-white text-black shadow'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {v === 'monthly'
                                    ? (locale === 'vi' ? 'Hàng tháng' : 'Monthly')
                                    : (locale === 'vi' ? 'Hàng năm' : 'Annual')}
                                {v === 'annual' && (
                                    <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                        {locale === 'vi' ? '-17%' : '2 free'}
                                    </Badge>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Plans grid */}
                <div className={`grid grid-cols-1 gap-4 px-8 pb-6 ${paidPlans.length <= 3 ? 'md:grid-cols-' + paidPlans.length : 'md:grid-cols-3'}`}>
                    {paidPlans.map((plan) => {
                        const style = planStyles[plan.name] ?? defaultStyle
                        const price = interval === 'annual' ? plan.priceAnnual : plan.priceMonthly
                        const priceLabel = price === 0
                            ? (locale === 'vi' ? 'Liên hệ' : 'Contact us')
                            : `$${price}`
                        const per = price === 0 ? '' : (interval === 'annual'
                            ? (locale === 'vi' ? '/năm' : '/yr')
                            : (locale === 'vi' ? '/tháng' : '/mo'))
                        const hasPriceId = interval === 'annual' ? !!plan.stripePriceIdAnnual : !!plan.stripePriceIdMonthly
                        const contactSales = isContactSales(plan)
                        // Current plan detection: match by name, fallback to priceMonthly
                        const isCurrent = currentPlanName
                            ? plan.name === currentPlanName
                            : plan.priceMonthly === currentPlanPrice
                        // Downgrade if the plan costs less than the current plan
                        const isDowngrade = !isCurrent && plan.priceMonthly < currentPlanPrice

                        const features = [
                            plan.maxChannels === -1
                                ? (locale === 'vi' ? '∞ kênh' : 'Unlimited channels')
                                : `${plan.maxChannels} ${locale === 'vi' ? 'kênh' : 'channels'}`,
                            plan.maxPostsPerMonth === -1
                                ? (locale === 'vi' ? '∞ bài đăng/tháng' : 'Unlimited posts/mo')
                                : `${plan.maxPostsPerMonth} ${locale === 'vi' ? 'bài/tháng' : 'posts/mo'}`,
                            plan.maxMembersPerChannel === -1
                                ? (locale === 'vi' ? '∞ thành viên/kênh' : 'Unlimited members')
                                : `${plan.maxMembersPerChannel} ${locale === 'vi' ? 'thành viên/kênh' : 'members/channel'}`,
                            ...(plan.hasAutoSchedule ? [locale === 'vi' ? 'Lên lịch tự động' : 'Auto scheduling'] : []),
                            ...(plan.hasWebhooks ? ['Webhooks'] : []),
                            ...(plan.hasAdvancedReports ? [locale === 'vi' ? 'Báo cáo nâng cao' : 'Advanced reports'] : []),
                            ...(plan.hasPrioritySupport ? [locale === 'vi' ? 'Hỗ trợ ưu tiên' : 'Priority support'] : []),
                            ...(plan.hasWhiteLabel ? ['White label'] : []),
                        ]

                        return (
                            <div
                                key={plan.id}
                                className={`relative rounded-2xl border ${isCurrent
                                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                                    : style.border
                                    } bg-gradient-to-b ${style.gradient} p-6 flex flex-col gap-5 shadow-xl ${style.glow} transition-all duration-300 hover:scale-[1.01]`}
                            >
                                {/* Popular badge */}
                                {style.tag && !isCurrent && (
                                    <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white ${style.tagColor}`}>
                                        {style.tag}
                                    </span>
                                )}
                                {/* Current plan badge */}
                                {isCurrent && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white bg-emerald-600">
                                        {locale === 'vi' ? 'Gói hiện tại' : 'Current Plan'}
                                    </span>
                                )}

                                {/* Plan header */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`p-1.5 rounded-lg border ${style.badge}`}>
                                            {style.icon}
                                        </span>
                                        <span className="font-bold text-lg">
                                            {locale === 'vi' ? plan.nameVi : plan.name}
                                        </span>
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <span className="text-4xl font-extrabold tracking-tight">{priceLabel}</span>
                                        {per && <span className="text-sm text-muted-foreground mb-1">{per}</span>}
                                    </div>
                                    {interval === 'annual' && price > 0 && (
                                        <p className="text-xs text-emerald-400 mt-1">
                                            {locale === 'vi'
                                                ? `Tiết kiệm $${Math.round(plan.priceMonthly * 12 - plan.priceAnnual)}/năm`
                                                : `Save $${Math.round(plan.priceMonthly * 12 - plan.priceAnnual)}/yr`}
                                        </p>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className={`h-px bg-gradient-to-r from-transparent via-white/10 to-transparent`} />

                                {/* Features */}
                                <ul className="space-y-2.5 flex-1">
                                    {features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2.5 text-sm">
                                            <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border ${style.badge}`}>
                                                <Check className="h-2.5 w-2.5" />
                                            </span>
                                            <span className="text-white/80">{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <button
                                    onClick={() => {
                                        if (isCurrent) return
                                        if (contactSales) {
                                            window.open('mailto:sales@yourdomain.com', '_blank')
                                        } else if (isDowngrade) {
                                            // Show in-modal confirmation before executing downgrade
                                            setDowngradeConfirm({
                                                planId: plan.id,
                                                planName: locale === 'vi' ? plan.nameVi : plan.name,
                                                price: interval === 'annual' ? plan.priceAnnual : plan.priceMonthly,
                                            })
                                        } else {
                                            handleUpgrade(plan.id)
                                        }
                                    }}
                                    disabled={!!loading || isCurrent}
                                    className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 ${isCurrent
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 cursor-default'
                                        : contactSales
                                            ? 'bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10'
                                            : isDowngrade
                                                ? 'bg-white/5 text-white border border-white/20 hover:bg-white/10'
                                                : style.button
                                        }`}
                                >
                                    {loading === plan.id
                                        ? (locale === 'vi' ? 'Đang xử lý...' : 'Processing...')
                                        : isCurrent
                                            ? (locale === 'vi' ? '✓ Gói hiện tại' : '✓ Current Plan')
                                            : contactSales
                                                ? (locale === 'vi' ? 'Liên hệ tư vấn' : 'Contact Sales')
                                                : isDowngrade
                                                    ? (locale === 'vi' ? '↓ Hạ cấp' : '↓ Downgrade')
                                                    : (locale === 'vi' ? '🚀 Nâng cấp ngay' : '🚀 Upgrade Now')
                                    }
                                </button>
                            </div>
                        )
                    })}
                </div>

                {/* Downgrade confirmation banner */}
                {downgradeConfirm && (
                    <div className="mx-8 mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-sm text-orange-300">
                                        {locale === 'vi'
                                            ? `Xác nhận hạ cấp xuống gói ${downgradeConfirm.planName}`
                                            : `Confirm downgrade to ${downgradeConfirm.planName}`
                                        }
                                    </p>
                                    <p className="text-xs text-orange-200/80 mt-1 leading-relaxed">
                                        {locale === 'vi'
                                            ? `Bạn sẽ tiếp tục dùng gói hiện tại đến hết chu kỳ thanh toán này. Kể từ chu kỳ tiếp theo, bạn sẽ được charge $${downgradeConfirm.price}/${interval === 'annual' ? 'năm' : 'tháng'} theo gói ${downgradeConfirm.planName}.`
                                            : `You’ll keep your current plan until this billing period ends. From the next cycle, you’ll be charged $${downgradeConfirm.price}/${interval === 'annual' ? 'yr' : 'mo'} on the ${downgradeConfirm.planName} plan.`
                                        }
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setDowngradeConfirm(null)} className="text-orange-400/60 hover:text-orange-300 transition-colors shrink-0">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleDowngrade}
                                disabled={!!loading}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-colors disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                {locale === 'vi' ? 'Xác nhận hạ cấp' : 'Confirm Downgrade'}
                            </button>
                            <button
                                onClick={() => setDowngradeConfirm(null)}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition-colors"
                            >
                                {locale === 'vi' ? 'Hủy' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Coupon */}
                <div className="px-8 pb-8">
                    <input
                        type="text"
                        value={coupon}
                        onChange={e => setCoupon(e.target.value)}
                        placeholder={locale === 'vi' ? '🏷️  Mã giảm giá (nếu có)' : '🏷️  Coupon code (optional)'}
                        className="w-full px-4 py-2.5 text-sm border border-white/10 rounded-xl bg-white/5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Feature({ label }: { label: string }) {
    return (
        <li className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span>{label}</span>
        </li>
    )
}

// Keep export for backwards compatibility
export { Feature }
