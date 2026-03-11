'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import {
    Search, BookOpen, MessageSquare, ChevronRight, Plus, Loader2,
    Clock, Tag, Eye, LifeBuoy, CheckCircle2, AlertCircle, Circle, XCircle,
    Headphones, ArrowRight, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Category {
    id: string
    name: string
    slug: string
    description: string
    iconSvg: string
    _count: { articles: number }
}

interface Article {
    id: string
    title: string
    slug: string
    excerpt: string
    viewCount: number
    updatedAt: string
    category: { name: string; slug: string }
}

interface Ticket {
    id: string
    subject: string
    status: string
    priority: string
    category: string
    updatedAt: string
    _count: { messages: number }
}

const STATUS_ICON: Record<string, React.ReactNode> = {
    open: <Circle className="h-3 w-3 text-blue-500" />,
    pending: <Clock className="h-3 w-3 text-yellow-500" />,
    resolved: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    closed: <XCircle className="h-3 w-3 text-muted-foreground" />,
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

export default function SupportPage() {
    const t = useTranslation()
    const router = useRouter()
    const { data: session } = useSession()

    const [q, setQ] = useState('')
    const [searchResults, setSearchResults] = useState<Article[]>([])
    const [searching, setSearching] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [popularArticles, setPopularArticles] = useState<Article[]>([])
    const [myTickets, setMyTickets] = useState<Ticket[]>([])
    const [loadingCategories, setLoadingCategories] = useState(true)
    const [loadingTickets, setLoadingTickets] = useState(true)

    // New ticket dialog
    const [showNewTicket, setShowNewTicket] = useState(false)
    const [ticketForm, setTicketForm] = useState({
        subject: '', category: '', priority: 'medium', message: ''
    })
    const [submitting, setSubmitting] = useState(false)

    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Load categories + popular articles
    useEffect(() => {
        Promise.all([
            fetch('/api/support/categories').then(r => r.json()),
            fetch('/api/support/articles?limit=5').then(r => r.json()),
        ]).then(([cats, arts]) => {
            setCategories(cats || [])
            setPopularArticles(arts.articles || [])
            setLoadingCategories(false)
        }).catch(() => setLoadingCategories(false))
    }, [])

    // Load my tickets
    useEffect(() => {
        if (!session?.user) { setLoadingTickets(false); return }
        fetch('/api/support/tickets?limit=5').then(r => r.json()).then(data => {
            setMyTickets(data.tickets || [])
            setLoadingTickets(false)
        }).catch(() => setLoadingTickets(false))
    }, [session])

    // Debounced search
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current)
        if (!q.trim()) { setSearchResults([]); return }
        setSearching(true)
        searchTimer.current = setTimeout(() => {
            fetch(`/api/support/articles?q=${encodeURIComponent(q)}&limit=8`)
                .then(r => r.json())
                .then(data => { setSearchResults(data.articles || []); setSearching(false) })
                .catch(() => setSearching(false))
        }, 350)
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
    }, [q])

    const submitTicket = async () => {
        if (!ticketForm.subject || !ticketForm.category || !ticketForm.message) {
            toast.error('Please fill in all required fields')
            return
        }
        setSubmitting(true)
        try {
            const res = await fetch('/api/support/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticketForm),
            })
            if (!res.ok) throw new Error()
            const ticket = await res.json()
            toast.success(t('support.ticket.submitSuccess'))
            setShowNewTicket(false)
            setTicketForm({ subject: '', category: '', priority: 'medium', message: '' })
            router.push(`/dashboard/support/tickets/${ticket.id}`)
        } catch {
            toast.error('Failed to submit ticket')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
                <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black)]" />
                <div className="relative px-6 py-16 text-center max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-4 font-medium">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('support.helpCenter')}
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-3">
                        How can we help you?
                    </h1>
                    <p className="text-muted-foreground mb-8">
                        Search our knowledge base or create a support ticket
                    </p>
                    {/* Search */}
                    <div className="relative max-w-xl mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder={t('support.searchPlaceholder')}
                            className="pl-11 h-12 text-base bg-background/80 backdrop-blur border-border/60 rounded-xl shadow-sm"
                        />
                        {searching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                    </div>
                    {/* Search results dropdown */}
                    {(searchResults.length > 0 || (q.trim() && !searching)) && (
                        <div className="mt-2 max-w-xl mx-auto rounded-xl border bg-background/95 backdrop-blur shadow-lg text-left overflow-hidden">
                            {searchResults.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">No results found</div>
                            ) : searchResults.map(article => (
                                <button
                                    key={article.id}
                                    onClick={() => router.push(`/dashboard/support/kb/${article.slug}`)}
                                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted text-sm border-b last:border-0 transition-colors"
                                >
                                    <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <div className="text-left">
                                        <p className="font-medium">{article.title}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-1">{article.excerpt}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0 mt-0.5" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
                {/* KB Categories */}
                <section>
                    <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        {t('support.browseCategories')}
                    </h2>
                    {loadingCategories ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => router.push(`/dashboard/support/kb?category=${cat.slug}`)}
                                    className="group flex flex-col gap-2 p-5 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                                >
                                    {cat.iconSvg ? (
                                        <span dangerouslySetInnerHTML={{ __html: cat.iconSvg }} className="[&>svg]:h-6 [&>svg]:w-6 [&>svg]:text-primary" />
                                    ) : (
                                        <BookOpen className="h-6 w-6 text-primary" />
                                    )}
                                    <span className="font-medium text-sm">{cat.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {cat._count.articles} articles
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {/* Popular Articles */}
                {popularArticles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary" />
                            {t('support.popularArticles')}
                        </h2>
                        <div className="divide-y border rounded-xl bg-card overflow-hidden">
                            {popularArticles.map(article => (
                                <button
                                    key={article.id}
                                    onClick={() => router.push(`/dashboard/support/kb/${article.slug}`)}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted text-sm group transition-colors"
                                >
                                    <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                    <div className="flex-1 text-left">
                                        <p className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                                            {article.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-1">{article.excerpt}</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.viewCount}</span>
                                        <Badge variant="outline" className="text-xs">{article.category.name}</Badge>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                </button>
                            ))}
                        </div>
                        <Button variant="ghost" size="sm" className="mt-3" onClick={() => router.push('/dashboard/support/kb')}>
                            {t('support.viewAll')} <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                    </section>
                )}

                {/* My Tickets */}
                {session?.user && (
                    <section>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                {t('support.myTickets')}
                            </h2>
                            <Button size="sm" onClick={() => setShowNewTicket(true)}>
                                <Plus className="h-4 w-4 mr-1.5" />
                                {t('support.newTicket')}
                            </Button>
                        </div>
                        {loadingTickets ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                                ))}
                            </div>
                        ) : myTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 border rounded-xl bg-card text-center gap-3">
                                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                                <p className="text-muted-foreground">{t('support.noTickets')}</p>
                                <Button onClick={() => setShowNewTicket(true)}>
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    {t('support.newTicket')}
                                </Button>
                            </div>
                        ) : (
                            <div className="divide-y border rounded-xl bg-card overflow-hidden">
                                {myTickets.map(ticket => (
                                    <button
                                        key={ticket.id}
                                        onClick={() => router.push(`/dashboard/support/tickets/${ticket.id}`)}
                                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted text-sm group transition-colors"
                                    >
                                        <span className="shrink-0">{STATUS_ICON[ticket.status]}</span>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium group-hover:text-primary transition-colors">{ticket.subject}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {ticket._count.messages} messages · Updated {formatDate(ticket.updatedAt)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[ticket.priority])}>
                                                {t(`support.ticket.priority.${ticket.priority}`)}
                                            </span>
                                            <span className="text-xs text-muted-foreground capitalize">{ticket.status}</span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Still Need Help */}
                <section className="rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border p-8 flex flex-col md:flex-row items-center gap-6">
                    <div className="p-4 rounded-full bg-primary/10">
                        <Headphones className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-lg font-semibold">{t('support.stillNeedHelp')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t('support.stillNeedHelpDesc')}</p>
                    </div>
                    <Button onClick={() => setShowNewTicket(true)} className="shrink-0">
                        <Plus className="h-4 w-4 mr-1.5" />
                        {t('support.contactSupport')}
                    </Button>
                </section>
            </div>

            {/* New Ticket Dialog */}
            <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LifeBuoy className="h-5 w-5 text-primary" />
                            {t('support.ticket.title')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>{t('support.ticket.subject')} *</Label>
                            <Input
                                placeholder={t('support.ticket.subjectPlaceholder')}
                                value={ticketForm.subject}
                                onChange={e => setTicketForm(p => ({ ...p, subject: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>{t('support.ticket.categoryLabel')} *</Label>
                                <Select
                                    value={ticketForm.category}
                                    onValueChange={v => setTicketForm(p => ({ ...p, category: v }))}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                        {['billing', 'bug', 'feature', 'account', 'other'].map(c => (
                                            <SelectItem key={c} value={c}>{t(`support.ticket.category.${c}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>{t('support.ticket.priorityLabel')}</Label>
                                <Select
                                    value={ticketForm.priority}
                                    onValueChange={v => setTicketForm(p => ({ ...p, priority: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {['low', 'medium', 'high', 'urgent'].map(p => (
                                            <SelectItem key={p} value={p}>{t(`support.ticket.priority.${p}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>{t('support.ticket.message')} *</Label>
                            <Textarea
                                placeholder={t('support.ticket.messagePlaceholder')}
                                rows={5}
                                value={ticketForm.message}
                                onChange={e => setTicketForm(p => ({ ...p, message: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowNewTicket(false)} disabled={submitting}>Cancel</Button>
                        <Button onClick={submitTicket} disabled={submitting}>
                            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                            {submitting ? t('support.ticket.submitting') : t('support.ticket.submit')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
