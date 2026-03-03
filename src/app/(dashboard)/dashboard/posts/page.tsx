'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import {
    Plus, Search, PenSquare, Trash2, Copy, MoreHorizontal,
    Calendar, CheckCircle2, XCircle, Send, FileEdit, Loader2,
    Filter, Eye, Clock, CheckSquare, Square, CalendarClock,
    ChevronDown, BarChart2, Eye as EyeIcon, Heart, MessageCircle, Share2,
    LayoutList, LayoutGrid, Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { PlatformIcon } from '@/components/platform-icons'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────

interface Channel { id: string; displayName: string }
interface PostMedia {
    mediaItem: { id: string; url: string; thumbnailUrl: string | null; type: string; originalName: string | null }
}
interface PlatformStatus { platform: string; status: string }
interface Post {
    id: string; content: string | null; status: string
    scheduledAt: string | null; publishedAt: string | null; createdAt: string
    channel: { id: string; displayName: string; name: string }
    author: { id: string; name: string | null; email: string }
    media: PostMedia[]; platformStatuses: PlatformStatus[]
    _count: { approvals: number }
    metadata?: Record<string, string> | null
}

// Source badge — auto-detects integration source from post.metadata
function SourceBadge({ metadata }: { metadata?: Record<string, string> | null }) {
    if (!metadata?.source) return null
    const sourceMap: Record<string, { label: string; color: string; icon: string }> = {
        external_db: { label: 'MySQL', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: '🗄️' },
        shopify: { label: 'Shopify', color: 'text-green-400  bg-green-500/10  border-green-500/20', icon: '🛍️' },
        wordpress: { label: 'WordPress', color: 'text-sky-400    bg-sky-500/10    border-sky-500/20', icon: '📝' },
        woocommerce: { label: 'WooCommerce', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: '🛒' },
        google_sheets: { label: 'Sheets', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: '📊' },
    }
    const cfg = sourceMap[metadata.source]
    if (!cfg) return null
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.color}`}>
            <span>{cfg.icon}</span>{cfg.label}
        </span>
    )
}

interface PlatformStat {
    platform: string; views: number | null; likes: number | null
    comments: number | null; shares: number | null; status: string
}

// ─── Status Config ──────────────────────────────────

const statusConfig: Record<string, {
    label: string; color: string; textColor: string; bgColor: string; icon: typeof CheckCircle2
    badgeBg: string; badgeText: string; badgeBorder: string
}> = {
    DRAFT: { label: 'Draft', color: 'bg-slate-400', textColor: 'text-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-900/20', icon: FileEdit, badgeBg: 'bg-slate-500/20', badgeText: 'text-slate-400', badgeBorder: 'border-slate-500/30' },
    PENDING_APPROVAL: { label: 'Pending', color: 'bg-amber-400', textColor: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20', icon: Clock, badgeBg: 'bg-amber-500/20', badgeText: 'text-amber-400', badgeBorder: 'border-amber-500/30' },
    APPROVED: { label: 'Approved', color: 'bg-teal-500', textColor: 'text-teal-600', bgColor: 'bg-teal-50 dark:bg-teal-900/20', icon: CheckCircle2, badgeBg: 'bg-teal-500/20', badgeText: 'text-teal-400', badgeBorder: 'border-teal-500/30' },
    REJECTED: { label: 'Rejected', color: 'bg-red-400', textColor: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/20', icon: XCircle, badgeBg: 'bg-red-500/20', badgeText: 'text-red-400', badgeBorder: 'border-red-500/30' },
    SCHEDULED: { label: 'Scheduled', color: 'bg-blue-500', textColor: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20', icon: CalendarClock, badgeBg: 'bg-primary/20', badgeText: 'text-primary', badgeBorder: 'border-primary/30' },
    PUBLISHING: { label: 'Publishing', color: 'bg-violet-500', textColor: 'text-violet-600', bgColor: 'bg-violet-50 dark:bg-violet-900/20', icon: Send, badgeBg: 'bg-violet-500/20', badgeText: 'text-violet-400', badgeBorder: 'border-violet-500/30' },
    PUBLISHED: { label: 'Published', color: 'bg-emerald-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2, badgeBg: 'bg-emerald-500/20', badgeText: 'text-emerald-400', badgeBorder: 'border-emerald-500/30' },
    FAILED: { label: 'Failed', color: 'bg-rose-600', textColor: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-900/20', icon: XCircle, badgeBg: 'bg-red-500/20', badgeText: 'text-red-400', badgeBorder: 'border-red-500/30' },
}

function formatDate(d: string) {
    return new Date(d).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
}
function formatTime(d: string) {
    return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function formatDateLabel(d: string) {
    const date = new Date(d)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const dateOnly = new Date(date); dateOnly.setHours(0, 0, 0, 0)
    if (dateOnly.getTime() === today.getTime()) return 'Today, ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow, ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday, ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}
function truncate(text: string | null, len: number) {
    if (!text) return '—'
    return text.length > len ? text.slice(0, len) + '…' : text
}
function getDateKey(post: Post) {
    const d = post.scheduledAt || post.publishedAt || post.createdAt
    const date = new Date(d); date.setHours(0, 0, 0, 0)
    return date.toISOString()
}

// ─── Analytics mini row ─────────────────────────────

function StatVal({ icon: Icon, value, label }: { icon: typeof EyeIcon; value: number | null; label: string }) {
    return (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon className="h-3 w-3" />
            <span>{value !== null ? value.toLocaleString() : '—'}</span>
            <span className="text-muted-foreground/50">{label}</span>
        </div>
    )
}

function AnalyticsRow({ postId }: { postId: string }) {
    const [stats, setStats] = useState<PlatformStat[] | null>(null)
    const [loading, setLoading] = useState(true)
    const fetched = useRef(false)

    useEffect(() => {
        if (fetched.current) return
        fetched.current = true
        fetch(`/api/admin/posts/${postId}/stats`)
            .then(r => r.json())
            .then(d => setStats(d.stats || []))
            .catch(() => setStats([]))
            .finally(() => setLoading(false))
    }, [postId])

    const totals = useMemo(() => {
        if (!stats) return null
        return {
            views: stats.some(s => s.views !== null) ? stats.reduce((a, s) => a + (s.views || 0), 0) : null,
            likes: stats.some(s => s.likes !== null) ? stats.reduce((a, s) => a + (s.likes || 0), 0) : null,
            comments: stats.some(s => s.comments !== null) ? stats.reduce((a, s) => a + (s.comments || 0), 0) : null,
            shares: stats.some(s => s.shares !== null) ? stats.reduce((a, s) => a + (s.shares || 0), 0) : null,
        }
    }, [stats])

    if (loading) return <div className="py-2 text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Loading stats...</div>
    if (!totals || (totals.views === null && totals.likes === null)) {
        return <p className="py-1 text-xs text-muted-foreground/60 italic">No analytics data available yet.</p>
    }
    return (
        <div className="flex items-center gap-4 py-1.5 flex-wrap">
            <StatVal icon={EyeIcon} value={totals.views} label="views" />
            <StatVal icon={Heart} value={totals.likes} label="likes" />
            <StatVal icon={MessageCircle} value={totals.comments} label="comments" />
            <StatVal icon={Share2} value={totals.shares} label="shares" />
        </div>
    )
}

// ─── Queue Card ──────────────────────────────────────

function QueueCard({ post, selected, onSelect, onEdit, onDelete, onDuplicate, analyticsOpen, onToggleAnalytics }: {
    post: Post
    selected: boolean
    onSelect: () => void
    onEdit: () => void
    onDelete: () => void
    onDuplicate: () => void
    analyticsOpen: boolean
    onToggleAnalytics: () => void
}) {
    const sc = statusConfig[post.status] || statusConfig.DRAFT
    const platforms = [...new Set(post.platformStatuses.map(ps => ps.platform))]
    const isPublished = post.status === 'PUBLISHED'
    const timeSource = post.scheduledAt || post.publishedAt || post.createdAt
    const isVideo = post.media[0]?.mediaItem.type?.startsWith('video/')
    const mediaUrl = post.media[0]?.mediaItem.thumbnailUrl || post.media[0]?.mediaItem.url

    return (
        <div
            className={cn(
                'group relative bg-card/80 border rounded-xl p-4 flex gap-4 transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(25,230,94,0.06)]',
                selected ? 'border-primary/50 bg-primary/5 shadow-[0_0_16px_rgba(25,230,94,0.08)]' : 'border-border/60',
            )}
        >
            {/* Checkbox */}
            <button
                onClick={e => { e.stopPropagation(); onSelect() }}
                className="absolute top-3 left-3 z-10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {selected
                    ? <CheckSquare className="h-4 w-4 text-primary" />
                    : <Square className="h-4 w-4 text-muted-foreground/60" />}
            </button>

            {/* Media Thumbnail */}
            <div
                className="w-40 h-36 flex-shrink-0 rounded-lg overflow-hidden relative bg-muted/50 border border-border/40 cursor-pointer"
                onClick={onEdit}
            >
                {mediaUrl ? (
                    <>
                        <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                        {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play className="h-8 w-8 text-white/90 fill-white/90" />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <PenSquare className="h-8 w-8 text-muted-foreground/20" />
                    </div>
                )}
                {/* Platform icons overlay */}
                {platforms.length > 0 && (
                    <div className="absolute top-1.5 left-1.5 flex gap-1">
                        {platforms.map(p => (
                            <div key={p} className="h-5 w-5 rounded bg-background/80 backdrop-blur-sm flex items-center justify-center">
                                <PlatformIcon platform={p} size="sm" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col cursor-pointer" onClick={onEdit}>
                {/* Time + Badges row */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {timeSource && (
                            <span className="text-base font-bold tabular-nums">{formatTime(timeSource)}</span>
                        )}
                        <span className={cn(
                            'px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border',
                            sc.badgeBg, sc.badgeText, sc.badgeBorder
                        )}>
                            {sc.label}
                        </span>
                        {/* Platform icons — shown after status badge */}
                        {platforms.length > 0 && (
                            <div className="flex items-center gap-1">
                                {platforms.map(p => (
                                    <div key={p} className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center">
                                        <PlatformIcon platform={p} size="sm" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Actions — always visible */}
                    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={onEdit}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            title="View / Edit"
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={onDuplicate}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            title="Duplicate"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                            title="Delete"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {/* Caption */}
                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3 flex-1 mb-3">
                    {post.content || <span className="text-muted-foreground/50 italic">No caption</span>}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-border/40 mt-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{post.channel.displayName}</span>
                        <SourceBadge metadata={post.metadata} />
                        {post.scheduledAt && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-500 dark:text-blue-400">
                                <Calendar className="h-2.5 w-2.5" />
                                {formatDate(post.scheduledAt)}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isPublished && (
                            <button
                                onClick={e => { e.stopPropagation(); onToggleAnalytics() }}
                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                <BarChart2 className="h-3 w-3" />
                                Stats
                                <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', analyticsOpen && 'rotate-180')} />
                            </button>
                        )}
                        <span className="text-[10px] text-muted-foreground/60">
                            {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Analytics (full width below) */}
            {analyticsOpen && (
                <div className="absolute left-0 right-0 bottom-0 translate-y-full z-10 px-4 py-2 border border-t-0 border-border/60 bg-card rounded-b-xl">
                    <AnalyticsRow postId={post.id} />
                </div>
            )}
        </div>
    )
}

// ─── Page ────────────────────────────────────────────

export default function PostsPage() {
    const t = useTranslation()
    const router = useRouter()

    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterChannel, setFilterChannel] = useState<string>('__init__')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [viewMode, setViewMode] = useState<'list' | 'queue'>('queue')

    // Workspace context
    const { activeChannelId, channels } = useWorkspace()

    // Sync filterChannel with workspace on mount + when workspace changes
    useEffect(() => {
        setFilterChannel(activeChannelId ?? 'all')
        setPage(1)
    }, [activeChannelId])

    // Don't fetch until workspace has resolved
    const filterReady = filterChannel !== '__init__'

    // Bulk selection
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Post | null>(null)
    const [bulkDeleting, setBulkDeleting] = useState(false)

    // Bulk reschedule
    const [rescheduleOpen, setRescheduleOpen] = useState(false)
    const [rescheduleDate, setRescheduleDate] = useState('')
    const [rescheduleTime, setRescheduleTime] = useState('')
    const [rescheduling, setRescheduling] = useState(false)

    // Analytics expand
    const [expandedAnalytics, setExpandedAnalytics] = useState<Set<string>>(new Set())

    const allSelected = useMemo(
        () => posts.length > 0 && posts.every(p => selected.has(p.id)),
        [posts, selected]
    )

    const fetchPosts = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' })
            if (filterChannel !== 'all') params.set('channelId', filterChannel)
            if (filterStatus !== 'all') params.set('status', filterStatus)
            if (search.trim()) params.set('search', search.trim())
            const res = await fetch(`/api/admin/posts?${params}`)
            const data = await res.json()
            setPosts(data.posts || [])
            setTotalPages(data.pagination?.totalPages || 1)
            setTotal(data.pagination?.total || 0)
        } catch { toast.error('Failed to load posts') }
        finally { setLoading(false) }
    }, [page, filterChannel, filterStatus, search])

    useEffect(() => { if (filterReady) fetchPosts() }, [fetchPosts, filterReady])
    useEffect(() => { setSelected(new Set()) }, [page, filterChannel, filterStatus])

    const toggleSelect = (id: string) => {
        setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }
    const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(posts.map(p => p.id)))
    const toggleAnalytics = (id: string) => {
        setExpandedAnalytics(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }

    // Single delete
    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            await fetch(`/api/admin/posts/${deleteTarget.id}`, { method: 'DELETE' })
            toast.success('Post deleted'); fetchPosts()
        } catch { toast.error('Failed to delete post') }
        finally { setDeleteTarget(null) }
    }

    // Bulk delete
    const handleBulkDelete = async () => {
        setBulkDeleting(true)
        try {
            const res = await fetch('/api/admin/posts/bulk', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [...selected] }),
            })
            const data = res.ok ? await res.json() : {}
            toast.success(`Deleted ${data.deleted ?? selected.size} post(s)`)
            setSelected(new Set()); fetchPosts()
        } catch { toast.error('Bulk delete failed') }
        finally { setBulkDeleting(false); setBulkDeleteOpen(false) }
    }

    // Bulk reschedule
    const handleBulkReschedule = async () => {
        if (!rescheduleDate || !rescheduleTime) { toast.error('Please pick a date and time'); return }
        setRescheduling(true)
        try {
            const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString()
            const res = await fetch('/api/admin/posts/bulk', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [...selected], scheduledAt }),
            })
            const data = res.ok ? await res.json() : {}
            toast.success(`Rescheduled ${data.updated ?? selected.size} post(s)`)
            setRescheduleOpen(false); setSelected(new Set()); fetchPosts()
        } catch { toast.error('Reschedule failed') }
        finally { setRescheduling(false) }
    }

    // Duplicate
    const handleDuplicate = async (post: Post) => {
        try {
            await fetch('/api/admin/posts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: post.channel.id, content: post.content, status: 'DRAFT', mediaIds: post.media.map(m => m.mediaItem.id) }),
            })
            toast.success('Post duplicated as draft'); fetchPosts()
        } catch { toast.error('Failed to duplicate') }
    }

    // Group posts by date for queue view
    const groupedPosts = useMemo(() => {
        if (viewMode !== 'queue') return null
        const groups: { dateKey: string; label: string; posts: Post[] }[] = []
        const map = new Map<string, Post[]>()
        for (const post of posts) {
            const key = getDateKey(post)
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(post)
        }
        for (const [key, groupPosts] of map.entries()) {
            const d = groupPosts[0].scheduledAt || groupPosts[0].publishedAt || groupPosts[0].createdAt
            groups.push({ dateKey: key, label: formatDateLabel(d), posts: groupPosts })
        }
        return groups
    }, [posts, viewMode])

    // ─── Real-time publish status polling ────────────────────────────────────
    // Track previous post statuses to detect PUBLISHING → PUBLISHED/FAILED transitions
    const prevPostsRef = useRef<Map<string, string>>(new Map())

    useEffect(() => {
        // Compare new posts against previous to fire toasts
        const prev = prevPostsRef.current
        for (const post of posts) {
            const prevStatus = prev.get(post.id)
            if (prevStatus === 'PUBLISHING') {
                const platforms = [...new Set(post.platformStatuses.map(ps => ps.platform))].join(', ')
                if (post.status === 'PUBLISHED') {
                    toast.success(`Published successfully${platforms ? ` · ${platforms}` : ''}`, {
                        description: post.content ? post.content.slice(0, 60) + (post.content.length > 60 ? '…' : '') : undefined,
                    })
                } else if (post.status === 'FAILED') {
                    toast.error(`Publish failed${platforms ? ` · ${platforms}` : ''}`, {
                        description: 'Check post details for more info.',
                    })
                }
            }
        }
        // Update ref with current statuses
        prevPostsRef.current = new Map(posts.map(p => [p.id, p.status]))
    }, [posts])

    useEffect(() => {
        const hasPublishing = posts.some(p => p.status === 'PUBLISHING')
        if (!hasPublishing) return
        // Poll every 4 seconds while any post is PUBLISHING
        const interval = setInterval(() => { fetchPosts() }, 4000)
        return () => clearInterval(interval)
    }, [posts, fetchPosts])
    // ─────────────────────────────────────────────────────────────────────────

    // Count scheduled for today
    const todayScheduledCount = useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
        return posts.filter(p => {
            if (!p.scheduledAt) return false
            const d = new Date(p.scheduledAt)
            return d >= today && d < tomorrow
        }).length
    }, [posts])

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                            <PenSquare className="h-5 w-5 sm:h-6 sm:w-6" />{t('nav.posts') || 'Posts'}
                        </h1>
                        {todayScheduledCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-full border border-primary/20">
                                <Calendar className="h-3 w-3 text-primary" />
                                <span className="text-xs font-bold text-primary">{todayScheduledCount} going out today</span>
                            </div>
                        )}
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">{total} post{total !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center rounded-lg border border-border/60 bg-card/80 p-0.5">
                        <button
                            onClick={() => setViewMode('queue')}
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
                                viewMode === 'queue'
                                    ? 'bg-primary/15 text-primary shadow-sm border border-primary/20'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />Queue
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
                                viewMode === 'list'
                                    ? 'bg-primary/15 text-primary shadow-sm border border-primary/20'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <LayoutList className="h-3.5 w-3.5" />List
                        </button>
                    </div>
                    <Button onClick={() => router.push('/dashboard/posts/compose')} className="cursor-pointer">
                        <Plus className="h-4 w-4 mr-2" />New Post
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search posts..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1) }} className="pl-10 h-9" />
                </div>
                <Select value={filterChannel} onValueChange={v => { setFilterChannel(v); setPage(1) }}>
                    <SelectTrigger className="w-full sm:w-[180px] h-9">
                        <Filter className="h-4 w-4 mr-2 shrink-0" /><SelectValue placeholder="All Channels" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Channels</SelectItem>
                        {channels.map(ch => <SelectItem key={ch.id} value={ch.id}>{ch.displayName}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1) }}>
                    <SelectTrigger className="w-full sm:w-[160px] h-9"><SelectValue placeholder="All Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {Object.entries(statusConfig).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                    <span className={cn('w-2 h-2 rounded-full', cfg.color)} />{cfg.label}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Bulk toolbar */}
            {selected.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-card shadow-sm">
                    <span className="text-sm font-medium">{selected.size} selected</span>
                    <div className="ml-auto flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}
                            className="cursor-pointer h-8 text-xs">Clear</Button>
                        <Button variant="outline" size="sm"
                            className="cursor-pointer h-8 text-xs gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            onClick={() => setRescheduleOpen(true)}>
                            <CalendarClock className="h-3.5 w-3.5" />Reschedule
                        </Button>
                        <Button variant="destructive" size="sm"
                            className="cursor-pointer h-8 text-xs gap-1.5"
                            onClick={() => setBulkDeleteOpen(true)}>
                            <Trash2 className="h-3.5 w-3.5" />Delete {selected.size}
                        </Button>
                    </div>
                </div>
            )}

            {/* Posts Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <PenSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-semibold mb-1">No posts yet</p>
                    <p className="text-sm text-muted-foreground mb-4">Create your first post to get started</p>
                    <Button onClick={() => router.push('/dashboard/posts/compose')} className="cursor-pointer">
                        <Plus className="h-4 w-4 mr-2" />Create Post
                    </Button>
                </div>
            ) : viewMode === 'queue' ? (
                /* ── Queue View ── */
                <div className="space-y-8">
                    {/* Select all */}
                    <div className="flex items-center justify-between">
                        <button onClick={toggleAll}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                            Select all
                        </button>
                        <span className="text-xs text-muted-foreground">{posts.length} posts</span>
                    </div>

                    {groupedPosts!.map(group => (
                        <section key={group.dateKey}>
                            {/* Date divider */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 whitespace-nowrap">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                    <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        {group.label}
                                    </h3>
                                </div>
                                <div className="flex-1 h-px bg-emerald-500/20" />
                                <span className="text-[10px] font-semibold text-emerald-600/70 dark:text-emerald-400/60 whitespace-nowrap">{group.posts.length} post{group.posts.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="space-y-3">
                                {group.posts.map(post => (
                                    <QueueCard
                                        key={post.id}
                                        post={post}
                                        selected={selected.has(post.id)}
                                        onSelect={() => toggleSelect(post.id)}
                                        onEdit={() => router.push(`/dashboard/posts/${post.id}`)}
                                        onDelete={() => setDeleteTarget(post)}
                                        onDuplicate={() => handleDuplicate(post)}
                                        analyticsOpen={expandedAnalytics.has(post.id)}
                                        onToggleAnalytics={() => toggleAnalytics(post.id)}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                /* ── List View (original) ── */
                <div className="rounded-xl border overflow-hidden">
                    {/* Select-all header */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
                        <button onClick={toggleAll}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                            Select all
                        </button>
                        <span className="text-xs text-muted-foreground ml-auto">{posts.length} posts</span>
                    </div>

                    {posts.map((post, idx) => {
                        const sc = statusConfig[post.status] || statusConfig.DRAFT
                        const StatusIcon = sc.icon
                        const isSelected = selected.has(post.id)
                        const platforms = [...new Set(post.platformStatuses.map(ps => ps.platform))]
                        const analyticsOpen = expandedAnalytics.has(post.id)
                        const isPublished = post.status === 'PUBLISHED'

                        return (
                            <div key={post.id}
                                className={cn('border-b last:border-b-0 transition-colors group',
                                    isSelected && 'bg-primary/5', idx % 2 !== 0 && 'bg-muted/10')}>
                                <div className="flex items-start gap-3 px-4 py-3 hover:bg-primary/5">
                                    {/* Checkbox */}
                                    <button onClick={e => { e.stopPropagation(); toggleSelect(post.id) }}
                                        className="mt-1 shrink-0 cursor-pointer">
                                        {isSelected ? <CheckSquare className="h-4 w-4 text-primary" />
                                            : <Square className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />}
                                    </button>

                                    {/* Status bar */}
                                    <div className={cn('w-1 self-stretch rounded-full shrink-0 mt-0.5', sc.color)} />

                                    {/* Thumbnail */}
                                    <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0 cursor-pointer"
                                        onClick={() => router.push(`/dashboard/posts/${post.id}`)}>
                                        {post.media.length > 0 ? (
                                            <img src={post.media[0].mediaItem.thumbnailUrl || post.media[0].mediaItem.url}
                                                alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center">
                                                <PenSquare className="h-5 w-5 text-muted-foreground/30" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 cursor-pointer"
                                        onClick={() => router.push(`/dashboard/posts/${post.id}`)}>
                                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                            <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded',
                                                sc.textColor, sc.bgColor)}>
                                                <StatusIcon className="h-3 w-3" />{sc.label}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{post.channel.displayName}</span>
                                            <SourceBadge metadata={post.metadata} />
                                            {post.media.length > 0 && (
                                                <span className="text-xs text-muted-foreground">📎 {post.media.length}</span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium leading-snug line-clamp-1">
                                            {truncate(post.content, 120)}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                            <span className="text-[11px] text-muted-foreground">{formatDate(post.createdAt)}</span>
                                            {post.scheduledAt && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                                    <Calendar className="h-3 w-3" />{formatDate(post.scheduledAt)}
                                                </span>
                                            )}
                                            <div className="flex items-center gap-1">
                                                {platforms.map(p => <PlatformIcon key={p} platform={p} size="sm" />)}
                                            </div>
                                            {isPublished && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); toggleAnalytics(post.id) }}
                                                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1"
                                                >
                                                    <BarChart2 className="h-3 w-3" />
                                                    Analytics
                                                    <ChevronDown className={cn('h-3 w-3 transition-transform', analyticsOpen && 'rotate-180')} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon"
                                                className="h-8 w-8 shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={e => { e.stopPropagation(); router.push(`/dashboard/posts/${post.id}`) }} className="cursor-pointer">
                                                <Eye className="h-4 w-4 mr-2" />View / Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDuplicate(post) }} className="cursor-pointer">
                                                <Copy className="h-4 w-4 mr-2" />Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={e => { e.stopPropagation(); setDeleteTarget(post) }}
                                                className="cursor-pointer text-destructive">
                                                <Trash2 className="h-4 w-4 mr-2" />Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Analytics expand */}
                                {analyticsOpen && (
                                    <div className="px-12 pb-3 border-t bg-muted/20">
                                        <AnalyticsRow postId={post.id} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="cursor-pointer">Previous</Button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="cursor-pointer">Next</Button>
                </div>
            )}

            {/* Single delete dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete this post. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk delete dialog */}
            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selected.size} Post{selected.size > 1 ? 's' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete {selected.size} selected posts. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer" disabled={bulkDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer">
                            {bulkDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk reschedule dialog */}
            <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarClock className="h-5 w-5 text-blue-600" />
                            Reschedule {selected.size} Post{selected.size > 1 ? 's' : ''}
                        </DialogTitle>
                        <DialogDescription>Choose a new date and time for the selected posts.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                            <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Time</label>
                            <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRescheduleOpen(false)} disabled={rescheduling} className="cursor-pointer">Cancel</Button>
                        <Button onClick={handleBulkReschedule} disabled={rescheduling || !rescheduleDate || !rescheduleTime}
                            className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white">
                            {rescheduling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Reschedule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
