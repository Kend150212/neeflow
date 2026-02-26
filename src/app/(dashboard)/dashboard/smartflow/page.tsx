'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
    Zap,
    RefreshCw,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RotateCcw,
    XCircle,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Image as ImageIcon,
    Video,
    Pencil,
    ThumbsUp,
    ThumbsDown,
    Globe,
} from 'lucide-react'

type ContentJob = {
    id: string
    status: string
    aiCaption: string | null
    errorMessage: string | null
    uploadedBy: string | null
    processedAt: string | null
    createdAt: string
    mediaItem: { url: string; thumbnailUrl: string | null; type: string; originalName: string | null }
    channel: { id: string; displayName: string }
    post: {
        id: string
        status: string
        scheduledAt: string | null
        content: string | null
        metadata: Record<string, unknown> | null
        platformStatuses: { platform: string; status: string }[]
    } | null
}

// Platform icons (simple SVG-like badges)
const PLATFORM_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    facebook: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'FB' },
    instagram: { bg: 'bg-pink-500/15', text: 'text-pink-400', label: 'IG' },
    tiktok: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', label: 'TT' },
    youtube: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'YT' },
    twitter: { bg: 'bg-sky-500/15', text: 'text-sky-400', label: 'X' },
    threads: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'TH' },
    linkedin: { bg: 'bg-blue-600/15', text: 'text-blue-300', label: 'LI' },
}

export default function SmartFlowPage() {
    const t = useTranslation()
    const { data: session } = useSession()
    const [jobs, setJobs] = useState<ContentJob[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Record<string, number>>({})
    const [filter, setFilter] = useState<string>('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [editingPost, setEditingPost] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

    const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
        QUEUED: { label: t('smartflow.queue.statusQueued'), icon: '⏳', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        PROCESSING: { label: t('smartflow.queue.statusProcessing'), icon: '🔄', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
        COMPLETED: { label: t('smartflow.queue.statusCompleted'), icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        FAILED: { label: t('smartflow.queue.statusFailed'), icon: '❌', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    }

    const POST_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
        PENDING_APPROVAL: { label: t('smartflow.queue.statusPendingApproval'), color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
        CLIENT_REVIEW: { label: t('smartflow.queue.statusClientReview'), color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
        SCHEDULED: { label: t('smartflow.queue.statusScheduled'), color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    }

    const fetchJobs = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (filter) params.set('status', filter)
            params.set('page', String(page))
            params.set('limit', '20')

            const res = await fetch(`/api/admin/content-pipeline?${params}`)
            if (res.ok) {
                const data = await res.json()
                setJobs(data.jobs)
                setTotal(data.total)
                setStats(data.stats || {})
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [filter, page])

    useEffect(() => { fetchJobs() }, [fetchJobs])

    // Auto-refresh
    useEffect(() => {
        const interval = setInterval(fetchJobs, 15000)
        return () => clearInterval(interval)
    }, [fetchJobs])

    const handleAction = async (action: string, jobId?: string, postId?: string) => {
        setActionLoading(jobId || postId || 'all')
        try {
            const res = await fetch('/api/admin/content-pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, jobId, postId }),
            })
            if (res.ok) {
                const messages: Record<string, string> = {
                    retry: t('smartflow.queue.retried'),
                    cancel: t('smartflow.queue.cancelled'),
                    retry_all_failed: t('smartflow.queue.retried'),
                    approve: t('smartflow.queue.approved'),
                    reject: t('smartflow.queue.rejected'),
                    client_approve: t('smartflow.queue.approved'),
                }
                toast.success(messages[action] || '✅')
                fetchJobs()
            } else {
                toast.error(t('smartflow.queue.actionFailed'))
            }
        } catch {
            toast.error(t('smartflow.queue.actionFailed'))
        }
        setActionLoading(null)
    }

    const handleEditSave = async (postId: string) => {
        try {
            // Save edit via API — using direct post update
            const res = await fetch(`/api/admin/posts/${postId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editContent }),
            })
            if (res.ok) {
                toast.success(t('smartflow.configSaved'))
                setEditingPost(null)
                fetchJobs()
            }
        } catch {
            toast.error(t('smartflow.queue.actionFailed'))
        }
    }

    const totalPages = Math.ceil(total / 20)

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Zap className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">{t('smartflow.queue.title')}</h1>
                            <p className="text-sm text-white/40">{t('smartflow.queue.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {(stats['FAILED'] || 0) > 0 && (
                            <button
                                onClick={() => handleAction('retry_all_failed')}
                                disabled={actionLoading === 'all'}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all"
                            >
                                <RotateCcw className="h-3 w-3" />
                                {t('smartflow.queue.retryAllFailed')} ({stats['FAILED']})
                            </button>
                        )}
                        <button
                            onClick={fetchJobs}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] text-white/60 rounded-lg text-xs hover:bg-white/[0.06] transition-all"
                        >
                            <RefreshCw className="h-3 w-3" />
                            {t('smartflow.queue.refresh')}
                        </button>
                    </div>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                        <button
                            key={status}
                            onClick={() => setFilter(filter === status ? '' : status)}
                            className={`${cfg.bg} border rounded-xl px-4 py-3 text-left transition-all hover:scale-[1.02] ${filter === status ? 'ring-1 ring-white/20' : ''}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-lg">{cfg.icon}</span>
                                <span className={`text-2xl font-bold ${cfg.color}`}>{stats[status] || 0}</span>
                            </div>
                            <p className={`text-xs ${cfg.color} opacity-60`}>{cfg.label}</p>
                        </button>
                    ))}
                </div>

                {/* Filter bar */}
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="h-4 w-4 text-white/30" />
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => setFilter('')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${!filter ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                        >
                            {t('smartflow.queue.all')}
                        </button>
                        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                            <button
                                key={status}
                                onClick={() => setFilter(filter === status ? '' : status)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${filter === status ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                            >
                                {cfg.icon} {cfg.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Jobs list */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="text-center py-20 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                        <Zap className="h-8 w-8 text-white/10 mx-auto mb-3" />
                        <p className="text-white/30 text-sm">{t('smartflow.queue.empty')}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {jobs.map(job => {
                            const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.QUEUED
                            const postStatus = job.post?.status ? POST_STATUS_CONFIG[job.post.status] : null
                            const isEditing = editingPost === job.post?.id

                            return (
                                <div
                                    key={job.id}
                                    className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 hover:bg-white/[0.03] transition-all"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Media thumbnail */}
                                        <div className="w-16 h-16 rounded-lg bg-black/50 overflow-hidden shrink-0">
                                            {job.mediaItem.type === 'video' ? (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
                                                    <Video className="w-5 h-5 text-white/30" />
                                                </div>
                                            ) : (
                                                <img
                                                    src={job.mediaItem.thumbnailUrl || job.mediaItem.url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-sm font-medium truncate">
                                                    {job.mediaItem.originalName || 'Media'}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color} border`}>
                                                    {cfg.icon} {cfg.label}
                                                </span>
                                                {postStatus && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${postStatus.bg} ${postStatus.color} border`}>
                                                        {postStatus.label}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-white/20 ml-auto shrink-0">
                                                    {job.channel.displayName}
                                                </span>
                                            </div>

                                            {/* Inline content editor */}
                                            {isEditing ? (
                                                <div className="flex gap-2 mb-2">
                                                    <textarea
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        rows={3}
                                                        className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 resize-none focus:outline-none focus:border-indigo-500/50"
                                                    />
                                                    <div className="flex flex-col gap-1">
                                                        <button
                                                            onClick={() => handleEditSave(job.post!.id)}
                                                            className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-medium hover:bg-emerald-500/30"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingPost(null)}
                                                            className="px-2.5 py-1 bg-white/5 text-white/40 rounded-lg text-[10px] hover:bg-white/10"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : job.post?.content ? (
                                                <p className="text-xs text-white/40 line-clamp-2 mb-1">{job.post.content}</p>
                                            ) : null}

                                            {job.errorMessage && (
                                                <p className="text-xs text-red-400/80 line-clamp-1 mb-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                                    {job.errorMessage}
                                                </p>
                                            )}

                                            {/* Platform badges */}
                                            {job.post?.platformStatuses && job.post.platformStatuses.length > 0 && (
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    <Globe className="h-3 w-3 text-white/20" />
                                                    {job.post.platformStatuses.map(ps => {
                                                        const pCfg = PLATFORM_COLORS[ps.platform.toLowerCase()] || { bg: 'bg-white/5', text: 'text-white/40', label: ps.platform }
                                                        return (
                                                            <span
                                                                key={ps.platform}
                                                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${pCfg.bg} ${pCfg.text} border border-transparent`}
                                                            >
                                                                {pCfg.label}
                                                            </span>
                                                        )
                                                    })}
                                                    {/* Show media dimensions if available */}
                                                    {(() => {
                                                        const meta = job.post?.metadata as Record<string, Record<string, number>> | null
                                                        if (!meta?.mediaDimensions) return null
                                                        return (
                                                            <span className="text-[10px] text-white/15 ml-1">
                                                                {String(meta.mediaDimensions.width)}×{String(meta.mediaDimensions.height)}
                                                            </span>
                                                        )
                                                    })()}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 text-[10px] text-white/20">
                                                <span>📤 {job.uploadedBy || 'unknown'}</span>
                                                <span>📅 {new Date(job.createdAt).toLocaleDateString('vi-VN', {
                                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                                })}</span>
                                                {job.post?.scheduledAt && (
                                                    <span className="text-blue-400/50">
                                                        🗓️ {new Date(job.post.scheduledAt).toLocaleDateString('vi-VN', {
                                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1.5 shrink-0">
                                            {/* Edit button */}
                                            {job.post && (job.post.status === 'PENDING_APPROVAL' || job.post.status === 'CLIENT_REVIEW') && (
                                                <button
                                                    onClick={() => {
                                                        setEditingPost(job.post!.id)
                                                        setEditContent(job.post!.content || '')
                                                    }}
                                                    className="p-1.5 rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition-all"
                                                    title={t('smartflow.queue.editPost')}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            )}

                                            {/* Approve button */}
                                            {job.post && job.post.status === 'PENDING_APPROVAL' && (
                                                <button
                                                    onClick={() => handleAction('approve', undefined, job.post!.id)}
                                                    disabled={actionLoading === job.post.id}
                                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                                    title={t('smartflow.queue.approve')}
                                                >
                                                    {actionLoading === job.post.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <ThumbsUp className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            )}

                                            {/* Reject button */}
                                            {job.post && (job.post.status === 'PENDING_APPROVAL' || job.post.status === 'CLIENT_REVIEW') && (
                                                <button
                                                    onClick={() => handleAction('reject', undefined, job.post!.id)}
                                                    disabled={actionLoading === job.post.id}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                                                    title={t('smartflow.queue.reject')}
                                                >
                                                    <ThumbsDown className="h-3.5 w-3.5" />
                                                </button>
                                            )}

                                            {/* Retry failed */}
                                            {job.status === 'FAILED' && (
                                                <button
                                                    onClick={() => handleAction('retry', job.id)}
                                                    disabled={actionLoading === job.id}
                                                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                                                    title={t('smartflow.queue.retry')}
                                                >
                                                    {actionLoading === job.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            )}

                                            {/* Cancel queued/processing */}
                                            {(job.status === 'QUEUED' || job.status === 'PROCESSING') && (
                                                <button
                                                    onClick={() => handleAction('cancel', job.id)}
                                                    disabled={actionLoading === job.id}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                                                    title={t('smartflow.queue.cancel')}
                                                >
                                                    <XCircle className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-6">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-xs text-white/30">
                            {t('smartflow.queue.page').replace('{page}', String(page)).replace('{total}', String(totalPages))}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-1.5 rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] disabled:opacity-30 transition-all"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
