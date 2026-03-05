'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Image as ImageIcon, Play, Settings2, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface ImageGenNodeData {
    model?: string
    imageSize?: string
    numImages?: number
    running?: boolean
    lastOutput?: string
    // product data injected via edge
    productName?: string
    productImage?: string
    productDescription?: string
    onRun?: () => void
    onChange?: (key: string, val: unknown) => void
}

const FAL_MODELS = [
    { value: 'fal-ai/flux/schnell', label: 'FLUX Schnell', hint: 'Fast · 4 steps' },
    { value: 'fal-ai/flux/dev', label: 'FLUX Dev', hint: 'High quality · 20 steps' },
    { value: 'fal-ai/flux-realism', label: 'FLUX Realism', hint: 'Photorealistic' },
    { value: 'fal-ai/stable-diffusion-v3-medium', label: 'SD3 Medium', hint: 'Balanced' },
    { value: 'fal-ai/imagen4/preview', label: 'Imagen 4', hint: 'Google · Best quality' },
]

const SIZES = [
    { value: 'square_hd', label: '1:1 Square HD' },
    { value: 'portrait_4_3', label: '3:4 Portrait' },
    { value: 'landscape_4_3', label: '4:3 Landscape' },
    { value: 'landscape_16_9', label: '16:9 Wide' },
    { value: 'portrait_16_9', label: '9:16 Reel' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ImageGenNode = memo(({ data, selected }: NodeProps<any>) => {
    const d = (data as ImageGenNodeData)
    const model = d.model || 'fal-ai/flux/schnell'
    const imageSize = d.imageSize || 'landscape_4_3'
    const numImages = d.numImages || 1

    return (
        <div className={cn(
            'w-64 rounded-xl border bg-[#0d0a14] transition-all',
            selected ? 'border-pink-400 shadow-[0_0_16px_rgba(244,114,182,0.25)]' : 'border-pink-400/30'
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-pink-400/10 rounded-t-xl">
                <div className="w-5 h-5 rounded bg-pink-400/20 flex items-center justify-center">
                    <ImageIcon className="h-3 w-3 text-pink-400" />
                </div>
                <span className="text-[11px] font-bold text-pink-400 uppercase tracking-wide">Image Gen</span>
                <Settings2 className="h-3 w-3 text-pink-400/60 ml-auto" />
            </div>

            {/* Settings */}
            <div className="p-3 space-y-2.5">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Model</p>
                    <Select value={model} onValueChange={v => d.onChange?.('model', v)}>
                        <SelectTrigger className="h-7 text-[11px] bg-white/5 border-white/10 text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {FAL_MODELS.map(m => (
                                <SelectItem key={m.value} value={m.value} className="text-xs">
                                    <span className="font-medium">{m.label}</span>
                                    <span className="text-muted-foreground ml-1">— {m.hint}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Size</p>
                    <Select value={imageSize} onValueChange={v => d.onChange?.('imageSize', v)}>
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

                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Count</p>
                        <div className="flex items-center gap-2">
                            {[1, 2, 4].map(n => (
                                <button
                                    key={n}
                                    onClick={() => d.onChange?.('numImages', n)}
                                    className={cn(
                                        'w-7 h-7 rounded-lg text-xs font-bold transition-colors',
                                        numImages === n ? 'bg-pink-400 text-[#0d0a14]' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    )}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Preview of last output */}
                {d.lastOutput && (
                    <div className="rounded-lg overflow-hidden border border-white/10 mt-1">
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
                            ? 'bg-pink-400/20 text-pink-400 cursor-not-allowed'
                            : 'bg-pink-400 text-[#0d0a14] hover:bg-pink-300 shadow-[0_0_12px_rgba(244,114,182,0.3)]'
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
                <div className="mx-3 mb-2 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2 py-1.5">
                    {d.productImage && (
                        <img src={d.productImage} alt={d.productName} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                    )}
                    <span className="text-[10px] text-amber-400 font-medium truncate">{d.productName}</span>
                </div>
            )}

            {/* Input handles */}
            <Handle type="target" position={Position.Left} id="avatar" style={{ top: '30%' }} className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-[#0d0a14]" />
            <Handle type="target" position={Position.Left} id="prompt" style={{ top: '55%' }} className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-[#0d0a14]" />
            <Handle type="target" position={Position.Left} id="product" style={{ top: '80%', background: '#fbbf24', border: '2px solid #0d0a14', width: 10, height: 10, left: -5 }} />
            {/* Output handle */}
            <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-pink-400 !border-2 !border-[#0d0a14]" />
        </div>
    )
})

ImageGenNode.displayName = 'ImageGenNode'
