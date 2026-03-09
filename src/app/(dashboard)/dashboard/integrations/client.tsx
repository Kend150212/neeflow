'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
    lastSyncedAt: string | null
    productCount: number | null
}

interface SyncStatus {
    channelId: string | null
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

// Official Shopify logo — green bag + S wordmark
const LogoShopify = () => (
    <svg viewBox="0 0 256 292" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <path d="M223.773 57.472c-.185-1.354-1.354-2.092-2.277-2.153a441.847 441.847 0 00-19.886-1.477s-13.166-13.104-14.58-14.519c-1.415-1.414-4.183-1.107-5.598-.677-.185.062-2.83.862-7.136 2.215C171.088 29.618 164.197 18 153.808 18c-.369 0-.738.062-1.108.062C150.793 15.602 148.27 14 145.377 14c-24.24 0-35.83 30.295-39.46 45.677-9.19 2.83-15.686 4.86-16.485 5.106-5.045 1.6-5.229 1.785-5.905 6.522C83.097 74.73 64 225.18 64 225.18l152.979 26.44L256 236.694c0 0-31.887-177.77-32.227-179.222zM181.8 42.246l-11.32 3.507c0-1.23 0-2.523.062-3.877.062-5.167-.738-10.15-2.4-14.211C174.04 28.325 178.969 35.093 181.8 42.246zm-20.84 6.46l-23.748 7.382c2.277-8.858 6.583-17.654 12.98-23.438 2.277-2.092 5.414-4.43 9.19-5.598 2.031 4.92 2.646 11.565 1.578 21.654zm-18.502-36.015c3.015 0 5.537 1.353 7.629 3.938-5.845 1.845-12.12 6.152-16.67 12.98-4.06 6.03-7.197 15.134-8.12 23.254-5.537 1.723-11.012 3.446-16.055 5.045C112.986 40.584 125.66 12.691 142.458 12.691z" fill="#95BF47" />
        <path d="M221.496 55.319a441.847 441.847 0 00-19.886-1.477s-13.166-13.104-14.58-14.519c-.554-.553-1.292-.8-2.092-.862l-8.919 180.838 42.709-9.435 16.116-154.484c-.185-.369-12.981-1.477-13.348-.061z" fill="#5E8E3E" />
        <path d="M153.808 96.74l-5.291 21.9s-5.291-3.077-11.627-3.077c-9.374 0-9.804 5.845-9.804 7.382 0 8.12 20.808 11.196 20.808 30.11 0 14.888-9.435 24.485-22.17 24.485-15.256 0-22.97-9.50-22.97-9.50l4.122-13.474s7.75 6.706 14.334 6.706c4.245 0 5.967-3.323 5.967-5.722 0-10.026-17.1-10.457-17.1-27.85 0-14.334 10.272-28.175 30.971-28.175 8.243 0 13.78 2.215 13.78 2.215z" fill="white" />
    </svg>
)

// Official WordPress logo
const LogoWordPress = () => (
    <svg viewBox="0 0 24 24" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="#21759B">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.181 12c0-1.765.38-3.44 1.059-4.951L7.862 18.6A8.853 8.853 0 013.181 12zm8.819 8.819a8.855 8.855 0 01-2.503-.359L12.021 12l2.588 7.093a8.81 8.81 0 01-2.609.726zM13.3 7.043c.565-.03.931-.03.931-.03.437-.059.387-.696-.07-.665 0 0-1.425.112-2.344.112-.862 0-2.316-.112-2.316-.112-.457-.031-.507.636-.05.666 0 0 .399.029.82.059l1.218 3.337-1.711 5.131-2.846-8.468c.565-.03.931-.03.931-.03.437-.059.387-.696-.07-.665 0 0-1.425.112-2.344.112-.165 0-.359-.003-.562-.01A8.854 8.854 0 0112 3.181c2.318 0 4.418.888 5.998 2.344a3.703 3.703 0 00-.263-.009c-.862 0-1.473.75-1.473 1.554 0 .724.418 1.336.864 2.059.334.588.726 1.337.726 2.426 0 .751-.289 1.631-.665 2.847l-.868 2.905-3.019-8.979v-.278zm6.35 1.74a8.836 8.836 0 01.169 1.716c0 1.33-.254 2.8-.948 4.479l-2.622 7.592A8.857 8.857 0 0019.65 8.783z" />
    </svg>
)

// Official WooCommerce logo
const LogoWooCommerce = () => (
    <svg viewBox="0 0 100 60" className="w-8 h-5" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="60" rx="8" fill="#7F54B3" />
        <path fill="white" d="M9 13h5.5l5 22 5.5-15h4.5l5.5 15 5-22H51L42 47h-5l-5.5-15L26 47h-5L9 13zm58 0c8.8 0 15 5.8 15 14 0 8.4-6.2 14-15 14s-15-5.6-15-14c0-8.2 6.2-14 15-14zm0 5c-5.5 0-9 3.8-9 9s3.5 9 9 9 9-3.8 9-9-3.5-9-9-9z" />
    </svg>
)

// Official Etsy logo — orange E mark
const LogoEtsy = () => (
    <svg viewBox="0 0 50 50" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <path fill="#F1641E" d="M25 2C12.3 2 2 12.3 2 25s10.3 23 23 23 23-10.3 23-23S37.7 2 25 2zm0 4c10.5 0 19 8.5 19 19S35.5 44 25 44 6 35.5 6 25 14.5 6 25 6zm-7 7v24h14v-4h-9v-7h7v-4h-7v-5h9v-4H18z" />
    </svg>
)

// Official HubSpot logo — orange sprocket
const LogoHubSpot = () => (
    <svg viewBox="0 0 500 500" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="#FF7A59">
        <path d="M299.8 167.2v-56.4a37.9 37.9 0 0021.9-34.3V75.6a37.9 37.9 0 00-37.9-37.9h-.9A37.9 37.9 0 00245 75.6v.9a37.9 37.9 0 0021.9 34.3v56.4a107.2 107.2 0 00-50.8 22.4L87.3 109.3a42.7 42.7 0 00-4.1-53.9 42.8 42.8 0 00-60.5 0 42.8 42.8 0 000 60.5A42.7 42.7 0 0075.2 120l126.7 79.5a107.3 107.3 0 00-14.8 54.5 107.3 107.3 0 0014.9 54.7L80.3 388.2a42.3 42.3 0 00-6.6-1.4 42.8 42.8 0 00-42.8 42.8 42.8 42.8 0 0042.8 42.8 42.8 42.8 0 0042.8-42.8 42.3 42.3 0 00-4-18.1l121-79.2a107.4 107.4 0 0067.4 23.6 107.5 107.5 0 00107.5-107.5 107.4 107.4 0 00-108.6-103.2zm-17 162.7a52.6 52.6 0 110-105.2 52.6 52.6 0 010 105.2z" />
    </svg>
)

// Official Salesforce logo — cloud
const LogoSalesforce = () => (
    <svg viewBox="0 0 101 70" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <path fill="#00A1E0" d="M42.1 6.3A21.5 21.5 0 0157 .6a21.6 21.6 0 0119.5 12.2 15.9 15.9 0 016.4-1.3 15.8 15.8 0 0115.9 15.8 16 16 0 01-1.2 6.1A14.4 14.4 0 01101 47.7a14.5 14.5 0 01-14.5 14.5H15.5a15.5 15.5 0 01-1-31 21.7 21.7 0 01-.4-4 21.5 21.5 0 0128-20.9z" />
    </svg>
)

// Official Google Sheets logo — coloured triangle file
const LogoGoogleSheets = () => (
    <svg viewBox="0 0 56 84" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <path d="M35 0H5a5 5 0 00-5 5v74a5 5 0 005 5h46a5 5 0 005-5V21L35 0z" fill="#23A566" />
        <path d="M35 0v16a5 5 0 005 5h16L35 0z" fill="#17764A" />
        <path fill="white" d="M11 36h34v4H11zm0 10h34v4H11zm0 10h22v4H11z" />
        <path fill="white" opacity="0.5" d="M28 36h1v28h-1z" />
    </svg>
)

// Official Airtable logo — coloured 3-block mark
const LogoAirtable = () => (
    <svg viewBox="0 0 200 170" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <path d="M89 10.5L15.7 40.2a9.6 9.6 0 000 18l73.4 29.8a30.2 30.2 0 0022.7 0l73.3-29.7a9.6 9.6 0 000-18L111.7 10.5a30.2 30.2 0 00-22.7 0z" fill="#FFB400" />
        <path d="M105.3 88.4v75.2a4.8 4.8 0 006.8 4.4l79-34.3a4.8 4.8 0 002.9-4.4V54.1a4.8 4.8 0 00-6.8-4.4l-79 34.2a4.8 4.8 0 00-2.9 4.4v.1z" fill="#18BFFF" />
        <path d="M88 91.5L63.8 103l-.3.1L9.7 128a4.8 4.8 0 01-6.7-4.4V54.2A4.8 4.8 0 014.8 50l.2-.1h.1a5 5 0 012 .5L88 84.5a4.8 4.8 0 010 7z" fill="#F82B60" />
    </svg>
)

// Official Zapier logo — orange Z bolt circle
const LogoZapier = () => (
    <svg viewBox="0 0 130 130" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <circle cx="65" cy="65" r="65" fill="#FF4A00" />
        <path fill="white" d="M80.4 55H62.1l14.5-32.4c.8-1.8-.5-3.8-2.4-3.8H39.8c-1.3 0-2.4 1-2.6 2.3l-5.8 35.4c-.3 1.8 1.1 3.5 2.9 3.5h17.5L36.2 101c-.8 2.2.9 4.4 3.2 4.4 1 0 2-.5 2.6-1.4l43-47.2c1.4-1.5.4-3.8-1.6-3.8h-3z" />
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
        logo: <LogoShopify />,
        category: 'hub.catEcommerce',
        tags: ['Products', 'AI Post', 'Inventory'],
    },
    {
        slug: 'wordpress',
        nameKey: 'hub.wordpressName',
        descKey: 'hub.wordpressDesc',
        href: '/dashboard/integrations/wordpress',
        logo: (
            <div className="flex items-center gap-1">
                <LogoWordPress />
                <LogoWooCommerce />
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
        logo: <LogoEtsy />,
        category: 'hub.catEcommerce',
        tags: ['Handmade', 'Listings', 'Products', 'AI Post'],
    },
    {
        slug: 'hubspot',
        nameKey: 'hub.hubspotName',
        descKey: 'hub.hubspotDesc',
        badge: 'hub.comingSoon',
        logo: <LogoHubSpot />,
        category: 'hub.catCRM',
        tags: ['Contacts', 'Deals', 'Pipeline'],
    },
    {
        slug: 'salesforce',
        nameKey: 'hub.salesforceName',
        descKey: 'hub.salesforceDesc',
        badge: 'hub.comingSoon',
        logo: <LogoSalesforce />,
        category: 'hub.catCRM',
        tags: ['Contacts', 'Leads', 'Opportunities'],
    },
    {
        slug: 'google_sheets',
        nameKey: 'hub.sheetsName',
        descKey: 'hub.sheetsDesc',
        badge: 'hub.comingSoon',
        logo: <LogoGoogleSheets />,
        category: 'hub.catSpreadsheet',
        tags: ['Spreadsheet', 'Products', 'CSV'],
    },
    {
        slug: 'airtable',
        nameKey: 'hub.airtableName',
        descKey: 'hub.airtableDesc',
        badge: 'hub.comingSoon',
        logo: <LogoAirtable />,
        category: 'hub.catDatabase',
        tags: ['Base', 'Tables', 'Views'],
    },
    {
        slug: 'zapier',
        nameKey: 'hub.zapierName',
        descKey: 'hub.zapierDesc',
        badge: 'hub.comingSoon',
        logo: <LogoZapier />,
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
    const [syncingSlug, setSyncingSlug] = useState<string | null>(null)  // which card is syncing
    const [syncingAll, setSyncingAll] = useState(false)
    const [cronHour, setCronHour] = useState(2)   // default 2am
    const [cronCopied, setCronCopied] = useState(false)

    const fetchSyncStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/integrations/sync-status')
            if (res.ok) setSyncStatus(await res.json())
        } catch { /* */ }
    }, [])

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
    }, [fetchGDriveStatus, fetchCanvaStatus, fetchSyncStatus])

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
        setSyncingSlug(slug)
        try {
            const res = await fetch('/api/integrations/sync-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, channelId: syncStatus.channelId }),
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
                const res = await fetch('/api/integrations/sync-now', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug, channelId: syncStatus.channelId }),
                })
                if (res.ok) { const d = await res.json(); totalSynced += d.synced ?? 0 }
            } catch { /* */ }
        }
        toast.success(`✅ Sync all complete — ${totalSynced} products updated`)
        fetchSyncStatus()
        setSyncingAll(false)
    }

    const handleCopyCron = () => {
        const cmd = `0 ${cronHour} * * * curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/sync-products >> /var/log/sync-products.log 2>&1`
        navigator.clipboard.writeText(cmd).then(() => {
            setCronCopied(true)
            setTimeout(() => setCronCopied(false), 2000)
        })
    }

    const formatSyncTime = (iso: string | null | undefined) => {
        if (!iso) return 'Never'
        const d = new Date(iso)
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
                                <svg viewBox="0 0 87.3 78" className="w-9 h-9" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a17.94 17.94 0 006.6 13.85z" fill="#0066da" />
                                    <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L6.6 38.3A17.94 17.94 0 000 52.15h27.5L43.65 25z" fill="#00ac47" />
                                    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.85 1.2-4.35H60.1l5.85 19.1 7.6 4.55z" fill="#ea4335" />
                                    <path d="M43.65 25L57.4 1.2C56.05.4 54.65 0 53.3 0H34C32.1 0 30.3.45 28.7 1.2L43.65 25z" fill="#00832d" />
                                    <path d="M60.1 52.15H27.5l-13.75 23.8c1.35.8 2.85 1.2 4.35 1.2h50.8c1.5 0 2.85-.45 4.2-1.2L60.1 52.15z" fill="#2684fc" />
                                    <path d="M73.4 26.15l-9.5-16.5c-.8-1.35-1.85-2.5-3.2-3.3L43.65 25l16.45 27.15H87.2c0-1.5-.4-3-1.2-4.35l-12.6-21.65z" fill="#ffba00" />
                                </svg>
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
                                {syncingAll ? 'Syncing…' : 'Sync All'}
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
                                        <p className="text-sm font-semibold">Auto-Sync Schedule</p>
                                        <p className="text-xs text-muted-foreground">Set daily sync time for all data sources</p>
                                    </div>
                                </div>
                                {/* Hour picker */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Daily at</span>
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
                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleCopyCron}>
                                        {cronCopied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                        {cronCopied ? 'Copied!' : 'Copy Cron'}
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
                                                        <p className="text-[10px] text-muted-foreground">Last sync: {formatSyncTime(s.lastSyncedAt)}</p>
                                                        {s.productCount != null && (
                                                            <p className="text-[10px] text-muted-foreground">{s.productCount} items</p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="text-[10px] text-muted-foreground">Not connected</p>
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

                            {/* Cron command display */}
                            <div className="rounded-lg bg-muted/60 border border-border/50 px-3 py-2">
                                <p className="text-[10px] text-muted-foreground mb-1">Server cron command:</p>
                                <code className="text-[10px] font-mono text-foreground/80 break-all">
                                    {`0 ${cronHour} * * * curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/sync-products`}
                                </code>
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
                                            <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary border-primary/30">
                                                {t('hub.active')}
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Logo */}
                                    <div className={cn(
                                        'w-14 h-14 rounded-xl flex items-center justify-center',
                                        isActive ? 'bg-primary/10' : 'bg-muted/50'
                                    )}>
                                        {intg.logo}
                                    </div>

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
                                                <Button asChild size="sm" className="flex-1 h-8 text-xs gap-1">
                                                    <Link href={intg.href}>
                                                        {t('hub.configure')}
                                                        <ArrowRight className="h-3.5 w-3.5" />
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
