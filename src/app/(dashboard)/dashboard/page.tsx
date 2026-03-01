'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
    Megaphone, PenSquare, Users, BarChart3,
    Clock, CheckCircle2, XCircle, FileText,
    AlertCircle, Zap, ArrowUpRight, CalendarClock
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { OnboardingChecklist } from '@/components/onboarding-checklist'

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
    stats: {
        channels: number
        totalPosts: number
        postsThisMonth: number
        published: number
        scheduled: number
        failed: number
        drafts: number
        pendingApproval: number
        teamMembers: number
        unreadNotifications: number
    }
    recentPosts: {
        id: string
        content: string | null
        status: string
        scheduledAt: string | null
        publishedAt: string | null
        createdAt: string
        channel: { id: string; name: string; displayName: string | null }
    }[]
    upcoming: {
        id: string
        content: string | null
        scheduledAt: string | null
        channel: { id: string; name: string; displayName: string | null }
    }[]
    dailyChart: { date: string; total: number; published: number; scheduled: number; failed: number }[]
    plan: {
        planName: string
        planNameVi: string
        isInTrial: boolean
        daysLeftInTrial: number
        maxPostsPerMonth: number
        postsThisMonth: number
    }
}

function statusBadge(status: string, t: (k: string) => string) {
    const s = status.toLowerCase()
    if (s === 'published') return <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-xs">{t('dashboard.published')}</Badge>
    if (s === 'scheduled') return <Badge className="bg-blue-500/15 text-blue-400 border-0 text-xs">{t('dashboard.scheduled')}</Badge>
    if (s === 'failed') return <Badge className="bg-red-500/15 text-red-400 border-0 text-xs">{t('dashboard.failed')}</Badge>
    if (s === 'draft') return <Badge className="bg-muted/80 text-muted-foreground border-0 text-xs">{t('dashboard.drafts')}</Badge>
    return <Badge variant="outline" className="text-xs">{status}</Badge>
}

// ─── Custom Dark Tooltip ────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
    if (!active || !payload?.length) return null
    const date = label ? new Date(label + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : ''
    return (
        <div style={{
            background: 'var(--color-card, #0d0d0d)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            minWidth: 140,
        }}>
            <p style={{ color: 'var(--color-muted-foreground)', marginBottom: 6, fontWeight: 600 }}>{date}</p>
            {payload.map(entry => (
                <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
                    <span style={{ color: entry.color }}>{entry.name}</span>
                    <span style={{ color: 'var(--color-foreground)', fontWeight: 700 }}>{entry.value}</span>
                </div>
            ))}
        </div>
    )
}

function fmtDate(d: string | null) {
    if (!d) return ''
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}


// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const t = useTranslation()
    const { data: session } = useSession()

    useEffect(() => {
        fetch('/api/dashboard')
            .then(r => {
                if (!r.ok) throw new Error(`API error: ${r.status}`)
                return r.json()
            })
            .then(d => {
                if (d?.stats && d?.plan) {
                    setData(d)
                } else {
                    throw new Error('Invalid dashboard data')
                }
                setLoading(false)
            })
            .catch((err) => {
                console.error('[Dashboard] Load error:', err)
                setError(err.message || 'Failed to load dashboard')
                setLoading(false)
            })
    }, [])

    if (loading) {
        return (
            <div className="space-y-6 p-6 animate-pulse max-w-6xl">
                <div className="h-8 w-64 bg-muted rounded" />
                <div className="grid gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
                </div>
                <div className="h-64 bg-muted rounded-xl" />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="rounded-full bg-red-500/10 p-4">
                    <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold">{t('dashboard.errorTitle') || 'Unable to load dashboard'}</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                    {error || t('dashboard.errorDesc') || 'There was a problem loading your dashboard data.'}
                </p>
                <button
                    onClick={() => { setError(null); setLoading(true); window.location.reload() }}
                    className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    {t('common.retry') || 'Retry'}
                </button>
            </div>
        )
    }

    const { stats, recentPosts, upcoming, dailyChart, plan } = data

    const postsPercent = plan.maxPostsPerMonth === -1
        ? 0
        : Math.min(100, Math.round((stats.postsThisMonth / plan.maxPostsPerMonth) * 100))

    // Stat cards
    const statCards = [
        {
            label: t('dashboard.channels'),
            value: stats.channels,
            icon: Megaphone,
            sub: stats.channels === 0 ? t('dashboard.noChannels').slice(0, 30) + '…' : undefined,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
            href: '/dashboard/channels',
        },
        {
            label: t('dashboard.postsThisMonth'),
            value: stats.postsThisMonth,
            icon: PenSquare,
            sub: `${t('dashboard.published')}: ${stats.published}`,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            href: '/dashboard/posts',
        },
        {
            label: t('dashboard.scheduled'),
            value: stats.scheduled,
            icon: CalendarClock,
            sub: `${t('dashboard.pendingApproval')}: ${stats.pendingApproval}`,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            href: '/dashboard/posts/queue',
        },
        {
            label: t('dashboard.teamMembers'),
            value: stats.teamMembers,
            icon: Users,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            href: '/dashboard/channels',
        },
    ]

    // Post status pill row
    const statusPills = [
        { label: t('dashboard.published'), value: stats.published, icon: CheckCircle2, color: 'text-emerald-400' },
        { label: t('dashboard.scheduled'), value: stats.scheduled, icon: Clock, color: 'text-blue-400' },
        { label: t('dashboard.drafts'), value: stats.drafts, icon: FileText, color: 'text-muted-foreground' },
        { label: t('dashboard.failed'), value: stats.failed, icon: XCircle, color: 'text-red-400' },
        { label: t('dashboard.pendingApproval'), value: stats.pendingApproval, icon: AlertCircle, color: 'text-amber-400' },
    ]

    // Quick actions
    const quickActions = [
        { label: t('dashboard.createChannel'), desc: t('dashboard.createChannelDesc'), icon: Megaphone, href: '/dashboard/channels', color: 'text-violet-400' },
        { label: t('dashboard.createPost'), desc: t('dashboard.createPostDesc'), icon: PenSquare, href: '/dashboard/posts/compose', color: 'text-blue-400' },
        { label: t('dashboard.viewReports'), desc: t('dashboard.viewReportsDesc'), icon: BarChart3, href: '/dashboard/reports', color: 'text-emerald-400' },
    ]

    return (
        <div className="space-y-6 p-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        {t('dashboard.welcome')}, <span className="font-medium text-foreground">{session?.user?.name || 'Admin'}</span> 👋
                    </p>
                </div>
                {stats.unreadNotifications > 0 && (
                    <Badge className="bg-red-500/15 text-red-400 border-0">
                        {stats.unreadNotifications} unread
                    </Badge>
                )}
            </div>

            {/* Trial Banner */}
            {plan.isInTrial && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm">
                    <Zap className="h-4 w-4 shrink-0" />
                    <span>{t('dashboard.trialBanner').replace('{days}', String(plan.daysLeftInTrial))}</span>
                    <Link href="/dashboard/billing" className="ml-auto shrink-0">
                        <Button size="sm" className="h-7 text-xs gap-1">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            {t('dashboard.upgradeNow')}
                        </Button>
                    </Link>
                </div>
            )}

            {/* Onboarding */}
            <OnboardingChecklist />

            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map(card => (
                    <Link key={card.label} href={card.href} className="group">
                        <Card className="relative overflow-hidden border border-border/60 hover:border-primary/30 transition-all duration-200 hover:shadow-[0_0_20px_rgba(25,230,94,0.08)]">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                                <div className={`p-2 rounded-xl ${card.bg}`}>
                                    <card.icon className={`h-4 w-4 ${card.color}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{card.value}</div>
                                {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
                            </CardContent>
                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Status Pills row */}
            <div className="flex items-center gap-2 flex-wrap">
                {statusPills.map(p => (
                    <div key={p.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-card/60 text-sm">
                        <p.icon className={`h-3.5 w-3.5 ${p.color}`} />
                        <span className="font-semibold">{p.value}</span>
                        <span className="text-muted-foreground">{p.label}</span>
                    </div>
                ))}
            </div>

            {/* Main grid: Chart + Upcoming */}
            <div className="grid gap-4 lg:grid-cols-5">
                {/* 7-day chart */}
                <Card className="lg:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('dashboard.weeklyChart')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={dailyChart} barSize={10} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                    tickFormatter={v => new Date(v + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis hide allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />}
                                    labelFormatter={v => new Date(v + 'T12:00:00').toLocaleDateString()}
                                />
                                <Bar dataKey="published" name={t('dashboard.published')} fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="scheduled" name={t('dashboard.scheduled')} fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="failed" name={t('dashboard.failed')} fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Upcoming */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium">{t('dashboard.upcoming')}</CardTitle>
                        <Link href="/dashboard/posts/queue" className="text-xs text-primary hover:underline">{t('dashboard.gotoPost')}</Link>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {upcoming.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.noUpcoming')}</p>
                        ) : upcoming.map(p => (
                            <Link key={p.id} href={`/dashboard/posts/${p.id}`} className="flex flex-col gap-0.5 p-2.5 rounded-xl hover:bg-primary/8 transition-colors">
                                <span className="text-sm font-medium truncate">{p.content?.slice(0, 60) || '(No content)'}</span>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {fmtDate(p.scheduledAt)}
                                    <span className="text-primary/60">· {p.channel.displayName || p.channel.name}</span>
                                </div>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Bottom grid: Recent Posts + Plan Usage + Quick Actions */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Recent Posts */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium">{t('dashboard.recentActivity')}</CardTitle>
                        <Link href="/dashboard/posts" className="text-xs text-primary hover:underline">{t('dashboard.gotoPost')}</Link>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {recentPosts.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.noRecent')}</p>
                        ) : recentPosts.map(p => (
                            <Link key={p.id} href={`/dashboard/posts/${p.id}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary/8 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{p.content?.slice(0, 60) || '(No content)'}</p>
                                    <p className="text-xs text-muted-foreground">{p.channel.displayName || p.channel.name}</p>
                                </div>
                                {statusBadge(p.status, t)}
                                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(p.publishedAt || p.scheduledAt || p.createdAt)}</span>
                            </Link>
                        ))}
                    </CardContent>
                </Card>

                {/* Plan Usage + Quick Actions */}
                <div className="space-y-4">
                    {/* Plan Usage */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">{t('dashboard.planUsage')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('dashboard.planUsageDesc')}</span>
                                <span className="font-bold">
                                    {stats.postsThisMonth}
                                    {plan.maxPostsPerMonth !== -1 && <span className="text-muted-foreground font-normal"> / {plan.maxPostsPerMonth}</span>}
                                </span>
                            </div>
                            {plan.maxPostsPerMonth !== -1 && (
                                <Progress value={postsPercent} className={`h-2 ${postsPercent >= 90 ? '[&>div]:bg-red-500' : postsPercent >= 70 ? '[&>div]:bg-amber-500' : ''}`} />
                            )}
                            {plan.maxPostsPerMonth === -1 && (
                                <p className="text-xs text-emerald-500">{t('dashboard.unlimited')}</p>
                            )}
                            {!plan.isInTrial && (
                                <Link href="/dashboard/billing">
                                    <Button size="sm" variant="outline" className="w-full gap-1 mt-1 text-xs h-8">
                                        <Zap className="h-3.5 w-3.5" />
                                        {t('dashboard.upgradeNow')}
                                    </Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">{t('dashboard.quickActions')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            {quickActions.map(a => (
                                <Link key={a.label} href={a.href} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary/8 transition-colors group">
                                    <div className="p-1.5 rounded-lg bg-muted">
                                        <a.icon className={`h-4 w-4 ${a.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{a.label}</p>
                                        <p className="text-xs text-muted-foreground">{a.desc}</p>
                                    </div>
                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
