'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
    Database, Settings2, TableProperties, RefreshCw,
    CheckCircle2, XCircle, Loader2, Save, Zap, Shield,
    ArrowLeft, Activity, SlidersHorizontal, Search
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type DbType = 'mysql' | 'mariadb' | 'postgresql' | 'sqlite'

interface TablePermission {
    visible: boolean
    readable: boolean
    writable: boolean
}

interface TableRow {
    name: string
    rowCount: number
}

interface InitialConfig {
    id: string
    dbType: string
    host: string
    port: string
    database: string
    username: string
    ssl: boolean
    queryTimeout: number
    schemaHint: string
    testStatus: string | null
    lastTestedAt: string | null
    tablePermissions: Record<string, TablePermission>
    channelIds: string[]
    botQueryEnabled: boolean
    botQueryTables: string[]
    botMaxRows: number
}

interface Channel {
    id: string
    displayName: string
}

interface Props {
    initialConfig: InitialConfig | null
    channels: Channel[]
}

const DB_TYPES: { value: DbType; label: string; port: string; comingSoon?: boolean }[] = [
    { value: 'mysql', label: 'MySQL', port: '3306' },
    { value: 'mariadb', label: 'MariaDB', port: '3306', comingSoon: true },
    { value: 'postgresql', label: 'PostgreSQL', port: '5432', comingSoon: true },
    { value: 'sqlite', label: 'SQLite', port: '', comingSoon: true },
]

const defaultPerm = (): TablePermission => ({ visible: true, readable: true, writable: false })

export function ExternalDbSetupClient({ initialConfig, channels }: Props) {
    const router = useRouter()

    // ── Form state ──────────────────────────────────────────────────────────
    const [dbType, setDbType] = useState<DbType>((initialConfig?.dbType as DbType) ?? 'mysql')
    const [host, setHost] = useState(initialConfig?.host ?? '')
    const [port, setPort] = useState(initialConfig?.port ?? '3306')
    const [database, setDatabase] = useState(initialConfig?.database ?? '')
    const [username, setUsername] = useState(initialConfig?.username ?? '')
    const [password, setPassword] = useState(initialConfig ? '••••••••' : '')
    const [ssl, setSsl] = useState(initialConfig?.ssl ?? true)
    const [schemaHint, setSchemaHint] = useState(initialConfig?.schemaHint ?? '')
    const [selectedChannels, setSelectedChannels] = useState<string[]>(initialConfig?.channelIds ?? [])

    // ── Status state ────────────────────────────────────────────────────────
    const [testStatus, setTestStatus] = useState<'ok' | 'error' | 'untested' | null>(
        (initialConfig?.testStatus as 'ok' | 'error' | 'untested' | null) ?? null
    )
    const [latencyMs, setLatencyMs] = useState<number | null>(null)
    const [testError, setTestError] = useState<string | null>(null)
    const [testing, setTesting] = useState(false)
    const [saving, setSaving] = useState(false)

    // ── Table state ─────────────────────────────────────────────────────────
    const [tables, setTables] = useState<TableRow[]>([])
    const [tablePerms, setTablePerms] = useState<Record<string, TablePermission>>(
        initialConfig?.tablePermissions ?? {}
    )
    const [loadingTables, setLoadingTables] = useState(false)
    const [savingPerms, setSavingPerms] = useState(false)

    // Auto-set port when DB type changes
    useEffect(() => {
        const found = DB_TYPES.find(t => t.value === dbType)
        if (found && !initialConfig) setPort(found.port)
    }, [dbType, initialConfig])

    // Load existing tables if config exists
    const fetchTables = useCallback(async () => {
        setLoadingTables(true)
        try {
            const res = await fetch('/api/integrations/external-db/tables')
            if (!res.ok) return
            const data = await res.json()
            if (data.tables) {
                setTables(data.tables)
                const merged: Record<string, TablePermission> = {}
                for (const t of data.tables) {
                    merged[t.name] = data.tablePermissions?.[t.name] ?? defaultPerm()
                }
                setTablePerms(merged)
            }
        } finally {
            setLoadingTables(false)
        }
    }, [])

    useEffect(() => {
        if (initialConfig?.testStatus === 'ok') {
            fetchTables()
        }
    }, [initialConfig, fetchTables])

    // ── Handlers ─────────────────────────────────────────────────────────────

    async function handleTest() {
        setTesting(true)
        setTestError(null)
        setTestStatus(null)
        try {
            const res = await fetch('/api/integrations/external-db/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dbType, host, port: parseInt(port) || undefined, database, username, password: password === '••••••••' ? undefined : password, ssl }),
            })
            const data = await res.json()
            if (data.ok) {
                setTestStatus('ok')
                setLatencyMs(data.latencyMs)
                if (data.tables) {
                    setTables(data.tables)
                    const merged: Record<string, TablePermission> = {}
                    for (const t of data.tables) {
                        merged[t.name] = tablePerms[t.name] ?? defaultPerm()
                    }
                    setTablePerms(merged)
                }
                toast.success(`Connected! Latency: ${data.latencyMs}ms`)
                // Persist testStatus=ok so it survives page refresh
                await fetch('/api/integrations/external-db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dbType, host, port, database, username, password, ssl, schemaHint, channelIds: selectedChannels, testStatus: 'ok' }),
                })
            } else {
                setTestStatus('error')
                setTestError(data.error)
                toast.error(data.error ?? 'Connection failed')
                // Persist testStatus=error
                await fetch('/api/integrations/external-db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dbType, host, port, database, username, password, ssl, schemaHint, channelIds: selectedChannels, testStatus: 'error' }),
                })
            }
        } catch (e) {
            setTestStatus('error')
            setTestError((e as Error).message)
        } finally {
            setTesting(false)
        }
    }

    async function handleSave(overrideTestStatus?: string) {
        setSaving(true)
        try {
            const res = await fetch('/api/integrations/external-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dbType, host, port, database, username, password, ssl, schemaHint,
                    channelIds: selectedChannels,
                    testStatus: overrideTestStatus ?? testStatus ?? null,
                    botQueryEnabled,
                    botQueryTables,
                    botMaxRows,
                }),
            })
            const data = await res.json()
            if (data.success) {
                toast.success('Configuration saved!')
                router.refresh()
            } else {
                toast.error(data.error ?? 'Save failed')
            }
        } catch {
            toast.error('Save failed')
        } finally {
            setSaving(false)
        }
    }

    async function handleSavePermissions() {
        setSavingPerms(true)
        try {
            const res = await fetch('/api/integrations/external-db/tables', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tablePermissions: tablePerms }),
            })
            const data = await res.json()
            if (data.success) toast.success('Permissions saved!')
        } catch {
            toast.error('Save failed')
        } finally {
            setSavingPerms(false)
        }
    }

    function togglePerm(table: string, key: keyof TablePermission) {
        setTablePerms(prev => ({
            ...prev,
            [table]: { ...(prev[table] ?? defaultPerm()), [key]: !(prev[table]?.[key]) },
        }))
    }

    function selectAll() {
        const all: Record<string, TablePermission> = {}
        for (const t of tables) all[t.name] = { visible: true, readable: true, writable: false }
        setTablePerms(all)
    }

    function deselectAll() {
        const none: Record<string, TablePermission> = {}
        for (const t of tables) none[t.name] = { visible: false, readable: false, writable: false }
        setTablePerms(none)
    }

    function toggleColumn(key: keyof TablePermission) {
        const allChecked = tables.every(t => (tablePerms[t.name] ?? defaultPerm())[key])
        setTablePerms(prev => {
            const next = { ...prev }
            for (const t of tables) next[t.name] = { ...(next[t.name] ?? defaultPerm()), [key]: !allChecked }
            return next
        })
    }

    const [tableSearch, setTableSearch] = useState('')
    const [botQueryEnabled, setBotQueryEnabled] = useState(initialConfig?.botQueryEnabled ?? false)
    const [botQueryTables, setBotQueryTables] = useState<string[]>((initialConfig?.botQueryTables as string[]) ?? [])
    const [botMaxRows, setBotMaxRows] = useState(initialConfig?.botMaxRows ?? 10)
    const visibleCount = Object.values(tablePerms).filter(p => p.visible).length

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto px-6 py-8 w-full space-y-8">

                {/* Breadcrumb + Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <Link href="/dashboard/integrations" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to Integrations
                        </Link>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                            <Database className="h-3.5 w-3.5" />
                            External Source Configuration
                        </div>
                        <h1 className="text-4xl font-black tracking-tight">Database Integration</h1>
                        <p className="text-muted-foreground text-base max-w-xl">
                            Securely connect your production database. Manage table-level permissions and synchronization settings in one place.
                        </p>
                    </div>
                    {/* Explorer shortcut — visible when connection is confirmed */}
                    {testStatus === 'ok' && (
                        <Link href="/dashboard/integrations/external-db/explorer" className="flex-shrink-0">
                            <Button className="gap-2 font-bold">
                                <Activity className="h-4 w-4" />
                                Open Data Explorer
                            </Button>
                        </Link>
                    )}
                </div>

                {/* Main Grid: 5/12 + 7/12 */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* ── Left: Connection Setup ── */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <div className="rounded-xl border bg-card/50 overflow-hidden">
                            {/* Card header */}
                            <div className="p-5 border-b bg-muted/30 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <Settings2 className="h-4 w-4" />
                                </div>
                                <h3 className="font-bold text-base">1. Connection Setup</h3>
                            </div>

                            <div className="p-6 flex flex-col gap-5">
                                {/* DB Type */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-muted-foreground">Database Type</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {DB_TYPES.map(t => (
                                            <button
                                                key={t.value}
                                                onClick={() => !t.comingSoon && setDbType(t.value)}
                                                disabled={!!t.comingSoon}
                                                className={cn(
                                                    'relative flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 text-sm font-bold transition-all',
                                                    t.comingSoon
                                                        ? 'border-border/40 text-muted-foreground/40 bg-muted/20 cursor-not-allowed opacity-60'
                                                        : dbType === t.value
                                                            ? 'border-primary bg-primary/5 text-primary'
                                                            : 'border-border hover:border-primary/40 text-muted-foreground'
                                                )}
                                            >
                                                {t.label}
                                                {t.comingSoon && (
                                                    <span className="text-[9px] font-semibold text-muted-foreground/60 leading-none">
                                                        Coming Soon
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Host + Port */}
                                {dbType !== 'sqlite' && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2 space-y-1.5">
                                            <label className="text-sm font-semibold text-muted-foreground">Host</label>
                                            <input
                                                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                                placeholder="db.example.com"
                                                value={host}
                                                onChange={e => setHost(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold text-muted-foreground">Port</label>
                                            <input
                                                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                                placeholder="3306"
                                                value={port}
                                                onChange={e => setPort(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Database name */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-muted-foreground">Database Name</label>
                                    <input
                                        className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                        placeholder={dbType === 'sqlite' ? '/path/to/database.db' : 'my_database'}
                                        value={database}
                                        onChange={e => setDatabase(e.target.value)}
                                    />
                                </div>

                                {/* Username + Password */}
                                {dbType !== 'sqlite' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold text-muted-foreground">Username</label>
                                            <input
                                                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                                placeholder="db_user"
                                                value={username}
                                                onChange={e => setUsername(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold text-muted-foreground">Password</label>
                                            <input
                                                type="password"
                                                className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                                                placeholder="••••••••••••"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                onFocus={() => { if (password === '••••••••') setPassword('') }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* SSL toggle */}
                                {dbType !== 'sqlite' && (
                                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-dashed border-border">
                                        <div className="flex items-center gap-3">
                                            <Shield className="h-5 w-5 text-primary" />
                                            <div>
                                                <p className="text-sm font-bold">Use SSL Encryption</p>
                                                <p className="text-xs text-muted-foreground">Recommended for production</p>
                                            </div>
                                        </div>
                                        <button
                                            role="switch"
                                            aria-checked={ssl}
                                            onClick={() => setSsl(!ssl)}
                                            className={cn(
                                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                                ssl ? 'bg-primary' : 'bg-muted'
                                            )}
                                        >
                                            <span className={cn(
                                                'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                                                ssl ? 'translate-x-6' : 'translate-x-1'
                                            )} />
                                        </button>
                                    </div>
                                )}

                                {/* Schema hint (AI context) */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-muted-foreground">
                                        AI Schema Hint <span className="text-xs font-normal">(optional)</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
                                        placeholder="e.g. This is an e-commerce DB. products has name, price, stock. orders has status, total."
                                        value={schemaHint}
                                        onChange={e => setSchemaHint(e.target.value)}
                                    />
                                </div>

                                {/* Channels */}
                                {channels.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-muted-foreground">Link to Channels</label>
                                        <div className="flex flex-wrap gap-2">
                                            {channels.map(ch => (
                                                <button
                                                    key={ch.id}
                                                    onClick={() => setSelectedChannels(prev =>
                                                        prev.includes(ch.id) ? prev.filter(id => id !== ch.id) : [...prev, ch.id]
                                                    )}
                                                    className={cn(
                                                        'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                                                        selectedChannels.includes(ch.id)
                                                            ? 'bg-primary/10 border-primary/50 text-primary'
                                                            : 'border-border text-muted-foreground hover:border-primary/30'
                                                    )}
                                                >
                                                    {ch.displayName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-col gap-3 pt-1">
                                    <Button
                                        onClick={() => handleSave()}
                                        disabled={saving || !database}
                                        className="w-full gap-2 font-bold"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        Save Configuration
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleTest}
                                        disabled={testing || !database}
                                        className="w-full gap-2 font-bold"
                                    >
                                        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                        Test Connection
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Status Card */}
                        <div className="p-6 rounded-xl bg-gradient-to-br from-card to-card/80 border border-primary/20 shadow-lg shadow-primary/5">
                            <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-1">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Status</p>
                                    {testStatus === 'ok' ? (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="size-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(25,230,94,0.5)]" />
                                                <p className="text-xl font-bold">Live &amp; Connected</p>
                                            </div>
                                            {latencyMs && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Latency: <span className="text-primary font-medium">{latencyMs}ms</span>
                                                    {' • '}{tables.length} tables found
                                                </p>
                                            )}
                                        </>
                                    ) : testStatus === 'error' ? (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <XCircle className="h-4 w-4 text-destructive" />
                                                <p className="text-xl font-bold text-destructive">Connection Failed</p>
                                            </div>
                                            {testError && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{testError}</p>}
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="size-2.5 bg-muted rounded-full" />
                                                <p className="text-xl font-bold text-muted-foreground">Not Tested</p>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">Click "Test Connection" to verify.</p>
                                        </>
                                    )}
                                </div>
                                <Activity className={cn('h-8 w-8 opacity-40', testStatus === 'ok' ? 'text-primary' : 'text-muted-foreground')} />
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Table Manager ── */}
                    <div className="lg:col-span-7">
                        <div className="rounded-xl border bg-card/50 flex flex-col max-h-[640px]">
                            {/* Card header */}
                            <div className="p-5 border-b bg-muted/30 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <TableProperties className="h-4 w-4" />
                                    </div>
                                    <h3 className="font-bold text-base">2. Table Manager</h3>
                                    {tables.length > 0 && (
                                        <Badge variant="secondary" className="text-xs">{tables.length} tables</Badge>
                                    )}
                                </div>
                                <button
                                    onClick={fetchTables}
                                    disabled={loadingTables}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-secondary hover:bg-secondary/80 transition-colors"
                                >
                                    <RefreshCw className={cn('h-3.5 w-3.5', loadingTables && 'animate-spin')} />
                                    Sync Tables
                                </button>
                            </div>                                {/* Search sub-header */}
                            <div className="px-5 pb-4 pt-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search tables..."
                                        value={tableSearch}
                                        onChange={e => setTableSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-muted/30 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                    />
                                    {tableSearch && (
                                        <button
                                            onClick={() => setTableSearch('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>


                            {/* Table content — flex-1 fills remaining card height, scrolls inside */}
                            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto p-4 custom-scrollbar">
                                {tables.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                                        {loadingTables ? (
                                            <>
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm">Loading tables...</p>
                                            </>
                                        ) : (
                                            <>
                                                <TableProperties className="h-10 w-10 opacity-30" />
                                                <p className="text-sm">No tables loaded yet.</p>
                                                <p className="text-xs">Test connection or sync tables to see your database structure.</p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-separate border-spacing-y-1.5">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                                <th className="px-4 py-2 bg-card/95 backdrop-blur-sm rounded-tl-lg">Table Name</th>
                                                <th className="px-4 py-2 bg-card/95 backdrop-blur-sm">Rows</th>
                                                {(['visible', 'readable', 'writable'] as (keyof TablePermission)[]).map(key => {
                                                    const allChecked = tables.length > 0 && tables.every(t => (tablePerms[t.name] ?? defaultPerm())[key])
                                                    const someChecked = tables.some(t => (tablePerms[t.name] ?? defaultPerm())[key])
                                                    return (
                                                        <th key={key} className="px-4 py-2 text-center bg-card/95 backdrop-blur-sm last:rounded-tr-lg">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="capitalize">{key}</span>
                                                                <input
                                                                    type="checkbox"
                                                                    title={`Toggle all ${key}`}
                                                                    checked={allChecked}
                                                                    ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                                                                    onChange={() => toggleColumn(key)}
                                                                    className="rounded border-border text-primary focus:ring-primary bg-transparent size-3.5 cursor-pointer"
                                                                />
                                                            </div>
                                                        </th>
                                                    )
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {tables
                                                .filter(t => t.name.toLowerCase().includes(tableSearch.toLowerCase()))
                                                .map(t => {
                                                    const perm = tablePerms[t.name] ?? defaultPerm()
                                                    return (
                                                        <tr key={t.name} className="bg-muted/20 hover:bg-muted/40 transition-colors rounded-xl">
                                                            <td className="px-4 py-3.5 rounded-l-xl font-medium">{t.name}</td>
                                                            <td className="px-4 py-3.5 text-muted-foreground">{t.rowCount.toLocaleString()}</td>
                                                            {(['visible', 'readable', 'writable'] as (keyof TablePermission)[]).map(key => (
                                                                <td key={key} className={cn('px-4 py-3.5 text-center', key === 'writable' && 'rounded-r-xl')}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={perm[key]}
                                                                        onChange={() => togglePerm(t.name, key)}
                                                                        className="rounded border-border text-primary focus:ring-primary bg-transparent size-4 cursor-pointer"
                                                                    />
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    )
                                                })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Footer actions */}
                            {tables.length > 0 && (
                                <div className="p-5 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="size-3 rounded-sm bg-primary/20 border border-primary/50" />
                                            <span className="text-xs text-muted-foreground">{visibleCount} visible</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="size-3 rounded-sm bg-muted/50 border border-muted-foreground/30" />
                                            <span className="text-xs text-muted-foreground">{tables.length - visibleCount} hidden</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={selectAll}
                                            className="px-4 py-2 rounded-lg text-xs font-bold border border-border hover:bg-muted transition-colors"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={deselectAll}
                                            className="px-4 py-2 rounded-lg text-xs font-bold border border-border hover:bg-muted transition-colors"
                                        >
                                            Deselect All
                                        </button>
                                        <button
                                            onClick={handleSavePermissions}
                                            disabled={savingPerms}
                                            className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center gap-1.5"
                                        >
                                            {savingPerms ? <Loader2 className="h-3 w-3 animate-spin" /> : <SlidersHorizontal className="h-3 w-3" />}
                                            Save Permissions
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Bot Integration (Option C) ── */}
                {tables.length > 0 && (
                    <div className="rounded-xl border bg-card/50 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <Database className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">🤖 Bot Integration</h3>
                                    <p className="text-xs text-muted-foreground">Bot tự search DB khi có khách hỏi — chỉ inject rows liên quan</p>
                                </div>
                            </div>
                            {/* Toggle */}
                            <button
                                onClick={() => setBotQueryEnabled(v => !v)}
                                className={cn(
                                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                    botQueryEnabled ? 'bg-primary' : 'bg-muted'
                                )}
                            >
                                <span className={cn(
                                    'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                                    botQueryEnabled ? 'translate-x-6' : 'translate-x-1'
                                )} />
                            </button>
                        </div>

                        {botQueryEnabled && (
                            <div className="space-y-4 pt-2 border-t border-border/50">
                                {/* Tables to search */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Tables bot có thể search</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {tables.map(t => {
                                            const checked = botQueryTables.length === 0 || botQueryTables.includes(t.name)
                                            return (
                                                <label key={t.name} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => setBotQueryTables(prev => {
                                                            // If empty = all selected → clicking one deselects that one
                                                            const base = prev.length === 0 ? tables.map(x => x.name) : prev
                                                            if (base.includes(t.name)) {
                                                                const next = base.filter(x => x !== t.name)
                                                                return next.length === tables.length ? [] : next
                                                            } else {
                                                                const next = [...base, t.name]
                                                                return next.length === tables.length ? [] : next
                                                            }
                                                        })}
                                                        className="rounded border-border text-primary size-3.5 cursor-pointer"
                                                    />
                                                    <span className="text-xs truncate">{t.name}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1.5">
                                        {botQueryTables.length === 0
                                            ? `✓ Tất cả ${tables.length} tables`
                                            : `${botQueryTables.length} / ${tables.length} tables đã chọn`}
                                    </p>
                                </div>

                                {/* Max rows */}
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Max rows / query</p>
                                        <p className="text-xs text-muted-foreground">Giới hạn token — khuyến nghị 10-20 rows</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-auto">
                                        {[5, 10, 20, 50].map(v => (
                                            <button
                                                key={v}
                                                onClick={() => setBotMaxRows(v)}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                                                    botMaxRows === v
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'border-border hover:bg-muted'
                                                )}
                                            >{v}</button>
                                        ))}
                                        <input
                                            type="number"
                                            min={1}
                                            max={200}
                                            value={botMaxRows}
                                            onChange={e => setBotMaxRows(Number(e.target.value))}
                                            className="w-16 px-2 py-1.5 rounded-lg border border-border bg-muted/30 text-xs text-center outline-none focus:border-primary/50"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSave()}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all"
                                >
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                    Save Bot Settings
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                        { icon: Database, label: 'Connection', value: testStatus === 'ok' ? 'Active' : 'Inactive', color: testStatus === 'ok' ? 'text-primary' : 'text-muted-foreground', bg: testStatus === 'ok' ? 'bg-primary/10' : 'bg-muted/50' },
                        { icon: TableProperties, label: 'Tables', value: `${visibleCount} / ${tables.length}`, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                        { icon: CheckCircle2, label: 'Writable Tables', value: `${Object.values(tablePerms).filter(p => p.writable).length}`, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    ].map(stat => (
                        <div key={stat.label} className="p-5 rounded-xl border flex items-center gap-4 bg-card/50">
                            <div className={cn('size-12 rounded-full flex items-center justify-center', stat.bg)}>
                                <stat.icon className={cn('h-5 w-5', stat.color)} />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase text-muted-foreground">{stat.label}</p>
                                <p className="text-2xl font-bold">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    )
}
