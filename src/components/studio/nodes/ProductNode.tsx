'use client'

import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ShoppingBag, ChevronDown, Loader2, Search, X } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
interface Product {
    id: string
    name: string
    image?: string
    price?: number | string
    description?: string
    url?: string
    source: string
}

interface ProductNodeData {
    channelId?: string
    productId?: string
    productName?: string
    productImage?: string
    price?: number | string
    description?: string
    source?: string
    onChange?: (key: string, val: unknown) => void
}

// ─── Source config ────────────────────────────────────────────
const SOURCES = [
    { id: 'chatbot', label: 'Chat Bot', hint: 'Products from chatbot conversations', icon: '🤖' },
    { id: 'shopify', label: 'Shopify', hint: 'Connected Shopify store', icon: '🛒' },
    { id: 'manual', label: 'Manual', hint: 'Enter product details manually', icon: '✏️' },
]

// ─── Component ────────────────────────────────────────────────
export const ProductNode = memo(({ data }: NodeProps) => {
    const d = data as ProductNodeData
    const channelId = d.channelId

    const [showPicker, setShowPicker] = useState(false)
    const [activeSource, setActiveSource] = useState<string>(d.source || '')
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [error, setError] = useState('')

    // Manual mode form
    const [manualName, setManualName] = useState(d.productName || '')
    const [manualPrice, setManualPrice] = useState(String(d.price || ''))
    const [manualDesc, setManualDesc] = useState(d.description || '')
    const [manualImage, setManualImage] = useState(d.productImage || '')

    async function fetchProducts(source: string) {
        if (!channelId || source === 'manual') return
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/products?source=${source}&search=${encodeURIComponent(search)}`)
            if (res.ok) {
                const data = await res.json()
                setProducts(data.products || [])
            } else {
                const d2 = await res.json()
                setError(d2.error || 'Failed to load products')
            }
        } catch {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (activeSource && activeSource !== 'manual') {
            fetchProducts(activeSource)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSource])

    function selectProduct(p: Product) {
        d.onChange?.('productId', p.id)
        d.onChange?.('productName', p.name)
        d.onChange?.('productImage', p.image || '')
        d.onChange?.('price', p.price || '')
        d.onChange?.('description', p.description || '')
        d.onChange?.('source', activeSource)
        setShowPicker(false)
    }

    function applyManual() {
        d.onChange?.('productId', `manual-${Date.now()}`)
        d.onChange?.('productName', manualName)
        d.onChange?.('productImage', manualImage)
        d.onChange?.('price', manualPrice)
        d.onChange?.('description', manualDesc)
        d.onChange?.('source', 'manual')
        setShowPicker(false)
    }

    const hasProduct = !!d.productId
    const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="w-60 rounded-2xl overflow-visible border border-amber-400/40 bg-[#0d0900] shadow-[0_0_20px_rgba(251,191,36,0.06)] relative">
            {/* Header */}
            <div className="px-4 pt-3 pb-2 border-b border-amber-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-400/15 flex items-center justify-center">
                    <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 flex-1">Product</span>
                {hasProduct && (
                    <button
                        className="nodrag text-[10px] text-slate-500 hover:text-amber-400 transition-colors"
                        onClick={() => { d.onChange?.('productId', ''); setShowPicker(true) }}
                    >
                        Change
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="p-3">
                {hasProduct ? (
                    /* Selected product card */
                    <div className="space-y-2">
                        {d.productImage && (
                            <div className="w-full h-28 rounded-lg overflow-hidden border border-amber-400/20 bg-black/20">
                                <img src={d.productImage} alt={d.productName} className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div>
                            <p className="text-[12px] font-bold text-white leading-snug">{d.productName}</p>
                            {d.price && (
                                <p className="text-[11px] text-amber-400 font-bold mt-0.5">
                                    {typeof d.price === 'number' ? d.price.toLocaleString() + 'đ' : d.price}
                                </p>
                            )}
                            {d.description && (
                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{d.description}</p>
                            )}
                            {d.source && (
                                <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 font-medium uppercase tracking-wide">
                                    {SOURCES.find(s => s.id === d.source)?.label || d.source}
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Empty state — pick a product */
                    <button
                        className="nodrag w-full flex items-center justify-between text-slate-500 hover:text-amber-400 text-xs py-2 px-1 transition-colors"
                        onClick={() => setShowPicker(true)}
                    >
                        <span>Select product...</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    </button>
                )}
            </div>

            {/* Handles */}
            <Handle type="source" position={Position.Right} id="product"
                style={{ top: '50%', background: '#fbbf24', border: '2px solid #0d0900', width: 10, height: 10 }} />

            {/* ─── Product Picker Popover ─── */}
            {showPicker && (
                <div
                    className="nodrag absolute left-full top-0 ml-3 z-[9999] w-72 bg-[#0f100d] border border-amber-400/20 rounded-2xl shadow-2xl overflow-hidden"
                    style={{ minHeight: 300 }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    {/* Popover header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-amber-400/10">
                        <span className="text-xs font-bold text-amber-400">Choose Product</span>
                        <button onClick={() => setShowPicker(false)} className="text-slate-500 hover:text-white">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Source tabs */}
                    <div className="flex border-b border-white/5">
                        {SOURCES.map(s => (
                            <button
                                key={s.id}
                                onClick={() => { setActiveSource(s.id); setSearch('') }}
                                className={`flex-1 py-2 text-[10px] font-bold transition-colors ${activeSource === s.id ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="mr-1">{s.icon}</span>{s.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-3">
                        {!activeSource ? (
                            <p className="text-[11px] text-slate-500 text-center py-6">Select a source above</p>
                        ) : activeSource === 'manual' ? (
                            /* Manual entry form */
                            <div className="space-y-2">
                                <input value={manualName} onChange={e => setManualName(e.target.value)}
                                    placeholder="Product name *"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/40" />
                                <input value={manualPrice} onChange={e => setManualPrice(e.target.value)}
                                    placeholder="Price (e.g. 250,000đ)"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/40" />
                                <input value={manualImage} onChange={e => setManualImage(e.target.value)}
                                    placeholder="Image URL (optional)"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/40" />
                                <textarea value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                                    placeholder="Description (optional)" rows={2}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/40 resize-none" />
                                <button
                                    onClick={applyManual}
                                    disabled={!manualName.trim()}
                                    className="w-full py-2 rounded-lg bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-bold hover:bg-amber-400/30 transition-colors disabled:opacity-40"
                                >
                                    Use this product
                                </button>
                            </div>
                        ) : (
                            /* Product list from API */
                            <>
                                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 mb-2">
                                    <Search className="h-3 w-3 text-slate-500 shrink-0" />
                                    <input
                                        value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="Search products..."
                                        className="flex-1 bg-transparent py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                                    />
                                </div>

                                {loading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                                    </div>
                                ) : error ? (
                                    <div className="py-6 text-center">
                                        <p className="text-[11px] text-red-400">{error}</p>
                                        <button onClick={() => fetchProducts(activeSource)} className="mt-2 text-[10px] text-amber-400 hover:underline">Retry</button>
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <p className="text-[11px] text-slate-500 text-center py-6">
                                        {products.length === 0 ? `No products found in ${SOURCES.find(s => s.id === activeSource)?.label}` : 'No results'}
                                    </p>
                                ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {filtered.map(p => (
                                            <button key={p.id} onClick={() => selectProduct(p)}
                                                className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-amber-400/10 transition-colors text-left group">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-white/5">
                                                    {p.image
                                                        ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                                        : <ShoppingBag className="h-4 w-4 m-3 text-slate-600" />
                                                    }
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-bold text-white truncate group-hover:text-amber-300">{p.name}</p>
                                                    {p.price && <p className="text-[10px] text-amber-400">{typeof p.price === 'number' ? p.price.toLocaleString() + 'đ' : p.price}</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
})

ProductNode.displayName = 'ProductNode'
