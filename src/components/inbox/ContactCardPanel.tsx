'use client'

import { useState, useEffect, useCallback } from 'react'
import { User, Phone, Mail, MapPin, Tag, Edit2, Check, X, Loader2, Plus, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Lead {
    id: string
    fullName: string | null
    phone: string | null
    email: string | null
    address: string | null
    note: string | null
    tags: string[]
    status: string
    captureMethod: string
}

interface ContactCardPanelProps {
    conversationId: string
    channelId: string
    externalUserName?: string | null
    t: (key: string) => string
}

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
    customer: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    lost: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
}

export default function ContactCardPanel({ conversationId, channelId, externalUserName, t }: ContactCardPanelProps) {
    const [lead, setLead] = useState<Lead | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editing, setEditing] = useState(false)
    const [creating, setCreating] = useState(false)

    // Editable fields state
    const [editData, setEditData] = useState<Partial<Lead>>({})

    // Quick-create form state
    const [newName, setNewName] = useState(externalUserName || '')
    const [newPhone, setNewPhone] = useState('')
    const [newEmail, setNewEmail] = useState('')

    const fetchLead = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/inbox/leads?conversationId=${conversationId}&channelId=${channelId}`)
            if (res.ok) {
                const data = await res.json()
                setLead(data.leads?.[0] || null)
            }
        } catch { /* ignore */ }
        setLoading(false)
    }, [conversationId, channelId])

    useEffect(() => {
        fetchLead()
    }, [fetchLead])

    const startEdit = () => {
        setEditData({
            fullName: lead?.fullName || '',
            phone: lead?.phone || '',
            email: lead?.email || '',
            address: lead?.address || '',
            note: lead?.note || '',
            status: lead?.status || 'new',
        })
        setEditing(true)
    }

    const cancelEdit = () => {
        setEditing(false)
        setEditData({})
    }

    const saveEdit = async () => {
        if (!lead) return
        setSaving(true)
        try {
            const res = await fetch(`/api/inbox/leads/${lead.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData),
            })
            if (res.ok) {
                const updated = await res.json()
                setLead(updated)
                setEditing(false)
                setEditData({})
            }
        } catch { /* ignore */ }
        setSaving(false)
    }

    const createLead = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/inbox/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId,
                    conversationId,
                    platform: 'unknown',
                    externalUserId: conversationId,
                    fullName: newName || null,
                    phone: newPhone || null,
                    email: newEmail || null,
                    captureMethod: 'manual',
                }),
            })
            if (res.ok) {
                const created = await res.json()
                setLead(created)
                setCreating(false)
            }
        } catch { /* ignore */ }
        setSaving(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4 px-4 border-b bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // ─── No lead: show quick-create form ────────────────────────────────
    if (!lead) {
        return (
            <div className="px-4 py-3 border-b bg-muted/20 shrink-0">
                {!creating ? (
                    <button
                        onClick={() => setCreating(true)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group"
                    >
                        <Plus className="h-3.5 w-3.5 group-hover:text-primary" />
                        {t('leads.card.createLead')}
                    </button>
                ) : (
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t('leads.card.newLead')}</p>
                        <div className="grid grid-cols-3 gap-2">
                            <input
                                type="text"
                                placeholder={t('leads.fields.fullName')}
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="text-xs border rounded-lg px-2 py-1.5 bg-background"
                            />
                            <input
                                type="text"
                                placeholder={t('leads.fields.phone')}
                                value={newPhone}
                                onChange={e => setNewPhone(e.target.value)}
                                className="text-xs border rounded-lg px-2 py-1.5 bg-background"
                            />
                            <input
                                type="email"
                                placeholder={t('leads.fields.email')}
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                className="text-xs border rounded-lg px-2 py-1.5 bg-background"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={createLead}
                                disabled={saving}
                                className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                {t('leads.save')}
                            </button>
                            <button
                                onClick={() => setCreating(false)}
                                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                            >
                                {t('leads.cancel')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ─── Lead exists: show card ──────────────────────────────────────────
    return (
        <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                    {/* Name + status row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {editing ? (
                            <input
                                type="text"
                                value={editData.fullName || ''}
                                onChange={e => setEditData(d => ({ ...d, fullName: e.target.value }))}
                                className="text-sm font-semibold border rounded px-2 py-0.5 bg-background w-32"
                                placeholder={t('leads.fields.fullName')}
                            />
                        ) : (
                            <span className="text-sm font-semibold truncate">{lead.fullName || lead.phone || t('leads.card.unknownContact')}</span>
                        )}

                        {/* Status badge */}
                        {editing ? (
                            <select
                                value={editData.status || lead.status}
                                onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}
                                className="text-[10px] border rounded px-1.5 py-0.5 bg-background"
                            >
                                {['new', 'qualified', 'customer', 'lost'].map(s => (
                                    <option key={s} value={s}>{t(`leads.status.${s}`)}</option>
                                ))}
                            </select>
                        ) : (
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', STATUS_COLORS[lead.status] || STATUS_COLORS.new)}>
                                {t(`leads.status.${lead.status}`)}
                            </span>
                        )}

                        <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0',
                        )}>
                            {t(`leads.captureMethod.${lead.captureMethod}`) || lead.captureMethod}
                        </span>
                    </div>

                    {/* Contact fields grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {/* Phone */}
                        {(lead.phone || editing) && (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                                {editing ? (
                                    <input
                                        type="text"
                                        value={editData.phone || ''}
                                        onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))}
                                        placeholder={t('leads.fields.phone')}
                                        className="text-xs border rounded px-1.5 py-0.5 bg-background flex-1 min-w-0"
                                    />
                                ) : (
                                    <a href={`tel:${lead.phone}`} className="text-xs text-muted-foreground hover:text-foreground truncate">{lead.phone}</a>
                                )}
                            </div>
                        )}

                        {/* Email */}
                        {(lead.email || editing) && (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                {editing ? (
                                    <input
                                        type="email"
                                        value={editData.email || ''}
                                        onChange={e => setEditData(d => ({ ...d, email: e.target.value }))}
                                        placeholder={t('leads.fields.email')}
                                        className="text-xs border rounded px-1.5 py-0.5 bg-background flex-1 min-w-0"
                                    />
                                ) : (
                                    <a href={`mailto:${lead.email}`} className="text-xs text-muted-foreground hover:text-foreground truncate">{lead.email}</a>
                                )}
                            </div>
                        )}

                        {/* Address */}
                        {(lead.address || editing) && (
                            <div className="flex items-center gap-1.5 min-w-0 col-span-2">
                                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                {editing ? (
                                    <input
                                        type="text"
                                        value={editData.address || ''}
                                        onChange={e => setEditData(d => ({ ...d, address: e.target.value }))}
                                        placeholder={t('leads.fields.address')}
                                        className="text-xs border rounded px-1.5 py-0.5 bg-background flex-1 min-w-0"
                                    />
                                ) : (
                                    <span className="text-xs text-muted-foreground truncate">{lead.address}</span>
                                )}
                            </div>
                        )}

                        {/* Note */}
                        {(lead.note || editing) && (
                            <div className="flex items-start gap-1.5 min-w-0 col-span-2">
                                <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                {editing ? (
                                    <input
                                        type="text"
                                        value={editData.note || ''}
                                        onChange={e => setEditData(d => ({ ...d, note: e.target.value }))}
                                        placeholder={t('leads.fields.note')}
                                        className="text-xs border rounded px-1.5 py-0.5 bg-background flex-1 min-w-0"
                                    />
                                ) : (
                                    <span className="text-xs text-muted-foreground truncate">{lead.note}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    {lead.tags && lead.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                            <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                            {lead.tags.map(tag => (
                                <span key={tag} className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {editing ? (
                        <>
                            <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-500/20 text-green-600 transition-colors"
                                title={t('leads.save')}
                            >
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button
                                onClick={cancelEdit}
                                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                                title={t('leads.cancel')}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={startEdit}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title={t('leads.edit')}
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
