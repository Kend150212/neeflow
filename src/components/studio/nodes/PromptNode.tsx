'use client'

import { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Type, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptNodeData {
    prompt?: string
    onChange?: (val: string) => void
    onEnhance?: () => void
    enhancing?: boolean
}

// ─── PromptNode ───────────────────────────────────────────────
// Uses LOCAL state for the textarea so that nodeTypes recreation
// (which would unmount/remount the component) doesn't cause focus loss.
// The parent's `data.prompt` is the source of truth only on first mount.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PromptNode = memo(({ data, selected }: NodeProps<any>) => {
    const d = data as PromptNodeData

    // Local state — prevents focus loss when parent re-renders
    const [value, setValue] = useState(d.prompt || '')

    // Stable ref for the onChange callback so we don't re-subscribe on every render
    const onChangeRef = useRef(d.onChange)
    useEffect(() => { onChangeRef.current = d.onChange }, [d.onChange])

    const onEnhanceRef = useRef(d.onEnhance)
    useEffect(() => { onEnhanceRef.current = d.onEnhance }, [d.onEnhance])

    // Only sync from parent when the node is first mounted or when an
    // AI-enhance result comes in (value changed externally to what we have)
    const lastExternalRef = useRef(d.prompt || '')
    useEffect(() => {
        if (d.prompt !== lastExternalRef.current && d.prompt !== value) {
            setValue(d.prompt || '')
        }
        lastExternalRef.current = d.prompt || ''
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [d.prompt])

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setValue(e.target.value)
        onChangeRef.current?.(e.target.value)
    }

    const enhancing = d.enhancing ?? false

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
                    className="nodrag ml-auto flex items-center gap-1 text-[10px] text-violet-400 hover:text-white transition-colors disabled:opacity-50"
                    disabled={enhancing}
                    title="AI Enhance"
                    onClick={() => onEnhanceRef.current?.()}
                >
                    {enhancing
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Sparkles className="h-3 w-3" />}
                    {enhancing ? 'Enhancing...' : 'AI Enhance'}
                </button>
            </div>

            {/* Text area */}
            <div className="p-3">
                <textarea
                    className="nodrag w-full bg-transparent text-xs text-slate-300 placeholder:text-slate-600 resize-none outline-none leading-relaxed"
                    value={value}
                    onChange={handleChange}
                    placeholder="Describe your image..."
                    rows={4}
                />
            </div>

            {/* Source handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-[#0d0d1a]"
            />
        </div>
    )
})

PromptNode.displayName = 'PromptNode'
