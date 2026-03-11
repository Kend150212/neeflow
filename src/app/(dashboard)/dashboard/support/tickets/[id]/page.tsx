'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import {
    ArrowLeft, Send, Loader2, Circle, Clock, CheckCircle2, XCircle,
    User, Bot, Lock, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Message {
    id: string
    content: string
    isInternal: boolean
    isBotMsg: boolean
    createdAt: string
    sender: { id: string; name: string | null; image: string | null; role: string }
}

interface Ticket {
    id: string
    subject: string
    status: string
    priority: string
    category: string
    createdAt: string
    updatedAt: string
    messages: Message[]
}

const STATUS_STYLES: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
    open: {
        icon: <Circle className="h-3 w-3" />,
        className: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
        label: 'open',
    },
    pending: {
        icon: <Clock className="h-3 w-3" />,
        className: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
        label: 'pending',
    },
    resolved: {
        icon: <CheckCircle2 className="h-3 w-3" />,
        className: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
        label: 'resolved',
    },
    closed: {
        icon: <XCircle className="h-3 w-3" />,
        className: 'text-muted-foreground bg-muted',
        label: 'closed',
    },
}

const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function MessageBubble({ msg, myId }: { msg: Message; myId: string }) {
    const isMe = msg.sender.id === myId
    const initials = (msg.sender.name || '?').slice(0, 2).toUpperCase()

    return (
        <div className={cn('flex gap-3', isMe ? 'flex-row-reverse' : 'flex-row')}>
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={msg.sender.image || ''} />
                <AvatarFallback className="text-xs">
                    {msg.isBotMsg ? <Bot className="h-4 w-4" /> : initials}
                </AvatarFallback>
            </Avatar>
            <div className={cn('max-w-[70%] space-y-1', isMe ? 'items-end' : 'items-start')}>
                <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', isMe ? 'flex-row-reverse' : '')}>
                    <span className="font-medium">{isMe ? 'You' : (msg.isBotMsg ? 'Bot' : msg.sender.name)}</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={cn(
                    'rounded-2xl px-4 py-2.5 text-sm',
                    isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted text-foreground rounded-tl-sm'
                )}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
            </div>
        </div>
    )
}

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const t = useTranslation()
    const router = useRouter()
    const { data: session } = useSession()

    const [ticket, setTicket] = useState<Ticket | null>(null)
    const [loading, setLoading] = useState(true)
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    const myId = session?.user?.id || ''

    useEffect(() => {
        fetch(`/api/support/tickets/${id}`)
            .then(r => { if (!r.ok) throw new Error(); return r.json() })
            .then(setTicket)
            .catch(() => {
                toast.error('Ticket not found')
                router.push('/dashboard/support')
            })
            .finally(() => setLoading(false))
    }, [id, router])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [ticket?.messages.length])

    const sendReply = async () => {
        if (!reply.trim()) return
        setSending(true)
        try {
            const res = await fetch(`/api/support/tickets/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: reply }),
            })
            if (!res.ok) throw new Error()
            const msg = await res.json()
            setTicket(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev)
            setReply('')
        } catch {
            toast.error('Failed to send reply')
        } finally {
            setSending(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!ticket) return null

    const statusConfig = STATUS_STYLES[ticket.status] || STATUS_STYLES.open
    const isClosed = ticket.status === 'closed'

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            {/* Header */}
            <div className="border-b bg-background px-6 py-4 shrink-0">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => router.push('/dashboard/support')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <button onClick={() => router.push('/dashboard/support')} className="hover:text-foreground">
                                {t('support.helpCenter')}
                            </button>
                            <ChevronRight className="h-3 w-3" />
                            <button onClick={() => router.push('/dashboard/support')} className="hover:text-foreground">
                                {t('support.myTickets')}
                            </button>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-foreground">#{id.slice(-6).toUpperCase()}</span>
                        </div>
                        <h1 className="text-lg font-semibold truncate">{ticket.subject}</h1>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', statusConfig.className)}>
                                {statusConfig.icon}
                                {t(`support.ticket.status.${ticket.status}`)}
                            </span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[ticket.priority])}>
                                {t(`support.ticket.priority.${ticket.priority}`)}
                            </span>
                            <Badge variant="outline" className="text-xs capitalize">{ticket.category}</Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {ticket.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <p className="text-sm">{t('support.ticket.noMessages')}</p>
                    </div>
                ) : ticket.messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} myId={myId} />
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            <div className="border-t bg-background px-6 py-4 shrink-0">
                {isClosed ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                        <Lock className="h-4 w-4" />
                        This ticket is closed.
                    </div>
                ) : (
                    <div className="flex gap-3 items-end">
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={session?.user?.image || ''} />
                            <AvatarFallback className="text-xs">
                                {(session?.user?.name || 'U').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <Textarea
                                value={reply}
                                onChange={e => setReply(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply()
                                }}
                                placeholder={t('support.ticket.replyPlaceholder')}
                                rows={2}
                                className="resize-none"
                            />
                        </div>
                        <Button onClick={sendReply} disabled={sending || !reply.trim()} size="icon" className="shrink-0">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                )}
                <p className="text-xs text-muted-foreground mt-2 text-center">Cmd+Enter to send</p>
            </div>
        </div>
    )
}
