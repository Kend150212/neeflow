'use client'

import { useBranding } from '@/lib/use-branding'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { PlatformIcon } from '@/components/platform-icons'

// ─── Types ───────────────────────────────────────────────
interface MediaItem { url: string; thumbnailUrl: string | null; type: string; id?: string }
interface PostMedia { mediaItem: MediaItem }
interface Approval { action: string }
interface PlatformStatus { platform: string; status?: string }
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

// ─── Theme ───────────────────────────────────────────────
type Theme = 'dark' | 'light'

function useTheme() {
    const [theme, setTheme] = useState<Theme>('dark')
    useEffect(() => {
        const saved = localStorage.getItem('portal-theme') as Theme
        if (saved === 'light' || saved === 'dark') setTheme(saved)
    }, [])
    const toggle = () => {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        localStorage.setItem('portal-theme', next)
    }
    return { theme, toggle }
}

// Theme colors helper
function t(theme: Theme) {
    const dark = theme === 'dark'
    return {
        bg: dark ? 'bg-[#0a0a0f]' : 'bg-gray-50',
        text: dark ? 'text-white' : 'text-gray-900',
        textMuted: dark ? 'text-white/40' : 'text-gray-500',
        textSubtle: dark ? 'text-white/25' : 'text-gray-400',
        textSoft: dark ? 'text-white/60' : 'text-gray-600',
        textMicro: dark ? 'text-white/20' : 'text-gray-300',
        sidebar: dark ? 'bg-[#0f0f16]' : 'bg-white',
        sidebarBorder: dark ? 'border-white/[0.06]' : 'border-gray-200',
        card: dark ? 'bg-[#12121a]' : 'bg-white',
        cardBorder: dark ? 'border-white/[0.06]' : 'border-gray-200',
        cardHover: dark ? 'hover:border-white/[0.1]' : 'hover:border-gray-300',
        inputBg: dark ? 'bg-white/[0.03]' : 'bg-gray-50',
        inputBorder: dark ? 'border-white/[0.08]' : 'border-gray-200',
        hoverBg: dark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-100',
        activeBg: dark ? 'bg-indigo-500/15' : 'bg-indigo-50',
        activeText: dark ? 'text-indigo-400' : 'text-indigo-600',
        calCell: dark ? 'border-white/[0.03]' : 'border-gray-100',
        calCellMuted: dark ? 'opacity-30' : 'opacity-40',
        calCardBg: dark ? 'bg-white/[0.03]' : 'bg-gray-50',
        calCardHover: dark ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-100',
        overlay: dark ? 'bg-black/60' : 'bg-black/30',
        pillInactive: dark ? 'text-white/30 border-white/10 hover:border-white/25' : 'text-gray-400 border-gray-200 hover:border-gray-400',
    }
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
    const c = t(theme)

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
            return { from: f, to: tt, title: `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}` }
        } else {
            const f = getWeekStart(currentDate)
            const tt = new Date(f)
            tt.setDate(f.getDate() + 6)
            tt.setHours(23, 59, 59, 999)
            const startDay = f.getDate()
            const endDay = tt.getDate()
            const label = f.getMonth() === tt.getMonth()
                ? `${MONTH_NAMES[f.getMonth()]} ${startDay} – ${endDay}, ${tt.getFullYear()}`
                : `${MONTH_NAMES[f.getMonth()]} ${startDay} – ${MONTH_NAMES[tt.getMonth()]} ${endDay}, ${tt.getFullYear()}`
            return { from: f, to: tt, title: label }
        }
    }, [calView, currentDate])

    // ─── Load initial data ───────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [profileRes, postsRes] = await Promise.all([
                fetch('/api/portal/profile'),
                fetch('/api/portal/posts'),
            ])
            const profileData = await profileRes.json()
            const postsData = await postsRes.json()
            setProfile(profileData.user)
            setChannels(profileData.channels || [])
            setPendingPosts(postsData.posts || [])
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [])

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
        if (res.ok) setDone((d) => ({ ...d, [postId]: action }))
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
            <div className={`min-h-screen flex items-center justify-center ${c.bg}`}>
                <div className="flex flex-col items-center gap-4">
                    <Image src={branding.logoUrl} alt={branding.appName} width={48} height={48} className="rounded-xl" unoptimized />
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen ${c.bg} ${c.text} flex`}>
            {/* ─── Mobile overlay ──────────────────────── */}
            {sidebarOpen && (
                <div className={`fixed inset-0 ${c.overlay} z-30 lg:hidden`} onClick={() => setSidebarOpen(false)} />
            )}

            {/* ─── Sidebar ────────────────────────────── */}
            <aside className={`
                fixed lg:sticky top-0 left-0 h-screen w-[260px] ${c.sidebar} border-r ${c.sidebarBorder}
                flex flex-col z-40 transition-transform duration-200
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Logo */}
                <div className={`p-4 flex items-center gap-3 border-b ${c.sidebarBorder}`}>
                    <Image src={branding.logoUrl} alt={branding.appName} width={32} height={32} className="rounded-xl" unoptimized />
                    <div className="flex-1 min-w-0">
                        <h1 className="font-bold text-sm tracking-tight">{branding.appName}</h1>
                        <p className={`text-[9px] ${c.textMicro} uppercase tracking-[0.15em]`}>Client Portal</p>
                    </div>
                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className={`p-1.5 rounded-lg ${c.hoverBg} transition-colors`}
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Channel Switcher — directly under logo */}
                <div className={`px-3 pt-3 pb-2 border-b ${c.sidebarBorder}`}>
                    <p className={`px-2 mb-1.5 text-[9px] ${c.textMicro} uppercase tracking-[0.15em] font-semibold`}>Your Channels</p>
                    <button
                        onClick={() => setSelectedChannel('all')}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all mb-0.5 ${selectedChannel === 'all'
                            ? `${c.activeBg} ${c.activeText} font-medium`
                            : `${c.textMuted} ${c.hoverBg}`
                            }`}
                    >
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'}`}>⊕</span>
                        All Channels
                    </button>
                    {channels.map((ch) => (
                        <button
                            key={ch.id}
                            onClick={() => setSelectedChannel(ch.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${selectedChannel === ch.id
                                ? `${c.activeBg} ${c.activeText} font-medium`
                                : `${c.textMuted} ${c.hoverBg}`
                                }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.isActive ? 'bg-emerald-500' : theme === 'dark' ? 'bg-white/20' : 'bg-gray-300'}`} />
                            <span className="truncate">{ch.displayName}</span>
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-0.5">
                    <button
                        onClick={() => { setActiveTab('review'); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all ${activeTab === 'review'
                            ? `${c.activeBg} ${c.activeText} font-medium`
                            : `${c.textMuted} ${c.hoverBg}`
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                        </svg>
                        Pending Review
                        {filteredPending.length > 0 && (
                            <span className="ml-auto bg-indigo-500/20 text-indigo-400 text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                                {filteredPending.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => { setActiveTab('calendar'); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all ${activeTab === 'calendar'
                            ? `${c.activeBg} ${c.activeText} font-medium`
                            : `${c.textMuted} ${c.hoverBg}`
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        Calendar
                    </button>
                    <button
                        onClick={() => { setActiveTab('upload'); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all ${activeTab === 'upload'
                            ? `${c.activeBg} ${c.activeText} font-medium`
                            : `${c.textMuted} ${c.hoverBg}`
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Upload Media
                    </button>
                </nav>

                {/* Profile */}
                <div className={`p-3 border-t ${c.sidebarBorder}`}>
                    <div className="flex items-center gap-2.5 px-2 py-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{profile?.name || 'Customer'}</p>
                            <p className={`text-[10px] ${c.textSubtle} truncate`}>{profile?.email}</p>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            title="Sign out"
                            className={`p-1 rounded-lg ${c.textSubtle} ${c.hoverBg} transition-colors`}
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
                            className={`w-full flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg text-xs font-medium ${c.textSoft} ${c.hoverBg} transition-colors`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                            Switch to Dashboard
                        </button>
                    )}
                </div>
            </aside>

            {/* ─── Main Content ───────────────────────── */}
            <main className="flex-1 min-h-screen flex flex-col">
                {/* Top bar (mobile) */}
                <header className={`lg:hidden sticky top-0 z-20 ${c.bg}/90 backdrop-blur border-b ${c.sidebarBorder}`}>
                    <div className="flex items-center justify-between px-4 h-12">
                        <button onClick={() => setSidebarOpen(true)} className={`p-1.5 -ml-1.5 ${c.textSoft}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                        <Image src={branding.logoUrl} alt={branding.appName} width={24} height={24} className="rounded-lg" unoptimized />
                        <button onClick={toggleTheme} className={`p-1.5 ${c.textSoft}`}>
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
                    <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                        <ReviewTab
                            posts={filteredPending}
                            comments={comments}
                            setComments={setComments}
                            submitting={submitting}
                            done={done}
                            reviewedCount={reviewedCount}
                            handleAction={handleAction}
                            selectedChannel={selectedChannel}
                            theme={theme}
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
// Review Tab
// ─────────────────────────────────────────────────────────
function ReviewTab({
    posts, comments, setComments, submitting, handleAction, reviewedCount, selectedChannel, theme,
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
}) {
    const c = t(theme)

    return (
        <>
            <div className="mb-6">
                <h1 className="text-xl font-bold tracking-tight">Pending Review</h1>
                <p className={`${c.textMuted} text-sm mt-1`}>
                    {posts.length} post{posts.length !== 1 ? 's' : ''} waiting for your approval
                    {reviewedCount > 0 && <span className="text-emerald-400"> · {reviewedCount} reviewed ✓</span>}
                    {selectedChannel !== 'all' && <span className={c.activeText}> · filtered</span>}
                </p>
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

            {posts.length === 0 && (
                <div className="text-center py-20">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-gray-100'} flex items-center justify-center`}>
                        <svg className={`w-7 h-7 ${c.textMicro}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className={`text-base font-semibold mb-1 ${c.textSoft}`}>All caught up!</h2>
                    <p className={`${c.textMuted} text-sm`}>No posts are waiting for your review.</p>
                </div>
            )}

            <div className="space-y-4">
                {posts.map((post) => (
                    <div key={post.id} className={`${c.card} border ${c.cardBorder} rounded-2xl overflow-hidden ${c.cardHover} transition-colors`}>
                        <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span className={`${c.activeText} font-medium text-xs`}>{post.channel.displayName}</span>
                                </div>
                                <p className={`${c.textSubtle} text-[11px] mt-0.5 ml-3`}>
                                    by {post.author?.name || post.author?.email || 'Unknown'}
                                    {post.scheduledAt && (
                                        <> · <span className="text-amber-400/60">📅 {new Date(post.scheduledAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></>
                                    )}
                                </p>
                            </div>
                            <div className="flex gap-1.5 items-center">
                                {post.platformStatuses.map((ps) => (
                                    <PlatformIcon key={ps.platform} platform={ps.platform} size="xs" />
                                ))}
                            </div>
                        </div>

                        {post.media.length > 0 && (
                            <div className={`grid gap-0.5 ${post.media.length === 1 ? '' : 'grid-cols-2'}`}>
                                {post.media.slice(0, 4).map((m, i) => (
                                    <div key={i} className="relative aspect-video bg-black/60 overflow-hidden">
                                        {m.mediaItem.type === 'video' ? (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                </div>
                                            </div>
                                        ) : (
                                            <Image src={m.mediaItem.thumbnailUrl || m.mediaItem.url} alt="" fill className="object-cover" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {post.content && (
                            <div className="px-4 py-3">
                                <p className={`${c.textSoft} text-sm leading-relaxed whitespace-pre-wrap line-clamp-5`}>{post.content}</p>
                            </div>
                        )}

                        <div className="px-4 pb-4 space-y-2.5">
                            <textarea
                                value={comments[post.id] || ''}
                                onChange={(e) => setComments((cc) => ({ ...cc, [post.id]: e.target.value }))}
                                placeholder="Add feedback (optional)..."
                                rows={2}
                                className={`w-full ${c.inputBg} border ${c.inputBorder} rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:border-indigo-500/40 transition-all ${theme === 'dark' ? 'placeholder:text-white/15' : 'placeholder:text-gray-400'}`}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleAction(post.id, 'REJECTED')}
                                    disabled={submitting[post.id]}
                                    className="flex-1 border border-red-500/30 hover:bg-red-500/10 text-red-400 font-medium py-2 rounded-xl transition-all text-sm disabled:opacity-30 flex items-center justify-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleAction(post.id, 'APPROVED')}
                                    disabled={submitting[post.id]}
                                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-2 rounded-xl transition-all text-sm disabled:opacity-30 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    Approve
                                </button>
                            </div>
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
    const c = t(theme)

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header row */}
            <div className="flex flex-col gap-3 pb-3 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 mr-2">
                        <svg className={`w-5 h-5 ${c.activeText}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        <h1 className="text-lg font-bold tracking-tight">Content Calendar</h1>
                    </div>

                    {/* Today button */}
                    <button onClick={handleToday} className={`px-3 py-1.5 rounded-lg ${theme === 'dark' ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'} text-xs font-medium transition-all`}>
                        Today
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
                    <div className={`flex items-center rounded-lg border ${theme === 'dark' ? 'border-white/[0.08]' : 'border-gray-200'} p-0.5 ml-auto`}>
                        <button
                            onClick={() => setCalView('month')}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${calView === 'month' ? 'bg-indigo-500 text-white' : `${c.textMuted}`}`}
                        >Month</button>
                        <button
                            onClick={() => setCalView('week')}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${calView === 'week' ? 'bg-indigo-500 text-white' : `${c.textMuted}`}`}
                        >Week</button>
                    </div>

                    {calLoading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
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
                                {platform.toUpperCase().slice(0, 2)}
                            </button>
                        )
                    })}
                    {activePlatforms.size > 0 && (
                        <button
                            onClick={() => togglePlatform('')}
                            className={`text-[10px] ${c.textMuted} underline underline-offset-2 ml-1 transition-colors`}
                        >Clear</button>
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
    const c = t(theme)
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
                {DAY_NAMES.map(d => (
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
                                } ${isToday ? 'bg-indigo-500/[0.06]' : ''}`}
                        >
                            <button
                                onClick={() => onDayClick(date)}
                                className={`h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-medium self-end transition-colors ${isToday ? 'bg-indigo-500 text-white' : `${c.textMuted} ${c.calCardHover}`
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
                                    +{posts.length - 3} more
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
    const c = t(theme)
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
                            <p className={`text-[10px] ${c.textSubtle} uppercase`}>{DAY_NAMES[i]}</p>
                            <div className={`h-7 w-7 mx-auto flex items-center justify-center rounded-full text-sm font-semibold mt-0.5 ${isToday ? 'bg-indigo-500 text-white' : c.textSoft
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
                        <div key={i} className={`border-r ${c.calCell} last:border-r-0 p-1.5 flex flex-col gap-1.5 min-h-[300px] ${isToday ? 'bg-indigo-500/[0.04]' : ''}`}>
                            {posts.length === 0 ? (
                                <p className={`text-[10px] ${c.textMicro} text-center mt-8`}>No posts</p>
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
    const c = t(theme)
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

    // Load recent jobs
    useEffect(() => {
        const loadJobs = async () => {
            try {
                const params = selectedChannel !== 'all' ? `?channelId=${selectedChannel}` : ''
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
    }, [selectedChannel])

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
        const targetChannel = selectedChannel !== 'all' ? selectedChannel : channels[0]?.id
        if (!targetChannel) return
        if (files.length === 0) return

        setUploading(true)
        const progress: Record<string, 'pending' | 'uploading' | 'done' | 'error'> = {}
        files.forEach((f, i) => { progress[`${f.name}-${i}`] = 'pending' })
        setUploadProgress({ ...progress })

        const uploadedItems: Array<{
            url: string; thumbnailUrl?: string; type: string; originalName?: string
            fileSize?: number; mimeType?: string
        }> = []

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const key = `${file.name}-${i}`
            progress[key] = 'uploading'
            setUploadProgress({ ...progress })

            try {
                // Use existing init-upload → complete-upload flow
                const initRes = await fetch('/api/admin/media/init-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: targetChannel,
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                    }),
                })
                const initData = await initRes.json()

                if (initData.uploadUrl) {
                    // Upload to presigned URL
                    await fetch(initData.uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type },
                    })
                }

                // Complete upload
                const completeRes = await fetch('/api/admin/media/complete-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: targetChannel,
                        uploadId: initData.uploadId,
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                    }),
                })
                const completeData = await completeRes.json()

                uploadedItems.push(completeData.id)
                progress[key] = 'done'
            } catch {
                progress[key] = 'error'
            }
            setUploadProgress({ ...progress })
        }

        // Create pipeline jobs for all successfully uploaded items
        if (uploadedItems.length > 0) {
            try {
                await fetch('/api/portal/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: targetChannel,
                        mediaItemIds: uploadedItems,
                    }),
                })
            } catch (e) { console.error('Failed to create pipeline jobs', e) }
        }

        // Refresh jobs list
        setTimeout(async () => {
            const params = selectedChannel !== 'all' ? `?channelId=${selectedChannel}` : ''
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

            {/* Select channel if "all" */}
            {selectedChannel === 'all' && channels.length > 1 && (
                <div className={`${c.card} border ${c.cardBorder} rounded-2xl p-4 mb-4`}>
                    <p className={`text-sm ${c.textSoft} mb-2`}>Chọn channel để upload:</p>
                    <div className="flex flex-wrap gap-2">
                        {channels.map(ch => (
                            <button
                                key={ch.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${c.activeBg} ${c.activeText} border-indigo-500/30`}
                            >
                                {ch.displayName}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`${c.card} border-2 border-dashed ${dragOver ? 'border-indigo-500 bg-indigo-500/5' : c.cardBorder} rounded-2xl p-8 text-center transition-all cursor-pointer`}
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
                <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl ${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-gray-100'} flex items-center justify-center`}>
                    <svg className={`w-7 h-7 ${dragOver ? 'text-indigo-400' : c.textMicro}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                </div>
                <h3 className={`text-sm font-semibold mb-1 ${dragOver ? 'text-indigo-400' : c.textSoft}`}>
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
                            className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
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
                                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : jobs.length === 0 ? (
                    <div className={`text-center py-12 ${c.card} border ${c.cardBorder} rounded-2xl`}>
                        <p className={c.textMuted + ' text-sm'}>Chưa có upload nào</p>
                    </div>
                ) : (
                    <div className={`${c.card} border ${c.cardBorder} rounded-2xl overflow-hidden divide-y ${theme === 'dark' ? 'divide-white/[0.04]' : 'divide-gray-100'}`}>
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
