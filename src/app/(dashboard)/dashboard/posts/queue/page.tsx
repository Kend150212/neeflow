'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import { useWorkspace } from '@/lib/workspace-context'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { PlatformIcon } from '@/components/platform-icons'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────

interface PlatformStatus { platform: string; status: string }
interface PostMedia { mediaItem: { url: string; thumbnailUrl: string | null } }
interface QueuePost {
    id: string
    content: string | null
    status: string
    scheduledAt: string
    publishedAt: string | null
    channel: { id: string; displayName: string }
    media: PostMedia[]
    platformStatuses: PlatformStatus[]
}

// ─── Inline SVG Icons ────────────────────────────────────────────

function CalendarIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
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

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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

function EmptyCalendarIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
        </svg>
    )
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatTime(d: string, locale: string) {
    return new Date(d).toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit', minute: '2-digit',
    })
}

function toDateKey(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateLabel(dateKey: string, locale: string): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const dt = new Date(date)
    dt.setHours(0, 0, 0, 0)

    const dayName = date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long' })
    const formatted = date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'long' })
    const label = `${dayName}, ${formatted}`

    if (dt.getTime() === today.getTime()) return `${label} — ${locale === 'vi' ? 'Hôm nay' : 'Today'}`
    if (dt.getTime() === tomorrow.getTime()) return `${label} — ${locale === 'vi' ? 'Ngày mai' : 'Tomorrow'}`
    return label
}

const STATUS_DOT: Record<string, string> = {
    SCHEDULED: 'bg-blue-500',
    PUBLISHED: 'bg-emerald-500',
    FAILED: 'bg-red-500',
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

// ─── Page ─────────────────────────────────────────────────────────

export default function QueuePage() {
    const router = useRouter()
    const t = useTranslation()
    const [posts, setPosts] = useState<QueuePost[]>([])
    const [loading, setLoading] = useState(true)
    const { activeChannelId } = useWorkspace()
    const [search, setSearch] = useState('')
    const [datePreset, setDatePreset] = useState<DatePreset>('all')
    const locale = typeof navigator !== 'undefined' && navigator.language?.startsWith('vi') ? 'vi' : 'en'

    const fetchPosts = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ status: 'SCHEDULED', limit: '200' })
            if (activeChannelId) params.set('channelId', activeChannelId)
            const res = await fetch(`/api/admin/posts?${params}`)
            const data = await res.json()
            setPosts(data.posts || [])
        } catch {
            toast.error(t('queue.loadFailed') || 'Failed to load queue')
        } finally {
            setLoading(false)
        }
    }, [t, activeChannelId])

    useEffect(() => { fetchPosts() }, [fetchPosts])

    // Filter + group by actual date
    const grouped = useMemo(() => {
        const q = search.toLowerCase()
        const filtered = posts.filter(p => {
            if (q && !(p.content || '').toLowerCase().includes(q) && !p.channel.displayName.toLowerCase().includes(q)) return false
            if (!matchesDatePreset(p.scheduledAt, datePreset)) return false
            return true
        })

        const map: Record<string, QueuePost[]> = {}
        for (const post of filtered) {
            const key = post.scheduledAt ? toDateKey(post.scheduledAt) : '9999-12-31'
            if (!map[key]) map[key] = []
            map[key].push(post)
        }
        // Sort each group by time
        for (const key of Object.keys(map)) {
            map[key].sort((a, b) =>
                new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
            )
        }
        // Sort groups chronologically
        return Object.keys(map).sort().map(k => ({
            key: k,
            label: formatDateLabel(k, locale),
            posts: map[k],
        }))
    }, [posts, search, datePreset, locale])

    const totalFiltered = grouped.reduce((sum, g) => sum + g.posts.length, 0)
    const subtitle = totalFiltered === 1
        ? t('queue.subtitle').replace('{count}', '1')
        : t('queue.subtitlePlural').replace('{count}', String(totalFiltered))

    const DATE_PRESETS: { key: DatePreset; label: string }[] = [
        { key: 'today', label: t('queue.filterToday') || (locale === 'vi' ? 'Hôm nay' : 'Today') },
        { key: 'week', label: t('queue.filterWeek') || (locale === 'vi' ? 'Tuần này' : 'This Week') },
        { key: 'month', label: t('queue.filterMonth') || (locale === 'vi' ? 'Tháng này' : 'This Month') },
        { key: 'all', label: t('queue.filterAll') || (locale === 'vi' ? 'Tất cả' : 'All') },
    ]

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5" />
                        {t('queue.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchPosts} className="cursor-pointer h-8 gap-1.5">
                        <RefreshIcon className="h-3.5 w-3.5" />{t('common.refresh')}
                    </Button>
                    <Button size="sm" onClick={() => router.push('/dashboard/posts/compose')} className="cursor-pointer h-8 gap-1.5">
                        <PlusIcon className="h-3.5 w-3.5" />{t('nav.posts')}
                    </Button>
                </div>
            </div>

            {/* Search + Date Filter Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('queue.searchPlaceholder') || (locale === 'vi' ? 'Tìm kiếm bài viết...' : 'Search posts...')}
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

            {/* Queue */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <SpinnerIcon className="h-8 w-8 text-muted-foreground" />
                </div>
            ) : totalFiltered === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                    <EmptyCalendarIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-lg font-semibold">{search ? (locale === 'vi' ? 'Không tìm thấy bài viết' : 'No posts found') : t('queue.empty')}</p>
                    <p className="text-sm text-muted-foreground mb-4">
                        {search
                            ? (locale === 'vi' ? 'Thử từ khoá khác' : 'Try a different keyword')
                            : t('queue.emptyDesc')
                        }
                    </p>
                    {!search && (
                        <Button onClick={() => router.push('/dashboard/posts/compose')} className="cursor-pointer">
                            <PlusIcon className="h-4 w-4 mr-2" />{t('queue.schedulePost')}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {grouped.map(group => (
                        <div key={group.key}>
                            <div className="flex items-center gap-2 mb-2">
                                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm font-semibold text-muted-foreground">{group.label}</span>
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.posts.length}</span>
                            </div>

                            <div className="space-y-2">
                                {group.posts.map(post => {
                                    const platforms = [...new Set(post.platformStatuses.map(ps => ps.platform))]
                                    const thumb = post.media[0]?.mediaItem

                                    return (
                                        <div
                                            key={post.id}
                                            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition-shadow group cursor-pointer"
                                            onClick={() => router.push(`/dashboard/posts/compose?edit=${post.id}`)}
                                        >
                                            {/* Time column */}
                                            <div className="shrink-0 text-center w-14">
                                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                    {formatTime(post.scheduledAt, locale)}
                                                </p>
                                                <div className={cn('h-1.5 w-1.5 rounded-full mx-auto mt-1', STATUS_DOT[post.status] || 'bg-slate-400')} />
                                            </div>

                                            {/* Thumbnail */}
                                            <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
                                                {thumb ? (
                                                    <img src={thumb.thumbnailUrl || thumb.url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center">
                                                        <DocIcon className="h-4 w-4 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium line-clamp-1">
                                                    {post.content || <span className="text-muted-foreground/60 italic">{t('queue.noContent')}</span>}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-muted-foreground">{post.channel.displayName}</span>
                                                    <div className="flex items-center gap-0.5">
                                                        {platforms.map(p => <PlatformIcon key={p} platform={p} size="xs" />)}
                                                    </div>
                                                </div>
                                            </div>

                                            <ChevronRightIcon className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-foreground transition-colors" />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
