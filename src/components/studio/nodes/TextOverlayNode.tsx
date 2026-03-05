'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'

type Align = 'left' | 'center' | 'right'

interface TextOverlayData {
    inputImage?: string
    resultImage?: string
    text?: string
    fontSize?: number
    color?: string
    bgColor?: string        // background pill color (empty = transparent)
    positionY?: number      // 0-100 vertical position
    align?: Align
    onChange?: (key: string, val: unknown) => void
}

const PRESETS = [
    { label: 'White', color: '#ffffff', bg: 'transparent' },
    { label: 'Black', color: '#000000', bg: 'transparent' },
    { label: 'Green', color: '#00ff95', bg: 'transparent' },
    { label: 'Pill', color: '#ffffff', bg: '#00000088' },
]

export function TextOverlayNode({ data }: NodeProps) {
    const d = data as TextOverlayData
    const align: Align = (d.align as Align) || 'center'
    const fontSize = d.fontSize ?? 32
    const posY = d.positionY ?? 80

    return (
        <div className="w-56 rounded-2xl overflow-hidden border border-lime-400/40 bg-[#0f1a00] shadow-[0_0_20px_rgba(163,230,53,0.08)]">
            <Handle type="target" position={Position.Left} id="image"
                style={{ top: '50%', background: '#a3e635', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-lime-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-lime-400/15 flex items-center justify-center">
                    <Type className="h-3.5 w-3.5 text-lime-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-lime-400">Text Overlay</span>
            </div>

            <div className="p-3 space-y-2.5">
                {/* Text input */}
                <textarea
                    value={d.text || ''}
                    onChange={e => d.onChange?.('text', e.target.value)}
                    placeholder="Your headline here..."
                    rows={2}
                    className="w-full bg-white/5 border border-lime-400/20 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-lime-400/30 resize-none focus:outline-none focus:border-lime-400/50"
                />

                {/* Alignment */}
                <div className="flex gap-1">
                    {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as [Align, typeof AlignLeft][]).map(([a, Icon]) => (
                        <button key={a} onClick={() => d.onChange?.('align', a)}
                            className={`flex-1 py-1 rounded-md flex items-center justify-center transition-colors ${align === a ? 'bg-lime-400/20 text-lime-400' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>
                            <Icon className="h-3 w-3" />
                        </button>
                    ))}
                </div>

                {/* Font size */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-lime-400/60 w-12">Size</span>
                    <input type="range" min={12} max={96} value={fontSize}
                        onChange={e => d.onChange?.('fontSize', parseInt(e.target.value))}
                        className="flex-1 accent-lime-400 h-1" />
                    <span className="text-[10px] text-lime-300 font-bold w-6 text-right">{fontSize}</span>
                </div>

                {/* Vertical position */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-lime-400/60 w-12">Y pos</span>
                    <input type="range" min={0} max={100} value={posY}
                        onChange={e => d.onChange?.('positionY', parseInt(e.target.value))}
                        className="flex-1 accent-lime-400 h-1" />
                    <span className="text-[10px] text-lime-300 font-bold w-6 text-right">{posY}%</span>
                </div>

                {/* Color presets */}
                <div className="flex gap-1.5">
                    {PRESETS.map(p => (
                        <button key={p.label} onClick={() => { d.onChange?.('color', p.color); d.onChange?.('bgColor', p.bg) }}
                            title={p.label}
                            className="w-6 h-6 rounded-md border border-white/20 flex items-center justify-center text-[8px] font-bold"
                            style={{ background: p.bg !== 'transparent' ? p.bg : '#333', color: p.color }}>
                            {p.label[0]}
                        </button>
                    ))}
                </div>

                {/* Preview */}
                {d.inputImage && (
                    <div className="relative w-full rounded-lg overflow-hidden border border-lime-400/20 aspect-video">
                        <img src={d.inputImage} alt="preview" className="w-full h-full object-cover" />
                        {d.text && (
                            <div
                                className="absolute left-0 right-0 px-2 flex"
                                style={{
                                    bottom: `${100 - posY}%`,
                                    justifyContent: align,
                                }}
                            >
                                <span
                                    className="font-black leading-tight"
                                    style={{
                                        fontSize: `${Math.max(8, Math.round(fontSize * 0.2))}px`,
                                        color: d.color || '#ffffff',
                                        background: d.bgColor && d.bgColor !== 'transparent' ? d.bgColor : 'transparent',
                                        padding: '1px 3px',
                                        borderRadius: 3,
                                    }}
                                >{d.text}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} id="result"
                style={{ top: '50%', background: '#a3e635', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
