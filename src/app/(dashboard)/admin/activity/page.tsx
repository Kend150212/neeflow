'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    Activity, Search, Download, Clock, User, Filter,
    AlertTriangle, Copy, ChevronLeft, ChevronRight,
    BarChart3,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────
interface LogEntry {
    id: string
    action: string
    details: Record<string, unknown>
    ipAddress: string | null
    channelId: string | null
    createdAt: string
    user: { id: string; name: string | null; email: string }
}
interface ActivityData {
    logs: LogEntry[]
    total: number
    page: number
    limit: number
    totalPages: number
    actionCounts: { action: string; count: number }[]
    actionTypes: string[]
}
interface DupeGroup {
    hash: string
    count: number
    posts: {
        id: string
        content: string | null
        contentHash: string | null
        status: string
        createdAt: string
        channel: { id: string; name: string; displayName: string | null }
        author: { id: string; name: string | null; email: string }
    }[]
}
interface DupeData {
    totalDuplicateGroups: number
    groups: DupeGroup[]
}

type Tab = 'audit' | 'duplicates'

// ─── Action Colors ────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
    post_created: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    post_published: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    post_deleted: 'text-red-400 bg-red-500/10 border-red-500/20',
    post_updated: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    post_approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    post_rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
    channel_created: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    channel_updated: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    channel_deleted: 'text-red-400 bg-red-500/10 border-red-500/20',
    user_login: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    plan_override: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    trial_granted: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    settings_changed: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    duplicate_detected: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

const CHART_COLORS = [
    '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
    '#6366f1', '#06b6d4', '#84cc16', '#f43f5e', '#a855f7',
]

// ─── Dark Tooltip ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
    if (!active || !payload?.length) return null
    return (
        <div style={{ background: 'var(--color-card, #0d0d0d)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {label && <p style={{ color: 'var(--color-muted-foreground)', marginBottom: 4, fontWeight: 600 }}>{label}</p>}
            {payload.map(e => (
                <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ color: e.color ?? 'var(--color-primary)' }}>{e.name}</span>
                    <span style={{ color: 'var(--color-foreground)', fontWeight: 700 }}>{e.value}</span>
                </div>
            ))}
        </div>
    )
}

// ─── CSV Export ──────────────────────────────────────────────────────
function exportActivityCSV(logs: LogEntry[]) {
    const header = ['Date', 'User', 'Email', 'Action', 'Details', 'IP', 'Channel ID']
    const rows = logs.map(l => [
        new Date(l.createdAt).toISOString(),
        l.user.name ?? '',
        l.user.email,
        l.action,
        JSON.stringify(l.details),
        l.ipAddress ?? '',
        l.channelId ?? '',
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

// ─── Component ──────────────────────────────────────────────────────
export default function AdminActivityPage() {
    const [tab, setTab] = useState<Tab>('audit')
    const [data, setData] = useState<ActivityData | null>(null)
    const [dupeData, setDupeData] = useState<DupeData | null>(null)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [actionFilter, setActionFilter] = useState('ALL')

    // ── Audit Trail ──────────────────────────────────────────────
    const fetchActivity = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: '50' })
            if (actionFilter !== 'ALL') params.set('action', actionFilter)
            const res = await fetch(`/api/admin/activity?${params}`)
            if (res.ok) setData(await res.json())
        } finally {
            setLoading(false)
        }
    }, [page, actionFilter])

    useEffect(() => { if (tab === 'audit') fetchActivity() }, [fetchActivity, tab])

    // ── Duplicates ──────────────────────────────────────────────
    const fetchDupes = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/posts/duplicates')
            if (res.ok) setDupeData(await res.json())
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { if (tab === 'duplicates') fetchDupes() }, [fetchDupes, tab])

    // ── Tab buttons ──────────────────────────────────────────────
    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'audit', label: 'Audit Trail', icon: <Activity className="h-4 w-4" /> },
        { id: 'duplicates', label: 'Duplicate Posts', icon: <Copy className="h-4 w-4" /> },
    ]

    return (
        <div className="flex flex-col gap-6 p-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-6 w-6" />
                        Activity Log & Monitoring
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Audit trail, duplicate detection, and system monitoring</p>
                </div>
                {tab === 'audit' && data && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => exportActivityCSV(data.logs)}>
                        <Download className="h-4 w-4" /> Export CSV
                    </Button>
                )}
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 border-b pb-0">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setTab(t.id); setPage(1) }}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${tab === t.id ? 'border-violet-500 text-foreground bg-muted/40' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-4 animate-pulse">
                    <div className="h-48 bg-muted rounded-xl" />
                    <div className="h-64 bg-muted rounded-xl" />
                </div>
            )}

            {/* ═══════════ AUDIT TRAIL TAB ═══════════ */}
            {tab === 'audit' && !loading && data && (
                <>
                    {/* Action Breakdown Chart */}
                    {data.actionCounts.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-violet-400" />
                                    Actions — Last 7 Days
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={data.actionCounts} barSize={24}>
                                        <XAxis
                                            dataKey="action"
                                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                            axisLine={false}
                                            tickLine={false}
                                            interval={0}
                                            angle={-20}
                                            textAnchor="end"
                                            height={50}
                                        />
                                        <YAxis hide allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                            {data.actionCounts.map((_, i) => (
                                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Filter */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1) }}>
                            <SelectTrigger className="w-[200px] h-8 text-sm">
                                <SelectValue placeholder="Filter by action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Actions</SelectItem>
                                {data.actionTypes.map(a => (
                                    <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground ml-auto">{data.total} total entries</span>
                    </div>

                    {/* Activity Table */}
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>IP</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.logs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                No activity logs found
                                            </TableCell>
                                        </TableRow>
                                    ) : data.logs.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    <div>
                                                        <p className="text-sm font-medium">{log.user.name ?? '—'}</p>
                                                        <p className="text-xs text-muted-foreground">{log.user.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] ?? ''}`}>
                                                    {log.action.replace(/_/g, ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                {Object.keys(log.details).length > 0 ? JSON.stringify(log.details).slice(0, 80) : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {log.ipAddress ?? '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Pagination */}
                    {data.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm text-muted-foreground">Page {data.page} / {data.totalPages}</span>
                            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* ═══════════ DUPLICATES TAB ═══════════ */}
            {tab === 'duplicates' && !loading && dupeData && (
                <>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-400" />
                                {dupeData.totalDuplicateGroups} Duplicate Group{dupeData.totalDuplicateGroups !== 1 ? 's' : ''} Found
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {dupeData.groups.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    ✅ No duplicate posts detected. All content hashes are unique.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {dupeData.groups.map(g => (
                                        <div key={g.hash} className="border rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Copy className="h-3.5 w-3.5 text-orange-400" />
                                                <span className="text-xs font-mono text-muted-foreground">Hash: {g.hash.slice(0, 16)}…</span>
                                                <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30 bg-orange-500/10">
                                                    {g.count} copies
                                                </Badge>
                                            </div>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-xs">Content</TableHead>
                                                        <TableHead className="text-xs">Channel</TableHead>
                                                        <TableHead className="text-xs">Author</TableHead>
                                                        <TableHead className="text-xs">Status</TableHead>
                                                        <TableHead className="text-xs">Created</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {g.posts.map(p => (
                                                        <TableRow key={p.id}>
                                                            <TableCell className="text-xs max-w-[200px] truncate">{p.content?.slice(0, 60) ?? '—'}</TableCell>
                                                            <TableCell className="text-xs">{p.channel.displayName ?? p.channel.name}</TableCell>
                                                            <TableCell className="text-xs">{p.author.name ?? p.author.email}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="text-xs">{p.status}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {new Date(p.createdAt).toLocaleDateString()}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
