'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { UserRound, Loader2, Upload } from 'lucide-react'
import { useRef } from 'react'

interface FaceSwapData {
    faceImage?: string       // source face
    targetImage?: string     // target background image from connection
    resultImage?: string
    status?: string
    onChange?: (key: string, val: unknown) => void
}

export function FaceSwapNode({ data }: NodeProps) {
    const d = data as FaceSwapData
    const fileRef = useRef<HTMLInputElement>(null)

    function pickFace(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => d.onChange?.('faceImage', reader.result as string)
        reader.readAsDataURL(file)
    }

    return (
        <div className="w-52 rounded-2xl overflow-hidden border border-yellow-400/40 bg-[#1a1500] shadow-[0_0_20px_rgba(234,179,8,0.08)]">
            {/* Target input */}
            <Handle type="target" position={Position.Left} id="target"
                style={{ top: '50%', background: '#facc15', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-yellow-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-yellow-400/15 flex items-center justify-center">
                    <UserRound className="h-3.5 w-3.5 text-yellow-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-yellow-400">Face Swap</span>
            </div>

            <div className="p-3 space-y-2">
                {/* Face upload */}
                <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-20 rounded-lg border border-dashed border-yellow-400/30 flex flex-col items-center justify-center gap-1 hover:border-yellow-400/60 hover:bg-yellow-400/5 transition-colors"
                >
                    {d.faceImage ? (
                        <img src={d.faceImage} className="w-full h-full object-cover rounded-lg" alt="face" />
                    ) : (
                        <>
                            <Upload className="h-4 w-4 text-yellow-400/60" />
                            <span className="text-[10px] text-yellow-400/60">Upload face photo</span>
                        </>
                    )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFace} />

                {/* Result */}
                {d.status === 'processing' ? (
                    <div className="w-full h-24 rounded-lg bg-white/5 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
                    </div>
                ) : d.resultImage ? (
                    <img src={d.resultImage} alt="result" className="w-full rounded-lg" />
                ) : null}

                <p className="text-[9px] text-yellow-400/40 text-center">Connect image → left handle</p>
            </div>

            <Handle type="source" position={Position.Right} id="result"
                style={{ top: '50%', background: '#facc15', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
