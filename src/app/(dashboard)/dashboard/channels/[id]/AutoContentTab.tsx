'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
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

const FREQUENCY_KEYS = ['1_per_day', '2_per_day', '3_per_week', '5_per_week', '1_per_week'] as const

const APPROVAL_OPTIONS = ['auto', 'admin', 'client', 'smartflow'] as const

const DEFAULT_TIMES = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00',
]

export default function AutoContentTab({ channelId }: { channelId: string }) {
    const t = useTranslation()
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
                toast.success(t('smartflow.configSaved'))
            } else {
                toast.error(t('smartflow.configFailed'))
            }
        } catch {
            toast.error(t('smartflow.configFailed'))
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
        toast.success(t('smartflow.queue.portalCopied'))
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
                                <CardTitle className="text-base">{t('smartflow.title')}</CardTitle>
                                <CardDescription>
                                    {t('smartflow.subtitle')}
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
                                <p className="text-[11px] text-blue-400/60">{t('smartflow.stats.queued')}</p>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 text-center">
                                <p className="text-2xl font-bold text-amber-400">{stats.processing}</p>
                                <p className="text-[11px] text-amber-400/60">{t('smartflow.stats.processing')}</p>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-center">
                                <p className="text-2xl font-bold text-emerald-400">{stats.completedToday}</p>
                                <p className="text-[11px] text-emerald-400/60">{t('smartflow.stats.completed')}</p>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-center">
                                <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
                                <p className="text-[11px] text-red-400/60">{t('smartflow.stats.failed')}</p>
                            </div>
                        </div>

                        {/* Posting Frequency */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                {t('smartflow.frequency.label')}
                            </Label>
                            <Select
                                value={config.pipelineFrequency}
                                onValueChange={(v) => saveConfig({ pipelineFrequency: v })}
                            >
                                <SelectTrigger className="w-full sm:w-[260px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FREQUENCY_KEYS.map(key => (
                                        <SelectItem key={key} value={key}>{t(`smartflow.frequency.${key}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Preferred Posting Times */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {t('smartflow.postingTimes.label')}
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
                                    {t('smartflow.postingTimes.addTime')}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {t('smartflow.postingTimes.hint')}
                            </p>
                        </div>

                        {/* Approval Mode */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                {t('smartflow.approval.label')}
                            </Label>
                            <div className="grid gap-2">
                                {APPROVAL_OPTIONS.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => saveConfig({ pipelineApprovalMode: opt })}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${config.pipelineApprovalMode === opt
                                            ? opt === 'smartflow'
                                                ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/20'
                                                : 'border-indigo-500/50 bg-indigo-500/10'
                                            : 'border-border hover:border-muted-foreground/30'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${config.pipelineApprovalMode === opt
                                            ? opt === 'smartflow'
                                                ? 'border-amber-500 bg-amber-500'
                                                : 'border-indigo-500 bg-indigo-500'
                                            : 'border-muted-foreground/30'
                                            }`}>
                                            {config.pipelineApprovalMode === opt && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium">{t(`smartflow.approval.${opt}.label`)}</p>
                                                {opt === 'smartflow' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">★ PRO</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{t(`smartflow.approval.${opt}.desc`)}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Client Upload Link */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                                {t('smartflow.uploadLink.label')}
                            </Label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 text-sm text-muted-foreground truncate">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/portal` : '/portal'}
                                </div>
                                <Button variant="outline" size="sm" onClick={copyUploadLink} className="gap-1.5 shrink-0">
                                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                    {copied ? t('smartflow.uploadLink.copied') : t('smartflow.uploadLink.copy')}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {t('smartflow.uploadLink.hint')}
                            </p>
                        </div>

                        {/* How it works info */}
                        <div className="bg-muted/30 border rounded-xl p-4 space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-blue-400" />
                                {t('smartflow.howItWorks.title')}
                            </h4>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                                <li>{t('smartflow.howItWorks.step1')}</li>
                                <li>{t('smartflow.howItWorks.step2')}</li>
                                <li>{t('smartflow.howItWorks.step3')}</li>
                                <li>
                                    {config.pipelineApprovalMode === 'auto'
                                        ? t('smartflow.howItWorks.step4_auto')
                                        : config.pipelineApprovalMode === 'admin'
                                            ? t('smartflow.howItWorks.step4_admin')
                                            : config.pipelineApprovalMode === 'client'
                                                ? t('smartflow.howItWorks.step4_client')
                                                : t('smartflow.howItWorks.step4_smartflow')}
                                </li>
                                <li>{t('smartflow.howItWorks.step5')}</li>
                            </ol>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    )
}
