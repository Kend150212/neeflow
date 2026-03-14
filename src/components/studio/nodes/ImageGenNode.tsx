'use client'

import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Image as ImageIcon, Play, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface ProviderModel { value: string; label: string; hint: string }
interface AvailableProvider { provider: string; label: string; models: ProviderModel[] }

interface ImageGenNodeData {
    provider?: string
    model?: string
    imageSize?: string
    numImages?: number
    imagePrompt?: string   // built-in prompt (image-specific)
    running?: boolean
    lastOutput?: string
    channelId?: string
    // injected by edges
    productName?: string
    productImage?: string
    // callbacks
    onRun?: () => void
    onChange?: (key: string, val: unknown) => void
    onEnhancePrompt?: (nodeId: string, currentPrompt: string) => void
}

const SIZES = [
    { value: 'square_hd', label: '1:1 Square HD' },
    { value: 'portrait_4_3', label: '3:4 Portrait' },
    { value: 'landscape_4_3', label: '4:3 Landscape' },
    { value: 'landscape_16_9', label: '16:9 Wide' },
    { value: 'portrait_16_9', label: '9:16 Reel' },
]

const PROVIDER_COLORS: Record<string, string> = {
    fal_ai: 'text-pink-400 border-pink-400/40 bg-pink-400/10',
    runware: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
    openai: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
    gemini: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
}

const PROVIDER_HEADER_COLORS: Record<string, string> = {
    fal_ai: 'border-pink-400 shadow-[0_0_16px_rgba(244,114,182,0.25)]',
    runware: 'border-orange-400 shadow-[0_0_16px_rgba(251,146,60,0.25)]',
    openai: 'border-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.25)]',
    gemini: 'border-blue-400 shadow-[0_0_16px_rgba(96,165,250,0.25)]',
}

const PROVIDER_ACCENT: Record<string, { bg: string; text: string; ring: string }> = {
    fal_ai: { bg: 'bg-pink-400', text: 'text-[#0d0a14]', ring: 'bg-pink-400/10' },
    runware: { bg: 'bg-orange-400', text: 'text-[#0d0a14]', ring: 'bg-orange-400/10' },
    openai: { bg: 'bg-emerald-400', text: 'text-[#0d0a14]', ring: 'bg-emerald-400/10' },
    gemini: { bg: 'bg-blue-400', text: 'text-[#0d0a14]', ring: 'bg-blue-400/10' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ImageGenNode = memo(({ id, data, selected }: NodeProps<any>) => {
    const d = data as ImageGenNodeData
    const provider = d.provider || 'fal_ai'
    const model = d.model || ''
    const imageSize = d.imageSize || 'landscape_4_3'
    const numImages = d.numImages || 1
    const channelId = d.channelId || ''

    const [providers, setProviders] = useState<AvailableProvider[]>([])
    const [loadingProviders, setLoadingProviders] = useState(false)
    const [localPrompt, setLocalPrompt] = useState(d.imagePrompt || '')
    const [enhancing, setEnhancing] = useState(false)

    // Stable refs to prevent recreating callbacks
    const onChangeRef = useRef(d.onChange)
    useEffect(() => { onChangeRef.current = d.onChange }, [d.onChange])
    const localPromptRef = useRef(localPrompt)
    useEffect(() => { localPromptRef.current = localPrompt }, [localPrompt])

    // Load available providers on mount
    useEffect(() => {
        if (!channelId) return
        setLoadingProviders(true)
        fetch(`/api/studio/channels/${channelId}/image-providers`)
            .then(r => r.json())
            .then(data => {
                const list: AvailableProvider[] = data.providers || []
                setProviders(list)
                // Auto-select first provider if none set
                if (!d.provider && list.length > 0) {
                    const first = list[0]
                    onChangeRef.current?.('provider', first.provider)
                    if (!d.model && first.models.length > 0) {
                        onChangeRef.current?.('model', first.models[0].value)
                    }
                }
            })
            .catch(() => setProviders([]))
            .finally(() => setLoadingProviders(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId])

    // When provider changes → reset model to first available
    const handleProviderChange = useCallback((newProvider: string) => {
        onChangeRef.current?.('provider', newProvider)
        const found = providers.find(p => p.provider === newProvider)
        if (found?.models?.[0]) {
            onChangeRef.current?.('model', found.models[0].value)
        }
    }, [providers])

    // Sync localPrompt → node data (debounced)
    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const handlePromptChange = useCallback((val: string) => {
        setLocalPrompt(val)
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = setTimeout(() => {
            onChangeRef.current?.('imagePrompt', val)
        }, 300)
    }, [])

    // AI Enhance prompt
    const handleEnhance = useCallback(async () => {
        if (!channelId || enhancing) return
        setEnhancing(true)
        try {
            const res = await fetch(`/api/studio/channels/${channelId}/prompt-suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPrompt: localPromptRef.current }),
            })
            if (res.ok) {
                const data = await res.json()
                const suggestions: string[] = data.suggestions || []
                if (suggestions[0]) {
                    setLocalPrompt(suggestions[0])
                    onChangeRef.current?.('imagePrompt', suggestions[0])
                }
            }
        } finally {
            setEnhancing(false)
        }
    }, [channelId, enhancing])

    const currentModels = providers.find(p => p.provider === provider)?.models || []
    const accent = PROVIDER_ACCENT[provider] || PROVIDER_ACCENT.fal_ai
    const borderColor = selected
        ? (PROVIDER_HEADER_COLORS[provider] || 'border-pink-400 shadow-[0_0_16px_rgba(244,114,182,0.25)]')
        : 'border-white/10'

    return (
        <div className={cn('w-72 rounded-xl border bg-[#0d0a14] transition-all', borderColor)}>
            {/* Header */}
            <div className={cn('flex items-center gap-2 px-3 py-2 border-b border-white/10 rounded-t-xl', accent.ring)}>
                <div className={cn('w-5 h-5 rounded flex items-center justify-center', accent.ring)}>
                    <ImageIcon className="h-3 w-3 text-current" style={{ color: 'inherit' }} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-white">Image Gen</span>
                {/* Provider badge */}
                {!loadingProviders && (
                    <span className={cn('ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded border', PROVIDER_COLORS[provider])}>
                        {providers.find(p => p.provider === provider)?.label || provider}
                    </span>
                )}
                {loadingProviders && <Loader2 className="ml-auto h-3 w-3 animate-spin text-white/40" />}
            </div>

            <div className="p-3 space-y-2.5">
                {/* Provider selector */}
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Provider</p>
                    {providers.length === 0 && !loadingProviders ? (
                        <p className="text-[10px] text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-1.5">
                            No image API key configured. Add one in Settings → API Keys.
                        </p>
                    ) : (
                        <Select value={provider} onValueChange={handleProviderChange}>
                            <SelectTrigger className="h-7 text-[11px] bg-white/5 border-white/10 text-white">
                                <SelectValue placeholder="Select provider..." />
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </SelectTrigger>
                            <SelectContent>
                                {providers.map(p => (
                                    <SelectItem key={p.provider} value={p.provider} className="text-xs">
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Model selector */}
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Model</p>
                    <Select
                        value={model || currentModels[0]?.value || ''}
                        onValueChange={v => onChangeRef.current?.('model', v)}
                        disabled={currentModels.length === 0}
                    >
                        <SelectTrigger className="h-7 text-[11px] bg-white/5 border-white/10 text-white">
                            <SelectValue placeholder="Select model..." />
                        </SelectTrigger>
                        <SelectContent>
                            {currentModels.map(m => (
                                <SelectItem key={m.value} value={m.value} className="text-xs">
                                    <span className="font-medium">{m.label}</span>
                                    <span className="text-muted-foreground ml-1">— {m.hint}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Size */}
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Size</p>
                    <Select value={imageSize} onValueChange={v => onChangeRef.current?.('imageSize', v)}>
                        <SelectTrigger className="h-7 text-[11px] bg-white/5 border-white/10 text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SIZES.map(s => (
                                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Count */}
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Count</p>
                    <div className="flex items-center gap-2">
                        {[1, 2, 4].map(n => (
                            <button
                                key={n}
                                onClick={() => onChangeRef.current?.('numImages', n)}
                                className={cn(
                                    'w-7 h-7 rounded-lg text-xs font-bold transition-colors',
                                    numImages === n ? `${accent.bg} ${accent.text}` : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                )}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Built-in Prompt */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Image Prompt</p>
                        <button
                            className={cn(
                                'nodrag flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all',
                                enhancing
                                    ? 'text-white/40 cursor-not-allowed'
                                    : 'text-violet-400 hover:bg-violet-400/10'
                            )}
                            onClick={handleEnhance}
                            disabled={enhancing}
                            title="AI Suggest prompt"
                        >
                            {enhancing
                                ? <><Loader2 className="h-2.5 w-2.5 animate-spin" />...</>
                                : <><Sparkles className="h-2.5 w-2.5" />AI</>
                            }
                        </button>
                    </div>
                    <textarea
                        className="nodrag w-full h-16 text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white placeholder-slate-600 resize-none focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
                        placeholder="Image-specific prompt... (master prompt from PromptNode will be prepended)"
                        value={localPrompt}
                        onChange={e => handlePromptChange(e.target.value)}
                    />
                    <p className="text-[9px] text-slate-600 mt-0.5">
                        Combined with PromptNode: <span className="text-slate-500">Master + this prompt</span>
                    </p>
                </div>

                {/* Preview of last output */}
                {d.lastOutput && (
                    <div className="rounded-lg overflow-hidden border border-white/10">
                        <img src={d.lastOutput} alt="last output" className="w-full aspect-video object-cover" />
                    </div>
                )}
            </div>

            {/* Run button */}
            <div className="px-3 pb-3">
                <button
                    onClick={d.onRun}
                    disabled={d.running}
                    className={cn(
                        'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all',
                        d.running
                            ? `${accent.ring} text-current cursor-not-allowed opacity-60`
                            : `${accent.bg} ${accent.text} hover:opacity-90 shadow-lg`
                    )}
                >
                    {d.running
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating...</>
                        : <><Play className="h-3.5 w-3.5" />Generate</>
                    }
                </button>
            </div>

            {/* Connected product preview */}
            {d.productName && (
                <div className="mx-3 mb-3 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2 py-1.5">
                    {d.productImage && (
                        <img src={d.productImage} alt={d.productName} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                    )}
                    <span className="text-[10px] text-amber-400 font-medium truncate">{d.productName}</span>
                </div>
            )}

            {/* Input handles */}
            <Handle type="target" position={Position.Left} id="avatar" style={{ top: '28%' }} className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-[#0d0a14]" />
            <Handle type="target" position={Position.Left} id="prompt" style={{ top: '50%' }} className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-[#0d0a14]" />
            <Handle type="target" position={Position.Left} id="product" style={{ top: '72%', background: '#fbbf24', border: '2px solid #0d0a14', width: 10, height: 10, left: -5 }} />
            {/* Output handle */}
            <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-pink-400 !border-2 !border-[#0d0a14]" />
        </div>
    )
})

ImageGenNode.displayName = 'ImageGenNode'
