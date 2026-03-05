'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AudioLines, Loader2, Upload } from 'lucide-react'
import { useRef } from 'react'

interface LipSyncData {
    videoOrImage?: string   // avatar image or video clip
    audioFile?: string      // voice/audio data URL
    resultVideo?: string
    status?: string
    onChange?: (key: string, val: unknown) => void
}

export function LipSyncNode({ data }: NodeProps) {
    const d = data as LipSyncData
    const mediaRef = useRef<HTMLInputElement>(null)
    const audioRef = useRef<HTMLInputElement>(null)

    function pickMedia(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => d.onChange?.('videoOrImage', reader.result as string)
        reader.readAsDataURL(file)
    }

    function pickAudio(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => d.onChange?.('audioFile', reader.result as string)
        reader.readAsDataURL(file)
    }

    return (
        <div className="w-56 rounded-2xl overflow-hidden border border-orange-400/40 bg-[#1a0800] shadow-[0_0_20px_rgba(251,146,60,0.08)]">
            <Handle type="target" position={Position.Left} id="video"
                style={{ top: 40, background: '#fb923c', border: '2px solid #080d0b', width: 10, height: 10 }} />
            <Handle type="target" position={Position.Left} id="audio"
                style={{ top: 70, background: '#fbbf24', border: '2px solid #080d0b', width: 10, height: 10 }} />

            <div className="px-4 pt-3 pb-2 border-b border-orange-400/20 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-400/15 flex items-center justify-center">
                    <AudioLines className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-orange-400">Lip Sync</span>
            </div>

            <div className="p-3 space-y-2">
                {/* Avatar / video upload */}
                <button
                    onClick={() => mediaRef.current?.click()}
                    className="w-full h-20 rounded-lg border border-dashed border-orange-400/30 flex flex-col items-center justify-center gap-1 hover:border-orange-400/60 hover:bg-orange-400/5 transition-colors overflow-hidden"
                >
                    {d.videoOrImage ? (
                        d.videoOrImage.startsWith('data:video') ? (
                            <video src={d.videoOrImage} className="w-full h-full object-cover" />
                        ) : (
                            <img src={d.videoOrImage} className="w-full h-full object-cover" alt="avatar" />
                        )
                    ) : (
                        <>
                            <Upload className="h-4 w-4 text-orange-400/60" />
                            <span className="text-[10px] text-orange-400/60">Avatar image / video</span>
                        </>
                    )}
                </button>
                <input ref={mediaRef} type="file" accept="image/*,video/*" className="hidden" onChange={pickMedia} />

                {/* Audio upload */}
                <button
                    onClick={() => audioRef.current?.click()}
                    className={`w-full py-2.5 rounded-lg border border-dashed flex items-center justify-center gap-1.5 transition-colors ${d.audioFile ? 'border-orange-400/60 bg-orange-400/10 text-orange-300' : 'border-orange-400/20 text-orange-400/50 hover:border-orange-400/40'
                        }`}
                >
                    <AudioLines className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold">{d.audioFile ? '✓ Audio loaded' : 'Upload voice / audio'}</span>
                </button>
                <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={pickAudio} />

                {/* Status */}
                {d.status === 'processing' && (
                    <div className="w-full h-16 rounded-lg bg-white/5 flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 text-orange-400 animate-spin" />
                        <span className="text-[10px] text-orange-400/70">Syncing lips...</span>
                    </div>
                )}
                {d.resultVideo && (
                    <video src={d.resultVideo} controls className="w-full rounded-lg border border-orange-400/20" />
                )}

                <p className="text-[9px] text-orange-400/30 text-center">Avatar image + voice → talking video</p>
            </div>

            <Handle type="source" position={Position.Right} id="result"
                style={{ top: '50%', background: '#fb923c', border: '2px solid #080d0b', width: 10, height: 10 }} />
        </div>
    )
}
