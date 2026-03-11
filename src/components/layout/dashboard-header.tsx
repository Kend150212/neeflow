'use client'

import Link from 'next/link'
import NextImage from 'next/image'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import { useWorkspace } from '@/lib/workspace-context'
import { useTranslation } from '@/lib/i18n'
import { useBranding } from '@/lib/use-branding'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationBell } from '@/components/notification-bell'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
    Check,
    ChevronDown,
    Code2,
    CreditCard,
    Key,
    Kanban,
    LifeBuoy,
    Headphones,
    BookOpen,
    LogOut,
    PenSquare,
    Plus,
    Sparkles,
    UserCircle,
    ShieldCheck,
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

interface PlanUsage {
    aiImage: { used: number; limit: number }
    posts: { used: number; limit: number }
    apiCalls: { used: number; limit: number }
}

// ── Tiny plan‑usage bar strip with hover tooltip ─────────────────────────────
function PlanUsageBars({ usage }: { usage: PlanUsage }) {
    const bars = [
        { color: 'from-violet-500 to-fuchsia-400', icon: Sparkles, label: 'AI Images', ...usage.aiImage },
        { color: 'from-emerald-500 to-teal-400', icon: PenSquare, label: 'Posts', ...usage.posts },
        { color: 'from-amber-500 to-yellow-400', icon: Key, label: 'API', ...usage.apiCalls },
    ]

    return (
        <div className="relative group flex items-center gap-1.5 cursor-default select-none px-2">
            {bars.map((bar) => {
                if (bar.label === 'API' && bar.limit === 0) return null
                const pct = bar.limit === -1 ? 8 : bar.limit === 0 ? 100 : Math.min(100, (bar.used / bar.limit) * 100)
                const isHot = bar.limit !== -1 && bar.limit !== 0 && pct >= 80
                return (
                    <div key={bar.label} className="h-1.5 w-12 rounded-full bg-muted/60 overflow-hidden">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all duration-500',
                                isHot ? 'bg-gradient-to-r from-orange-500 to-red-500' : `bg-gradient-to-r ${bar.color}`
                            )}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                )
            })}

            {/* Hover tooltip — drops down */}
            <div className="pointer-events-none absolute top-full right-0 mt-2 z-50 min-w-[220px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
                                        <span className="text-[11px] font-medium">{bar.label}</span>
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

// ── Workspace dropdown in header ──────────────────────────────────────────────
function ChannelAvatar({ avatarUrl, displayName, size = 6 }: { avatarUrl?: string | null; displayName: string; size?: number }) {
    const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    const sizeClass = `h-${size} w-${size}`
    if (avatarUrl) {
        return (
            <div className={`${sizeClass} rounded-md overflow-hidden shrink-0`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            </div>
        )
    }
    return (
        <div className={`${sizeClass} rounded-md bg-primary/20 flex items-center justify-center shrink-0`}>
            <span className="text-[9px] font-bold text-primary">{initials}</span>
        </div>
    )
}

function WorkspaceDropdown() {
    const { channels, activeChannel, setActiveChannel, loadingChannels } = useWorkspace()
    const t = useTranslation()

    const displayName = loadingChannels ? '…' : (activeChannel?.displayName || t('workspace.selectChannel'))

    const handleSwitch = (ch: typeof channels[0]) => {
        setActiveChannel(ch)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                    {activeChannel
                        ? <ChannelAvatar avatarUrl={activeChannel.avatarUrl} displayName={activeChannel.displayName} size={6} />
                        : <div className="h-6 w-6 rounded-md bg-muted animate-pulse shrink-0" />
                    }
                    <span className="text-sm font-medium max-w-[140px] truncate hidden sm:block">{displayName}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60" sideOffset={8}>
                <div className="px-2 pb-1 pt-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspaces</p>
                </div>
                {channels.map(ch => (
                    <DropdownMenuItem
                        key={ch.id}
                        onClick={() => handleSwitch(ch)}
                        className="cursor-pointer"
                    >
                        <ChannelAvatar avatarUrl={ch.avatarUrl} displayName={ch.displayName} size={5} />
                        <span className="flex-1 truncate ml-2">{ch.displayName}</span>
                        {activeChannel?.id === ch.id && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                    </DropdownMenuItem>
                ))}
                {!loadingChannels && channels.length === 0 && (
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/channels" className="cursor-pointer">
                            <Plus className="mr-2 h-4 w-4" />
                            {t('workspace.createFirstChannel')}
                        </Link>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// ── Main Header ───────────────────────────────────────────────────────────────
export function DashboardHeader({ session }: { session: Session }) {
    const t = useTranslation()
    const pathname = usePathname()
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

    const initials = session?.user?.name
        ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

    const isClientBoardActive = pathname?.startsWith('/dashboard/client-board')

    return (
        <header className="flex-shrink-0 h-12 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-3 gap-2 z-30">

            {/* ── Left: Workspace + Client Board ── */}
            <div className="flex items-center gap-1 min-w-0">
                <WorkspaceDropdown />
                {/* Divider */}
                <div className="w-px h-5 bg-border mx-1 shrink-0" />
                {/* Client Board link */}
                <Link
                    href="/dashboard/client-board"
                    className={cn(
                        'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0',
                        isClientBoardActive
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                >
                    <Kanban className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:block">{t('nav.clientBoard') || 'Client Board'}</span>
                    {pendingCount > 0 && (
                        <span className="flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                        </span>
                    )}
                </Link>
            </div>

            {/* ── Center: Help Center quick link ── */}
            <div className="flex items-center gap-1 min-w-0 flex-1 justify-center hidden md:flex">
                <Link
                    href="/dashboard/support"
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        pathname?.startsWith('/dashboard/support')
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                >
                    <LifeBuoy className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:block">{t('nav.helpCenter') || 'Help Center'}</span>
                </Link>
            </div>

            {/* ── Right: Utilities ── */}
            <div className="flex items-center gap-1 shrink-0">
                {/* Plan usage bars */}
                {usage && <PlanUsageBars usage={usage} />}

                {/* Dark mode toggle */}
                <div className="flex items-center justify-center w-8 h-8">
                    <ThemeToggle />
                </div>

                {/* Language switcher */}
                <div className="flex items-center justify-center w-8 h-8">
                    <LanguageSwitcher />
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-center w-8 h-8">
                    <NotificationBell />
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-border mx-1" />

                {/* Profile dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="cursor-pointer group" title={session?.user?.name ?? ''}>
                            <Avatar className="h-7 w-7 ring-2 ring-transparent group-hover:ring-primary/40 transition-all">
                                <AvatarFallback className="bg-primary/10 text-[10px] font-bold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
                        <div className="px-2 py-1.5">
                            <p className="text-sm font-medium truncate">{session?.user?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                            {session?.user?.role && (
                                <Badge className="mt-1 text-[10px]" variant="outline">{session.user.role}</Badge>
                            )}
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/profile" className="flex items-center cursor-pointer">
                                <UserCircle className="mr-2 h-4 w-4" />
                                {t('nav.profile')}
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/billing" className="flex items-center cursor-pointer">
                                <CreditCard className="mr-2 h-4 w-4" />
                                {t('nav.billing') || 'Billing'}
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/api-keys" className="flex items-center cursor-pointer">
                                <Key className="mr-2 h-4 w-4" />
                                {t('nav.apiKeys') || 'AI API Keys'}
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/developer" className="flex items-center cursor-pointer">
                                <Code2 className="mr-2 h-4 w-4" />
                                Developer API
                            </Link>
                        </DropdownMenuItem>

                        {/* Admin-only: Support management */}
                        {session?.user?.role === 'ADMIN' && (
                            <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3" /> Admin
                                    </p>
                                </div>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/support" className="flex items-center cursor-pointer">
                                        <Headphones className="mr-2 h-4 w-4 text-primary" />
                                        Support Hub
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/support/knowledge-base" className="flex items-center cursor-pointer">
                                        <BookOpen className="mr-2 h-4 w-4 text-primary" />
                                        Knowledge Base
                                    </Link>
                                </DropdownMenuItem>
                            </>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="text-destructive focus:text-destructive cursor-pointer"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            {t('common.signOut')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
