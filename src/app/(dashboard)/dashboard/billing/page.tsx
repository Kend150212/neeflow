'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    CreditCard, Zap, Calendar, AlertCircle, CheckCircle2,
    ExternalLink, ArrowUpRight, Clock, Check, X, ImageIcon, KeyRound, HardDrive, Bot, Code2, Plus
} from 'lucide-react'
import { UpgradeModal } from '@/components/billing/UpgradeModal'
import { AddonModal } from '@/components/billing/AddonModal'
import { useTranslation } from '@/lib/i18n'

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
        currentPeriodEnd: string
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
        quantity: number
    }[]
    effectiveLimits: Record<string, number | boolean> | null
}

function fmtStorage(mb: number, unlimited: string): string {
    if (mb === -1) return `∞ ${unlimited}`
    if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`
    return `${mb} MB`
}

export default function BillingPage() {
    const [info, setInfo] = useState<BillingInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [upgradeOpen, setUpgradeOpen] = useState(false)
    const [addonOpen, setAddonOpen] = useState(false)
    const [portalLoading, setPortalLoading] = useState(false)

    // Use the shared app i18n system — syncs with user's language choice
    const t = useTranslation()

    useEffect(() => {
        fetch('/api/billing')
            .then(r => r.json())
            .then(data => { setInfo(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const refreshBilling = () => {
        fetch('/api/billing')
            .then(r => r.json())
            .then(data => setInfo(data))
    }

    const openPortal = async () => {
        setPortalLoading(true)
        const res = await fetch('/api/billing/portal', { method: 'POST' })
        const data = await res.json()
        if (data.url) window.location.href = data.url
        setPortalLoading(false)
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
    // isFree = truly on free plan (no active paid subscription, not in trial)
    const isFree = plan.planName === 'Free' && !plan.isInTrial
    const postsPercent = plan.maxPostsPerMonth === -1 ? 0 : Math.min(100, (usage.postsThisMonth / plan.maxPostsPerMonth) * 100)
    const channelsPercent = plan.maxChannels === -1 ? 0 : Math.min(100, (usage.channelCount / plan.maxChannels) * 100)
    const imagesPercent = aiImage.maxPerMonth <= 0 ? 0 : Math.min(100, (usage.imagesThisMonth / aiImage.maxPerMonth) * 100)
    const apiPercent = plan.maxApiCallsPerMonth <= 0 ? 0 : Math.min(100, (usage.apiCallsThisMonth / plan.maxApiCallsPerMonth) * 100)

    const statusColor = subscription?.status === 'active' ? 'text-green-500' : subscription?.status === 'past_due' ? 'text-red-500' : 'text-orange-500'
    const StatusIcon = subscription?.status === 'active' ? CheckCircle2 : AlertCircle

    // Locale-aware date formatter using the i18n context locale
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString()

    return (
        <div className="space-y-6 p-6 max-w-5xl">
            <div>
                <h1 className="text-2xl font-bold">{t('billing.title')}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t('billing.description')}</p>
            </div>

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

            {/* Current Plan Card */}
            <Card>
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
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {isFree ? (
                                <Button onClick={() => setUpgradeOpen(true)} className="gap-2">
                                    <Zap className="h-4 w-4" />
                                    {t('billing.upgrade')}
                                </Button>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => setUpgradeOpen(true)} className="gap-1">
                                        <ArrowUpRight className="h-4 w-4" />
                                        {t('billing.changePlan')}
                                    </Button>
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

                    {subscription?.cancelAtPeriodEnd && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 text-orange-600 text-sm">
                            <Clock className="h-4 w-4" />
                            {t('billing.cancelNote').replace('{date}', fmtDate(subscription.currentPeriodEnd))}
                        </div>
                    )}

                    {subscription?.currentPeriodEnd && !subscription.cancelAtPeriodEnd && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {t('billing.renewsOn').replace('{date}', fmtDate(subscription.currentPeriodEnd))}
                        </div>
                    )}
                </CardContent>
            </Card>

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
                        <div className="space-y-2">
                            {info.activeAddons.map(addon => (
                                <div key={addon.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                            {addon.category === 'quota' ? 'Quota' : 'Feature'}
                                        </Badge>
                                        <span className="text-sm">{addon.displayName}</span>
                                        {addon.quantity > 1 && <span className="text-xs text-muted-foreground">×{addon.quantity}</span>}
                                    </div>
                                    <span className="text-xs text-muted-foreground">${addon.priceMonthly}/mo</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {t('lang') === 'vi' ? 'Chưa có add-on nào. Thêm add-on để mở rộng plan của bạn.' : 'No add-ons yet. Browse add-ons to expand your plan.'}
                        </p>
                    )}
                    <Button variant="outline" className="gap-2 w-full" onClick={() => setAddonOpen(true)}>
                        <Plus className="h-4 w-4" />
                        {t('lang') === 'vi' ? 'Xem Add-ons' : 'Browse Add-ons'}
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

            <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
            <AddonModal open={addonOpen} onClose={() => setAddonOpen(false)} onPurchased={refreshBilling} />
        </div>
    )
}
