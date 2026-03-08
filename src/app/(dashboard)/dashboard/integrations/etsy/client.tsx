'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import { useTranslation } from '@/lib/i18n'
import {
    ArrowLeft, Check, Loader2, Power, RefreshCw, Search, Sparkles,
    ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, ExternalLink,
    SquareCheck, Square, LayoutGrid, List, Image as ImageIcon, Info,
    CalendarCheck,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import CreateEtsyPostModal from './CreateEtsyPostModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(dateStr: string | null | undefined): string {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

// ── Etsy Logo ─────────────────────────────────────────────────────────────────
function EtsyLogo({ size = 32 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#F1641E">
            <path d="M20 3H4C3.45 3 3 3.45 3 4v16c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zm-4.29 4.71c-.29.29-.71.29-1 0-.57-.57-1.5-.94-2.71-.94-1.76 0-2.94.88-2.94 2.06 0 1.12.71 1.76 2.59 2.35l.82.24c2.47.71 3.76 1.94 3.76 3.88C16.23 17.41 14.35 19 11.41 19c-2.06 0-3.82-.71-4.88-1.88-.24-.29-.18-.71.12-.94.29-.24.71-.18.94.12.82 1 2.12 1.59 3.82 1.59 2.12 0 3.53-.94 3.53-2.41 0-1.24-.82-1.94-2.65-2.47l-.82-.24c-2.41-.71-3.71-1.88-3.71-3.76C8.77 6.94 10.53 5.17 12 5.17c1.59 0 2.77.47 3.71 1.59.24.29.24.71 0 .95z" />
        </svg>
    )
}

interface EtsyConfig {
    id?: string
    shopId: string
    shopName: string
    tokenExpiresAt: string | null
    isExpired: boolean
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

export default function EtsyClient({
    userId,
    serverChannelId,
    initialConnected,
    initialError,
}: {
    userId: string
    serverChannelId: string | null
    initialConnected: boolean
    initialError: string | null
}) {
    const t = useTranslation()
    const router = useRouter()
    const { activeChannel } = useWorkspace()

    const channelId = serverChannelId ?? activeChannel?.id ?? null

    const [config, setConfig] = useState<EtsyConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [disconnecting, setDisconnecting] = useState(false)

    const [products, setProducts] = useState<Product[]>([])
    const [productsLoading, setProductsLoading] = useState(false)
    const [productSearch, setProductSearch] = useState('')
    const [productPage, setProductPage] = useState(1)
    const [productTotalPages, setProductTotalPages] = useState(1)
    const [productTotal, setProductTotal] = useState(0)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [postModalOpen, setPostModalOpen] = useState(false)
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([])

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Initial toast from OAuth redirect ─────────────────────────────────────
    useEffect(() => {
        if (initialConnected) toast.success(t('integrations.etsy.connectedOk'))
        if (initialError) {
            const errMap: Record<string, string> = {
                no_shop: t('integrations.etsy.errorNoShop'),
                token_exchange_failed: t('integrations.etsy.errorTokenFailed'),
                session_expired: t('integrations.etsy.errorSessionExpired'),
                state_mismatch: t('integrations.etsy.errorStateMismatch'),
                not_configured: t('integrations.etsy.errorNotConfigured'),
            }
            toast.error(errMap[initialError] || initialError)
        }
        // Clean URL params
        if (initialConnected || initialError) {
            router.replace('/dashboard/integrations/etsy', { scroll: false })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Load config ───────────────────────────────────────────────────────────
    const loadConfig = useCallback(async () => {
        if (!channelId) { setLoading(false); return }
        setLoading(true)
        try {
            const res = await fetch(`/api/integrations/etsy?channelId=${channelId}`)
            const data = await res.json()
            setConfig(data.config ?? null)
        } catch { /* ignore */ }
        setLoading(false)
    }, [channelId])

    useEffect(() => { loadConfig() }, [loadConfig])

    // ── Load products ─────────────────────────────────────────────────────────
    const loadProducts = useCallback(async () => {
        if (!channelId || !config?.productCount) return
        setProductsLoading(true)
        try {
            const params = new URLSearchParams({
                channelId,
                page: String(productPage),
                search: productSearch,
            })
            const res = await fetch(`/api/integrations/etsy/products?${params}`)
            const data = await res.json()
            setProducts(data.products ?? [])
            setProductTotalPages(Math.ceil((data.total ?? 0) / 24) || 1)
            setProductTotal(data.total ?? 0)
        } catch { /* ignore */ }
        setProductsLoading(false)
    }, [channelId, productPage, productSearch, config?.productCount])

    useEffect(() => { loadProducts() }, [loadProducts])

    const handleSearchChange = (val: string) => {
        setProductSearch(val)
        setProductPage(1)
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => loadProducts(), 400)
    }

    // ── Connect (OAuth) ───────────────────────────────────────────────────────
    const handleConnect = () => {
        if (!channelId) { toast.error('Select a channel first'); return }
        window.location.href = `/api/integrations/etsy/oauth/authorize?channelId=${channelId}`
    }

    // ── Sync ──────────────────────────────────────────────────────────────────
    const handleSync = async () => {
        if (!channelId) return
        setSyncing(true)
        try {
            const res = await fetch('/api/integrations/etsy/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId }),
            })
            const data = await res.json()
            if (data.ok) {
                toast.success(t('integrations.etsy.syncOk').replace('{synced}', String(data.synced)))
                loadConfig()
                setProductPage(1)
            } else {
                toast.error(data.error || t('integrations.etsy.syncError'))
            }
        } catch {
            toast.error(t('integrations.etsy.syncError'))
        }
        setSyncing(false)
    }

    // ── Disconnect ────────────────────────────────────────────────────────────
    const handleDisconnect = async () => {
        if (!channelId || !confirm(t('integrations.etsy.deleteConfirm'))) return
        setDisconnecting(true)
        try {
            await fetch(`/api/integrations/etsy?channelId=${channelId}`, { method: 'DELETE' })
            toast.success(t('integrations.etsy.disconnectedOk'))
            setConfig(null)
            setProducts([])
        } catch { /* ignore */ }
        setDisconnecting(false)
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
    }
    const toggleSelectAll = () => {
        setSelectedIds(selectedIds.size === products.length && products.length > 0 ? new Set() : new Set(products.map(p => p.id)))
    }
    const openPostModal = () => {
        setSelectedProducts(products.filter(p => selectedIds.has(p.id)))
        setPostModalOpen(true)
    }

    const isConnected = !!config

    if (loading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )

    return (
        <div className="min-h-screen bg-background">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => router.push('/dashboard/integrations')}
                        className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <EtsyLogo size={28} />
                    <div>
                        <h1 className="text-base font-semibold">Etsy</h1>
                        <p className="text-xs text-muted-foreground">
                            {config ? config.shopName : t('integrations.etsy.notConnected')}
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {isConnected && (
                            <>
                                <span className="text-xs text-muted-foreground">
                                    {config!.lastSyncedAt
                                        ? t('integrations.etsy.lastSynced').replace('{time}', relativeTime(config!.lastSyncedAt))
                                        : t('integrations.etsy.neverSynced')}
                                </span>
                                <button onClick={handleSync} disabled={syncing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
                                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    {syncing ? t('integrations.etsy.syncing') : t('integrations.etsy.syncNow')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                <div className="grid lg:grid-cols-5 gap-6">
                    {/* ── Left: Connection panel ─────────────────────────── */}
                    <div className="lg:col-span-3">
                        <div className="border rounded-xl p-5 space-y-4 bg-card">
                            {isConnected ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        <h2 className="font-semibold text-sm">{t('integrations.etsy.connected')}</h2>
                                        {config!.isExpired && (
                                            <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-full px-2 py-0.5">
                                                <AlertCircle className="h-3 w-3" />
                                                {t('integrations.etsy.tokenExpired')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                        <EtsyLogo size={36} />
                                        <div>
                                            <div className="font-medium text-sm">{config!.shopName}</div>
                                            <div className="text-xs text-muted-foreground">Shop ID: {config!.shopId}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {config!.isExpired && (
                                            <button onClick={handleConnect}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#F1641E] text-white text-sm rounded-lg hover:bg-[#F1641E]/90 transition-colors">
                                                <RefreshCw className="h-4 w-4" />
                                                {t('integrations.etsy.reconnect')}
                                            </button>
                                        )}
                                        <button onClick={handleDisconnect} disabled={disconnecting}
                                            className="px-3 py-2 border border-red-200 text-red-500 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40">
                                            {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 className="font-semibold text-sm">{t('integrations.etsy.notConnected')}</h2>
                                    <p className="text-sm text-muted-foreground">{t('integrations.etsy.oauthDescription')}</p>
                                    <button onClick={handleConnect}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F1641E] text-white text-sm rounded-lg hover:bg-[#F1641E]/90 transition-colors font-medium">
                                        <EtsyLogo size={18} />
                                        {t('integrations.etsy.connectWithEtsy')}
                                    </button>
                                    <p className="text-[11px] text-muted-foreground text-center">{t('integrations.etsy.oauthNote')}</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Right: Guide + Stats ─────────────────────────────── */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="border rounded-xl p-5 bg-card space-y-3">
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-[#F1641E]" />
                                <h3 className="font-semibold text-sm">{t('integrations.etsy.howTo')}</h3>
                            </div>
                            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                                {(['howToStep1', 'howToStep2', 'howToStep3', 'howToStep4'] as const).map((key, i) => (
                                    <li key={i}>{t(`integrations.etsy.${key}`)}</li>
                                ))}
                            </ol>
                            <a href="https://www.etsy.com/developers/documentation/getting_started/oauth2"
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-[#F1641E] hover:underline">
                                <ExternalLink className="h-3 w-3" />
                                {t('integrations.etsy.devDocsLink')}
                            </a>
                        </div>

                        {isConnected && (
                            <div className="border rounded-xl p-4 bg-card">
                                <div className="text-2xl font-bold">{config!.productCount}</div>
                                <div className="text-xs text-muted-foreground">{t('integrations.etsy.listingsSynced')}</div>
                                {config!.lastSyncedAt && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {t('integrations.etsy.lastSynced').replace('{time}', relativeTime(config!.lastSyncedAt))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Product Catalog ───────────────────────────────────────── */}
                {isConnected && config!.productCount > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input value={productSearch} onChange={e => handleSearchChange(e.target.value)}
                                    placeholder={t('integrations.etsy.searchListings')}
                                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                            <div className="flex border rounded-lg overflow-hidden">
                                <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><LayoutGrid className="h-4 w-4" /></button>
                                <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><List className="h-4 w-4" /></button>
                            </div>
                            <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                                {selectedIds.size === products.length && products.length > 0 ? <SquareCheck className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                                {t('integrations.etsy.selectAll')}
                            </button>
                            {selectedIds.size > 0 && (
                                <button onClick={openPostModal}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors">
                                    <Sparkles className="h-4 w-4" />
                                    {t('integrations.etsy.bulkAiPost').replace('{count}', String(selectedIds.size))}
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">{productTotal} {t('integrations.etsy.listings')}</p>

                        {productsLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">{t('integrations.etsy.noListings')}</p>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {products.map(p => (
                                    <EtsyProductCard key={p.id} product={p} selected={selectedIds.has(p.id)}
                                        onToggle={() => toggleSelect(p.id)}
                                        onCreatePost={() => { setSelectedProducts([p]); setPostModalOpen(true) }} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {products.map(p => (
                                    <EtsyProductRow key={p.id} product={p} selected={selectedIds.has(p.id)}
                                        onToggle={() => toggleSelect(p.id)}
                                        onCreatePost={() => { setSelectedProducts([p]); setPostModalOpen(true) }} />
                                ))}
                            </div>
                        )}

                        {productTotalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 pt-4">
                                <button onClick={() => setProductPage(p => p - 1)} disabled={productPage <= 1} className="p-2 border rounded-lg hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                                <span className="text-sm text-muted-foreground">{productPage} / {productTotalPages}</span>
                                <button onClick={() => setProductPage(p => p + 1)} disabled={productPage >= productTotalPages} className="p-2 border rounded-lg hover:bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                            </div>
                        )}
                    </div>
                )}

                {isConnected && config!.productCount === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <EtsyLogo size={56} />
                        <h3 className="text-base font-medium text-foreground mt-4 mb-1">{t('integrations.etsy.noListings')}</h3>
                        <button onClick={handleSync} disabled={syncing}
                            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm">
                            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            {t('integrations.etsy.syncNow')}
                        </button>
                    </div>
                )}
                {/* ── Etsy Attribution (required by Etsy API ToS) ──────────── */}
                <p className="text-[10px] text-muted-foreground/50 text-center pt-2 pb-4">
                    The term &quot;Etsy&quot; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
                </p>
            </div>

            {postModalOpen && (
                <CreateEtsyPostModal
                    open={postModalOpen}
                    onClose={() => setPostModalOpen(false)}
                    products={selectedProducts.map(p => ({
                        id: p.id, name: p.name, description: p.description ?? '',
                        price: p.price, salePrice: p.salePrice, category: p.category ?? '',
                        tags: p.tags, images: p.images,
                    }))}
                    activeChannelId={channelId ?? ''}
                    userId={userId}
                    onDone={() => { setPostModalOpen(false); setSelectedIds(new Set()); loadProducts() }}
                />
            )}
        </div>
    )
}

// ── Grid Card ─────────────────────────────────────────────────────────────────
function EtsyProductCard({ product, selected, onToggle, onCreatePost }: {
    product: Product; selected: boolean; onToggle: () => void; onCreatePost: () => void
}) {
    const [imgErr, setImgErr] = useState(false)
    return (
        <div onClick={onToggle}
            className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all ${selected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'}`}>
            <div className="aspect-square bg-muted relative">
                {product.images[0] && !imgErr ? (
                    <Image src={product.images[0]} alt={product.name} fill className="object-cover" onError={() => setImgErr(true)} />
                ) : (
                    <div className="flex items-center justify-center h-full"><ImageIcon className="h-8 w-8 text-muted-foreground/40" /></div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={e => { e.stopPropagation(); onCreatePost() }}
                        className="flex items-center gap-1 bg-white text-black text-xs px-2.5 py-1.5 rounded-lg font-medium">
                        <Sparkles className="h-3.5 w-3.5" /> AI Post
                    </button>
                </div>
                <div className={`absolute top-1.5 left-1.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'bg-primary border-primary' : 'border-white/80 bg-black/20'}`}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                </div>
                {!product.inStock && (
                    <div className="absolute bottom-1 right-1 bg-red-500 text-white text-[9px] px-1 py-0.5 rounded">
                        OOS
                    </div>
                )}
            </div>
            <div className="p-2">
                <p className="text-xs font-medium line-clamp-2 leading-tight">{product.name}</p>
                {product.price !== null && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">${product.price.toFixed(2)}</p>
                )}
            </div>
        </div>
    )
}

// ── List Row ──────────────────────────────────────────────────────────────────
function EtsyProductRow({ product, selected, onToggle, onCreatePost }: {
    product: Product; selected: boolean; onToggle: () => void; onCreatePost: () => void
}) {
    const [imgErr, setImgErr] = useState(false)
    return (
        <div onClick={onToggle}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selected ? 'ring-2 ring-primary border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                {selected && <Check className="h-3 w-3 text-white" />}
            </div>
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                {product.images[0] && !imgErr ? (
                    <Image src={product.images[0]} alt={product.name} fill className="object-cover" onError={() => setImgErr(true)} />
                ) : (
                    <div className="flex items-center justify-center h-full"><ImageIcon className="h-5 w-5 text-muted-foreground/40" /></div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    {product.category && <span className="text-[11px] text-muted-foreground">{product.category}</span>}
                    {!product.inStock && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Out of stock</span>}
                    <CalendarCheck className="h-3 w-3 text-muted-foreground/40 ml-auto" />
                </div>
            </div>
            {product.price !== null && (
                <span className="text-sm font-medium shrink-0">${product.price.toFixed(2)}</span>
            )}
            <button onClick={e => { e.stopPropagation(); onCreatePost() }}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors">
                <Sparkles className="h-3 w-3" /> AI
            </button>
        </div>
    )
}
