'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Crop } from 'lucide-react'

const FORMATS = [
    { label: '1:1', ratio: '1:1', hint: 'Feed' },
    { label: '4:5', ratio: '4:5', hint: 'Portrait' },
    { label: '9:16', ratio: '9:16', hint: 'Reels' },
    { label: '16:9', ratio: '16:9', hint: 'YouTube' },
    { label: '4:3', ratio: '4:3', hint: 'Landscape' },
] as const

type Format = typeof FORMATS[number]['ratio']

interface CropResizeData {
    inputImage?: string
    format?: Format
    quality?: number
    onChange?: (key: string, val: unknown) => void
}

export function CropResizeNode({ data }: NodeProps) {
    const d = data as CropResizeData
    const format: Format = (d.format as Format) || '1:1'
    const quality = d.quality ?? 90

    function getAspectStyle(ratio: string) {
        const [w, h] = ratio.split(':').map(Number)
        return { aspectRatio: `${w}/${h}` }
    }

    return (
        <div className="w-52 rounded-2xl overflow-hidden border border-amber-400/40 bg-[#1a1000] shadow-[0_0_20px_rgba(251,191,36,0.08)]">
            <Handle type="target" position={Position.Left} id="image"
                style={{ top: '50%', background: '#fbbf24', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-amber-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-400/15 flex items-center justify-center">
                    <Crop className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Crop / Resize</span>
            </div>

            <div className="p-3 space-y-2.5">
                {/* Format grid */}
                <div className="grid grid-cols-5 gap-1">
                    {FORMATS.map(f => (
                        <button key={f.ratio} onClick={() => d.onChange?.('format', f.ratio)}
                            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[8px] font-bold transition-colors ${format === f.ratio ? 'bg-amber-400/20 text-amber-400' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>
                            <div className="border-2 border-current" style={{ ...getAspectStyle(f.ratio), width: 14 }} />
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Preview */}
                {d.inputImage && (
                    <div className="w-full flex items-center justify-center bg-[#0a0a0a] rounded-lg overflow-hidden" style={{ minHeight: 60 }}>
                        <div className="overflow-hidden border border-amber-400/20" style={{ ...getAspectStyle(format), maxHeight: 80, maxWidth: '100%' }}>
                            <img src={d.inputImage} alt="preview"
                                className="w-full h-full"
                                style={{ objectFit: 'cover' }}
                            />
                        </div>
                    </div>
                )}

                {/* Quality */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-400/60 w-12">Quality</span>
                    <input type="range" min={60} max={100} value={quality}
                        onChange={e => d.onChange?.('quality', parseInt(e.target.value))}
                        className="flex-1 accent-amber-400 h-1" />
                    <span className="text-[10px] text-amber-300 font-bold w-8 text-right">{quality}%</span>
                </div>

                <p className="text-[9px] text-amber-400/40 text-center">
                    {FORMATS.find(f => f.ratio === format)?.hint}
                </p>
            </div>

            <Handle type="source" position={Position.Right} id="result"
                style={{ top: '50%', background: '#fbbf24', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
