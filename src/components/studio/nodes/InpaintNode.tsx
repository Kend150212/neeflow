'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Eraser, Loader2 } from 'lucide-react'

interface InpaintData {
    inputImage?: string
    maskDataUrl?: string    // drawn mask as data URL
    resultImage?: string
    prompt?: string
    status?: string
    onChange?: (key: string, val: unknown) => void
}

export function InpaintNode({ data }: NodeProps) {
    const d = data as InpaintData

    return (
        <div className="w-56 rounded-2xl overflow-hidden border border-rose-400/40 bg-[#1a0509] shadow-[0_0_20px_rgba(251,113,133,0.08)]">
            <Handle type="target" position={Position.Left} id="image"
                style={{ top: 40, background: '#fb7185', border: '2px solid #080d0b', width: 10, height: 10 }} />
            <Handle type="target" position={Position.Left} id="prompt"
                style={{ top: 70, background: '#a78bfa', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-rose-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-400/15 flex items-center justify-center">
                    <Eraser className="h-3.5 w-3.5 text-rose-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-rose-400">Inpaint</span>
            </div>

            <div className="p-3 space-y-2">
                {/* Visual state */}
                {d.inputImage ? (
                    <div className="relative w-full rounded-lg overflow-hidden border border-rose-400/20">
                        <img src={d.inputImage} alt="base" className="w-full" />
                        {d.maskDataUrl && (
                            <img src={d.maskDataUrl} alt="mask" className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen" />
                        )}
                    </div>
                ) : (
                    <div className="w-full h-24 rounded-lg border border-dashed border-rose-400/30 flex items-center justify-center">
                        <span className="text-[10px] text-rose-400/50">Connect image → left handle</span>
                    </div>
                )}

                {/* Prompt input */}
                <textarea
                    value={d.prompt || ''}
                    onChange={e => d.onChange?.('prompt', e.target.value)}
                    placeholder="Describe what to paint in the masked area..."
                    rows={2}
                    className="w-full bg-white/5 border border-rose-400/20 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-rose-400/30 resize-none focus:outline-none focus:border-rose-400/50"
                />

                {/* Result */}
                {d.status === 'processing' ? (
                    <div className="w-full h-16 rounded-lg bg-white/5 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 text-rose-400 animate-spin" />
                    </div>
                ) : d.resultImage ? (
                    <img src={d.resultImage} alt="result" className="w-full rounded-lg border border-rose-400/20" />
                ) : null}

                <p className="text-[9px] text-rose-400/30">Connect image + describe area to change</p>
            </div>

            <Handle type="source" position={Position.Right} id="result"
                style={{ top: '50%', background: '#fb7185', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
