'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import NextImage from 'next/image'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationBell } from '@/components/notification-bell'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    LayoutDashboard,
    Megaphone,
    PenSquare,
    CalendarDays,
    CalendarClock,
    CheckCircle2,
    Image,
    Mail,
    BarChart3,
    Users,
    Settings2,
    Plug,
    Activity,
    LogOut,
    Zap,
    UserCircle,
    Key,
    Check,
    CreditCard,
    LayoutList,
    Code2,
    Plus,
    Paintbrush,
    FileText,
    BookOpen,
    Tag,
    Sparkles,
    Clapperboard,
    MoreHorizontal,
    ChevronRight,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useWorkspace } from '@/lib/workspace-context'
import { useBranding } from '@/lib/use-branding'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PlanUsage {
    aiImage: { used: number; limit: number }
    posts: { used: number; limit: number }
    apiCalls: { used: number; limit: number }
}

interface NavItem {
    titleKey: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
    roles?: string[]
    exact?: boolean
}

const topNav: NavItem[] = [
    { titleKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { titleKey: 'nav.channels', href: '/dashboard/channels', icon: Megaphone },
    { titleKey: 'nav.posts', href: '/dashboard/posts', icon: PenSquare, exact: true },
    { titleKey: 'nav.calendar', href: '/dashboard/posts/calendar', icon: CalendarDays },
    { titleKey: 'nav.queue', href: '/dashboard/posts/queue', icon: CalendarClock },
    { titleKey: 'nav.approvals', href: '/dashboard/posts/approvals', icon: CheckCircle2 },
    { titleKey: 'nav.media', href: '/dashboard/media', icon: Image },
]

const bottomNav: NavItem[] = [
    { titleKey: 'nav.clientBoard', href: '/dashboard/client-board', icon: Zap },
    { titleKey: 'nav.inbox', href: '/dashboard/inbox', icon: Mail },
    { titleKey: 'nav.reports', href: '/dashboard/reports', icon: BarChart3 },
    { titleKey: 'nav.integrations', href: '/dashboard/integrations', icon: Plug },
    { titleKey: 'nav.apiKeys', href: '/dashboard/api-keys', icon: Key },
    { titleKey: 'nav.billing', href: '/dashboard/billing', icon: CreditCard },
]

const adminNav: NavItem[] = [
    { titleKey: 'nav.users', href: '/admin/users', icon: Users, roles: ['ADMIN'] },
    { titleKey: 'nav.apiHub', href: '/admin/integrations', icon: Plug, roles: ['ADMIN'] },
    { titleKey: 'nav.plans', href: '/admin/plans', icon: LayoutList, roles: ['ADMIN'] },
    { titleKey: 'nav.billing', href: '/admin/billing', icon: CreditCard, roles: ['ADMIN'], exact: true },
    { titleKey: 'nav.coupons', href: '/admin/billing/coupons', icon: Tag, roles: ['ADMIN'] },
    { titleKey: 'nav.activity', href: '/admin/activity', icon: Activity, roles: ['ADMIN'] },
    { titleKey: 'nav.branding', href: '/admin/branding', icon: Paintbrush, roles: ['ADMIN'] },
    { titleKey: 'nav.legal', href: '/admin/legal', icon: FileText, roles: ['ADMIN'] },
    { titleKey: 'nav.guide', href: '/admin/guide', icon: BookOpen, roles: ['ADMIN'] },
]

const mobileTabItems: NavItem[] = [
    { titleKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { titleKey: 'nav.posts', href: '/dashboard/posts', icon: PenSquare, exact: true },
    { titleKey: 'nav.studio', href: '/dashboard/studio', icon: Clapperboard },
    { titleKey: 'nav.clientBoard', href: '/dashboard/client-board', icon: Zap },
]

// ── Nav item pill ─────────────────────────────────────────────────────────────
function NavPill({
    item,
    isActive,
    pendingCount,
    t,
}: {
    item: NavItem
    isActive: boolean
    pendingCount?: number
    t: (key: string) => string
}) {
    const showBadge = item.href === '/dashboard/client-board' && (pendingCount ?? 0) > 0
    const label = t(item.titleKey)
    return (
        <Link
            href={item.href}
            className={cn(
                'relative flex flex-col items-center gap-[3px] py-2 px-1 rounded-xl transition-all duration-150 group w-full overflow-hidden',
                isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            {/* Icon with optional badge dot */}
            <div className="relative shrink-0">
                <item.icon className={cn('h-[18px] w-[18px]', isActive && 'text-primary')} />
                {showBadge && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                )}
            </div>
            {/* Label — clamp to 2 lines so nothing overflows horizontally */}
            <span
                className={cn(
                    'w-full text-center text-[8.5px] font-semibold uppercase tracking-wide leading-tight line-clamp-2',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
                style={{ wordBreak: 'break-word' }}
            >
                {label}
            </span>
        </Link>
    )
}

// ── Plan Usage bars (compact, tooltip on hover) ───────────────────────────────
function PlanUsageWidget({ usage }: { usage: PlanUsage }) {
    const bars = [
        { icon: Sparkles, color: 'from-violet-500 to-fuchsia-400', label: 'AI', ...usage.aiImage },
        { icon: PenSquare, color: 'from-emerald-500 to-teal-400', label: 'Posts', ...usage.posts },
        { icon: Key, color: 'from-amber-500 to-yellow-400', label: 'API', ...usage.apiCalls },
    ]

    return (
        <div className="relative group px-3 py-2 cursor-default shrink-0">
            <div className="flex flex-col gap-1">
                {bars.map((bar) => {
                    if (bar.label === 'API' && bar.limit === 0) return null
                    const pct = bar.limit === -1 ? 8 : bar.limit === 0 ? 100 : Math.min(100, (bar.used / bar.limit) * 100)
                    const isHot = bar.limit !== -1 && bar.limit !== 0 && pct >= 80
                    return (
                        <div key={bar.label} className="h-1 rounded-full bg-muted/60 overflow-hidden">
                            <div
                                className={cn('h-full rounded-full transition-all duration-500',
                                    isHot ? 'bg-gradient-to-r from-orange-500 to-red-500' : `bg-gradient-to-r ${bar.color}`)}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    )
                })}
            </div>
            {/* Tooltip floats to the right */}
            <div className="pointer-events-none absolute left-[84px] bottom-0 z-50 min-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-card border border-border rounded-xl shadow-xl p-3 space-y-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Plan Usage</p>
                    {bars.map((bar) => {
                        if (bar.label === 'API' && bar.limit === 0) return null
                        const pct = bar.limit === -1 ? 0 : bar.limit === 0 ? 100 : Math.min(100, (bar.used / bar.limit) * 100)
                        const isHot = bar.limit !== -1 && bar.limit !== 0 && pct >= 80
                        return (
                            <div key={bar.label} className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <bar.icon className={cn('h-3 w-3', isHot ? 'text-red-400' : 'text-muted-foreground')} />
                                        <span className="text-[11px] font-medium text-muted-foreground">{bar.label}</span>
                                    </div>
                                    <span className={cn('text-[11px] font-bold tabular-nums', isHot && 'text-red-400')}>
                                        {bar.used.toLocaleString()}
                                        <span className="font-normal text-muted-foreground">
                                            {bar.limit === -1 ? ' / ∞' : ` / ${bar.limit.toLocaleString()}`}
                                        </span>
                                    </span>
                                </div>
                                <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
                                    <div
                                        className={cn('h-full rounded-full', isHot ? 'bg-gradient-to-r from-orange-500 to-red-500' : `bg-gradient-to-r ${bar.color}`)}
                                        style={{ width: bar.limit === -1 ? '8%' : `${Math.min(100, (bar.used / bar.limit) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ── Workspace Picker ──────────────────────────────────────────────────────────
function WorkspacePicker({
    channels,
    activeChannel,
    loadingChannels,
    onSwitch,
    t,
}: {
    channels: { id: string; displayName: string }[]
    activeChannel: { id: string; displayName: string } | undefined
    loadingChannels: boolean
    onSwitch: (ch: { id: string; displayName: string }) => void
    t: (key: string) => string
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        if (open) document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const displayName = loadingChannels ? '…' : (activeChannel?.displayName || '?')
    const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

    return (
        <div ref={ref} className="relative flex flex-col items-center py-1 shrink-0">
            <button
                onClick={() => setOpen(p => !p)}
                title={activeChannel?.displayName || t('workspace.selectChannel')}
                className="relative flex flex-col items-center gap-1 w-full cursor-pointer group"
            >
                <div className={cn(
                    'h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center ring-2 transition-all duration-150',
                    open ? 'ring-primary' : 'ring-border group-hover:ring-primary/60'
                )}>
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{initials}</span>
                    </div>
                </div>
                <ChevronRight className={cn('h-2.5 w-2.5 text-muted-foreground absolute -right-0.5 top-3 transition-transform', open && 'rotate-90')} />
            </button>

            {open && (
                <div className="absolute left-[46px] top-0 z-50 w-56 bg-card border border-border rounded-xl shadow-xl py-1.5 animate-in slide-in-from-left-2 duration-150">
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('workspace.label')}</p>
                    {channels.map(ch => (
                        <button
                            key={ch.id}
                            onClick={() => { onSwitch(ch); setOpen(false) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors cursor-pointer"
                        >
                            <div className="h-6 w-6 rounded-lg overflow-hidden flex items-center justify-center bg-primary/15 shrink-0">
                                <span className="text-[9px] font-bold text-primary">{ch.displayName.slice(0, 2).toUpperCase()}</span>
                            </div>
                            <span className="flex-1 text-left truncate font-medium">{ch.displayName}</span>
                            {activeChannel?.id === ch.id && <Check className="h-3 w-3 text-primary shrink-0" />}
                        </button>
                    ))}
                    {!loadingChannels && channels.length === 0 && (
                        <div className="px-3 py-3 text-center">
                            <p className="text-xs text-muted-foreground mb-2">{t('workspace.noChannels')}</p>
                            <Link href="/dashboard/channels" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                <Plus className="h-3 w-3" />{t('workspace.createFirstChannel')}
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Settings Popover (dark mode + language + notifications) ───────────────────
function SettingsPopover() {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        if (open) document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    return (
        <div ref={ref} className="relative flex items-center justify-center shrink-0">
            <button
                onClick={() => setOpen(p => !p)}
                title="Settings"
                className={cn(
                    'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 cursor-pointer',
                    open ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
            >
                <Settings2 className="h-4 w-4" />
            </button>

            {open && (
                <div className="absolute left-[46px] bottom-0 z-50 w-52 bg-card border border-border rounded-xl shadow-xl p-3 animate-in slide-in-from-left-2 duration-150">
                    <p className="pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Preferences</p>
                    <div className="flex flex-col gap-1">
                        {/* Dark mode */}
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted transition-colors">
                            <span className="text-xs font-medium">Appearance</span>
                            <ThemeToggle />
                        </div>
                        {/* Language */}
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted transition-colors">
                            <span className="text-xs font-medium">Language</span>
                            <LanguageSwitcher />
                        </div>
                        {/* Notifications */}
                        <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted transition-colors">
                            <span className="text-xs font-medium">Notifications</span>
                            <NotificationBell />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Mobile Bottom Tab Bar ─────────────────────────────────────────────────────
function MobileBottomBar({
    pathname,
    pendingCount,
    t,
    activeChannel,
}: {
    pathname: string | null
    pendingCount: number
    t: (key: string) => string
    activeChannel?: { id: string; displayName: string } | undefined
}) {
    const [moreOpen, setMoreOpen] = useState(false)
    const allMoreItems = [
        ...topNav.slice(2),
        ...bottomNav.filter(i => i.href !== '/dashboard/client-board'),
        {
            titleKey: 'nav.studio',
            href: activeChannel?.id ? `/dashboard/studio/${activeChannel.id}` : '/dashboard/studio',
            icon: Clapperboard,
        }
    ] as NavItem[]

    return (
        <>
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-card/90 backdrop-blur-xl border-t border-border flex items-stretch">
                {mobileTabItems.map(item => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                    const isPending = item.href === '/dashboard/client-board' && pendingCount > 0
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative',
                                isActive ? 'text-primary' : 'text-muted-foreground'
                            )}
                        >
                            <div className="relative">
                                <item.icon className="h-5 w-5" />
                                {isPending && (
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                    </span>
                                )}
                            </div>
                            <span className="text-[9px] font-semibold uppercase tracking-wider">{t(item.titleKey)}</span>
                            {isActive && <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-primary" />}
                        </Link>
                    )
                })}
                <button
                    onClick={() => setMoreOpen(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground"
                >
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider">More</span>
                </button>
            </div>

            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl px-0">
                    <SheetHeader className="px-4 pb-3">
                        <SheetTitle className="text-sm">Menu</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-full pb-6">
                        <nav className="grid grid-cols-3 gap-2 px-4">
                            {allMoreItems.map(item => {
                                const isActive = item.exact
                                    ? pathname === item.href
                                    : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMoreOpen(false)}
                                        className={cn(
                                            'flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all',
                                            isActive ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                                        )}
                                    >
                                        <item.icon className="h-6 w-6" />
                                        <span className="text-[10px] font-semibold uppercase tracking-wide leading-tight line-clamp-2">{t(item.titleKey)}</span>
                                    </Link>
                                )
                            })}
                        </nav>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </>
    )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export function Sidebar({ session }: { session: Session }) {
    const pathname = usePathname()
    const router = useRouter()
    const isAdmin = session?.user?.role === 'ADMIN'
    const t = useTranslation()
    const { activeChannel, channels, setActiveChannel, loadingChannels } = useWorkspace()
    const branding = useBranding()
    const [usage, setUsage] = useState<PlanUsage | null>(null)
    const [pendingCount, setPendingCount] = useState(0)

    useEffect(() => {
        fetch('/api/user/plan-usage')
            .then(r => r.ok ? r.json() : null)
            .then(d => d && setUsage(d))
            .catch(() => { })
    }, [])

    useEffect(() => {
        const fetchPending = () => {
            fetch('/api/admin/client-board/pending-count')
                .then(r => r.ok ? r.json() : { count: 0 })
                .then(d => setPendingCount(d.count ?? 0))
                .catch(() => { })
        }
        fetchPending()
        const id = setInterval(fetchPending, 60_000)
        return () => clearInterval(id)
    }, [])

    const handleChannelSwitch = (ch: typeof channels[0]) => {
        setActiveChannel(ch)
        if (pathname?.startsWith('/dashboard/channels/') || pathname === '/dashboard/channels' || pathname === '/dashboard') {
            router.push(`/dashboard/channels/${ch.id}`)
        }
    }

    const initials = session?.user?.name
        ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

    const allNavItems: NavItem[] = [
        ...topNav,
        {
            titleKey: 'nav.studio',
            href: activeChannel?.id ? `/dashboard/studio/${activeChannel.id}` : '/dashboard/studio',
            icon: Clapperboard,
            exact: false,
        },
        ...bottomNav,
    ]

    return (
        <>
            {/* ═══════════════════════════════════════════════════
                DESKTOP: 84px fixed column, always visible
            ═══════════════════════════════════════════════════ */}
            <aside className="hidden md:flex h-screen w-[84px] flex-col border-r border-border bg-card shrink-0 overflow-hidden">

                {/* ── Logo ── */}
                <div className="flex items-center justify-center h-[52px] shrink-0">
                    <Link href="/dashboard">
                        <NextImage
                            src={branding.logoUrl}
                            alt={branding.appName}
                            width={34}
                            height={34}
                            className="rounded-xl object-contain"
                            unoptimized
                        />
                    </Link>
                </div>

                <Separator />

                {/* ── Workspace picker ── */}
                <div className="flex items-center justify-center px-3 py-1 shrink-0">
                    <WorkspacePicker
                        channels={channels}
                        activeChannel={activeChannel ?? undefined}
                        loadingChannels={loadingChannels}
                        onSwitch={(ch) => {
                            const full = channels.find(c => c.id === ch.id)
                            if (full) handleChannelSwitch(full)
                        }}
                        t={t}
                    />
                </div>

                <Separator />

                {/* ── Nav items — scrollable, flexes to fill remaining height ── */}
                <nav className="flex-1 min-h-0 overflow-y-auto py-1 px-2 flex flex-col gap-0.5 scrollbar-none">
                    {allNavItems.map(item => {
                        const isStudio = item.titleKey === 'nav.studio'
                        const isActive = isStudio
                            ? pathname?.startsWith('/dashboard/studio') ?? false
                            : item.exact
                                ? pathname === item.href
                                : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                        return (
                            <NavPill
                                key={item.href}
                                item={item}
                                isActive={isActive}
                                pendingCount={pendingCount}
                                t={t}
                            />
                        )
                    })}

                    {isAdmin && (
                        <>
                            <div className="my-1.5 px-1"><Separator /></div>
                            {adminNav.map(item => {
                                const isActive = item.exact
                                    ? pathname === item.href
                                    : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                                return (
                                    <NavPill
                                        key={item.href}
                                        item={item}
                                        isActive={isActive}
                                        t={t}
                                    />
                                )
                            })}
                        </>
                    )}
                </nav>

                <Separator />

                {/* ── Plan usage bars ── */}
                {usage && <PlanUsageWidget usage={usage} />}

                <Separator />

                {/* ── Footer: Settings icon + Profile avatar in a single compact row ── */}
                <div className="flex items-center justify-around px-2 py-2 shrink-0">
                    <SettingsPopover />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="cursor-pointer group" title={session?.user?.name ?? ''}>
                                <Avatar className="h-8 w-8 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="right" className="w-56 ml-2">
                            <div className="px-2 py-1.5">
                                <p className="text-sm font-medium truncate">{session?.user?.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                                <Badge className="mt-1" variant="outline">{session?.user?.role}</Badge>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <a href="/dashboard/profile" className="flex items-center cursor-pointer">
                                    <UserCircle className="mr-2 h-4 w-4" />
                                    {t('nav.profile')}
                                </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <a href="/dashboard/developer" className="flex items-center cursor-pointer">
                                    <Code2 className="mr-2 h-4 w-4" />
                                    Developer API
                                </a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                                <LogOut className="mr-2 h-4 w-4" />
                                {t('common.signOut')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>

            {/* ═══════════════════════════════════════════════════
                MOBILE: Bottom Tab Bar
            ═══════════════════════════════════════════════════ */}
            <MobileBottomBar
                pathname={pathname}
                pendingCount={pendingCount}
                t={t}
                activeChannel={activeChannel ?? undefined}
            />
        </>
    )
}
