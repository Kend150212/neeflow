'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    MessageSquare, Search, Filter, ChevronDown, ChevronUp,
    Circle, Clock, CheckCircle2, XCircle, User,
    Loader2, Send, Lock, Bot, StickyNote,
    MoreVertical, UserCheck, BookOpen, Sparkles, Tag, Zap,
    AlertTriangle, Phone, ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

interface TicketUser {
    id: string; name: string | null; email: string; image: string | null; createdAt: string; isActive: boolean
    subscription?: { status: string; currentPeriodEnd: string | null; plan?: { name: string } | null }
}

interface Message {
    id: string; content: string; isInternal: boolean; isBotMsg: boolean; createdAt: string
    sender: { id: string; name: string | null; image: string | null; role: string }
}

interface Ticket {
    id: string; subject: string; status: string; priority: string; category: string
    createdAt: string; updatedAt: string
    user: TicketUser
    agent: { id: string; name: string | null; image: string | null } | null
    messages: Message[]
    _count: { messages: number }
}

const STATUS_STYLES: Record<string, { icon: React.ReactNode; className: string }> = {
    open: { icon: <Circle className="h-3 w-3" />, className: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
    pending: { icon: <Clock className="h-3 w-3" />, className: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
    resolved: { icon: <CheckCircle2 className="h-3 w-3" />, className: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
    closed: { icon: <XCircle className="h-3 w-3" />, className: 'text-muted-foreground bg-muted' },
}
const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AdminSupportHubPage() {
    const t = useTranslation()
    const { data: session } = useSession()
    const router = useRouter()

    const [tickets, setTickets] = useState<Ticket[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Ticket | null>(null)

    // Filters
    const [filterStatus, setFilterStatus] = useState('')
    const [filterPriority, setFilterPriority] = useState('')
    const [filterAssigned, setFilterAssigned] = useState('')
    const [q, setQ] = useState('')

    // Reply
    const [replyText, setReplyText] = useState('')
    const [noteText, setNoteText] = useState('')
    const [activeReplyTab, setActiveReplyTab] = useState<'reply' | 'note'>('reply')
    const [sending, setSending] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    const fetchTickets = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (filterStatus) params.set('status', filterStatus)
        if (filterPriority) params.set('priority', filterPriority)
        if (filterAssigned) params.set('assignedTo', filterAssigned)
        if (q) params.set('q', q)

        const data = await fetch(`/api/admin/support/tickets?${params}`).then(r => r.json())
        setTickets(data.tickets || [])
        setTotal(data.total || 0)
        setLoading(false)
    }, [filterStatus, filterPriority, filterAssigned, q])

    useEffect(() => { fetchTickets() }, [fetchTickets])

    const selectTicket = async (ticket: Ticket) => {
        // Load full thread
        const full = await fetch(`/api/admin/support/tickets/${ticket.id}`).then(r => r.json())
        setSelected(full)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }

    const patchTicket = async (action: string, data: Record<string, unknown>) => {
        if (!selected) return
        const res = await fetch(`/api/admin/support/tickets/${selected.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data }),
        })
        const result = await res.json()
        // Refresh thread
        await selectTicket(selected)
        await fetchTickets()
        return result
    }

    const sendReply = async () => {
        const text = activeReplyTab === 'reply' ? replyText : noteText
        if (!text.trim()) return
        setSending(true)
        try {
            await patchTicket(activeReplyTab === 'reply' ? 'reply' : 'internalNote', { message: text })
            activeReplyTab === 'reply' ? setReplyText('') : setNoteText('')
            toast.success('Sent')
        } catch { toast.error('Failed to send') }
        finally { setSending(false) }
    }

    const handleStatusChange = async (status: string) => {
        await patchTicket('status', { status })
        toast.success(`Ticket ${status}`)
    }

    const handlePriorityChange = async (priority: string) => {
        await patchTicket('priority', { priority })
    }

    const assignToMe = async () => {
        if (!selected) return
        await patchTicket('assign', { agentId: session?.user?.id })
        toast.success('Assigned to you')
    }

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Left: Ticket list */}
            <div className="flex flex-col w-80 shrink-0 border-r">
                {/* Header */}
                <div className="p-4 border-b space-y-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-base font-semibold flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            {t('support.admin.hub')}
                            {total > 0 && <Badge variant="secondary" className="text-xs">{total}</Badge>}
                        </h1>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Search tickets..."
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                    {/* Filter row */}
                    <div className="flex gap-1.5">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All</SelectItem>
                                {['open', 'pending', 'resolved', 'closed'].map(s => (
                                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterPriority} onValueChange={setFilterPriority}>
                            <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All</SelectItem>
                                {['low', 'medium', 'high', 'urgent'].map(p => (
                                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                            <SelectTrigger className="h-7 text-xs w-24">
                                <SelectValue placeholder="Owner" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All</SelectItem>
                                <SelectItem value="me">Mine</SelectItem>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Ticket items */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                            <p className="text-xs text-muted-foreground">No tickets found</p>
                        </div>
                    ) : tickets.map(ticket => {
                        const s = STATUS_STYLES[ticket.status] || STATUS_STYLES.open
                        return (
                            <button
                                key={ticket.id}
                                onClick={() => selectTicket(ticket)}
                                className={cn(
                                    'w-full flex flex-col gap-1.5 px-4 py-3 border-b text-left hover:bg-muted transition-colors',
                                    selected?.id === ticket.id && 'bg-primary/5 border-l-2 border-l-primary'
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="font-medium text-sm line-clamp-1">{ticket.subject}</span>
                                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0', s.className)}>
                                        {s.icon}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" />{ticket.user.name || ticket.user.email}</span>
                                    {ticket.user.subscription?.plan && (
                                        <span className="bg-primary/10 text-primary px-1.5 rounded-full">{ticket.user.subscription.plan.name}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className={cn('px-1.5 py-0.5 rounded-full font-medium', PRIORITY_COLORS[ticket.priority])}>
                                        {ticket.priority}
                                    </span>
                                    <span>{ticket._count.messages} msgs</span>
                                    <span className="ml-auto">{formatDate(ticket.updatedAt)}</span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Center: Thread */}
            <div className="flex-1 flex flex-col">
                {!selected ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <MessageSquare className="h-12 w-12 text-muted-foreground/20" />
                        <p className="text-muted-foreground text-sm">Select a ticket to view</p>
                    </div>
                ) : (
                    <>
                        {/* Thread header */}
                        <div className="border-b px-5 py-3 shrink-0 bg-background flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <h2 className="font-semibold text-sm truncate">{selected.subject}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', STATUS_STYLES[selected.status]?.className)}>
                                        {STATUS_STYLES[selected.status]?.icon}
                                        {selected.status}
                                    </span>
                                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[selected.priority])}>
                                        {selected.priority}
                                    </span>
                                    <Badge variant="outline" className="text-xs">#{selected.id.slice(-6).toUpperCase()}</Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Select value={selected.status} onValueChange={handleStatusChange}>
                                    <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {['open', 'pending', 'resolved', 'closed'].map(s => (
                                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" onClick={assignToMe} className="h-8">
                                    <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                                    Assign me
                                </Button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                            {selected.messages.map(msg => {
                                const isUser = msg.sender.id === selected.user.id
                                const initials = (msg.sender.name || '?').slice(0, 2).toUpperCase()
                                return (
                                    <div key={msg.id} className={cn('flex gap-3', isUser ? 'flex-row' : 'flex-row-reverse')}>
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarImage src={msg.sender.image || ''} />
                                            <AvatarFallback className="text-xs">
                                                {msg.isBotMsg ? <Bot className="h-4 w-4" /> : initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className={cn('max-w-[70%] space-y-0.5', isUser ? '' : 'items-end')}>
                                            <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', !isUser && 'flex-row-reverse')}>
                                                <span className="font-medium">
                                                    {msg.isBotMsg ? 'Bot' : msg.sender.name}
                                                    {msg.isInternal && <span className="text-amber-500 ml-1 flex items-center gap-0.5 inline-flex"><StickyNote className="h-2.5 w-2.5" /> Internal</span>}
                                                </span>
                                                <span>{formatTime(msg.createdAt)}</span>
                                            </div>
                                            <div className={cn(
                                                'rounded-2xl px-4 py-2.5 text-sm',
                                                msg.isInternal
                                                    ? 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-100 dark:border-amber-800 rounded-sm'
                                                    : isUser
                                                        ? 'bg-muted rounded-tl-sm'
                                                        : 'bg-primary text-primary-foreground rounded-tr-sm'
                                            )}>
                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={bottomRef} />
                        </div>

                        {/* Reply area */}
                        <div className="border-t px-5 py-4 bg-background shrink-0">
                            <Tabs value={activeReplyTab} onValueChange={v => setActiveReplyTab(v as 'reply' | 'note')}>
                                <TabsList className="h-8 mb-3">
                                    <TabsTrigger value="reply" className="text-xs gap-1.5">
                                        <Send className="h-3 w-3" />
                                        {t('support.ticket.reply')}
                                    </TabsTrigger>
                                    <TabsTrigger value="note" className="text-xs gap-1.5">
                                        <StickyNote className="h-3 w-3" />
                                        Internal Note
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="reply" className="mt-0">
                                    <div className="flex gap-2 items-end">
                                        <Textarea
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                                            placeholder={t('support.ticket.replyPlaceholder')}
                                            rows={3}
                                            className="resize-none text-sm"
                                        />
                                        <Button onClick={sendReply} disabled={sending || !replyText.trim()} size="icon">
                                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </TabsContent>
                                <TabsContent value="note" className="mt-0">
                                    <div className="flex gap-2 items-end">
                                        <Textarea
                                            value={noteText}
                                            onChange={e => setNoteText(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                                            placeholder="Internal note (only visible to admins)..."
                                            rows={3}
                                            className="resize-none text-sm bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                                        />
                                        <Button onClick={sendReply} disabled={sending || !noteText.trim()} size="icon" variant="outline">
                                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
                            <p className="text-xs text-muted-foreground mt-1 text-center">⌘+Enter to send</p>
                        </div>
                    </>
                )}
            </div>

            {/* Right: User info panel */}
            {selected && (
                <div className="w-64 shrink-0 border-l flex flex-col overflow-y-auto p-4 space-y-5 text-sm">
                    {/* User info */}
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                            {t('support.admin.userInfo')}
                        </p>
                        <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={selected.user.image || ''} />
                                <AvatarFallback>{(selected.user.name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{selected.user.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground truncate">{selected.user.email}</p>
                            </div>
                        </div>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('support.admin.plan')}</span>
                                <span className="font-medium">{selected.user.subscription?.plan?.name || 'Free'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('support.admin.memberSince')}</span>
                                <span>{formatDate(selected.user.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Account</span>
                                <span className={selected.user.isActive ? 'text-green-600' : 'text-destructive'}>
                                    {selected.user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Ticket meta */}
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Ticket</p>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Priority</span>
                                <Select value={selected.priority} onValueChange={p => handlePriorityChange(p)}>
                                    <SelectTrigger className="h-6 text-xs w-24 border-0 p-0 pr-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['low', 'medium', 'high', 'urgent'].map(p => (
                                            <SelectItem key={p} value={p} className="capitalize text-xs">{p}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Category</span>
                                <span className="capitalize">{selected.category}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Created</span>
                                <span>{formatDate(selected.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Agent</span>
                                <span>{selected.agent?.name || 'Unassigned'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Quick actions */}
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                            {t('support.admin.quickActions')}
                        </p>
                        <div className="space-y-1.5">
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full justify-start h-8 text-xs gap-2"
                                onClick={() => router.push('/admin/support/knowledge-base')}
                            >
                                <BookOpen className="h-3.5 w-3.5" />
                                {t('support.admin.searchKb')}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full justify-start h-8 text-xs gap-2 text-destructive hover:text-destructive"
                                onClick={() => handleStatusChange('closed')}
                            >
                                <XCircle className="h-3.5 w-3.5" />
                                {t('support.admin.close')}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full justify-start h-8 text-xs gap-2 text-green-600"
                                onClick={() => handleStatusChange('resolved')}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t('support.admin.resolve')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
