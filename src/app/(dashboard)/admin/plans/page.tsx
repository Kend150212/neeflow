'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, Users, AlertTriangle, Package, Clock, Zap } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

type Plan = {
    id: string
    name: string
    nameVi: string
    description: string | null
    descriptionVi: string | null
    priceMonthly: number
    priceAnnual: number
    stripePriceIdMonthly: string | null
    stripePriceIdAnnual: string | null
    maxChannels: number
    maxPostsPerMonth: number
    maxMembersPerChannel: number
    maxAiImagesPerMonth: number
    maxAiTextPerMonth: number
    maxStorageMB: number
    maxApiCallsPerMonth: number
    hasAutoSchedule: boolean
    hasWebhooks: boolean
    hasAdvancedReports: boolean
    hasPrioritySupport: boolean
    hasWhiteLabel: boolean
    hasSmartFlow: boolean
    maxSmartFlowJobsPerMonth: number
    isActive: boolean
    isPublic: boolean
    sortOrder: number
    _count: { subscriptions: number }
}

const EMPTY_PLAN: Omit<Plan, 'id' | '_count'> = {
    name: '', nameVi: '', description: null, descriptionVi: null,
    priceMonthly: 0, priceAnnual: 0,
    stripePriceIdMonthly: null, stripePriceIdAnnual: null,
    maxChannels: 1, maxPostsPerMonth: 50, maxMembersPerChannel: 2,
    maxAiImagesPerMonth: 0, maxAiTextPerMonth: 20, maxStorageMB: 512,
    maxApiCallsPerMonth: 0,
    hasAutoSchedule: false, hasWebhooks: false, hasAdvancedReports: false,
    hasPrioritySupport: false, hasWhiteLabel: false, hasSmartFlow: false,
    maxSmartFlowJobsPerMonth: 0,
    isActive: true, isPublic: true, sortOrder: 0,
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
    stripeProductId: string | null
    stripePriceIdMonthly: string | null
    stripePriceIdAnnual: string | null
    icon: string
    sortOrder: number
    isActive: boolean
    _count: { subscriptionAddons: number }
}

const EMPTY_ADDON = {
    name: '', displayName: '', displayNameVi: '', description: null as string | null, descriptionVi: null as string | null,
    category: 'quota', quotaField: null as string | null, quotaAmount: 0, featureField: null as string | null,
    priceMonthly: 0, priceAnnual: 0,
    stripeProductId: null as string | null, stripePriceIdMonthly: null as string | null, stripePriceIdAnnual: null as string | null,
    icon: 'plus', sortOrder: 0, isActive: true,
}

const QUOTA_FIELD_OPTIONS = [
    { value: 'maxStorageMB', label: 'Storage (MB)' },
    { value: 'maxChannels', label: 'Channels' },
    { value: 'maxAiImagesPerMonth', label: 'AI Images/mo' },
    { value: 'maxAiTextPerMonth', label: 'AI Text/mo' },
    { value: 'maxPostsPerMonth', label: 'Posts/mo' },
    { value: 'maxMembersPerChannel', label: 'Members/ch' },
    { value: 'maxApiCallsPerMonth', label: 'API Calls/mo' },
    { value: 'maxSmartFlowJobsPerMonth', label: 'SmartFlow Jobs/mo' },
]

const FEATURE_FIELD_OPTIONS = [
    { value: 'hasAutoSchedule', label: 'Auto Schedule' },
    { value: 'hasWebhooks', label: 'Webhooks' },
    { value: 'hasAdvancedReports', label: 'Advanced Reports' },
    { value: 'hasPrioritySupport', label: 'Priority Support' },
    { value: 'hasWhiteLabel', label: 'White Label' },
    { value: 'hasSmartFlow', label: 'SmartFlow™' },
]

export default function AdminPlansPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editPlan, setEditPlan] = useState<Partial<Plan> & typeof EMPTY_PLAN>(EMPTY_PLAN)
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    // Add-on state
    const [addons, setAddons] = useState<Addon[]>([])
    const [addonDialogOpen, setAddonDialogOpen] = useState(false)
    const [editAddon, setEditAddon] = useState<Partial<Addon> & typeof EMPTY_ADDON>(EMPTY_ADDON)
    const [isEditingAddon, setIsEditingAddon] = useState(false)
    const [savingAddon, setSavingAddon] = useState(false)
    const [deleteAddonId, setDeleteAddonId] = useState<string | null>(null)
    const t = useTranslation()
    const isVi = t('lang') === 'vi'

    // Trial config state
    const [trialEnabled, setTrialEnabled] = useState(true)
    const [trialDays, setTrialDays] = useState(14)
    const [trialPlanId, setTrialPlanId] = useState<string | null>(null)
    const [savingTrial, setSavingTrial] = useState(false)

    const fetchPlans = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/admin/plans')
        const data = await res.json()
        setPlans(Array.isArray(data) ? data : [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchPlans() }, [fetchPlans])

    const fetchAddons = useCallback(async () => {
        const res = await fetch('/api/admin/addons')
        const data = await res.json()
        setAddons(Array.isArray(data) ? data : [])
    }, [])

    useEffect(() => { fetchAddons() }, [fetchAddons])

    // Fetch trial config from branding API
    const fetchTrialConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/branding')
            const data = await res.json()
            setTrialEnabled(data.trialEnabled ?? true)
            setTrialDays(data.trialDays ?? 14)
            setTrialPlanId(data.trialPlanId ?? null)
        } catch { /* ignore */ }
    }, [])

    useEffect(() => { fetchTrialConfig() }, [fetchTrialConfig])

    const saveTrialConfig = async () => {
        setSavingTrial(true)
        try {
            await fetch('/api/admin/branding', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trialEnabled, trialDays, trialPlanId }),
            })
            toast.success(isVi ? 'Đã lưu cấu hình trial' : 'Trial settings saved')
        } catch {
            toast.error(isVi ? 'Lỗi khi lưu' : 'Failed to save')
        } finally {
            setSavingTrial(false)
        }
    }

    const openCreate = () => {
        setEditPlan(EMPTY_PLAN)
        setIsEditing(false)
        setDialogOpen(true)
    }

    const openEdit = (plan: Plan) => {
        setEditPlan(plan)
        setIsEditing(true)
        setDialogOpen(true)
    }

    const handleSave = async () => {
        setSaving(true)
        const method = isEditing ? 'PUT' : 'POST'
        const url = isEditing ? `/api/admin/plans/${(editPlan as Plan).id}` : '/api/admin/plans'
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editPlan),
        })
        if (res.ok) {
            setDialogOpen(false)
            fetchPlans()
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        const res = await fetch(`/api/admin/plans/${id}`, { method: 'DELETE' })
        if (res.ok) {
            fetchPlans()
        } else {
            const data = await res.json()
            alert(data.errorVi || data.error)
        }
        setDeleteId(null)
    }

    const field = (key: keyof typeof EMPTY_PLAN, label: string, type: 'text' | 'number' | 'textarea' = 'text') => (
        <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {type === 'textarea' ? (
                <Textarea
                    value={(editPlan[key] as string) ?? ''}
                    onChange={e => setEditPlan(p => ({ ...p, [key]: e.target.value }))}
                    rows={2}
                    className="text-sm"
                />
            ) : (
                <Input
                    type={type}
                    value={(editPlan[key] as string | number) ?? ''}
                    onChange={e => setEditPlan(p => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="text-sm"
                />
            )}
        </div>
    )

    const toggle = (key: keyof typeof EMPTY_PLAN, label: string) => (
        <div className="flex items-center justify-between">
            <Label className="text-sm">{label}</Label>
            <Switch
                checked={!!editPlan[key]}
                onCheckedChange={v => setEditPlan(p => ({ ...p, [key]: v }))}
            />
        </div>
    )

    // Storage: user inputs GB, stored as MB. -1 = unlimited.
    const storageGbValue = editPlan.maxStorageMB === -1 ? -1 : +(editPlan.maxStorageMB / 1024).toFixed(2)
    const storageField = (
        <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Storage (GB)</Label>
            <Input
                type="number"
                step="0.5"
                value={storageGbValue}
                onChange={e => {
                    const gb = Number(e.target.value)
                    const mb = gb === -1 ? -1 : Math.round(gb * 1024)
                    setEditPlan(p => ({ ...p, maxStorageMB: mb }))
                }}
                className="text-sm"
            />
            <p className="text-xs text-muted-foreground">-1 = unlimited | 0.5 = 512 MB | 10 = 10 GB | 50 = 50 GB</p>
        </div>
    )

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Plans Management</h1>
                    <p className="text-muted-foreground text-sm">Quản lý gói dịch vụ / Manage billing plans</p>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Plan
                </Button>
            </div>

            {/* ── Trial Settings Card ────────────────────────────── */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-500" />
                        <CardTitle className="text-base">{isVi ? 'Cấu Hình Trial' : 'Trial Settings'}</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {isVi ? 'Bật/tắt trial cho người dùng mới đăng ký' : 'Enable/disable trial for new user registrations'}
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-6">
                        {/* Toggle */}
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={trialEnabled}
                                onCheckedChange={setTrialEnabled}
                                id="trial-toggle"
                            />
                            <Label htmlFor="trial-toggle" className="text-sm font-medium">
                                {trialEnabled
                                    ? <span className="text-green-600">{isVi ? 'Đang bật' : 'Enabled'}</span>
                                    : <span className="text-muted-foreground">{isVi ? 'Đã tắt' : 'Disabled'}</span>
                                }
                            </Label>
                        </div>

                        {/* Duration */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{isVi ? 'Số ngày' : 'Duration (days)'}</Label>
                            <Input
                                type="number"
                                min={1}
                                max={365}
                                value={trialDays}
                                onChange={e => setTrialDays(Number(e.target.value))}
                                className="w-24 text-sm"
                                disabled={!trialEnabled}
                            />
                        </div>

                        {/* Plan selector */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{isVi ? 'Gói Trial' : 'Trial Plan'}</Label>
                            <select
                                value={trialPlanId ?? ''}
                                onChange={e => setTrialPlanId(e.target.value || null)}
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                disabled={!trialEnabled}
                            >
                                <option value="">{isVi ? '— Mặc định (Pro) —' : '— Default (Pro) —'}</option>
                                {plans.filter(p => p.priceMonthly > 0 && p.isActive).map(p => (
                                    <option key={p.id} value={p.id}>{isVi ? p.nameVi || p.name : p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Save */}
                        <Button
                            size="sm"
                            onClick={saveTrialConfig}
                            disabled={savingTrial}
                            className="gap-1.5"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            {savingTrial ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? 'Lưu Trial' : 'Save Trial')}
                        </Button>
                    </div>

                    {/* Summary text */}
                    <p className="mt-3 text-xs text-muted-foreground">
                        {trialEnabled
                            ? (isVi
                                ? `✅ Người dùng mới sẽ được dùng thử ${trialDays} ngày với gói ${plans.find(p => p.id === trialPlanId)?.name || 'Pro'}`
                                : `✅ New users get ${trialDays}-day trial with ${plans.find(p => p.id === trialPlanId)?.name || 'Pro'} plan`)
                            : (isVi
                                ? '⛔ Trial đã tắt — người dùng mới sẽ bắt đầu ở gói Free'
                                : '⛔ Trial disabled — new users start on Free plan')}
                    </p>
                </CardContent>
            </Card>

            {loading ? (
                <div className="text-muted-foreground text-sm">Loading...</div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {plans.map(plan => (
                        <Card key={plan.id} className={!plan.isActive ? 'opacity-50' : ''}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base">{isVi ? plan.nameVi || plan.name : plan.name}</CardTitle>
                                    </div>
                                    <div className="flex gap-1">
                                        {!plan.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                                        {!plan.isPublic && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-end gap-3">
                                    <div>
                                        <div className="text-xl font-bold">${plan.priceMonthly}<span className="text-xs text-muted-foreground font-normal">/mo</span></div>
                                        <div className="text-xs text-muted-foreground">${plan.priceAnnual}/yr</div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                                        <Users className="h-3.5 w-3.5" />
                                        {plan._count.subscriptions} users
                                    </div>
                                    <div>{isVi && plan.descriptionVi ? plan.descriptionVi : plan.description}</div>
                                </div>
                                <div className="text-xs space-y-1 text-muted-foreground border-t pt-2">
                                    <div>Channels: {plan.maxChannels === -1 ? '∞' : plan.maxChannels}</div>
                                    <div>Posts/mo: {plan.maxPostsPerMonth === -1 ? '∞' : plan.maxPostsPerMonth}</div>
                                    <div>Members/ch: {plan.maxMembersPerChannel === -1 ? '∞' : plan.maxMembersPerChannel}</div>
                                    <div>AI Content/mo: <span className="font-medium text-foreground">{plan.maxAiTextPerMonth === -1 ? '∞' : plan.maxAiTextPerMonth}</span></div>
                                    <div>AI Images/mo: <span className="font-medium text-foreground">{plan.maxAiImagesPerMonth === -1 ? '∞' : plan.maxAiImagesPerMonth === 0 ? 'BYOK only' : plan.maxAiImagesPerMonth}</span></div>
                                    <div>Storage: <span className="font-medium text-foreground">{plan.maxStorageMB === -1 ? '∞' : plan.maxStorageMB >= 1024 ? `${(plan.maxStorageMB / 1024).toFixed(0)} GB` : `${plan.maxStorageMB} MB`}</span></div>
                                    <div>API calls/mo: <span className="font-medium text-foreground">{plan.maxApiCallsPerMonth === -1 ? '∞' : plan.maxApiCallsPerMonth === 0 ? 'Disabled' : plan.maxApiCallsPerMonth.toLocaleString()}</span></div>
                                    <div>SmartFlow/mo: <span className="font-medium text-foreground">{plan.maxSmartFlowJobsPerMonth === -1 ? '∞' : plan.maxSmartFlowJobsPerMonth === 0 ? 'BYOK only' : plan.maxSmartFlowJobsPerMonth}</span></div>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {plan.maxApiCallsPerMonth !== 0 && <Badge variant="secondary" className="text-xs px-1">API Access</Badge>}
                                        {plan.hasAutoSchedule && <Badge variant="secondary" className="text-xs px-1">Auto-schedule</Badge>}
                                        {plan.hasWebhooks && <Badge variant="secondary" className="text-xs px-1">Webhooks</Badge>}
                                        {plan.hasAdvancedReports && <Badge variant="secondary" className="text-xs px-1">Reports</Badge>}
                                        {plan.hasPrioritySupport && <Badge variant="secondary" className="text-xs px-1">Priority</Badge>}
                                        {plan.hasWhiteLabel && <Badge variant="secondary" className="text-xs px-1">White-label</Badge>}
                                        {plan.hasSmartFlow && <Badge variant="secondary" className="text-xs px-1">SmartFlow™</Badge>}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEdit(plan)}>
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 text-red-500 hover:text-red-600"
                                        onClick={() => setDeleteId(plan.id)}
                                        disabled={plan._count.subscriptions > 0}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ─── Add-ons Management ──────────────────────────────────────── */}
            <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Add-ons
                        </h2>
                        <p className="text-muted-foreground text-sm">Quản lý add-on / Manage purchasable add-ons</p>
                    </div>
                    <Button onClick={() => { setEditAddon(EMPTY_ADDON); setIsEditingAddon(false); setAddonDialogOpen(true) }} className="gap-2">
                        <Plus className="h-4 w-4" />
                        New Add-on
                    </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {addons.map(addon => (
                        <Card key={addon.id} className={!addon.isActive ? 'opacity-50' : ''}>
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold">{addon.displayName}</div>
                                        <div className="text-xs text-muted-foreground">{addon.name}</div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Badge variant="secondary" className="text-[10px]">{addon.category}</Badge>
                                        {!addon.isActive && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                    {addon.quotaField && <div>Field: <span className="font-medium text-foreground">{addon.quotaField}</span> +{addon.quotaAmount}</div>}
                                    {addon.featureField && <div>Unlocks: <span className="font-medium text-foreground">{addon.featureField}</span></div>}
                                    <div>${addon.priceMonthly}/mo · ${addon.priceAnnual}/yr</div>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Users className="h-3 w-3" />
                                        {addon._count.subscriptionAddons} subscribers
                                    </div>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                                            setEditAddon(addon)
                                            setIsEditingAddon(true)
                                            setAddonDialogOpen(true)
                                        }}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="sm" variant="ghost"
                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                            onClick={() => setDeleteAddonId(addon.id)}
                                            disabled={addon._count.subscriptionAddons > 0}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            {field('name', 'Name (EN)')}
                            {field('nameVi', 'Tên (VN)')}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {field('description', 'Description (EN)', 'textarea')}
                            {field('descriptionVi', 'Mô tả (VN)', 'textarea')}
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">PRICING</p>
                            <div className="grid grid-cols-2 gap-3">
                                {field('priceMonthly', 'Monthly Price ($)', 'number')}
                                {field('priceAnnual', 'Annual Price ($)', 'number')}
                            </div>
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">STRIPE PRICE IDs</p>
                            <div className="grid grid-cols-2 gap-3">
                                {field('stripePriceIdMonthly', 'Monthly Price ID')}
                                {field('stripePriceIdAnnual', 'Annual Price ID')}
                            </div>
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">LIMITS (-1 = unlimited)</p>
                            <div className="grid grid-cols-3 gap-3">
                                {field('maxChannels', 'Max Channels', 'number')}
                                {field('maxPostsPerMonth', 'Max Posts/Month', 'number')}
                                {field('maxMembersPerChannel', 'Max Members/Channel', 'number')}
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-3">
                                <div>
                                    {field('maxAiTextPerMonth', 'AI Content/Month', 'number')}
                                    <p className="text-xs text-muted-foreground mt-1">-1=unlimited</p>
                                </div>
                                <div>
                                    {field('maxAiImagesPerMonth', 'AI Images/Month', 'number')}
                                    <p className="text-xs text-muted-foreground mt-1">0=BYOK, -1=∞</p>
                                </div>
                                <div>
                                    {field('maxApiCallsPerMonth', 'API Calls/Month', 'number')}
                                    <p className="text-xs text-muted-foreground mt-1">0=off, -1=∞</p>
                                </div>
                                <div>
                                    {field('maxSmartFlowJobsPerMonth', 'SmartFlow Jobs/Month', 'number')}
                                    <p className="text-xs text-muted-foreground mt-1">0=BYOK, -1=∞</p>
                                </div>
                            </div>
                            <div className="mt-3">
                                {storageField}
                            </div>
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">FEATURES</p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm">API Access</Label>
                                    <Switch
                                        checked={editPlan.maxApiCallsPerMonth !== 0}
                                        onCheckedChange={v => setEditPlan(p => ({ ...p, maxApiCallsPerMonth: v ? (p.maxApiCallsPerMonth === 0 ? 1000 : p.maxApiCallsPerMonth) : 0 }))}
                                    />
                                </div>
                                {toggle('hasAutoSchedule', 'Auto Scheduling')}
                                {toggle('hasWebhooks', 'Webhooks')}
                                {toggle('hasAdvancedReports', 'Advanced Reports')}
                                {toggle('hasPrioritySupport', 'Priority Support')}
                                {toggle('hasWhiteLabel', 'White Label')}
                                {toggle('hasSmartFlow', 'SmartFlow™')}
                            </div>
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">VISIBILITY</p>
                            <div className="space-y-2">
                                {toggle('isActive', 'Active')}
                                {toggle('isPublic', 'Show on /pricing page')}
                                {field('sortOrder', 'Sort Order', 'number')}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Plan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Delete Plan
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete this plan? This cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add-on Create / Edit Dialog */}
            <Dialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isEditingAddon ? 'Edit Add-on' : 'Create New Add-on'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Slug (unique)</Label>
                                <Input
                                    value={editAddon.name}
                                    onChange={e => setEditAddon(p => ({ ...p, name: e.target.value }))}
                                    placeholder="extra_storage_5gb"
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Icon (lucide)</Label>
                                <Input
                                    value={editAddon.icon}
                                    onChange={e => setEditAddon(p => ({ ...p, icon: e.target.value }))}
                                    placeholder="hard-drive"
                                    className="text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Display Name (EN)</Label>
                                <Input value={editAddon.displayName} onChange={e => setEditAddon(p => ({ ...p, displayName: e.target.value }))} className="text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Display Name (VN)</Label>
                                <Input value={editAddon.displayNameVi} onChange={e => setEditAddon(p => ({ ...p, displayNameVi: e.target.value }))} className="text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Description (EN)</Label>
                                <Textarea
                                    value={editAddon.description ?? ''}
                                    onChange={e => setEditAddon(p => ({ ...p, description: e.target.value }))}
                                    rows={2} className="text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Mô tả (VN)</Label>
                                <Textarea
                                    value={editAddon.descriptionVi ?? ''}
                                    onChange={e => setEditAddon(p => ({ ...p, descriptionVi: e.target.value }))}
                                    rows={2} className="text-sm"
                                />
                            </div>
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">TYPE</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Category</Label>
                                    <select
                                        value={editAddon.category}
                                        onChange={e => setEditAddon(p => ({ ...p, category: e.target.value, quotaField: e.target.value === 'feature' ? null : p.quotaField, featureField: e.target.value === 'quota' ? null : p.featureField }))}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="quota">Quota (numeric boost)</option>
                                        <option value="feature">Feature (unlock)</option>
                                    </select>
                                </div>

                                {editAddon.category === 'quota' ? (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Quota Field</Label>
                                            <select
                                                value={editAddon.quotaField ?? ''}
                                                onChange={e => setEditAddon(p => ({ ...p, quotaField: e.target.value || null }))}
                                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                            >
                                                <option value="">Select field...</option>
                                                {QUOTA_FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Feature Field</Label>
                                        <select
                                            value={editAddon.featureField ?? ''}
                                            onChange={e => setEditAddon(p => ({ ...p, featureField: e.target.value || null }))}
                                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                        >
                                            <option value="">Select feature...</option>
                                            {FEATURE_FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {editAddon.category === 'quota' && (
                                <div className="mt-3 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Quota Amount (raw value)</Label>
                                    <Input
                                        type="number"
                                        value={editAddon.quotaAmount}
                                        onChange={e => setEditAddon(p => ({ ...p, quotaAmount: Number(e.target.value) }))}
                                        className="text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Storage: value in MB (5120 = 5 GB). Others: exact count.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">PRICING</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Monthly ($)</Label>
                                    <Input type="number" step="0.01" value={editAddon.priceMonthly} onChange={e => setEditAddon(p => ({ ...p, priceMonthly: Number(e.target.value) }))} className="text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Annual ($)</Label>
                                    <Input type="number" step="0.01" value={editAddon.priceAnnual} onChange={e => setEditAddon(p => ({ ...p, priceAnnual: Number(e.target.value) }))} className="text-sm" />
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">STRIPE IDs (optional)</p>
                            <div className="grid grid-cols-1 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Product ID</Label>
                                    <Input value={editAddon.stripeProductId ?? ''} onChange={e => setEditAddon(p => ({ ...p, stripeProductId: e.target.value || null }))} className="text-sm" placeholder="prod_xxx" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Monthly Price ID</Label>
                                        <Input value={editAddon.stripePriceIdMonthly ?? ''} onChange={e => setEditAddon(p => ({ ...p, stripePriceIdMonthly: e.target.value || null }))} className="text-sm" placeholder="price_xxx" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Annual Price ID</Label>
                                        <Input value={editAddon.stripePriceIdAnnual ?? ''} onChange={e => setEditAddon(p => ({ ...p, stripePriceIdAnnual: e.target.value || null }))} className="text-sm" placeholder="price_xxx" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">VISIBILITY</p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm">Active</Label>
                                    <Switch checked={!!editAddon.isActive} onCheckedChange={v => setEditAddon(p => ({ ...p, isActive: v }))} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Sort Order</Label>
                                    <Input type="number" value={editAddon.sortOrder} onChange={e => setEditAddon(p => ({ ...p, sortOrder: Number(e.target.value) }))} className="text-sm" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddonDialogOpen(false)}>Cancel</Button>
                        <Button
                            disabled={savingAddon}
                            onClick={async () => {
                                setSavingAddon(true)
                                const method = isEditingAddon ? 'PUT' : 'POST'
                                const url = isEditingAddon ? `/api/admin/addons/${(editAddon as Addon).id}` : '/api/admin/addons'
                                const res = await fetch(url, {
                                    method,
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(editAddon),
                                })
                                if (res.ok) {
                                    setAddonDialogOpen(false)
                                    fetchAddons()
                                    toast.success(isEditingAddon ? 'Add-on updated' : 'Add-on created')
                                } else {
                                    const data = await res.json()
                                    toast.error(data.error || 'Failed')
                                }
                                setSavingAddon(false)
                            }}
                        >
                            {savingAddon ? 'Saving...' : 'Save Add-on'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Add-on confirm */}
            <Dialog open={!!deleteAddonId} onOpenChange={() => setDeleteAddonId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Delete Add-on
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete this add-on? This cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteAddonId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={async () => {
                            if (!deleteAddonId) return
                            const res = await fetch(`/api/admin/addons/${deleteAddonId}`, { method: 'DELETE' })
                            if (res.ok) {
                                fetchAddons()
                                toast.success('Add-on deleted')
                            } else {
                                const data = await res.json()
                                toast.error(data.errorVi || data.error)
                            }
                            setDeleteAddonId(null)
                        }}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
