'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { User, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvatarNodeData extends Record<string, unknown> {
    avatarId?: string
    avatarName?: string
    avatarCover?: string
    avatarPrompt?: string
    onSelect?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AvatarNode = memo(({ data, selected }: NodeProps<any>) => {
    const d = data as AvatarNodeData
    return (
        <div className={cn(
            'w-52 rounded-xl border bg-[#0a140f] transition-all',
            selected ? 'border-emerald-400 shadow-[0_0_16px_rgba(0,255,149,0.25)]' : 'border-emerald-400/30'
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-emerald-400/10 rounded-t-xl">
                <div className="w-5 h-5 rounded bg-emerald-400/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-emerald-400" />
                </div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">Avatar</span>
            </div>
            {/* Content */}
            <div className="p-3">
                {d.avatarId ? (
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
                            {d.avatarCover
                                ? <img src={d.avatarCover} alt={d.avatarName} className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-white/5 flex items-center justify-center"><User className="h-4 w-4 text-slate-600" /></div>
                            }
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{d.avatarName}</p>
                            <p className="text-[10px] text-slate-500 truncate">{d.avatarPrompt?.slice(0, 40)}...</p>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={d.onSelect}
                        className="w-full flex items-center justify-between text-slate-400 hover:text-white text-xs py-1 transition-colors"
                    >
                        <span>Select avatar...</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    </button>
                )}
            </div>
            {/* Output handle */}
            <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-[#0a140f]" />
        </div>
    )
})

AvatarNode.displayName = 'AvatarNode'
