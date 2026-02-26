'use client'

import { useEffect, useState, useCallback } from 'react'
// import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import {
    Zap,
    Clock,
    Shield,
    Plus,
    Trash2,
    Copy,
    CheckCircle2,
    Loader2,
    ImagePlus,
    BarChart3,
    AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface PipelineConfig {
    pipelineEnabled: boolean
    pipelineFrequency: string
    pipelineApprovalMode: string
    pipelinePostingTimes: string[]
}

interface PipelineStats {
    queued: number
    processing: number
    completedToday: number
    failed: number
}

const FREQUENCY_OPTIONS = [
    { value: '1_per_day', label: '1 bài / ngày' },
    { value: '2_per_day', label: '2 bài / ngày' },
    { value: '3_per_week', label: '3 bài / tuần' },
    { value: '5_per_week', label: '5 bài / tuần' },
    { value: '1_per_week', label: '1 bài / tuần' },
]

const APPROVAL_OPTIONS = [
    { value: 'auto', label: 'Tự động đăng', desc: 'AI xử lý xong → đăng luôn' },
    { value: 'admin', label: 'Admin duyệt', desc: 'AI xử lý → admin duyệt → đăng' },
    { value: 'client', label: 'Client duyệt', desc: 'AI xử lý → client duyệt trên Portal → đăng' },
]

const DEFAULT_TIMES = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00',
]

export default function AutoContentTab({ channelId }: { channelId: string }) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [config, setConfig] = useState<PipelineConfig>({
        pipelineEnabled: false,
        pipelineFrequency: '1_per_day',
        pipelineApprovalMode: 'admin',
        pipelinePostingTimes: ['19:00'],
    })
    const [stats, setStats] = useState<PipelineStats>({ queued: 0, processing: 0, completedToday: 0, failed: 0 })
    const [copied, setCopied] = useState(false)

    // ─── Load config ──────────────────────────────────
    const loadConfig = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/pipeline-config`)
            if (res.ok) {
                const data = await res.json()
                setConfig({
                    pipelineEnabled: data.pipelineEnabled ?? false,
                    pipelineFrequency: data.pipelineFrequency ?? '1_per_day',
                    pipelineApprovalMode: data.pipelineApprovalMode ?? 'admin',
                    pipelinePostingTimes: data.pipelinePostingTimes ?? ['19:00'],
                })
                setStats(data.stats ?? { queued: 0, processing: 0, completedToday: 0, failed: 0 })
            }
        } catch (e) {
            console.error('Failed to load pipeline config', e)
        } finally {
            setLoading(false)
        }
    }, [channelId])

    useEffect(() => { loadConfig() }, [loadConfig])

    // ─── Save config ──────────────────────────────────
    const saveConfig = async (updates: Partial<PipelineConfig>) => {
        const newConfig = { ...config, ...updates }
        setConfig(newConfig)
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/pipeline-config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
            })
            if (res.ok) {
                toast.success('Đã lưu cấu hình pipeline')
            } else {
                toast.error('Lưu thất bại')
            }
        } catch {
            toast.error('Lưu thất bại')
        } finally {
            setSaving(false)
        }
    }

    // ─── Posting times management ─────────────────────
    const addTime = () => {
        const available = DEFAULT_TIMES.filter(t => !config.pipelinePostingTimes.includes(t))
        if (available.length > 0) {
            saveConfig({ pipelinePostingTimes: [...config.pipelinePostingTimes, available[0]].sort() })
        }
    }

    const removeTime = (time: string) => {
        if (config.pipelinePostingTimes.length <= 1) return
        saveConfig({ pipelinePostingTimes: config.pipelinePostingTimes.filter(t => t !== time) })
    }

    const updateTime = (oldTime: string, newTime: string) => {
        saveConfig({
            pipelinePostingTimes: config.pipelinePostingTimes.map(t => t === oldTime ? newTime : t).sort(),
        })
    }

    // ─── Copy upload link ─────────────────────────────
    const copyUploadLink = () => {
        const url = `${window.location.origin}/portal`
        navigator.clipboard.writeText(url)
        setCopied(true)
        toast.success('Đã copy link Portal')
        setTimeout(() => setCopied(false), 2000)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* ─── Enable Pipeline ──────────────────────────── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                                <Zap className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Auto Content Pipeline</CardTitle>
                                <CardDescription>
                                    Client upload ảnh → AI tự viết caption → lên lịch đăng
                                </CardDescription>
                            </div>
                        </div>
                        <Switch
                            checked={config.pipelineEnabled}
                            onCheckedChange={(v) => saveConfig({ pipelineEnabled: v })}
                        />
                    </div>
                </CardHeader>

                {config.pipelineEnabled && (
                    <CardContent className="space-y-6">
                        {/* Stats bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5 text-center">
                                <p className="text-2xl font-bold text-blue-400">{stats.queued}</p>
                                <p className="text-[11px] text-blue-400/60">Đang chờ</p>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 text-center">
                                <p className="text-2xl font-bold text-amber-400">{stats.processing}</p>
                                <p className="text-[11px] text-amber-400/60">Đang xử lý</p>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-center">
                                <p className="text-2xl font-bold text-emerald-400">{stats.completedToday}</p>
                                <p className="text-[11px] text-emerald-400/60">Hoàn thành hôm nay</p>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-center">
                                <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
                                <p className="text-[11px] text-red-400/60">Lỗi</p>
                            </div>
                        </div>

                        {/* Posting Frequency */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                Tần suất đăng bài
                            </Label>
                            <Select
                                value={config.pipelineFrequency}
                                onValueChange={(v) => saveConfig({ pipelineFrequency: v })}
                            >
                                <SelectTrigger className="w-full sm:w-[260px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FREQUENCY_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Preferred Posting Times */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                Giờ đăng ưu tiên
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {config.pipelinePostingTimes.map(time => (
                                    <div key={time} className="flex items-center gap-1 bg-muted/50 border rounded-lg px-2 py-1">
                                        <Select value={time} onValueChange={(v) => updateTime(time, v)}>
                                            <SelectTrigger className="h-7 w-[80px] border-0 bg-transparent px-1 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DEFAULT_TIMES.map(t => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {config.pipelinePostingTimes.length > 1 && (
                                            <button
                                                onClick={() => removeTime(time)}
                                                className="text-muted-foreground hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addTime}
                                    className="h-9 gap-1"
                                    disabled={config.pipelinePostingTimes.length >= 5}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Thêm giờ
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                AI sẽ ưu tiên lên lịch vào các khung giờ này
                            </p>
                        </div>

                        {/* Approval Mode */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                Chế độ duyệt bài
                            </Label>
                            <div className="grid gap-2">
                                {APPROVAL_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => saveConfig({ pipelineApprovalMode: opt.value })}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${config.pipelineApprovalMode === opt.value
                                            ? 'border-indigo-500/50 bg-indigo-500/10'
                                            : 'border-border hover:border-muted-foreground/30'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${config.pipelineApprovalMode === opt.value
                                            ? 'border-indigo-500 bg-indigo-500'
                                            : 'border-muted-foreground/30'
                                            }`}>
                                            {config.pipelineApprovalMode === opt.value && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{opt.label}</p>
                                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Client Upload Link */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                                Link upload cho client
                            </Label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 text-sm text-muted-foreground truncate">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/portal` : '/portal'}
                                </div>
                                <Button variant="outline" size="sm" onClick={copyUploadLink} className="gap-1.5 shrink-0">
                                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                    {copied ? 'Đã copy' : 'Copy'}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Gửi link này cho client để họ upload ảnh/video trực tiếp
                            </p>
                        </div>

                        {/* How it works info */}
                        <div className="bg-muted/30 border rounded-xl p-4 space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-blue-400" />
                                Cách hoạt động
                            </h4>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                                <li>Client upload ảnh/video qua Portal hoặc Telegram</li>
                                <li>AI phân tích từng ảnh và viết caption tự động</li>
                                <li>Bài post được tạo và lên lịch theo cấu hình</li>
                                <li>
                                    {config.pipelineApprovalMode === 'auto'
                                        ? 'Bài đăng tự động theo lịch'
                                        : config.pipelineApprovalMode === 'admin'
                                            ? 'Admin duyệt trước khi đăng'
                                            : 'Client duyệt trên Portal trước khi đăng'}
                                </li>
                                <li>Thông báo gửi về Telegram sau khi xử lý xong</li>
                            </ol>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    )
}
