'use client'

import { useBranding } from '@/lib/use-branding'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { PlatformIcon } from '@/components/platform-icons'

// ─── Locale Detection ────────────────────────────────────
function usePortalLocale(): 'en' | 'vi' {
    const [locale, setLocale] = useState<'en' | 'vi'>('en')
    useEffect(() => {
        const lang = navigator.language || 'en'
        setLocale(lang.startsWith('vi') ? 'vi' : 'en')
    }, [])
    return locale
}

const PORTAL_LABELS = {
    en: {
        clientPortal: 'Client Portal',
        yourChannels: 'Your Channels',
        allChannels: 'All Channels',
        pendingReview: 'Pending Review',
        calendar: 'Calendar',
        uploadMedia: 'Upload Media',
        signOut: 'Sign out',
        switchDashboard: 'Switch to Dashboard',
        customer: 'Customer',
        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        today: 'Today',
        month: 'Month',
        week: 'Week',
        noPostsDay: 'No posts',
        dateToday: 'Today',
        dateWeek: 'This Week',
        dateMonth: 'This Month',
        dateAll: 'All',
        status: {
            PUBLISHED: 'Published', SCHEDULED: 'Scheduled', PENDING_APPROVAL: 'Pending',
            CLIENT_REVIEW: 'Review', DRAFT: 'Draft', FAILED: 'Failed',
            APPROVED: 'Approved', REJECTED: 'Rejected',
        } as Record<string, string>,
        approve: 'Approve',
        reject: 'Reject',
        addComment: 'Add feedback...',
        approved: 'Approved ✓',
        rejected: 'Rejected',
        noContent: 'No content',
        lightMode: 'Switch to light mode',
        darkMode: 'Switch to dark mode',
        dragDrop: 'Drag & drop files or click to upload',
        uploading: 'Uploading...',
        uploadSuccess: 'Uploaded successfully',
        allPlatforms: 'All Platforms',
    },
    vi: {
        clientPortal: 'Cổng khách hàng',
        yourChannels: 'Kênh của bạn',
        allChannels: 'Tất cả kênh',
        pendingReview: 'Chờ duyệt',
        calendar: 'Lịch',
        uploadMedia: 'Upload',
        signOut: 'Đăng xuất',
        switchDashboard: 'Chuyển Dashboard',
        customer: 'Khách hàng',
        months: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
        days: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
        today: 'Hôm nay',
        month: 'Tháng',
        week: 'Tuần',
        noPostsDay: 'Không có bài',
        dateToday: 'Hôm nay',
        dateWeek: 'Tuần này',
        dateMonth: 'Tháng này',
        dateAll: 'Tất cả',
        status: {
            PUBLISHED: 'Đã đăng', SCHEDULED: 'Đã lên lịch', PENDING_APPROVAL: 'Chờ duyệt',
            CLIENT_REVIEW: 'Đang xem', DRAFT: 'Nháp', FAILED: 'Thất bại',
            APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối',
        } as Record<string, string>,
        approve: 'Duyệt',
        reject: 'Từ chối',
        addComment: 'Thêm nhận xét...',
        approved: 'Đã duyệt ✓',
        rejected: 'Đã từ chối',
        noContent: 'Không có nội dung',
        lightMode: 'Chế độ sáng',
        darkMode: 'Chế độ tối',
        dragDrop: 'Kéo thả hoặc nhấn để upload',
        uploading: 'Đang upload...',
        uploadSuccess: 'Upload thành công',
        allPlatforms: 'Tất cả nền tảng',
    },
}
// ─── Types ───────────────────────────────────────────────
interface MediaItem { url: string; thumbnailUrl: string | null; type: string; id?: string }
interface PostMedia { mediaItem: MediaItem }
interface Approval { action: string; comment?: string | null; createdAt?: string; user?: { name: string | null; email: string } }
interface PlatformStatus { id?: string; platform: string; accountId?: string; status?: string }
interface Post {
    id: string; content: string | null; scheduledAt: string | null; createdAt: string
    status?: string; publishedAt?: string | null
    channel: { id: string; displayName: string; name?: string }
    author?: { name: string | null; email: string }
    media: PostMedia[]; approvals?: Approval[]; platformStatuses: PlatformStatus[]
}
interface Channel { id: string; displayName: string; name: string; isActive: boolean }
interface UserProfile { id: string; name: string | null; email: string; role: string; image: string | null; createdAt: string }

const PLATFORM_COLORS: Record<string, string> = {
    facebook: 'bg-blue-500', instagram: 'bg-pink-500', youtube: 'bg-red-500',
    pinterest: 'bg-red-600', linkedin: 'bg-blue-700', tiktok: 'bg-slate-800', x: 'bg-slate-600',
}

const PLATFORMS = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin', 'pinterest', 'x']

const STATUS_COLORS: Record<string, string> = {
    PUBLISHED: 'border-l-emerald-500', SCHEDULED: 'border-l-blue-500',
    PENDING_APPROVAL: 'border-l-amber-400', DRAFT: 'border-l-slate-400',
    FAILED: 'border-l-red-500', APPROVED: 'border-l-emerald-500', REJECTED: 'border-l-red-500',
}

const STATUS_LABELS: Record<string, string> = {
    PUBLISHED: 'Published', SCHEDULED: 'Scheduled', PENDING_APPROVAL: 'Pending',
    DRAFT: 'Draft', FAILED: 'Failed',
}

// NOTE: STATUS_LABELS is kept as fallback; prefer PORTAL_LABELS[locale].status

// ─── Theme (class-based — matches app dark/light system) ──
type Theme = 'dark' | 'light'

function useTheme() {
    const [theme, setTheme] = useState<Theme>('dark')
    useEffect(() => {
        const saved = localStorage.getItem('portal-theme') as Theme
        const resolved = (saved === 'light' || saved === 'dark') ? saved : 'dark'
        setTheme(resolved)
        if (resolved === 'dark') document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
    }, [])
    const toggle = () => {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        localStorage.setItem('portal-theme', next)
        if (next === 'dark') document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
    }
    return { theme, toggle }
}

// ─── Calendar helpers ────────────────────────────────────
function getPostDate(post: Post): Date {
    return new Date(post.scheduledAt || post.publishedAt || post.createdAt)
}
function toLocalDateStr(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = (day === 0 ? -6 : 1 - day)
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
}
function getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function PortalPage() {
    const branding = useBranding()
    const { data: session, status } = useSession()
    const router = useRouter()
    const { theme, toggle: toggleTheme } = useTheme()
    const locale = usePortalLocale()
    const L = PORTAL_LABELS[locale]

    // Data
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [channels, setChannels] = useState<Channel[]>([])
    const [pendingPosts, setPendingPosts] = useState<Post[]>([])
    const [calendarPosts, setCalendarPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [calLoading, setCalLoading] = useState(false)

    // UI
    const [activeTab, setActiveTab] = useState<'review' | 'calendar' | 'upload'>('review')
    const [selectedChannel, setSelectedChannel] = useState<string>('all')
    const [comments, setComments] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
    const [done, setDone] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({})
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [hasDualAccess, setHasDualAccess] = useState(false)
    const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'all'>('week')

    // Compute date range from preset
    function getDateRange(preset: typeof datePreset) {
        const now = new Date()
        if (preset === 'all') return { from: undefined, to: undefined }
        if (preset === 'today') {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            return { from: d.toISOString(), to: now.toISOString() }
        }
        if (preset === 'week') {
            const d = new Date(now)
            d.setDate(d.getDate() - d.getDay()) // start of week (Sunday)
            d.setHours(0, 0, 0, 0)
            return { from: d.toISOString(), to: now.toISOString() }
        }
        // month
        const d = new Date(now.getFullYear(), now.getMonth(), 1)
        return { from: d.toISOString(), to: now.toISOString() }
    }

    // Calendar state
    const [calView, setCalView] = useState<'month' | 'week'>('month')
    const [currentDate, setCurrentDate] = useState(() => new Date())
    const [activePlatforms, setActivePlatforms] = useState<Set<string>>(new Set())

    // Calendar date range
    const { from, to, title: calTitle } = useMemo(() => {
        if (calView === 'month') {
            const start = getMonthStart(currentDate)
            const f = getWeekStart(start)
            const tt = new Date(f)
            tt.setDate(f.getDate() + 41)
            tt.setHours(23, 59, 59, 999)
            return { from: f, to: tt, title: `${L.months[currentDate.getMonth()]} ${currentDate.getFullYear()}` }
        } else {
            const f = getWeekStart(currentDate)
            const tt = new Date(f)
            tt.setDate(f.getDate() + 6)
            tt.setHours(23, 59, 59, 999)
            const startDay = f.getDate()
            const endDay = tt.getDate()
            const label = f.getMonth() === tt.getMonth()
                ? `${L.months[f.getMonth()]} ${startDay} – ${endDay}, ${tt.getFullYear()}`
                : `${L.months[f.getMonth()]} ${startDay} – ${L.months[tt.getMonth()]} ${endDay}, ${tt.getFullYear()}`
            return { from: f, to: tt, title: label }
        }
    }, [calView, currentDate])

    // ─── Load initial data ───────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const range = getDateRange(datePreset)
            const postParams = new URLSearchParams()
            if (range.from) postParams.set('from', range.from)
            if (range.to) postParams.set('to', range.to)
            const postUrl = `/api/portal/posts${postParams.toString() ? '?' + postParams.toString() : ''}`
            const [profileRes, postsRes] = await Promise.all([
                fetch('/api/portal/profile'),
                fetch(postUrl),
            ])
            const profileData = await profileRes.json()
            const postsData = await postsRes.json()
            setProfile(profileData.user)
            setChannels(profileData.channels || [])
            setPendingPosts(postsData.posts || [])
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datePreset])

    // Load calendar data
    const loadCalendar = useCallback(async () => {
        setCalLoading(true)
        try {
            const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
            if (selectedChannel !== 'all') params.set('channelId', selectedChannel)
            const res = await fetch(`/api/portal/calendar?${params}`)
            const data = await res.json()
            setCalendarPosts(data.posts || [])
        } catch (e) { console.error(e) }
        finally { setCalLoading(false) }
    }, [from, to, selectedChannel])

    useEffect(() => {
        if (status === 'loading') return
        if (!session) { router.push('/login'); return }
        loadData()
    }, [session, status, router, loadData])

    // Check dual access
    useEffect(() => {
        fetch('/api/auth/check-access')
            .then(r => r.json())
            .then(data => { if (data.hasDualAccess) setHasDualAccess(true) })
            .catch(() => { })
    }, [])

    useEffect(() => {
        if (activeTab === 'calendar' && channels.length > 0) loadCalendar()
    }, [activeTab, loadCalendar, channels.length])

    // ─── Actions ─────────────────────────────────────────
    async function handleAction(postId: string, action: 'APPROVED' | 'REJECTED') {
        setSubmitting((s) => ({ ...s, [postId]: true }))
        const res = await fetch(`/api/portal/posts/${postId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, comment: comments[postId] || '' }),
        })
        if (res.ok) {
            setDone((d) => ({ ...d, [postId]: action }))
            // Auto-refresh data so columns update immediately
            loadData()
        }
        setSubmitting((s) => ({ ...s, [postId]: false }))
    }

    // ─── Filtered pending posts ──────────────────────────
    const filteredPending = useMemo(() => {
        const p = pendingPosts.filter((p) => !done[p.id])
        if (selectedChannel === 'all') return p
        return p.filter((p) => p.channel.id === selectedChannel)
    }, [pendingPosts, done, selectedChannel])

    // Calendar posts grouped
    const filteredCalPosts = useMemo(() => {
        if (activePlatforms.size === 0) return calendarPosts
        return calendarPosts.filter(p => p.platformStatuses.some(ps => activePlatforms.has(ps.platform)))
    }, [calendarPosts, activePlatforms])

    const postsByDate = useMemo(() => {
        const map: Record<string, Post[]> = {}
        for (const post of filteredCalPosts) {
            const dateStr = toLocalDateStr(getPostDate(post))
            if (!map[dateStr]) map[dateStr] = []
            map[dateStr].push(post)
        }
        return map
    }, [filteredCalPosts])

    const reviewedCount = Object.keys(done).length

    // Calendar nav
    const handlePrev = () => {
        setCurrentDate(d => {
            const next = new Date(d)
            if (calView === 'month') next.setMonth(d.getMonth() - 1)
            else next.setDate(d.getDate() - 7)
            return next
        })
    }
    const handleNext = () => {
        setCurrentDate(d => {
            const next = new Date(d)
            if (calView === 'month') next.setMonth(d.getMonth() + 1)
            else next.setDate(d.getDate() + 7)
            return next
        })
    }
    const handleToday = () => setCurrentDate(new Date())
    const handleDayClick = (date: Date) => { setCurrentDate(date); setCalView('week') }
    const togglePlatform = (platform: string) => {
        setActivePlatforms(prev => {
            const next = new Set(prev)
            if (next.has(platform)) next.delete(platform)
            else next.add(platform)
            return next
        })
    }

    // ─── Loading ─────────────────────────────────────────
    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Image src={branding.logoUrl} alt={branding.appName} width={48} height={48} className="rounded-xl" unoptimized />
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            {/* ─── Mobile overlay ──────────────────────── */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ─── Sidebar ────────────────────────────── */}
            <aside className={`
                fixed lg:sticky top-0 left-0 h-screen w-[260px] bg-sidebar border-r border-sidebar-border
                flex flex-col z-40 transition-transform duration-200
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Logo */}
                <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
                    <Image src={branding.logoUrl} alt={branding.appName} width={32} height={32} className="rounded-xl" unoptimized />
                    <div className="flex-1 min-w-0">
                        <h1 className="font-bold text-sm tracking-tight">{branding.appName}</h1>
                        <p className="text-[9px] text-muted-foreground/60 uppercase tracking-[0.15em]">{L.clientPortal}</p>
                    </div>
                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                        title={theme === 'dark' ? L.lightMode : L.darkMode}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Channel Switcher */}
                <div className="px-3 pt-3 pb-2 border-b border-sidebar-border">
                    <p className="px-2 mb-1.5 text-[9px] text-muted-foreground/50 uppercase tracking-[0.15em] font-semibold">{L.yourChannels}</p>
                    <button
                        onClick={() => setSelectedChannel('all')}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all mb-0.5 ${selectedChannel === 'all' ? 'nav-active' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                    >
                        <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] bg-muted">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                        </span>
                        {L.allChannels}
                    </button>
                    {channels.map((ch) => (
                        <button
                            key={ch.id}
                            onClick={() => setSelectedChannel(ch.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${selectedChannel === ch.id ? 'nav-active font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                            <span className="truncate">{ch.displayName}</span>
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-0.5">
                    <button
                        onClick={() => { setActiveTab('review'); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all ${activeTab === 'review' ? 'nav-active font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                        </svg>
                        {L.pendingReview}
                        {filteredPending.length > 0 && (
                            <span className="ml-auto bg-primary/20 text-primary text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                                {filteredPending.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => { setActiveTab('calendar'); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all ${activeTab === 'calendar' ? 'nav-active font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        {L.calendar}
                    </button>
                    <button
                        onClick={() => { setActiveTab('upload'); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all ${activeTab === 'upload' ? 'nav-active font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        {L.uploadMedia}
                    </button>
                </nav>

                {/* Profile */}
                <div className="p-3 border-t border-sidebar-border">
                    <div className="flex items-center gap-2.5 px-2 py-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                            {profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{profile?.name || L.customer}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{profile?.email}</p>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            title={L.signOut}
                            className="p-1 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                        </button>
                    </div>
                    {hasDualAccess && (
                        <button
                            onClick={() => {
                                document.cookie = 'access-mode=dashboard;path=/;max-age=86400'
                                router.push('/dashboard')
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                            {L.switchDashboard}
                        </button>
                    )}
                </div>
            </aside>

            {/* ─── Main Content ───────────────────────── */}
            <main className="flex-1 min-h-screen flex flex-col">
                {/* Top bar (mobile) */}
                <header className="lg:hidden sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
                    <div className="flex items-center justify-between px-4 h-12">
                        <button onClick={() => setSidebarOpen(true)} className="p-1.5 -ml-1.5 text-muted-foreground">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                        <Image src={branding.logoUrl} alt={branding.appName} width={24} height={24} className="rounded-lg" unoptimized />
                        <button onClick={toggleTheme} className="p-1.5 text-muted-foreground">
                            {theme === 'dark' ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </header>

                {activeTab === 'review' ? (
                    <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex flex-col">
                        <ReviewTab
                            posts={selectedChannel === 'all' ? pendingPosts : pendingPosts.filter(p => p.channel.id === selectedChannel)}
                            comments={comments}
                            setComments={setComments}
                            submitting={submitting}
                            done={done}
                            reviewedCount={reviewedCount}
                            handleAction={handleAction}
                            selectedChannel={selectedChannel}
                            theme={theme}
                            onRefresh={loadData}
                            datePreset={datePreset}
                            onDatePresetChange={(p) => { setDatePreset(p) }}
                        />
                    </div>
                ) : activeTab === 'calendar' ? (
                    <div className="flex-1 flex flex-col px-3 sm:px-4 lg:px-6 py-4 lg:py-6 overflow-hidden">
                        <FullCalendar
                            calView={calView}
                            setCalView={setCalView}
                            currentDate={currentDate}
                            calTitle={calTitle}
                            calLoading={calLoading}
                            postsByDate={postsByDate}
                            activePlatforms={activePlatforms}
                            handlePrev={handlePrev}
                            handleNext={handleNext}
                            handleToday={handleToday}
                            handleDayClick={handleDayClick}
                            togglePlatform={togglePlatform}
                            theme={theme}
                        />
                    </div>
                ) : (
                    <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                        <UploadTab
                            channels={channels}
                            selectedChannel={selectedChannel}
                            theme={theme}
                        />
                    </div>
                )}
            </main>
        </div>
    )
}

// ─────────────────────────────────────────────────────────
// Review Tab — Kanban Board
// ─────────────────────────────────────────────────────────
function ReviewTab({
    posts, comments, setComments, submitting, handleAction, reviewedCount, selectedChannel, theme,
    onRefresh, datePreset, onDatePresetChange,
}: {
    posts: Post[]
    comments: Record<string, string>
    setComments: React.Dispatch<React.SetStateAction<Record<string, string>>>
    submitting: Record<string, boolean>
    done: Record<string, string>
    reviewedCount: number
    handleAction: (id: string, action: 'APPROVED' | 'REJECTED') => void
    selectedChannel: string
    theme: Theme
    onRefresh?: () => void
    datePreset: 'today' | 'week' | 'month' | 'all'
    onDatePresetChange: (preset: 'today' | 'week' | 'month' | 'all') => void
}) {
    const c = {
        bg: 'bg-background', text: 'text-foreground',
        textMuted: 'text-muted-foreground',
        textSubtle: 'text-muted-foreground/70',
        textSoft: 'text-foreground/80',
        textMicro: 'text-muted-foreground/40',
        sidebar: 'bg-sidebar', sidebarBorder: 'border-sidebar-border',
        card: 'bg-card', cardBorder: 'border-border',
        cardHover: 'hover:border-primary/30',
        inputBg: 'bg-muted/50', inputBorder: 'border-border',
        hoverBg: 'hover:bg-accent',
        activeBg: 'bg-primary/10', activeText: 'text-primary',
        calCell: 'border-border/40',
        calCellMuted: 'opacity-40',
        calCardBg: 'bg-muted/40', calCardHover: 'hover:bg-muted/70',
        overlay: 'bg-black/60',
        pillInactive: 'text-muted-foreground border-border hover:border-primary/50',
    }
    const locale = usePortalLocale()
    const L = PORTAL_LABELS[locale]
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editText, setEditText] = useState('')
    const [saving, setSaving] = useState(false)

    // Kanban columns — CLIENT_REVIEW is the client's "Pending Review"
    // PENDING_APPROVAL is admin-only (not shown on portal)
    const pendingPosts = posts.filter(p => p.status === 'CLIENT_REVIEW')
    const scheduledPosts = posts.filter(p => p.status === 'SCHEDULED')
    const publishedPosts = posts.filter(p => p.status === 'PUBLISHED')

    const handleSaveEdit = async (postId: string) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/portal/posts/${postId}/edit`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editText }),
            })
            if (res.ok) {
                setEditingId(null)
                onRefresh?.()
            }
        } catch (e) { console.error(e) }
        setSaving(false)
    }

    const columns = [
        {
            key: 'pending',
            title: L.pendingReview,
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
            posts: pendingPosts,
            gradient: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/5',
            border: 'border-amber-500/20 dark:border-amber-500/30',
            headerBg: 'bg-amber-500/[0.07] dark:bg-amber-500/10',
            badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
            showActions: true,
        },
        {
            key: 'scheduled',
            title: L.approved,
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            posts: scheduledPosts,
            gradient: 'from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/5',
            border: 'border-emerald-500/20 dark:border-emerald-500/30',
            headerBg: 'bg-emerald-500/[0.07] dark:bg-emerald-500/10',
            badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
            showActions: false,
        },
        {
            key: 'published',
            title: L.status.PUBLISHED,
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                </svg>
            ),
            posts: publishedPosts,
            gradient: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/5',
            border: 'border-blue-500/20 dark:border-blue-500/30',
            headerBg: 'bg-blue-500/[0.07] dark:bg-blue-500/10',
            badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
            showActions: false,
        },
    ]

    return (
        <>
            <div className="mb-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">{locale === 'vi' ? 'Bảng nội dung' : 'Content Board'}</h1>
                        <p className={`${c.textMuted} text-sm mt-1`}>
                            {pendingPosts.length} pending
                            {reviewedCount > 0 && <span className="text-emerald-400"> · {reviewedCount} reviewed ✓</span>}
                            {selectedChannel !== 'all' && <span className={c.activeText}> · filtered</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
                        {([
                            { key: 'today' as const, label: L.dateToday },
                            { key: 'week' as const, label: L.dateWeek },
                            { key: 'month' as const, label: L.dateMonth },
                            { key: 'all' as const, label: L.dateAll },
                        ]).map(p => (
                            <button
                                key={p.key}
                                onClick={() => onDatePresetChange(p.key)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${datePreset === p.key
                                    ? 'bg-primary/15 text-primary shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {reviewedCount > 0 && (
                <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl px-4 py-3 mb-5 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    </div>
                    <p className="text-emerald-400 text-sm">{reviewedCount} post{reviewedCount !== 1 ? 's' : ''} reviewed — thank you!</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                {columns.map(col => (
                    <div key={col.key} className={`rounded-2xl border ${col.border} bg-gradient-to-b ${col.gradient} flex flex-col`}>
                        {/* Column header */}
                        <div className={`${col.headerBg} rounded-t-2xl px-4 py-3 flex items-center justify-between border-b ${col.border}`}>
                            <div className="flex items-center gap-2">
                                {col.icon}
                                <span className="text-sm font-semibold">{col.title}</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                                {col.posts.length}
                            </span>
                        </div>

                        {/* Column body */}
                        <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                            {col.posts.length === 0 ? (
                                <div className={`flex items-center justify-center h-full min-h-[120px] ${c.textMicro}`}>
                                    <span className="text-2xl opacity-20">📋</span>
                                </div>
                            ) : col.posts.map(post => (
                                <div key={post.id} className={`${c.card} border ${c.cardBorder} rounded-xl overflow-hidden ${c.cardHover} transition-all group`}>
                                    {/* Header — compact row with thumbnail */}
                                    <div className="p-3 flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-lg bg-black/50 overflow-hidden shrink-0">
                                            {post.media.length > 0 ? (
                                                post.media[0].mediaItem.type === 'video' ? (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
                                                        <svg className="w-4 h-4 text-white/30" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={post.media[0].mediaItem.thumbnailUrl || post.media[0].mediaItem.url}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                                    />
                                                )
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-white/10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                <span className={`${c.activeText} font-medium text-[11px] truncate`}>{post.channel.displayName}</span>
                                            </div>
                                            <p className={`${c.textSubtle} text-[10px] mt-0.5`}>
                                                {post.author?.name || post.author?.email?.split('@')[0] || '?'}
                                                {post.scheduledAt && (
                                                    <> · <span className="text-amber-400/60">{new Date(post.scheduledAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex gap-1 items-center shrink-0">
                                            {post.platformStatuses.map((ps) => (
                                                <PlatformIcon key={ps.platform} platform={ps.platform} size="xs" />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Content — inline editable */}
                                    <div className="px-3 pb-2">
                                        {editingId === post.id ? (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    rows={4}
                                                    className={`w-full ${c.inputBg} border ${c.inputBorder} rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all`}
                                                    autoFocus
                                                />
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => handleSaveEdit(post.id)}
                                                        disabled={saving}
                                                        className="flex-1 py-1.5 rounded-lg bg-primary/15 text-primary text-[10px] font-medium hover:bg-primary/25 transition-all disabled:opacity-30"
                                                    >
                                                        {saving ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className={`px-3 py-1.5 rounded-lg ${c.hoverBg} ${c.textMuted} text-[10px] transition-all`}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p
                                                className={`${c.textSoft} text-[11px] leading-relaxed whitespace-pre-wrap line-clamp-3 ${col.showActions ? 'cursor-pointer hover:opacity-70' : ''} transition-opacity`}
                                                onClick={() => {
                                                    if (!col.showActions) return
                                                    setEditingId(post.id)
                                                    setEditText(post.content || '')
                                                }}
                                                title={col.showActions ? 'Click to edit caption' : undefined}
                                            >
                                                {post.content || <span className={c.textMicro}>No caption</span>}
                                            </p>
                                        )}
                                    </div>

                                    {/* Feedback / Comments */}
                                    {post.approvals && post.approvals.length > 0 && post.approvals.some(a => a.comment) && (
                                        <div className="px-3 pb-2">
                                            {post.approvals.filter(a => a.comment).slice(0, 2).map((a, i) => (
                                                <div key={i} className={`flex items-start gap-2 ${i > 0 ? 'mt-1.5' : ''}`}>
                                                    <div className={`shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${a.action === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {a.action === 'APPROVED' ? '✓' : '✗'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`${c.textSubtle} text-[9px] font-medium`}>
                                                            {a.user?.name || a.user?.email?.split('@')[0] || 'User'}
                                                        </p>
                                                        <p className={`${c.textSoft} text-[10px] leading-snug line-clamp-2`}>{a.comment}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Action buttons — only for pending column */}
                                    {col.showActions && (
                                        <div className="px-3 pb-3 space-y-2">
                                            <textarea
                                                value={comments[post.id] || ''}
                                                onChange={(e) => setComments((cc) => ({ ...cc, [post.id]: e.target.value }))}
                                                placeholder="Add feedback (optional)..."
                                                rows={1}
                                                className={`w-full ${c.inputBg} border ${c.inputBorder} rounded-lg px-3 py-2 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/40`}
                                            />
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => handleAction(post.id, 'REJECTED')}
                                                    disabled={submitting[post.id]}
                                                    className="flex-1 border border-red-500/30 hover:bg-red-500/10 text-red-400 font-medium py-1.5 rounded-lg transition-all text-[11px] disabled:opacity-30 flex items-center justify-center gap-1"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    {L.reject}
                                                </button>
                                                <button
                                                    onClick={() => handleAction(post.id, 'APPROVED')}
                                                    disabled={submitting[post.id]}
                                                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-1.5 rounded-lg transition-all text-[11px] disabled:opacity-30 flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                    </svg>
                                                    {L.approve}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    )
}

// ─────────────────────────────────────────────────────────
// Full Calendar (ported from dashboard)
// ─────────────────────────────────────────────────────────
function FullCalendar({
    calView, setCalView, currentDate, calTitle, calLoading,
    postsByDate, activePlatforms,
    handlePrev, handleNext, handleToday, handleDayClick, togglePlatform, theme,
}: {
    calView: 'month' | 'week'
    setCalView: (v: 'month' | 'week') => void
    currentDate: Date
    calTitle: string
    calLoading: boolean
    postsByDate: Record<string, Post[]>
    activePlatforms: Set<string>
    handlePrev: () => void
    handleNext: () => void
    handleToday: () => void
    handleDayClick: (date: Date) => void
    togglePlatform: (p: string) => void
    theme: Theme
}) {
    const c = {
        bg: 'bg-background', text: 'text-foreground',
        textMuted: 'text-muted-foreground',
        textSubtle: 'text-muted-foreground/70',
        textSoft: 'text-foreground/80',
        textMicro: 'text-muted-foreground/40',
        sidebar: 'bg-sidebar', sidebarBorder: 'border-sidebar-border',
        card: 'bg-card', cardBorder: 'border-border',
        cardHover: 'hover:border-primary/30',
        inputBg: 'bg-muted/50', inputBorder: 'border-border',
        hoverBg: 'hover:bg-accent',
        activeBg: 'bg-primary/10', activeText: 'text-primary',
        calCell: 'border-border/40',
        calCellMuted: 'opacity-40',
        calCardBg: 'bg-muted/40', calCardHover: 'hover:bg-muted/70',
        overlay: 'bg-black/60',
        pillInactive: 'text-muted-foreground border-border hover:border-primary/50',
    }
    const locale = usePortalLocale()
    const L = PORTAL_LABELS[locale]

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header row */}
            <div className="flex flex-col gap-3 pb-3 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 mr-2">
                        <svg className={`w-5 h-5 ${c.activeText}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        <h1 className="text-lg font-bold tracking-tight">{locale === 'vi' ? 'Lịch nội dung' : 'Content Calendar'}</h1>
                    </div>

                    {/* Today button */}
                    <button onClick={handleToday} className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground text-xs font-medium transition-all">
                        {L.today}
                    </button>

                    {/* Nav */}
                    <div className="flex items-center gap-0.5">
                        <button onClick={handlePrev} className={`p-1.5 rounded-lg ${c.hoverBg} ${c.textMuted} transition-all`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        <span className="text-sm font-semibold min-w-[160px] text-center">{calTitle}</span>
                        <button onClick={handleNext} className={`p-1.5 rounded-lg ${c.hoverBg} ${c.textMuted} transition-all`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center rounded-lg border border-border p-0.5 ml-auto">
                        <button
                            onClick={() => setCalView('month')}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${calView === 'month' ? 'bg-primary text-primary-foreground' : c.textMuted}`}
                        >{L.month}</button>
                        <button
                            onClick={() => setCalView('week')}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${calView === 'week' ? 'bg-primary text-primary-foreground' : c.textMuted}`}
                        >{L.week}</button>
                    </div>

                    {calLoading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                </div>

                {/* Platform filter pills with SVG icons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {PLATFORMS.map(platform => {
                        const isActive = activePlatforms.has(platform)
                        return (
                            <button
                                key={platform}
                                onClick={() => togglePlatform(platform)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide border transition-all ${isActive
                                    ? `${PLATFORM_COLORS[platform]} text-white border-transparent`
                                    : c.pillInactive
                                    }`}
                            >
                                <PlatformIcon platform={platform} size="xs" />
                            </button>
                        )
                    })}
                    {activePlatforms.size > 0 && (
                        <button
                            onClick={() => togglePlatform('')}
                            className={`text-[10px] ${c.textMuted} underline underline-offset-2 ml-1 transition-colors`}
                        >{locale === 'vi' ? 'Xoá bộ lọc' : 'Clear'}</button>
                    )}
                </div>
            </div>

            {/* Calendar body */}
            <div className={`flex-1 overflow-hidden ${c.card} border ${c.cardBorder} rounded-xl`}>
                {calView === 'month' ? (
                    <CalMonthView currentDate={currentDate} postsByDate={postsByDate} onDayClick={handleDayClick} theme={theme} />
                ) : (
                    <CalWeekView currentDate={currentDate} postsByDate={postsByDate} theme={theme} />
                )}
            </div>
        </div>
    )
}

// ─── Month View ──────────────────────────────────────────
function CalMonthView({ currentDate, postsByDate, onDayClick, theme }: {
    currentDate: Date; postsByDate: Record<string, Post[]>; onDayClick: (d: Date) => void; theme: Theme
}) {
    const c = {
        bg: 'bg-background', text: 'text-foreground',
        textMuted: 'text-muted-foreground',
        textSubtle: 'text-muted-foreground/70',
        textSoft: 'text-foreground/80',
        textMicro: 'text-muted-foreground/40',
        sidebar: 'bg-sidebar', sidebarBorder: 'border-sidebar-border',
        card: 'bg-card', cardBorder: 'border-border',
        cardHover: 'hover:border-primary/30',
        inputBg: 'bg-muted/50', inputBorder: 'border-border',
        hoverBg: 'hover:bg-accent',
        activeBg: 'bg-primary/10', activeText: 'text-primary',
        calCell: 'border-border/40',
        calCellMuted: 'opacity-40',
        calCardBg: 'bg-muted/40', calCardHover: 'hover:bg-muted/70',
        overlay: 'bg-black/60',
        pillInactive: 'text-muted-foreground border-border hover:border-primary/50',
    }
    const locale = usePortalLocale()
    const L = PORTAL_LABELS[locale]
    const today = toLocalDateStr(new Date())
    const monthStart = getMonthStart(currentDate)
    const gridStart = getWeekStart(monthStart)

    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart)
        d.setDate(gridStart.getDate() + i)
        cells.push(d)
    }
    const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth()

    return (
        <div className="flex flex-col h-full">
            {/* Day headers */}
            <div className={`grid grid-cols-7 border-b ${c.calCell}`}>
                {L.days.map(d => (
                    <div key={d} className={`py-2 text-center text-[10px] font-semibold ${c.textSubtle} uppercase tracking-wider`}>{d}</div>
                ))}
            </div>
            {/* Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
                {cells.map((date, idx) => {
                    const dateStr = toLocalDateStr(date)
                    const posts = postsByDate[dateStr] || []
                    const isToday = dateStr === today
                    const inMonth = isCurrentMonth(date)
                    return (
                        <div
                            key={idx}
                            className={`border-r border-b ${c.calCell} p-1 min-h-0 overflow-hidden flex flex-col gap-0.5 ${!inMonth ? c.calCellMuted : ''
                                } ${isToday ? 'bg-primary/[0.06]' : ''}`}
                        >
                            <button
                                onClick={() => onDayClick(date)}
                                className={`h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-medium self-end transition-colors ${isToday ? 'bg-primary text-primary-foreground' : `${c.textMuted} ${c.calCardHover}`
                                    }`}
                            >
                                {date.getDate()}
                            </button>
                            {posts.slice(0, 3).map(post => (
                                <div
                                    key={post.id}
                                    className={`flex items-center gap-1 px-1 py-0.5 rounded border-l-2 ${c.calCardBg} ${c.calCardHover} cursor-default transition-colors ${STATUS_COLORS[post.status || 'SCHEDULED'] || 'border-l-slate-400'
                                        }`}
                                    title={post.content?.slice(0, 80) || post.channel.displayName}
                                >
                                    {post.media[0] && (
                                        <img
                                            src={post.media[0].mediaItem.thumbnailUrl || post.media[0].mediaItem.url}
                                            alt=""
                                            className="w-4 h-4 rounded object-cover shrink-0"
                                        />
                                    )}
                                    <span className={`text-[9px] ${c.textMuted} shrink-0`}>
                                        {getPostDate(post).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                    <span className={`text-[9px] ${c.textSoft} truncate`}>{post.content?.slice(0, 30) || '—'}</span>
                                    <div className="ml-auto flex gap-0.5 shrink-0">
                                        {[...new Set(post.platformStatuses.map(ps => ps.platform))].slice(0, 2).map(p => (
                                            <PlatformIcon key={p} platform={p} size="xs" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {posts.length > 3 && (
                                <button onClick={() => onDayClick(date)} className={`text-[9px] ${c.textSubtle} text-left pl-1 transition-colors`}>
                                    +{posts.length - 3} {locale === 'vi' ? 'thêm' : 'more'}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Week View ───────────────────────────────────────────
function CalWeekView({ currentDate, postsByDate, theme }: {
    currentDate: Date; postsByDate: Record<string, Post[]>; theme: Theme
}) {
    const c = {
        bg: 'bg-background', text: 'text-foreground',
        textMuted: 'text-muted-foreground',
        textSubtle: 'text-muted-foreground/70',
        textSoft: 'text-foreground/80',
        textMicro: 'text-muted-foreground/40',
        sidebar: 'bg-sidebar', sidebarBorder: 'border-sidebar-border',
        card: 'bg-card', cardBorder: 'border-border',
        cardHover: 'hover:border-primary/30',
        inputBg: 'bg-muted/50', inputBorder: 'border-border',
        hoverBg: 'hover:bg-accent',
        activeBg: 'bg-primary/10', activeText: 'text-primary',
        calCell: 'border-border/40',
        calCellMuted: 'opacity-40',
        calCardBg: 'bg-muted/40', calCardHover: 'hover:bg-muted/70',
        overlay: 'bg-black/60',
        pillInactive: 'text-muted-foreground border-border hover:border-primary/50',
    }
    const locale = usePortalLocale()
    const L = PORTAL_LABELS[locale]
    const today = toLocalDateStr(new Date())
    const weekStart = getWeekStart(currentDate)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        days.push(d)
    }

    return (
        <div className="flex flex-col h-full">
            {/* Day headers */}
            <div className={`grid grid-cols-7 border-b ${c.calCell}`}>
                {days.map((date, i) => {
                    const isToday = toLocalDateStr(date) === today
                    return (
                        <div key={i} className={`py-2 text-center border-r ${c.calCell} last:border-r-0`}>
                            <p className={`text-[10px] ${c.textSubtle} uppercase`}>{L.days[i]}</p>
                            <div className={`h-7 w-7 mx-auto flex items-center justify-center rounded-full text-sm font-semibold mt-0.5 ${isToday ? 'bg-primary text-primary-foreground' : c.textSoft
                                }`}>
                                {date.getDate()}
                            </div>
                        </div>
                    )
                })}
            </div>
            {/* Columns */}
            <div className="flex-1 grid grid-cols-7 overflow-y-auto">
                {days.map((date, i) => {
                    const dateStr = toLocalDateStr(date)
                    const posts = postsByDate[dateStr] || []
                    const isToday = dateStr === today
                    return (
                        <div key={i} className={`border-r ${c.calCell} last:border-r-0 p-1.5 flex flex-col gap-1.5 min-h-[300px] ${isToday ? 'bg-primary/[0.04]' : ''}`}>
                            {posts.length === 0 ? (
                                <p className={`text-[10px] ${c.textMicro} text-center mt-8`}>{L.noPostsDay}</p>
                            ) : (
                                posts.map(post => {
                                    const thumb = post.media[0]?.mediaItem
                                    const platforms = [...new Set(post.platformStatuses.map(ps => ps.platform))]
                                    const time = getPostDate(post).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                                    return (
                                        <div
                                            key={post.id}
                                            className={`rounded-lg border-l-[3px] ${c.calCardBg} ${c.calCardHover} overflow-hidden transition-colors ${STATUS_COLORS[post.status || 'SCHEDULED'] || 'border-l-slate-400'
                                                }`}
                                        >
                                            {thumb && (
                                                <div className="w-full aspect-video bg-black/40 overflow-hidden">
                                                    <img src={thumb.thumbnailUrl || thumb.url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="p-1.5 space-y-0.5">
                                                <div className="flex items-center gap-1">
                                                    <span className={`text-[10px] ${c.textMuted}`}>{time}</span>
                                                    <span className={`ml-auto text-[8px] px-1 py-0 rounded font-medium ${post.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400' :
                                                        post.status === 'SCHEDULED' ? 'bg-blue-500/20 text-blue-400' :
                                                            'bg-amber-500/20 text-amber-400'
                                                        }`}>
                                                        {STATUS_LABELS[post.status || ''] || post.status}
                                                    </span>
                                                </div>
                                                <p className={`text-[10px] ${c.textSoft} leading-snug line-clamp-2`}>{post.content || '—'}</p>
                                                <div className="flex items-center gap-1 pt-0.5">
                                                    {platforms.map(p => <PlatformIcon key={p} platform={p} size="xs" />)}
                                                    <span className={`ml-auto text-[8px] ${c.textMicro} truncate`}>{post.channel.displayName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────
// Upload Tab
// ─────────────────────────────────────────────────────────
function UploadTab({
    channels, selectedChannel, theme,
}: {
    channels: Channel[]
    selectedChannel: string
    theme: Theme
}) {
    const c = {
        bg: 'bg-background', text: 'text-foreground',
        textMuted: 'text-muted-foreground',
        textSubtle: 'text-muted-foreground/70',
        textSoft: 'text-foreground/80',
        textMicro: 'text-muted-foreground/40',
        sidebar: 'bg-sidebar', sidebarBorder: 'border-sidebar-border',
        card: 'bg-card', cardBorder: 'border-border',
        cardHover: 'hover:border-primary/30',
        inputBg: 'bg-muted/50', inputBorder: 'border-border',
        hoverBg: 'hover:bg-accent',
        activeBg: 'bg-primary/10', activeText: 'text-primary',
        calCell: 'border-border/40',
        calCellMuted: 'opacity-40',
        calCardBg: 'bg-muted/40', calCardHover: 'hover:bg-muted/70',
        overlay: 'bg-black/60',
        pillInactive: 'text-muted-foreground border-border hover:border-primary/50',
    }
    const [files, setFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'uploading' | 'done' | 'error'>>({})
    const [jobs, setJobs] = useState<Array<{
        id: string; status: string; createdAt: string
        mediaItem: { url: string; thumbnailUrl: string | null; type: string; originalName: string | null }
        channel: { id: string; displayName: string }
        post: { id: string; status: string; scheduledAt: string | null; content: string | null } | null
    }>>([])
    const [jobsLoading, setJobsLoading] = useState(true)
    const [dragOver, setDragOver] = useState(false)

    // ─── Active channel (internal state scoped to this tab) ───────
    // If parent selected a specific channel, use it; else start with first channel
    const [activeChannelId, setActiveChannelId] = useState<string>(
        selectedChannel !== 'all' ? selectedChannel : (channels[0]?.id ?? '')
    )
    // Keep activeChannelId in sync if parent's selectedChannel changes to a specific one
    useEffect(() => {
        if (selectedChannel !== 'all') setActiveChannelId(selectedChannel)
    }, [selectedChannel])

    // Load recent jobs — scoped to the active channel
    useEffect(() => {
        const loadJobs = async () => {
            try {
                const params = activeChannelId ? `?channelId=${activeChannelId}` : ''
                const res = await fetch(`/api/portal/upload/status${params}`)
                if (res.ok) {
                    const data = await res.json()
                    setJobs(data.jobs || [])
                }
            } catch (e) { console.error(e) }
            finally { setJobsLoading(false) }
        }
        loadJobs()
        const interval = setInterval(loadJobs, 10000) // auto-refresh every 10s
        return () => clearInterval(interval)
    }, [activeChannelId])

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const dropped = Array.from(e.dataTransfer.files).filter(
            f => f.type.startsWith('image/') || f.type.startsWith('video/')
        )
        setFiles(prev => [...prev, ...dropped])
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selected = Array.from(e.target.files).filter(
                f => f.type.startsWith('image/') || f.type.startsWith('video/')
            )
            setFiles(prev => [...prev, ...selected])
        }
    }

    const removeFile = (idx: number) => {
        setFiles(prev => prev.filter((_, i) => i !== idx))
    }

    const handleUpload = async () => {
        if (!activeChannelId) { alert('Please select a channel first'); return }
        if (files.length === 0) return

        setUploading(true)
        const progress: Record<string, 'pending' | 'uploading' | 'done' | 'error'> = {}
        files.forEach((f, i) => { progress[`${f.name}-${i}`] = 'pending' })
        setUploadProgress({ ...progress })

        let successCount = 0
        const errorMessages: string[] = []

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const key = `${file.name}-${i}`
            progress[key] = 'uploading'
            setUploadProgress({ ...progress })

            try {
                // Step 1: Get presigned URL from server
                const initRes = await fetch('/api/admin/media/init-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: activeChannelId,
                        fileName: file.name,
                        mimeType: file.type,
                        fileSize: file.size,
                    }),
                })
                const initData = await initRes.json()
                if (!initRes.ok) throw new Error(initData.error || 'Init upload failed')

                // Step 2: Upload directly to R2
                if (initData.uploadUri) {
                    const uploadRes = await fetch(initData.uploadUri, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type },
                    })
                    if (!uploadRes.ok) throw new Error(`R2 upload failed (${uploadRes.status})`)
                }

                // Step 3: Create MediaItem + ContentJob on server
                const completeRes = await fetch('/api/portal/upload/file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: activeChannelId,
                        storage: initData.storage || 'r2',
                        r2Key: initData.r2Key,
                        publicUrl: initData.publicUrl,
                        fileName: file.name,
                        mimeType: file.type,
                        fileSize: file.size,
                    }),
                })
                const completeData = await completeRes.json()
                if (!completeRes.ok) throw new Error(completeData.error || 'Create job failed')

                successCount++
                progress[key] = 'done'
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Upload failed'
                console.error(`[Upload] Error for ${file.name}:`, msg)
                errorMessages.push(`${file.name}: ${msg}`)
                progress[key] = 'error'
            }
            setUploadProgress({ ...progress })
        }

        if (successCount > 0) {
            alert(`✅ Đã upload ${successCount} file và tạo ${successCount} AI jobs`)
        }
        if (errorMessages.length > 0) {
            alert(`Lỗi upload:\n${errorMessages.join('\n')}`)
        }

        // Refresh jobs list
        setTimeout(async () => {
            const params = activeChannelId ? `?channelId=${activeChannelId}` : ''
            const res = await fetch(`/api/portal/upload/status${params}`)
            if (res.ok) {
                const data = await res.json()
                setJobs(data.jobs || [])
            }
        }, 1000)

        setFiles([])
        setUploading(false)
        setUploadProgress({})
    }

    const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
        QUEUED: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '⏳ Queued' },
        PROCESSING: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '🔄 Processing' },
        COMPLETED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '✅ Done' },
        FAILED: { bg: 'bg-red-500/20', text: 'text-red-400', label: '❌ Failed' },
    }

    return (
        <>
            <div className="mb-6">
                <h1 className="text-xl font-bold tracking-tight">Upload Media</h1>
                <p className={`${c.textMuted} text-sm mt-1`}>
                    Upload ảnh/video để AI tự động viết caption và lên lịch đăng
                </p>
            </div>

            {/* Channel Selector — always visible in Upload tab */}
            {channels.length > 1 && (
                <div className={`${c.card} border ${c.cardBorder} rounded-2xl p-4 mb-4`}>
                    <p className={`text-sm font-medium mb-2.5`}>Upload to channel:</p>
                    <div className="flex flex-wrap gap-2">
                        {channels.map(ch => (
                            <button
                                key={ch.id}
                                onClick={() => setActiveChannelId(ch.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeChannelId === ch.id
                                        ? `${c.activeBg} ${c.activeText} border-primary/40`
                                        : `${c.cardBorder} ${c.textMuted} hover:border-primary/30 hover:${c.activeText}`
                                    }`}
                            >
                                {ch.displayName}
                            </button>
                        ))}
                    </div>
                    {!activeChannelId && (
                        <p className="text-xs text-amber-400 mt-2">⚠️ Please select a channel before uploading</p>
                    )}
                </div>
            )}
            {channels.length === 1 && (
                <div className={`${c.card} border ${c.cardBorder} rounded-xl px-4 py-2 mb-4 flex items-center gap-2`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className={`text-xs ${c.textMuted}`}>Channel: <span className="font-medium text-foreground">{channels[0].displayName}</span></span>
                </div>
            )}

            {/* Drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`${c.card} border-2 border-dashed ${dragOver ? 'border-primary bg-primary/5' : c.cardBorder} rounded-2xl p-8 text-center transition-all cursor-pointer`}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <input
                    id="file-input"
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileSelect}
                />
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                    <svg className={`w-7 h-7 ${dragOver ? 'text-primary' : c.textMicro}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                </div>
                <h3 className={`text-sm font-semibold mb-1 ${dragOver ? 'text-primary' : c.textSoft}`}>
                    {dragOver ? 'Thả file vào đây' : 'Kéo thả ảnh/video vào đây'}
                </h3>
                <p className={`${c.textMuted} text-xs`}>hoặc click để chọn file</p>
            </div>

            {/* File list */}
            {files.length > 0 && (
                <div className={`${c.card} border ${c.cardBorder} rounded-2xl mt-4 overflow-hidden`}>
                    <div className="px-4 py-3 flex items-center justify-between">
                        <p className={`text-sm font-medium`}>{files.length} file đã chọn</p>
                        <button
                            onClick={handleUpload}
                            disabled={uploading}
                            className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center gap-1.5"
                        >
                            {uploading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Đang upload...
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                    </svg>
                                    Upload & Xử lý AI
                                </>
                            )}
                        </button>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                        {files.map((file, i) => {
                            const key = `${file.name}-${i}`
                            const status = uploadProgress[key]
                            return (
                                <div key={key} className="px-4 py-2.5 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-black/30 overflow-hidden shrink-0 flex items-center justify-center">
                                        {file.type.startsWith('image/') ? (
                                            <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg className="w-4 h-4 text-white/30" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs truncate ${c.textSoft}`}>{file.name}</p>
                                        <p className={`text-[10px] ${c.textMicro}`}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                                    </div>
                                    {status === 'uploading' && (
                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    )}
                                    {status === 'done' && (
                                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    )}
                                    {status === 'error' && (
                                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    )}
                                    {!status && (
                                        <button onClick={() => removeFile(i)} className={`${c.textMuted} hover:text-red-400 transition-colors`}>
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Recent uploads / jobs */}
            <div className="mt-6">
                <h2 className={`text-sm font-semibold mb-3 ${c.textSoft}`}>Upload gần đây</h2>
                {jobsLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : jobs.length === 0 ? (
                    <div className={`text-center py-12 ${c.card} border ${c.cardBorder} rounded-2xl`}>
                        <p className={c.textMuted + ' text-sm'}>Chưa có upload nào</p>
                    </div>
                ) : (
                    <div className={`${c.card} border ${c.cardBorder} rounded-2xl overflow-hidden divide-y divide-border/40`}>
                        {jobs.map(job => {
                            const badge = STATUS_BADGE[job.status] || STATUS_BADGE.QUEUED
                            return (
                                <div key={job.id} className="px-4 py-3 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-black/30 overflow-hidden shrink-0">
                                        {job.mediaItem.type === 'video' ? (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
                                                <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
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
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-xs font-medium truncate`}>
                                                {job.mediaItem.originalName || 'Media'}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        <p className={`text-[11px] ${c.textMuted} truncate`}>
                                            {job.channel.displayName}
                                            {job.post?.scheduledAt && (
                                                <> · 📅 {new Date(job.post.scheduledAt).toLocaleDateString('vi-VN', {
                                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                })}</>
                                            )}
                                        </p>
                                        {job.post?.content && (
                                            <p className={`text-[11px] ${c.textSubtle} truncate mt-0.5`}>
                                                {job.post.content.slice(0, 100)}
                                            </p>
                                        )}
                                    </div>
                                    <span className={`text-[10px] ${c.textMicro} shrink-0`}>
                                        {new Date(job.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )
}
