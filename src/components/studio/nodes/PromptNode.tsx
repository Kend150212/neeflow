'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Type, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptNodeData {
    prompt?: string
    onChange?: (val: string) => void
    onEnhance?: () => void
    enhancing?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PromptNode = memo(({ data, selected }: NodeProps<any>) => {
    const d = data as PromptNodeData
    return (
        <div className={cn(
            'w-64 rounded-xl border bg-[#0d0d1a] transition-all',
            selected ? 'border-violet-400 shadow-[0_0_16px_rgba(139,92,246,0.25)]' : 'border-violet-400/30'
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-violet-400/10 rounded-t-xl">
                <div className="w-5 h-5 rounded bg-violet-400/20 flex items-center justify-center">
                    <Type className="h-3 w-3 text-violet-400" />
                </div>
                <span className="text-[11px] font-bold text-violet-400 uppercase tracking-wide">Prompt</span>
                <button
                    onClick={d.onEnhance}
                    disabled={d.enhancing}
                    className="ml-auto flex items-center gap-1 text-[10px] text-violet-400 hover:text-white transition-colors disabled:opacity-50"
                    title="AI Enhance"
                >
                    <Sparkles className={cn('h-3 w-3', d.enhancing && 'animate-pulse')} />
                    {d.enhancing ? 'Enhancing...' : 'AI Enhance'}
                </button>
            </div>
            {/* Text area */}
            <div className="p-3">
                <textarea
                    value={d.prompt || ''}
                    onChange={e => d.onChange?.(e.target.value)}
                    placeholder="Describe your image..."
                    rows={4}
                    className="w-full bg-transparent text-xs text-slate-300 placeholder:text-slate-600 resize-none outline-none leading-relaxed"
                />
            </div>
            {/* Source handle */}
            <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-[#0d0d1a]" />
        </div>
    )
})

PromptNode.displayName = 'PromptNode'
