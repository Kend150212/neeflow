'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Video, Play, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoGenNodeData {
    inputUrl?: string
    outputUrl?: string
    duration?: number
    motion?: string
    running?: boolean
    onRun?: () => void
    onChange?: (key: string, val: unknown) => void
}

const DURATIONS = [5, 10]
const MOTIONS = [
    { value: 'subtle', label: 'Subtle' },
    { value: 'dynamic', label: 'Dynamic' },
    { value: 'cinematic', label: 'Cinematic' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VideoGenNode = memo(({ data, selected }: NodeProps<any>) => {
    const d = data as VideoGenNodeData
    const duration = d.duration || 5
    const motion = d.motion || 'subtle'

    return (
        <div className={cn(
            'w-64 rounded-xl border bg-[#0d0a07] transition-all',
            selected ? 'border-orange-400 shadow-[0_0_16px_rgba(251,146,60,0.25)]' : 'border-orange-400/30'
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-orange-400/10 rounded-t-xl">
                <div className="w-5 h-5 rounded bg-orange-400/20 flex items-center justify-center">
                    <Video className="h-3 w-3 text-orange-400" />
                </div>
                <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wide">Video Gen</span>
                <span className="ml-auto text-[10px] text-orange-400/60">Kling · Fal.ai</span>
            </div>

            <div className="p-3 space-y-2.5">
                {/* Input preview */}
                {d.outputUrl ? (
                    <div className="rounded-lg overflow-hidden border border-white/10">
                        <video src={d.outputUrl} controls className="w-full aspect-video" />
                    </div>
                ) : d.inputUrl ? (
                    <div className="rounded-lg overflow-hidden border border-white/10 opacity-60">
                        <img src={d.inputUrl} alt="input frame" className="w-full aspect-video object-cover" />
                    </div>
                ) : (
                    <div className="h-20 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
                        <p className="text-[10px] text-slate-600">Connect image output</p>
                    </div>
                )}

                {/* Duration */}
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Duration</p>
                    <div className="flex gap-2">
                        {DURATIONS.map(s => (
                            <button
                                key={s}
                                onClick={() => d.onChange?.('duration', s)}
                                className={cn(
                                    'flex-1 py-1 rounded-lg text-xs font-bold transition-colors',
                                    duration === s ? 'bg-orange-400 text-[#0d0a07]' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                )}
                            >
                                {s}s
                            </button>
                        ))}
                    </div>
                </div>

                {/* Motion */}
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Motion</p>
                    <div className="flex gap-1">
                        {MOTIONS.map(m => (
                            <button
                                key={m.value}
                                onClick={() => d.onChange?.('motion', m.value)}
                                className={cn(
                                    'flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors',
                                    motion === m.value ? 'bg-orange-400 text-[#0d0a07]' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                )}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Generate button */}
            <div className="px-3 pb-3">
                <button
                    onClick={d.onRun}
                    disabled={d.running || !d.inputUrl}
                    className={cn(
                        'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all',
                        d.running
                            ? 'bg-orange-400/20 text-orange-400 cursor-not-allowed'
                            : !d.inputUrl
                                ? 'bg-white/5 text-slate-600 cursor-not-allowed'
                                : 'bg-orange-400 text-[#0d0a07] hover:bg-orange-300 shadow-[0_0_12px_rgba(251,146,60,0.3)]'
                    )}
                >
                    {d.running
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating video...</>
                        : <><Play className="h-3.5 w-3.5" />Generate Video</>
                    }
                </button>
            </div>

            <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-pink-400 !border-2 !border-[#0d0a07]" />
            <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-orange-400 !border-2 !border-[#0d0a07]" />
        </div>
    )
})

VideoGenNode.displayName = 'VideoGenNode'
