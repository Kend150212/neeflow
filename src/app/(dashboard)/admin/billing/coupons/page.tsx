'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// ─── Inline SVG Icons ──────────────────────────────────────────────────────────
const SvgPlus = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
const SvgTrash = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
const SvgTag = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
const SvgCopy = () => <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>

type StripeCoupon = {
    id: string
    name: string | null
    valid: boolean
    percent_off: number | null
    amount_off: number | null
    currency: string | null
    duration: 'once' | 'repeating' | 'forever'
    duration_in_months: number | null
    times_redeemed: number
    max_redemptions: number | null
    redeem_by: number | null
    created: number
}

const EMPTY_FORM = {
    id: '',
    name: '',
    discountType: 'percent' as 'percent' | 'fixed',
    amount: '',
    duration: 'once' as 'once' | 'repeating' | 'forever',
    durationInMonths: '',
    maxRedemptions: '',
    redeemBy: '',
}

export default function AdminCouponsPage() {
    const [coupons, setCoupons] = useState<StripeCoupon[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const fetchCoupons = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/admin/coupons')
        const data = await res.json()
        setCoupons(Array.isArray(data) ? data : [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchCoupons() }, [fetchCoupons])

    const handleCreate = async () => {
        if (!form.amount || !form.discountType || !form.duration) {
            toast.error('Please fill in all required fields')
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/admin/coupons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: form.id.trim() || undefined,
                    name: form.name.trim() || undefined,
                    discountType: form.discountType,
                    amount: Number(form.amount),
                    duration: form.duration,
                    durationInMonths: form.durationInMonths ? Number(form.durationInMonths) : undefined,
                    maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
                    redeemBy: form.redeemBy || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) { toast.error(data.error || 'Failed'); return }
            toast.success(`Coupon ${data.id} created!`)
            setDialogOpen(false)
            setForm(EMPTY_FORM)
            fetchCoupons()
        } catch { toast.error('Network error') }
        finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success(`Coupon ${id} deleted`)
            setCoupons(c => c.filter(x => x.id !== id))
        } else {
            const data = await res.json()
            toast.error(data.error || 'Failed to delete')
        }
        setDeleteId(null)
    }

    const copyCode = (id: string) => {
        navigator.clipboard.writeText(id)
        toast.success('Copied!')
    }

    const formatDiscount = (c: StripeCoupon) => {
        if (c.percent_off) return `${c.percent_off}% off`
        if (c.amount_off) return `$${(c.amount_off / 100).toFixed(2)} off`
        return '?'
    }

    const formatDuration = (c: StripeCoupon) => {
        if (c.duration === 'forever') return 'Forever'
        if (c.duration === 'repeating') return `${c.duration_in_months} months`
        return 'Once'
    }

    const isExpired = (c: StripeCoupon) =>
        c.redeem_by && c.redeem_by * 1000 < Date.now()

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <SvgTag />
                    <div>
                        <h1 className="text-2xl font-bold">Coupon Management</h1>
                        <p className="text-muted-foreground text-sm">Create and manage Stripe discount coupons</p>
                    </div>
                </div>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                    <SvgPlus /> New Coupon
                </Button>
            </div>

            {/* Stripe event reminder */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4 text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">✅ Webhook Events to Register in Stripe</p>
                <div className="flex flex-wrap gap-1.5">
                    {[
                        'checkout.session.completed',
                        'customer.subscription.created',
                        'customer.subscription.updated',
                        'customer.subscription.deleted',
                        'customer.subscription.trial_will_end',
                        'invoice.paid',
                        'invoice.payment_succeeded',
                        'invoice.payment_failed',
                    ].map(e => (
                        <code key={e} className="text-[11px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono">
                            {e}
                        </code>
                    ))}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    Webhook URL: <code className="bg-blue-100 dark:bg-blue-900 px-1.5 rounded">https://yourdomain.com/api/billing/webhook</code>
                </p>
            </div>

            {/* Coupons list */}
            {loading ? (
                <div className="text-muted-foreground text-sm">Loading coupons from Stripe...</div>
            ) : coupons.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <SvgTag />
                        <p className="mt-3 font-medium">No coupons yet</p>
                        <p className="text-sm text-muted-foreground">Create your first coupon to offer discounts to users</p>
                        <Button onClick={() => setDialogOpen(true)} className="mt-4 gap-2" size="sm">
                            <SvgPlus /> Create Coupon
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {coupons.map(c => (
                        <Card key={c.id} className={!c.valid || isExpired(c) ? 'opacity-60' : ''}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={() => copyCode(c.id)}
                                                className="font-mono font-bold text-base tracking-wider hover:text-primary flex items-center gap-1.5"
                                                title="Copy code"
                                            >
                                                {c.id} <SvgCopy />
                                            </button>
                                        </div>
                                        {c.name && <p className="text-xs text-muted-foreground mt-0.5">{c.name}</p>}
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        {!c.valid || isExpired(c) ? (
                                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                                        ) : (
                                            <Badge className="text-xs bg-green-500/10 text-green-600 border-green-200">Active</Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Discount</span>
                                    <span className="font-semibold text-emerald-600">{formatDiscount(c)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Duration</span>
                                    <span>{formatDuration(c)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Used</span>
                                    <span>{c.times_redeemed}{c.max_redemptions ? ` / ${c.max_redemptions}` : ''}</span>
                                </div>
                                {c.redeem_by && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Expires</span>
                                        <span className={isExpired(c) ? 'text-red-500' : ''}>
                                            {new Date(c.redeem_by * 1000).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                                <div className="pt-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full gap-1.5 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        onClick={() => setDeleteId(c.id)}
                                    >
                                        <SvgTrash /> Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Coupon Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create New Coupon</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Code (optional)</Label>
                                <Input
                                    placeholder="SAVE20 (auto if blank)"
                                    value={form.id}
                                    onChange={e => setForm(f => ({ ...f, id: e.target.value.toUpperCase() }))}
                                    className="font-mono uppercase text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Display Name</Label>
                                <Input
                                    placeholder="Summer Sale"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Discount Type *</Label>
                                <select
                                    value={form.discountType}
                                    onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percent' | 'fixed' }))}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="percent">Percent off (%)</option>
                                    <option value="fixed">Fixed amount ($)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                    Amount * {form.discountType === 'percent' ? '(0–100%)' : '(USD)'}
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={form.discountType === 'percent' ? 100 : undefined}
                                    placeholder={form.discountType === 'percent' ? '20' : '10.00'}
                                    value={form.amount}
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Duration *</Label>
                                <select
                                    value={form.duration}
                                    onChange={e => setForm(f => ({ ...f, duration: e.target.value as typeof form.duration }))}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="once">Once (first payment only)</option>
                                    <option value="repeating">Repeating (N months)</option>
                                    <option value="forever">Forever</option>
                                </select>
                            </div>
                            {form.duration === 'repeating' && (
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Months</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        placeholder="3"
                                        value={form.durationInMonths}
                                        onChange={e => setForm(f => ({ ...f, durationInMonths: e.target.value }))}
                                        className="text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Max Redemptions</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    placeholder="Unlimited"
                                    value={form.maxRedemptions}
                                    onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Expires On</Label>
                                <Input
                                    type="date"
                                    value={form.redeemBy}
                                    onChange={e => setForm(f => ({ ...f, redeemBy: e.target.value }))}
                                    className="text-sm"
                                />
                            </div>
                        </div>

                        {form.amount && form.discountType && (
                            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground border">
                                Preview:{' '}
                                <strong className="text-emerald-600">
                                    {form.discountType === 'percent' ? `${form.amount}% off` : `$${Number(form.amount).toFixed(2)} off`}
                                </strong>
                                {' · '}
                                {form.duration === 'once' ? 'First payment only' : form.duration === 'forever' ? 'Forever' : `${form.durationInMonths || '?'} months`}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={saving}>
                            {saving ? 'Creating...' : 'Create Coupon'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Coupon {deleteId}?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete the coupon from Stripe. Users who already used it won&apos;t be affected.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
