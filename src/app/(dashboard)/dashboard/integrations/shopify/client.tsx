'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import { useTranslation } from '@/lib/i18n'
import {
    ArrowLeft,
    Check,
    Loader2,
    Power,
    RefreshCw,
    Search,
    ShoppingBag,
    Sparkles,
    Store,
    Eye,
    EyeOff,
    Package,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Zap,
    Image as ImageIcon,
    ExternalLink,
    Info,
    SquareCheck,
    Square,
    LayoutGrid,
    List,
    Tag,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import CreateShopifyPostModal from './CreateShopifyPostModal'

// ── Shopify SVG Logo ─────────────────────────────────────────────────────────
function ShopifyLogo({ size = 32 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 109.5 124.5" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M74.7 14.8s-.3-.1-.7-.2c-.4-.1-.9-.2-1.5-.3-1.1-3.9-3.1-7.5-6.6-7.5h-.5C64.3 5.1 62.6 4 60.6 4c-15.2 0-22.5 19-24.7 28.6l-10.6 3.3c-3.3 1-3.4 1.1-3.8 4.2L13 105.4l56 10.5 30.2-7.5L74.7 14.8zM62.2 11.1l-8.5 2.6c2.4-9.2 6.8-13.6 10.8-15.3-.9 3-2.2 8.1-2.3 12.7zM57.1 10c-1-3.9-2.7-6.1-4.2-7.4 4 .7 6.6 5.1 7.9 10.3L57.1 10zm5.3 1.5v.6l-7.4 2.3c.4-3.9 1.5-9.6 3.9-13.2 1.4 2.2 3 5.7 3.5 10.3z" fill="#95BF47" />
            <path d="M72.5 14.3c-.4-.1-.7-.2-1.1-.3-1.5-4.1-4.1-7.9-7.9-7.9-1.2 0-2.2.7-3.1 1.7C57.3 5.5 54.6 4 51.6 4 37.6 4 29.8 22.7 27.4 32.6L13.9 36.8 4.4 117.6l72.4-12.7V21.8c-1.3-.4-2.9-1.5-4.3-7.5z" fill="#95BF47" />
            <path d="M76.8 104.9l30.2-7.5-15.5-82.6s-.3-.1-.7-.2c-.9 4.4-4.1 7.9-7.9 7.9-.3 0-.7 0-1.1-.1v82.5z" fill="#5E8E3E" />
            <path d="M60.6 42.1l-3.6 13.4s-3.2-1.7-7.1-1.7c-5.7 0-6 3.6-6 4.5 0 4.9 12.8 6.8 12.8 18.4 0 9.1-5.7 14.9-13.5 14.9-9.3 0-14-5.8-14-5.8l2.5-8.1s4.9 4.2 9 4.2c2.7 0 3.8-2.1 3.8-3.7 0-6.4-10.5-6.7-10.5-17.3 0-8.9 6.4-17.5 19.2-17.5 4.9.1 7.4 1.7 7.4 1.7z" fill="#fff" />
        </svg>
    )
}

interface ShopifyConfig {
    id?: string
    shopDomain: string
    hasToken: boolean
    syncInventory: boolean
    syncCollections: boolean
    syncImages: boolean
    lastSyncedAt: string | null
    productCount: number
}

interface Product {
    id: string
    externalId: string | null
    name: string
    description: string | null
    price: number | null
    salePrice: number | null
    category: string | null
    tags: string[]
    images: string[]
    inStock: boolean
    syncedAt: string | null
}

interface TestResult {
    ok: boolean
    shopName?: string
    email?: string
    currency?: string
    planName?: string
    error?: string
}

// ── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-primary' : 'bg-muted'}`}
            role="switch"
            aria-checked={checked}
        >
            <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
        </button>
    )
}

export function ShopifyClient({ userId, serverChannelId }: { userId: string; serverChannelId: string | null }) {
    const t = useTranslation()
    const router = useRouter()
    const { activeChannel } = useWorkspace()

    const [tab, setTab] = useState<'connect' | 'catalog'>('connect')

    // ── Form state ────────────────────────────────────────────────────────────
    const [shopDomain, setShopDomain] = useState('')
    const [accessToken, setAccessToken] = useState('')
    const [showToken, setShowToken] = useState(false)
    const [showManualToken, setShowManualToken] = useState(false)
    const [syncInventory, setSyncInventory] = useState(true)
    const [syncCollections, setSyncCollections] = useState(true)
    const [syncImages, setSyncImages] = useState(true)

    // ── UI state ──────────────────────────────────────────────────────────────
    const [testing, setTesting] = useState(false)
    const [saving, setSaving] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [showGuide, setShowGuide] = useState(false)
    const [testResult, setTestResult] = useState<TestResult | null>(null)
    const [config, setConfig] = useState<ShopifyConfig | null>(null)
    const [loading, setLoading] = useState(true)

    // ── Catalog state ─────────────────────────────────────────────────────────
    const [products, setProducts] = useState<Product[]>([])
    const [productTotal, setProductTotal] = useState(0)
    const [productPage, setProductPage] = useState(1)
    const [productTotalPages, setProductTotalPages] = useState(1)
    const [productSearch, setProductSearch] = useState('')
    const [productFilter, setProductFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all')
    const [loadingProducts, setLoadingProducts] = useState(false)
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── AI Post Modal state ───────────────────────────────────────────────────
    const [aiModalOpen, setAiModalOpen] = useState(false)
    const [aiModalProducts, setAiModalProducts] = useState<Product[]>([])
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())

    // ── View / Collection filter state ────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [collections, setCollections] = useState<string[]>([])
    const [selectedCollection, setSelectedCollection] = useState<string>('')

    // Resolve channelId: prefer workspace context (live), fallback to server prop
    const channelId = activeChannel?.id ?? serverChannelId ?? null

    // When workspace channel changes, reload page so URL stays in sync
    useEffect(() => {
        if (activeChannel?.id && activeChannel.id !== serverChannelId) {
            router.push(`/dashboard/integrations/shopify?channelId=${activeChannel.id}`)
        }
    }, [activeChannel?.id, serverChannelId, router])

    // ── Load config ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!channelId) return
        setLoading(true)
        fetch(`/api/integrations/shopify?channelId=${channelId}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.config) {
                    setConfig(data.config)
                    setShopDomain(data.config.shopDomain)
                    setSyncInventory(data.config.syncInventory)
                    setSyncCollections(data.config.syncCollections)
                    setSyncImages(data.config.syncImages)
                    // If connected, default to catalog tab
                    if (data.config.hasToken) setTab('catalog')
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [channelId])

    // ── Handle OAuth callback success ─────────────────────────────────────────
    useEffect(() => {
        const url = new URL(window.location.href)
        if (url.searchParams.get('connected') === '1') {
            toast.success(t('integrations.shopify.connectedSuccess'))
            // Clean URL
            url.searchParams.delete('connected')
            window.history.replaceState({}, '', url.pathname + (url.searchParams.size > 0 ? '?' + url.searchParams.toString() : ''))
        }
        const err = url.searchParams.get('error')
        if (err) {
            toast.error(`${t('integrations.shopify.connectionFailedPrefix')} ${err}`)
            url.searchParams.delete('error')
            window.history.replaceState({}, '', url.pathname + (url.searchParams.size > 0 ? '?' + url.searchParams.toString() : ''))
        }
    }, []) // run once on mount

    // ── Load products ─────────────────────────────────────────────────────────
    const loadProducts = useCallback(async (page = 1, search = '', filter = 'all', collection = '') => {
        if (!channelId) return
        setLoadingProducts(true)
        try {
            const params = new URLSearchParams({
                channelId,
                page: String(page),
                search,
                status: filter,
            })
            if (collection) params.set('collection', collection)
            const res = await fetch(`/api/integrations/shopify/products?${params}`)
            const data = await res.json()
            setProducts(data.products || [])
            setProductTotal(data.total || 0)
            setProductTotalPages(data.totalPages || 1)
            if (data.collections) setCollections(data.collections)
        } catch {
            setProducts([])
        } finally {
            setLoadingProducts(false)
        }
    }, [channelId])

    useEffect(() => {
        if (tab === 'catalog') loadProducts(productPage, productSearch, productFilter, selectedCollection)
    }, [tab, productPage, productFilter, channelId, selectedCollection]) // eslint-disable-line

    // Debounced search
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => {
            if (tab === 'catalog') loadProducts(1, productSearch, productFilter, selectedCollection)
        }, 400)
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
    }, [productSearch]) // eslint-disable-line

    // ── Test connection ───────────────────────────────────────────────────────
    async function handleTest() {
        if (!shopDomain || !accessToken) {
            toast.error(t('integrations.shopify.enterDomainToken'))
            return
        }
        setTesting(true)
        setTestResult(null)
        try {
            const res = await fetch('/api/integrations/shopify/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, shopDomain, accessToken }),
            })
            const data = await res.json()
            setTestResult(data)
        } catch {
            setTestResult({ ok: false, error: 'Network error' })
        } finally {
            setTesting(false)
        }
    }

    // ── Save config ───────────────────────────────────────────────────────────
    async function handleSave() {
        if (!channelId) return
        setSaving(true)
        try {
            const res = await fetch('/api/integrations/shopify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId,
                    shopDomain,
                    accessToken: accessToken || undefined,
                    syncInventory,
                    syncCollections,
                    syncImages,
                }),
            })
            if (res.ok) {
                toast.success(t('integrations.shopify.savedOk'))
                // Reload config
                const config = await fetch(`/api/integrations/shopify?channelId=${channelId}`).then(r => r.json())
                if (config.config) setConfig(config.config)
            }
        } catch {
            toast.error('Save failed')
        } finally {
            setSaving(false)
        }
    }

    // ── Force sync ────────────────────────────────────────────────────────────
    async function handleSync() {
        if (!channelId) return
        setSyncing(true)
        const syncToast = toast.loading(t('integrations.shopify.syncing'))
        try {
            const res = await fetch('/api/integrations/shopify/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId }),
            })
            const data = await res.json()
            toast.dismiss(syncToast)
            if (data.success) {
                toast.success(t('integrations.shopify.syncOk').replace('{synced}', String(data.synced)))
                // Reload config
                const cfg = await fetch(`/api/integrations/shopify?channelId=${channelId}`).then(r => r.json())
                if (cfg.config) setConfig(cfg.config)
                loadProducts(1, productSearch, productFilter)
            } else {
                toast.error(data.error || t('integrations.shopify.syncError'))
            }
        } catch {
            toast.dismiss(syncToast)
            toast.error(t('integrations.shopify.syncError'))
        } finally {
            setSyncing(false)
        }
    }

    // ── Disconnect ────────────────────────────────────────────────────────────
    async function handleDisconnect() {
        if (!channelId) return
        if (!window.confirm(t('integrations.shopify.deleteConfirm'))) return
        await fetch(`/api/integrations/shopify?channelId=${channelId}`, { method: 'DELETE' })
        setConfig(null)
        setShopDomain('')
        setAccessToken('')
        setTestResult(null)
        setProducts([])
        setTab('connect')
        toast.success(t('integrations.shopify.disconnectedOk'))
    }

    // ── Create AI Post from product ───────────────────────────────────────────
    function handleCreatePost(product: Product) {
        setAiModalProducts([product])
        setAiModalOpen(true)
    }

    function handleBulkCreatePost() {
        const selected = products.filter(p => selectedProductIds.has(p.id))
        if (selected.length === 0) return
        setAiModalProducts(selected)
        setAiModalOpen(true)
    }

    function toggleSelectProduct(id: string) {
        setSelectedProductIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    function toggleSelectAll() {
        if (selectedProductIds.size === products.length) {
            setSelectedProductIds(new Set())
        } else {
            setSelectedProductIds(new Set(products.map(p => p.id)))
        }
    }

    // ── Relative time helper ──────────────────────────────────────────────────
    function relativeTime(dateStr: string | null) {
        if (!dateStr) return t('integrations.shopify.neverSynced')
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Just now'
        if (mins < 60) return `${mins} min ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        return `${Math.floor(hrs / 24)}d ago`
    }

    const isConnected = !!config?.hasToken

    if (!channelId) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                {t('integrations.shopify.selectChannelFirst')}
            </div>
        )
    }

    return (
        <div className="-mx-3 -mt-4 sm:-mx-6 sm:-mt-6">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/dashboard/integrations')}
                        className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                            <ShopifyLogo size={24} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">{t('integrations.shopify.title')}</h1>
                            <p className="text-xs text-muted-foreground">{t('integrations.shopify.subtitle')}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isConnected && (
                        <>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-xs font-medium text-primary">{t('integrations.shopify.connected')}</span>
                            </div>
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:brightness-90 transition-all disabled:opacity-50"
                            >
                                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                {syncing ? t('integrations.shopify.syncing') : t('integrations.shopify.forceSyncNow')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="p-6">
                {/* ── Tabs ───────────────────────────────────────────────────── */}
                <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit mb-6">
                    {(['connect', 'catalog'] as const).map((t2) => (
                        <button
                            key={t2}
                            onClick={() => setTab(t2)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t2
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {t2 === 'connect' ? t('integrations.shopify.connectTab') : t('integrations.shopify.catalogTab')}
                        </button>
                    ))}
                </div>

                {tab === 'connect' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* ── Left: Connection Setup ──────────────────────────── */}
                        <div className="lg:col-span-5 space-y-6">

                            {/* Connection Card */}
                            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                                <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">1</div>
                                    <h2 className="font-bold">{t('integrations.shopify.connectTab')}</h2>
                                </div>
                                <div className="p-6 space-y-5">

                                    {/* ── Already connected state ── */}
                                    {isConnected && (
                                        <div className="rounded-xl p-4 bg-primary/10 border border-primary/30 flex items-center gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-primary">{t('integrations.shopify.connected')}</p>
                                                <p className="text-xs text-muted-foreground">{config?.shopDomain}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Shop Domain */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-foreground/70">{t('integrations.shopify.shopDomain')}</label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-border bg-muted/60 text-muted-foreground text-sm text-nowrap">https://</span>
                                            <input
                                                type="text"
                                                value={shopDomain}
                                                onChange={(e) => setShopDomain(e.target.value)}
                                                placeholder={t('integrations.shopify.shopDomainPlaceholder')}
                                                className="flex-1 bg-muted/40 border border-border rounded-r-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">{t('integrations.shopify.shopDomainHint')}</p>
                                    </div>

                                    {/* ── Primary: OAuth button ── */}
                                    <button
                                        onClick={() => {
                                            if (!channelId || !shopDomain) {
                                                toast.error(t('integrations.shopify.enterDomainFirst'))
                                                return
                                            }
                                            const domain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
                                            window.location.href = `/api/integrations/shopify/oauth/install?channelId=${channelId}&shop=${domain}`
                                        }}
                                        disabled={!shopDomain}
                                        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-90 transition-all disabled:opacity-50"
                                    >
                                        <ShopifyLogo size={20} />
                                        {isConnected ? t('integrations.shopify.reconnectOauth') : t('integrations.shopify.connectOauth')}
                                    </button>

                                    {/* ── Advanced: manual token ── */}
                                    <button
                                        onClick={() => setShowManualToken(!showManualToken)}
                                        className="w-full text-xs text-muted-foreground hover:text-foreground/60 transition-colors text-center"
                                    >
                                        {showManualToken ? t('integrations.shopify.hideManual') : t('integrations.shopify.showManual')}
                                    </button>

                                    {showManualToken && (
                                        <div className="space-y-4 pt-2 border-t border-border">
                                            <p className="text-xs text-muted-foreground">{t('integrations.shopify.manualTokenNote')} <code className="font-mono bg-muted px-1 rounded">shpat_</code></p>
                                            {/* Access Token */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-foreground/70">{t('integrations.shopify.accessToken')}</label>
                                                <div className="relative">
                                                    <input
                                                        type={showToken ? 'text' : 'password'}
                                                        value={accessToken}
                                                        onChange={(e) => setAccessToken(e.target.value)}
                                                        placeholder={t('integrations.shopify.accessTokenPlaceholder')}
                                                        className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 pr-10 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-mono"
                                                    />
                                                    <button
                                                        onClick={() => setShowToken(!showToken)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Test result */}
                                            {testResult && (
                                                <div className={`rounded-xl p-4 border ${testResult.ok ? 'bg-primary/10 border-primary/30' : 'bg-destructive/10 border-destructive/30'}`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {testResult.ok
                                                            ? <CheckCircle2 className="w-4 h-4 text-primary" />
                                                            : <AlertCircle className="w-4 h-4 text-destructive" />}
                                                        <span className={`text-sm font-semibold ${testResult.ok ? 'text-primary' : 'text-destructive'}`}>
                                                            {testResult.ok
                                                                ? t('integrations.shopify.connectionOk').replace('{shopName}', testResult.shopName || '')
                                                                : t('integrations.shopify.connectionFailed')}
                                                        </span>
                                                    </div>
                                                    {testResult.ok && (
                                                        <div className="text-xs text-muted-foreground space-y-0.5 pl-6">
                                                            {testResult.planName && <p>{t('integrations.shopify.shopPlan')}: {testResult.planName}</p>}
                                                            {testResult.currency && <p>{t('integrations.shopify.shopCurrency')}: {testResult.currency}</p>}
                                                            {testResult.email && <p>{testResult.email}</p>}
                                                        </div>
                                                    )}
                                                    {!testResult.ok && testResult.error && (
                                                        <p className="text-xs text-red-300 pl-6">{testResult.error}</p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={handleTest}
                                                    disabled={testing || !shopDomain || !accessToken}
                                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
                                                >
                                                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-primary" />}
                                                    {testing ? t('integrations.shopify.testing') : t('integrations.shopify.testConnection')}
                                                </button>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving || !shopDomain || (!accessToken && !config?.hasToken)}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:brightness-90 transition-all disabled:opacity-50"
                                                >
                                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                    {saving ? t('integrations.shopify.saving') : t('integrations.shopify.saveConfig')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Disconnect */}
                                    {isConnected && (
                                        <button
                                            onClick={handleDisconnect}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
                                        >
                                            <Power className="w-4 h-4" />
                                            {t('integrations.shopify.disconnect')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* OAuth setup guide */}
                            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setShowGuide(!showGuide)}
                                    className="w-full flex items-center justify-between px-6 py-4"
                                >
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Info className="w-4 h-4 text-primary" />
                                        {t('integrations.shopify.oauthGuideTitle')}
                                    </div>
                                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showGuide ? 'rotate-90' : ''}`} />
                                </button>
                                {showGuide && (
                                    <div className="px-6 pb-6 space-y-3">
                                        {[
                                            t('integrations.shopify.oauthStep1'),
                                            t('integrations.shopify.oauthStep2'),
                                            t('integrations.shopify.oauthStep3'),
                                            t('integrations.shopify.oauthStep4'),
                                        ].map((step, i) => (
                                            <div key={i} className="flex gap-3">
                                                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</div>
                                                <p className="text-sm text-foreground/70">{step}</p>
                                            </div>
                                        ))}
                                        <a
                                            href="https://partners.shopify.com/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {t('integrations.shopify.openPartners')}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Right: Sync Preferences + Stats ────────────────── */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Sync Preferences */}
                            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                                <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">2</div>
                                    <h2 className="font-bold">{t('integrations.shopify.syncPreferences')}</h2>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        {
                                            key: 'syncInventory',
                                            label: t('integrations.shopify.syncInventory'),
                                            desc: t('integrations.shopify.syncInventoryDesc'),
                                            value: syncInventory,
                                            onChange: setSyncInventory,
                                        },
                                        {
                                            key: 'syncCollections',
                                            label: t('integrations.shopify.syncCollections'),
                                            desc: t('integrations.shopify.syncCollectionsDesc'),
                                            value: syncCollections,
                                            onChange: setSyncCollections,
                                        },
                                        {
                                            key: 'syncImages',
                                            label: t('integrations.shopify.syncImages'),
                                            desc: t('integrations.shopify.syncImagesDesc'),
                                            value: syncImages,
                                            onChange: setSyncImages,
                                        },
                                    ].map((item) => (
                                        <div key={item.key} className="p-4 rounded-xl bg-muted/40 border border-border flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold">{item.label}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                                            </div>
                                            <Toggle checked={item.value} onChange={item.onChange} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Stats / Status card */}
                            {isConnected && config && (
                                <div className="bg-card border border-border rounded-2xl p-6">
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">{t('integrations.shopify.shopInfo')}</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                            <p className="text-xs text-muted-foreground">{t('integrations.shopify.productsSynced').replace('{count}', '')}</p>
                                            <p className="text-2xl font-black text-primary mt-1">{config.productCount.toLocaleString()}</p>
                                        </div>
                                        <div className="p-4 bg-muted/40 border border-border rounded-xl">
                                            <p className="text-xs text-muted-foreground">{t('integrations.shopify.lastSync')}</p>
                                            <p className="text-sm font-bold mt-1">{relativeTime(config.lastSyncedAt)}</p>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
                                                <RefreshCw className="w-3 h-3" />
                                                {t('integrations.shopify.manualSync')}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setTab('catalog')}
                                        className="mt-4 w-full py-3 rounded-xl border border-primary/30 text-primary text-sm font-bold hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ShoppingBag className="w-4 h-4" />
                                        {t('integrations.shopify.catalogTab')}
                                    </button>
                                </div>
                            )}

                            {/* Placeholder when not connected */}
                            {!isConnected && (
                                <div className="bg-card border border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                                        <Store className="w-8 h-8 text-muted-foreground/40" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-muted-foreground">{t('integrations.shopify.storePlaceholder')}</p>
                                        <p className="text-sm text-muted-foreground/50 mt-1">{t('integrations.shopify.storePlaceholderSub')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ── Catalog Tab ─────────────────────────────────────────── */
                    <div className="flex gap-4">

                        {/* ── Collection Sidebar ───────────────────────────── */}
                        {collections.length > 0 && (
                            <div className="hidden lg:flex flex-col gap-1 w-44 shrink-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-1">Collections</p>
                                <button
                                    onClick={() => { setSelectedCollection(''); setProductPage(1) }}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${!selectedCollection ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }`}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">All Products</span>
                                    <span className="ml-auto text-[10px] opacity-60">{productTotal}</span>
                                </button>
                                {collections.map(col => (
                                    <button
                                        key={col}
                                        onClick={() => { setSelectedCollection(col); setProductPage(1) }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${selectedCollection === col ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                    >
                                        <Tag className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">{col}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ── Main Content ─────────────────────────────────── */}
                        <div className="flex-1 min-w-0 space-y-4">
                            {/* Toolbar */}
                            <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                                <div className="flex items-center gap-2 flex-1 max-w-sm">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            placeholder={t('integrations.shopify.searchProducts')}
                                            className="w-full bg-muted/40 border border-border rounded-xl pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Stock filter */}
                                    <div className="flex gap-0.5 p-1 bg-muted/40 rounded-xl">
                                        {(['all', 'in_stock', 'out_of_stock'] as const).map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => { setProductFilter(f); setProductPage(1) }}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${productFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                {f === 'all' ? t('integrations.shopify.filterAll')
                                                    : f === 'in_stock' ? t('integrations.shopify.filterInStock')
                                                        : t('integrations.shopify.filterOutOfStock')}
                                            </button>
                                        ))}
                                    </div>
                                    {/* View toggle */}
                                    <div className="flex gap-0.5 p-1 bg-muted/40 rounded-xl">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                            title="Grid view"
                                        >
                                            <LayoutGrid className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                            title="List view"
                                        >
                                            <List className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Stats bar + Bulk toolbar */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={toggleSelectAll}
                                        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                                    >
                                        {selectedProductIds.size === products.length && products.length > 0
                                            ? <SquareCheck className="w-3.5 h-3.5 text-primary" />
                                            : <Square className="w-3.5 h-3.5" />}
                                        <span className="text-[11px]">{
                                            selectedCollection
                                                ? `${selectedCollection} · ${productTotal}`
                                                : `${productTotal} ${t('integrations.shopify.filterAll').toLowerCase()}`
                                        }{selectedProductIds.size > 0 ? ` · ${selectedProductIds.size} selected` : ''}</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedProductIds.size > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleBulkCreatePost}
                                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:brightness-90 transition-all"
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            {t('integrations.shopify.bulkAiPost').replace('{count}', String(selectedProductIds.size))}
                                        </button>
                                    )}
                                    {config?.lastSyncedAt && !selectedProductIds.size && <span>{relativeTime(config.lastSyncedAt)}</span>}
                                </div>
                            </div>

                            {/* Products */}
                            {loadingProducts ? (
                                <div className="flex items-center justify-center h-48">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : products.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                                    <Package className="w-12 h-12 text-muted-foreground/30" />
                                    <p className="text-sm text-muted-foreground">
                                        {productSearch ? t('integrations.shopify.noProductsSearch') : t('integrations.shopify.noProducts')}
                                    </p>
                                    {!productSearch && !isConnected && (
                                        <button onClick={() => setTab('connect')} className="text-xs text-primary hover:underline">
                                            {t('integrations.shopify.connectTab')} →
                                        </button>
                                    )}
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                                    {products.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            onCreatePost={handleCreatePost}
                                            selected={selectedProductIds.has(product.id)}
                                            onToggleSelect={() => toggleSelectProduct(product.id)}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {products.map((product) => (
                                        <ProductListRow
                                            key={product.id}
                                            product={product}
                                            onCreatePost={handleCreatePost}
                                            selected={selectedProductIds.has(product.id)}
                                            onToggleSelect={() => toggleSelectProduct(product.id)}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {productTotalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 pt-4">
                                    <button
                                        onClick={() => setProductPage(p => Math.max(1, p - 1))}
                                        disabled={productPage <= 1}
                                        className="p-2 rounded-lg bg-muted/40 hover:bg-muted disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm text-muted-foreground">
                                        {t('integrations.shopify.page')
                                            .replace('{page}', String(productPage))
                                            .replace('{total}', String(productTotalPages))}
                                    </span>
                                    <button
                                        onClick={() => setProductPage(p => Math.min(productTotalPages, p + 1))}
                                        disabled={productPage >= productTotalPages}
                                        className="p-2 rounded-lg bg-muted/40 hover:bg-muted disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── AI Post Creator Modal ─────────────────────── */}
            <CreateShopifyPostModal
                open={aiModalOpen}
                onClose={() => { setAiModalOpen(false); setSelectedProductIds(new Set()) }}
                products={aiModalProducts}
            />
        </div>
    )
}

// ── Product Card (compact grid) ───────────────────────────────────────────────
function ProductCard({
    product,
    onCreatePost,
    selected,
    onToggleSelect,
    t,
}: {
    product: Product
    onCreatePost: (p: Product) => void
    selected: boolean
    onToggleSelect: () => void
    t: (key: string) => string
}) {
    const inStock = product.inStock
    const hasImage = product.images.length > 0

    return (
        <div className={`bg-card border rounded-xl overflow-hidden group transition-all ${selected ? 'border-primary shadow-[0_0_0_1px] shadow-primary' : 'border-border hover:border-primary/40'
            }`}>
            {/* Image */}
            <div className="aspect-square relative overflow-hidden bg-muted/60">
                {hasImage ? (
                    <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 50vw, 25vw"
                        unoptimized
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                )}
                {/* Stock badge */}
                <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${inStock ? 'bg-primary/90 text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                    {inStock ? t('integrations.shopify.inStock') : t('integrations.shopify.outOfStock')}
                </div>
                {/* Select */}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
                    className={`absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-md transition-all ${selected ? 'bg-primary' : 'bg-black/50 hover:bg-black/70'}`}
                >
                    {selected
                        ? <Check className="h-3 w-3 text-primary-foreground" />
                        : <Square className="h-3 w-3 text-muted-foreground" />}
                </button>
            </div>

            {/* Content */}
            <div className="p-2.5 space-y-2">
                <div>
                    <h5 className="font-semibold text-xs truncate leading-tight" title={product.name}>{product.name}</h5>
                    <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">{product.category || '—'}</span>
                        <span className="text-xs font-bold text-primary shrink-0 ml-1">
                            {product.price ? `$${product.price.toFixed(2)}` : '—'}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => onCreatePost(product)}
                    className="w-full py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg hover:brightness-90 transition-all flex items-center justify-center gap-1"
                >
                    <Sparkles className="w-3 h-3" />
                    {t('integrations.shopify.createAiPost')}
                </button>
            </div>
        </div>
    )
}

// ── Product List Row ──────────────────────────────────────────────────────────
function ProductListRow({
    product,
    onCreatePost,
    selected,
    onToggleSelect,
    t,
}: {
    product: Product
    onCreatePost: (p: Product) => void
    selected: boolean
    onToggleSelect: () => void
    t: (key: string) => string
}) {
    const inStock = product.inStock
    const hasImage = product.images.length > 0

    return (
        <div className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20'}`}>
            {/* Select */}
            <button
                type="button"
                onClick={onToggleSelect}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all ${selected ? 'bg-primary' : 'bg-muted hover:bg-muted/80'}`}
            >
                {selected
                    ? <Check className="h-3 w-3 text-primary-foreground" />
                    : <Square className="h-3 w-3 text-muted-foreground" />}
            </button>

            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted/60 shrink-0 relative">
                {hasImage ? (
                    <Image src={product.images[0]} alt={product.name} fill className="object-cover" unoptimized />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-muted-foreground/30" />
                    </div>
                )}
            </div>

            {/* Name + category */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" title={product.name}>{product.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{product.category || '—'}</p>
            </div>

            {/* Tags (hidden on small) */}
            {product.tags.length > 0 && (
                <div className="hidden md:flex items-center gap-1 shrink-0">
                    {product.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground truncate max-w-[80px]">{tag}</span>
                    ))}
                    {product.tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{product.tags.length - 2}</span>}
                </div>
            )}

            {/* Stock + price */}
            <div className="flex items-center gap-2 shrink-0">
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${inStock ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                    {inStock ? t('integrations.shopify.inStock') : t('integrations.shopify.outOfStock')}
                </div>
                <span className="text-sm font-bold text-primary min-w-[50px] text-right">
                    {product.price ? `$${product.price.toFixed(2)}` : '—'}
                </span>
            </div>

            {/* CTA */}
            <button
                onClick={() => onCreatePost(product)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-lg hover:brightness-90 transition-all shrink-0"
            >
                <Sparkles className="w-3 h-3" />
                AI Post
            </button>
        </div>
    )
}

