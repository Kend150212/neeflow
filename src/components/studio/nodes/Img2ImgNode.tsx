'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Paintbrush2, Upload, Loader2 } from 'lucide-react'
import { useRef } from 'react'

interface Img2ImgData {
    inputImage?: string
    resultImage?: string
    prompt?: string
    strength?: number   // 0.1–1.0
    status?: string
    onChange?: (key: string, val: unknown) => void
}

export function Img2ImgNode({ data }: NodeProps) {
    const d = data as Img2ImgData
    const strength = d.strength ?? 0.7
    const fileRef = useRef<HTMLInputElement>(null)

    function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => d.onChange?.('inputImage', reader.result as string)
        reader.readAsDataURL(file)
    }

    return (
        <div className="w-56 rounded-2xl overflow-hidden border border-sky-400/40 bg-[#001520] shadow-[0_0_20px_rgba(56,189,248,0.08)]">
            <Handle type="target" position={Position.Left} id="prompt"
                style={{ top: 40, background: '#38bdf8', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-sky-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-400/15 flex items-center justify-center">
                    <Paintbrush2 className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-sky-400">Img2Img</span>
            </div>

            <div className="p-3 space-y-2.5">
                {/* Image upload */}
                <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-24 rounded-lg border border-dashed border-sky-400/30 flex flex-col items-center justify-center gap-1 hover:border-sky-400/60 hover:bg-sky-400/5 transition-colors overflow-hidden"
                >
                    {d.inputImage ? (
                        <img src={d.inputImage} className="w-full h-full object-cover" alt="input" />
                    ) : (
                        <>
                            <Upload className="h-4 w-4 text-sky-400/60" />
                            <span className="text-[10px] text-sky-400/60">Upload base image</span>
                        </>
                    )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />

                {/* Strength slider */}
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-sky-400/60">Transform strength</span>
                        <span className="text-[10px] text-sky-300 font-bold">{Math.round(strength * 100)}%</span>
                    </div>
                    <input
                        type="range" min={0.1} max={1.0} step={0.05} value={strength}
                        onChange={e => d.onChange?.('strength', parseFloat(e.target.value))}
                        className="w-full accent-sky-400 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-sky-400/30 mt-0.5">
                        <span>Subtle</span><span>Full restyle</span>
                    </div>
                </div>

                {/* Result */}
                {d.status === 'processing' ? (
                    <div className="w-full h-20 rounded-lg bg-white/5 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-sky-400 animate-spin" />
                    </div>
                ) : d.resultImage ? (
                    <img src={d.resultImage} alt="result" className="w-full rounded-lg" />
                ) : null}
            </div>

            <Handle type="source" position={Position.Right} id="result"
                style={{ top: '50%', background: '#38bdf8', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
