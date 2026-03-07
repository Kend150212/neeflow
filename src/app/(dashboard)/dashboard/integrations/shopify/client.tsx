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
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-[#00ff95]' : 'bg-white/20'}`}
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
            toast.success('✅ Shopify store connected successfully!')
            // Clean URL
            url.searchParams.delete('connected')
            window.history.replaceState({}, '', url.pathname + (url.searchParams.size > 0 ? '?' + url.searchParams.toString() : ''))
        }
        const err = url.searchParams.get('error')
        if (err) {
            toast.error(`Shopify connection failed: ${err}`)
            url.searchParams.delete('error')
            window.history.replaceState({}, '', url.pathname + (url.searchParams.size > 0 ? '?' + url.searchParams.toString() : ''))
        }
    }, []) // run once on mount

    // ── Load products ─────────────────────────────────────────────────────────
    const loadProducts = useCallback(async (page = 1, search = '', filter = 'all') => {
        if (!channelId) return
        setLoadingProducts(true)
        try {
            const params = new URLSearchParams({
                channelId,
                page: String(page),
                search,
                status: filter,
            })
            const res = await fetch(`/api/integrations/shopify/products?${params}`)
            const data = await res.json()
            setProducts(data.products || [])
            setProductTotal(data.total || 0)
            setProductTotalPages(data.totalPages || 1)
        } catch {
            setProducts([])
        } finally {
            setLoadingProducts(false)
        }
    }, [channelId])

    useEffect(() => {
        if (tab === 'catalog') loadProducts(productPage, productSearch, productFilter)
    }, [tab, productPage, productFilter, channelId]) // eslint-disable-line

    // Debounced search
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => {
            if (tab === 'catalog') loadProducts(1, productSearch, productFilter)
        }, 400)
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
    }, [productSearch]) // eslint-disable-line

    // ── Test connection ───────────────────────────────────────────────────────
    async function handleTest() {
        if (!shopDomain || !accessToken) {
            toast.error('Enter shop domain and access token first')
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
        toast.success('Disconnected')
    }

    // ── Create AI Post from product ───────────────────────────────────────────
    function handleCreatePost(product: Product) {
        router.push(
            `/dashboard/posts/compose?shopifyProductId=${product.id}`
        )
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
            <div className="flex items-center justify-center h-64 text-white/50">
                Select a channel first
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/dashboard/integrations')}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#96bf47]/20 flex items-center justify-center">
                            <ShopifyLogo size={24} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">{t('integrations.shopify.title')}</h1>
                            <p className="text-xs text-white/50">{t('integrations.shopify.subtitle')}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isConnected && (
                        <>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00ff95]/10 border border-[#00ff95]/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff95] animate-pulse" />
                                <span className="text-xs font-medium text-[#00ff95]">{t('integrations.shopify.connected')}</span>
                            </div>
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00ff95] text-black text-sm font-bold hover:brightness-90 transition-all disabled:opacity-50"
                            >
                                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                {syncing ? t('integrations.shopify.syncing') : t('integrations.shopify.forceSyncNow')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* ── Tabs ───────────────────────────────────────────────────── */}
                <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit mb-6">
                    {(['connect', 'catalog'] as const).map((t2) => (
                        <button
                            key={t2}
                            onClick={() => setTab(t2)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t2
                                ? 'bg-[#00ff95] text-black shadow-sm'
                                : 'text-white/60 hover:text-white'
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
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
                                    <div className="w-7 h-7 rounded-full bg-[#00ff95]/20 text-[#00ff95] flex items-center justify-center text-sm font-bold">1</div>
                                    <h2 className="font-bold">{t('integrations.shopify.connectTab')}</h2>
                                </div>
                                <div className="p-6 space-y-5">

                                    {/* ── Already connected state ── */}
                                    {isConnected && (
                                        <div className="rounded-xl p-4 bg-[#00ff95]/10 border border-[#00ff95]/30 flex items-center gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-[#00ff95] shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-[#00ff95]">{t('integrations.shopify.connected')}</p>
                                                <p className="text-xs text-white/50">{config?.shopDomain}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Shop Domain */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-white/70">{t('integrations.shopify.shopDomain')}</label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-white/20 bg-white/10 text-white/50 text-sm text-nowrap">https://</span>
                                            <input
                                                type="text"
                                                value={shopDomain}
                                                onChange={(e) => setShopDomain(e.target.value)}
                                                placeholder={t('integrations.shopify.shopDomainPlaceholder')}
                                                className="flex-1 bg-white/10 border border-white/20 rounded-r-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ff95] transition-colors"
                                            />
                                        </div>
                                        <p className="text-xs text-white/40">{t('integrations.shopify.shopDomainHint')}</p>
                                    </div>

                                    {/* ── Primary: OAuth button ── */}
                                    <button
                                        onClick={() => {
                                            if (!channelId || !shopDomain) {
                                                toast.error('Enter your shop domain first')
                                                return
                                            }
                                            const domain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
                                            window.location.href = `/api/integrations/shopify/oauth/install?channelId=${channelId}&shop=${domain}`
                                        }}
                                        disabled={!shopDomain}
                                        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-[#96bf47] text-white font-bold text-sm hover:brightness-90 transition-all disabled:opacity-50"
                                    >
                                        <ShopifyLogo size={20} />
                                        {isConnected ? 'Reconnect with Shopify' : 'Connect with Shopify'}
                                    </button>

                                    {/* ── Advanced: manual token ── */}
                                    <button
                                        onClick={() => setShowManualToken(!showManualToken)}
                                        className="w-full text-xs text-white/40 hover:text-white/60 transition-colors text-center"
                                    >
                                        {showManualToken ? '▲ Hide' : '▼ Use Admin API Token manually (advanced)'}
                                    </button>

                                    {showManualToken && (
                                        <div className="space-y-4 pt-2 border-t border-white/10">
                                            <p className="text-xs text-white/40">For legacy Shopify Custom Apps that provide a <code className="font-mono bg-white/10 px-1 rounded">shpat_</code> token directly.</p>
                                            {/* Access Token */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-white/70">{t('integrations.shopify.accessToken')}</label>
                                                <div className="relative">
                                                    <input
                                                        type={showToken ? 'text' : 'password'}
                                                        value={accessToken}
                                                        onChange={(e) => setAccessToken(e.target.value)}
                                                        placeholder={t('integrations.shopify.accessTokenPlaceholder')}
                                                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ff95] transition-colors font-mono"
                                                    />
                                                    <button
                                                        onClick={() => setShowToken(!showToken)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                                    >
                                                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Test result */}
                                            {testResult && (
                                                <div className={`rounded-xl p-4 border ${testResult.ok ? 'bg-[#00ff95]/10 border-[#00ff95]/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {testResult.ok
                                                            ? <CheckCircle2 className="w-4 h-4 text-[#00ff95]" />
                                                            : <AlertCircle className="w-4 h-4 text-red-400" />}
                                                        <span className={`text-sm font-semibold ${testResult.ok ? 'text-[#00ff95]' : 'text-red-400'}`}>
                                                            {testResult.ok
                                                                ? t('integrations.shopify.connectionOk').replace('{shopName}', testResult.shopName || '')
                                                                : t('integrations.shopify.connectionFailed')}
                                                        </span>
                                                    </div>
                                                    {testResult.ok && (
                                                        <div className="text-xs text-white/60 space-y-0.5 pl-6">
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
                                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                                                >
                                                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-[#00ff95]" />}
                                                    {testing ? t('integrations.shopify.testing') : t('integrations.shopify.testConnection')}
                                                </button>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving || !shopDomain || (!accessToken && !config?.hasToken)}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00ff95] text-black text-sm font-bold hover:brightness-90 transition-all disabled:opacity-50"
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
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setShowGuide(!showGuide)}
                                    className="w-full flex items-center justify-between px-6 py-4"
                                >
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Info className="w-4 h-4 text-[#00ff95]" />
                                        How to set up Shopify OAuth app
                                    </div>
                                    <ChevronRight className={`w-4 h-4 text-white/40 transition-transform ${showGuide ? 'rotate-90' : ''}`} />
                                </button>
                                {showGuide && (
                                    <div className="px-6 pb-6 space-y-3">
                                        {[
                                            'Go to partners.shopify.com → Apps → Create app → Start from Dev Dashboard',
                                            'App URL: https://neeflow.com/ — Scopes: read_products, read_inventory',
                                            'In Versions → Release the app version',
                                            'Then paste your store domain above and click "Connect with Shopify"',
                                        ].map((step, i) => (
                                            <div key={i} className="flex gap-3">
                                                <div className="w-6 h-6 rounded-full bg-[#00ff95]/20 text-[#00ff95] text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</div>
                                                <p className="text-sm text-white/70">{step}</p>
                                            </div>
                                        ))}
                                        <a
                                            href="https://partners.shopify.com/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-[#00ff95] hover:underline mt-2"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            Open Shopify Partners
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Right: Sync Preferences + Stats ────────────────── */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Sync Preferences */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
                                    <div className="w-7 h-7 rounded-full bg-[#00ff95]/20 text-[#00ff95] flex items-center justify-center text-sm font-bold">2</div>
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
                                        <div key={item.key} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold">{item.label}</p>
                                                <p className="text-xs text-white/50 mt-1">{item.desc}</p>
                                            </div>
                                            <Toggle checked={item.value} onChange={item.onChange} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Stats / Status card */}
                            {isConnected && config && (
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                    <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-4">{t('integrations.shopify.shopInfo')}</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-[#00ff95]/5 border border-[#00ff95]/20 rounded-xl">
                                            <p className="text-xs text-white/50">{t('integrations.shopify.productsSynced').replace('{count}', '')}</p>
                                            <p className="text-2xl font-black text-[#00ff95] mt-1">{config.productCount.toLocaleString()}</p>
                                        </div>
                                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                            <p className="text-xs text-white/50">Last Sync</p>
                                            <p className="text-sm font-bold mt-1">{relativeTime(config.lastSyncedAt)}</p>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-[#00ff95]">
                                                <RefreshCw className="w-3 h-3" />
                                                Manual sync
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setTab('catalog')}
                                        className="mt-4 w-full py-3 rounded-xl border border-[#00ff95]/30 text-[#00ff95] text-sm font-bold hover:bg-[#00ff95]/10 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ShoppingBag className="w-4 h-4" />
                                        {t('integrations.shopify.catalogTab')}
                                    </button>
                                </div>
                            )}

                            {/* Placeholder when not connected */}
                            {!isConnected && (
                                <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                                        <Store className="w-8 h-8 text-white/30" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white/60">Your store will appear here</p>
                                        <p className="text-sm text-white/30 mt-1">Connect your Shopify store to get started</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ── Catalog Tab ─────────────────────────────────────────── */
                    <div className="space-y-6">
                        {/* Toolbar */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                            <div className="flex items-center gap-2 flex-1 max-w-lg">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder={t('integrations.shopify.searchProducts')}
                                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ff95] transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                                {(['all', 'in_stock', 'out_of_stock'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => { setProductFilter(f); setProductPage(1) }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${productFilter === f ? 'bg-[#00ff95] text-black' : 'text-white/60 hover:text-white'}`}
                                    >
                                        {f === 'all' ? t('integrations.shopify.filterAll')
                                            : f === 'in_stock' ? t('integrations.shopify.filterInStock')
                                                : t('integrations.shopify.filterOutOfStock')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Stats bar */}
                        <div className="flex items-center justify-between text-xs text-white/40">
                            <span>{productTotal} products</span>
                            {config?.lastSyncedAt && <span>{relativeTime(config.lastSyncedAt)}</span>}
                        </div>

                        {/* Products Grid */}
                        {loadingProducts ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="w-8 h-8 animate-spin text-[#00ff95]" />
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                                <Package className="w-12 h-12 text-white/20" />
                                <p className="text-sm text-white/40">
                                    {productSearch ? t('integrations.shopify.noProductsSearch') : t('integrations.shopify.noProducts')}
                                </p>
                                {!productSearch && !isConnected && (
                                    <button onClick={() => setTab('connect')} className="text-xs text-[#00ff95] hover:underline">
                                        {t('integrations.shopify.connectTab')} →
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                                {products.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onCreatePost={handleCreatePost}
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
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-white/60">
                                    {t('integrations.shopify.page')
                                        .replace('{page}', String(productPage))
                                        .replace('{total}', String(productTotalPages))}
                                </span>
                                <button
                                    onClick={() => setProductPage(p => Math.min(productTotalPages, p + 1))}
                                    disabled={productPage >= productTotalPages}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({
    product,
    onCreatePost,
    t,
}: {
    product: Product
    onCreatePost: (p: Product) => void
    t: (key: string) => string
}) {
    const inStock = product.inStock
    const badgeColor = inStock ? 'bg-[#00ff95]/90 text-black' : 'bg-red-500 text-white'
    const badgeText = inStock ? t('integrations.shopify.inStock') : t('integrations.shopify.outOfStock')
    const hasImage = product.images.length > 0

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group hover:border-[#00ff95]/40 transition-all">
            {/* Image */}
            <div className="aspect-square relative overflow-hidden bg-white/10">
                {hasImage ? (
                    <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                        unoptimized
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-white/20" />
                    </div>
                )}
                {/* Stock badge */}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${badgeColor}`}>
                    {badgeText}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                <div>
                    <h5 className="font-bold text-sm truncate" title={product.name}>{product.name}</h5>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-white/40 truncate">{product.category || '—'}</span>
                        <span className="text-sm font-bold text-[#00ff95] shrink-0 ml-2">
                            {product.price ? `$${product.price.toFixed(2)}` : '—'}
                        </span>
                    </div>
                </div>

                {/* Dot indicator */}
                <div className="flex items-center gap-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-[#00ff95]' : 'bg-red-500'}`} />
                    <span className="text-[11px] text-white/40">
                        {product.images.length} image{product.images.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* CTA */}
                <button
                    onClick={() => onCreatePost(product)}
                    className="w-full py-2.5 bg-[#00ff95] text-black text-xs font-bold rounded-xl hover:brightness-90 transition-all flex items-center justify-center gap-1.5"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    {t('integrations.shopify.createAiPost')}
                </button>
            </div>
        </div>
    )
}
