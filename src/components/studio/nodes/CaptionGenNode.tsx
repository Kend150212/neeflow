'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageSquareText, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface CaptionGenData {
    inputImage?: string
    caption?: string
    platform?: string
    tone?: string
    loading?: boolean
    channelId?: string
    onChange?: (key: string, val: unknown) => void
}

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'Twitter']
const TONES = ['Fun', 'Professional', 'Emotional', 'Salesy']

export function CaptionGenNode({ data }: NodeProps) {
    const d = data as CaptionGenData
    const [loading, setLoading] = useState(false)
    const platform = d.platform || 'Instagram'
    const tone = d.tone || 'Fun'

    async function generateCaption() {
        if (!d.inputImage && !d.caption) return
        setLoading(true)
        try {
            const res = await fetch(`/api/studio/channels/${d.channelId}/caption-gen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: d.inputImage, platform, tone }),
            })
            if (res.ok) {
                const result = await res.json()
                d.onChange?.('caption', result.caption)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-56 rounded-2xl overflow-hidden border border-indigo-400/40 bg-[#05001a] shadow-[0_0_20px_rgba(129,140,248,0.08)]">
            <Handle type="target" position={Position.Left} id="image"
                style={{ top: '50%', background: '#818cf8', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-indigo-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-400/15 flex items-center justify-center">
                    <MessageSquareText className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Caption AI</span>
            </div>

            <div className="p-3 space-y-2.5">
                {/* Platform */}
                <div className="grid grid-cols-2 gap-1">
                    {PLATFORMS.map(p => (
                        <button key={p} onClick={() => d.onChange?.('platform', p)}
                            className={`py-1 rounded-lg text-[9px] font-bold transition-colors ${platform === p ? 'bg-indigo-400/20 text-indigo-400' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>
                            {p}
                        </button>
                    ))}
                </div>

                {/* Tone */}
                <div className="grid grid-cols-2 gap-1">
                    {TONES.map(t => (
                        <button key={t} onClick={() => d.onChange?.('tone', t)}
                            className={`py-1 rounded-lg text-[9px] font-bold transition-colors ${tone === t ? 'bg-indigo-400/20 text-indigo-400' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>
                            {t}
                        </button>
                    ))}
                </div>

                {/* Generate button */}
                <button
                    onClick={generateCaption}
                    disabled={loading}
                    className="w-full py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate Caption
                </button>

                {/* Caption output */}
                {d.caption && (
                    <textarea
                        value={d.caption}
                        onChange={e => d.onChange?.('caption', e.target.value)}
                        rows={3}
                        className="w-full bg-white/5 border border-indigo-400/20 rounded-lg px-2.5 py-1.5 text-[10px] text-white resize-none focus:outline-none focus:border-indigo-400/50"
                    />
                )}
            </div>

            <Handle type="source" position={Position.Right} id="caption"
                style={{ top: '50%', background: '#818cf8', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
