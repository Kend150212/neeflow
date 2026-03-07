'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    Zap, RefreshCw, Loader2, RotateCcw, XCircle, AlertTriangle,
    Video, ThumbsUp, ThumbsDown, Clock, CheckCircle2, Eye,
    CalendarCheck, ExternalLink, ChevronDown, MessageSquare, AlertOctagon,
} from 'lucide-react'

// ─── Platform SVG Icons ──────────────────────────────────
function FacebookIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
}
function InstagramIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
}
function TikTokIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
}
function YouTubeIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
}
function TwitterIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
}
function LinkedInIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.2 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
}
function ThreadsIcon({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.781 3.632 2.691 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.186.408-2.228 1.33-2.934.88-.674 2.017-1.005 3.46-1.063l.09-.003c1.04-.034 2.036.05 2.98.253.01-.377.007-.755-.012-1.13-.137-2.658-1.27-3.88-3.46-3.934h-.044c-1.478.017-2.666.548-3.434 1.536l-1.58-1.278C8.516 3.14 10.11 2.397 12.17 2.373h.06c2.926.034 4.766 1.575 5.213 4.36.144.9.17 1.834.077 2.779a7.3 7.3 0 011.817 1.274c.852.87 1.39 1.958 1.602 3.237.34 2.056-.082 4.26-1.875 6.032C17.102 21.959 14.894 22.8 12.2 22.82zM11.09 14.2c-1.07.041-1.872.267-2.384.67-.39.308-.563.667-.544 1.071.034.728.652 1.512 2.097 1.705h.073c1.406-.082 2.395-.88 2.777-2.262a8.5 8.5 0 00-2.019-.184z" /></svg>
}

const PLATFORM_ICONS: Record<string, { icon: React.FC<{ className?: string }>; color: string; activeColor: string }> = {
    facebook: { icon: FacebookIcon, color: 'text-muted-foreground/30', activeColor: 'text-blue-500' },
    instagram: { icon: InstagramIcon, color: 'text-muted-foreground/30', activeColor: 'text-pink-500' },
    tiktok: { icon: TikTokIcon, color: 'text-muted-foreground/30', activeColor: 'text-cyan-500' },
    youtube: { icon: YouTubeIcon, color: 'text-muted-foreground/30', activeColor: 'text-red-500' },
    twitter: { icon: TwitterIcon, color: 'text-muted-foreground/30', activeColor: 'text-foreground' },
    threads: { icon: ThreadsIcon, color: 'text-muted-foreground/30', activeColor: 'text-purple-500' },
    linkedin: { icon: LinkedInIcon, color: 'text-muted-foreground/30', activeColor: 'text-blue-600' },
}

const IMAGE_INCOMPATIBLE_PLATFORMS = ['tiktok']

// ─── Types ──────────────────────────────────────────────
type PlatformStatus = { id: string; platform: string; accountId: string; status: string }

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

type Channel = { id: string; displayName: string }

// ─── Column Definitions ─────────────────────────────────
interface KanbanColumn {
    key: string
    label: string
    icon: React.ReactNode
    colorDot: string
    colorText: string
    colorLine: string
    filter: (job: ContentJob) => boolean
}

function buildColumns(t: (k: string) => string): KanbanColumn[] {
    return [
        {
            key: 'queued', label: t('smartflow.queue.statusQueued'),
            icon: <Clock className="h-4 w-4" />,
            colorDot: 'bg-blue-400', colorText: 'text-blue-400', colorLine: 'bg-blue-400/30',
            filter: (j) => j.status === 'QUEUED' || j.status === 'PROCESSING',
        },
        {
            key: 'pending', label: t('smartflow.queue.statusPendingApproval'),
            icon: <Eye className="h-4 w-4" />,
            colorDot: 'bg-amber-500', colorText: 'text-amber-500', colorLine: 'bg-amber-500/30',
            filter: (j) => j.post?.status === 'PENDING_APPROVAL',
        },
        {
            key: 'client_review', label: t('smartflow.queue.statusClientReview'),
            icon: <CheckCircle2 className="h-4 w-4" />,
            colorDot: 'bg-purple-500', colorText: 'text-purple-500', colorLine: 'bg-purple-500/30',
            filter: (j) => j.post?.status === 'CLIENT_REVIEW',
        },
        {
            key: 'rejected', label: t('smartflow.queue.statusRejected'),
            icon: <AlertOctagon className="h-4 w-4" />,
            colorDot: 'bg-orange-500', colorText: 'text-orange-400', colorLine: 'bg-orange-500/30',
            filter: (j) => j.post?.status === 'REJECTED',
        },
        {
            key: 'scheduled', label: t('smartflow.queue.statusScheduled'),
            icon: <CalendarCheck className="h-4 w-4" />,
            colorDot: 'bg-emerald-500', colorText: 'text-emerald-500', colorLine: 'bg-emerald-500/30',
            filter: (j) => j.post?.status === 'SCHEDULED' || j.post?.status === 'PUBLISHED',
        },
    ]
}

const MODE_COLUMNS: Record<string, string[]> = {
    auto: ['queued', 'rejected', 'scheduled'],
    admin: ['queued', 'pending', 'rejected', 'scheduled'],
    client: ['queued', 'pending', 'rejected', 'scheduled'],
    smartflow: ['queued', 'pending', 'client_review', 'rejected', 'scheduled'],
}

// ─── Reject Modal ───────────────────────────────────────
function RejectModal({ postId, onClose, onConfirm }: {
    postId: string
    onClose: () => void
    onConfirm: (postId: string, comment: string) => Promise<void>
}) {
    const t = useTranslation()
    const [comment, setComment] = useState('')
    const [loading, setLoading] = useState(false)
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                        <AlertOctagon className="h-4 w-4 text-orange-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">{t('smartflow.queue.rejectModalTitle')}</h3>
                        <p className="text-[11px] text-muted-foreground">{t('smartflow.queue.rejectModalDesc')}</p>
                    </div>
                </div>
                <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={t('smartflow.queue.rejectModalPlaceholder')}
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-1 focus:ring-orange-500/50 placeholder:text-muted-foreground/50"
                />
                <div className="flex gap-2 mt-4">
                    <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-all cursor-pointer">
                        {t('smartflow.queue.rejectModalCancel')}
                    </button>
                    <button
                        onClick={async () => {
                            setLoading(true)
                            await onConfirm(postId, comment)
                            setLoading(false)
                        }}
                        disabled={loading}
                        className="flex-1 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
                        {t('smartflow.queue.rejectModalConfirm')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ──────────────────────────────────────────
export default function SmartFlowPage() {
    const t = useTranslation()
    const { data: session } = useSession()
    const router = useRouter()
    const [jobs, setJobs] = useState<ContentJob[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [detectedMode, setDetectedMode] = useState<string>('smartflow')
    const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'all'>('week')
    const [channels, setChannels] = useState<Channel[]>([])
    const [selectedChannelId, setSelectedChannelId] = useState<string>('all')
    const [channelDropOpen, setChannelDropOpen] = useState(false)
    const [rejectModal, setRejectModal] = useState<{ postId: string } | null>(null)
    const [smartFlowQuota, setSmartFlowQuota] = useState<{
        hasAccess: boolean; maxPerMonth: number; usedThisMonth: number; hasByokKey: boolean
    } | null>(null)

    // Fetch available channels
    useEffect(() => {
        fetch('/api/admin/channels').then(r => r.ok ? r.json() : []).then(data => {
            if (Array.isArray(data)) setChannels(data.map((c: { id: string; displayName: string }) => ({ id: c.id, displayName: c.displayName })))
        }).catch(() => { })
    }, [])

    function getDateRange(preset: typeof datePreset) {
        const now = new Date()
        if (preset === 'all') return { from: undefined, to: undefined }
        if (preset === 'today') {
            return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), to: now.toISOString() }
        }
        if (preset === 'week') {
            const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0)
            return { from: d.toISOString(), to: now.toISOString() }
        }
        return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() }
    }

    const fetchJobs = useCallback(async () => {
        try {
            const range = getDateRange(datePreset)
            const params = new URLSearchParams({ page: '1', limit: '100' })
            if (range.from) params.set('from', range.from)
            if (range.to) params.set('to', range.to)
            if (selectedChannelId !== 'all') params.set('channelId', selectedChannelId)
            const res = await fetch(`/api/admin/content-pipeline?${params}`)
            if (res.ok) {
                const data = await res.json()
                setJobs(data.jobs)
                const modes = (data.jobs as ContentJob[]).map(j => j.channel.pipelineApprovalMode).filter(Boolean)
                if (modes.length > 0) {
                    const priority = ['smartflow', 'client', 'admin', 'auto']
                    setDetectedMode(priority.find(m => modes.includes(m)) || 'smartflow')
                }
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datePreset, selectedChannelId])

    useEffect(() => { fetchJobs() }, [fetchJobs])
    useEffect(() => {
        const i = setInterval(fetchJobs, 15000)
        return () => clearInterval(i)
    }, [fetchJobs])

    useEffect(() => {
        fetch('/api/billing').then(r => r.ok ? r.json() : null).then(d => {
            if (d?.smartFlow) setSmartFlowQuota(d.smartFlow)
        }).catch(() => { })
    }, [])

    const handleAction = async (action: string, jobId?: string, postId?: string, extra?: Record<string, string>) => {
        setActionLoading(jobId || postId || 'all')
        try {
            const res = await fetch('/api/admin/content-pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, jobId, postId, ...extra }),
            })
            if (res.ok) {
                const messages: Record<string, string> = {
                    retry: t('smartflow.queue.retried'), cancel: t('smartflow.queue.cancelled'),
                    retry_all_failed: t('smartflow.queue.retried'), approve: t('smartflow.queue.approved'),
                    reject: 'Đã đánh dấu cần chỉnh sửa', client_approve: t('smartflow.queue.approved'),
                    requeue: 'Đã đưa lại vào hàng chờ',
                }
                if (action !== 'toggle_platform') toast.success(messages[action] || '✅')
                fetchJobs()
            } else toast.error(t('smartflow.queue.actionFailed'))
        } catch { toast.error(t('smartflow.queue.actionFailed')) }
        setActionLoading(null)
    }

    const handleRejectConfirm = async (postId: string, comment: string) => {
        const res = await fetch('/api/admin/content-pipeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', postId, comment: comment.trim() || undefined }),
        })
        if (res.ok) { toast.success('Đã đánh dấu cần chỉnh sửa'); fetchJobs() }
        else toast.error(t('smartflow.queue.actionFailed'))
        setRejectModal(null)
    }

    const handleTogglePlatform = async (ps: PlatformStatus) => {
        const newStatus = ps.status === 'skipped' ? 'pending' : 'skipped'
        setJobs(prev => prev.map(j => !j.post ? j : {
            ...j, post: { ...j.post, platformStatuses: j.post.platformStatuses.map(p => p.id === ps.id ? { ...p, status: newStatus } : p) }
        }))
        await handleAction('toggle_platform', undefined, undefined, { platformStatusId: ps.id, newStatus })
    }

    const ALL_COLUMNS = buildColumns(t)
    const activeColumnKeys = MODE_COLUMNS[detectedMode] || MODE_COLUMNS.smartflow
    const activeColumns = ALL_COLUMNS.filter(c => activeColumnKeys.includes(c.key))
    const failedJobs = jobs.filter(j => j.status === 'FAILED')
    const showChannelBadge = selectedChannelId === 'all'

    const selectedChannel = channels.find(c => c.id === selectedChannelId)
    const quotaPercent = smartFlowQuota && smartFlowQuota.maxPerMonth > 0
        ? Math.round((smartFlowQuota.usedThisMonth / smartFlowQuota.maxPerMonth) * 100) : 0
    const quotaColor = quotaPercent >= 100 ? 'text-red-500' : quotaPercent >= 80 ? 'text-amber-500' : 'text-emerald-500'
    const quotaBgColor = quotaPercent >= 100 ? 'bg-red-500/10 border-red-500/20' : quotaPercent >= 80 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'

    if (smartFlowQuota && !smartFlowQuota.hasAccess) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="max-w-md text-center px-6">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-6">
                        <Zap className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3">{t('smartflow.quota.upgradeTitle')}</h2>
                    <p className="text-muted-foreground mb-6">{t('smartflow.quota.upgradeDescription')}</p>
                    <button onClick={() => router.push('/dashboard/billing')} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold">
                        {t('smartflow.quota.upgradeButton')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {rejectModal && (
                <RejectModal
                    postId={rejectModal.postId}
                    onClose={() => setRejectModal(null)}
                    onConfirm={handleRejectConfirm}
                />
            )}
            <div className="flex-1 max-w-[1800px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-4">

                {/* ── Header ── */}
                <div className="flex items-start justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Zap className="h-6 w-6 text-amber-500" />
                            {t('smartflow.queue.title')}
                            {selectedChannelId === 'all' ? (
                                <span className="text-base font-normal text-muted-foreground">
                                    — <span className="text-foreground font-semibold">All Channels</span>
                                </span>
                            ) : selectedChannel ? (
                                <span className="text-base font-normal text-muted-foreground">
                                    — <span className="text-foreground font-semibold">{selectedChannel.displayName}</span>
                                </span>
                            ) : null}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{t('smartflow.queue.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">

                        {/* ── Channel selector ── */}
                        <div className="relative">
                            <button
                                onClick={() => setChannelDropOpen(p => !p)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border rounded-xl text-xs font-medium text-foreground hover:bg-muted transition-all cursor-pointer"
                            >
                                <span className="max-w-[140px] truncate">
                                    {selectedChannelId === 'all' ? '📋 All Channels' : (selectedChannel?.displayName || 'Channel')}
                                </span>
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </button>
                            {channelDropOpen && (
                                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-20 py-1 min-w-[180px] max-h-64 overflow-y-auto">
                                    <button
                                        onClick={() => { setSelectedChannelId('all'); setChannelDropOpen(false) }}
                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors cursor-pointer ${selectedChannelId === 'all' ? 'text-primary font-semibold' : 'text-foreground'}`}
                                    >
                                        📋 All Channels
                                    </button>
                                    {channels.map(ch => (
                                        <button
                                            key={ch.id}
                                            onClick={() => { setSelectedChannelId(ch.id); setChannelDropOpen(false) }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors cursor-pointer truncate ${selectedChannelId === ch.id ? 'text-primary font-semibold' : 'text-foreground'}`}
                                        >
                                            {ch.displayName}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Date preset */}
                        <div className="flex items-center gap-0.5 bg-muted/50 rounded-xl p-1 border border-border">
                            {([
                                { key: 'today' as const, label: t('smartflow.queue.dateToday') },
                                { key: 'week' as const, label: t('smartflow.queue.dateWeek') },
                                { key: 'month' as const, label: t('smartflow.queue.dateMonth') },
                                { key: 'all' as const, label: t('smartflow.queue.dateAll') },
                            ]).map(p => (
                                <button
                                    key={p.key}
                                    onClick={() => setDatePreset(p.key)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${datePreset === p.key ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Quota badge */}
                        {smartFlowQuota && smartFlowQuota.maxPerMonth > 0 && smartFlowQuota.maxPerMonth !== -1 && (
                            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${quotaBgColor} ${quotaColor}`}>
                                {smartFlowQuota.usedThisMonth} / {smartFlowQuota.maxPerMonth} {t('smartflow.quota.jobsLabel')}
                            </span>
                        )}
                        {smartFlowQuota && smartFlowQuota.maxPerMonth === -1 && (
                            <span className="text-[10px] px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-medium">
                                {t('smartflow.quota.unlimited')}
                            </span>
                        )}

                        {/* Retry all failed */}
                        {failedJobs.length > 0 && (
                            <button
                                onClick={() => handleAction('retry_all_failed')}
                                disabled={actionLoading === 'all'}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                                <RotateCcw className="h-3 w-3" />
                                {t('smartflow.queue.retryAllFailed')} ({failedJobs.length})
                            </button>
                        )}

                        {/* Refresh */}
                        <button
                            onClick={fetchJobs}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border text-muted-foreground rounded-lg text-xs hover:bg-muted transition-all cursor-pointer"
                        >
                            <RefreshCw className="h-3 w-3" />
                            {t('smartflow.queue.refresh')}
                        </button>
                    </div>
                </div>

                {/* ── Quota Warning ── */}
                {smartFlowQuota && smartFlowQuota.maxPerMonth > 0 && quotaPercent >= 80 && (
                    <div className={`px-4 py-3 rounded-xl border text-sm flex items-center gap-2 shrink-0 ${quotaPercent >= 100 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{quotaPercent >= 100
                            ? smartFlowQuota.hasByokKey ? t('smartflow.quota.exhaustedByok') : t('smartflow.quota.exhaustedNoKey')
                            : t('smartflow.quota.nearingLimit')}</span>
                        {quotaPercent >= 100 && !smartFlowQuota.hasByokKey && (
                            <button onClick={() => router.push('/dashboard/api-keys')} className="ml-auto text-xs font-semibold underline cursor-pointer">
                                {t('smartflow.quota.addApiKey')}
                            </button>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-x-auto">
                        <div className="flex gap-4 h-full min-h-[calc(100vh-220px)] pb-4" style={{ minWidth: `${(activeColumns.length + (failedJobs.length > 0 ? 1 : 0)) * 300}px` }}>

                            {/* Status columns */}
                            {activeColumns.map(col => {
                                const colJobs = jobs.filter(col.filter)
                                return (
                                    <div key={col.key} className="flex flex-col w-72 shrink-0">
                                        <div className="flex items-center justify-between px-1 mb-3">
                                            <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${col.colorText}`}>
                                                <span className={`w-2 h-2 rounded-full ${col.colorDot}`} />
                                                {col.label}
                                            </span>
                                            <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                                {colJobs.length}
                                            </span>
                                        </div>
                                        <div className={`h-0.5 rounded-full mb-3 ${col.colorLine}`} />
                                        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
                                            {colJobs.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/30 gap-2">
                                                    <Zap className="h-6 w-6" />
                                                    <p className="text-xs">{col.key === 'scheduled' ? '✅ All clear' : '—'}</p>
                                                </div>
                                            ) : colJobs.map(job => (
                                                <JobCard
                                                    key={job.id}
                                                    job={job}
                                                    columnKey={col.key}
                                                    actionLoading={actionLoading}
                                                    detectedMode={detectedMode}
                                                    showChannelBadge={showChannelBadge}
                                                    t={t}
                                                    onAction={handleAction}
                                                    onReject={(postId) => setRejectModal({ postId })}
                                                    onTogglePlatform={handleTogglePlatform}
                                                    onEdit={(postId) => router.push(`/dashboard/posts/compose?edit=${postId}&source=client-board`)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Failed column */}
                            {failedJobs.length > 0 && (
                                <div className="flex flex-col w-72 shrink-0">
                                    <div className="flex items-center justify-between px-1 mb-3">
                                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-400">
                                            <span className="w-2 h-2 rounded-full bg-red-500" />
                                            {t('smartflow.queue.statusFailed')}
                                        </span>
                                        <span className="text-xs font-bold bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                                            {failedJobs.length}
                                        </span>
                                    </div>
                                    <div className="h-0.5 rounded-full bg-red-500/30 mb-3" />
                                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
                                        {failedJobs.map(job => (
                                            <JobCard
                                                key={job.id}
                                                job={job}
                                                columnKey="failed"
                                                actionLoading={actionLoading}
                                                detectedMode={detectedMode}
                                                showChannelBadge={showChannelBadge}
                                                t={t}
                                                onAction={handleAction}
                                                onReject={(postId) => setRejectModal({ postId })}
                                                onTogglePlatform={handleTogglePlatform}
                                                onEdit={(postId) => router.push(`/dashboard/posts/compose?edit=${postId}&source=client-board`)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Job Card ────────────────────────────────────────────
function JobCard({
    job, columnKey, actionLoading, detectedMode, showChannelBadge, t,
    onAction, onReject, onTogglePlatform, onEdit,
}: {
    job: ContentJob
    columnKey: string
    actionLoading: string | null
    detectedMode: string
    showChannelBadge: boolean
    t: (key: string) => string
    onAction: (action: string, jobId?: string, postId?: string, extra?: Record<string, string>) => void
    onReject: (postId: string) => void
    onTogglePlatform: (ps: PlatformStatus) => void
    onEdit: (postId: string) => void
}) {
    const isImage = job.mediaItem.type === 'image' || job.mediaItem.type === 'photo'
    const hasApprovalStatus = job.post?.status === 'PENDING_APPROVAL' || job.post?.status === 'CLIENT_REVIEW'
    const isScheduled = columnKey === 'scheduled'
    const isFailed = columnKey === 'failed'
    const isRejected = columnKey === 'rejected'

    const getBadge = () => {
        if (isFailed) return { label: 'FAILED', cls: 'bg-red-500/15 text-red-400 border-red-500/30' }
        if (isRejected) return { label: 'REVISION', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' }
        if (job.post?.status === 'PENDING_APPROVAL') return { label: 'URGENT', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
        if (job.post?.status === 'CLIENT_REVIEW') return { label: 'REVIEW', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' }
        if (isScheduled) return null
        return { label: 'QUEUED', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' }
    }
    const badge = getBadge()

    // The latest rejection comment (if any)
    const rejectionComment = job.post?.approvals?.find(a => a.action === 'REJECTED' && a.comment)?.comment

    return (
        <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200">

            {/* Media */}
            {job.mediaItem.type === 'video' ? (
                <div className="w-full h-32 flex items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/30 relative">
                    <Video className="w-8 h-8 text-muted-foreground/40" />
                    {badge && <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${badge.cls}`}>{badge.label}</span>}
                </div>
            ) : job.mediaItem.thumbnailUrl || job.mediaItem.url ? (
                <div className="relative w-full h-36 overflow-hidden bg-muted">
                    <img src={job.mediaItem.thumbnailUrl || job.mediaItem.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    {badge && <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${badge.cls} backdrop-blur-sm`}>{badge.label}</span>}
                    {job.post?.platformStatuses && job.post.platformStatuses.length > 0 && (
                        <div className="absolute bottom-2 left-2 flex gap-1">
                            {job.post.platformStatuses.slice(0, 4).map(ps => {
                                const pCfg = PLATFORM_ICONS[ps.platform.toLowerCase()]
                                if (!pCfg) return null
                                const Icon = pCfg.icon
                                return (
                                    <button key={ps.id} onClick={() => onTogglePlatform(ps)}
                                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${ps.status !== 'skipped' ? `${pCfg.activeColor} bg-black/50` : `${pCfg.color} bg-black/30 opacity-40`} hover:scale-110 cursor-pointer`}>
                                        <Icon className="w-3 h-3" />
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full h-16 flex items-center justify-center bg-muted/30 relative">
                    {badge && <span className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${badge.cls}`}>{badge.label}</span>}
                </div>
            )}

            {/* Body */}
            <div className="p-3">
                <div className="flex items-start justify-between gap-1 mb-1.5">
                    <h3 className="text-[12px] font-semibold leading-snug line-clamp-2 flex-1">
                        {job.post?.content
                            ? job.post.content.split('\n')[0].slice(0, 80) || job.mediaItem.originalName
                            : job.mediaItem.originalName || t('smartflow.queue.media')}
                    </h3>
                    {job.post && (
                        <button onClick={() => onEdit(job.post!.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground shrink-0">
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Channel + scheduled time */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {showChannelBadge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium border border-primary/20 truncate max-w-[120px]">
                            {job.channel.displayName}
                        </span>
                    )}
                    {!showChannelBadge && (
                        <span className="text-[10px] text-muted-foreground">{job.channel.displayName}</span>
                    )}
                    {job.post?.scheduledAt && (
                        <span className="flex items-center gap-0.5 text-[10px] text-primary/70 ml-auto">
                            <CalendarCheck className="h-2.5 w-2.5" />
                            {new Date(job.post.scheduledAt).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>

                {/* Rejection comment */}
                {isRejected && rejectionComment && (
                    <div className="mb-2 flex items-start gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1.5">
                        <MessageSquare className="h-3 w-3 text-orange-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-orange-300/90 leading-snug line-clamp-3">{rejectionComment}</p>
                    </div>
                )}

                {/* Other approval comments */}
                {!isRejected && job.post?.approvals && job.post.approvals.some(a => a.comment) && (
                    <div className="mb-2 space-y-1">
                        {job.post.approvals.filter(a => a.comment).slice(0, 2).map((a, i) => (
                            <div key={i} className="flex items-start gap-1.5 bg-muted/30 rounded-lg px-2 py-1.5">
                                <div className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold ${a.action === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                    {a.action === 'APPROVED' ? '✓' : '!'}
                                </div>
                                <p className="text-[10px] text-muted-foreground/80 leading-snug line-clamp-2">{a.comment}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Error message */}
                {job.errorMessage && (
                    <div className="flex items-start gap-1 mb-2 text-[10px] text-red-400/80">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{job.errorMessage}</span>
                    </div>
                )}

                {/* Actions */}
                <div className={`flex gap-1.5 ${hasApprovalStatus || isRejected ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    {job.post?.status === 'PENDING_APPROVAL' && (
                        <button onClick={() => onAction('approve', undefined, job.post!.id)}
                            disabled={actionLoading === job.post.id}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-medium transition-all cursor-pointer">
                            {actionLoading === job.post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                            {t('smartflow.queue.approve')}
                        </button>
                    )}
                    {job.post?.status === 'CLIENT_REVIEW' && (
                        <button onClick={() => onAction('client_approve', undefined, job.post!.id)}
                            disabled={actionLoading === job.post.id}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-medium transition-all cursor-pointer">
                            {actionLoading === job.post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                            {t('smartflow.queue.approve')}
                        </button>
                    )}
                    {/* Rejected → re-queue button */}
                    {isRejected && job.post && (
                        <button onClick={() => onAction('requeue', undefined, job.post!.id)}
                            disabled={actionLoading === job.post.id}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[10px] font-medium transition-all cursor-pointer">
                            {actionLoading === job.post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            Đưa lại duyệt
                        </button>
                    )}
                    {/* Reject button (only for approval columns) */}
                    {job.post && hasApprovalStatus && (
                        <button onClick={() => onReject(job.post!.id)}
                            disabled={actionLoading === job.post.id}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-[10px] transition-all cursor-pointer">
                            <ThumbsDown className="h-3 w-3" />
                        </button>
                    )}
                    {job.status === 'FAILED' && (
                        <button onClick={() => onAction('retry', job.id)}
                            disabled={actionLoading === job.id}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[10px] font-medium transition-all cursor-pointer">
                            {actionLoading === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            {t('smartflow.queue.retry')}
                        </button>
                    )}
                    {(job.status === 'QUEUED' || job.status === 'PROCESSING') && (
                        <button onClick={() => onAction('cancel', job.id)}
                            disabled={actionLoading === job.id}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] transition-all cursor-pointer">
                            <XCircle className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
