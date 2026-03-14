'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { User, ChevronDown, RefreshCw, Shirt, Gem } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvatarNodeData extends Record<string, unknown> {
    avatarId?: string
    avatarName?: string
    avatarCover?: string
    avatarPrompt?: string
    // Outfit
    outfitId?: string
    outfitName?: string
    outfitImage?: string
    // Accessory
    accessoryId?: string
    accessoryName?: string
    accessoryImage?: string
    // Callbacks
    onSelect?: () => void
    onSelectOutfit?: () => void
    onSelectAccessory?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AvatarNode = memo(({ data, selected }: NodeProps<any>) => {
    const d = data as AvatarNodeData

    return (
        <div className={cn(
            'w-56 rounded-xl border bg-[#0a140f] transition-all',
            selected ? 'border-emerald-400 shadow-[0_0_16px_rgba(0,255,149,0.25)]' : 'border-emerald-400/30'
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-emerald-400/10 rounded-t-xl">
                <div className="w-5 h-5 rounded bg-emerald-400/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-emerald-400" />
                </div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">Avatar</span>
            </div>

            {/* Avatar section */}
            <div className="p-3 border-b border-white/5">
                {d.avatarId ? (
                    <div
                        className="flex items-center gap-2 group/avatar cursor-pointer hover:bg-white/5 rounded-lg p-1 -mx-1 transition-colors"
                        onClick={d.onSelect}
                        title="Click to change avatar"
                    >
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
                            {d.avatarCover
                                ? <img src={d.avatarCover} alt={d.avatarName} className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-white/5 flex items-center justify-center"><User className="h-4 w-4 text-slate-600" /></div>
                            }
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{d.avatarName}</p>
                            <p className="text-[10px] text-slate-500 truncate">{d.avatarPrompt?.slice(0, 36)}...</p>
                        </div>
                        <RefreshCw className="h-3 w-3 text-emerald-400/50 group-hover/avatar:text-emerald-400 transition-colors shrink-0" />
                    </div>
                ) : (
                    <button
                        onClick={d.onSelect}
                        className="nodrag w-full flex items-center justify-between text-slate-400 hover:text-white text-xs py-1 transition-colors"
                    >
                        <span>Select avatar...</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    </button>
                )}
            </div>

            {/* Outfit section — only visible after avatar is selected */}
            {d.avatarId && (
                <div className="px-3 py-2 border-b border-white/5">
                    <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Outfit</p>
                    {d.outfitId ? (
                        <div
                            className="flex items-center gap-2 group/outfit cursor-pointer hover:bg-white/5 rounded-lg p-1 -mx-1 transition-colors"
                            onClick={d.onSelectOutfit}
                            title="Click to change outfit"
                        >
                            <div className="w-7 h-7 rounded overflow-hidden border border-white/10 shrink-0">
                                {d.outfitImage
                                    ? <img src={d.outfitImage} alt={d.outfitName} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Shirt className="h-3 w-3 text-slate-600" /></div>
                                }
                            </div>
                            <p className="text-[11px] text-white truncate flex-1">{d.outfitName}</p>
                            <RefreshCw className="h-2.5 w-2.5 text-slate-600 group-hover/outfit:text-emerald-400 transition-colors shrink-0" />
                        </div>
                    ) : (
                        <button
                            onClick={d.onSelectOutfit}
                            className="nodrag w-full flex items-center justify-between text-slate-500 hover:text-slate-300 text-[11px] py-0.5 transition-colors"
                        >
                            <span className="flex items-center gap-1.5">
                                <Shirt className="h-3 w-3" /> Choose outfit...
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0" />
                        </button>
                    )}
                </div>
            )}

            {/* Accessory section — only visible after avatar is selected */}
            {d.avatarId && (
                <div className="px-3 py-2">
                    <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Phụ kiện</p>
                    {d.accessoryId ? (
                        <div
                            className="flex items-center gap-2 group/acc cursor-pointer hover:bg-white/5 rounded-lg p-1 -mx-1 transition-colors"
                            onClick={d.onSelectAccessory}
                            title="Click to change accessory"
                        >
                            <div className="w-7 h-7 rounded overflow-hidden border border-white/10 shrink-0">
                                {d.accessoryImage
                                    ? <img src={d.accessoryImage} alt={d.accessoryName} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Gem className="h-3 w-3 text-slate-600" /></div>
                                }
                            </div>
                            <p className="text-[11px] text-white truncate flex-1">{d.accessoryName}</p>
                            <RefreshCw className="h-2.5 w-2.5 text-slate-600 group-hover/acc:text-emerald-400 transition-colors shrink-0" />
                        </div>
                    ) : (
                        <button
                            onClick={d.onSelectAccessory}
                            className="nodrag w-full flex items-center justify-between text-slate-500 hover:text-slate-300 text-[11px] py-0.5 transition-colors"
                        >
                            <span className="flex items-center gap-1.5">
                                <Gem className="h-3 w-3" /> Choose accessory...
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0" />
                        </button>
                    )}
                </div>
            )}

            {/* Output handle */}
            <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-[#0a140f]" />
        </div>
    )
})

AvatarNode.displayName = 'AvatarNode'
