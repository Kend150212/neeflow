'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    Database, RefreshCw, ChevronLeft, ChevronRight,
    Search, Filter, Sparkles, Table2, ArrowLeft,
    Loader2, AlertCircle, CheckSquare, Square, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import CreatePostsFromDbModal from './CreatePostsFromDbModal'

interface Props {
    dbName: string
    dbType: string
    configId: string
    tables: string[]
}

interface RowData {
    [key: string]: unknown
}

const PAGE_SIZE = 20

// Auto-detect column purposes from name
function detectColType(col: string): 'image' | 'price' | 'stock' | 'name' | 'id' | 'other' {
    const c = col.toLowerCase()
    if (/image|img|photo|picture|thumbnail|thumb|avatar/.test(c)) return 'image'
    if (/price|cost|amount|sale|discount/.test(c)) return 'price'
    if (/stock|qty|quantity|inventory|available/.test(c)) return 'stock'
    if (/name|title|label|product|item/.test(c)) return 'name'
    if (/^id$|_id$|uuid/.test(c)) return 'id'
    return 'other'
}

function formatCellValue(val: unknown, colType: string): React.ReactNode {
    if (val === null || val === undefined) {
        return <span className="text-muted-foreground/40 text-xs italic">null</span>
    }
    const str = String(val)

    if (colType === 'image') {
        const isUrl = str.startsWith('http') || str.startsWith('/')
        if (isUrl) {
            return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={str}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover border border-border"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
            )
        }
    }

    if (colType === 'price') {
        const num = parseFloat(str)
        if (!isNaN(num)) {
            return <span className="font-semibold text-primary">${num.toFixed(2)}</span>
        }
    }

    if (colType === 'stock') {
        const num = parseInt(str)
        if (!isNaN(num)) {
            const color = num === 0
                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                : num <= 5
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            const label = num === 0 ? 'Out of stock' : num <= 5 ? `${num} left` : `${num} in stock`
            return (
                <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border', color)}>
                    <span className="w-1 h-1 rounded-full bg-current" />
                    {label}
                </span>
            )
        }
    }

    if (str.length > 80) return <span className="text-xs">{str.slice(0, 80)}…</span>
    return <span className="text-sm">{str}</span>
}

export function DataExplorerClient({ dbName, dbType, configId, tables }: Props) {
    const [selectedTable, setSelectedTable] = useState(tables[0] ?? '')
    const [rows, setRows] = useState<RowData[]>([])
    const [columns, setColumns] = useState<string[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const searchTimer = useRef<NodeJS.Timeout>()

    const totalPages = Math.ceil(total / PAGE_SIZE)

    const fetchData = useCallback(async (table: string, pg: number, q: string) => {
        if (!table) return
        setLoading(true)
        setError(null)
        setSelectedRows(new Set())
        try {
            const searchCols = columns.filter(c => detectColType(c) === 'name' || detectColType(c) === 'other')
            const res = await fetch('/api/integrations/external-db/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table,
                    page: pg,
                    pageSize: PAGE_SIZE,
                    search: q,
                    searchColumns: searchCols.slice(0, 5),
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Query failed')
            setRows(data.rows ?? [])
            setColumns(data.columns ?? [])
            setTotal(data.total ?? 0)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [columns])

    // Load on table/page/search change
    useEffect(() => {
        fetchData(selectedTable, page, search)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTable, page, search])

    // Debounce search
    function handleSearchInput(val: string) {
        setSearchInput(val)
        clearTimeout(searchTimer.current)
        searchTimer.current = setTimeout(() => {
            setSearch(val)
            setPage(1)
        }, 400)
    }

    function toggleRow(idx: number) {
        setSelectedRows(prev => {
            const next = new Set(prev)
            if (next.has(idx)) next.delete(idx)
            else next.add(idx)
            return next
        })
    }

    function toggleAll() {
        if (selectedRows.size === rows.length) {
            setSelectedRows(new Set())
        } else {
            setSelectedRows(new Set(rows.map((_, i) => i)))
        }
    }

    const selectedData = [...selectedRows].map(i => rows[i]).filter(Boolean)

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <Link
                            href="/dashboard/integrations/external-db"
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to Configuration
                        </Link>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                            Live Connection Active
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">
                            Data Explorer <span className="text-primary">&amp;</span> AI Creator
                        </h1>
                        <p className="text-muted-foreground text-sm max-w-xl">
                            Browse your synced{' '}
                            <span className="text-primary font-medium">{dbName}</span> database
                            and transform records into viral social content.
                        </p>
                    </div>

                    <div className="flex gap-3 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchData(selectedTable, page, search)}
                            disabled={loading}
                            className="gap-2"
                        >
                            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                            Refresh
                        </Button>

                        {/* Table selector */}
                        <Select value={selectedTable} onValueChange={t => { setSelectedTable(t); setPage(1); setSearch(''); setSearchInput('') }}>
                            <SelectTrigger className="w-44 gap-2 font-semibold">
                                <Database className="h-4 w-4 text-primary" />
                                <SelectValue placeholder="Select table" />
                            </SelectTrigger>
                            <SelectContent>
                                {tables.map(t => (
                                    <SelectItem key={t} value={t}>
                                        <span className="flex items-center gap-2">
                                            <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            {t}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Table2 className="h-5 w-5 text-primary" />
                            Records: <span className="text-muted-foreground font-normal">{selectedTable}</span>
                        </h2>
                        {!loading && total > 0 && (
                            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 font-bold">
                                {total.toLocaleString()} rows
                            </Badge>
                        )}
                    </div>

                    {/* Batch Create Posts */}
                    {selectedRows.size > 0 && (
                        <Button
                            onClick={() => setCreateModalOpen(true)}
                            className="gap-2 animate-in slide-in-from-right-4 font-bold"
                        >
                            <Sparkles className="h-4 w-4" />
                            Create Posts for Selected ({selectedRows.size})
                        </Button>
                    )}
                </div>

                {/* Search & Filter bar */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-grow max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                            placeholder="Search records..."
                            value={searchInput}
                            onChange={e => handleSearchInput(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
                        <Filter className="h-4 w-4" />
                        Filter
                    </Button>
                </div>

                {/* Table */}
                <div className="border border-border rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm">

                    {error ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                            <p className="font-semibold text-sm">{error}</p>
                            <Button variant="outline" size="sm" onClick={() => fetchData(selectedTable, page, search)}>
                                Retry
                            </Button>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                            <Database className="h-8 w-8 text-muted-foreground" />
                            <p className="font-semibold text-sm">No records found</p>
                            {search && (
                                <p className="text-xs text-muted-foreground">Try clearing the search filter</p>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/60 border-b border-border">
                                        {/* Checkbox header */}
                                        <th className="p-4 w-12 text-center">
                                            <button onClick={toggleAll} className="text-muted-foreground hover:text-primary transition-colors">
                                                {selectedRows.size === rows.length && rows.length > 0
                                                    ? <CheckSquare className="h-4 w-4 text-primary" />
                                                    : <Square className="h-4 w-4" />
                                                }
                                            </button>
                                        </th>
                                        {columns.map(col => (
                                            <th key={col} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {rows.map((row, idx) => {
                                        const isSelected = selectedRows.has(idx)
                                        return (
                                            <tr
                                                key={idx}
                                                className={cn(
                                                    'transition-colors group',
                                                    isSelected
                                                        ? 'bg-primary/5 hover:bg-primary/8'
                                                        : 'hover:bg-muted/30'
                                                )}
                                            >
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={() => toggleRow(idx)}
                                                        className="text-muted-foreground hover:text-primary transition-colors"
                                                    >
                                                        {isSelected
                                                            ? <CheckSquare className="h-4 w-4 text-primary" />
                                                            : <Square className="h-4 w-4" />
                                                        }
                                                    </button>
                                                </td>
                                                {columns.map(col => (
                                                    <td key={col} className="px-4 py-3 max-w-[200px]">
                                                        {formatCellValue(row[col], detectColType(col))}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRows(new Set([idx]))
                                                            setCreateModalOpen(true)
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-background transition-all"
                                                    >
                                                        <Zap className="h-3 w-3" />
                                                        Create Post
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && !error && total > 0 && (
                        <div className="p-4 border-t border-border flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <div>
                                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} records
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const pg = totalPages <= 5 ? i + 1
                                        : page <= 3 ? i + 1
                                            : page >= totalPages - 2 ? totalPages - 4 + i
                                                : page - 2 + i
                                    return (
                                        <button
                                            key={pg}
                                            onClick={() => setPage(pg)}
                                            className={cn(
                                                'px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                                                page === pg
                                                    ? 'bg-primary/15 text-primary'
                                                    : 'hover:bg-muted'
                                            )}
                                        >
                                            {pg}
                                        </button>
                                    )
                                })}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40 transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info footer */}
                <p className="text-xs text-muted-foreground text-center">
                    Connected to <span className="text-primary font-medium">{dbName}</span> via {dbType.toUpperCase()} · Read-only access
                </p>
            </div>

            {/* Create Posts Modal */}
            <CreatePostsFromDbModal
                open={createModalOpen}
                onClose={() => { setCreateModalOpen(false); setSelectedRows(new Set()) }}
                rows={selectedData}
                columns={columns}
                tableName={selectedTable}
            />
        </div>
    )
}
