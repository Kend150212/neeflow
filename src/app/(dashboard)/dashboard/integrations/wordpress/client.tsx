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
    Sparkles,
    Eye,
    EyeOff,
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
    CalendarCheck,
    Globe,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import CreateWordPressPostModal from './CreateWordPressPostModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(dateStr: string | null | undefined): string {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    return `${months}mo ago`
}

// ── WordPress SVG Logo ────────────────────────────────────────────────────────
function WordPressLogo({ size = 32 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#21759B">
            <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.181 12c0-1.765.38-3.44 1.059-4.951L7.862 18.6A8.853 8.853 0 013.181 12zm8.819 8.819a8.855 8.855 0 01-2.503-.359L12.021 12l2.588 7.093a8.81 8.81 0 01-2.609.726zM13.3 7.043c.565-.03.931-.03.931-.03.437-.059.387-.696-.07-.665 0 0-1.425.112-2.344.112-.862 0-2.316-.112-2.316-.112-.457-.031-.507.636-.05.666 0 0 .399.029.82.059l1.218 3.337-1.711 5.131-2.846-8.468c.565-.03.931-.03.931-.03.437-.059.387-.696-.07-.665 0 0-1.425.112-2.344.112-.165 0-.359-.003-.562-.01A8.854 8.854 0 0112 3.181c2.318 0 4.418.888 5.998 2.344a3.703 3.703 0 00-.263-.009c-.862 0-1.473.75-1.473 1.554 0 .724.418 1.336.864 2.059.334.588.726 1.337.726 2.426 0 .751-.289 1.631-.665 2.847l-.868 2.905-3.019-8.979v-.278zm6.35 1.74a8.836 8.836 0 01.169 1.716c0 1.33-.254 2.8-.948 4.479l-2.622 7.592A8.857 8.857 0 0019.65 8.783z" />
        </svg>
    )
}

interface WordPressConfig {
    id?: string
    siteUrl: string
    username: string
    hasPassword: boolean
    syncWooProducts: boolean
    syncWpPosts: boolean
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
    lastPostedAt: string | null
    postCount: number
}

interface TestResult {
    ok: boolean
    siteName?: string
    wpVersion?: string
    wooInstalled?: boolean
    error?: string
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
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

export function WordPressClient({ userId, serverChannelId }: { userId: string; serverChannelId: string | null }) {
    const t = useTranslation()
    const router = useRouter()
    const { activeChannel } = useWorkspace()

    const channelId = serverChannelId ?? activeChannel?.id ?? null

    // ── Config state ──────────────────────────────────────────────────────────
    const [config, setConfig] = useState<WordPressConfig>({
        siteUrl: '',
        username: '',
        hasPassword: false,
        syncWooProducts: true,
        syncWpPosts: false,
        lastSyncedAt: null,
        productCount: 0,
    })
    const [appPassword, setAppPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<TestResult | null>(null)
    const [syncing, setSyncing] = useState(false)
    const [disconnecting, setDisconnecting] = useState(false)

    // ── Products state ────────────────────────────────────────────────────────
    const [products, setProducts] = useState<Product[]>([])
    const [productsLoading, setProductsLoading] = useState(false)
    const [productSearch, setProductSearch] = useState('')
    const [productPage, setProductPage] = useState(1)
    const [productTotalPages, setProductTotalPages] = useState(1)
    const [productTotal, setProductTotal] = useState(0)
    const [productStatus, setProductStatus] = useState<'all' | 'in_stock' | 'out_of_stock'>('all')
    const [productCollection, setProductCollection] = useState('')
    const [collections, setCollections] = useState<string[]>([])
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    // ── Selection + modal ─────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [postModalOpen, setPostModalOpen] = useState(false)
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([])

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Load config ───────────────────────────────────────────────────────────
    const loadConfig = useCallback(async () => {
        if (!channelId) { setLoading(false); return }
        setLoading(true)
        try {
            const res = await fetch(`/api/integrations/wordpress?channelId=${channelId}`)
            const data = await res.json()
            if (data.config) {
                setConfig(data.config)
            }
        } catch { /* ignore */ }
        setLoading(false)
    }, [channelId])

    useEffect(() => { loadConfig() }, [loadConfig])

    // ── Load products ─────────────────────────────────────────────────────────
    const loadProducts = useCallback(async () => {
        if (!channelId || !config.productCount) return
        setProductsLoading(true)
        try {
            const params = new URLSearchParams({
                channelId,
                page: String(productPage),
                search: productSearch,
                status: productStatus,
                collection: productCollection,
            })
            const res = await fetch(`/api/integrations/wordpress/products?${params}`)
            const data = await res.json()
            setProducts(data.products ?? [])
            setProductTotalPages(data.totalPages ?? 1)
            setProductTotal(data.total ?? 0)
            if (data.collections) setCollections(data.collections)
        } catch { /* ignore */ }
        setProductsLoading(false)
    }, [channelId, productPage, productSearch, productStatus, productCollection, config.productCount])

    useEffect(() => { loadProducts() }, [loadProducts])

    const handleSearchChange = (val: string) => {
        setProductSearch(val)
        setProductPage(1)
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => loadProducts(), 400)
    }

    // ── Test connection ───────────────────────────────────────────────────────
    const handleTest = async () => {
        if (!channelId) return
        // Save first if password provided
        if (appPassword) await handleSave(true)
        setTesting(true)
        setTestResult(null)
        try {
            const res = await fetch('/api/integrations/wordpress/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId }),
            })
            const data = await res.json()
            setTestResult(data)
            if (data.ok) {
                toast.success(`✅ ${data.siteName}`)
                loadConfig()
            } else {
                toast.error(data.error || t('integrations.wordpress.connectionFailed'))
            }
        } catch {
            setTestResult({ ok: false, error: 'Network error' })
        }
        setTesting(false)
    }

    // ── Save config ───────────────────────────────────────────────────────────
    const handleSave = async (silent = false) => {
        if (!channelId || !config.siteUrl || !config.username) {
            if (!silent) toast.error('Enter site URL and username first')
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/integrations/wordpress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId,
                    siteUrl: config.siteUrl,
                    username: config.username,
                    appPassword: appPassword || undefined,
                    syncWooProducts: config.syncWooProducts,
                    syncWpPosts: config.syncWpPosts,
                }),
            })
            if (res.ok) {
                if (!silent) toast.success(t('integrations.wordpress.savedOk'))
                loadConfig()
                setAppPassword('')
            }
        } catch { /* ignore */ }
        setSaving(false)
    }

    // ── Sync products ─────────────────────────────────────────────────────────
    const handleSync = async () => {
        if (!channelId) return
        setSyncing(true)
        try {
            const res = await fetch('/api/integrations/wordpress/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId }),
            })
            const data = await res.json()
            if (data.success) {
                toast.success(t('integrations.wordpress.syncOk').replace('{synced}', String(data.synced)))
                loadConfig()
                setProductPage(1)
            } else {
                toast.error(data.error || t('integrations.wordpress.syncError'))
            }
        } catch {
            toast.error(t('integrations.wordpress.syncError'))
        }
        setSyncing(false)
    }

    // ── Disconnect ────────────────────────────────────────────────────────────
    const handleDisconnect = async () => {
        if (!channelId || !confirm(t('integrations.wordpress.deleteConfirm'))) return
        setDisconnecting(true)
        try {
            await fetch(`/api/integrations/wordpress?channelId=${channelId}`, { method: 'DELETE' })
            toast.success(t('integrations.wordpress.disconnectedOk'))
            setConfig({ siteUrl: '', username: '', hasPassword: false, syncWooProducts: true, syncWpPosts: false, lastSyncedAt: null, productCount: 0 })
            setProducts([])
        } catch { /* ignore */ }
        setDisconnecting(false)
    }

    // ── Selection helpers ─────────────────────────────────────────────────────
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const n = new Set(prev)
            if (n.has(id)) n.delete(id); else n.add(id)
            return n
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(products.map(p => p.id)))
        }
    }

    const openPostModal = () => {
        const sel = products.filter(p => selectedIds.has(p.id))
        setSelectedProducts(sel)
        setPostModalOpen(true)
    }

    const isConnected = config.hasPassword && !!config.siteUrl

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => router.push('/dashboard/integrations')}
                        className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <WordPressLogo size={28} />
                    <div>
                        <h1 className="text-base font-semibold">WordPress</h1>
                        <p className="text-xs text-muted-foreground">
                            {config.siteUrl || t('integrations.wordpress.notConnected')}
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {isConnected && (
                            <>
                                <span className="text-xs text-muted-foreground">
                                    {config.lastSyncedAt
                                        ? t('integrations.wordpress.lastSynced').replace('{time}', relativeTime(config.lastSyncedAt))
                                        : t('integrations.wordpress.neverSynced')}
                                </span>
                                <button
                                    onClick={handleSync}
                                    disabled={syncing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                >
                                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    {syncing ? t('integrations.wordpress.syncing') : t('integrations.wordpress.forceSyncNow')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* ── Connection Settings ──────────────────────────────────── */}
                <div className="grid lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-4">
                        <div className="border rounded-xl p-5 space-y-4 bg-card">
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-[#21759B]" />
                                <h2 className="font-semibold text-sm">
                                    {isConnected ? t('integrations.wordpress.connected') : t('integrations.wordpress.notConnected')}
                                </h2>
                                {isConnected && <Check className="h-4 w-4 text-green-500" />}
                            </div>

                            {/* Site URL */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">{t('integrations.wordpress.siteUrl')}</label>
                                <input
                                    value={config.siteUrl}
                                    onChange={e => setConfig(c => ({ ...c, siteUrl: e.target.value }))}
                                    placeholder={t('integrations.wordpress.siteUrlPlaceholder')}
                                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <p className="text-[11px] text-muted-foreground">{t('integrations.wordpress.siteUrlHint')}</p>
                            </div>

                            {/* Username */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">{t('integrations.wordpress.username')}</label>
                                <input
                                    value={config.username}
                                    onChange={e => setConfig(c => ({ ...c, username: e.target.value }))}
                                    placeholder={t('integrations.wordpress.usernamePlaceholder')}
                                    autoComplete="username"
                                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            {/* Application Password */}
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground font-medium">{t('integrations.wordpress.appPassword')}</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={appPassword}
                                        onChange={e => setAppPassword(e.target.value)}
                                        placeholder={config.hasPassword ? '••••••••••••' : t('integrations.wordpress.appPasswordPlaceholder')}
                                        autoComplete="new-password"
                                        className="w-full px-3 py-2 pr-10 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{t('integrations.wordpress.appPasswordHint')}</p>
                            </div>

                            {/* Test result */}
                            {testResult && (
                                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.ok ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'}`}>
                                    {testResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                                    <div>
                                        {testResult.ok ? (
                                            <>
                                                <div className="font-medium">{testResult.siteName}</div>
                                                <div className="text-xs mt-0.5 flex items-center gap-2">
                                                    <span>{testResult.wpVersion}</span>
                                                    {testResult.wooInstalled
                                                        ? <span className="text-green-600 font-medium">{t('integrations.wordpress.wooInstalled')}</span>
                                                        : <span className="text-muted-foreground">{t('integrations.wordpress.wooNotInstalled')}</span>}
                                                </div>
                                            </>
                                        ) : (
                                            <span>{testResult.error}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleTest}
                                    disabled={testing || !config.siteUrl || !config.username || (!config.hasPassword && !appPassword)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#21759B] text-white text-sm rounded-lg hover:bg-[#21759B]/90 transition-colors disabled:opacity-40"
                                >
                                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                    {testing ? t('integrations.wordpress.testing') : t('integrations.wordpress.testConnection')}
                                </button>
                                <button
                                    onClick={() => handleSave()}
                                    disabled={saving || !config.siteUrl || !config.username}
                                    className="px-4 py-2 border text-sm rounded-lg hover:bg-muted disabled:opacity-40 transition-colors"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('integrations.wordpress.saveConfig')}
                                </button>
                                {isConnected && (
                                    <button
                                        onClick={handleDisconnect}
                                        disabled={disconnecting}
                                        className="px-3 py-2 border border-red-200 text-red-500 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                                    >
                                        <Power className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── Sync Preferences ─────────────────────────────── */}
                        {isConnected && (
                            <div className="border rounded-xl p-5 bg-card space-y-3">
                                <h2 className="font-semibold text-sm">{t('integrations.wordpress.syncPreferences')}</h2>
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium">{t('integrations.wordpress.syncWooProducts')}</div>
                                            <div className="text-xs text-muted-foreground">{t('integrations.wordpress.syncWooProductsDesc')}</div>
                                        </div>
                                        <Toggle checked={config.syncWooProducts} onChange={v => setConfig(c => ({ ...c, syncWooProducts: v }))} />
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium">{t('integrations.wordpress.syncWpPosts')}</div>
                                            <div className="text-xs text-muted-foreground">{t('integrations.wordpress.syncWpPostsDesc')}</div>
                                        </div>
                                        <Toggle checked={config.syncWpPosts} onChange={v => setConfig(c => ({ ...c, syncWpPosts: v }))} />
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSave()}
                                    disabled={saving}
                                    className="text-xs text-primary hover:underline"
                                >
                                    {saving ? t('integrations.wordpress.saving') : t('integrations.wordpress.saveConfig')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── How-to guide ──────────────────────────────────────── */}
                    <div className="lg:col-span-2">
                        <div className="border rounded-xl p-5 bg-card space-y-3">
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-[#21759B]" />
                                <h3 className="font-semibold text-sm">{t('integrations.wordpress.howToGet')}</h3>
                            </div>
                            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                                {(['howToStep1', 'howToStep2', 'howToStep3', 'howToStep4'] as const).map((key, i) => (
                                    <li key={i}>{t(`integrations.wordpress.${key}`)}</li>
                                ))}
                            </ol>
                            <a
                                href="https://wordpress.org/documentation/article/application-passwords/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-[#21759B] hover:underline mt-2"
                            >
                                <ExternalLink className="h-3 w-3" />
                                WP Application Passwords Guide
                            </a>
                        </div>

                        {/* Stats */}
                        {isConnected && (
                            <div className="border rounded-xl p-4 mt-4 bg-card">
                                <div className="text-2xl font-bold">{config.productCount}</div>
                                <div className="text-xs text-muted-foreground">{t('integrations.wordpress.productsSynced').replace('{count}', String(config.productCount))}</div>
                                {config.lastSyncedAt && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {t('integrations.wordpress.lastSynced').replace('{time}', relativeTime(config.lastSyncedAt))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Product Catalog ──────────────────────────────────────── */}
                {isConnected && config.productCount > 0 && (
                    <div className="space-y-4">
                        {/* Toolbar */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    value={productSearch}
                                    onChange={e => handleSearchChange(e.target.value)}
                                    placeholder={t('integrations.wordpress.searchProducts')}
                                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            {/* Status filter */}
                            <select
                                value={productStatus}
                                onChange={e => { setProductStatus(e.target.value as 'all' | 'in_stock' | 'out_of_stock'); setProductPage(1) }}
                                className="px-3 py-2 text-sm border rounded-lg bg-background"
                            >
                                <option value="all">{t('integrations.wordpress.filterAll')}</option>
                                <option value="in_stock">{t('integrations.wordpress.filterInStock')}</option>
                                <option value="out_of_stock">{t('integrations.wordpress.filterOutOfStock')}</option>
                            </select>

                            {/* Collection filter */}
                            {collections.length > 0 && (
                                <select
                                    value={productCollection}
                                    onChange={e => { setProductCollection(e.target.value); setProductPage(1) }}
                                    className="px-3 py-2 text-sm border rounded-lg bg-background max-w-[180px]"
                                >
                                    <option value="">{t('integrations.wordpress.filterAll')}</option>
                                    {collections.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            )}

                            {/* View toggle */}
                            <div className="flex border rounded-lg overflow-hidden">
                                <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                                    <List className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Select all */}
                            <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                                {selectedIds.size === products.length && products.length > 0
                                    ? <SquareCheck className="h-4 w-4 text-primary" />
                                    : <Square className="h-4 w-4" />}
                                {t('integrations.shopify.modal.selectAll')}
                            </button>

                            {/* Bulk create */}
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={openPostModal}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    {t('integrations.wordpress.bulkAiPost').replace('{count}', String(selectedIds.size))}
                                </button>
                            )}
                        </div>

                        {/* Total */}
                        <p className="text-xs text-muted-foreground">
                            {productTotal} {t('integrations.wordpress.productsSynced').replace('{count}', String(productTotal))}
                        </p>

                        {/* Grid / List */}
                        {productsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">{productSearch ? t('integrations.wordpress.noProductsSearch') : t('integrations.wordpress.noProducts')}</p>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {products.map(p => (
                                    <ProductCard
                                        key={p.id}
                                        product={p}
                                        selected={selectedIds.has(p.id)}
                                        onToggle={() => toggleSelect(p.id)}
                                        onCreatePost={() => { setSelectedProducts([p]); setPostModalOpen(true) }}
                                        t={t}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {products.map(p => (
                                    <ProductRow
                                        key={p.id}
                                        product={p}
                                        selected={selectedIds.has(p.id)}
                                        onToggle={() => toggleSelect(p.id)}
                                        onCreatePost={() => { setSelectedProducts([p]); setPostModalOpen(true) }}
                                        t={t}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {productTotalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 pt-4">
                                <button
                                    onClick={() => setProductPage(p => p - 1)}
                                    disabled={productPage <= 1}
                                    className="p-2 border rounded-lg hover:bg-muted disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-sm text-muted-foreground">
                                    {t('integrations.wordpress.page').replace('{page}', String(productPage)).replace('{total}', String(productTotalPages))}
                                </span>
                                <button
                                    onClick={() => setProductPage(p => p + 1)}
                                    disabled={productPage >= productTotalPages}
                                    className="p-2 border rounded-lg hover:bg-muted disabled:opacity-40"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state when connected but not synced */}
                {isConnected && config.productCount === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Globe className="h-14 w-14 mb-4 opacity-20" />
                        <h3 className="text-base font-medium text-foreground mb-1">{t('integrations.wordpress.noProducts')}</h3>
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm transition-colors"
                        >
                            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            {t('integrations.wordpress.forceSyncNow')}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Post Modal ───────────────────────────────────────────────── */}
            {postModalOpen && (
                <CreateWordPressPostModal
                    open={postModalOpen}
                    onClose={() => setPostModalOpen(false)}
                    products={selectedProducts.map(p => ({
                        id: p.id,
                        name: p.name,
                        description: p.description ?? '',
                        price: p.price,
                        salePrice: p.salePrice,
                        category: p.category ?? '',
                        tags: p.tags,
                        images: p.images,
                    }))}
                    activeChannelId={channelId ?? ''}
                    userId={userId}
                    onDone={() => {
                        setPostModalOpen(false)
                        setSelectedIds(new Set())
                        loadProducts()
                    }}
                />
            )}
        </div>
    )
}

// ── Product Card (Grid View) ──────────────────────────────────────────────────
function ProductCard({
    product, selected, onToggle, onCreatePost, t,
}: {
    product: Product
    selected: boolean
    onToggle: () => void
    onCreatePost: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: string) => string
}) {
    const [imgErr, setImgErr] = useState(false)

    return (
        <div
            onClick={onToggle}
            className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all ${selected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'}`}
        >
            {/* Image */}
            <div className="aspect-square bg-muted relative">
                {product.images[0] && !imgErr ? (
                    <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover"
                        onError={() => setImgErr(true)}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                        onClick={e => { e.stopPropagation(); onCreatePost() }}
                        className="flex items-center gap-1 bg-white text-black text-xs px-2.5 py-1.5 rounded-lg font-medium"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Post
                    </button>
                </div>

                {/* Check */}
                <div className={`absolute top-1.5 left-1.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'bg-primary border-primary' : 'border-white/80 bg-black/20'}`}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                </div>

                {/* Post count badge */}
                {product.postCount > 0 && (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        <CalendarCheck className="h-2.5 w-2.5" />
                        {product.postCount}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-2">
                <p className="text-xs font-medium line-clamp-2 leading-tight">{product.name}</p>
                {product.price !== null && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {product.salePrice !== null ? (
                            <>
                                <span className="line-through mr-1">${product.price.toFixed(2)}</span>
                                <span className="text-red-500">${product.salePrice.toFixed(2)}</span>
                            </>
                        ) : (
                            `$${product.price.toFixed(2)}`
                        )}
                    </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${product.inStock ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
                        {product.inStock ? t('integrations.wordpress.inStock') : t('integrations.wordpress.outOfStock')}
                    </span>
                </div>
            </div>
        </div>
    )
}

// ── Product Row (List View) ───────────────────────────────────────────────────
function ProductRow({
    product, selected, onToggle, onCreatePost, t,
}: {
    product: Product
    selected: boolean
    onToggle: () => void
    onCreatePost: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: string) => string
}) {
    return (
        <div
            onClick={onToggle}
            className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${selected ? 'ring-2 ring-primary border-primary bg-primary/5' : 'hover:border-primary/30 hover:bg-muted/30'}`}
        >
            {/* Checkbox */}
            <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/50'}`}>
                {selected && <Check className="h-2.5 w-2.5 text-white" />}
            </div>

            {/* Image */}
            <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                {product.images[0] ? (
                    <Image src={product.images[0]} alt={product.name} width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    {product.category && (
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                            <Tag className="h-2.5 w-2.5" />{product.category}
                        </span>
                    )}
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${product.inStock ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
                        {product.inStock ? t('integrations.wordpress.inStock') : t('integrations.wordpress.outOfStock')}
                    </span>
                </div>
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
                {product.price !== null && (
                    <p className="text-sm font-medium">
                        {product.salePrice !== null ? (
                            <span className="text-red-500">${product.salePrice.toFixed(2)}</span>
                        ) : (
                            `$${product.price.toFixed(2)}`
                        )}
                    </p>
                )}
                {product.postCount > 0 && (
                    <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground justify-end">
                        <CalendarCheck className="h-3 w-3" />
                        {product.postCount} posts
                    </div>
                )}
            </div>

            {/* Quick action */}
            <button
                onClick={e => { e.stopPropagation(); onCreatePost() }}
                className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
            >
                <Sparkles className="h-4 w-4" />
            </button>
        </div>
    )
}
