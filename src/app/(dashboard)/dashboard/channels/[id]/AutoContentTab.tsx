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
    Link2,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronUp,
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
import { MESSAGING_SOURCES, type MessagingSource } from '@/lib/messaging-sources'

interface PipelineConfig {
    pipelineEnabled: boolean
    pipelineFrequency: string
    pipelineApprovalMode: string
    pipelinePostingTimes: string[]
    smartflowSources?: Record<string, Record<string, string>>
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
    const [activeSubTab, setActiveSubTab] = useState<'pipeline' | 'connections'>('pipeline')
    const [config, setConfig] = useState<PipelineConfig>({
        pipelineEnabled: false,
        pipelineFrequency: '1_per_day',
        pipelineApprovalMode: 'admin',
        pipelinePostingTimes: ['19:00'],
        smartflowSources: {},
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
                    smartflowSources: data.smartflowSources ?? {},
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
            {/* ─── Sub-tab navigation ────────────────────────── */}
            <div className="flex gap-1 p-1 bg-muted/50 border rounded-xl">
                <button
                    onClick={() => setActiveSubTab('pipeline')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSubTab === 'pipeline'
                            ? 'bg-background shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Zap className="h-4 w-4" />
                    ⚡ {t('smartflow.tabs.pipeline')}
                </button>
                <button
                    onClick={() => setActiveSubTab('connections')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSubTab === 'connections'
                            ? 'bg-background shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Link2 className="h-4 w-4" />
                    🔗 {t('smartflow.tabs.connections')}
                </button>
            </div>

            {/* ─── Pipeline Sub-tab ──────────────────────────── */}
            {activeSubTab === 'pipeline' && (
                <PipelinePanel
                    t={t}
                    config={config}
                    stats={stats}
                    saving={saving}
                    copied={copied}
                    saveConfig={saveConfig}
                    addTime={addTime}
                    removeTime={removeTime}
                    updateTime={updateTime}
                    copyUploadLink={copyUploadLink}
                />
            )}

            {/* ─── Connections Sub-tab ───────────────────────── */}
            {activeSubTab === 'connections' && (
                <ConnectionsPanel
                    t={t}
                    channelId={channelId}
                    config={config}
                    saveConfig={saveConfig}
                    saving={saving}
                />
            )}
        </div>
    )
}

// ─── Pipeline Panel (existing UI) ──────────────────────

function PipelinePanel({ t, config, stats, saving: _saving, copied, saveConfig, addTime, removeTime, updateTime, copyUploadLink }: {
    t: ReturnType<typeof useTranslation>
    config: PipelineConfig
    stats: PipelineStats
    saving: boolean
    copied: boolean
    saveConfig: (u: Partial<PipelineConfig>) => Promise<void>
    addTime: () => void
    removeTime: (t: string) => void
    updateTime: (o: string, n: string) => void
    copyUploadLink: () => void
}) {
    return (
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
    )
}

// ─── Connections Panel (new) ──────────────────────────

function ConnectionsPanel({ t, channelId: _channelId, config, saveConfig, saving }: {
    t: ReturnType<typeof useTranslation>
    channelId: string
    config: PipelineConfig
    saveConfig: (u: Partial<PipelineConfig>) => Promise<void>
    saving: boolean
}) {
    return (
        <div className="space-y-4">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Link2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base">{t('smartflow.sources.title')}</CardTitle>
                            <CardDescription>{t('smartflow.sources.subtitle')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-3 flex items-center gap-2">
                        <span className="text-lg">💡</span>
                        <p className="text-xs text-muted-foreground">{t('smartflow.sources.howItWorks')}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Source Cards — dynamically rendered from registry */}
            {MESSAGING_SOURCES.map(source => (
                <SourceCard
                    key={source.key}
                    source={source}
                    t={t}
                    config={config}
                    saveConfig={saveConfig}
                    saving={saving}
                />
            ))}
        </div>
    )
}

// ─── Individual Source Card ───────────────────────────

function SourceCard({ source, t, config, saveConfig, saving }: {
    source: MessagingSource
    t: ReturnType<typeof useTranslation>
    config: PipelineConfig
    saveConfig: (u: Partial<PipelineConfig>) => Promise<void>
    saving: boolean
}) {
    const sourceConfig = config.smartflowSources?.[source.key] || {}
    const isConnected = Object.values(sourceConfig).some(v => v && v.length > 0)

    const [localValues, setLocalValues] = useState<Record<string, string>>(() =>
        source.fields.reduce((acc, f) => ({ ...acc, [f.key]: sourceConfig[f.key] || '' }), {} as Record<string, string>)
    )
    const [showGuide, setShowGuide] = useState(false)
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ valid: boolean; name?: string; error?: string } | null>(null)

    const handleSave = async () => {
        // Validate required fields
        const missing = source.fields.filter(f => f.required && !localValues[f.key])
        if (missing.length > 0) {
            toast.error(`${missing.map(f => f.label).join(', ')} required`)
            return
        }

        const newSources = {
            ...config.smartflowSources,
            [source.key]: localValues,
        }
        await saveConfig({ smartflowSources: newSources })
        toast.success(t('smartflow.sources.saved'))
    }

    const handleDisconnect = async () => {
        const newSources = { ...config.smartflowSources }
        delete newSources[source.key]
        setLocalValues(source.fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {} as Record<string, string>))
        setTestResult(null)
        await saveConfig({ smartflowSources: newSources })
        toast.success(t('smartflow.sources.disconnected_toast'))
    }

    const handleTest = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            const result = await source.validateConfig(localValues)
            setTestResult(result)
            if (result.valid) {
                toast.success(`${t('smartflow.sources.testSuccess')} ${result.name || ''}`)
            } else {
                toast.error(result.error || t('smartflow.sources.testFailed'))
            }
        } catch {
            setTestResult({ valid: false, error: 'Connection error' })
            toast.error(t('smartflow.sources.testFailed'))
        } finally {
            setTesting(false)
        }
    }

    const togglePassword = (key: string) => {
        setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))
    }

    // Helper to get source-specific i18n
    const st = (key: string) => t(`smartflow.sources.${source.key}.${key}`)

    return (
        <Card className={`transition-all ${isConnected ? source.color.border : ''}`}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl ${source.color.bg} flex items-center justify-center text-xl`}>
                            {source.icon}
                        </div>
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                {source.label}
                                {isConnected && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                                        ✓ {t('smartflow.sources.connected')}
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription className="text-xs">{st('desc')}</CardDescription>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowGuide(!showGuide)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Setup Guide (collapsible) */}
                {showGuide && (
                    <div className={`${source.color.bg} border ${source.color.border} rounded-xl p-4 space-y-2`}>
                        <h5 className={`text-xs font-semibold ${source.color.text} uppercase tracking-wider`}>Setup Guide</h5>
                        {source.setupSteps.map((_step, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                                {st(`step${i + 1}`)}
                            </p>
                        ))}
                    </div>
                )}

                {/* Config Fields */}
                <div className="space-y-3">
                    {source.fields.map(field => (
                        <div key={field.key} className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
                            <div className="relative">
                                <input
                                    type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                                    value={localValues[field.key] || ''}
                                    onChange={e => setLocalValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    placeholder={field.placeholder}
                                    className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm pr-10 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                />
                                {field.type === 'password' && (
                                    <button
                                        onClick={() => togglePassword(field.key)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPasswords[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Test result */}
                {testResult && (
                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${testResult.valid
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                        }`}>
                        {testResult.valid
                            ? <><CheckCircle2 className="h-3.5 w-3.5" /> {t('smartflow.sources.testSuccess')} {testResult.name}</>
                            : <><AlertCircle className="h-3.5 w-3.5" /> {testResult.error}</>
                        }
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTest}
                        disabled={testing || !localValues[source.fields[0]?.key]}
                        className="gap-1.5"
                    >
                        {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        {testing ? t('smartflow.sources.testing') : t('smartflow.sources.testConnection')}
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving || !localValues[source.fields[0]?.key]}
                        className="gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {saving ? t('smartflow.sources.connecting') : t('smartflow.sources.connect')}
                    </Button>
                    {isConnected && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDisconnect}
                            className="gap-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 ml-auto"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('smartflow.sources.disconnect')}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
