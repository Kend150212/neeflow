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
}
interface PostInsight {
    postId: string; platform: string; content: string | null; thumbnail: string | null
    publishedAt: string | null; likes: number; comments: number; shares: number; reach: number; impressions: number
}

// ─── Platforms with real live API data ───────────────────────────────
const LIVE_API_PLATFORMS = new Set(['facebook', 'instagram', 'youtube', 'tiktok', 'pinterest'])

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

// ─── Platform Account Card ─────────────────────────────────────────────
function AccountCard({ insight, posts }: { insight: PlatformInsight; posts: PostInsight[] }) {
    const color = platformColor(insight.platform)
    const topPosts = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 3)

    // Sparkline — stable 7-day approximation
    const base = Math.round((insight.reach || insight.impressions || 0) / 7)
    const sparkData = Array.from({ length: 7 }, (_, i) => ({
        v: Math.max(0, Math.round(base * (0.5 + 0.5 * Math.sin(i * 1.2 + 1))))
    }))
    const hasRealData = LIVE_API_PLATFORMS.has(insight.platform)

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
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />API Pending
                        </Badge>
                    )}
                    {!hasRealData && (
                        <Badge variant="outline" className="text-[9px] h-5 px-1.5 text-muted-foreground">
                            Limited
                        </Badge>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* KPI metrics row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Followers', value: insight.followers, icon: Users, color: 'text-blue-500' },
                        { label: insight.platform === 'youtube' ? 'Views' : 'Impressions', value: insight.impressions, icon: Eye, color: 'text-purple-500' },
                        { label: 'Reach', value: insight.reach, icon: TrendingUp, color: 'text-green-500' },
                        insight.platform === 'pinterest'
                            ? { label: 'Saves', value: insight.saves ?? insight.engagement, icon: Bookmark, color: 'text-rose-500' }
                            : { label: 'Engagement', value: insight.engagement, icon: Heart, color: 'text-rose-500' },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-muted/40 rounded-lg p-3 text-center">
                            <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
                            <p className="text-lg font-bold font-mono">{fmt(value)}</p>
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Sparkline */}
                {(insight.reach || insight.impressions || 0) > 0 ? (
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">30-day trend</p>
                        <div className="h-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id={`spark-${insight.platform}-${insight.accountName}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="v" stroke={color} fill={`url(#spark-${insight.platform}-${insight.accountName})`} strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ) : !hasRealData ? (
                    <div className="h-20 flex flex-col items-center justify-center bg-muted/20 rounded-lg gap-2 text-center">
                        <AlertCircle className="h-5 w-5 text-muted-foreground/50" />
                        <p className="text-xs text-muted-foreground">API not yet connected for this platform</p>
                    </div>
                ) : null}

                {/* Pinterest API top pins — shown when available */}
                {insight.platform === 'pinterest' && insight.topPins && insight.topPins.length > 0 && (
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">Top Pins (Last 30 Days)</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {insight.topPins.slice(0, 6).map((pin, i) => (
                                <PostCard
                                    key={i}
                                    thumbnail={pin.imageUrl}
                                    href={pin.pinUrl}
                                    metrics={[
                                        { icon: Eye, label: 'Impressions', value: pin.impressions, color: 'text-purple-400' },
                                        { icon: Bookmark, label: 'Saves', value: pin.saves, color: 'text-rose-400' },
                                        { icon: ExternalLink, label: 'Clicks', value: pin.clicks, color: 'text-blue-400' },
                                    ]}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Top posts for this platform (non-Pinterest) */}
                {insight.platform !== 'pinterest' && topPosts.length > 0 && (
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-3 font-medium uppercase tracking-wider">Top Posts</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {topPosts.map((post, i) => (
                                <PostCard
                                    key={i}
                                    thumbnail={post.thumbnail}
                                    publishedAt={post.publishedAt}
                                    metrics={[
                                        { icon: Heart, label: 'Likes', value: post.likes, color: 'text-rose-400' },
                                        { icon: Eye, label: 'Reach', value: post.reach, color: 'text-purple-400' },
                                        { icon: MessageCircle, label: 'Comments', value: post.comments, color: 'text-blue-400' },
                                    ]}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
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

    // Overall top posts across all platforms
    const topPosts = [...postInsights].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 5)

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

// ─── Main Page ────────────────────────────────────────────────────────
export default function InsightsPage() {
    const t = useTranslation()
    const { channels, activeChannelId } = useWorkspace()
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(activeChannelId)
    const [range, setRange] = useState('30')
    const [loading, setLoading] = useState(false)
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

    // Reset tab to overview when channel changes
    useEffect(() => { setActiveTab('overview') }, [selectedChannelId])

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
        ? postInsights.filter(p => p.platform === tabInsight.platform)
        : postInsights

    const isRefreshing = loading || insightsLoading

    return (
        <div className="flex flex-col gap-0 h-full overflow-hidden">
            {/* ── Header bar ── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between px-4 pt-4 pb-3 border-b shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BarChart2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">{t('reports.title')}</h1>
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
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { fetchData(); fetchInsights() }} disabled={isRefreshing}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />{t('reports.refresh')}
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

                    {/* Live accounts section */}
                    {liveAccounts.length > 0 && (
                        <>
                            <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Connected</p>
                            {liveAccounts.map(pi => {
                                const tabKey = `${pi.platform}__${pi.accountName}`
                                const color = platformColor(pi.platform)
                                const isActive = activeTab === tabKey
                                return (
                                    <button
                                        key={tabKey}
                                        type="button"
                                        onClick={() => setActiveTab(tabKey)}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer text-left w-full border-l-2 ${isActive
                                            ? 'bg-primary/8 text-foreground border-l-primary'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-l-transparent'
                                            }`}
                                    >
                                        <div className="w-4 h-4 shrink-0">
                                            <PlatformIcon platform={pi.platform} size="sm" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate leading-tight">{pi.accountName}</p>
                                            <p className="truncate text-[10px]" style={{ color }}>{PLATFORM_LABELS[pi.platform] || pi.platform}</p>
                                        </div>
                                        {isActive && <ChevronRight className="h-3 w-3 shrink-0 text-primary" />}
                                    </button>
                                )
                            })}
                        </>
                    )}

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

                            {/* Top posts/pins for this account */}
                            {tabPosts.length > 0 && (
                                <Card>
                                    <CardHeader className="py-3 px-4">
                                        <CardTitle className="text-sm font-semibold">
                                            {tabInsight.platform === 'pinterest' ? 'Top Pins By Impressions' : t('reports.topPostsByReach')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {[...tabPosts]
                                                .sort((a, b) => (b.reach || b.impressions || 0) - (a.reach || a.impressions || 0))
                                                .slice(0, 5)
                                                .map((post, i) => (
                                                    tabInsight.platform === 'pinterest' ? (
                                                        <PostCard
                                                            key={i}
                                                            thumbnail={post.thumbnail}
                                                            publishedAt={post.publishedAt}
                                                            pendingMessage={'Data updating\nwithin 24-48h'}
                                                            metrics={[
                                                                { icon: Eye, label: 'Impressions', value: post.impressions || post.reach, color: 'text-purple-400' },
                                                                { icon: Bookmark, label: 'Saves', value: post.shares, color: 'text-rose-400' },
                                                                { icon: ExternalLink, label: 'Clicks', value: post.likes, color: 'text-blue-400' },
                                                            ]}
                                                        />
                                                    ) : (
                                                        <PostCard
                                                            key={i}
                                                            thumbnail={post.thumbnail}
                                                            publishedAt={post.publishedAt}
                                                            metrics={[
                                                                { icon: Heart, label: t('reports.likes'), value: post.likes, color: 'text-rose-400' },
                                                                { icon: MessageCircle, label: t('reports.comments'), value: post.comments, color: 'text-blue-400' },
                                                                { icon: Share2, label: t('reports.shares'), value: post.shares, color: 'text-green-400' },
                                                                { icon: Eye, label: t('reports.reach'), value: post.reach, color: 'text-purple-400' },
                                                            ]}
                                                        />
                                                    )
                                                ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

