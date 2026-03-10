'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    Download, Search, Users, Phone, Mail, MapPin, Tag,
    ChevronDown, ChevronUp, Pencil, Check, X, Trash2, ExternalLink,
} from 'lucide-react'
import { PlatformIcon } from '@/components/platform-icons'
import { cn } from '@/lib/utils'

interface Lead {
    id: string
    channelId: string
    conversationId: string | null
    platform: string
    externalUserId: string
    fullName: string | null
    phone: string | null
    email: string | null
    address: string | null
    note: string | null
    tags: string[]
    customFields: Record<string, string>
    status: string
    captureMethod: string
    createdAt: string
    conversation?: {
        id: string
        externalUserAvatar: string | null
        lastMessageAt: string | null
        platform: string
    } | null
}

const STATUS_STYLES: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    qualified: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    customer: 'bg-violet-500/10 text-violet-500 border-violet-500/30',
    lost: 'bg-red-500/10 text-red-400 border-red-500/30',
}

interface LeadsViewProps {
    channelId?: string
    onOpenConversation?: (conversationId: string) => void
}

export function LeadsView({ channelId, onOpenConversation }: LeadsViewProps) {
    const t = useTranslation()
    const [leads, setLeads] = useState<Lead[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editData, setEditData] = useState<Partial<Lead>>({})

    const fetchLeads = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (channelId) params.set('channelId', channelId)
            if (search) params.set('search', search)
            if (statusFilter !== 'all') params.set('status', statusFilter)
            params.set('limit', '100')
            const res = await fetch(`/api/inbox/leads?${params}`)
            if (res.ok) {
                const data = await res.json()
                setLeads(data.leads || [])
                setTotal(data.total || 0)
            }
        } finally {
            setLoading(false)
        }
    }, [channelId, search, statusFilter])

    useEffect(() => { fetchLeads() }, [fetchLeads])

    const saveLead = async (id: string) => {
        const res = await fetch(`/api/inbox/leads/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editData),
        })
        if (res.ok) {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, ...editData } : l))
            setEditingId(null)
            setEditData({})
        }
    }

    const deleteLead = async (id: string) => {
        if (!confirm(t('leads.confirmDelete') || 'Delete this lead?')) return
        const res = await fetch(`/api/inbox/leads/${id}`, { method: 'DELETE' })
        if (res.ok) setLeads(prev => prev.filter(l => l.id !== id))
    }

    const updateStatus = async (id: string, status: string) => {
        await fetch(`/api/inbox/leads/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    }

    const handleExport = () => {
        const params = new URLSearchParams()
        if (channelId) params.set('channelId', channelId)
        window.open(`/api/inbox/leads/export?${params}`, '_blank')
    }

    const statusOptions = [
        { value: 'new', label: t('leads.status.new') || 'New' },
        { value: 'qualified', label: t('leads.status.qualified') || 'Qualified' },
        { value: 'customer', label: t('leads.status.customer') || 'Customer' },
        { value: 'lost', label: t('leads.status.lost') || 'Lost' },
    ]

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 border-b flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Users className="h-5 w-5 text-primary shrink-0" />
                    <h2 className="font-semibold text-sm truncate">
                        {t('leads.title') || 'Leads & CRM'}
                    </h2>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{total}</Badge>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 shrink-0"
                    onClick={handleExport}
                >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                </Button>
            </div>

            {/* Filters */}
            <div className="shrink-0 p-3 border-b flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('leads.searchPlaceholder') || 'Search name, phone, email...'}
                        className="pl-7 h-8 text-xs"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 text-xs w-[110px]">
                        <SelectValue placeholder={t('leads.allStatus') || 'All status'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t('leads.allStatus') || 'All'}</SelectItem>
                        {statusOptions.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
                        {t('leads.loading') || 'Loading...'}
                    </div>
                ) : leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                        <Users className="h-10 w-10 opacity-30" />
                        <p className="text-xs text-center">{t('leads.empty') || 'No leads yet. Bot will capture customer info automatically.'}</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {leads.map(lead => {
                            const isExpanded = expandedId === lead.id
                            const isEditing = editingId === lead.id
                            return (
                                <div key={lead.id} className="hover:bg-muted/30 transition-colors">
                                    {/* Row */}
                                    <div className="flex items-center gap-3 p-3">
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarImage src={lead.conversation?.externalUserAvatar || ''} />
                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                {(lead.fullName || lead.externalUserId).charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-medium truncate">
                                                    {lead.fullName || lead.externalUserId}
                                                </span>
                                                <PlatformIcon platform={lead.platform} size="xs" />
                                                <Select value={lead.status} onValueChange={v => updateStatus(lead.id, v)}>
                                                    <SelectTrigger className={cn('h-4 text-[9px] px-1.5 py-0 rounded-full border font-medium w-auto gap-1', STATUS_STYLES[lead.status])}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {statusOptions.map(s => (
                                                            <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                                {lead.phone && (
                                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Phone className="h-2.5 w-2.5" />{lead.phone}
                                                    </span>
                                                )}
                                                {lead.email && (
                                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Mail className="h-2.5 w-2.5" />{lead.email}
                                                    </span>
                                                )}
                                                <span className="text-[9px] text-muted-foreground/60">
                                                    {new Date(lead.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {lead.conversationId && onOpenConversation && (
                                                <button
                                                    onClick={() => onOpenConversation(lead.conversationId!)}
                                                    className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary cursor-pointer"
                                                    title={t('leads.openConversation') || 'Open conversation'}
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                                                className="p-1 rounded hover:bg-primary/10 text-muted-foreground cursor-pointer"
                                            >
                                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div className="px-4 pb-3 bg-muted/20">
                                            {isEditing ? (
                                                <div className="space-y-2 pt-2">
                                                    {[
                                                        { key: 'fullName', label: t('leads.fields.fullName') || 'Full Name' },
                                                        { key: 'phone', label: t('leads.fields.phone') || 'Phone' },
                                                        { key: 'email', label: t('leads.fields.email') || 'Email' },
                                                        { key: 'address', label: t('leads.fields.address') || 'Address' },
                                                        { key: 'note', label: t('leads.fields.note') || 'Note' },
                                                    ].map(({ key, label }) => (
                                                        <div key={key} className="flex items-center gap-2">
                                                            <label className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</label>
                                                            <Input
                                                                value={String((editData as Record<string, unknown>)[key] ?? (lead as unknown as Record<string, unknown>)[key] ?? '')}
                                                                onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                                                                className="h-6 text-[11px] flex-1"
                                                            />
                                                        </div>
                                                    ))}
                                                    <div className="flex gap-2 mt-2">
                                                        <Button size="sm" className="h-6 text-[10px] gap-1" onClick={() => saveLead(lead.id)}>
                                                            <Check className="h-3 w-3" />{t('leads.save') || 'Save'}
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => { setEditingId(null); setEditData({}) }}>
                                                            <X className="h-3 w-3" />{t('leads.cancel') || 'Cancel'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="pt-2 space-y-1.5">
                                                    {lead.address && (
                                                        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                                                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                                                            <span>{lead.address}</span>
                                                        </div>
                                                    )}
                                                    {lead.note && (
                                                        <div className="text-[10px] text-muted-foreground bg-muted rounded p-2">{lead.note}</div>
                                                    )}
                                                    {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            <Tag className="h-3 w-3 text-muted-foreground" />
                                                            {lead.tags.map(tag => (
                                                                <span key={tag} className="text-[9px] bg-primary/10 text-primary rounded px-1.5 py-0.5">{tag}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2 mt-2">
                                                        <button
                                                            onClick={() => { setEditingId(lead.id); setEditData({}) }}
                                                            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer"
                                                        >
                                                            <Pencil className="h-3 w-3" />{t('leads.edit') || 'Edit'}
                                                        </button>
                                                        <button
                                                            onClick={() => deleteLead(lead.id)}
                                                            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                                                        >
                                                            <Trash2 className="h-3 w-3" />{t('leads.delete') || 'Delete'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
