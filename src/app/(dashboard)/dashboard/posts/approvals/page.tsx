'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import { useWorkspace } from '@/lib/workspace-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { PlatformIcon } from '@/components/platform-icons'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────

interface PlatformStatus { platform: string; status: string }
interface PostMedia { mediaItem: { url: string; thumbnailUrl: string | null } }
interface ApprovalPost {
    id: string
    content: string | null
    createdAt: string
    channel: { displayName: string }
    author: { name: string | null; email: string }
    media: PostMedia[]
    platformStatuses: PlatformStatus[]
    _count: { approvals: number }
}

// ─── Inline SVG Icons ────────────────────────────────────────────

function CheckCircleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    )
}

function XCircleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    )
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    )
}

function SearchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
    )
}

function RefreshIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.356v4.992" />
        </svg>
    )
}

function DocIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
    )
}

function ChevronRightIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
    )
}

function SpinnerIcon({ className }: { className?: string }) {
    return (
        <svg className={cn('animate-spin', className)} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    )
}

function CalendarIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
    )
}

// ─── Helpers ─────────────────────────────────────────────────────

function toDateKey(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateLabel(dateKey: string, locale: string): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dt = new Date(date)
    dt.setHours(0, 0, 0, 0)

    const dayName = date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long' })
    const formatted = date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'long' })
    const label = `${dayName}, ${formatted}`

    if (dt.getTime() === today.getTime()) return `${label} — ${locale === 'vi' ? 'Hôm nay' : 'Today'}`
    return label
}

type DatePreset = 'today' | 'week' | 'month' | 'all'

function matchesDatePreset(dateStr: string, preset: DatePreset): boolean {
    if (preset === 'all') return true
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (preset === 'today') return d.getTime() === today.getTime()
    if (preset === 'week') {
        const weekEnd = new Date(today)
        weekEnd.setDate(today.getDate() + 7)
        return d >= today && d < weekEnd
    }
    if (preset === 'month') {
        const monthEnd = new Date(today)
        monthEnd.setDate(today.getDate() + 30)
        return d >= today && d < monthEnd
    }
    return true
}

// ─── Page ──────────────────────────────────────────────────────────

export default function ApprovalsPage() {
    const router = useRouter()
    const t = useTranslation()
    const [posts, setPosts] = useState<ApprovalPost[]>([])
    const [loading, setLoading] = useState(true)
    const [actionPost, setActionPost] = useState<{ post: ApprovalPost; action: 'approved' | 'rejected' } | null>(null)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const { activeChannelId } = useWorkspace()
    const [search, setSearch] = useState('')
    const [datePreset, setDatePreset] = useState<DatePreset>('all')
    const locale = typeof navigator !== 'undefined' && navigator.language?.startsWith('vi') ? 'vi' : 'en'

    const fetchPosts = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ status: 'PENDING_APPROVAL', limit: '100' })
            if (activeChannelId) params.set('channelId', activeChannelId)
            const res = await fetch(`/api/admin/posts?${params}`)
            const data = await res.json()
            setPosts(data.posts || [])
        } catch {
            toast.error(t('approvals.loadFailed'))
        } finally {
            setLoading(false)
        }
    }, [t, activeChannelId])

    useEffect(() => { fetchPosts() }, [fetchPosts])

    const handleAction = async () => {
        if (!actionPost) return
        setSubmitting(true)
        try {
            const res = await fetch(`/api/admin/posts/${actionPost.post.id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: actionPost.action, comment }),
            })
            if (!res.ok) throw new Error()
            toast.success(actionPost.action === 'approved' ? t('approvals.approved') : t('approvals.rejected'))
            setActionPost(null)
            setComment('')
            fetchPosts()
        } catch {
            toast.error(t('approvals.actionFailed'))
        } finally {
            setSubmitting(false)
        }
    }

    const formatDate = (d: string) =>
        new Date(d).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })

    // Filter + group by actual date
    const grouped = useMemo(() => {
        const q = search.toLowerCase()
        const filtered = posts.filter(p => {
            if (q && !(p.content || '').toLowerCase().includes(q)
                && !p.channel.displayName.toLowerCase().includes(q)
                && !(p.author.name || '').toLowerCase().includes(q)
                && !p.author.email.toLowerCase().includes(q)) return false
            if (!matchesDatePreset(p.createdAt, datePreset)) return false
            return true
        })

        const map: Record<string, ApprovalPost[]> = {}
        for (const post of filtered) {
            const key = toDateKey(post.createdAt)
            if (!map[key]) map[key] = []
            map[key].push(post)
        }
        // Sort each group by newest first
        for (const key of Object.keys(map)) {
            map[key].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
        }
        // Sort groups reverse-chronologically (newest first)
        return Object.keys(map).sort().reverse().map(k => ({
            key: k,
            label: formatDateLabel(k, locale),
            posts: map[k],
        }))
    }, [posts, search, datePreset, locale])

    const totalFiltered = grouped.reduce((sum, g) => sum + g.posts.length, 0)
    const subtitle = totalFiltered === 1
        ? t('approvals.subtitle').replace('{count}', '1')
        : t('approvals.subtitlePlural').replace('{count}', String(totalFiltered))

    const DATE_PRESETS: { key: DatePreset; label: string }[] = [
        { key: 'today', label: t('approvals.filterToday') || (locale === 'vi' ? 'Hôm nay' : 'Today') },
        { key: 'week', label: t('approvals.filterWeek') || (locale === 'vi' ? 'Tuần này' : 'This Week') },
        { key: 'month', label: t('approvals.filterMonth') || (locale === 'vi' ? 'Tháng này' : 'This Month') },
        { key: 'all', label: t('approvals.filterAll') || (locale === 'vi' ? 'Tất cả' : 'All') },
    ]

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5" />
                        {t('approvals.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchPosts} className="cursor-pointer h-8 gap-1.5">
                    <RefreshIcon className="h-3.5 w-3.5" />{t('common.refresh')}
                </Button>
            </div>

            {/* Search + Date Filter Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('approvals.searchPlaceholder') || (locale === 'vi' ? 'Tìm kiếm bài viết...' : 'Search posts...')}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >✕</button>
                    )}
                </div>
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    {DATE_PRESETS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setDatePreset(p.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                datePreset === p.key
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <SpinnerIcon className="h-8 w-8 text-muted-foreground" />
                </div>
            ) : totalFiltered === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                    <CheckCircleIcon className="h-12 w-12 text-emerald-400 mb-3" />
                    <p className="text-lg font-semibold">
                        {search
                            ? (locale === 'vi' ? 'Không tìm thấy bài viết' : 'No posts found')
                            : t('approvals.allClear')
                        }
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {search
                            ? (locale === 'vi' ? 'Thử từ khoá khác' : 'Try a different keyword')
                            : t('approvals.allClearDesc')
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {grouped.map(group => (
                        <div key={group.key}>
                            {/* Date header — same style as posts page */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 whitespace-nowrap">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                    <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{group.label}</h3>
                                </div>
                                <div className="flex-1 h-px bg-emerald-500/20" />
                                <span className="text-[10px] font-semibold text-emerald-600/70 dark:text-emerald-400/60 whitespace-nowrap">{group.posts.length} post{group.posts.length !== 1 ? 's' : ''}</span>
                            </div>

                            {/* Grid — same responsive columns as posts page */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {group.posts.map(post => {
                                    const platforms = [...new Set(post.platformStatuses.map(ps => ps.platform))]
                                    const thumb = post.media[0]?.mediaItem
                                    const timeLabel = new Date(post.createdAt).toLocaleTimeString(
                                        locale === 'vi' ? 'vi-VN' : 'en-US',
                                        { hour: '2-digit', minute: '2-digit' }
                                    )
                                    return (
                                        <div
                                            key={post.id}
                                            className="group relative flex flex-col rounded-xl overflow-hidden border border-border/70 bg-card hover:shadow-[0_4px_28px_rgba(0,0,0,0.18)] hover:border-primary/40 transition-all duration-200"
                                            style={{ height: '340px' }}
                                        >
                                            {/* Status accent line */}
                                            <div className="absolute top-0 inset-x-0 h-[2px] bg-amber-400" />

                                            {/* ── TOP BAR ── */}
                                            <div className="flex items-center justify-between px-2.5 py-2 shrink-0 bg-card border-b border-border/50">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {/* PENDING badge */}
                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider border bg-amber-500/15 text-amber-600 border-amber-500/30 shrink-0">
                                                        Pending
                                                    </span>
                                                    {/* Author */}
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {post.author.name || post.author.email.split('@')[0]}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] font-semibold tabular-nums text-foreground/70 shrink-0 ml-1">
                                                    {timeLabel}
                                                </span>
                                            </div>

                                            {/* ── IMAGE / CONTENT ── */}
                                            <div
                                                className="relative flex-1 overflow-hidden cursor-pointer"
                                                onClick={() => router.push(`/dashboard/posts/compose?edit=${post.id}`)}
                                            >
                                                {thumb ? (
                                                    <img
                                                        src={thumb.thumbnailUrl || thumb.url}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center p-3 bg-gradient-to-br from-muted/80 to-muted/30">
                                                        <p className="text-xs font-medium text-foreground/80 leading-relaxed line-clamp-6 text-center">
                                                            {post.content || <span className="text-muted-foreground/50 italic">No caption</span>}
                                                        </p>
                                                    </div>
                                                )}
                                                {/* Hover: open post hint */}
                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="text-[11px] font-semibold text-white bg-black/60 px-2 py-1 rounded-lg">View post</span>
                                                </div>
                                            </div>

                                            {/* ── BOTTOM BAR ── */}
                                            <div className="shrink-0 px-2.5 py-2 bg-card border-t border-border/50 space-y-2">
                                                {/* Caption */}
                                                <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2 min-h-[28px]">
                                                    {post.content || <span className="text-muted-foreground/40 italic">No caption</span>}
                                                </p>
                                                {/* Platform icons */}
                                                <div className="flex items-center gap-0.5">
                                                    {platforms.map(p => (
                                                        <PlatformIcon key={p} platform={p} size="sm" />
                                                    ))}
                                                </div>
                                                {/* Approve / Reject buttons */}
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setActionPost({ post, action: 'approved' }) }}
                                                        className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                                                    >
                                                        <CheckCircleIcon className="h-3.5 w-3.5" />
                                                        {t('approvals.approve')}
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setActionPost({ post, action: 'rejected' }) }}
                                                        className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] font-semibold rounded-lg border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                                    >
                                                        <XCircleIcon className="h-3.5 w-3.5" />
                                                        {t('approvals.reject')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

            )}

            {/* Confirm dialog */}
            <AlertDialog open={!!actionPost} onOpenChange={() => { setActionPost(null); setComment('') }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={cn(
                            'flex items-center gap-2',
                            actionPost?.action === 'approved' ? 'text-emerald-600' : 'text-red-500'
                        )}>
                            {actionPost?.action === 'approved'
                                ? <><CheckCircleIcon className="h-5 w-5" />{t('approvals.approveTitle')}</>
                                : <><XCircleIcon className="h-5 w-5" />{t('approvals.rejectTitle')}</>
                            }
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {actionPost?.action === 'approved' ? t('approvals.approveDesc') : t('approvals.rejectDesc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="pb-2">
                        <Textarea
                            placeholder={actionPost?.action === 'approved' ? t('approvals.approveComment') : t('approvals.rejectComment')}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            className="min-h-[80px] text-sm"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={submitting} className="cursor-pointer">{t('common.cancel')}</AlertDialogCancel>
                        <Button
                            onClick={handleAction}
                            disabled={submitting}
                            className={cn(
                                'cursor-pointer',
                                actionPost?.action === 'approved'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-red-500 hover:bg-red-600 text-white'
                            )}
                        >
                            {submitting && <SpinnerIcon className="h-4 w-4 mr-2" />}
                            {actionPost?.action === 'approved' ? t('approvals.approve') : t('approvals.reject')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
