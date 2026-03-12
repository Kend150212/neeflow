'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWorkspace } from '@/lib/workspace-context'
import { useTranslation } from '@/lib/i18n'
import { PlatformIcon } from '@/components/platform-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
} from 'recharts'
import {
    BarChart2,
    RefreshCw,
    Download,
    Users,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    TrendingUp,
    FileText,
    Send,
    Calendar,
    XCircle,
    Clock,
    FileBarChart2,
    AlertCircle,
    ExternalLink,
    Plug,
    ChevronRight,
    Bookmark,
    Play,
    UserCheck,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────
interface KPI {
    total: number; published: number; scheduled: number
    failed: number; drafts: number; pendingApproval: number
}
interface DayData { date: string; total: number; published: number; scheduled: number }
interface PlatformCount { platform: string; published: number; failed: number; total: number }
interface StatusData { name: string; value: number }
interface ReportsData {
    kpi: KPI; postsOverTime: DayData[]
    platformBreakdown: PlatformCount[]; statusBreakdown: StatusData[]
}

interface PlatformInsight {
    platform: string; accountName: string
    followers: number | null; newFollowers?: number | null
    engagement: number | null; impressions: number | null; reach: number | null
    mediaCount?: number | null; videoCount?: number | null
    recentViews?: number | null; recentLikes?: number | null; recentComments?: number | null
    saves?: number | null
    topPins?: { pinId: string; title: string; imageUrl: string | null; impressions: number; saves: number; clicks: number; pinUrl: string }[]
    pendingApproval?: boolean
    // TikTok-specific
    following?: number | null
    totalAccountLikes?: number | null
    recentShares?: number | null
    viewsTimeSeries?: { date: string; value: number }[]
    interactionsTimeSeries?: { date: string; value: number }[]
    // YouTube-specific
    totalChannelViews?: number | null
    engagementTimeSeries?: { date: string; value: number }[]
    recentVideos?: {
        // TikTok fields
        id: string; title: string; coverImageUrl?: string | null; createTime?: string | null
        viewCount: number; likeCount: number; commentCount: number; shareCount?: number
        // YouTube fields
        thumbnail?: string | null; publishedAt?: string | null
        duration?: number; tags?: string[]
    }[]
}

interface PostInsight {
    postId: string; platform: string; accountName?: string | null; content: string | null; thumbnail: string | null
    publishedAt: string | null; likes: number; comments: number; shares: number; reach: number; impressions: number
}

// ─── Platforms with real live API data ───────────────────────────────
const LIVE_API_PLATFORMS = new Set(['facebook', 'instagram', 'youtube', 'tiktok', 'pinterest', 'linkedin'])

// ─── Constants ───────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
    facebook: '#1877f2', instagram: '#e1306c', youtube: '#ff0000', tiktok: '#010101',
    linkedin: '#0a66c2', pinterest: '#e60023', x: '#000000', gbp: '#34a853',
}
const PLATFORM_LABELS: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok',
    linkedin: 'LinkedIn', pinterest: 'Pinterest', x: 'X (Twitter)', gbp: 'Google Business',
}
const PIE_COLORS: Record<string, string> = {
    PUBLISHED: '#22c55e', SCHEDULED: '#f59e0b', DRAFT: '#6b7280',
    FAILED: '#ef4444', PENDING_APPROVAL: '#8b5cf6',
}

function platformColor(p: string) { return PLATFORM_COLORS[p] || '#6b7280' }

function fmt(n: number | null | undefined) {
    if (n == null) return '—'
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return String(n)
}

// ─── Shared Post Card ─────────────────────────────────────────────────
interface PostCardProps {
    thumbnail?: string | null
    publishedAt?: string | null
    platform?: string
    metrics: { icon: React.ElementType; label: string; value: number | null | undefined; color: string }[]
    pendingMessage?: string
    href?: string
}
function PostCard({ thumbnail, publishedAt, platform, metrics, pendingMessage, href }: PostCardProps) {
    const allZero = metrics.every(m => !m.value)
    const Wrapper = href ? 'a' : 'div'
    const wrapperProps = href ? { href, target: '_blank' as const, rel: 'noopener noreferrer' } : {}
    return (
        <Wrapper {...wrapperProps} className="group relative rounded-xl overflow-hidden border border-border/60 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5 flex flex-col bg-card">
            {/* Image */}
            <div className="relative overflow-hidden" style={{ aspectRatio: '1/1' }}>
                {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                )}
                {/* Gradient overlay with date + platform */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-end justify-between">
                    {publishedAt && (
                        <span className="text-[10px] text-white/80 font-medium">
                            {new Date(publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </span>
                    )}
                    {platform && (
                        <div className="w-4 h-4 shrink-0">
                            <PlatformIcon platform={platform} size="sm" />
                        </div>
                    )}
                </div>
            </div>
            {/* Metrics */}
            <div className="px-3 py-2.5 space-y-1.5 flex-1">
                {allZero && pendingMessage ? (
                    <div className="flex flex-col items-center justify-center py-1.5 gap-1">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[10px] text-muted-foreground text-center">{pendingMessage}</span>
                    </div>
                ) : (
                    metrics.map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="flex items-center justify-between">
                            <div className={`flex items-center gap-1.5 text-[11px] ${color}`}>
                                <Icon className="h-3 w-3" />
                                <span className="text-muted-foreground">{label}</span>
                            </div>
                            <span className="text-[11px] font-semibold font-mono tabular-nums">{fmt(value)}</span>
                        </div>
                    ))
                )}
            </div>
        </Wrapper>
    )
}

// ─── Tooltip ──────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-card border rounded-lg p-3 shadow-lg text-xs">
            {label && <p className="font-medium mb-1">{label}</p>}
            {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>)}
        </div>
    )
}

// ─── KBI Card ─────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }) {
    return (
        <Card>
            <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${color}`}><Icon className="h-5 w-5 text-white" /></div>
                <div>
                    <p className="text-2xl font-bold">{fmt(value)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
            </CardContent>
        </Card>
    )
}

// ─── Mini Donut Chart ──────────────────────────────────────────────────
function DonutChart({ data, size = 80 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
    const total = data.reduce((s, d) => s + d.value, 0)
    if (total === 0) return <div style={{ width: size, height: size }} className="rounded-full bg-muted/40 mx-auto" />
    let offset = 0
    const r = size / 2 - 8
    const cx = size / 2
    const circumference = 2 * Math.PI * r
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto -rotate-90">
            {data.map((d, i) => {
                const pct = d.value / total
                const dash = pct * circumference
                const gap = circumference - dash
                const seg = (
                    <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={d.color}
                        strokeWidth={10} strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={-offset * circumference} />
                )
                offset += pct
                return seg
            })}
        </svg>
    )
}

// ─── Platform Account Card ─────────────────────────────────────────────
function AccountCard({ insight, posts }: { insight: PlatformInsight; posts: PostInsight[] }) {
    const t = useTranslation()
    const color = platformColor(insight.platform)
    const topPosts = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 3)
    const hasRealData = LIVE_API_PLATFORMS.has(insight.platform)
    const isTabbed = insight.platform === 'facebook' || insight.platform === 'instagram' || insight.platform === 'linkedin' || insight.platform === 'tiktok' || insight.platform === 'youtube'
    const isMeta = insight.platform === 'facebook' || insight.platform === 'instagram'
    const isTikTok = insight.platform === 'tiktok'
    const isYouTube = insight.platform === 'youtube'
    const ins = insight as any

    // Tab state — FB/IG/LinkedIn/TikTok get tabs
    const TAB_VIEWS = 'views'
    const TAB_INTERACTIONS = 'interactions'
    const TAB_AUDIENCE = 'audience'
    const TAB_POSTS = 'posts'
    // TikTok tabs
    const TAB_TT_OVERVIEW = 'tt_overview'
    const TAB_TT_VIDEOS = 'tt_videos'
    const TAB_TT_ENGAGEMENT = 'tt_engagement'
    const TAB_TT_TOP = 'tt_top'
    // YouTube tabs
    const TAB_YT_OVERVIEW = 'yt_overview'
    const TAB_YT_VIDEOS = 'yt_videos'
    const TAB_YT_ENGAGEMENT = 'yt_engagement'
    const TAB_YT_TOP = 'yt_top'

    const metaTabs = [
        { id: TAB_VIEWS, label: t('insights.tabs.views') },
        { id: TAB_INTERACTIONS, label: t('insights.tabs.interactions') },
        { id: TAB_AUDIENCE, label: t('insights.tabs.audience') },
        { id: TAB_POSTS, label: t('insights.tabs.posts') },
    ]
    const tiktokTabs = [
        { id: TAB_TT_OVERVIEW, label: 'Overview' },
        { id: TAB_TT_VIDEOS, label: 'Videos' },
        { id: TAB_TT_ENGAGEMENT, label: 'Engagement' },
        { id: TAB_TT_TOP, label: 'Top Videos' },
    ]
    const youtubeTabs = [
        { id: TAB_YT_OVERVIEW, label: 'Overview' },
        { id: TAB_YT_VIDEOS, label: 'Videos' },
        { id: TAB_YT_ENGAGEMENT, label: 'Engagement' },
        { id: TAB_YT_TOP, label: 'Top Videos' },
    ]
    const [activeTab, setActiveTab] = useState(
        isTikTok ? TAB_TT_OVERVIEW : isYouTube ? TAB_YT_OVERVIEW : TAB_VIEWS
    )

    // FB data
    const fbPosts: Array<{ id: string; createdTime: string; thumbnail?: string; reactions: number; comments: number; shares: number }> =
        ins.recentPosts || []
    const igMedia: Array<{ id: string; timestamp: string; thumbnail?: string; likes: number; comments: number }> =
        ins.recentMedia || []
    type MetaPost = {
        id: string; thumbnail?: string | null; publishedAt: string | null;
        r1: number; r1Label: string; r1Icon: React.ComponentType<{ className?: string }>; r1Color: string;
        r2: number; r2Label: string; r2Icon: React.ComponentType<{ className?: string }>; r2Color: string;
        r3: number; r3Label: string; r3Icon: React.ComponentType<{ className?: string }>; r3Color: string;
    }
    const metaPosts: MetaPost[] = insight.platform === 'facebook' ? fbPosts.map(p => ({
        id: p.id, thumbnail: p.thumbnail, publishedAt: p.createdTime,
        r1: p.reactions, r1Label: t('insights.kpi.reactions'), r1Icon: Heart, r1Color: 'text-rose-400',
        r2: p.comments, r2Label: t('insights.kpi.comments'), r2Icon: MessageCircle, r2Color: 'text-blue-400',
        r3: p.shares, r3Label: t('insights.kpi.shares'), r3Icon: Share2, r3Color: 'text-green-400',
    })) : insight.platform === 'instagram' ? igMedia.map(m => ({
        id: m.id, thumbnail: m.thumbnail, publishedAt: m.timestamp,
        r1: m.likes, r1Label: t('insights.kpi.likes'), r1Icon: Heart, r1Color: 'text-rose-400',
        r2: m.comments, r2Label: t('insights.kpi.comments'), r2Icon: MessageCircle, r2Color: 'text-blue-400',
        r3: 0, r3Label: '', r3Icon: Share2, r3Color: '',
    })) : (ins.recentPosts || []).map((p: { id: string; thumbnail?: string | null; publishedAt: string | null; likes: number; comments: number; clicks?: number; shares?: number }) => ({
        id: p.id, thumbnail: p.thumbnail, publishedAt: p.publishedAt,
        r1: p.likes, r1Label: t('insights.kpi.likes'), r1Icon: Heart, r1Color: 'text-rose-400',
        r2: p.comments, r2Label: t('insights.kpi.comments'), r2Icon: MessageCircle, r2Color: 'text-blue-400',
        r3: p.clicks ?? p.shares ?? 0, r3Label: p.clicks != null ? t('insights.kpi.clicks') : t('insights.kpi.shares'), r3Icon: p.clicks != null ? ExternalLink : Share2, r3Color: 'text-blue-400',
    }))


    const viewsTimeSeries: { date: string; value: number }[] = ins.viewsTimeSeries || []
    const interactionsTimeSeries: { date: string; value: number }[] = ins.interactionsTimeSeries || []
    const engagementTimeSeries: { date: string; value: number }[] = ins.engagementTimeSeries || []
    const contentTypeBreakdown: { type: string; count: number; pct: number }[] = ins.contentTypeBreakdown || []
    const totalInteractions = (ins.reactions ?? 0) + (ins.comments ?? 0) + (ins.shares ?? 0)
        + (ins.likes ?? 0)

    // YouTube data helpers
    const ytVideos: { id: string; title: string; thumbnail?: string | null; publishedAt?: string | null; duration?: number; tags?: string[]; viewCount: number; likeCount: number; commentCount: number }[] = isYouTube ? (ins.recentVideos || []) : []
    const ytTotalViews = ytVideos.reduce((s: number, v: { viewCount: number }) => s + v.viewCount, 0)
    const ytTotalLikes = ytVideos.reduce((s: number, v: { likeCount: number }) => s + v.likeCount, 0)
    const ytTotalComments = ytVideos.reduce((s: number, v: { commentCount: number }) => s + v.commentCount, 0)
    const formatDuration = (sec: number) => {
        if (!sec) return '0:00'
        const h = Math.floor(sec / 3600)
        const m = Math.floor((sec % 3600) / 60)
        const s = sec % 60
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`
    }

    // Fallback sparkline for non-FB/IG
    const base = Math.round((insight.reach || insight.impressions || 0) / 7)
    const sparkData = Array.from({ length: 7 }, (_, i) => ({
        v: Math.max(0, Math.round(base * (0.5 + 0.5 * Math.sin(i * 1.2 + 1))))
    }))

    const gradId = `grad-${insight.platform}-${insight.accountName.replace(/\s/g, '')}`

    // Content type label helper — covers FB/IG/LI types
    const ctLabel = (type: string) => ({
        photo: t('insights.contentType.photo'),
        image: t('insights.contentType.image'),
        video: t('insights.contentType.video'),
        reel: t('insights.contentType.reel'),
        multi_photo: t('insights.contentType.multiPhoto'),
        article: t('insights.contentType.article'),
        document: t('insights.contentType.document'),
        text: t('insights.contentType.text'),
        other: t('insights.contentType.other'),
    })[type] || type

    return (
        <div className="border rounded-xl overflow-hidden hover:border-primary/40 transition-all duration-200">
            {/* Account header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: color + '10' }}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: color + '20', border: `2px solid ${color}40` }}>
                        <div className="w-5 h-5"><PlatformIcon platform={insight.platform} size="sm" /></div>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{insight.accountName}</p>
                        <p className="text-[11px] text-muted-foreground">{PLATFORM_LABELS[insight.platform] || insight.platform}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {insight.pendingApproval && (
                        <Badge variant="outline" className="text-[9px] h-5 px-1.5 text-amber-600 border-amber-400">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />{t('insights.status.apiPending')}
                        </Badge>
                    )}
                    {!hasRealData && (
                        <Badge variant="outline" className="text-[9px] h-5 px-1.5 text-muted-foreground">
                            {t('insights.status.limited')}
                        </Badge>
                    )}
                </div>
            </div>

            {/* ── TABBED LAYOUT: Facebook, Instagram, LinkedIn & TikTok ── */}
            {isTabbed ? (
                <div>
                    {/* Tab bar */}
                    <div className="flex border-b overflow-x-auto scrollbar-none">
                        {(isTikTok ? tiktokTabs : isYouTube ? youtubeTabs : metaTabs).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-4 space-y-5">
                        {/* ── VIEWS TAB ── */}
                        {activeTab === TAB_VIEWS && (
                            <>
                                {/* KPIs */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="bg-muted/40 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                                        <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(ins.views ?? ins.impressions ?? insight.impressions)}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {insight.platform === 'linkedin' ? t('insights.kpi.impressions') : t('insights.kpi.totalViews')}
                                        </p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Users className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(insight.followers)}</p>
                                        <p className="text-[10px] text-muted-foreground">{t('insights.kpi.followers')}</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(ins.newFollowers ?? 0)}</p>
                                        <p className="text-[10px] text-muted-foreground">{t('insights.kpi.newFollowers')}</p>
                                    </div>
                                </div>

                                {/* Daily views chart */}
                                {viewsTimeSeries.length > 0 ? (
                                    <div>
                                        <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">{t('insights.chart.last28days')}</p>
                                        <div className="h-36">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={viewsTimeSeries} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} interval={6} />
                                                    <YAxis tick={{ fontSize: 9 }} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Area type="monotone" dataKey="value" name={t('insights.kpi.views')} stroke={color} fill={`url(#${gradId})`} strokeWidth={2} dot={false} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : null}

                                {/* Content type breakdown */}
                                {contentTypeBreakdown.length > 0 && (
                                    <div>
                                        <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">{t('insights.contentType.label')}</p>
                                        <div className="space-y-2">
                                            {contentTypeBreakdown.map(({ type, pct }) => (
                                                <div key={type} className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground w-20 shrink-0">{ctLabel(type)}</span>
                                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                                                    </div>
                                                    <span className="text-xs font-mono w-12 text-right">{pct}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── INTERACTIONS TAB ── */}
                        {activeTab === TAB_INTERACTIONS && (
                            <>
                                {/* KPI row */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Heart className="h-4 w-4 mx-auto mb-1 text-rose-500" />
                                        <p className="text-lg font-bold font-mono">{fmt(ins.reactions ?? ins.likes ?? 0)}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {insight.platform === 'facebook' ? t('insights.kpi.reactions') : t('insights.kpi.likes')}
                                        </p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <MessageCircle className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                                        <p className="text-lg font-bold font-mono">{fmt(ins.comments ?? 0)}</p>
                                        <p className="text-[10px] text-muted-foreground">{t('insights.kpi.comments')}</p>
                                    </div>
                                    {insight.platform === 'linkedin' ? (
                                        <div className="bg-muted/40 rounded-lg p-3 text-center">
                                            <ExternalLink className="h-4 w-4 mx-auto mb-1 text-indigo-500" />
                                            <p className="text-lg font-bold font-mono">{fmt(ins.clicks ?? 0)}</p>
                                            <p className="text-[10px] text-muted-foreground">{t('insights.kpi.clicks')}</p>
                                        </div>
                                    ) : insight.platform === 'facebook' ? (
                                        <div className="bg-muted/40 rounded-lg p-3 text-center">
                                            <Share2 className="h-4 w-4 mx-auto mb-1 text-green-500" />
                                            <p className="text-lg font-bold font-mono">{fmt(ins.shares ?? 0)}</p>
                                            <p className="text-[10px] text-muted-foreground">{t('insights.kpi.shares')}</p>
                                        </div>
                                    ) : null}
                                </div>

                                {/* Interactions chart */}
                                {interactionsTimeSeries.length > 0 && (
                                    <div>
                                        <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">{t('insights.interaction.overview')}</p>
                                        <div className="h-32">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={interactionsTimeSeries} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                                                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} interval={3} />
                                                    <YAxis tick={{ fontSize: 9 }} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar dataKey="value" name={t('insights.kpi.interactions')} fill={color} radius={[3, 3, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Donut by type */}
                                {totalInteractions > 0 && (insight.platform === 'facebook' || insight.platform === 'linkedin') && (
                                    <div>
                                        <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">{t('insights.interaction.byType')}</p>
                                        <div className="flex items-center gap-6">
                                            {insight.platform === 'facebook' ? (
                                                <DonutChart size={88} data={[
                                                    { label: t('insights.kpi.reactions'), value: ins.reactions ?? 0, color: '#f43f5e' },
                                                    { label: t('insights.kpi.comments'), value: ins.comments ?? 0, color: '#3b82f6' },
                                                    { label: t('insights.kpi.shares'), value: ins.shares ?? 0, color: '#22c55e' },
                                                ]} />
                                            ) : (
                                                <DonutChart size={88} data={[
                                                    { label: t('insights.kpi.likes'), value: ins.likes ?? 0, color: '#f43f5e' },
                                                    { label: t('insights.kpi.comments'), value: ins.comments ?? 0, color: '#3b82f6' },
                                                    { label: t('insights.kpi.clicks'), value: ins.clicks ?? 0, color: '#6366f1' },
                                                    { label: t('insights.kpi.shares'), value: ins.shares ?? 0, color: '#22c55e' },
                                                ]} />
                                            )}
                                            <div className="space-y-1.5">
                                                {(insight.platform === 'facebook' ? [
                                                    { label: t('insights.kpi.reactions'), value: ins.reactions ?? 0, color: '#f43f5e' },
                                                    { label: t('insights.kpi.comments'), value: ins.comments ?? 0, color: '#3b82f6' },
                                                    { label: t('insights.kpi.shares'), value: ins.shares ?? 0, color: '#22c55e' },
                                                ] : [
                                                    { label: t('insights.kpi.likes'), value: ins.likes ?? 0, color: '#f43f5e' },
                                                    { label: t('insights.kpi.comments'), value: ins.comments ?? 0, color: '#3b82f6' },
                                                    { label: t('insights.kpi.clicks'), value: ins.clicks ?? 0, color: '#6366f1' },
                                                    { label: t('insights.kpi.shares'), value: ins.shares ?? 0, color: '#22c55e' },
                                                ]).map(({ label, value, color: c }) => (
                                                    <div key={label} className="flex items-center gap-2 text-xs">
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                                                        <span className="text-muted-foreground">{label}</span>
                                                        <span className="font-semibold ml-auto">{fmt(value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── AUDIENCE TAB ── */}
                        {activeTab === TAB_AUDIENCE && (
                            <>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Users className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(insight.followers)}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {insight.platform === 'linkedin' ? t('insights.kpi.connections') : t('insights.audience.totalFollowers')}
                                        </p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
                                        <p className="text-xl font-bold font-mono">+{fmt(ins.newFollowers ?? 0)}</p>
                                        <p className="text-[10px] text-muted-foreground">{t('insights.kpi.newFollowers')}</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(insight.reach ?? insight.impressions ?? 0)}</p>
                                        <p className="text-[10px] text-muted-foreground">{t('insights.kpi.reach')}</p>
                                    </div>
                                </div>
                                <div className="h-20 bg-muted/20 rounded-lg flex flex-col items-center justify-center gap-1 text-center px-4">
                                    {insight.platform === 'linkedin'
                                        ? <p className="text-xs text-muted-foreground">Demographic breakdowns (industry, seniority, country) require LinkedIn Marketing Developer Platform (MDP) access.</p>
                                        : <p className="text-xs text-muted-foreground">Age, gender, country breakdowns require Advanced Access review from Meta.</p>
                                    }
                                </div>
                            </>
                        )}

                        {/* ── POSTS TAB ── */}
                        {activeTab === TAB_POSTS && (
                            <>
                                {metaPosts.length > 0 ? (
                                    <div>
                                        <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">
                                            {t('insights.posts.allPosts')} ({metaPosts.length})
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {metaPosts.map((post, i) => (
                                                <PostCard
                                                    key={post.id || i}
                                                    thumbnail={post.thumbnail}
                                                    publishedAt={post.publishedAt}
                                                    platform={insight.platform}
                                                    metrics={[
                                                        { icon: post.r1Icon, label: post.r1Label, value: post.r1, color: post.r1Color },
                                                        { icon: post.r2Icon, label: post.r2Label, value: post.r2, color: post.r2Color },
                                                        ...(post.r3Label ? [{ icon: post.r3Icon, label: post.r3Label, value: post.r3, color: post.r3Color }] : []),
                                                    ]}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-10 flex flex-col items-center gap-2 text-center">
                                        <FileText className="h-8 w-8 text-muted-foreground/30" />
                                        <p className="text-sm text-muted-foreground">{t('insights.posts.noPostsYet')}</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── TIKTOK TABS ── */}
                        {isTikTok && (() => {
                            const ttViews = ins.viewsTimeSeries || []
                            const ttInteractions = ins.interactionsTimeSeries || []
                            const ttVideos: Array<{
                                id: string; title: string; coverImageUrl: string | null; createTime: string | null
                                viewCount: number; likeCount: number; commentCount: number; shareCount: number
                            }> = ins.recentVideos || []
                            const totalAccountLikes = ins.totalAccountLikes ?? 0
                            const following = ins.following ?? 0
                            const recentViews = insight.recentViews ?? 0
                            const recentLikes = insight.recentLikes ?? 0
                            const recentComments = insight.recentComments ?? 0
                            const recentShares = ins.recentShares ?? 0
                            const ttGradId = `grad-tiktok-${insight.accountName.replace(/\s/g, '')}`

                            return (
                                <>
                                    {/* ── TT OVERVIEW ── */}
                                    {activeTab === TAB_TT_OVERVIEW && (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <Users className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                                                    <p className="text-xl font-bold font-mono">{fmt(insight.followers)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Followers</p>
                                                </div>
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <UserCheck className="h-4 w-4 mx-auto mb-1 text-indigo-500" />
                                                    <p className="text-xl font-bold font-mono">{fmt(following)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Following</p>
                                                </div>
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <Heart className="h-4 w-4 mx-auto mb-1 text-rose-500" />
                                                    <p className="text-xl font-bold font-mono">{fmt(totalAccountLikes)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Total Likes</p>
                                                </div>
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <Play className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                                                    <p className="text-xl font-bold font-mono">{fmt(insight.videoCount)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Videos</p>
                                                </div>
                                            </div>
                                            {/* Recent summary row */}
                                            <div className="bg-gradient-to-r from-[#010101]/5 to-[#010101]/10 border border-[#010101]/10 rounded-xl p-4">
                                                <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">Recent 20 Videos — Performance</p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[
                                                        { label: 'Views', value: recentViews, color: 'text-purple-500' },
                                                        { label: 'Likes', value: recentLikes, color: 'text-rose-500' },
                                                        { label: 'Comments', value: recentComments, color: 'text-blue-500' },
                                                        { label: 'Shares', value: recentShares, color: 'text-green-500' },
                                                    ].map(({ label, value, color }) => (
                                                        <div key={label} className="text-center">
                                                            <p className={`text-lg font-bold font-mono ${color}`}>{fmt(value)}</p>
                                                            <p className="text-[10px] text-muted-foreground">{label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* ── TT VIDEOS (views chart) ── */}
                                    {activeTab === TAB_TT_VIDEOS && (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                                                    <p className="text-xl font-bold font-mono">{fmt(recentViews)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Total Views</p>
                                                </div>
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <Play className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                                                    <p className="text-xl font-bold font-mono">{fmt(insight.videoCount)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Total Videos</p>
                                                </div>
                                            </div>
                                            {ttViews.length > 0 ? (
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Views by Upload Date</p>
                                                    <div className="h-40">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <AreaChart data={ttViews} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                                                                <defs>
                                                                    <linearGradient id={ttGradId} x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#010101" stopOpacity={0.5} />
                                                                        <stop offset="95%" stopColor="#010101" stopOpacity={0} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} interval={2} />
                                                                <YAxis tick={{ fontSize: 9 }} />
                                                                <Tooltip content={<CustomTooltip />} />
                                                                <Area type="monotone" dataKey="value" name="Views" stroke="#010101" fill={`url(#${ttGradId})`} strokeWidth={2} dot={false} />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-20 flex flex-col items-center justify-center bg-muted/20 rounded-lg gap-2">
                                                    <p className="text-xs text-muted-foreground">No time-series data available (video upload dates needed)</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* ── TT ENGAGEMENT ── */}
                                    {activeTab === TAB_TT_ENGAGEMENT && (
                                        <>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <Heart className="h-4 w-4 mx-auto mb-1 text-rose-500" />
                                                    <p className="text-lg font-bold font-mono">{fmt(recentLikes)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Likes</p>
                                                </div>
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <MessageCircle className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                                                    <p className="text-lg font-bold font-mono">{fmt(recentComments)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Comments</p>
                                                </div>
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <Share2 className="h-4 w-4 mx-auto mb-1 text-green-500" />
                                                    <p className="text-lg font-bold font-mono">{fmt(recentShares)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Shares</p>
                                                </div>
                                                <div className="bg-muted/40 rounded-lg p-3 text-center">
                                                    <TrendingUp className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                                                    <p className="text-lg font-bold font-mono">{fmt(recentLikes + recentComments + recentShares)}</p>
                                                    <p className="text-[10px] text-muted-foreground">Total</p>
                                                </div>
                                            </div>
                                            {ttInteractions.length > 0 ? (
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Engagement by Upload Date</p>
                                                    <div className="h-36">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={ttInteractions} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                                                                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} interval={2} />
                                                                <YAxis tick={{ fontSize: 9 }} />
                                                                <Tooltip content={<CustomTooltip />} />
                                                                <Bar dataKey="value" name="Interactions" fill="#010101" radius={[3, 3, 0, 0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            ) : null}
                                            {/* Donut breakdown */}
                                            {(recentLikes + recentComments + recentShares) > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">Breakdown by Type</p>
                                                    <div className="flex items-center gap-6">
                                                        <DonutChart size={88} data={[
                                                            { label: 'Likes', value: recentLikes, color: '#f43f5e' },
                                                            { label: 'Comments', value: recentComments, color: '#3b82f6' },
                                                            { label: 'Shares', value: recentShares, color: '#22c55e' },
                                                        ]} />
                                                        <div className="space-y-1.5">
                                                            {[
                                                                { label: 'Likes', value: recentLikes, color: '#f43f5e' },
                                                                { label: 'Comments', value: recentComments, color: '#3b82f6' },
                                                                { label: 'Shares', value: recentShares, color: '#22c55e' },
                                                            ].map(({ label, value, color: c }) => (
                                                                <div key={label} className="flex items-center gap-2 text-xs">
                                                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                                                                    <span className="text-muted-foreground">{label}</span>
                                                                    <span className="font-semibold ml-auto">{fmt(value)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* ── TT TOP VIDEOS ── */}
                                    {activeTab === TAB_TT_TOP && (
                                        <>
                                            {ttVideos.length > 0 ? (
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">Recent Videos ({ttVideos.length})</p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                        {[...ttVideos]
                                                            .sort((a, b) => b.viewCount - a.viewCount)
                                                            .map((video, idx) => (
                                                                <PostCard
                                                                    key={video.id || idx}
                                                                    thumbnail={video.coverImageUrl}
                                                                    publishedAt={video.createTime}
                                                                    platform="tiktok"
                                                                    metrics={[
                                                                        { icon: Eye, label: 'Views', value: video.viewCount, color: 'text-purple-400' },
                                                                        { icon: Heart, label: 'Likes', value: video.likeCount, color: 'text-rose-400' },
                                                                        { icon: MessageCircle, label: 'Comments', value: video.commentCount, color: 'text-blue-400' },
                                                                        { icon: Share2, label: 'Shares', value: video.shareCount, color: 'text-green-400' },
                                                                    ]}
                                                                />
                                                            ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-10 flex flex-col items-center gap-2 text-center">
                                                    <Play className="h-8 w-8 text-muted-foreground/30" />
                                                    <p className="text-sm text-muted-foreground">No videos found</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )
                        })()}

                        {/* ── YOUTUBE TABS ── */}
                        {isYouTube && (<>
                            {/* YT OVERVIEW */}
                            {activeTab === TAB_YT_OVERVIEW && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Users className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(insight.followers)}</p>
                                        <p className="text-[10px] text-muted-foreground">Subscribers</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(ins.totalChannelViews ?? 0)}</p>
                                        <p className="text-[10px] text-muted-foreground">Total Views (All-Time)</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Play className="h-4 w-4 mx-auto mb-1 text-red-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(insight.videoCount ?? 0)}</p>
                                        <p className="text-[10px] text-muted-foreground">Total Videos</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(ytTotalViews)}</p>
                                        <p className="text-[10px] text-muted-foreground">Recent Views</p>
                                    </div>
                                </div>
                            )}
                            {/* YT VIDEOS */}
                            {activeTab === TAB_YT_VIDEOS && (<>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(ytTotalViews)}</p>
                                        <p className="text-[10px] text-muted-foreground">Total Views (recent {ytVideos.length})</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Play className="h-4 w-4 mx-auto mb-1 text-red-500" />
                                        <p className="text-xl font-bold font-mono">{ytVideos.length}</p>
                                        <p className="text-[10px] text-muted-foreground">Videos Fetched</p>
                                    </div>
                                </div>
                                {viewsTimeSeries.length > 0 ? (
                                    <div>
                                        <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Views by Publish Date</p>
                                        <ResponsiveContainer width="100%" height={140}>
                                            <AreaChart data={viewsTimeSeries} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="ytViewsGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                                                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => fmt(v)} />
                                                <Tooltip formatter={(v: number) => [fmt(v), 'Views']} labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 10 }} />
                                                <Area type="monotone" dataKey="value" stroke="#ef4444" fill="url(#ytViewsGrad)" strokeWidth={2} dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground text-center py-4">No time-series data available</p>
                                )}
                            </>)}
                            {/* YT ENGAGEMENT */}
                            {activeTab === TAB_YT_ENGAGEMENT && (<>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Heart className="h-4 w-4 mx-auto mb-1 text-rose-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(ytTotalLikes)}</p>
                                        <p className="text-[10px] text-muted-foreground">Total Likes</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3 text-center">
                                        <MessageCircle className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                                        <p className="text-xl font-bold font-mono">{fmt(ytTotalComments)}</p>
                                        <p className="text-[10px] text-muted-foreground">Total Comments</p>
                                    </div>
                                </div>
                                {engagementTimeSeries.length > 0 ? (
                                    <div>
                                        <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Engagement by Publish Date</p>
                                        <ResponsiveContainer width="100%" height={140}>
                                            <BarChart data={engagementTimeSeries} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                                                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                                                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => fmt(v)} />
                                                <Tooltip formatter={(v: number) => [fmt(v), 'Engagement']} labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 10 }} />
                                                <Bar dataKey="value" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground text-center py-4">No engagement data available</p>
                                )}
                            </>)}
                            {/* YT TOP VIDEOS */}
                            {activeTab === TAB_YT_TOP && (
                                ytVideos.length > 0 ? (
                                    <div className="space-y-3">
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Top {ytVideos.length} Recent Videos</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {[...ytVideos]
                                                .sort((a, b) => b.viewCount - a.viewCount)
                                                .map((v) => (
                                                    <div key={v.id} className="border rounded-lg overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors">
                                                        <div className="relative aspect-video bg-black/10">
                                                            {v.thumbnail ? (
                                                                <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Play className="h-8 w-8 text-muted-foreground/40" />
                                                                </div>
                                                            )}
                                                            {(v.duration ?? 0) > 0 && (
                                                                <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                                                                    {formatDuration(v.duration ?? 0)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="p-2.5 space-y-2">
                                                            <p className="text-xs font-semibold line-clamp-2 leading-tight">{v.title}</p>
                                                            <div className="flex gap-3 text-[10px] text-muted-foreground">
                                                                <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-purple-400" />{fmt(v.viewCount)}</span>
                                                                <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-rose-400" />{fmt(v.likeCount)}</span>
                                                                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-blue-400" />{fmt(v.commentCount)}</span>
                                                            </div>
                                                            {v.tags && v.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {v.tags.map((tag: string, ti: number) => (
                                                                        <span key={ti} className="bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                                                                            #{tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {v.publishedAt && (
                                                                <p className="text-[9px] text-muted-foreground/70">
                                                                    {new Date(v.publishedAt).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 px-2.5 pb-2 text-[10px] text-red-500 hover:text-red-400 transition-colors">
                                                            <ExternalLink className="h-3 w-3" /> Watch on YouTube
                                                        </a>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground text-center py-6">No videos found</p>
                                )
                            )}
                        </>)}
                    </div>
                </div>
            ) : (
                /* ── NON-META: original layout ── */
                <div className="p-4 space-y-4">
                    {/* KPI metrics row — platform-specific */}
                    {(() => {
                        const kpis: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }[] =
                            insight.platform === 'youtube' ? [
                                { label: t('insights.kpi.subscribers'), value: insight.followers, icon: Users, color: 'text-blue-500' },
                                { label: t('insights.kpi.views'), value: insight.impressions, icon: Eye, color: 'text-purple-500' },
                                { label: t('insights.kpi.likes'), value: insight.engagement, icon: Heart, color: 'text-rose-500' },
                                { label: t('insights.kpi.reach'), value: insight.reach, icon: TrendingUp, color: 'text-green-500' },
                            ] : insight.platform === 'pinterest' ? [
                                { label: t('insights.kpi.followers'), value: insight.followers, icon: Users, color: 'text-blue-500' },
                                { label: t('insights.kpi.impressions'), value: insight.impressions, icon: Eye, color: 'text-purple-500' },
                                { label: t('insights.kpi.engagement'), value: insight.engagement, icon: Heart, color: 'text-rose-500' },
                                { label: t('insights.kpi.saves'), value: ins.saves ?? 0, icon: Bookmark, color: 'text-amber-500' },
                            ] : [
                                { label: t('insights.kpi.followers'), value: insight.followers, icon: Users, color: 'text-blue-500' },
                                { label: t('insights.kpi.impressions'), value: insight.impressions, icon: Eye, color: 'text-purple-500' },
                                { label: t('insights.kpi.reach'), value: insight.reach, icon: TrendingUp, color: 'text-green-500' },
                                { label: t('insights.kpi.engagement'), value: insight.engagement, icon: Heart, color: 'text-rose-500' },
                            ]
                        return (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {kpis.map(({ label, value, icon: Icon, color: c }) => (
                                    <div key={label} className="bg-muted/40 rounded-lg p-3 text-center">
                                        <Icon className={`h-4 w-4 mx-auto mb-1 ${c}`} />
                                        <p className="text-lg font-bold font-mono">{fmt(value)}</p>
                                        <p className="text-[10px] text-muted-foreground">{label}</p>
                                    </div>
                                ))}
                            </div>
                        )
                    })()}

                    {/* Sparkline */}
                    {(insight.reach || insight.impressions || 0) > 0 ? (
                        <div>
                            <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">{t('insights.chart.trend')}</p>
                            <div className="h-16">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#${gradId})`} strokeWidth={2} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : !hasRealData ? (
                        <div className="h-20 flex flex-col items-center justify-center bg-muted/20 rounded-lg gap-2 text-center">
                            <AlertCircle className="h-5 w-5 text-muted-foreground/50" />
                            <p className="text-xs text-muted-foreground">{t('insights.status.apiNotConnected')}</p>
                        </div>
                    ) : null}

                    {/* Pinterest top pins */}
                    {insight.platform === 'pinterest' && insight.topPins && insight.topPins.length > 0 && (
                        <div>
                            <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">{t('insights.posts.topPins')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {insight.topPins.slice(0, 6).map((pin, i) => (
                                    <PostCard key={i} thumbnail={pin.imageUrl} href={pin.pinUrl}
                                        metrics={[
                                            { icon: Eye, label: t('insights.kpi.impressions'), value: pin.impressions, color: 'text-purple-400' },
                                            { icon: Bookmark, label: t('insights.kpi.saves'), value: pin.saves, color: 'text-rose-400' },
                                            { icon: ExternalLink, label: 'Clicks', value: pin.clicks, color: 'text-blue-400' },
                                        ]}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other platforms — Neeflow DB posts */}
                    {insight.platform !== 'pinterest' && topPosts.length > 0 && (
                        <div>
                            <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">{t('insights.posts.recentPosts')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {topPosts.map((post, i) => (
                                    <PostCard key={i} thumbnail={post.thumbnail} publishedAt={post.publishedAt}
                                        metrics={[
                                            { icon: Heart, label: t('insights.kpi.likes'), value: post.likes, color: 'text-rose-400' },
                                            { icon: Eye, label: t('insights.kpi.reach'), value: post.reach, color: 'text-purple-400' },
                                            { icon: MessageCircle, label: t('insights.kpi.comments'), value: post.comments, color: 'text-blue-400' },
                                        ]}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}




// ─── Empty Connect State ───────────────────────────────────────────────
function ConnectPrompt({ platform }: { platform: string }) {
    const color = platformColor(platform)
    return (
        <div className="border border-dashed rounded-xl p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: color + '15' }}>
                <div className="w-6 h-6"><PlatformIcon platform={platform} size="md" /></div>
            </div>
            <div>
                <p className="text-sm font-semibold">{PLATFORM_LABELS[platform] || platform}</p>
                <p className="text-xs text-muted-foreground mt-0.5">No live API data available yet for this platform</p>
            </div>
            <Link href="/dashboard/integrations">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                    <Plug className="h-3 w-3" />Manage Integrations<ChevronRight className="h-3 w-3" />
                </Button>
            </Link>
        </div>
    )
}

// ─── Overview Tab Content ──────────────────────────────────────────────
function OverviewTab({ data, platformInsights, postInsights, t }: {
    data: ReportsData
    platformInsights: PlatformInsight[]
    postInsights: PostInsight[]
    t: (key: string) => string
}) {
    const kpi = data.kpi

    // Platform breakdown bar chart data
    const barData = data.platformBreakdown.map(p => ({
        name: PLATFORM_LABELS[p.platform] || p.platform,
        published: p.published,
        failed: p.failed,
        platform: p.platform,
    }))

    // Overall top posts — merge live FB/IG API posts with Neeflow DB posts
    const liveApiPosts: PostInsight[] = []
    for (const pi of platformInsights) {
        const ins = pi as any
        if (pi.platform === 'facebook' && Array.isArray(ins.recentPosts)) {
            for (const p of ins.recentPosts) {
                liveApiPosts.push({
                    postId: p.id || '',
                    platform: 'facebook',
                    content: p.message || null,
                    thumbnail: p.thumbnail || null,
                    publishedAt: p.createdTime || null,
                    likes: p.reactions ?? 0,
                    comments: p.comments ?? 0,
                    shares: p.shares ?? 0,
                    reach: p.reach ?? (p.reactions ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
                    impressions: p.impressions ?? 0,
                })
            }
        }
        if (pi.platform === 'instagram' && Array.isArray(ins.recentMedia)) {
            for (const m of ins.recentMedia) {
                liveApiPosts.push({
                    postId: m.id || '',
                    platform: 'instagram',
                    content: m.caption || null,
                    thumbnail: m.thumbnail || null,
                    publishedAt: m.timestamp || null,
                    likes: m.likes ?? 0,
                    comments: m.comments ?? 0,
                    shares: 0,
                    reach: m.reach ?? m.likes ?? 0,
                    impressions: m.impressions ?? 0,
                })
            }
        }
        if (pi.platform === 'linkedin' && Array.isArray(ins.recentPosts)) {
            for (const p of ins.recentPosts) {
                liveApiPosts.push({
                    postId: p.id || '',
                    platform: 'linkedin',
                    content: p.text || null,
                    thumbnail: p.thumbnail || null,
                    publishedAt: p.publishedAt || null,
                    likes: p.likes ?? 0,
                    comments: p.comments ?? 0,
                    shares: p.shares ?? 0,
                    reach: p.impressions ?? (p.likes ?? 0) + (p.comments ?? 0),
                    impressions: p.impressions ?? 0,
                })
            }
        }
    }
    // Merge: live API posts take priority; DB posts fill in other platforms
    const seenIds = new Set(liveApiPosts.map(p => p.postId).filter(Boolean))
    const dbOnlyPosts = postInsights.filter(p => !seenIds.has(p.postId))
    const topPosts = [...liveApiPosts, ...dbOnlyPosts]
        .sort((a, b) => ((b.reach || 0) + (b.likes || 0)) - ((a.reach || 0) + (a.likes || 0)))
        .slice(0, 10)

    return (
        <div className="space-y-5">
            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label={t('reports.totalPosts')} value={kpi.total ?? 0} icon={FileBarChart2} color="bg-primary" />
                <KpiCard label={t('reports.published')} value={kpi.published ?? 0} icon={Send} color="bg-green-500" />
                <KpiCard label={t('reports.scheduled')} value={kpi.scheduled ?? 0} icon={Calendar} color="bg-amber-500" />
                <KpiCard label={t('reports.failed')} value={kpi.failed ?? 0} icon={XCircle} color="bg-red-500" />
                <KpiCard label={t('reports.drafts')} value={kpi.drafts ?? 0} icon={FileText} color="bg-gray-500" />
                <KpiCard label={t('reports.pendingApproval')} value={kpi.pendingApproval ?? 0} icon={Clock} color="bg-violet-500" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Posts over time */}
                <Card className="lg:col-span-2">
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />{t('reports.postsOverTime')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={data.postsOverTime} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPublished" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} className="fill-muted-foreground" />
                                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="total" name={t('reports.totalPosts')} stroke="hsl(var(--primary))" fill="url(#colorTotal)" strokeWidth={2} dot={false} />
                                <Area type="monotone" dataKey="published" name={t('reports.published')} stroke="#22c55e" fill="url(#colorPublished)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Status distribution */}
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-semibold">{t('reports.statusDistribution')}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 flex flex-col items-center">
                        <ResponsiveContainer width="100%" height={150}>
                            <PieChart>
                                <Pie data={data.statusBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                                    {data.statusBreakdown.map((entry, i) => <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#6b7280'} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
                            {data.statusBreakdown.map((s, i) => (
                                <div key={i} className="flex items-center gap-1 text-xs">
                                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[s.name] ?? '#6b7280' }} />
                                    <span className="text-muted-foreground">{s.name.replace('_', ' ')}</span>
                                    <span className="font-medium">{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Platform breakdown bar */}
            {barData.length > 0 && (
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Send className="h-4 w-4" />Posts by Platform
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="published" name="Published" radius={[4, 4, 0, 0]}>
                                    {barData.map((entry, i) => (
                                        <Cell key={i} fill={platformColor(entry.platform)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Accounts summary cards (live-data only) */}
            {platformInsights.filter(p => !p.pendingApproval || LIVE_API_PLATFORMS.has(p.platform)).length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />Connected Accounts Summary
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {platformInsights.map((pi, i) => {
                            const color = platformColor(pi.platform)
                            const platformPosts = postInsights.filter(p => p.platform === pi.platform)
                            const dbPosts = 0 // aggregate shown in overview
                            return (
                                <div key={i} className="border rounded-xl p-4 hover:border-primary/40 transition-colors space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: color + '20' }}>
                                                <div className="w-4 h-4"><PlatformIcon platform={pi.platform} size="sm" /></div>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold truncate">{pi.accountName}</p>
                                                <p className="text-[10px] text-muted-foreground">{PLATFORM_LABELS[pi.platform]}</p>
                                            </div>
                                        </div>
                                        {pi.pendingApproval && <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: 'Followers', value: pi.followers },
                                            { label: 'Reach', value: pi.reach },
                                            { label: 'Impressions', value: pi.impressions },
                                            { label: 'Engagement', value: pi.engagement },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="bg-muted/30 rounded-md p-1.5 text-center">
                                                <p className="text-xs font-bold font-mono">{fmt(value)}</p>
                                                <p className="text-[9px] text-muted-foreground">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {platformPosts.length > 0 && (
                                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-t pt-2">
                                            <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-rose-400" />{fmt(platformPosts.reduce((a, p) => a + p.likes, 0))}</span>
                                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-blue-400" />{fmt(platformPosts.reduce((a, p) => a + p.comments, 0))}</span>
                                            <span className="flex items-center gap-1"><Share2 className="h-3 w-3 text-green-400" />{fmt(platformPosts.reduce((a, p) => a + p.shares, 0))}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Top performing posts */}
            {topPosts.length > 0 && (
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-semibold">{t('reports.topPostsByReach')}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {topPosts.map((post, i) => (
                                <PostCard
                                    key={i}
                                    thumbnail={post.thumbnail}
                                    publishedAt={post.publishedAt}
                                    platform={post.platform}
                                    metrics={[
                                        { icon: Heart, label: 'Likes', value: post.likes, color: 'text-rose-400' },
                                        { icon: Eye, label: 'Reach', value: post.reach, color: 'text-purple-400' },
                                        { icon: MessageCircle, label: 'Comments', value: post.comments, color: 'text-blue-400' },
                                    ]}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// ─── Client-side insight cache (stale-while-revalidate, 5 min TTL) ────
type CacheEntry<T> = { data: T; fetchedAt: number }
const insightsCache = new Map<string, CacheEntry<{ platformInsights: PlatformInsight[]; postInsights: PostInsight[] }>>()
const reportsCache = new Map<string, CacheEntry<ReportsData>>()
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

function isFresh<T>(entry: CacheEntry<T> | undefined): boolean {
    return !!entry && (Date.now() - entry.fetchedAt) < CACHE_TTL_MS
}


export default function InsightsPage() {
    const t = useTranslation()
    const { channels, activeChannelId } = useWorkspace()
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(activeChannelId)
    const [range, setRange] = useState('30')
    const [loading, setLoading] = useState(false)
    const [revalidating, setRevalidating] = useState(false)
    const [insightsLoading, setInsightsLoading] = useState(false)
    const [data, setData] = useState<ReportsData | null>(null)
    const [insights, setInsights] = useState<{ platformInsights: PlatformInsight[]; postInsights: PostInsight[] } | null>(null)
    const [activeTab, setActiveTab] = useState<string>('overview')

    // Sync to workspace channel when user switches channel in header
    useEffect(() => {
        if (activeChannelId && activeChannelId !== selectedChannelId) {
            setSelectedChannelId(activeChannelId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChannelId])

    const fetchData = useCallback(async (force = false) => {
        const key = `${selectedChannelId ?? 'all'}__${range}`
        const cached = reportsCache.get(key)
        if (!force && isFresh(cached)) { setData(cached!.data); return }
        if (cached) { setData(cached.data); setRevalidating(true) } else setLoading(true)
        try {
            const params = new URLSearchParams({ range })
            if (selectedChannelId) params.set('channelId', selectedChannelId)
            const res = await fetch(`/api/admin/reports?${params}`)
            const json = await res.json() as ReportsData
            reportsCache.set(key, { data: json, fetchedAt: Date.now() })
            setData(json)
        } catch { /* silent */ } finally { setLoading(false); setRevalidating(false) }
    }, [selectedChannelId, range])

    const fetchInsights = useCallback(async (force = false) => {
        const key = `${selectedChannelId ?? 'all'}`
        const cached = insightsCache.get(key)
        if (!force && isFresh(cached)) { setInsights(cached!.data); return }
        if (cached) { setInsights(cached.data); setRevalidating(true) } else setInsightsLoading(true)
        try {
            const params = new URLSearchParams()
            if (selectedChannelId) params.set('channelId', selectedChannelId)
            const res = await fetch(`/api/admin/reports/insights?${params}`)
            const json = await res.json() as { platformInsights: PlatformInsight[]; postInsights: PostInsight[] }
            insightsCache.set(key, { data: json, fetchedAt: Date.now() })
            setInsights(json)
        } catch { /* silent */ } finally { setInsightsLoading(false); setRevalidating(false) }
    }, [selectedChannelId])

    useEffect(() => { fetchData(); fetchInsights() }, [fetchData, fetchInsights])

    // Reset tab to overview when channel changes
    useEffect(() => { setActiveTab('overview') }, [selectedChannelId])

    // Manual refresh — always bust cache
    const handleRefresh = useCallback(() => {
        reportsCache.delete(`${selectedChannelId ?? 'all'}__${range}`)
        insightsCache.delete(`${selectedChannelId ?? 'all'}`)
        fetchData(true)
        fetchInsights(true)
    }, [fetchData, fetchInsights, selectedChannelId, range])

    const exportCSV = () => {
        if (!data) return
        const rows = [['Date', 'Total Posts', 'Published', 'Scheduled'], ...data.postsOverTime.map(d => [d.date, d.total, d.published, d.scheduled])]
        const csv = rows.map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `insights-${range}days-${new Date().toISOString().split('T')[0]}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    const rawInsights = insights?.platformInsights ?? []
    const postInsights = insights?.postInsights ?? []

    // Deduplicate: same platform + accountName should only appear once
    const seen = new Set<string>()
    const platformInsights = rawInsights.filter(p => {
        const key = `${p.platform}__${p.accountName}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })

    // Build tab list: live platforms first, pending/no-API dimmed after
    const liveAccounts = platformInsights.filter(p => LIVE_API_PLATFORMS.has(p.platform) && !p.pendingApproval)
    const pendingAccounts = platformInsights.filter(p => !LIVE_API_PLATFORMS.has(p.platform) || p.pendingApproval)

    const tabInsight = activeTab !== 'overview'
        ? platformInsights.find(p => `${p.platform}__${p.accountName}` === activeTab) ?? null
        : null

    const tabPosts = tabInsight
        ? postInsights.filter(p =>
            p.platform === tabInsight.platform &&
            // When multiple accounts share a platform, filter to the selected account
            (p.accountName == null || p.accountName === tabInsight.accountName)
        )
        : postInsights

    const isRefreshing = loading || insightsLoading
    const isBgRefreshing = revalidating && !isRefreshing

    return (
        <div className="flex flex-col gap-0 h-full overflow-hidden">
            {/* ── Header bar ── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between px-4 pt-4 pb-3 border-b shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BarChart2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                            {t('reports.title')}
                            {isBgRefreshing && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Refreshing in background" />}
                        </h1>
                        <p className="text-xs text-muted-foreground">{t('reports.description')}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedChannelId || 'all'} onValueChange={v => setSelectedChannelId(v === 'all' ? null : v)}>
                        <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder={t('reports.selectChannel')} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('reports.allChannels')}</SelectItem>
                            {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.displayName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={range} onValueChange={setRange}>
                        <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">{t('reports.range7')}</SelectItem>
                            <SelectItem value="30">{t('reports.range30')}</SelectItem>
                            <SelectItem value="90">{t('reports.range90')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleRefresh} disabled={isRefreshing || revalidating}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing || revalidating ? 'animate-spin' : ''}`} />{t('reports.refresh')}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCSV} disabled={!data}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />{t('reports.exportCSV')}
                    </Button>
                </div>
            </div>

            {/* ── Body: vertical sidebar + content ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* Vertical account sidebar */}
                <div className="w-52 shrink-0 border-r flex flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {/* Overview */}
                    <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer text-left w-full border-b ${activeTab === 'overview'
                            ? 'bg-primary/8 text-primary border-l-2 border-l-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-l-2 border-l-transparent'
                            }`}
                    >
                        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                        <span>Overview</span>
                    </button>

                    {/* Live accounts — grouped by platform */}
                    {liveAccounts.length > 0 && (() => {
                        // Group accounts by platform
                        const grouped: Record<string, typeof liveAccounts> = {}
                        for (const pi of liveAccounts) {
                            if (!grouped[pi.platform]) grouped[pi.platform] = []
                            grouped[pi.platform].push(pi)
                        }
                        // Sort platforms by PLATFORM_LABELS order
                        const platformOrder = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'pinterest', 'twitter', 'bluesky', 'threads']
                        const sortedPlatforms = Object.keys(grouped).sort((a, b) => {
                            const ai = platformOrder.indexOf(a)
                            const bi = platformOrder.indexOf(b)
                            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
                        })
                        return (
                            <>
                                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Connected</p>
                                {sortedPlatforms.map(platform => {
                                    const accounts = grouped[platform]
                                    const pColor = platformColor(platform)
                                    return (
                                        <div key={platform}>
                                            {/* Platform group header */}
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-y border-border/40">
                                                <div className="w-3.5 h-3.5 shrink-0">
                                                    <PlatformIcon platform={platform} size="sm" />
                                                </div>
                                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: pColor }}>
                                                    {PLATFORM_LABELS[platform] || platform}
                                                </span>
                                                <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 leading-none">
                                                    {accounts.length}
                                                </span>
                                            </div>
                                            {/* Accounts under this platform */}
                                            {accounts.map(pi => {
                                                const tabKey = `${pi.platform}__${pi.accountName}`
                                                const isActive = activeTab === tabKey
                                                return (
                                                    <button
                                                        key={tabKey}
                                                        type="button"
                                                        onClick={() => setActiveTab(tabKey)}
                                                        className={`flex items-center gap-2.5 pl-7 pr-3 py-2 text-xs font-medium transition-colors cursor-pointer text-left w-full border-l-2 ${isActive
                                                            ? 'bg-primary/8 text-foreground border-l-primary'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-l-transparent'
                                                            }`}
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate leading-tight">{pi.accountName}</p>
                                                        </div>
                                                        {isActive && <ChevronRight className="h-3 w-3 shrink-0 text-primary" />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )
                                })}
                            </>
                        )
                    })()}

                    {/* Pending/no-live-API accounts */}
                    {pendingAccounts.length > 0 && (
                        <>
                            <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Not Connected</p>
                            {pendingAccounts.map(pi => {
                                const tabKey = `${pi.platform}__${pi.accountName}`
                                const isActive = activeTab === tabKey
                                return (
                                    <button
                                        key={tabKey}
                                        type="button"
                                        onClick={() => setActiveTab(tabKey)}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer text-left w-full border-l-2 opacity-50 hover:opacity-80 ${isActive
                                            ? 'bg-primary/8 text-foreground border-l-primary opacity-100'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-l-transparent'
                                            }`}
                                    >
                                        <div className="w-4 h-4 shrink-0">
                                            <PlatformIcon platform={pi.platform} size="sm" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate leading-tight">{pi.accountName}</p>
                                            <p className="truncate text-[10px] text-muted-foreground">{PLATFORM_LABELS[pi.platform] || pi.platform}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </>
                    )}
                </div>

                {/* ── Content pane ── */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-40">
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('reports.loading')}
                        </div>
                    ) : !data ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-40">{t('reports.noData')}</div>
                    ) : activeTab === 'overview' ? (
                        <OverviewTab data={data} platformInsights={platformInsights} postInsights={postInsights} t={t} />
                    ) : tabInsight ? (
                        <div className="space-y-5">
                            {insightsLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />Loading live data...
                                </div>
                            ) : null}
                            <AccountCard insight={tabInsight} posts={tabPosts} />

                            {/* If not live platform — show connect prompt (LinkedIn, etc.) */}
                            {!LIVE_API_PLATFORMS.has(tabInsight.platform) && (
                                <ConnectPrompt platform={tabInsight.platform} />
                            )}

                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
