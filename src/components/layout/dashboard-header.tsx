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
    LogOut,
    PenSquare,
    Plus,
    Sparkles,
    UserCircle,
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
function WorkspaceDropdown() {
    const { channels, activeChannel, setActiveChannel, loadingChannels } = useWorkspace()
    const router = useRouter()
    const t = useTranslation()

    const displayName = loadingChannels ? '…' : (activeChannel?.displayName || t('workspace.selectChannel'))
    const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

    const handleSwitch = (ch: typeof channels[0]) => {
        setActiveChannel(ch)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                    <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">{initials}</span>
                    </div>
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
                        <div className="h-5 w-5 rounded bg-primary/15 flex items-center justify-center mr-2 shrink-0">
                            <span className="text-[8px] font-bold text-primary">{ch.displayName.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <span className="flex-1 truncate">{ch.displayName}</span>
                        {activeChannel?.id === ch.id && <Check className="h-3.5 w-3.5 text-primary" />}
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
    const [usage, setUsage] = useState<PlanUsage | null>(null)

    useEffect(() => {
        fetch('/api/user/plan-usage')
            .then(r => r.ok ? r.json() : null)
            .then(d => d && setUsage(d))
            .catch(() => { })
    }, [])

    const initials = session?.user?.name
        ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

    return (
        <header className="flex-shrink-0 h-12 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-3 gap-2 z-30">

            {/* ── Left: Workspace switcher ── */}
            <div className="flex items-center gap-1 min-w-0">
                <WorkspaceDropdown />
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
                            <Link href="/dashboard/developer" className="flex items-center cursor-pointer">
                                <Code2 className="mr-2 h-4 w-4" />
                                Developer API
                            </Link>
                        </DropdownMenuItem>
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
