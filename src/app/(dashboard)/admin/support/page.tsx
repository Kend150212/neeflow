'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    MessageSquare, Search, ChevronDown, ChevronUp,
    Circle, Clock, CheckCircle2, XCircle, User,
    Loader2, Send, Lock, Bot, StickyNote,
    MoreVertical, UserCheck, BookOpen, Zap,
    AlertTriangle, ExternalLink, Hash, Layers,
    TrendingUp, Activity, CreditCard, MonitorX,
    Globe, Calendar, LogIn, FileText, Wifi
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

interface ChannelPlatform { platform: string; accountName: string; isActive: boolean }
interface ChannelMember {
    role: string
    channel: {
        id: string; name: string; displayName: string; avatarUrl: string | null; isActive: boolean
        platforms: ChannelPlatform[]
        _count: { members: number; posts: number }
    }
}
interface TicketUser {
    id: string; name: string | null; email: string; image: string | null
    role: string; createdAt: string; isActive: boolean; lastLoginAt: string | null
    channelMembers: ChannelMember[]
    subscription?: {
        status: string; billingInterval: string; currentPeriodEnd: string | null
        trialEndsAt: string | null; cancelAtPeriodEnd: boolean
        plan?: { name: string; maxPostsPerMonth: number; maxAiImagesPerMonth: number; maxAiTextPerMonth: number; maxChannels: number } | null
        usages?: { month: string; postsCreated: number; imagesGenerated: number; aiTextGenerated: number }[]
    }
}
interface Message {
    id: string; content: string; isInternal: boolean; isBotMsg: boolean; createdAt: string
    sender: { id: string; name: string | null; image: string | null; role: string }
}
interface FailedPost {
    id: string; updatedAt: string
    channel: { displayName: string }
    platformStatuses: { platform: string; errorMsg: string | null }[]
}
interface ActivityEntry {
    action: string; details: Record<string, unknown>; createdAt: string; channelId: string | null
}
interface PostByChannel { channelId: string; channelName: string; count: number }
interface UserContext {
    totalPostsPublished: number; totalPostsFailed: number
    lastPublishedAt: string | null; lastPublishedChannel: string | null
    postsByChannel: PostByChannel[]
    recentFailedPosts: FailedPost[]
    ticketHistory: number
    thisMonthUsage: { month: string; postsCreated: number; imagesGenerated: number; aiTextGenerated: number } | null
    currentMonth: string
    recentActivity: ActivityEntry[]
}
interface Ticket {
    id: string; subject: string; status: string; priority: string; category: string
    createdAt: string; updatedAt: string
    user: TicketUser
    agent: { id: string; name: string | null; image: string | null } | null
    messages: Message[]
    _count: { messages: number }
    userContext?: UserContext
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
function formatRelative(iso: string | null) {
    if (!iso) return 'Never'
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return formatDate(iso)
}
const PLATFORM_COLORS: Record<string, string> = {
    facebook: 'bg-blue-600', instagram: 'bg-pink-500', tiktok: 'bg-black dark:bg-white',
    youtube: 'bg-red-600', linkedin: 'bg-sky-700', x: 'bg-neutral-800', pinterest: 'bg-red-500',
    gbp: 'bg-green-600', wistia: 'bg-cyan-500', vimeo: 'bg-blue-400',
}
function PlatformDot({ platform }: { platform: string }) {
    return <span title={platform} className={`inline-block w-2 h-2 rounded-full ${PLATFORM_COLORS[platform] ?? 'bg-muted-foreground'}`} />
}
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-between items-start gap-2">
            <span className="text-muted-foreground shrink-0">{label}</span>
            <span className="font-medium text-right">{children}</span>
        </div>
    )
}
function SectionHeader({ icon, label, open, onToggle }: { icon: React.ReactNode; label: string; open: boolean; onToggle: () => void }) {
    return (
        <button onClick={onToggle} className="flex items-center justify-between w-full text-left group">
            <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                {icon}{label}
            </span>
            {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </button>
    )
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
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterPriority, setFilterPriority] = useState('all')
    const [filterAssigned, setFilterAssigned] = useState('all')
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
        if (filterStatus !== 'all') params.set('status', filterStatus)
        if (filterPriority !== 'all') params.set('priority', filterPriority)
        if (filterAssigned !== 'all') params.set('assignedTo', filterAssigned)
        if (q) params.set('q', q)

        try {
            const res = await fetch(`/api/admin/support/tickets?${params}`)
            if (res.ok) {
                const data = await res.json()
                setTickets(data.tickets || [])
                setTotal(data.total || 0)
            }
        } catch (err) {
            console.error('Failed to load tickets:', err)
        } finally {
            setLoading(false)
        }
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
                                <SelectItem value="all">All</SelectItem>
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
                                <SelectItem value="all">All</SelectItem>
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
                                <SelectItem value="all">All</SelectItem>
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
                        <div className="border-b px-5 py-3 shrink-0 bg-background">
                            {/* Row 1: subject + action buttons */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-semibold text-sm truncate">{selected.subject}</h2>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Select value={selected.status} onValueChange={handleStatusChange}>
                                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {['open', 'pending', 'resolved', 'closed'].map(s => (
                                                <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button size="sm" variant="outline" onClick={assignToMe} className="h-7 text-xs gap-1.5">
                                        <UserCheck className="h-3 w-3" />
                                        Assign me
                                    </Button>
                                </div>
                            </div>
                            {/* Row 2: status + priority + ticket id + ASSIGNED AGENT */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', STATUS_STYLES[selected.status]?.className)}>
                                    {STATUS_STYLES[selected.status]?.icon}
                                    {selected.status}
                                </span>
                                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[selected.priority])}>
                                    {selected.priority}
                                </span>
                                <Badge variant="outline" className="text-xs">#{selected.id.slice(-6).toUpperCase()}</Badge>
                                {/* Divider */}
                                <span className="text-muted-foreground/40 text-xs">·</span>
                                {/* Assigned agent */}
                                {selected.agent ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Avatar className="h-4 w-4">
                                            <AvatarImage src={selected.agent.image || ''} />
                                            <AvatarFallback className="text-[8px]">
                                                {(selected.agent.name || '?').slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-foreground">{selected.agent.name}</span>
                                        <span className="text-muted-foreground">assigned</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 italic">
                                        <UserCheck className="h-3 w-3" />
                                        Unassigned
                                    </span>
                                )}
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

            {/* Right: Enriched User Info Panel */}
            {selected && (
                <EnrichedUserPanel
                    selected={selected}
                    onPriorityChange={handlePriorityChange}
                    onStatusChange={handleStatusChange}
                    onNavigate={router.push}
                />
            )}
        </div>
    )
}

// ─── Enriched Right Panel ────────────────────────────────────────────────────
function EnrichedUserPanel({
    selected, onPriorityChange, onStatusChange, onNavigate,
}: {
    selected: Ticket
    onPriorityChange: (p: string) => void
    onStatusChange: (s: string) => void
    onNavigate: (path: string) => void
}) {
    const ctx = selected.userContext
    const user = selected.user
    const sub = user.subscription
    const plan = sub?.plan
    const usage = sub?.usages?.[0] ?? ctx?.thisMonthUsage

    const [openSections, setOpenSections] = useState({
        user: true, ticket: true, channels: true, stats: true, quota: true, errors: true, activity: false,
    })
    const toggle = (k: keyof typeof openSections) =>
        setOpenSections(p => ({ ...p, [k]: !p[k] }))

    const statusColors: Record<string, string> = {
        active: 'text-green-500', trialing: 'text-blue-500',
        past_due: 'text-yellow-500', canceled: 'text-destructive',
    }

    return (
        <div className="w-72 shrink-0 border-l flex flex-col overflow-y-auto text-xs">
            {/* ── USER INFO ── */}
            <div className="p-4 space-y-3 border-b">
                <SectionHeader
                    icon={<User className="h-3 w-3" />}
                    label="User Info"
                    open={openSections.user}
                    onToggle={() => toggle('user')}
                />
                {openSections.user && (
                    <>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                                <AvatarImage src={user.image || ''} />
                                <AvatarFallback className="text-sm font-bold">
                                    {(user.name || '?').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{user.name || 'Unknown'}</p>
                                <p className="text-muted-foreground truncate">{user.email}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={cn('text-[10px] font-medium', user.isActive ? 'text-green-500' : 'text-destructive')}>
                                        ● {user.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-muted-foreground capitalize">{user.role.toLowerCase()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <InfoRow label="Plan">
                                <span className="inline-flex items-center gap-1">
                                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                                        {plan?.name ?? 'Free'}
                                    </span>
                                    {sub && (
                                        <span className={cn('capitalize', statusColors[sub.status])}>
                                            {sub.status}
                                        </span>
                                    )}
                                </span>
                            </InfoRow>
                            {sub?.trialEndsAt && new Date(sub.trialEndsAt) > new Date() && (
                                <InfoRow label="Trial ends">
                                    <span className="text-yellow-500">{formatDate(sub.trialEndsAt)}</span>
                                </InfoRow>
                            )}
                            {sub?.currentPeriodEnd && (
                                <InfoRow label={sub.cancelAtPeriodEnd ? '⚠ Cancels' : 'Renews'}>
                                    <span className={cn(sub.cancelAtPeriodEnd && 'text-destructive')}>
                                        {formatDate(sub.currentPeriodEnd)}
                                    </span>
                                </InfoRow>
                            )}
                            <InfoRow label="Member since">{formatDate(user.createdAt)}</InfoRow>
                            <InfoRow label="Last login">
                                <span className={user.lastLoginAt ? '' : 'text-muted-foreground'}>
                                    {formatRelative(user.lastLoginAt)}
                                </span>
                            </InfoRow>
                            {ctx && (
                                <InfoRow label="Past tickets">
                                    <span className={ctx.ticketHistory > 0 ? 'text-yellow-500' : ''}>
                                        {ctx.ticketHistory} ticket{ctx.ticketHistory !== 1 ? 's' : ''}
                                    </span>
                                </InfoRow>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ── TICKET META ── */}
            <div className="p-4 space-y-3 border-b">
                <SectionHeader
                    icon={<FileText className="h-3 w-3" />}
                    label="Ticket"
                    open={openSections.ticket}
                    onToggle={() => toggle('ticket')}
                />
                {openSections.ticket && (
                    <div className="space-y-1.5">
                        <InfoRow label="Priority">
                            <Select value={selected.priority} onValueChange={onPriorityChange}>
                                <SelectTrigger className="h-5 text-xs border-0 p-0 w-20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {['low', 'medium', 'high', 'urgent'].map(p => (
                                        <SelectItem key={p} value={p} className="capitalize text-xs">{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </InfoRow>
                        <InfoRow label="Category"><span className="capitalize">{selected.category}</span></InfoRow>
                        <InfoRow label="Created">{formatDate(selected.createdAt)}</InfoRow>
                        <InfoRow label="Agent">{selected.agent?.name ?? 'Unassigned'}</InfoRow>
                        <div className="flex gap-1.5 pt-1">
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 text-green-600"
                                onClick={() => onStatusChange('resolved')}>
                                <CheckCircle2 className="h-3 w-3" />Resolve
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 text-destructive"
                                onClick={() => onStatusChange('closed')}>
                                <XCircle className="h-3 w-3" />Close
                            </Button>
                        </div>
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1 justify-start"
                            onClick={() => onNavigate('/admin/support/knowledge-base')}>
                            <BookOpen className="h-3 w-3" />Search Knowledge Base
                        </Button>
                    </div>
                )}
            </div>

            {/* ── CHANNELS ── */}
            <div className="p-4 space-y-3 border-b">
                <SectionHeader
                    icon={<Layers className="h-3 w-3" />}
                    label={`Channels (${user.channelMembers?.length ?? 0})`}
                    open={openSections.channels}
                    onToggle={() => toggle('channels')}
                />
                {openSections.channels && (
                    <div className="space-y-1">
                        {(!user.channelMembers || user.channelMembers.length === 0) ? (
                            <p className="text-muted-foreground">No channels</p>
                        ) : user.channelMembers.map(m => {
                            // Count unique platforms by name (not accounts)
                            const uniquePlatforms = [...new Set(m.channel.platforms.map(p => p.platform))]
                            const totalAccounts = m.channel.platforms.length
                            const isOwner = m.role === 'OWNER'
                            return (
                                <div key={m.channel.id}
                                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                                    {/* Active dot */}
                                    <span className={cn('shrink-0 w-1.5 h-1.5 rounded-full', m.channel.isActive ? 'bg-green-500' : 'bg-muted-foreground/40')} />
                                    {/* Channel name */}
                                    <span className="flex-1 font-medium truncate">{m.channel.displayName}</span>
                                    {/* Platform count (unique) */}
                                    {totalAccounts > 0 && (
                                        <span className="text-muted-foreground shrink-0">
                                            {totalAccounts} acct{totalAccounts !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {/* Role badge */}
                                    <span className={cn(
                                        'shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium',
                                        isOwner
                                            ? 'bg-primary/15 text-primary'
                                            : 'bg-muted text-muted-foreground'
                                    )}>
                                        {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>


            {/* ── ACTIVITY STATS ── */}
            {ctx && (
                <div className="p-4 space-y-3 border-b">
                    <SectionHeader
                        icon={<TrendingUp className="h-3 w-3" />}
                        label="Post Activity"
                        open={openSections.stats}
                        onToggle={() => toggle('stats')}
                    />
                    {openSections.stats && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border bg-green-50 dark:bg-green-900/20 p-2 text-center">
                                    <p className="text-lg font-bold text-green-600">{ctx.totalPostsPublished}</p>
                                    <p className="text-muted-foreground">Published</p>
                                </div>
                                <div className="rounded-lg border bg-red-50 dark:bg-red-900/20 p-2 text-center">
                                    <p className={cn('text-lg font-bold', ctx.totalPostsFailed > 0 ? 'text-red-500' : 'text-muted-foreground')}>
                                        {ctx.totalPostsFailed}
                                    </p>
                                    <p className="text-muted-foreground">Failed</p>
                                </div>
                            </div>
                            <InfoRow label="Last post">
                                <span title={ctx.lastPublishedChannel ?? undefined}>
                                    {ctx.lastPublishedAt ? formatRelative(ctx.lastPublishedAt) : 'Never'}
                                </span>
                            </InfoRow>
                            {ctx.lastPublishedChannel && (
                                <InfoRow label="Last channel">
                                    <span className="truncate max-w-[120px]">{ctx.lastPublishedChannel}</span>
                                </InfoRow>
                            )}
                            {ctx.postsByChannel.length > 0 && (
                                <div className="space-y-1 pt-0.5">
                                    <p className="text-muted-foreground">Posts by channel</p>
                                    {ctx.postsByChannel.map(c => (
                                        <div key={c.channelId} className="flex justify-between items-center">
                                            <span className="truncate flex-1 text-muted-foreground">{c.channelName}</span>
                                            <span className="font-medium ml-2">{c.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── QUOTA & USAGE ── */}
            {ctx && plan && (
                <div className="p-4 space-y-3 border-b">
                    <SectionHeader
                        icon={<CreditCard className="h-3 w-3" />}
                        label={`Quota · ${usage?.month ?? ctx.currentMonth}`}
                        open={openSections.quota}
                        onToggle={() => toggle('quota')}
                    />
                    {openSections.quota && (
                        <div className="space-y-2">
                            {[
                                { label: 'Posts', used: usage?.postsCreated ?? 0, max: plan.maxPostsPerMonth },
                                { label: 'AI Images', used: usage?.imagesGenerated ?? 0, max: plan.maxAiImagesPerMonth },
                                { label: 'AI Text', used: usage?.aiTextGenerated ?? 0, max: plan.maxAiTextPerMonth },
                            ].map(({ label, used, max }) => {
                                const pct = max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100))
                                const isUnlimited = max === -1
                                const isOver = !isUnlimited && pct >= 90
                                return (
                                    <div key={label} className="space-y-0.5">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{label}</span>
                                            <span className={isOver ? 'text-red-500 font-medium' : ''}>
                                                {isUnlimited ? '∞' : `${used} / ${max}`}
                                            </span>
                                        </div>
                                        {!isUnlimited && (
                                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className={cn('h-full rounded-full transition-all', isOver ? 'bg-red-500' : 'bg-primary')}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── FAILED POSTS / ERRORS ── */}
            {ctx?.recentFailedPosts && ctx.recentFailedPosts.length > 0 && (
                <div className="p-4 space-y-3 border-b">
                    <SectionHeader
                        icon={<MonitorX className="h-3 w-3 text-red-500" />}
                        label={`Post Errors (${ctx.recentFailedPosts.length})`}
                        open={openSections.errors}
                        onToggle={() => toggle('errors')}
                    />
                    {openSections.errors && (
                        <div className="space-y-2">
                            {ctx.recentFailedPosts.slice(0, 5).map(fp => (
                                <div key={fp.id} className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-2 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-red-600 truncate flex-1">{fp.channel?.displayName}</span>
                                        <span className="text-muted-foreground ml-1">{formatRelative(fp.updatedAt)}</span>
                                    </div>
                                    {fp.platformStatuses.map((ps, i) => (
                                        <div key={i} className="flex gap-1.5 items-start">
                                            <PlatformDot platform={ps.platform} />
                                            <p className="text-muted-foreground break-words leading-tight">
                                                <span className="capitalize font-medium text-foreground">{ps.platform}:</span>{' '}
                                                {ps.errorMsg ?? 'Unknown error'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── ACTIVITY LOG ── */}
            {ctx?.recentActivity && ctx.recentActivity.length > 0 && (
                <div className="p-4 space-y-3">
                    <SectionHeader
                        icon={<Activity className="h-3 w-3" />}
                        label="Activity Log"
                        open={openSections.activity}
                        onToggle={() => toggle('activity')}
                    />
                    {openSections.activity && (
                        <div className="space-y-1.5">
                            {ctx.recentActivity.map((a, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <span className="mt-0.5 text-primary">·</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium capitalize">{a.action.replace(/_/g, ' ')}</p>
                                        <p className="text-muted-foreground">{formatRelative(a.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
