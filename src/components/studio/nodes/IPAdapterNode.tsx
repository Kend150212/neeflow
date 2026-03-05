'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Layers, Upload, Loader2 } from 'lucide-react'
import { useRef } from 'react'

interface IPAdapterData {
    styleImage?: string     // reference image for style/character
    inputImage?: string     // image to apply the style to (or from connection)
    resultImage?: string
    strength?: number       // 0.1–1.0
    status?: string
    onChange?: (key: string, val: unknown) => void
}

export function IPAdapterNode({ data }: NodeProps) {
    const d = data as IPAdapterData
    const strength = d.strength ?? 0.7
    const styleRef = useRef<HTMLInputElement>(null)

    function pickStyle(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => d.onChange?.('styleImage', reader.result as string)
        reader.readAsDataURL(file)
    }

    return (
        <div className="w-56 rounded-2xl overflow-hidden border border-violet-400/40 bg-[#0e0020] shadow-[0_0_20px_rgba(167,139,250,0.08)]">
            <Handle type="target" position={Position.Left} id="prompt"
                style={{ top: 40, background: '#a78bfa', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-violet-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-400/15 flex items-center justify-center">
                    <Layers className="h-3.5 w-3.5 text-violet-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-violet-400">IP-Adapter</span>
            </div>

            <div className="p-3 space-y-2.5">
                <p className="text-[9px] text-violet-400/50">Copy style / character from reference image</p>

                {/* Style image upload */}
                <button
                    onClick={() => styleRef.current?.click()}
                    className="w-full h-20 rounded-lg border border-dashed border-violet-400/30 flex flex-col items-center justify-center gap-1 hover:border-violet-400/60 hover:bg-violet-400/5 transition-colors overflow-hidden"
                >
                    {d.styleImage ? (
                        <img src={d.styleImage} className="w-full h-full object-cover" alt="style ref" />
                    ) : (
                        <>
                            <Upload className="h-4 w-4 text-violet-400/60" />
                            <span className="text-[10px] text-violet-400/60">Upload style reference</span>
                        </>
                    )}
                </button>
                <input ref={styleRef} type="file" accept="image/*" className="hidden" onChange={pickStyle} />

                {/* Strength */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-violet-400/60 w-14">Influence</span>
                    <input type="range" min={0.1} max={1.0} step={0.05} value={strength}
                        onChange={e => d.onChange?.('strength', parseFloat(e.target.value))}
                        className="flex-1 accent-violet-400 h-1" />
                    <span className="text-[10px] text-violet-300 font-bold w-8 text-right">{Math.round(strength * 100)}%</span>
                </div>

                {/* Result */}
                {d.status === 'processing' ? (
                    <div className="w-full h-20 rounded-lg bg-white/5 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
                    </div>
                ) : d.resultImage ? (
                    <img src={d.resultImage} alt="result" className="w-full rounded-lg" />
                ) : null}
            </div>

            <Handle type="source" position={Position.Right} id="result"
                style={{ top: '50%', background: '#a78bfa', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
