'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ShoppingBag, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductNodeData {
    productId?: string
    productName?: string
    productImage?: string
    price?: number
    onSelect?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ProductNode = memo(({ data, selected }: NodeProps<any>) => {
    const d = data as ProductNodeData
    return (
        <div className={cn(
            'w-52 rounded-xl border bg-[#0d100a] transition-all',
            selected ? 'border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.25)]' : 'border-amber-400/30'
        )}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-amber-400/10 rounded-t-xl">
                <div className="w-5 h-5 rounded bg-amber-400/20 flex items-center justify-center">
                    <ShoppingBag className="h-3 w-3 text-amber-400" />
                </div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">Product</span>
            </div>
            {/* Content */}
            <div className="p-3">
                {d.productId ? (
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-white/5">
                            {d.productImage
                                ? <img src={d.productImage} alt={d.productName} className="w-full h-full object-cover" />
                                : <ShoppingBag className="h-4 w-4 m-3 text-slate-600" />
                            }
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{d.productName}</p>
                            {d.price && <p className="text-[10px] text-amber-400">{d.price.toLocaleString()}đ</p>}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={d.onSelect}
                        className="w-full flex items-center justify-between text-slate-400 hover:text-white text-xs py-1 transition-colors"
                    >
                        <span>Select product...</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    </button>
                )}
            </div>
            {/* Output handle */}
            <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-amber-400 !border-2 !border-[#0d100a]" />
        </div>
    )
})

ProductNode.displayName = 'ProductNode'
