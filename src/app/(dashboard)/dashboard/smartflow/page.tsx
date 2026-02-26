'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    Zap,
    RefreshCw,
    Loader2,
    RotateCcw,
    XCircle,
    AlertTriangle,
    Video,
    ThumbsUp,
    ThumbsDown,
    Clock,
    CheckCircle2,
    Eye,
    CalendarCheck,
    ExternalLink,
} from 'lucide-react'

// ─── Platform SVG Icons ──────────────────────────────────
function FacebookIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    )
}

function InstagramIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
    )
}

function TikTokIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
    )
}

function YouTubeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
    )
}

function TwitterIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    )
}

function ThreadsIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.781 3.632 2.691 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.186.408-2.228 1.33-2.934.88-.674 2.017-1.005 3.46-1.063l.09-.003c1.04-.034 2.036.05 2.98.253.01-.377.007-.755-.012-1.13-.137-2.658-1.27-3.88-3.46-3.934h-.044c-1.478.017-2.666.548-3.434 1.536l-1.58-1.278C8.516 3.14 10.11 2.397 12.17 2.373h.06c2.926.034 4.766 1.575 5.213 4.36.144.9.17 1.834.077 2.779a7.3 7.3 0 011.817 1.274c.852.87 1.39 1.958 1.602 3.237.34 2.056-.082 4.26-1.875 6.032C17.102 21.959 14.894 22.8 12.2 22.82zM11.09 14.2c-1.07.041-1.872.267-2.384.67-.39.308-.563.667-.544 1.071.034.728.652 1.512 2.097 1.705h.073c1.406-.082 2.395-.88 2.777-2.262a8.5 8.5 0 00-2.019-.184z" />
        </svg>
    )
}

function LinkedInIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    )
}

const PLATFORM_ICONS: Record<string, { icon: React.FC<{ className?: string }>; color: string; activeColor: string }> = {
    facebook: { icon: FacebookIcon, color: 'text-muted-foreground/30', activeColor: 'text-blue-500 dark:text-blue-400' },
    instagram: { icon: InstagramIcon, color: 'text-muted-foreground/30', activeColor: 'text-pink-500 dark:text-pink-400' },
    tiktok: { icon: TikTokIcon, color: 'text-muted-foreground/30', activeColor: 'text-cyan-600 dark:text-cyan-300' },
    youtube: { icon: YouTubeIcon, color: 'text-muted-foreground/30', activeColor: 'text-red-500 dark:text-red-400' },
    twitter: { icon: TwitterIcon, color: 'text-muted-foreground/30', activeColor: 'text-foreground' },
    threads: { icon: ThreadsIcon, color: 'text-muted-foreground/30', activeColor: 'text-purple-500 dark:text-purple-300' },
    linkedin: { icon: LinkedInIcon, color: 'text-muted-foreground/30', activeColor: 'text-blue-600 dark:text-blue-300' },
}

// Platforms that don't accept static images (photo)
const IMAGE_INCOMPATIBLE_PLATFORMS = ['tiktok']

// ─── Types ──────────────────────────────────────────────
type PlatformStatus = {
    id: string
    platform: string
    accountId: string
    status: string
}

type ContentJob = {
    id: string
    status: string
    aiCaption: string | null
    errorMessage: string | null
    uploadedBy: string | null
    processedAt: string | null
    createdAt: string
    mediaItem: { url: string; thumbnailUrl: string | null; type: string; originalName: string | null }
    channel: { id: string; displayName: string; pipelineApprovalMode: string | null }
    post: {
        id: string
        status: string
        scheduledAt: string | null
        content: string | null
        metadata: Record<string, unknown> | null
        platformStatuses: PlatformStatus[]
        approvals?: { action: string; comment?: string | null; user?: { name: string | null; email: string } }[]
    } | null
}

// ─── Column Definitions ─────────────────────────────────
interface KanbanColumn {
    key: string
    labelKey: string
    icon: React.ReactNode
    gradient: string
    borderColor: string
    headerBg: string
    filter: (job: ContentJob) => boolean
}

const ALL_COLUMNS: KanbanColumn[] = [
    {
        key: 'queued',
        labelKey: 'smartflow.queue.statusQueued',
        icon: <Clock className="h-4 w-4" />,
        gradient: 'from-blue-500/20 to-blue-600/5',
        borderColor: 'border-blue-500/30',
        headerBg: 'bg-blue-500/10',
        filter: (job) => job.status === 'QUEUED' || job.status === 'PROCESSING',
    },
    {
        key: 'pending',
        labelKey: 'smartflow.queue.statusPendingApproval',
        icon: <Eye className="h-4 w-4" />,
        gradient: 'from-amber-500/20 to-amber-600/5',
        borderColor: 'border-amber-500/30',
        headerBg: 'bg-amber-500/10',
        filter: (job) => job.post?.status === 'PENDING_APPROVAL',
    },
    {
        key: 'client_review',
        labelKey: 'smartflow.queue.statusClientReview',
        icon: <CheckCircle2 className="h-4 w-4" />,
        gradient: 'from-purple-500/20 to-purple-600/5',
        borderColor: 'border-purple-500/30',
        headerBg: 'bg-purple-500/10',
        filter: (job) => job.post?.status === 'CLIENT_REVIEW',
    },
    {
        key: 'scheduled',
        labelKey: 'smartflow.queue.statusScheduled',
        icon: <CalendarCheck className="h-4 w-4" />,
        gradient: 'from-emerald-500/20 to-emerald-600/5',
        borderColor: 'border-emerald-500/30',
        headerBg: 'bg-emerald-500/10',
        filter: (job) => job.post?.status === 'SCHEDULED' || job.post?.status === 'PUBLISHED',
    },
]

// Map: approval mode → which column keys are visible
const MODE_COLUMNS: Record<string, string[]> = {
    auto: ['queued', 'scheduled'],
    admin: ['queued', 'pending', 'scheduled'],
    client: ['queued', 'pending', 'scheduled'],
    smartflow: ['queued', 'pending', 'client_review', 'scheduled'],
}

export default function SmartFlowPage() {
    const t = useTranslation()
    const { data: session } = useSession()
    const router = useRouter()
    const [jobs, setJobs] = useState<ContentJob[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Record<string, number>>({})
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [detectedMode, setDetectedMode] = useState<string>('smartflow')
    const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'all'>('week')

    function getDateRange(preset: typeof datePreset) {
        const now = new Date()
        if (preset === 'all') return { from: undefined, to: undefined }
        if (preset === 'today') {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            return { from: d.toISOString(), to: now.toISOString() }
        }
        if (preset === 'week') {
            const d = new Date(now)
            d.setDate(d.getDate() - d.getDay())
            d.setHours(0, 0, 0, 0)
            return { from: d.toISOString(), to: now.toISOString() }
        }
        const d = new Date(now.getFullYear(), now.getMonth(), 1)
        return { from: d.toISOString(), to: now.toISOString() }
    }

    const fetchJobs = useCallback(async () => {
        try {
            const range = getDateRange(datePreset)
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('limit', '100')
            if (range.from) params.set('from', range.from)
            if (range.to) params.set('to', range.to)
            const res = await fetch(`/api/admin/content-pipeline?${params}`)
            if (res.ok) {
                const data = await res.json()
                setJobs(data.jobs)
                setStats(data.stats || {})

                const modes = (data.jobs as ContentJob[])
                    .map(j => j.channel.pipelineApprovalMode)
                    .filter(Boolean)
                if (modes.length > 0) {
                    const priority = ['smartflow', 'client', 'admin', 'auto']
                    const bestMode = priority.find(m => modes.includes(m)) || 'smartflow'
                    setDetectedMode(bestMode)
                }
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datePreset])

    useEffect(() => { fetchJobs() }, [fetchJobs])
    useEffect(() => {
        const interval = setInterval(fetchJobs, 15000)
        return () => clearInterval(interval)
    }, [fetchJobs])

    const handleAction = async (action: string, jobId?: string, postId?: string, extra?: Record<string, string>) => {
        setActionLoading(jobId || postId || 'all')
        try {
            const res = await fetch('/api/admin/content-pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, jobId, postId, ...extra }),
            })
            if (res.ok) {
                if (action !== 'toggle_platform') {
                    const messages: Record<string, string> = {
                        retry: t('smartflow.queue.retried'),
                        cancel: t('smartflow.queue.cancelled'),
                        retry_all_failed: t('smartflow.queue.retried'),
                        approve: t('smartflow.queue.approved'),
                        reject: t('smartflow.queue.rejected'),
                        client_approve: t('smartflow.queue.approved'),
                    }
                    toast.success(messages[action] || '✅')
                }
                fetchJobs()
            } else {
                toast.error(t('smartflow.queue.actionFailed'))
            }
        } catch {
            toast.error(t('smartflow.queue.actionFailed'))
        }
        setActionLoading(null)
    }

    const handleTogglePlatform = async (ps: PlatformStatus) => {
        const newStatus = ps.status === 'skipped' ? 'pending' : 'skipped'
        // Optimistic update
        setJobs(prev => prev.map(j => {
            if (!j.post) return j
            return {
                ...j,
                post: {
                    ...j.post,
                    platformStatuses: j.post.platformStatuses.map(p =>
                        p.id === ps.id ? { ...p, status: newStatus } : p
                    ),
                },
            }
        }))
        await handleAction('toggle_platform', undefined, undefined, {
            platformStatusId: ps.id,
            newStatus,
        })
    }

    // Get active columns based on detected mode
    const activeColumnKeys = MODE_COLUMNS[detectedMode] || MODE_COLUMNS.smartflow
    const activeColumns = ALL_COLUMNS.filter(c => activeColumnKeys.includes(c.key))
    const failedJobs = jobs.filter(j => j.status === 'FAILED')

    const gridClass = activeColumns.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : activeColumns.length === 3
            ? 'grid-cols-1 md:grid-cols-3'
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Zap className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">{t('smartflow.queue.title')}</h1>
                            <p className="text-sm text-muted-foreground">{t('smartflow.queue.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
                            {([
                                { key: 'today' as const, label: t('smartflow.queue.dateToday') },
                                { key: 'week' as const, label: t('smartflow.queue.dateWeek') },
                                { key: 'month' as const, label: t('smartflow.queue.dateMonth') },
                                { key: 'all' as const, label: t('smartflow.queue.dateAll') },
                            ]).map(p => (
                                <button
                                    key={p.key}
                                    onClick={() => setDatePreset(p.key)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${datePreset === p.key
                                        ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border">
                            {detectedMode.toUpperCase()}
                        </span>
                        {failedJobs.length > 0 && (
                            <button
                                onClick={() => handleAction('retry_all_failed')}
                                disabled={actionLoading === 'all'}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all"
                            >
                                <RotateCcw className="h-3 w-3" />
                                {t('smartflow.queue.retryAllFailed')} ({failedJobs.length})
                            </button>
                        )}
                        <button
                            onClick={fetchJobs}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border text-muted-foreground rounded-lg text-xs hover:bg-muted transition-all"
                        >
                            <RefreshCw className="h-3 w-3" />
                            {t('smartflow.queue.refresh')}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col gap-4 min-h-0">
                        {/* Kanban Board — full height */}
                        <div className={`grid ${gridClass} gap-4 flex-1`}>
                            {activeColumns.map(col => {
                                const colJobs = jobs.filter(col.filter)
                                return (
                                    <div key={col.key} className={`rounded-2xl border ${col.borderColor} bg-gradient-to-b ${col.gradient} flex flex-col`}>
                                        <div className={`${col.headerBg} rounded-t-2xl px-4 py-3 flex items-center justify-between border-b ${col.borderColor} shrink-0`}>
                                            <div className="flex items-center gap-2">
                                                {col.icon}
                                                <span className="text-sm font-semibold">{t(col.labelKey)}</span>
                                            </div>
                                            <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">
                                                {colJobs.length}
                                            </span>
                                        </div>

                                        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                            {colJobs.length === 0 ? (
                                                <div className="flex items-center justify-center h-full min-h-[120px] text-muted-foreground/30">
                                                    <Zap className="h-5 w-5" />
                                                </div>
                                            ) : colJobs.map(job => (
                                                <JobCard
                                                    key={job.id}
                                                    job={job}
                                                    columnKey={col.key}
                                                    actionLoading={actionLoading}
                                                    detectedMode={detectedMode}
                                                    t={t}
                                                    onAction={handleAction}
                                                    onTogglePlatform={handleTogglePlatform}
                                                    onEdit={(postId) => router.push(`/dashboard/posts/${postId}`)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Failed jobs */}
                        {failedJobs.length > 0 && (
                            <div className="rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-500/10 to-red-600/5 shrink-0">
                                <div className="bg-red-500/10 rounded-t-2xl px-4 py-3 flex items-center justify-between border-b border-red-500/30">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-400" />
                                        <span className="text-sm font-semibold text-red-400">{t('smartflow.queue.statusFailed')}</span>
                                    </div>
                                    <span className="text-xs font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                        {failedJobs.length}
                                    </span>
                                </div>
                                <div className={`p-2 grid ${gridClass} gap-2`}>
                                    {failedJobs.map(job => (
                                        <JobCard
                                            key={job.id}
                                            job={job}
                                            columnKey="failed"
                                            actionLoading={actionLoading}
                                            detectedMode={detectedMode}
                                            t={t}
                                            onAction={handleAction}
                                            onTogglePlatform={handleTogglePlatform}
                                            onEdit={(postId) => router.push(`/dashboard/posts/${postId}`)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Job Card ───────────────────────────────────────────
function JobCard({
    job, columnKey, actionLoading, detectedMode, t,
    onAction, onTogglePlatform, onEdit,
}: {
    job: ContentJob
    columnKey: string
    actionLoading: string | null
    detectedMode: string
    t: (key: string) => string
    onAction: (action: string, jobId?: string, postId?: string) => void
    onTogglePlatform: (ps: PlatformStatus) => void
    onEdit: (postId: string) => void
}) {
    const isImage = job.mediaItem.type === 'image' || job.mediaItem.type === 'photo'
    const hasApprovalStatus = job.post?.status === 'PENDING_APPROVAL' || job.post?.status === 'CLIENT_REVIEW'

    return (
        <div className="bg-muted/30 border border-border rounded-xl p-3 hover:bg-muted/50 transition-all group">
            {/* Media thumbnail + title */}
            <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                    {job.mediaItem.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
                            <Video className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                    ) : (
                        <img
                            src={job.mediaItem.thumbnailUrl || job.mediaItem.url}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{job.mediaItem.originalName || t('smartflow.queue.media')}</p>
                    <p className="text-[10px] text-muted-foreground">{job.channel.displayName}</p>
                </div>
                {/* Edit button → navigate to post page */}
                {job.post && (
                    <button
                        onClick={() => onEdit(job.post!.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                        title={t('smartflow.queue.editPost')}
                    >
                        <ExternalLink className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Caption */}
            {job.post?.content && (
                <p className="text-[11px] text-muted-foreground line-clamp-3 mb-2 leading-relaxed">{job.post.content}</p>
            )}

            {/* Client Feedback */}
            {job.post?.approvals && job.post.approvals.length > 0 && job.post.approvals.some(a => a.comment) && (
                <div className="mb-2 space-y-1">
                    {job.post.approvals.filter(a => a.comment).slice(0, 2).map((a, i) => (
                        <div key={i} className="flex items-start gap-1.5 bg-muted/30 rounded-lg px-2 py-1.5">
                            <div className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold ${a.action === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {a.action === 'APPROVED' ? '✓' : '✗'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] text-muted-foreground font-medium">
                                    {a.user?.name || a.user?.email?.split('@')[0] || 'Client'}
                                </p>
                                <p className="text-[10px] text-muted-foreground/80 leading-snug line-clamp-2">{a.comment}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error message */}
            {job.errorMessage && (
                <p className="text-[10px] text-red-400/80 line-clamp-2 mb-2 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    {job.errorMessage}
                </p>
            )}

            {/* Platform SVG badges — interactive toggle */}
            {job.post?.platformStatuses && job.post.platformStatuses.length > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                    {job.post.platformStatuses.map(ps => {
                        const pKey = ps.platform.toLowerCase()
                        const pCfg = PLATFORM_ICONS[pKey]
                        if (!pCfg) return null
                        const Icon = pCfg.icon
                        const isActive = ps.status !== 'skipped'
                        // TikTok default off for images
                        const isTikTokImage = isImage && IMAGE_INCOMPATIBLE_PLATFORMS.includes(pKey)

                        return (
                            <button
                                key={ps.id}
                                onClick={() => onTogglePlatform(ps)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive
                                    ? `${pCfg.activeColor} bg-muted shadow-sm`
                                    : `${pCfg.color} bg-muted/30 opacity-40`
                                    } hover:scale-110`}
                                title={`${ps.platform} — ${isActive ? t('smartflow.queue.platformActive') : t('smartflow.queue.platformInactive')}${isTikTokImage ? ` (${t('smartflow.queue.staticImage')})` : ''}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                            </button>
                        )
                    })}

                    {/* Media dimensions */}
                    {(() => {
                        const meta = job.post?.metadata as Record<string, Record<string, number>> | null
                        if (!meta?.mediaDimensions) return null
                        return (
                            <span className="text-[9px] text-muted-foreground/50 ml-auto">
                                {String(meta.mediaDimensions.width)}×{String(meta.mediaDimensions.height)}
                            </span>
                        )
                    })()}
                </div>
            )}

            {/* Meta info */}
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground mb-2">
                <span>📤 {job.uploadedBy?.split('@')[0] || '?'}</span>
                {job.post?.scheduledAt && (
                    <span className="text-blue-500/60 dark:text-blue-400/40">
                        🗓 {new Date(job.post.scheduledAt).toLocaleDateString('vi-VN', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                    </span>
                )}
            </div>

            {/* Action buttons — always visible for posts with approval status */}
            <div className={`flex gap-1.5 ${hasApprovalStatus ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                {/* Approve — always show for approval-status posts regardless of channel config */}
                {job.post && job.post.status === 'PENDING_APPROVAL' && (
                    <button
                        onClick={() => onAction('approve', undefined, job.post!.id)}
                        disabled={actionLoading === job.post.id}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-medium transition-all"
                    >
                        {actionLoading === job.post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                        {t('smartflow.queue.approve')}
                    </button>
                )}

                {/* Client Approve */}
                {job.post && job.post.status === 'CLIENT_REVIEW' && (
                    <button
                        onClick={() => onAction('client_approve', undefined, job.post!.id)}
                        disabled={actionLoading === job.post.id}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-medium transition-all"
                    >
                        {actionLoading === job.post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                        {t('smartflow.queue.approve')}
                    </button>
                )}

                {/* Reject — always show for approval-status posts */}
                {job.post && hasApprovalStatus && (
                    <button
                        onClick={() => onAction('reject', undefined, job.post!.id)}
                        disabled={actionLoading === job.post.id}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] transition-all"
                    >
                        <ThumbsDown className="h-3 w-3" />
                    </button>
                )}

                {/* Retry failed */}
                {job.status === 'FAILED' && (
                    <button
                        onClick={() => onAction('retry', job.id)}
                        disabled={actionLoading === job.id}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[10px] font-medium transition-all"
                    >
                        {actionLoading === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        {t('smartflow.queue.retry')}
                    </button>
                )}

                {/* Cancel */}
                {(job.status === 'QUEUED' || job.status === 'PROCESSING') && (
                    <button
                        onClick={() => onAction('cancel', job.id)}
                        disabled={actionLoading === job.id}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] transition-all"
                    >
                        <XCircle className="h-3 w-3" />
                    </button>
                )}
            </div>
        </div>
    )
}
