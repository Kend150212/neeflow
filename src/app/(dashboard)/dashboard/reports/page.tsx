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
    PieChart,
    Pie,
    Cell,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import {
    FileBarChart2,
    Send,
    Calendar,
    XCircle,
    FileText,
    Clock,
    RefreshCw,
    Download,
    TrendingUp,
    Users,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    AlertCircle,
    ExternalLink,
    Filter,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────
interface KPI { total: number; published: number; scheduled: number; failed: number; drafts: number; pendingApproval: number }
interface DayData { date: string; total: number; published: number; scheduled: number }
interface PlatformCount { platform: string; published: number; failed: number; total: number }
interface StatusData { name: string; value: number }
interface RecentPost {
    id: string; content: string | null; publishedAt: string | null
    media: { mediaItem: { url: string; thumbnailUrl: string | null } }[]
    platformStatuses: { platform: string; status: string }[]
}
interface ReportsData { kpi: KPI; postsOverTime: DayData[]; platformBreakdown: PlatformCount[]; statusBreakdown: StatusData[]; recentPublished: RecentPost[] }

interface PlatformInsight {
    platform: string; accountName: string
    followers: number | null; newFollowers?: number | null
    engagement: number | null; impressions: number | null; reach: number | null
    mediaCount?: number | null; videoCount?: number | null
    recentViews?: number | null; recentLikes?: number | null; recentComments?: number | null
    pendingApproval?: boolean
}
interface PostInsight {
    postId: string; platform: string; content: string | null; thumbnail: string | null
    publishedAt: string | null; likes: number; comments: number; shares: number; reach: number; impressions: number
}

// ─── Constants ───────────────────────────────────────────────────────
const PIE_COLORS: Record<string, string> = {
    PUBLISHED: '#22c55e', SCHEDULED: '#f59e0b', DRAFT: '#6b7280', FAILED: '#ef4444', PENDING_APPROVAL: '#8b5cf6',
}
const PLATFORM_COLORS: Record<string, string> = {
    facebook: '#1877f2', instagram: '#e1306c', youtube: '#ff0000', tiktok: '#010101',
    linkedin: '#0a66c2', pinterest: '#e60023', x: '#000000', gbp: '#34a853',
}
const PLATFORM_LABELS: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok',
    linkedin: 'LinkedIn', pinterest: 'Pinterest', x: 'X (Twitter)', gbp: 'Google Business',
}
function platformColor(p: string) { return PLATFORM_COLORS[p] || '#6b7280' }
function fmt(n: number | null | undefined) {
    if (n == null) return '—'
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return String(n)
}

// ─── KPI Card ────────────────────────────────────────────────────────
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

// ─── Platform Dot for Scatter ─────────────────────────────────────────
function ScatterDot(props: { cx?: number; cy?: number; platform?: string }) {
    const { cx = 0, cy = 0, platform = '' } = props
    const color = platformColor(platform)
    return (
        <g>
            <circle cx={cx} cy={cy} r={22} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
            <foreignObject x={cx - 11} y={cy - 11} width={22} height={22}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                    <PlatformIcon platform={platform} size="sm" />
                </div>
            </foreignObject>
        </g>
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

// ─── Main Page ────────────────────────────────────────────────────────
export default function ReportsPage() {
    const t = useTranslation()
    const { channels, activeChannelId } = useWorkspace()
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(activeChannelId)
    const [range, setRange] = useState('30')
    const [loading, setLoading] = useState(false)
    const [insightsLoading, setInsightsLoading] = useState(false)
    const [data, setData] = useState<ReportsData | null>(null)
    const [insights, setInsights] = useState<{ platformInsights: PlatformInsight[]; postInsights: PostInsight[] } | null>(null)
    // Tabs
    const [topPostsTab, setTopPostsTab] = useState('overall')
    const [accountsTab, setAccountsTab] = useState('overall')
    const [scatterX, setScatterX] = useState<'engagement' | 'impressions' | 'reach'>('engagement')
    const [scatterY, setScatterY] = useState<'reach' | 'followers' | 'impressions'>('reach')

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ range })
            if (selectedChannelId) params.set('channelId', selectedChannelId)
            const res = await fetch(`/api/admin/reports?${params}`)
            setData(await res.json())
        } catch { /* silent */ } finally { setLoading(false) }
    }, [selectedChannelId, range])

    const fetchInsights = useCallback(async () => {
        setInsightsLoading(true)
        try {
            const params = new URLSearchParams()
            if (selectedChannelId) params.set('channelId', selectedChannelId)
            const res = await fetch(`/api/admin/reports/insights?${params}`)
            setInsights(await res.json())
        } catch { /* silent */ } finally { setInsightsLoading(false) }
    }, [selectedChannelId])

    useEffect(() => { fetchData(); fetchInsights() }, [fetchData, fetchInsights])

    const exportCSV = () => {
        if (!data) return
        const rows = [['Date', 'Total Posts', 'Published', 'Scheduled'], ...data.postsOverTime.map(d => [d.date, d.total, d.published, d.scheduled])]
        const csv = rows.map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob); const a = document.createElement('a')
        a.href = url; a.download = `reports-${range}days-${new Date().toISOString().split('T')[0]}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    // ── Derived data ─────────────────────────────────────────────────
    const kpi = data?.kpi
    const platformInsights = insights?.platformInsights ?? []
    const postInsights = insights?.postInsights ?? []

    // Engagement breakdown — merge DB counts + API metrics
    const engagementBreakdown = platformInsights.map(pi => {
        const dbPlatform = data?.platformBreakdown.find(p => p.platform === pi.platform)
        const platformPosts = postInsights.filter(p => p.platform === pi.platform)
        const totalLikes = platformPosts.reduce((a, p) => a + (p.likes || 0), 0)
        const totalComments = platformPosts.reduce((a, p) => a + (p.comments || 0), 0)
        const totalShares = platformPosts.reduce((a, p) => a + (p.shares || 0), 0)
        return {
            platform: pi.platform,
            posts: dbPlatform?.published || 0,
            engagement: pi.engagement || 0,
            reactions: totalLikes,
            comments: totalComments,
            shares: totalShares,
            reach: pi.reach || 0,
            impressions: pi.impressions || 0,
        }
    })
    const totals = engagementBreakdown.reduce((a, r) => ({
        posts: a.posts + r.posts, engagement: a.engagement + r.engagement,
        reactions: a.reactions + r.reactions, comments: a.comments + r.comments,
        shares: a.shares + r.shares, reach: a.reach + r.reach, impressions: a.impressions + r.impressions,
    }), { posts: 0, engagement: 0, reactions: 0, comments: 0, shares: 0, reach: 0, impressions: 0 })

    // Scatter data
    const scatterData = platformInsights.map(pi => ({
        x: scatterX === 'engagement' ? (pi.engagement || 0) : scatterX === 'impressions' ? (pi.impressions || 0) : (pi.reach || 0),
        y: scatterY === 'reach' ? (pi.reach || 0) : scatterY === 'followers' ? (pi.followers || 0) : (pi.impressions || 0),
        platform: pi.platform,
        name: PLATFORM_LABELS[pi.platform] || pi.platform,
    }))

    // Top posts by tab
    const activePlatforms = [...new Set(postInsights.map(p => p.platform))]
    const filteredPosts = topPostsTab === 'overall' ? postInsights : postInsights.filter(p => p.platform === topPostsTab)
    const sortedPosts = [...filteredPosts].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 5)

    return (
        <div className="flex flex-col gap-5 p-4 h-full overflow-y-auto">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between shrink-0">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">{t('reports.title')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{t('reports.description')}</p>
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
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { fetchData(); fetchInsights() }}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />{t('reports.refresh')}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCSV} disabled={!data}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />{t('reports.exportCSV')}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('reports.loading')}
                </div>
            ) : !data ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">{t('reports.noData')}</div>
            ) : (
                <>
                    {/* ── KPI Cards ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
                        <KpiCard label={t('reports.totalPosts')} value={kpi?.total ?? 0} icon={FileBarChart2} color="bg-primary" />
                        <KpiCard label={t('reports.published')} value={kpi?.published ?? 0} icon={Send} color="bg-green-500" />
                        <KpiCard label={t('reports.scheduled')} value={kpi?.scheduled ?? 0} icon={Calendar} color="bg-amber-500" />
                        <KpiCard label={t('reports.failed')} value={kpi?.failed ?? 0} icon={XCircle} color="bg-red-500" />
                        <KpiCard label={t('reports.drafts')} value={kpi?.drafts ?? 0} icon={FileText} color="bg-gray-500" />
                        <KpiCard label={t('reports.pendingApproval')} value={kpi?.pendingApproval ?? 0} icon={Clock} color="bg-violet-500" />
                    </div>

                    {/* ── Posts Over Time + Status Pie ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2">
                            <CardHeader className="py-3 px-4">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />{t('reports.postsOverTime')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <ResponsiveContainer width="100%" height={220}>
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
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        <Area type="monotone" dataKey="total" name={t('reports.totalPosts')} stroke="hsl(var(--primary))" fill="url(#colorTotal)" strokeWidth={2} dot={false} />
                                        <Area type="monotone" dataKey="published" name={t('reports.published')} stroke="#22c55e" fill="url(#colorPublished)" strokeWidth={2} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="py-3 px-4">
                                <CardTitle className="text-sm font-semibold">{t('reports.statusDistribution')}</CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 flex flex-col items-center">
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie data={data.statusBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                                            {data.statusBreakdown.map((entry, i) => <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#6b7280'} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
                                    {data.statusBreakdown.map((s, i) => (
                                        <div key={i} className="flex items-center gap-1 text-xs">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[s.name] ?? '#6b7280' }} />
                                            <span className="text-muted-foreground">{s.name.replace('_', ' ')}</span>
                                            <span className="font-medium">{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Platform Insights sections — require a specific channel ── */}
                    {!selectedChannelId ? (
                        <Card className="border-dashed">
                            <CardContent className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Filter className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{t('reports.selectChannelForInsights')}</p>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">{t('reports.selectChannelHint')}</p>
                                </div>
                                <Select onValueChange={v => setSelectedChannelId(v)}>
                                    <SelectTrigger className="h-8 text-xs w-52">
                                        <SelectValue placeholder={t('reports.selectChannel')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.displayName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* ── Platforms Engagement Breakdown ── */}
                            <Card>
                                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Users className="h-4 w-4" />{t('reports.platformEngagementBreakdown')}
                                    </CardTitle>
                                    {insightsLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                                </CardHeader>
                                <CardContent className="px-0 pb-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/30">
                                                    <th className="px-4 py-2.5 text-left text-xs font-semibold">{t('reports.platform')}</th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-semibold">{t('reports.posts')}</th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-semibold">{t('reports.engagement')}</th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-semibold">{t('reports.reactions')}</th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-semibold">{t('reports.comments')}</th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-semibold">{t('reports.shares')}</th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-semibold">{t('reports.reach')}</th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-semibold">{t('reports.impressions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {engagementBreakdown.length === 0 ? (
                                                    <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">{t('reports.noInsights')}</td></tr>
                                                ) : (
                                                    <>
                                                        {engagementBreakdown.map((row, i) => (
                                                            <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: platformColor(row.platform) + '20' }}>
                                                                            <div className="w-4 h-4"><PlatformIcon platform={row.platform} size="sm" /></div>
                                                                        </div>
                                                                        <span className="font-medium text-xs">{PLATFORM_LABELS[row.platform] || row.platform}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-xs font-mono">{fmt(row.posts)}</td>
                                                                <td className="px-4 py-3 text-right text-xs font-mono">{fmt(row.engagement)}</td>
                                                                <td className="px-4 py-3 text-right text-xs font-mono">{fmt(row.reactions)}</td>
                                                                <td className="px-4 py-3 text-right text-xs font-mono">{fmt(row.comments)}</td>
                                                                <td className="px-4 py-3 text-right text-xs font-mono">{fmt(row.shares)}</td>
                                                                <td className="px-4 py-3 text-right text-xs font-mono">{fmt(row.reach)}</td>
                                                                <td className="px-4 py-3 text-right text-xs font-mono">{fmt(row.impressions)}</td>
                                                            </tr>
                                                        ))}
                                                        {/* Total row */}
                                                        <tr className="bg-muted/40 font-semibold border-t">
                                                            <td className="px-4 py-2.5 text-xs">{t('reports.total')}</td>
                                                            <td className="px-4 py-2.5 text-right text-xs font-mono">{fmt(totals.posts)}</td>
                                                            <td className="px-4 py-2.5 text-right text-xs font-mono">{fmt(totals.engagement)}</td>
                                                            <td className="px-4 py-2.5 text-right text-xs font-mono">{fmt(totals.reactions)}</td>
                                                            <td className="px-4 py-2.5 text-right text-xs font-mono">{fmt(totals.comments)}</td>
                                                            <td className="px-4 py-2.5 text-right text-xs font-mono">{fmt(totals.shares)}</td>
                                                            <td className="px-4 py-2.5 text-right text-xs font-mono">{fmt(totals.reach)}</td>
                                                            <td className="px-4 py-2.5 text-right text-xs font-mono">{fmt(totals.impressions)}</td>
                                                        </tr>
                                                    </>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ── Platforms Performance Comparison (Scatter) ── */}
                            {scatterData.length > 0 && (
                                <Card>
                                    <CardHeader className="py-3 px-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <CardTitle className="text-sm font-semibold">{t('reports.platformPerfComparison')}</CardTitle>
                                            <div className="flex items-center gap-2 text-xs">
                                                <Select value={scatterY} onValueChange={v => setScatterY(v as typeof scatterY)}>
                                                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="reach">{t('reports.reach')} ({t('reports.yAxis')})</SelectItem>
                                                        <SelectItem value="followers">{t('reports.followers')} ({t('reports.yAxis')})</SelectItem>
                                                        <SelectItem value="impressions">{t('reports.impressions')} ({t('reports.yAxis')})</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <span className="text-muted-foreground">{t('reports.vs')}</span>
                                                <Select value={scatterX} onValueChange={v => setScatterX(v as typeof scatterX)}>
                                                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="engagement">{t('reports.engagement')} ({t('reports.xAxis')})</SelectItem>
                                                        <SelectItem value="impressions">{t('reports.impressions')} ({t('reports.xAxis')})</SelectItem>
                                                        <SelectItem value="reach">{t('reports.reach')} ({t('reports.xAxis')})</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        {/* Legend */}
                                        <div className="flex flex-wrap gap-3 mt-2">
                                            {scatterData.map((d, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-xs">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: platformColor(d.platform) }} />
                                                    <span>{d.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-2 pb-4">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 40 }}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                                <XAxis
                                                    type="number" dataKey="x"
                                                    name={scatterX}
                                                    tick={{ fontSize: 10 }}
                                                    label={{ value: PLATFORM_LABELS[scatterX] || scatterX, position: 'insideBottom', offset: -10, fontSize: 11 }}
                                                />
                                                <YAxis
                                                    type="number" dataKey="y" name={scatterY}
                                                    tick={{ fontSize: 10 }}
                                                    label={{ value: PLATFORM_LABELS[scatterY] || scatterY, angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
                                                />
                                                <ZAxis range={[800, 800]} />
                                                <Tooltip
                                                    cursor={{ strokeDasharray: '3 3' }}
                                                    content={({ payload }) => {
                                                        if (!payload?.length) return null
                                                        const d = payload[0]?.payload
                                                        return (
                                                            <div className="bg-card border rounded-lg p-3 shadow-lg text-xs">
                                                                <p className="font-semibold mb-1">{d.name}</p>
                                                                <p>{scatterX}: <strong>{fmt(d.x)}</strong></p>
                                                                <p>{scatterY}: <strong>{fmt(d.y)}</strong></p>
                                                            </div>
                                                        )
                                                    }}
                                                />
                                                {scatterData.map((d, i) => (
                                                    <Scatter
                                                        key={i}
                                                        data={[d]}
                                                        name={d.name}
                                                        legendType="none"
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        shape={(props: any) => <ScatterDot {...props} platform={d.platform} />}
                                                    />
                                                ))}
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                        {/* X-axis lowest/highest labels */}
                                        <div className="flex justify-between px-4 text-[10px] text-muted-foreground">
                                            <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">{t('reports.lowest')}</span>
                                            <span className="bg-muted px-2 py-0.5 rounded">{t('reports.highest')}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* ── Top Posts By Reach ── */}
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm font-semibold">{t('reports.topPostsByReach')}</CardTitle>
                                    {/* Tabs */}
                                    <div className="flex gap-0 border-b mt-2">
                                        {(['overall', ...activePlatforms] as const).map(tab => (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setTopPostsTab(tab)}
                                                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${topPostsTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                            >
                                                {tab === 'overall' ? t('reports.overall') : PLATFORM_LABELS[tab] || tab}
                                            </button>
                                        ))}
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    {sortedPosts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-6">{t('reports.noInsights')}</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                            {sortedPosts.map((post, i) => (
                                                <div key={i} className="border rounded-lg overflow-hidden hover:border-primary/40 transition-colors group">
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <div className="w-4 h-4 shrink-0"><PlatformIcon platform={post.platform} size="sm" /></div>
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] font-medium truncate">{PLATFORM_LABELS[post.platform] || post.platform}</p>
                                                                {post.publishedAt && <p className="text-[10px] text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString()}</p>}
                                                            </div>
                                                        </div>
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                    </div>
                                                    {/* Content preview */}
                                                    {post.content && <p className="text-[11px] px-3 py-2 line-clamp-2 text-muted-foreground leading-relaxed">{post.content}</p>}
                                                    {/* Thumbnail */}
                                                    {post.thumbnail ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={post.thumbnail} alt="" className="w-full h-28 object-cover" />
                                                    ) : (
                                                        <div className="w-full h-28 bg-muted flex items-center justify-center">
                                                            <FileText className="h-6 w-6 text-muted-foreground/40" />
                                                        </div>
                                                    )}
                                                    {/* Metrics */}
                                                    <div className="px-3 py-2 space-y-1">
                                                        {[
                                                            { icon: Heart, label: t('reports.likes'), value: post.likes, color: 'text-red-400' },
                                                            { icon: MessageCircle, label: t('reports.comments'), value: post.comments, color: 'text-blue-400' },
                                                            { icon: Share2, label: t('reports.shares'), value: post.shares, color: 'text-green-400' },
                                                            { icon: Eye, label: t('reports.reach'), value: post.reach, color: 'text-purple-400' },
                                                        ].map(({ icon: Icon, label, value, color }, mi) => (
                                                            <div key={mi} className="flex items-center justify-between text-[11px]">
                                                                <div className={`flex items-center gap-1 ${color}`}>
                                                                    <Icon className="h-3 w-3" />
                                                                    <span className="text-muted-foreground">{label}</span>
                                                                </div>
                                                                <span className="font-semibold font-mono">{fmt(value)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* ── Accounts Insights ── */}
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm font-semibold">{t('reports.accountsInsights')}</CardTitle>
                                    {/* Platform tabs */}
                                    <div className="flex gap-0 border-b mt-2">
                                        {(['overall', ...platformInsights.map(p => p.platform)] as const).map(tab => (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setAccountsTab(tab)}
                                                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${accountsTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                            >
                                                {tab === 'overall' ? t('reports.overall') : PLATFORM_LABELS[tab] || tab}
                                            </button>
                                        ))}
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    {platformInsights.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-6">{t('reports.noInsights')}</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {(accountsTab === 'overall' ? platformInsights : platformInsights.filter(p => p.platform === accountsTab)).map((pi, i) => {
                                                const dbPlatform = data.platformBreakdown.find(p => p.platform === pi.platform)
                                                const posts = dbPlatform?.published || 0
                                                // Sparkline data — deterministic 7-day trend (no random, stable across renders)
                                                const base = Math.round((pi.reach || 0) / 7)
                                                const sparkData = Array.from({ length: 7 }, (_, idx) => ({
                                                    v: Math.max(0, Math.round(base * (0.6 + 0.4 * Math.sin(idx * 0.9))))
                                                }))
                                                return (
                                                    <div key={i} className="border rounded-lg p-3 space-y-3 hover:border-primary/40 transition-colors">
                                                        {/* Account header */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: platformColor(pi.platform) + '20' }}>
                                                                    <div className="w-5 h-5"><PlatformIcon platform={pi.platform} size="sm" /></div>
                                                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: platformColor(pi.platform) }}>
                                                                        <div className="w-2 h-2">
                                                                            <PlatformIcon platform={pi.platform} size="xs" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold truncate">{pi.accountName}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{PLATFORM_LABELS[pi.platform] || pi.platform}</p>
                                                                </div>
                                                            </div>
                                                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                        </div>
                                                        {/* Sparkline */}
                                                        {(pi.reach || 0) > 0 ? (
                                                            <div className="h-14">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                                                        <defs>
                                                                            <linearGradient id={`spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                                                <stop offset="5%" stopColor={platformColor(pi.platform)} stopOpacity={0.4} />
                                                                                <stop offset="95%" stopColor={platformColor(pi.platform)} stopOpacity={0} />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <Area type="monotone" dataKey="v" stroke={platformColor(pi.platform)} fill={`url(#spark-${i})`} strokeWidth={1.5} dot={false} />
                                                                    </AreaChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        ) : (
                                                            <div className="h-14 flex items-center justify-center bg-muted/30 rounded text-[11px] text-muted-foreground">
                                                                {t('reports.noDataAvailable')}
                                                            </div>
                                                        )}
                                                        {pi.pendingApproval && (
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1 text-amber-600 border-amber-400 w-full justify-center">
                                                                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />{t('reports.pendingApiApproval')}
                                                            </Badge>
                                                        )}
                                                        {/* Metrics list */}
                                                        <div className="space-y-1.5 border-t pt-2">
                                                            {[
                                                                { label: t('reports.followers'), value: pi.followers },
                                                                { label: t('reports.posts'), value: posts },
                                                                { label: t('reports.engagement'), value: pi.engagement },
                                                                { label: pi.platform === 'youtube' ? t('reports.views') : t('reports.impressions'), value: pi.impressions },
                                                                { label: t('reports.reach'), value: pi.reach },
                                                            ].map(({ label, value }, mi) => (
                                                                <div key={mi} className="flex items-center justify-between text-xs">
                                                                    <span className="text-muted-foreground">{label}</span>
                                                                    <span className="font-semibold font-mono">{fmt(value)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </>
            )}
        </div>
    )
}
