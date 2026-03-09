'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWorkspace } from '@/lib/workspace-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
    Lock, ArrowRight, Zap, ShoppingBag,
    HardDrive, CheckCircle, Loader2, Link2, Unlink,
    Mail, FolderOpen, Calendar, AlertCircle, ExternalLink,
    RefreshCw, Clock, Copy, Check, Database,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

// ─── GDrive / Canva Status Types ─────────────────────────────────────────────

interface GDriveStatus {
    connected: boolean
    email: string | null
    folderId: string | null
    folderName: string | null
    folderUrl: string | null
    connectedAt: string | null
    isAdminConfigured: boolean
}

interface CanvaStatus {
    connected: boolean
    isAdminConfigured: boolean
    userName: string | null
    connectedAt: string | null
}

interface SyncSourceStatus {
    connected: boolean
    channelId?: string    // the channel this integration is attached to
    lastSyncedAt: string | null
    productCount: number | null
}

interface SyncStatus {
    channelId: string | null
    timezone: string
    shopify: SyncSourceStatus | null
    etsy: SyncSourceStatus | null
    wordpress: SyncSourceStatus | null
}

interface Props {
    allowedIntegrations: string[]
    addonsBySlug: Record<string, { name: string; displayName: string; priceMonthly: number }>
}

interface IntegrationCard {
    slug: string
    name: string
    description: string
    badge?: string         // "Coming Soon" | "New" | undefined
    href?: string          // if active, where to navigate
    logo: React.ReactNode
    category: string
    tags: string[]
}

// ─── SVG Logos ───────────────────────────────────────────────────────────────

const LogoExternalDB = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
        <rect x="8" y="10" width="32" height="8" rx="4" fill="currentColor" className="text-primary" />
        <rect x="8" y="22" width="32" height="8" rx="4" fill="currentColor" className="text-primary/70" />
        <rect x="8" y="34" width="32" height="8" rx="4" fill="currentColor" className="text-primary/40" />
        <circle cx="36" cy="14" r="2" fill="white" />
        <circle cx="36" cy="26" r="2" fill="white" />
    </svg>
)





// ─── Integration Definitions ─────────────────────────────────────────────────

// integrations list is built inside the component so it can use t()
type IntegrationCardDef = Omit<IntegrationCard, 'name' | 'description' | 'tags' | 'category'> & {
    nameKey: string
    descKey: string
    tags: string[]
    category: string
}

const integrationDefs: IntegrationCardDef[] = [
    {
        slug: 'external_db',
        nameKey: 'hub.extDbName',
        descKey: 'hub.extDbDesc',
        href: '/dashboard/integrations/external-db',
        logo: <LogoExternalDB />,
        category: 'hub.catDatabase',
        tags: ['MySQL', 'MariaDB', 'PostgreSQL', 'SQLite'],
    },
    {
        slug: 'shopify',
        nameKey: 'hub.shopifyName',
        descKey: 'hub.shopifyDesc',
        href: '/dashboard/integrations/shopify',
        logo: <img src="/logos/shopify.svg" alt="Shopify" className="w-8 h-8 object-contain" />,
        category: 'hub.catEcommerce',
        tags: ['Products', 'AI Post', 'Inventory'],
    },
    {
        slug: 'wordpress',
        nameKey: 'hub.wordpressName',
        descKey: 'hub.wordpressDesc',
        href: '/dashboard/integrations/wordpress',
        logo: (
            <div className="flex items-center gap-2">
                <img src="/logos/wordpress.svg" alt="WordPress" className="w-8 h-8 object-contain" />
                <img src="/logos/woocommerce.svg" alt="WooCommerce" className="w-8 h-8 object-contain" />
            </div>
        ),
        category: 'hub.catEcommerce',
        tags: ['WordPress', 'WooCommerce', 'Blog', 'Products', 'AI Post'],
    },
    {
        slug: 'etsy',
        nameKey: 'hub.etsyName',
        descKey: 'hub.etsyDesc',
        href: '/dashboard/integrations/etsy',
        logo: <img src="/logos/etsy.svg" alt="Etsy" className="w-8 h-8 object-contain" />,
        category: 'hub.catEcommerce',
        tags: ['Handmade', 'Listings', 'Products', 'AI Post'],
    },
    {
        slug: 'hubspot',
        nameKey: 'hub.hubspotName',
        descKey: 'hub.hubspotDesc',
        badge: 'hub.comingSoon',
        logo: <img src="/logos/hubspot.svg" alt="HubSpot" className="w-8 h-8 object-contain" />,
        category: 'hub.catCRM',
        tags: ['Contacts', 'Deals', 'Pipeline'],
    },
    {
        slug: 'salesforce',
        nameKey: 'hub.salesforceName',
        descKey: 'hub.salesforceDesc',
        badge: 'hub.comingSoon',
        logo: <img src="/logos/salesforce.svg" alt="Salesforce" className="w-8 h-8 object-contain" />,
        category: 'hub.catCRM',
        tags: ['Contacts', 'Leads', 'Opportunities'],
    },
    {
        slug: 'google_sheets',
        nameKey: 'hub.sheetsName',
        descKey: 'hub.sheetsDesc',
        badge: 'hub.comingSoon',
        logo: <img src="/logos/google-sheets.svg" alt="Google Sheets" className="w-8 h-8 object-contain" />,
        category: 'hub.catSpreadsheet',
        tags: ['Spreadsheet', 'Products', 'CSV'],
    },
    {
        slug: 'airtable',
        nameKey: 'hub.airtableName',
        descKey: 'hub.airtableDesc',
        badge: 'hub.comingSoon',
        logo: <img src="/logos/airtable.svg" alt="Airtable" className="w-8 h-8 object-contain" />,
        category: 'hub.catDatabase',
        tags: ['Base', 'Tables', 'Views'],
    },
    {
        slug: 'zapier',
        nameKey: 'hub.zapierName',
        descKey: 'hub.zapierDesc',
        badge: 'hub.comingSoon',
        logo: <img src="/logos/zapier.svg" alt="Zapier" className="w-8 h-8 object-contain" />,
        category: 'hub.catAutomation',
        tags: ['Webhook', 'Triggers', 'Automation'],
    },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function IntegrationsClient({ allowedIntegrations, addonsBySlug }: Props) {
    const t = useTranslation()
    const isAllowed = (slug: string) => allowedIntegrations.includes(slug)
    const searchParams = useSearchParams()
    const router = useRouter()
    const { activeChannel } = useWorkspace()
    const activeChannelId = activeChannel?.id ?? null

    // ── Google Drive state ──
    const [gdriveStatus, setGdriveStatus] = useState<GDriveStatus | null>(null)
    const [gdriveLoading, setGdriveLoading] = useState(false)
    const [gdriveConnecting, setGdriveConnecting] = useState(false)

    // ── Canva state ──
    const [canvaStatus, setCanvaStatus] = useState<CanvaStatus | null>(null)
    const [canvaLoading, setCanvaLoading] = useState(false)
    const [canvaConnecting, setCanvaConnecting] = useState(false)

    // ── Sync state ──
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
    const [syncingSlug, setSyncingSlug] = useState<string | null>(null)
    const [syncingAll, setSyncingAll] = useState(false)
    const [cronHour, setCronHour] = useState(2)
    const [scheduleEnabled, setScheduleEnabled] = useState(true)
    const [scheduleSaving, setScheduleSaving] = useState(false)
    const [scheduleSaved, setScheduleSaved] = useState(false)

    const fetchSyncStatus = useCallback(async () => {
        try {
            const url = activeChannelId
                ? `/api/integrations/sync-status?channelId=${activeChannelId}`
                : '/api/integrations/sync-status'
            const res = await fetch(url)
            if (res.ok) setSyncStatus(await res.json())
        } catch { /* */ }
    }, [activeChannelId])

    const fetchSchedule = useCallback(async () => {
        try {
            const res = await fetch('/api/user/sync-schedule')
            if (res.ok) {
                const d = await res.json()
                setCronHour(d.hour ?? 2)
                setScheduleEnabled(d.enabled !== false)
            }
        } catch { /* */ }
    }, [])

    // Derived: channel timezone from sync status
    const channelTimezone = syncStatus?.timezone || 'UTC'

    const fetchGDriveStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/user/gdrive/status')
            if (res.ok) setGdriveStatus(await res.json())
        } catch { /* */ }
    }, [])

    const fetchCanvaStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/user/canva/status')
            if (res.ok) setCanvaStatus(await res.json())
        } catch { /* */ }
    }, [])

    useEffect(() => {
        fetchGDriveStatus()
        fetchCanvaStatus()
        fetchSyncStatus()
        fetchSchedule()
    }, [fetchGDriveStatus, fetchCanvaStatus, fetchSyncStatus, fetchSchedule, activeChannelId])

    // integration defs resolved with translations
    const integrations: IntegrationCard[] = integrationDefs.map(d => ({
        ...d,
        name: t(d.nameKey as Parameters<typeof t>[0]) || d.nameKey,
        description: t(d.descKey as Parameters<typeof t>[0]) || d.descKey,
        badge: d.badge ? (t(d.badge as Parameters<typeof t>[0]) || d.badge) : undefined,
        category: t(d.category as Parameters<typeof t>[0]) || d.category,
        tags: d.tags,
    }))

    // Handle OAuth redirect params
    useEffect(() => {
        const gdrive = searchParams.get('gdrive')
        if (gdrive === 'connected') {
            toast.success(t('hub.gdriveConnectedOk'))
            fetchGDriveStatus()
            router.replace('/dashboard/integrations')
        } else if (gdrive === 'error') {
            toast.error(searchParams.get('message') || t('hub.gdriveConnectFailed'))
            router.replace('/dashboard/integrations')
        }
        const canva = searchParams.get('canva')
        if (canva === 'connected') {
            toast.success(t('hub.canvaConnectedOk'))
            fetchCanvaStatus()
            router.replace('/dashboard/integrations')
        } else if (canva === 'error') {
            toast.error(searchParams.get('message') || t('hub.canvaConnectFailed'))
            router.replace('/dashboard/integrations')
        }
    }, [searchParams, router, fetchGDriveStatus, fetchCanvaStatus])

    const handleGDriveConnect = async () => {
        setGdriveConnecting(true)
        try {
            const res = await fetch('/api/user/gdrive/auth')
            const data = await res.json()
            if (data.authUrl) {
                window.location.href = data.authUrl
            } else {
                toast.error(data.error || t('hub.gdriveConnectFailed'))
                setGdriveConnecting(false)
            }
        } catch {
            toast.error(t('hub.gdriveConnectFailed'))
            setGdriveConnecting(false)
        }
    }

    const handleGDriveDisconnect = async () => {
        setGdriveLoading(true)
        try {
            const res = await fetch('/api/user/gdrive/disconnect', { method: 'POST' })
            if (res.ok) {
                toast.success(t('hub.gdriveDisconnected'))
                fetchGDriveStatus()
            } else {
                toast.error(t('hub.gdriveConnectFailed'))
            }
        } catch { toast.error(t('hub.gdriveConnectFailed')) }
        setGdriveLoading(false)
    }

    const handleCanvaConnect = () => {
        setCanvaConnecting(true)
        window.location.href = `/api/oauth/canva?returnUrl=${encodeURIComponent('/dashboard/integrations')}`
    }

    const handleCanvaDisconnect = async () => {
        setCanvaLoading(true)
        try {
            const res = await fetch('/api/user/canva/disconnect', { method: 'POST' })
            if (res.ok) {
                toast.success(t('hub.canvaDisconnected'))
                fetchCanvaStatus()
            } else {
                toast.error(t('hub.canvaConnectFailed'))
            }
        } catch { toast.error(t('hub.canvaConnectFailed')) }
        setCanvaLoading(false)
    }

    // ── Sync handlers ──
    const handleSyncNow = async (slug: string) => {
        if (!syncStatus?.channelId) return
        const source = syncStatus[slug as 'shopify' | 'etsy' | 'wordpress']
        const channelId = source?.channelId ?? syncStatus.channelId  // use per-integration channelId
        setSyncingSlug(slug)
        try {
            const res = await fetch('/api/integrations/sync-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, channelId }),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(`✅ Synced ${data.synced} products${data.failed ? ` (${data.failed} failed)` : ''}`)
                fetchSyncStatus()
            } else {
                toast.error(data.error || 'Sync failed')
            }
        } catch { toast.error('Sync failed') }
        setSyncingSlug(null)
    }

    const handleSyncAll = async () => {
        if (!syncStatus?.channelId) return
        setSyncingAll(true)
        const slugs = (['shopify', 'etsy', 'wordpress'] as const)
            .filter(s => syncStatus[s]?.connected)
        let totalSynced = 0
        for (const slug of slugs) {
            try {
                // Use per-integration channelId (the channel where that integration is configured),
                // falling back to the default channel if not set.
                const source = syncStatus[slug]
                const channelId = source?.channelId ?? syncStatus.channelId
                const res = await fetch('/api/integrations/sync-now', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug, channelId }),
                })
                if (res.ok) { const d = await res.json(); totalSynced += d.synced ?? 0 }
            } catch { /* */ }
        }
        toast.success(`✅ Sync all complete — ${totalSynced} products updated`)
        fetchSyncStatus()
        setSyncingAll(false)
    }

    const handleSaveSchedule = async () => {
        setScheduleSaving(true)
        try {
            const res = await fetch('/api/user/sync-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hour: cronHour, timezone: channelTimezone, enabled: scheduleEnabled }),
            })
            if (res.ok) {
                setScheduleSaved(true)
                setTimeout(() => setScheduleSaved(false), 2500)
                toast.success(`✅ ${t('hub.saved')} — ${t('hub.dailyAt')} ${String(cronHour).padStart(2, '0')}:00 ${channelTimezone}`)
            } else {
                toast.error('Failed to save schedule')
            }
        } catch { toast.error('Failed to save schedule') }
        setScheduleSaving(false)
    }

    const formatSyncTime = (iso: string | null | undefined) => {
        if (!iso) return 'Never'
        const d = new Date(iso)
        try {
            return d.toLocaleString(undefined, {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
                timeZone: channelTimezone,
            })
        } catch {
            return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        }
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">

                {/* Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                        <Zap className="h-3.5 w-3.5" />
                        {t('hub.sectionLabel')}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('hub.headline')}</h1>
                    <p className="text-muted-foreground text-base">
                        {t('hub.subheadline')} <span className="text-primary font-medium">{t('hub.subheadlineAccent')}</span>
                    </p>
                </div>

                {/* ── Connected Apps (Google Drive + Canva) ── */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('hub.connectedApps')}</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

                        {/* Google Drive card */}
                        <div className={cn(
                            'group relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-200',
                            gdriveStatus?.connected
                                ? 'border-blue-500/30 bg-blue-500/5'
                                : 'border-border/60 bg-card/50'
                        )}>
                            {/* Status badge */}
                            <div className="absolute top-3 right-3">
                                {gdriveStatus?.connected
                                    ? <Badge className="text-[10px] px-1.5 py-0.5 gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20"><CheckCircle className="h-2.5 w-2.5" />{t('hub.connected')}</Badge>
                                    : <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">{t('hub.notConnected')}</Badge>
                                }
                            </div>

                            {/* Logo */}
                            <div className={cn(
                                'w-14 h-14 rounded-xl flex items-center justify-center',
                                gdriveStatus?.connected ? 'bg-blue-500/10' : 'bg-muted/50'
                            )}>
                                <img src="/logos/google-drive.svg" alt="Google Drive" className="w-9 h-9 object-contain" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 space-y-1.5">
                                <h3 className="font-semibold text-sm">Google Drive</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {gdriveStatus?.connected && gdriveStatus.email
                                        ? gdriveStatus.email
                                        : t('hub.gdriveDesc')}
                                </p>
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {gdriveStatus?.connected && gdriveStatus.folderName ? (
                                        <a href={gdriveStatus.folderUrl ?? undefined} target="_blank" rel="noopener noreferrer"
                                            className="text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded-full text-blue-600 inline-flex items-center gap-1">
                                            <FolderOpen className="h-2.5 w-2.5" />
                                            {gdriveStatus.folderName}
                                        </a>
                                    ) : (
                                        <>
                                            {['Photos', 'Videos', 'Docs'].map(tag => (
                                                <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{tag}</span>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* CTA */}
                            <div>
                                {gdriveStatus?.connected ? (
                                    <Button size="sm" variant="outline"
                                        className="w-full h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                                        onClick={handleGDriveDisconnect} disabled={gdriveLoading}>
                                        {gdriveLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Unlink className="h-3.5 w-3.5 mr-1.5" />}
                                        {gdriveLoading ? t('hub.disconnecting') : t('hub.disconnect')}
                                    </Button>
                                ) : !gdriveStatus?.isAdminConfigured ? (
                                    <Button size="sm" variant="outline" className="w-full h-8 text-xs" disabled>
                                        <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                                        {t('hub.notConfigured')}
                                    </Button>
                                ) : (
                                    <Button size="sm" className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                        onClick={handleGDriveConnect} disabled={gdriveConnecting}>
                                        {gdriveConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
                                        {gdriveConnecting ? t('hub.connecting') : t('hub.connect')}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Canva card */}
                        <div className={cn(
                            'group relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-200',
                            canvaStatus?.connected
                                ? 'border-violet-500/30 bg-violet-500/5'
                                : 'border-border/60 bg-card/50'
                        )}>
                            {/* Status badge */}
                            <div className="absolute top-3 right-3">
                                {canvaStatus?.connected
                                    ? <Badge className="text-[10px] px-1.5 py-0.5 gap-1 bg-violet-500/10 text-violet-600 border-violet-500/20"><CheckCircle className="h-2.5 w-2.5" />{t('hub.connected')}</Badge>
                                    : <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">{t('hub.notConnected')}</Badge>
                                }
                            </div>

                            {/* Logo */}
                            <div className={cn(
                                'w-14 h-14 rounded-xl flex items-center justify-center',
                                canvaStatus?.connected ? 'bg-violet-500/10' : 'bg-muted/50'
                            )}>
                                <img src="/CIRCLE LOGO - GRADIENT - RGB.svg" alt="Canva" className="w-9 h-9 object-contain" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 space-y-1.5">
                                <h3 className="font-semibold text-sm">Canva</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {canvaStatus?.connected && canvaStatus.userName
                                        ? canvaStatus.userName
                                        : t('hub.canvaDesc')}
                                </p>
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {['Graphics', 'Templates', 'Branding'].map(tag => (
                                        <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{tag}</span>
                                    ))}
                                </div>
                            </div>

                            {/* CTA */}
                            <div>
                                {canvaStatus?.connected ? (
                                    <Button size="sm" variant="outline"
                                        className="w-full h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                                        onClick={handleCanvaDisconnect} disabled={canvaLoading}>
                                        {canvaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Unlink className="h-3.5 w-3.5 mr-1.5" />}
                                        {canvaLoading ? t('hub.disconnecting') : t('hub.disconnect')}
                                    </Button>
                                ) : !canvaStatus?.isAdminConfigured ? (
                                    <Button size="sm" variant="outline" className="w-full h-8 text-xs" disabled>
                                        <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                                        {t('hub.notConfigured')}
                                    </Button>
                                ) : (
                                    <Button size="sm" className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-700"
                                        onClick={handleCanvaConnect} disabled={canvaConnecting}>
                                        {canvaConnecting
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                            : <img src="/CIRCLE LOGO - GRADIENT - RGB.svg" alt="Canva" className="h-3.5 w-3.5 object-contain mr-1.5" />
                                        }
                                        {canvaConnecting ? t('hub.connecting') : t('hub.connect')}
                                    </Button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>



                {/* ── Data Integrations Grid ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('hub.dataSources')}</h2>
                        {syncStatus?.channelId && (
                            <Button size="sm" variant="outline"
                                className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                                onClick={handleSyncAll} disabled={syncingAll}>
                                {syncingAll
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <RefreshCw className="h-3 w-3" />}
                                {syncingAll ? t('hub.syncing') : t('hub.syncAll')}
                            </Button>
                        )}
                    </div>

                    {/* Auto-Sync Schedule Panel */}
                    {syncStatus && (
                        <div className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Clock className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{t('hub.syncScheduleTitle')}</p>
                                        <p className="text-xs text-muted-foreground">{t('hub.syncScheduleDesc')} · <span className="font-medium text-primary/80">{channelTimezone}</span></p>
                                    </div>
                                </div>
                                {/* Hour picker */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{t('hub.dailyAt')}</span>
                                    <select
                                        value={cronHour}
                                        onChange={e => setCronHour(Number(e.target.value))}
                                        className="text-xs bg-muted border border-border rounded-lg px-2 py-1 h-8 focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>
                                                {String(i).padStart(2, '0')}:00 {i < 12 ? 'AM' : 'PM'}
                                            </option>
                                        ))}
                                    </select>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scheduleEnabled}
                                            onChange={e => setScheduleEnabled(e.target.checked)}
                                            className="w-3.5 h-3.5 accent-primary"
                                        />
                                        <span className="text-xs text-muted-foreground">{t('hub.enabled')}</span>
                                    </label>
                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                                        onClick={handleSaveSchedule} disabled={scheduleSaving}>
                                        {scheduleSaving
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <Check className={`h-3 w-3 ${scheduleSaved ? 'text-primary' : ''}`} />}
                                        {scheduleSaved ? t('hub.saved') : scheduleSaving ? t('hub.saving') : t('hub.save')}
                                    </Button>
                                </div>
                            </div>

                            {/* Source status rows */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { key: 'shopify' as const, label: 'Shopify', color: 'text-[#96BF48]', bg: 'bg-[#96BF48]/10' },
                                    { key: 'etsy' as const, label: 'Etsy', color: 'text-[#F1641E]', bg: 'bg-[#F1641E]/10' },
                                    { key: 'wordpress' as const, label: 'WordPress / WooCommerce', color: 'text-[#21759B]', bg: 'bg-[#21759B]/10' },
                                ].map(({ key, label, color, bg }) => {
                                    const s = syncStatus[key]
                                    return (
                                        <div key={key} className={`rounded-xl p-3 flex items-center gap-3 ${bg}`}>
                                            <Database className={`h-4 w-4 ${color} shrink-0`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-medium ${color} truncate`}>{label}</p>
                                                {s?.connected ? (
                                                    <>
                                                        <p className="text-[10px] text-muted-foreground">{t('hub.lastSync')}: {formatSyncTime(s.lastSyncedAt)}</p>
                                                        {s.productCount != null && (
                                                            <p className="text-[10px] text-muted-foreground">{s.productCount} items</p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="text-[10px] text-muted-foreground">{t('hub.notConnected')}</p>
                                                )}
                                            </div>
                                            {s?.connected && (
                                                <Button size="sm" variant="ghost"
                                                    className="h-6 w-6 p-0 shrink-0 hover:bg-white/20"
                                                    disabled={syncingSlug === key}
                                                    onClick={() => handleSyncNow(key)}>
                                                    {syncingSlug === key
                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                        : <RefreshCw className="h-3 w-3" />}
                                                </Button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Auto-runs info */}
                            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 flex items-center gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                                <p className="text-[11px] text-primary/80">
                                    {t('hub.syncScheduleInfo')}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {integrations.map((intg) => {
                            const allowed = isAllowed(intg.slug)
                            const isComingSoon = !!intg.badge
                            const isLocked = !allowed && !isComingSoon
                            const isActive = allowed && !isComingSoon
                            const availableAddon = !allowed && !isComingSoon ? addonsBySlug[intg.slug] : null
                            // Check if this integration has an active data connection
                            const isConnected = isActive && ['shopify', 'etsy', 'wordpress'].includes(intg.slug)
                                && !!(syncStatus?.[intg.slug as 'shopify' | 'etsy' | 'wordpress']?.connected)

                            return (
                                <div
                                    key={intg.slug}
                                    className={cn(
                                        'group relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-200',
                                        isActive
                                            ? 'border-primary/30 bg-primary/5 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(25,230,94,0.08)] cursor-pointer'
                                            : 'border-border/60 bg-card/50 opacity-75'
                                    )}
                                >
                                    {/* Status badge */}
                                    {isComingSoon && (
                                        <div className="absolute top-3 right-3">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                                {t('hub.comingSoon')}
                                            </Badge>
                                        </div>
                                    )}
                                    {isLocked && !availableAddon && (
                                        <div className="absolute top-3 right-3">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-amber-500/50 text-amber-500">
                                                <Lock className="h-2.5 w-2.5 mr-1" />
                                                {t('hub.upgrade')}
                                            </Badge>
                                        </div>
                                    )}
                                    {isLocked && availableAddon && (
                                        <div className="absolute top-3 right-3">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-blue-500/50 text-blue-500">
                                                <ShoppingBag className="h-2.5 w-2.5 mr-1" />
                                                {t('hub.addon')}
                                            </Badge>
                                        </div>
                                    )}
                                    {isActive && (
                                        <div className="absolute top-3 right-3">
                                            {isConnected ? (
                                                <Badge className="text-[10px] px-1.5 py-0.5 gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                                    <CheckCircle className="h-2.5 w-2.5" />
                                                    Connected
                                                </Badge>
                                            ) : (
                                                <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary border-primary/30">
                                                    {t('hub.active')}
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    {/* Logo */}
                                    {intg.slug === 'wordpress' ? (
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                                isActive ? 'bg-primary/10' : 'bg-muted/50'
                                            )}>
                                                <img src="/logos/wordpress.svg" alt="WordPress" className="w-8 h-8 object-contain" />
                                            </div>
                                            <div className={cn(
                                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                                isActive ? 'bg-primary/10' : 'bg-muted/50'
                                            )}>
                                                <img src="/logos/woocommerce.svg" alt="WooCommerce" className="w-8 h-8 object-contain" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            'w-14 h-14 rounded-xl flex items-center justify-center',
                                            isActive ? 'bg-primary/10' : 'bg-muted/50'
                                        )}>
                                            {intg.logo}
                                        </div>
                                    )}

                                    {/* Info */}
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-sm">{intg.name}</h3>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {intg.description}
                                        </p>
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {intg.tags.map(tag => (
                                                <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <div>
                                        {isActive && intg.href ? (
                                            <div className="flex gap-1.5">
                                                <Button asChild size="sm" className={cn(
                                                    'flex-1 h-8 text-xs gap-1',
                                                    isConnected && 'bg-emerald-600 hover:bg-emerald-700'
                                                )}>
                                                    <Link href={intg.href}>
                                                        {isConnected ? (
                                                            <><CheckCircle className="h-3.5 w-3.5" /> Connected</>
                                                        ) : (
                                                            <>{t('hub.configure')} <ArrowRight className="h-3.5 w-3.5" /></>
                                                        )}
                                                    </Link>
                                                </Button>
                                                {(['shopify', 'etsy', 'wordpress'].includes(intg.slug)) && syncStatus?.channelId && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 w-8 p-0 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                                                        title="Sync now"
                                                        disabled={syncingSlug === intg.slug}
                                                        onClick={() => handleSyncNow(intg.slug)}
                                                    >
                                                        {syncingSlug === intg.slug
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : <RefreshCw className="h-3.5 w-3.5" />}
                                                    </Button>
                                                )}
                                            </div>
                                        ) : isLocked && availableAddon ? (
                                            <Button asChild size="sm" variant="outline" className="w-full h-8 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-500/10 gap-1">
                                                <Link href="/dashboard/billing">
                                                    <ShoppingBag className="h-3 w-3" />
                                                    {t('hub.getAddon')} · ${availableAddon.priceMonthly}/mo
                                                </Link>
                                            </Button>
                                        ) : isLocked ? (
                                            <Button asChild size="sm" variant="outline" className="w-full h-8 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                                                <Link href="/dashboard/billing">
                                                    <Lock className="h-3 w-3 mr-1.5" />
                                                    {t('hub.upgradePlan')}
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button size="sm" variant="outline" className="w-full h-8 text-xs" disabled>
                                                {t('hub.comingSoon')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer info */}
                <p className="text-xs text-muted-foreground text-center pb-4">
                    {t('hub.footerText')}
                </p>
            </div >
        </div >
    )
}
