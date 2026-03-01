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
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    Settings,
    Plug,
    Activity,
    LogOut,
    ChevronLeft,
    Menu,
    Zap,
    UserCircle,
    Key,
    X,
    Layers,
    ChevronDown,
    Check,
    CreditCard,
    LayoutList,
    Code2,
    Plus,
    Paintbrush,
    FileText,
    BookOpen,
    Tag,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useWorkspace } from '@/lib/workspace-context'
import { useBranding } from '@/lib/use-branding'

interface PlanUsage {
    aiImage: { used: number; limit: number }
    posts: { used: number; limit: number }
    apiKeys: { count: number }
}

interface NavItem {
    titleKey: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
    roles?: string[]
    exact?: boolean  // use exact pathname match instead of startsWith
}

const mainNav: NavItem[] = [
    { titleKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { titleKey: 'nav.channels', href: '/dashboard/channels', icon: Megaphone },
    { titleKey: 'nav.posts', href: '/dashboard/posts', icon: PenSquare, exact: true },
    { titleKey: 'nav.calendar', href: '/dashboard/posts/calendar', icon: CalendarDays },
    { titleKey: 'nav.queue', href: '/dashboard/posts/queue', icon: CalendarClock },
    { titleKey: 'nav.approvals', href: '/dashboard/posts/approvals', icon: CheckCircle2 },
    { titleKey: 'nav.media', href: '/dashboard/media', icon: Image },
    { titleKey: 'nav.smartflow', href: '/dashboard/smartflow', icon: Zap },
    { titleKey: 'nav.inbox', href: '/dashboard/inbox', icon: Mail },
    { titleKey: 'nav.reports', href: '/dashboard/reports', icon: BarChart3 },
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

export function Sidebar({ session }: { session: Session }) {
    const pathname = usePathname()
    const router = useRouter()
    const [collapsed, setCollapsed] = useState(false)

    // Auto-collapse sidebar on Inbox page for more space
    useEffect(() => {
        const isInbox = pathname?.includes('/dashboard/inbox')
        setCollapsed(!!isInbox)
    }, [pathname])
    const [mobileOpen, setMobileOpen] = useState(false)
    const isAdmin = session?.user?.role === 'ADMIN' // Only system ADMIN sees Users/API Hub
    const isOwnerOrAbove = session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER'
    const t = useTranslation()
    const { activeChannel, channels, setActiveChannel, loadingChannels } = useWorkspace()
    const branding = useBranding()
    const [usage, setUsage] = useState<PlanUsage | null>(null)

    useEffect(() => {
        fetch('/api/user/plan-usage')
            .then(r => r.ok ? r.json() : null)
            .then(d => d && setUsage(d))
            .catch(() => { })
    }, [])

    // Handle workspace channel switch — navigate to channel page
    const handleChannelSwitch = (ch: typeof channels[0]) => {
        setActiveChannel(ch)
        // Navigate to channel settings page if we're on a channel page or dashboard
        if (pathname?.startsWith('/dashboard/channels/') || pathname === '/dashboard/channels' || pathname === '/dashboard') {
            router.push(`/dashboard/channels/${ch.id}`)
        }
    }

    // Close mobile expanded sidebar on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    const initials = session?.user?.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?'

    /** Shared content renderer for expanded sidebars (desktop full + mobile overlay) */
    const expandedContent = (onClose?: () => void) => (
        <>
            {/* Header */}
            <div className="flex h-16 items-center justify-between px-4">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <NextImage src={branding.logoUrl} alt={branding.appName} width={32} height={32} className="rounded-lg object-contain" unoptimized />
                    <span className="text-lg font-bold tracking-tight">{branding.appName}</span>
                </Link>
                {onClose ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(true)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <Separator />

            {/* Workspace Picker */}
            <div className="px-3 py-2">
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('workspace.label')}
                </p>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-accent/50 hover:bg-accent transition-colors cursor-pointer">
                            <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="flex-1 text-left truncate text-xs">
                                {loadingChannels ? t('workspace.loading') : (activeChannel?.displayName || t('workspace.selectChannel'))}
                            </span>
                            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        {channels.map((ch) => (
                            <DropdownMenuItem
                                key={ch.id}
                                onClick={() => handleChannelSwitch(ch)}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="flex-1 truncate">{ch.displayName}</span>
                                {activeChannel?.id === ch.id && <Check className="h-3.5 w-3.5 text-primary" />}
                            </DropdownMenuItem>
                        ))}
                        {/* Empty state: no channels yet */}
                        {!loadingChannels && channels.length === 0 && (
                            <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-2">
                                        {t('workspace.noChannels')}
                                    </p>
                                    <Link
                                        href="/dashboard/channels"
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        {t('workspace.createFirstChannel')}
                                    </Link>
                                </div>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Separator />

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto overscroll-contain py-4">
                <nav className="space-y-1 px-3">
                    {mainNav.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                'hover:bg-accent hover:text-accent-foreground',
                                item.exact ? pathname === item.href : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{t(item.titleKey)}</span>
                            {item.badge && (
                                <Badge variant="secondary" className="ml-auto text-xs">
                                    {item.badge}
                                </Badge>
                            )}
                        </Link>
                    ))}
                </nav>

                {isAdmin && (
                    <>
                        <Separator className="my-4" />
                        <div className="px-3">
                            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {t('nav.administration')}
                            </p>
                            <nav className="space-y-1">
                                {adminNav.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                            'hover:bg-accent hover:text-accent-foreground',
                                            item.exact ? pathname === item.href : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 shrink-0" />
                                        <span>{t(item.titleKey)}</span>
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    </>
                )}
            </div>

            {/* ── Plan Usage Widget ── */}
            {usage && (
                <div className="px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">⚡ Plan Usage</p>
                    <div className="space-y-2">
                        {/* AI Image */}
                        {(() => {
                            const { used, limit } = usage.aiImage
                            const pct = limit === -1 ? 0 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100)
                            const remaining = limit === -1 ? '∞' : Math.max(0, limit - used)
                            const isHot = limit !== -1 && pct >= 80
                            return (
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
                                            AI Image
                                        </span>
                                        <span className={`text-[10px] font-semibold tabular-nums ${isHot ? 'text-red-400' : 'text-violet-400'}`}>
                                            {remaining}{limit !== -1 && ` / ${limit}`}
                                        </span>
                                    </div>
                                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isHot ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'}`}
                                            style={{ width: limit === -1 ? '100%' : `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Posts */}
                        {(() => {
                            const { used, limit } = usage.posts
                            const pct = limit === -1 ? 0 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100)
                            const remaining = limit === -1 ? '∞' : Math.max(0, limit - used)
                            const isHot = limit !== -1 && pct >= 80
                            return (
                                <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Posts
                                        </span>
                                        <span className={`text-[10px] font-semibold tabular-nums ${isHot ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {remaining}{limit !== -1 && ` / ${limit}`}
                                        </span>
                                    </div>
                                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isHot ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                                            style={{ width: limit === -1 ? '100%' : `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })()}

                        {/* API Keys */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                                API Keys
                            </span>
                            <span className="text-[10px] font-semibold text-amber-400 tabular-nums">
                                {usage.apiKeys.count} saved
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <Separator />

            {/* Footer */}
            <div className="p-3">
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <LanguageSwitcher />
                    <NotificationBell />
                </div>

                <Separator className="my-2" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-xs font-medium">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 truncate">
                                <p className="text-sm font-medium truncate">{session?.user?.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <div className="px-2 py-1.5">
                            <p className="text-sm font-medium">{session?.user?.name}</p>
                            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                            <Badge className="mt-1" variant="outline">
                                {session?.user?.role}
                            </Badge>
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
                                {t('nav.developerApi') || 'Developer API'}
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                            <LogOut className="mr-2 h-4 w-4" />
                            {t('common.signOut')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </>
    )

    /** Collapsed content for desktop collapsed state */
    const collapsedContent = () => (
        <>
            <div className="flex h-16 items-center justify-center px-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(false)}>
                    <Menu className="h-4 w-4" />
                </Button>
            </div>

            <Separator />

            <ScrollArea className="flex-1 py-4">
                <nav className="space-y-1 px-2">
                    {mainNav.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center justify-center rounded-lg p-2 transition-colors',
                                'hover:bg-accent hover:text-accent-foreground',
                                item.exact ? pathname === item.href : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground',
                            )}
                            title={t(item.titleKey)}
                        >
                            <item.icon className="h-4 w-4" />
                        </Link>
                    ))}
                </nav>

                {isAdmin && (
                    <>
                        <Separator className="my-4" />
                        <nav className="space-y-1 px-2">
                            {adminNav.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center justify-center rounded-lg p-2 transition-colors',
                                        'hover:bg-accent hover:text-accent-foreground',
                                        item.exact ? pathname === item.href : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground',
                                    )}
                                    title={t(item.titleKey)}
                                >
                                    <item.icon className="h-4 w-4" />
                                </Link>
                            ))}
                        </nav>
                    </>
                )}
            </ScrollArea>

            <Separator />

            <div className="flex flex-col items-center gap-2 p-2">
                <ThemeToggle />
                <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-[10px] font-medium">
                        {initials}
                    </AvatarFallback>
                </Avatar>
            </div>
        </>
    )

    return (
        <>
            {/* ── Mobile: collapsed icon strip (always visible) ── */}
            <aside className="md:hidden flex h-screen w-[52px] flex-col border-r bg-card shrink-0">
                {/* Hamburger to expand */}
                <div className="flex h-16 items-center justify-center">
                    <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
                        <Menu className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>
                <Separator />
                {/* Icon-only nav */}
                <ScrollArea className="flex-1 py-4">
                    <nav className="space-y-1 px-2">
                        {mainNav.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center justify-center rounded-lg p-2 transition-colors',
                                    'hover:bg-accent hover:text-accent-foreground',
                                    item.exact ? pathname === item.href : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground',
                                )}
                                title={t(item.titleKey)}
                            >
                                <item.icon className="h-4 w-4" />
                            </Link>
                        ))}
                    </nav>
                    {isAdmin && (
                        <>
                            <Separator className="my-4" />
                            <nav className="space-y-1 px-2">
                                {adminNav.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center justify-center rounded-lg p-2 transition-colors',
                                            'hover:bg-accent hover:text-accent-foreground',
                                            item.exact ? pathname === item.href : (pathname === item.href || pathname?.startsWith(item.href + '/'))
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                        title={t(item.titleKey)}
                                    >
                                        <item.icon className="h-4 w-4" />
                                    </Link>
                                ))}
                            </nav>
                        </>
                    )}
                </ScrollArea>
                <Separator />
                {/* Compact footer */}
                <div className="flex flex-col items-center gap-2 p-2">
                    <ThemeToggle />
                    <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/10 text-[10px] font-medium">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </aside>

            {/* ── Mobile: expanded overlay (when user taps hamburger) ── */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside className="relative z-10 flex h-full w-[280px] flex-col bg-card border-r animate-in slide-in-from-left duration-200">
                        {expandedContent(() => setMobileOpen(false))}
                    </aside>
                </div>
            )}

            {/* ── Desktop sidebar ── */}
            <aside
                className={cn(
                    'hidden md:flex h-screen flex-col border-r bg-card transition-all duration-300',
                    collapsed ? 'w-[68px]' : 'w-[260px]'
                )}
            >
                {collapsed ? collapsedContent() : expandedContent()}
            </aside>
        </>
    )
}
