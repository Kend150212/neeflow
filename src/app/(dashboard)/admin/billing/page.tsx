'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    CreditCard, TrendingUp, Users, AlertCircle, CheckCircle2,
    XCircle, Clock, Zap, ExternalLink, Download, Sparkles,
    ArrowUpRight, Target, RotateCcw, Search, Tag, ChevronRight,
    Copy, Shield, Calendar, Pause, Play, Gift, PauseCircle,
    X, CheckCheck, FlaskConical, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { toast } from 'sonner'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'

// ─── Inline Coupon Page (embedded in Tab) ─────────────────────────────────────
import AdminCouponsEmbed from './coupons-embed'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubRow {
    id: string
    status: string
    billingInterval: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    cancelAt?: string | null
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    stripeCouponId: string | null
    isInternal: boolean
    createdAt: string
    user: {
        id: string
        name: string | null
        email: string
        image: string | null
        role: string
        trialEndsAt: string | null
        createdAt: string
    }
    plan: { id: string; name: string; priceMonthly: number; priceAnnual: number }
}
interface Plan { id: string; name: string; priceMonthly: number }
interface StripeCoupon {
    id: string
    name: string | null
    percent_off: number | null
    amount_off: number | null
    duration: string
    valid: boolean
}
interface MrrPoint { month: string; mrr: number; subs: number }
interface PlanPoint { name: string; count: number }
interface TrialStats { active: number; expired: number; converted: number; conversionRate: number }
interface BillingData {
    subs: SubRow[]
    mrrHistory: MrrPoint[]
    planBreakdown: PlanPoint[]
    trialStats: TrialStats
    currentMrr: number
    internalCount: number
}

const PIE_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#6366f1']
const STATUS_COLORS: Record<string, string> = {
    active: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    past_due: 'text-red-400 border-red-500/30 bg-red-500/10',
    canceled: 'text-zinc-400 border-zinc-500/30',
    trialing: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    paused: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
}

function fmtDate(d: string | null | undefined, fallback = '—') {
    if (!d) return fallback
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function CopyBtn({ text }: { text: string }) {
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); toast.success('Copied!') }}
            className="ml-1 text-muted-foreground hover:text-foreground"
        >
            <Copy className="h-3 w-3 inline" />
        </button>
    )
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(subs: SubRow[]) {
    const header = ['Name', 'Email', 'Plan', 'Status', 'Interval', 'Joined', 'Subscribed', 'Trial Ends', 'Period End', 'Coupon', 'Cancel At', 'Stripe ID']
    const rows = subs.map(s => [
        s.user.name ?? '',
        s.user.email,
        s.plan.name,
        s.status,
        s.billingInterval,
        fmtDate(s.user.createdAt),
        fmtDate(s.createdAt),
        fmtDate(s.user.trialEndsAt),
        fmtDate(s.currentPeriodEnd),
        s.stripeCouponId ?? '',
        s.cancelAtPeriodEnd ? fmtDate(s.currentPeriodEnd) : '',
        s.stripeSubscriptionId ?? 'Manual',
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

// ─── Subscription Detail Drawer ───────────────────────────────────────────────
function SubDrawer({
    sub, plans, coupons, open, onClose, onRefresh,
}: {
    sub: SubRow | null
    plans: Plan[]
    coupons: StripeCoupon[]
    open: boolean
    onClose: () => void
    onRefresh: () => void
}) {
    const [overridePlanId, setOverridePlanId] = useState('')
    const [overriding, setOverriding] = useState(false)
    const [applyCouponId, setApplyCouponId] = useState('')
    const [applyingCoupon, setApplyingCoupon] = useState(false)
    const [canceling, setCanceling] = useState(false)
    const [pausing, setPausing] = useState(false)
    const [trialDays, setTrialDays] = useState('7')
    const [grantingTrial, setGrantingTrial] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [cancelImmediately, setCancelImmediately] = useState(false)
    const [refundTarget, setRefundTarget] = useState(false)
    const [refundReason, setRefundReason] = useState('')
    const [refunding, setRefunding] = useState(false)

    useEffect(() => {
        if (sub) {
            setOverridePlanId(sub.plan.id)
            setApplyCouponId(sub.stripeCouponId ?? '')
        }
    }, [sub])

    if (!sub) return null

    const handleOverride = async () => {
        if (!overridePlanId || overridePlanId === sub.plan.id) return
        setOverriding(true)
        try {
            const res = await fetch(`/api/admin/users/${sub.user.id}/billing`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: overridePlanId }),
            })
            if (res.ok) { toast.success('Plan overridden!'); onRefresh() }
            else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Failed') }
        } finally { setOverriding(false) }
    }

    const handleApplyCoupon = async () => {
        if (!applyCouponId) return
        setApplyingCoupon(true)
        try {
            const res = await fetch('/api/admin/billing/apply-coupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: sub.id, couponId: applyCouponId }),
            })
            const d = await res.json()
            if (res.ok) { toast.success(d.message); onRefresh() }
            else toast.error(d.error ?? 'Failed to apply coupon')
        } finally { setApplyingCoupon(false) }
    }

    const handleCancel = async () => {
        setCanceling(true)
        try {
            const res = await fetch('/api/admin/billing/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: sub.id, immediately: cancelImmediately }),
            })
            const d = await res.json()
            if (res.ok) { toast.success(d.message); setShowCancelDialog(false); onRefresh(); onClose() }
            else toast.error(d.error ?? 'Failed to cancel')
        } finally { setCanceling(false) }
    }

    const handlePause = async (resume: boolean) => {
        setPausing(true)
        try {
            const res = await fetch('/api/admin/billing/pause', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: sub.id, resume }),
            })
            const d = await res.json()
            if (res.ok) { toast.success(d.message); onRefresh() }
            else toast.error(d.error ?? 'Failed')
        } finally { setPausing(false) }
    }

    const handleGrantTrial = async () => {
        if (!trialDays || Number(trialDays) <= 0) return
        setGrantingTrial(true)
        try {
            const res = await fetch('/api/admin/billing/grant-trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: sub.id, trialDays: Number(trialDays) }),
            })
            const d = await res.json()
            if (res.ok) { toast.success(d.message); onRefresh() }
            else toast.error(d.error ?? 'Failed to grant trial')
        } finally { setGrantingTrial(false) }
    }

    const handleRefund = async () => {
        setRefunding(true)
        try {
            const res = await fetch('/api/admin/billing/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: sub.id, reason: refundReason || undefined }),
            })
            const d = await res.json()
            if (res.ok) { toast.success(d.message); setRefundTarget(false); onRefresh(); onClose() }
            else toast.error(d.error ?? 'Refund failed')
        } finally { setRefunding(false) }
    }

    const isPaused = sub.status === 'paused'

    return (
        <>
            <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
                <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto" side="right">
                    <SheetHeader className="pb-4 border-b">
                        <div className="flex items-center gap-3">
                            {sub.user.image ? (
                                <img src={sub.user.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm">
                                    {(sub.user.name ?? sub.user.email)[0].toUpperCase()}
                                </div>
                            )}
                            <div>
                                <SheetTitle className="text-base">{sub.user.name ?? sub.user.email}</SheetTitle>
                                <p className="text-xs text-muted-foreground">{sub.user.email}</p>
                            </div>
                            <Badge variant="outline" className="ml-auto text-xs capitalize border-zinc-500/30">
                                {sub.user.role}
                            </Badge>
                        </div>
                    </SheetHeader>

                    <div className="space-y-6 pt-5">

                        {/* ── Info Grid ── */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <InfoRow label="Account Created" value={fmtDate(sub.user.createdAt)} />
                            <InfoRow label="Subscribed On" value={fmtDate(sub.createdAt)} />
                            <InfoRow label="Plan" value={
                                <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400 bg-violet-500/10">
                                    <Zap className="h-3 w-3 mr-1" />{sub.plan.name}
                                </Badge>
                            } />
                            <InfoRow label="Interval" value={<span className="capitalize">{sub.billingInterval}</span>} />
                            <InfoRow label="Status" value={
                                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[sub.status] ?? ''}`}>
                                    {sub.status}{sub.cancelAtPeriodEnd && <Clock className="h-3 w-3 ml-1" />}
                                </Badge>
                            } />
                            <InfoRow label="Period End" value={fmtDate(sub.currentPeriodEnd)} />
                            {sub.user.trialEndsAt && (
                                <InfoRow label="Trial Ends" value={
                                    <span className={new Date(sub.user.trialEndsAt) > new Date() ? 'text-blue-400' : 'text-zinc-400'}>
                                        {fmtDate(sub.user.trialEndsAt)}
                                    </span>
                                } />
                            )}
                            {sub.cancelAtPeriodEnd && (
                                <InfoRow label="Cancels On" value={<span className="text-red-400">{fmtDate(sub.currentPeriodEnd)}</span>} />
                            )}
                            {sub.stripeCouponId && (
                                <InfoRow label="Coupon" value={
                                    <Badge variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-400 bg-amber-500/10">
                                        <Tag className="h-3 w-3 mr-1" />{sub.stripeCouponId}
                                    </Badge>
                                } />
                            )}
                        </div>

                        {/* ── Stripe IDs ── */}
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs font-mono">
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Shield className="h-3 w-3" /> Stripe IDs
                            </div>
                            {sub.stripeCustomerId && (
                                <div className="break-all">
                                    <span className="text-muted-foreground mr-1">Customer:</span>
                                    {sub.stripeCustomerId}
                                    <CopyBtn text={sub.stripeCustomerId} />
                                    <a href={`https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`} target="_blank" rel="noreferrer" className="ml-1 text-blue-400 hover:underline inline-flex items-center gap-0.5">
                                        <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                </div>
                            )}
                            {sub.stripeSubscriptionId ? (
                                <div className="break-all">
                                    <span className="text-muted-foreground mr-1">Sub:</span>
                                    {sub.stripeSubscriptionId}
                                    <CopyBtn text={sub.stripeSubscriptionId} />
                                    <a href={`https://dashboard.stripe.com/subscriptions/${sub.stripeSubscriptionId}`} target="_blank" rel="noreferrer" className="ml-1 text-blue-400 hover:underline inline-flex items-center gap-0.5">
                                        <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                </div>
                            ) : (
                                <div className="text-muted-foreground">Manual subscription (no Stripe)</div>
                            )}
                        </div>

                        {/* ── Actions ── */}
                        <div className="space-y-4">

                            {/* Override Plan */}
                            <ActionSection title="Override Plan" icon={<Zap className="h-4 w-4 text-violet-400" />}>
                                <div className="flex gap-2">
                                    <Select value={overridePlanId} onValueChange={setOverridePlanId}>
                                        <SelectTrigger className="h-8 text-xs flex-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {plans.map(p => (
                                                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-3 text-xs"
                                        disabled={overriding || overridePlanId === sub.plan.id}
                                        onClick={handleOverride}
                                    >
                                        {overriding ? '...' : 'Apply'}
                                    </Button>
                                </div>
                            </ActionSection>

                            {/* Apply Coupon */}
                            <ActionSection title="Apply Coupon" icon={<Tag className="h-4 w-4 text-amber-400" />}>
                                <div className="flex gap-2">
                                    <Select value={applyCouponId} onValueChange={setApplyCouponId}>
                                        <SelectTrigger className="h-8 text-xs flex-1">
                                            <SelectValue placeholder="Select coupon..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {coupons.filter(c => c.valid).map(c => (
                                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                                    {c.id} {c.name ? `— ${c.name}` : ''} ({c.percent_off ? `${c.percent_off}%` : c.amount_off ? `$${c.amount_off / 100}` : '?'} off)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-3 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                                        disabled={applyingCoupon || !applyCouponId}
                                        onClick={handleApplyCoupon}
                                    >
                                        {applyingCoupon ? '...' : 'Apply'}
                                    </Button>
                                </div>
                                {sub.stripeCouponId && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Current: <span className="font-mono text-amber-400">{sub.stripeCouponId}</span>
                                    </p>
                                )}
                            </ActionSection>

                            {/* Grant Trial */}
                            <ActionSection title="Grant Trial" icon={<Gift className="h-4 w-4 text-indigo-400" />}>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={trialDays}
                                        onChange={e => setTrialDays(e.target.value)}
                                        className="h-8 text-xs w-24"
                                    />
                                    <span className="text-xs text-muted-foreground">days from today</span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-3 text-xs text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 ml-auto"
                                        disabled={grantingTrial || !trialDays}
                                        onClick={handleGrantTrial}
                                    >
                                        {grantingTrial ? '...' : 'Grant'}
                                    </Button>
                                </div>
                                {sub.user.trialEndsAt && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Current trial: <span className={new Date(sub.user.trialEndsAt) > new Date() ? 'text-blue-400' : 'text-zinc-400'}>{fmtDate(sub.user.trialEndsAt)}</span>
                                    </p>
                                )}
                            </ActionSection>

                            {/* Pause / Resume */}
                            {sub.stripeSubscriptionId && (sub.status === 'active' || sub.status === 'paused') && (
                                <ActionSection title={isPaused ? 'Resume Subscription' : 'Pause Subscription'} icon={isPaused ? <Play className="h-4 w-4 text-emerald-400" /> : <PauseCircle className="h-4 w-4 text-amber-400" />}>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className={`h-8 text-xs ${isPaused ? 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10'}`}
                                        disabled={pausing}
                                        onClick={() => handlePause(isPaused)}
                                    >
                                        {pausing ? '...' : isPaused ? 'Resume' : 'Pause Subscription'}
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {isPaused ? 'Resumes the subscription immediately.' : 'Pauses billing. User retains access until period end.'}
                                    </p>
                                </ActionSection>
                            )}

                            {/* Refund */}
                            {sub.status === 'active' && sub.stripeSubscriptionId && (
                                <ActionSection title="Refund & Cancel" icon={<RotateCcw className="h-4 w-4 text-red-400" />}>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                                        onClick={() => setRefundTarget(true)}
                                    >
                                        <RotateCcw className="h-3 w-3 mr-1" /> Refund Latest Payment
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-1">Refunds the last charge and cancels the subscription.</p>
                                </ActionSection>
                            )}

                            {/* Cancel */}
                            {sub.status !== 'canceled' && (
                                <ActionSection title="Cancel Subscription" icon={<X className="h-4 w-4 text-red-400" />}>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                                            onClick={() => { setCancelImmediately(false); setShowCancelDialog(true) }}
                                        >
                                            Cancel at Period End
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                                            onClick={() => { setCancelImmediately(true); setShowCancelDialog(true) }}
                                        >
                                            Cancel Immediately
                                        </Button>
                                    </div>
                                </ActionSection>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Cancel Confirm */}
            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-400">
                            {cancelImmediately ? 'Cancel Immediately?' : 'Cancel at Period End?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {cancelImmediately
                                ? `This will immediately cancel ${sub.user.email}'s subscription and downgrade to Free.`
                                : `${sub.user.email} will retain access until ${fmtDate(sub.currentPeriodEnd)}, then be downgraded.`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={canceling}>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancel} disabled={canceling} className="bg-red-600 hover:bg-red-700 text-white">
                            {canceling ? 'Canceling...' : 'Confirm Cancel'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Refund Confirm */}
            <AlertDialog open={refundTarget} onOpenChange={(o) => { if (!o) { setRefundTarget(false); setRefundReason('') } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-400">
                            <RotateCcw className="h-5 w-5" /> Confirm Refund
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>Refund the latest payment and cancel for <strong>{sub.user.email}</strong>?</p>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-foreground">Reason (optional)</Label>
                                    <Textarea
                                        placeholder="e.g. Customer requested cancellation"
                                        value={refundReason}
                                        onChange={e => setRefundReason(e.target.value)}
                                        rows={2}
                                        className="resize-none text-sm"
                                    />
                                </div>
                                <p className="text-xs text-red-400">⚠️ Cannot be undone. User will be downgraded to Free.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={refunding}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRefund} disabled={refunding} className="bg-red-600 hover:bg-red-700 text-white">
                            {refunding ? 'Processing...' : 'Confirm Refund'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <div className="text-sm font-medium">{value}</div>
        </div>
    )
}

function ActionSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
                {icon}{title}
            </div>
            {children}
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminBillingPage() {
    const [data, setData] = useState<BillingData | null>(null)
    const [plans, setPlans] = useState<Plan[]>([])
    const [coupons, setCoupons] = useState<StripeCoupon[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [planFilter, setPlanFilter] = useState('ALL')
    const [intervalFilter, setIntervalFilter] = useState('ALL')
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState('subscriptions')
    const [selectedSub, setSelectedSub] = useState<SubRow | null>(null)
    const [refundTarget, setRefundTarget] = useState<SubRow | null>(null)
    const [refundReason, setRefundReason] = useState('')
    const [refunding, setRefunding] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [togglingInternal, setTogglingInternal] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [billingRes, planRes, couponRes] = await Promise.all([
                fetch('/api/admin/billing'),
                fetch('/api/admin/billing/plans'),
                fetch('/api/admin/coupons'),
            ])
            if (billingRes.ok) setData(await billingRes.json())
            if (planRes.ok) setPlans(await planRes.json())
            if (couponRes.ok) {
                const c = await couponRes.json()
                setCoupons(Array.isArray(c) ? c : [])
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const handleRefund = async () => {
        if (!refundTarget) return
        setRefunding(true)
        try {
            const res = await fetch('/api/admin/billing/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: refundTarget.id, reason: refundReason || undefined }),
            })
            const d = await res.json()
            if (res.ok) { toast.success(d.message || 'Refund processed'); setRefundTarget(null); setRefundReason(''); fetchData() }
            else toast.error(d.error || 'Refund failed')
        } catch { toast.error('Failed to process refund') }
        finally { setRefunding(false) }
    }

    const handleToggleInternal = async (markAsInternal: boolean) => {
        if (selectedIds.size === 0) return
        setTogglingInternal(true)
        try {
            const res = await fetch('/api/admin/billing/internal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionIds: Array.from(selectedIds), isInternal: markAsInternal }),
            })
            const d = await res.json()
            if (res.ok) {
                toast.success(d.message)
                setSelectedIds(new Set())
                fetchData()
            } else {
                toast.error(d.error || 'Failed to update')
            }
        } catch {
            toast.error('Something went wrong')
        } finally {
            setTogglingInternal(false)
        }
    }

    const toggleSelectAll = (filteredSubs: SubRow[]) => {
        if (selectedIds.size === filteredSubs.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredSubs.map(s => s.id)))
        }
    }

    if (loading || !data) {
        return (
            <div className="p-6 space-y-6 animate-pulse">
                <div className="h-8 w-56 bg-muted rounded" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
                </div>
                <div className="h-64 bg-muted rounded-xl" />
            </div>
        )
    }

    const { subs, mrrHistory, planBreakdown, trialStats, currentMrr, internalCount } = data
    const active = subs.filter(s => s.status === 'active' && !s.isInternal)
    const pastDue = subs.filter(s => s.status === 'past_due' && !s.isInternal)
    const canceled = subs.filter(s => s.status === 'canceled' && !s.isInternal)
    const trialing = subs.filter(s => s.status === 'trialing' && !s.isInternal)

    const filtered = subs.filter(s => {
        if (statusFilter !== 'ALL' && s.status !== statusFilter) return false
        if (planFilter !== 'ALL' && s.plan.id !== planFilter) return false
        if (intervalFilter !== 'ALL' && s.billingInterval !== intervalFilter) return false
        if (search) {
            const q = search.toLowerCase()
            if (!s.user.email.toLowerCase().includes(q) && !(s.user.name ?? '').toLowerCase().includes(q)) return false
        }
        return true
    })

    return (
        <div className="flex flex-col gap-6 p-6 max-w-[1400px]">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CreditCard className="h-6 w-6" />
                        Billing Overview
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Revenue, subscriptions, coupon management</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCSV(subs)}>
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5 text-violet-400" /> MRR
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">${(currentMrr ?? 0).toFixed(0)}</p>
                        {internalCount > 0 ? (
                            <p className="text-xs text-muted-foreground">excl. {internalCount} internal</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">per month</p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-emerald-400">{active.length}</p>
                        <p className="text-xs text-muted-foreground">subscribers</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-blue-400" /> Trialing
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-blue-400">{trialing.length}</p>
                        <p className="text-xs text-muted-foreground">on trial</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-red-400" /> Past Due
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-400">{pastDue.length}</p>
                        <p className="text-xs text-muted-foreground">need attention</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5 text-zinc-400" /> Canceled
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-zinc-400">{canceled.length}</p>
                        <p className="text-xs text-muted-foreground">churned</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-violet-400" />
                            Revenue (MRR) — Last 6 Months
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={mrrHistory}>
                                <defs>
                                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                                <Tooltip
                                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }}
                                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                                    formatter={(v: number | undefined) => [`$${v ?? 0}`, 'MRR']}
                                />
                                <Area type="monotone" dataKey="mrr" stroke="#7c3aed" fill="url(#mrrGrad)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-400" /> Plan Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie data={planBreakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={3}>
                                    {planBreakdown.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'hsl(var(--foreground))' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Trial Stats */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-400" /> Trial Stats
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <div className="flex items-center gap-1.5 text-xs text-indigo-400 mb-1"><Clock className="h-3.5 w-3.5" /> Active Trials</div>
                            <p className="text-2xl font-bold">{trialStats.active}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><XCircle className="h-3.5 w-3.5" /> Trials Expired</div>
                            <p className="text-2xl font-bold">{trialStats.expired}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-1"><ArrowUpRight className="h-3.5 w-3.5" /> Converted</div>
                            <p className="text-2xl font-bold text-emerald-400">{trialStats.converted}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1"><Target className="h-3.5 w-3.5" /> Conversion Rate</div>
                            <p className="text-2xl font-bold text-amber-400">{trialStats.conversionRate}%</p>
                        </div>
                    </div>
                    {(trialStats.active + trialStats.expired) > 0 && (
                        <div className="mt-4">
                            <ResponsiveContainer width="100%" height={80}>
                                <BarChart data={[
                                    { label: 'Active', value: trialStats.active, fill: '#6366f1' },
                                    { label: 'Expired', value: trialStats.expired, fill: '#71717a' },
                                    { label: 'Converted', value: trialStats.converted, fill: '#10b981' },
                                ]} barSize={32}>
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                                    <YAxis hide allowDecimals={false} />
                                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {[{ fill: '#6366f1' }, { fill: '#71717a' }, { fill: '#10b981' }].map((c, i) => (
                                            <Cell key={i} fill={c.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tabs: Subscriptions / Coupons */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid grid-cols-2 w-[320px]">
                    <TabsTrigger value="subscriptions" className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Subscriptions
                        <Badge variant="secondary" className="text-xs ml-1">{subs.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="coupons" className="flex items-center gap-2">
                        <Tag className="h-4 w-4" /> Coupons
                    </TabsTrigger>
                </TabsList>

                {/* ── Subscriptions Tab ── */}
                <TabsContent value="subscriptions" className="space-y-3 mt-0">
                    {/* Filters + Bulk action bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search email or name..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="h-8 pl-8 text-xs"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="trialing">Trialing</SelectItem>
                                <SelectItem value="past_due">Past Due</SelectItem>
                                <SelectItem value="canceled">Canceled</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={planFilter} onValueChange={setPlanFilter}>
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue placeholder="All Plans" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Plans</SelectItem>
                                {plans.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={intervalFilter} onValueChange={setIntervalFilter}>
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Billing</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="annual">Annual</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} subscriptions</span>
                    </div>

                    {/* Bulk action bar — visible when rows selected */}
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                            <FlaskConical className="h-4 w-4 text-violet-400 shrink-0" />
                            <span className="text-sm font-medium">{selectedIds.size} selected</span>
                            <div className="flex gap-2 ml-auto">
                                <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                    disabled={togglingInternal}
                                    onClick={() => handleToggleInternal(true)}
                                >
                                    {togglingInternal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                                    Mark as Internal
                                </Button>
                                <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs gap-1.5"
                                    disabled={togglingInternal}
                                    onClick={() => handleToggleInternal(false)}
                                >
                                    {togglingInternal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                                    Unmark Internal
                                </Button>
                                <Button
                                    size="sm" variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => setSelectedIds(new Set())}
                                >
                                    <X className="h-3.5 w-3.5" /> Clear
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8">
                                            <input
                                                type="checkbox"
                                                className="h-3.5 w-3.5 rounded border-border cursor-pointer"
                                                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                                                onChange={() => toggleSelectAll(filtered)}
                                            />
                                        </TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Interval</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead>Subscribed</TableHead>
                                        <TableHead>Trial Ends</TableHead>
                                        <TableHead>Period End</TableHead>
                                        <TableHead>Coupon</TableHead>
                                        <TableHead>Stripe</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                                                No subscriptions found
                                            </TableCell>
                                        </TableRow>
                                    ) : filtered.map(sub => (
                                        <TableRow
                                            key={sub.id}
                                            className={`cursor-pointer hover:bg-muted/30 transition-colors ${sub.isInternal ? 'opacity-60' : ''}`}
                                            onClick={() => setSelectedSub(sub)}
                                        >
                                            <TableCell onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="h-3.5 w-3.5 rounded border-border cursor-pointer"
                                                    checked={selectedIds.has(sub.id)}
                                                    onChange={() => {
                                                        const next = new Set(selectedIds)
                                                        if (next.has(sub.id)) next.delete(sub.id)
                                                        else next.add(sub.id)
                                                        setSelectedIds(next)
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {sub.user.image ? (
                                                        <img src={sub.user.image} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                                                    ) : (
                                                        <div className="h-7 w-7 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 text-xs font-bold shrink-0">
                                                            {(sub.user.name ?? sub.user.email)[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-sm leading-tight flex items-center gap-1">
                                                            {sub.user.name ?? '—'}
                                                            {sub.isInternal && (
                                                                <span title="Internal/test account — excluded from reports">
                                                                    <FlaskConical className="h-3 w-3 text-amber-400" />
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">{sub.user.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400 bg-violet-500/10">
                                                    <Zap className="h-3 w-3 mr-1" />{sub.plan.name}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[sub.status] ?? ''}`}>
                                                        {sub.status}{sub.cancelAtPeriodEnd && <Clock className="h-3 w-3 ml-1" />}
                                                    </Badge>
                                                    {sub.cancelAtPeriodEnd && (
                                                        <span className="text-xs text-red-400">&larr; Cancels {fmtDate(sub.currentPeriodEnd)}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground capitalize">
                                                {sub.billingInterval}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3 shrink-0" />
                                                    {fmtDate(sub.user.createdAt)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {fmtDate(sub.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {sub.user.trialEndsAt ? (
                                                    <span className={new Date(sub.user.trialEndsAt) > new Date() ? 'text-blue-400' : 'text-zinc-400'}>
                                                        {fmtDate(sub.user.trialEndsAt)}
                                                    </span>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {fmtDate(sub.currentPeriodEnd)}
                                            </TableCell>
                                            <TableCell>
                                                {sub.stripeCouponId ? (
                                                    <Badge variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-400 bg-amber-500/10">
                                                        <Tag className="h-3 w-3 mr-0.5" />{sub.stripeCouponId}
                                                    </Badge>
                                                ) : <span className="text-muted-foreground text-xs">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {sub.stripeSubscriptionId ? (
                                                    <a
                                                        href={`https://dashboard.stripe.com/subscriptions/${sub.stripeSubscriptionId}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        View <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Manual</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Coupons Tab ── */}
                <TabsContent value="coupons" className="mt-0">
                    <AdminCouponsEmbed />
                </TabsContent>
            </Tabs>

            {/* Subscription Detail Drawer */}
            <SubDrawer
                sub={selectedSub}
                plans={plans}
                coupons={coupons}
                open={!!selectedSub}
                onClose={() => setSelectedSub(null)}
                onRefresh={fetchData}
            />

            {/* Legacy Refund Dialog (table row refund) */}
            <AlertDialog open={!!refundTarget} onOpenChange={(open) => { if (!open) { setRefundTarget(null); setRefundReason('') } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-400">
                            <RotateCcw className="h-5 w-5" /> Confirm Refund
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>This will refund the latest payment and cancel the subscription for:</p>
                                {refundTarget && (
                                    <div className="rounded-lg border p-3 space-y-1">
                                        <p className="font-medium text-foreground">{refundTarget.user.name ?? refundTarget.user.email}</p>
                                        <p className="text-xs">{refundTarget.user.email}</p>
                                        <p className="text-xs">Plan: <span className="text-violet-400">{refundTarget.plan.name}</span> ({refundTarget.billingInterval})</p>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-foreground">Reason (optional)</p>
                                    <Textarea
                                        placeholder="e.g. Customer requested cancellation"
                                        value={refundReason}
                                        onChange={e => setRefundReason(e.target.value)}
                                        rows={2}
                                        className="resize-none text-sm"
                                    />
                                </div>
                                <p className="text-xs text-red-400">⚠️ This action cannot be undone. User will be downgraded to Free plan.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={refunding}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRefund} disabled={refunding} className="bg-red-600 hover:bg-red-700 text-white">
                            {refunding ? 'Processing...' : 'Confirm Refund'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
