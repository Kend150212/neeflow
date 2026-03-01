'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    CreditCard, Zap, Calendar, AlertCircle, CheckCircle2,
    ExternalLink, ArrowUpRight, Clock, Check, X, ImageIcon, KeyRound, HardDrive, Bot, Code2, Plus,
    Receipt, Download, AlertTriangle, RefreshCw, Loader2, DollarSign, XCircle,
} from 'lucide-react'
import { UpgradeModal } from '@/components/billing/UpgradeModal'
import { AddonModal } from '@/components/billing/AddonModal'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

type BillingInfo = {
    plan: {
        planName: string
        planNameVi: string
        priceMonthly: number
        priceAnnual: number
        billingInterval: string
        status: string
        currentPeriodEnd: string | null
        cancelAtPeriodEnd: boolean
        maxChannels: number
        maxPostsPerMonth: number
        maxMembersPerChannel: number
        maxStorageMB: number
        maxAiImagesPerMonth: number
        maxAiTextPerMonth: number
        maxApiCallsPerMonth: number
        hasAutoSchedule: boolean
        hasWebhooks: boolean
        hasAdvancedReports: boolean
        hasPrioritySupport: boolean
        hasWhiteLabel: boolean
        isInTrial: boolean
        daysLeftInTrial: number
    }
    subscription: {
        status: string
        billingInterval: string
        currentPeriodEnd: string | null
        trialEndsAt: string | null
        cancelAtPeriodEnd: boolean
        hasStripeSubscription: boolean
    } | null
    usage: {
        postsThisMonth: number
        channelCount: number
        month: string
        imagesThisMonth: number
        apiCallsThisMonth: number
    }
    aiImage: {
        hasByokKey: boolean
        byokProvider: string | null
        maxPerMonth: number
    }
    activeAddons: {
        id: string
        displayName: string
        displayNameVi: string
        category: string
        quotaField: string | null
        quotaAmount: number
        featureField: string | null
        icon: string
        priceMonthly: number
        priceAnnual: number
        quantity: number
    }[]
    effectiveLimits: Record<string, number | boolean> | null
}

type Invoice = {
    id: string
    number: string | null
    status: string | null
    amountPaid: number
    amountDue: number
    currency: string
    periodStart: number
    periodEnd: number
    created: number
    invoicePdf: string | null
    hostedInvoiceUrl: string | null
    description: string | null
    lines: {
        description: string | null
        amount: number
        currency: string
        period: { start: number; end: number }
    }[]
}

type PaymentMethod = {
    id: string
    type: string
    card: {
        brand: string
        last4: string
        expMonth: number
        expYear: number
        funding: string
    } | null
    billingDetails: {
        name: string | null
        email: string | null
    }
} | null

function fmtStorage(mb: number, unlimited: string): string {
    if (mb === -1) return `∞ ${unlimited}`
    if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`
    return `${mb} MB`
}

function fmtCurrency(cents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(cents / 100)
}

function fmtDate(iso: string | number): string {
    const d = typeof iso === 'number' ? new Date(iso * 1000) : new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Card brand helpers
function cardBrandLabel(brand: string): string {
    const map: Record<string, string> = {
        visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express',
        discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay',
        diners: 'Diners Club', unknown: 'Card',
    }
    return map[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1)
}

function cardBrandColor(brand: string): string {
    const map: Record<string, string> = {
        visa: 'text-blue-400', mastercard: 'text-orange-400',
        amex: 'text-sky-400', discover: 'text-amber-400',
    }
    return map[brand] ?? 'text-muted-foreground'
}

const STATUS_COLORS: Record<string, string> = {
    paid: 'bg-emerald-500/10 text-emerald-500',
    open: 'bg-orange-500/10 text-orange-500',
    draft: 'bg-muted text-muted-foreground',
    void: 'bg-muted text-muted-foreground',
    uncollectible: 'bg-red-500/10 text-red-500',
}


export default function BillingPage() {
    const [info, setInfo] = useState<BillingInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [upgradeOpen, setUpgradeOpen] = useState(false)
    const [addonOpen, setAddonOpen] = useState(false)
    const [portalLoading, setPortalLoading] = useState(false)
    const [cancelLoading, setCancelLoading] = useState(false)
    const [removingAddon, setRemovingAddon] = useState<string | null>(null)
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [invoicesLoading, setInvoicesLoading] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null)
    const [pmLoading, setPmLoading] = useState(false)

    const t = useTranslation()
    const isVi = t('lang') === 'vi'

    const fetchBilling = useCallback(() => {
        return fetch('/api/billing')
            .then(r => r.json())
            .then(data => setInfo(data))
    }, [])

    useEffect(() => {
        setLoading(true)
        fetchBilling().finally(() => setLoading(false))
    }, [fetchBilling])

    // Fetch invoices + payment method when Stripe subscription exists
    useEffect(() => {
        if (!info?.subscription?.hasStripeSubscription) return
        setInvoicesLoading(true)
        setPmLoading(true)
        // Invoices
        fetch('/api/billing/invoices')
            .then(r => r.json())
            .then(data => setInvoices(data.invoices ?? []))
            .catch(() => { })
            .finally(() => setInvoicesLoading(false))
        // Payment method
        fetch('/api/billing/payment-method')
            .then(r => r.json())
            .then(data => setPaymentMethod(data.paymentMethod ?? null))
            .catch(() => { })
            .finally(() => setPmLoading(false))
    }, [info?.subscription?.hasStripeSubscription])

    const openPortal = async () => {
        setPortalLoading(true)
        try {
            const res = await fetch('/api/billing/portal', { method: 'POST' })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                const msg = isVi ? (data.errorVi ?? data.error) : (data.error ?? 'Failed to open billing portal')
                toast.error(msg)
            }
        } catch {
            toast.error(isVi ? 'Không thể mở cổng thanh toán' : 'Failed to open billing portal')
        } finally {
            setPortalLoading(false)
        }
    }

    const handleCancelPlan = async () => {
        if (!confirm(isVi
            ? 'Bạn có chắc muốn hủy? Bạn vẫn có thể sử dụng đến hết kỳ thanh toán.'
            : 'Are you sure you want to cancel? You can still use the plan until the billing period ends.'
        )) return

        setCancelLoading(true)
        const res = await fetch('/api/billing/cancel', { method: 'POST' })
        const data = await res.json()
        if (res.ok) {
            toast.success(isVi ? 'Đã lên lịch hủy subscription' : 'Cancellation scheduled')
            fetchBilling()
        } else {
            toast.error(data.error || 'Failed to cancel')
        }
        setCancelLoading(false)
    }

    const handleResumePlan = async () => {
        setCancelLoading(true)
        const res = await fetch('/api/billing/resume', { method: 'POST' })
        const data = await res.json()
        if (res.ok) {
            toast.success(isVi ? 'Đã tiếp tục subscription' : 'Subscription resumed')
            fetchBilling()
        } else {
            toast.error(data.error || 'Failed to resume')
        }
        setCancelLoading(false)
    }

    const handleRemoveAddon = async (addonId: string, addonName: string) => {
        if (!confirm(isVi
            ? `Bạn có chắc muốn hủy "${addonName}"? Add-on sẽ bị gỡ ngay lập tức.`
            : `Remove "${addonName}"? The add-on will be removed immediately.`
        )) return
        setRemovingAddon(addonId)
        try {
            const res = await fetch('/api/billing/addon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addonId, action: 'cancel' }),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(isVi ? `Đã hủy ${addonName}` : `${addonName} removed`)
                fetchBilling()
            } else {
                toast.error(data.error || 'Failed to remove')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setRemovingAddon(null)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6 p-6 animate-pulse">
                <div className="h-8 w-48 bg-muted rounded" />
                <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
                </div>
            </div>
        )
    }

    if (!info) return null

    const { plan, subscription, usage, aiImage } = info
    const isFree = plan.planName === 'Free' && !plan.isInTrial
    const postsPercent = plan.maxPostsPerMonth === -1 ? 0 : Math.min(100, (usage.postsThisMonth / plan.maxPostsPerMonth) * 100)
    const channelsPercent = plan.maxChannels === -1 ? 0 : Math.min(100, (usage.channelCount / plan.maxChannels) * 100)
    const imagesPercent = aiImage.maxPerMonth <= 0 ? 0 : Math.min(100, (usage.imagesThisMonth / aiImage.maxPerMonth) * 100)
    const apiPercent = plan.maxApiCallsPerMonth <= 0 ? 0 : Math.min(100, (usage.apiCallsThisMonth / plan.maxApiCallsPerMonth) * 100)

    const statusColor = subscription?.status === 'active' ? 'text-green-500' : subscription?.status === 'past_due' ? 'text-red-500' : 'text-orange-500'
    const StatusIcon = subscription?.status === 'active' ? CheckCircle2 : AlertCircle

    // Monthly total = plan + addons
    const planPrice = subscription?.billingInterval === 'annual'
        ? +(plan.priceAnnual / 12).toFixed(2)
        : +plan.priceMonthly
    const addonsTotal = (info.activeAddons ?? []).reduce((sum, a) => {
        const price = subscription?.billingInterval === 'annual' && a.priceAnnual
            ? +(a.priceAnnual / 12).toFixed(2)
            : +a.priceMonthly
        return sum + price * a.quantity
    }, 0)
    const monthlyTotal = planPrice + addonsTotal

    return (
        <div className="space-y-6 p-6 max-w-5xl">
            <div>
                <h1 className="text-2xl font-bold">{t('billing.title')}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t('billing.description')}</p>
            </div>

            <Tabs defaultValue="plan">
                <TabsList className="w-full max-w-xs">
                    <TabsTrigger value="plan" className="flex-1 gap-1.5">
                        <CreditCard className="h-3.5 w-3.5" />
                        {isVi ? 'Gói & Sử dụng' : 'Plan & Usage'}
                    </TabsTrigger>
                    <TabsTrigger value="payment" className="flex-1 gap-1.5">
                        <Receipt className="h-3.5 w-3.5" />
                        {isVi ? 'Thanh toán' : 'Payments'}
                    </TabsTrigger>
                </TabsList>

                {/* ═══════════════════ TAB 1: Plan & Usage ═══════════════════ */}
                <TabsContent value="plan" className="space-y-6 mt-6">

                    {/* Trial banner */}
                    {plan.isInTrial && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm">
                            <Zap className="h-4 w-4 shrink-0" />
                            <span>{t('billing.trialNote').replace('{days}', String(plan.daysLeftInTrial))}</span>
                            <Button size="sm" className="ml-auto h-7 text-xs gap-1" onClick={() => setUpgradeOpen(true)}>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                {t('billing.upgrade')}
                            </Button>
                        </div>
                    )}

                    {/* Cancel-at-period-end warning */}
                    {subscription?.cancelAtPeriodEnd && (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-sm">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>
                                    {isVi
                                        ? `Subscription sẽ hủy vào ${fmtDate(subscription.currentPeriodEnd ?? '')}. Bạn vẫn sử dụng được đến lúc đó.`
                                        : `Subscription cancels on ${fmtDate(subscription.currentPeriodEnd ?? '')}. You can keep using it until then.`
                                    }
                                </span>
                            </div>
                            <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs gap-1.5 shrink-0 border-orange-500/40 hover:bg-orange-500/10"
                                onClick={handleResumePlan} disabled={cancelLoading}
                            >
                                {cancelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                {isVi ? 'Tiếp tục dùng' : 'Resume Plan'}
                            </Button>
                        </div>
                    )}

                    {/* Current Plan + Monthly Total */}
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Plan Card */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    {t('billing.currentPlan')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <div className="text-xl font-bold flex items-center gap-2">
                                            {plan.planName}
                                            {!isFree && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {subscription?.billingInterval === 'annual' ? t('billing.annual') : t('billing.monthly')}
                                                </Badge>
                                            )}
                                            {plan.isInTrial && (
                                                <Badge className="text-xs bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                                                    {t('billing.trial')}
                                                </Badge>
                                            )}
                                        </div>
                                        {subscription && (
                                            <div className={`flex items-center gap-1.5 text-sm mt-1 ${statusColor}`}>
                                                <StatusIcon className="h-3.5 w-3.5" />
                                                <span className="capitalize">{subscription.status.replace('_', ' ')}</span>
                                            </div>
                                        )}
                                        {subscription?.currentPeriodEnd && !subscription.cancelAtPeriodEnd && (() => {
                                            const daysLeft = Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86400000))
                                            // Detect trial: Stripe status OR trialEndsAt still in future
                                            const isTrialing = subscription.status === 'trialing'
                                                || plan.isInTrial
                                                || (!!subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() > Date.now())
                                            const color = daysLeft <= 3
                                                ? 'text-red-500 bg-red-500/10 border-red-500/25'
                                                : daysLeft <= 7
                                                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/25'
                                                    : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25'
                                            return (
                                                <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>
                                                    {isTrialing
                                                        ? <Zap className="h-3 w-3" />
                                                        : <Clock className="h-3 w-3" />}
                                                    {daysLeft === 0
                                                        ? 'Expires today'
                                                        : daysLeft === 1
                                                            ? '1 day remaining'
                                                            : `${daysLeft} days remaining`}
                                                </div>
                                            )
                                        })()}
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                        {isFree ? (
                                            // Free plan — show Upgrade CTA
                                            <Button onClick={() => setUpgradeOpen(true)} className="gap-2">
                                                <Zap className="h-4 w-4" />
                                                {t('billing.upgrade')}
                                            </Button>
                                        ) : plan.isInTrial ? (
                                            // Trial — show prominent Upgrade (no Change/Cancel during trial)
                                            <Button onClick={() => setUpgradeOpen(true)} className="gap-2">
                                                <Zap className="h-4 w-4" />
                                                {isVi ? 'Nâng cấp Plan' : 'Upgrade Plan'}
                                            </Button>
                                        ) : (
                                            // Paid subscription — show full set of actions
                                            <>
                                                <Button variant="outline" onClick={() => setUpgradeOpen(true)} className="gap-1">
                                                    <ArrowUpRight className="h-4 w-4" />
                                                    {t('billing.changePlan')}
                                                </Button>
                                                {/* Cancel Plan — show for any active sub that is not already canceling */}
                                                {!subscription?.cancelAtPeriodEnd && (
                                                    <Button
                                                        variant="outline"
                                                        className="gap-1 text-destructive hover:text-destructive border-destructive/30"
                                                        onClick={handleCancelPlan}
                                                        disabled={cancelLoading}
                                                    >
                                                        {cancelLoading
                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                            : <XCircle className="h-4 w-4" />
                                                        }
                                                        {isVi ? 'Hủy Plan' : 'Cancel Plan'}
                                                    </Button>
                                                )}
                                                {subscription?.hasStripeSubscription && (
                                                    <Button variant="outline" onClick={openPortal} disabled={portalLoading} className="gap-1">
                                                        <ExternalLink className="h-4 w-4" />
                                                        {t('billing.manageBilling')}
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Monthly Total Card */}
                        <Card className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    {isVi ? 'Tổng / Tháng' : 'Monthly Total'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-between gap-3">
                                <div>
                                    <div className="text-3xl font-bold">
                                        ${monthlyTotal.toFixed(2)}
                                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                                    </div>
                                    {subscription?.billingInterval === 'annual' && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isVi ? 'Tính theo gói năm' : 'Billed annually'}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>{plan.planName}</span>
                                        <span>${planPrice.toFixed(2)}</span>
                                    </div>
                                    {(info.activeAddons ?? []).map(a => {
                                        const p = subscription?.billingInterval === 'annual' && a.priceAnnual
                                            ? +(a.priceAnnual / 12).toFixed(2) : +a.priceMonthly
                                        return (
                                            <div key={a.id} className="flex justify-between text-muted-foreground">
                                                <span className="truncate">{isVi && a.displayNameVi ? a.displayNameVi : a.displayName}</span>
                                                <span className="ml-2 shrink-0">+${(p * a.quantity).toFixed(2)}</span>
                                            </div>
                                        )
                                    })}
                                    {addonsTotal > 0 && (
                                        <div className="flex justify-between font-semibold border-t border-border/50 pt-1 mt-1">
                                            <span>Total</span>
                                            <span>${monthlyTotal.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Usage Cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {t('billing.postsThisMonth')} ({usage.month})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-bold">{usage.postsThisMonth}</span>
                                    <span className="text-sm text-muted-foreground">
                                        / {plan.maxPostsPerMonth === -1 ? '∞' : plan.maxPostsPerMonth}
                                    </span>
                                </div>
                                {plan.maxPostsPerMonth !== -1 && <Progress value={postsPercent} className={`h-2 ${postsPercent >= 100 ? '[&>div]:bg-red-500' : postsPercent >= 80 ? '[&>div]:bg-orange-500' : ''}`} />}
                                {plan.maxPostsPerMonth !== -1 && postsPercent >= 100 && <p className="text-xs text-red-500">Đã đạt giới hạn — nâng cấp gói để tạo thêm bài.</p>}
                                {plan.maxPostsPerMonth === -1 && <p className="text-xs text-green-500">{t('billing.unlimited')}</p>}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {t('billing.channels')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-bold">{usage.channelCount}</span>
                                    <span className="text-sm text-muted-foreground">
                                        / {plan.maxChannels === -1 ? '∞' : plan.maxChannels}
                                    </span>
                                </div>
                                {plan.maxChannels !== -1 && <Progress value={channelsPercent} className="h-2" />}
                                {plan.maxChannels === -1 && <p className="text-xs text-green-500">{t('billing.unlimited')}</p>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* AI Images */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <ImageIcon className="h-4 w-4" />
                                {t('billing.aiImages')} ({usage.month})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {aiImage.hasByokKey && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                                    <KeyRound className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>{t('billing.byokActive').replace('{provider}', aiImage.byokProvider ?? '')}</span>
                                </div>
                            )}
                            <div className="flex items-end justify-between">
                                <span className="text-2xl font-bold">{usage.imagesThisMonth}</span>
                                <span className="text-sm text-muted-foreground">
                                    / {aiImage.maxPerMonth === -1
                                        ? `∞ ${t('billing.unlimited').toLowerCase()}`
                                        : aiImage.maxPerMonth === 0 ? t('billing.byokOnly') : aiImage.maxPerMonth}
                                </span>
                            </div>
                            {aiImage.maxPerMonth > 0 && aiImage.maxPerMonth !== -1 && (
                                <Progress value={imagesPercent} className={`h-2 ${imagesPercent >= 90 ? '[&>div]:bg-red-500' : imagesPercent >= 70 ? '[&>div]:bg-orange-500' : ''}`} />
                            )}
                            {aiImage.maxPerMonth === -1 && <p className="text-xs text-green-500">{t('billing.unlimited')}</p>}
                            {aiImage.maxPerMonth === 0 && !aiImage.hasByokKey && <p className="text-xs text-orange-500">{t('billing.noAiQuota')}</p>}
                            {aiImage.maxPerMonth > 0 && imagesPercent >= 90 && !aiImage.hasByokKey && <p className="text-xs text-red-500">{t('billing.nearLimit')}</p>}
                        </CardContent>
                    </Card>

                    {/* API Calls */}
                    {plan.maxApiCallsPerMonth !== 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Code2 className="h-4 w-4" />
                                    API Calls ({usage.month})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-bold">{usage.apiCallsThisMonth.toLocaleString()}</span>
                                    <span className="text-sm text-muted-foreground">
                                        / {plan.maxApiCallsPerMonth === -1
                                            ? `∞ ${t('billing.unlimited').toLowerCase()}`
                                            : plan.maxApiCallsPerMonth.toLocaleString()}
                                    </span>
                                </div>
                                {plan.maxApiCallsPerMonth > 0 && plan.maxApiCallsPerMonth !== -1 && (
                                    <Progress value={apiPercent} className={`h-2 ${apiPercent >= 90 ? '[&>div]:bg-red-500' : apiPercent >= 70 ? '[&>div]:bg-orange-500' : ''}`} />
                                )}
                                {plan.maxApiCallsPerMonth === -1 && <p className="text-xs text-green-500">{t('billing.unlimited')}</p>}
                                {plan.maxApiCallsPerMonth > 0 && apiPercent >= 90 && <p className="text-xs text-red-500">{t('billing.nearLimit')}</p>}
                                <p className="text-xs text-muted-foreground">
                                    Manage your API keys in <a href="/dashboard/developer" className="text-primary underline">Developer API</a>
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Active Add-ons */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                Add-ons
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {(info.activeAddons ?? []).length > 0 ? (
                                <div className="divide-y divide-border/40">
                                    {info.activeAddons.map(addon => {
                                        const name = isVi && addon.displayNameVi ? addon.displayNameVi : addon.displayName
                                        const isRemoving = removingAddon === addon.id
                                        return (
                                            <div key={addon.id} className="flex items-center justify-between py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                                        {addon.category === 'quota' ? 'Quota' : 'Feature'}
                                                    </Badge>
                                                    <span className="text-sm">{name}</span>
                                                    {addon.quantity > 1 && <span className="text-xs text-muted-foreground">×{addon.quantity}</span>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-muted-foreground">${addon.priceMonthly}/mo</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        disabled={isRemoving}
                                                        onClick={() => handleRemoveAddon(addon.id, name)}
                                                    >
                                                        {isRemoving
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <XCircle className="h-3 w-3" />
                                                        }
                                                        {isVi ? 'Hủy' : 'Remove'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {isVi ? 'Chưa có add-on nào. Thêm add-on để mở rộng plan của bạn.' : 'No add-ons yet. Browse add-ons to expand your plan.'}
                                </p>
                            )}
                            <Button variant="outline" className="gap-2 w-full" onClick={() => setAddonOpen(true)}>
                                <Plus className="h-4 w-4" />
                                {isVi ? 'Xem & Quản lý Add-ons' : 'Browse & Manage Add-ons'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Plan Features */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                {t('billing.planFeatures')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                                {[
                                    { icon: <Zap className="h-3.5 w-3.5 text-muted-foreground" />, label: t('billing.maxChannels'), value: plan.maxChannels === -1 ? '∞' : plan.maxChannels },
                                    { icon: <Bot className="h-3.5 w-3.5 text-muted-foreground" />, label: t('billing.aiPostsMonth'), value: plan.maxPostsPerMonth === -1 ? '∞' : plan.maxPostsPerMonth },
                                    { icon: <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />, label: t('billing.aiImagesMonth'), value: plan.maxAiImagesPerMonth === -1 ? '∞' : plan.maxAiImagesPerMonth === 0 ? t('billing.byokOnly') : plan.maxAiImagesPerMonth },
                                    { icon: <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />, label: 'Storage', value: fmtStorage(plan.maxStorageMB, t('billing.unlimited')) },
                                    { icon: <Code2 className="h-3.5 w-3.5 text-muted-foreground" />, label: 'API Calls/Month', value: plan.maxApiCallsPerMonth === -1 ? '∞' : plan.maxApiCallsPerMonth === 0 ? 'Disabled' : plan.maxApiCallsPerMonth.toLocaleString() },
                                    { icon: <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />, label: t('billing.membersPerChannel'), value: plan.maxMembersPerChannel === -1 ? '∞' : plan.maxMembersPerChannel },
                                ].map(({ icon, label, value }) => (
                                    <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
                                        <span className="font-semibold text-sm">{value}</span>
                                    </div>
                                ))}
                                {[
                                    { label: t('billing.autoSchedule'), value: plan.hasAutoSchedule },
                                    { label: t('billing.webhooks'), value: plan.hasWebhooks },
                                    { label: t('billing.advancedReports'), value: plan.hasAdvancedReports },
                                    { label: t('billing.prioritySupport'), value: plan.hasPrioritySupport },
                                    { label: t('billing.whiteLabel'), value: plan.hasWhiteLabel },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                        <span className="text-sm text-muted-foreground">{label}</span>
                                        {value ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-muted-foreground/40" />}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                </TabsContent>{/* end Tab 1: Plan & Usage */}

                {/* ═══════════════════ TAB 2: Payments ═══════════════════ */}
                <TabsContent value="payment" className="space-y-6 mt-6">

                    {/* Payment Method Card */}
                    {subscription?.hasStripeSubscription && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    {isVi ? 'Phương thức thanh toán' : 'Payment Method'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {pmLoading ? (
                                    <div className="flex items-center gap-2 text-muted-foreground py-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">{isVi ? 'Đang tải...' : 'Loading...'}</span>
                                    </div>
                                ) : paymentMethod?.card ? (
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        {/* Card display */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-9 rounded-md bg-muted/60 border border-border flex items-center justify-center">
                                                <CreditCard className={`h-5 w-5 ${cardBrandColor(paymentMethod.card.brand)}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-semibold text-sm ${cardBrandColor(paymentMethod.card.brand)}`}>
                                                        {cardBrandLabel(paymentMethod.card.brand)}
                                                    </span>
                                                    <span className="text-sm font-mono tracking-widest">
                                                        &bull;&bull;&bull;&bull; {paymentMethod.card.last4}
                                                    </span>
                                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 capitalize">
                                                        {paymentMethod.card.funding}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {isVi ? 'Hết hạn' : 'Expires'}{' '}
                                                    {String(paymentMethod.card.expMonth).padStart(2, '0')}/{paymentMethod.card.expYear}
                                                    {paymentMethod.billingDetails.name && (
                                                        <span className="ml-2">&middot; {paymentMethod.billingDetails.name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Change Card via Stripe Portal */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5"
                                            onClick={openPortal}
                                            disabled={portalLoading}
                                        >
                                            {portalLoading
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : <CreditCard className="h-3.5 w-3.5" />
                                            }
                                            {isVi ? 'Đổi thẻ' : 'Change Card'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="text-sm text-muted-foreground">
                                            {isVi ? 'Chưa có thẻ thanh toán được lưu.' : 'No payment card on file.'}
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5"
                                            onClick={openPortal}
                                            disabled={portalLoading}
                                        >
                                            {portalLoading
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : <CreditCard className="h-3.5 w-3.5" />
                                            }
                                            {isVi ? 'Thêm thẻ' : 'Add Card'}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Payment History — Stripe subs: real invoices; manual subs: note */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Receipt className="h-4 w-4" />
                                {isVi ? 'Lịch sử thanh toán' : 'Payment History'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!subscription?.hasStripeSubscription ? (
                                <div className="flex flex-col items-center gap-3 py-6">
                                    <Receipt className="h-8 w-8 text-muted-foreground/40" />
                                    <p className="text-sm text-muted-foreground text-center">
                                        {isVi
                                            ? 'Subscription được kích hoạt thủ công — không có hóa đơn tự động. Liên hệ admin để được hỗ trợ.'
                                            : 'This subscription was set up manually — no automatic invoices are generated. Contact support for billing details.'
                                        }
                                    </p>
                                </div>
                            ) : invoicesLoading ? (
                                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">{isVi ? '\u0110ang t\u1ea3i...' : 'Loading...'}</span>
                                </div>
                            ) : invoices.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    {isVi ? 'Ch\u01b0a c\u00f3 h\u00f3a \u0111\u01a1n n\u00e0o.' : 'No invoices yet.'}
                                </p>
                            ) : (
                                <div className="overflow-x-auto -mx-2">
                                    <table className="w-full text-sm min-w-[500px]">
                                        <thead>
                                            <tr className="text-xs text-muted-foreground border-b border-border/50">
                                                <th className="text-left py-2 px-2 font-medium">{isVi ? 'Ng\u00e0y' : 'Date'}</th>
                                                <th className="text-left py-2 px-2 font-medium">{isVi ? 'M\u00f4 t\u1ea3' : 'Description'}</th>
                                                <th className="text-right py-2 px-2 font-medium">{isVi ? 'S\u1ed1 ti\u1ec1n' : 'Amount'}</th>
                                                <th className="text-center py-2 px-2 font-medium">{isVi ? 'Tr\u1ea1ng th\u00e1i' : 'Status'}</th>
                                                <th className="text-right py-2 px-2 font-medium"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {invoices.map(inv => (
                                                <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="py-3 px-2 text-muted-foreground text-xs whitespace-nowrap">
                                                        {fmtDate(inv.created)}
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <div className="font-medium leading-snug">
                                                            {inv.description || inv.lines[0]?.description || (isVi ? '\u0110\u0103ng k\u00fd d\u1ecbch v\u1ee5' : 'Subscription')}
                                                        </div>
                                                        {inv.number && (
                                                            <div className="text-[10px] text-muted-foreground">#{inv.number}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">
                                                        {fmtCurrency(inv.status === 'paid' ? inv.amountPaid : inv.amountDue, inv.currency)}
                                                    </td>
                                                    <td className="py-3 px-2 text-center">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[inv.status ?? 'draft'] ?? 'bg-muted text-muted-foreground'}`}>
                                                            {inv.status === 'paid' ? (isVi ? '\u0110\u00e3 thanh to\u00e1n' : 'Paid')
                                                                : inv.status === 'open' ? (isVi ? 'Ch\u01b0a thanh to\u00e1n' : 'Open')
                                                                    : inv.status === 'void' ? (isVi ? '\u0110\u00e3 h\u1ee7y' : 'Void')
                                                                        : inv.status ?? 'Unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-2 text-right">
                                                        {inv.invoicePdf && (
                                                            <a
                                                                href={inv.invoicePdf}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                            >
                                                                <Download className="h-3 w-3" />
                                                                PDF
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </TabsContent>{/* end Tab 2: Payments */}
            </Tabs>

            <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
            <AddonModal open={addonOpen} onClose={() => setAddonOpen(false)} onPurchased={fetchBilling} />
        </div>
    )
}
