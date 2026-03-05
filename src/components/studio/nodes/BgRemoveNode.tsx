'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Scissors, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BgRemoveNodeData {
    inputUrl?: string
    outputUrl?: string
    running?: boolean
    onRun?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BgRemoveNode = memo(({ data, selected }: NodeProps<any>) => {
    const d = data as BgRemoveNodeData

    return (
        <div className={cn(
            'w-52 rounded-xl border bg-[#140a14] transition-all',
            selected ? 'border-fuchsia-400 shadow-[0_0_16px_rgba(232,121,249,0.25)]' : 'border-fuchsia-400/30'
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-fuchsia-400/10 rounded-t-xl">
                <div className="w-5 h-5 rounded bg-fuchsia-400/20 flex items-center justify-center">
                    <Scissors className="h-3 w-3 text-fuchsia-400" />
                </div>
                <span className="text-[11px] font-bold text-fuchsia-400 uppercase tracking-wide">Remove BG</span>
            </div>

            {/* Preview */}
            <div className="p-3">
                {d.outputUrl ? (
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-checkerboard">
                        <img src={d.outputUrl} alt="no background" className="w-full aspect-square object-contain" />
                    </div>
                ) : d.inputUrl ? (
                    <div className="rounded-lg overflow-hidden border border-white/10 opacity-50">
                        <img src={d.inputUrl} alt="input" className="w-full aspect-square object-cover" />
                    </div>
                ) : (
                    <div className="h-20 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
                        <p className="text-[10px] text-slate-600">Connect image output</p>
                    </div>
                )}
            </div>

            {/* Run button */}
            <div className="px-3 pb-3">
                <button
                    onClick={d.onRun}
                    disabled={d.running || !d.inputUrl}
                    className={cn(
                        'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all',
                        d.running
                            ? 'bg-fuchsia-400/20 text-fuchsia-400 cursor-not-allowed'
                            : !d.inputUrl
                                ? 'bg-white/5 text-slate-600 cursor-not-allowed'
                                : 'bg-fuchsia-400 text-[#140a14] hover:bg-fuchsia-300 shadow-[0_0_12px_rgba(232,121,249,0.3)]'
                    )}
                >
                    {d.running
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Removing BG...</>
                        : <><Scissors className="h-3.5 w-3.5" />Remove Background</>
                    }
                </button>
            </div>

            <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-pink-400 !border-2 !border-[#140a14]" />
            <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-fuchsia-400 !border-2 !border-[#140a14]" />
        </div>
    )
})

BgRemoveNode.displayName = 'BgRemoveNode'
