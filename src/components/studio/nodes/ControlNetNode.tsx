'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ScanLine, Upload, Loader2 } from 'lucide-react'
import { useRef } from 'react'

const MODES = ['pose', 'depth', 'canny', 'softedge'] as const
type PoseMode = typeof MODES[number]

interface ControlNetData {
    poseImage?: string
    resultImage?: string
    mode?: PoseMode
    strength?: number
    status?: string
    onChange?: (key: string, val: unknown) => void
}

export function ControlNetNode({ data }: NodeProps) {
    const d = data as ControlNetData
    const mode: PoseMode = (d.mode as PoseMode) || 'pose'
    const strength = d.strength ?? 0.8
    const fileRef = useRef<HTMLInputElement>(null)

    function pickPose(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => d.onChange?.('poseImage', reader.result as string)
        reader.readAsDataURL(file)
    }

    return (
        <div className="w-56 rounded-2xl overflow-hidden border border-teal-400/40 bg-[#001a18] shadow-[0_0_20px_rgba(45,212,191,0.08)]">
            <Handle type="target" position={Position.Left} id="prompt"
                style={{ top: 40, background: '#2dd4bf', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-teal-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-400/15 flex items-center justify-center">
                    <ScanLine className="h-3.5 w-3.5 text-teal-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-teal-400">ControlNet</span>
            </div>

            <div className="p-3 space-y-2.5">
                {/* Mode tabs */}
                <div className="grid grid-cols-4 gap-0.5 bg-white/5 rounded-lg p-0.5">
                    {MODES.map(m => (
                        <button key={m} onClick={() => d.onChange?.('mode', m)}
                            className={`py-1 rounded-md text-[9px] font-bold uppercase transition-colors ${mode === m ? 'bg-teal-400/20 text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}>
                            {m}
                        </button>
                    ))}
                </div>

                {/* Pose image upload */}
                <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-20 rounded-lg border border-dashed border-teal-400/30 flex flex-col items-center justify-center gap-1 hover:border-teal-400/60 hover:bg-teal-400/5 transition-colors overflow-hidden"
                >
                    {d.poseImage ? (
                        <img src={d.poseImage} className="w-full h-full object-cover" alt="pose" />
                    ) : (
                        <>
                            <Upload className="h-4 w-4 text-teal-400/60" />
                            <span className="text-[10px] text-teal-400/60">Upload {mode} reference</span>
                        </>
                    )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPose} />

                {/* Strength */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-teal-400/60 w-14">Strength</span>
                    <input type="range" min={0.1} max={1.0} step={0.05} value={strength}
                        onChange={e => d.onChange?.('strength', parseFloat(e.target.value))}
                        className="flex-1 accent-teal-400 h-1" />
                    <span className="text-[10px] text-teal-300 font-bold w-8 text-right">{Math.round(strength * 100)}%</span>
                </div>

                {d.status === 'processing' && (
                    <div className="w-full h-16 rounded-lg bg-white/5 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 text-teal-400 animate-spin" />
                    </div>
                )}
                {d.resultImage && <img src={d.resultImage} alt="result" className="w-full rounded-lg" />}
            </div>

            <Handle type="source" position={Position.Right} id="result"
                style={{ top: '50%', background: '#2dd4bf', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
