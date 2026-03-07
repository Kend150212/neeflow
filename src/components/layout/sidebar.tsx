'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NextImage from 'next/image'
import type { Session } from 'next-auth'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
    Plug,
    Activity,
    CreditCard,
    LayoutList,
    Paintbrush,
    FileText,
    BookOpen,
    Tag,
    Clapperboard,
    MoreHorizontal,
} from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '@/lib/workspace-context'
import { useBranding } from '@/lib/use-branding'
import { useEffect } from 'react'

interface NavItem {
    titleKey: string
    href: string
    icon: React.ComponentType<{ className?: string }>
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
    { titleKey: 'nav.inbox', href: '/dashboard/inbox', icon: Mail },
    { titleKey: 'nav.reports', href: '/dashboard/reports', icon: BarChart3 },
    { titleKey: 'nav.integrations', href: '/dashboard/integrations', icon: Plug },
]

const adminNav: NavItem[] = [
    { titleKey: 'nav.users', href: '/admin/users', icon: Users },
    { titleKey: 'nav.apiHub', href: '/admin/integrations', icon: Plug },
    { titleKey: 'nav.plans', href: '/admin/plans', icon: LayoutList },
    { titleKey: 'nav.billing', href: '/admin/billing', icon: CreditCard, exact: true },
    { titleKey: 'nav.coupons', href: '/admin/billing/coupons', icon: Tag },
    { titleKey: 'nav.activity', href: '/admin/activity', icon: Activity },
    { titleKey: 'nav.branding', href: '/admin/branding', icon: Paintbrush },
    { titleKey: 'nav.legal', href: '/admin/legal', icon: FileText },
    { titleKey: 'nav.guide', href: '/admin/guide', icon: BookOpen },
]

const mobileTabItems: NavItem[] = [
    { titleKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { titleKey: 'nav.posts', href: '/dashboard/posts', icon: PenSquare, exact: true },
    { titleKey: 'nav.studio', href: '/dashboard/studio', icon: Clapperboard },
    { titleKey: 'nav.inbox', href: '/dashboard/inbox', icon: Mail },
]

// ── Navigation pill: icon stacked above label ─────────────────────────────────
function NavPill({
    item,
    isActive,
    hasBadge,
    t,
}: {
    item: NavItem
    isActive: boolean
    hasBadge?: boolean
    t: (key: string) => string
}) {
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
            <div className="relative shrink-0">
                <item.icon className={cn('h-[18px] w-[18px]', isActive && 'text-primary')} />
                {hasBadge && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                )}
            </div>
            <span
                className={cn(
                    'w-full text-center text-[8.5px] font-semibold uppercase tracking-wide truncate',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
            >
                {t(item.titleKey)}
            </span>
        </Link>
    )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export function Sidebar({ session }: { session: Session }) {
    const pathname = usePathname()
    const isAdmin = session?.user?.role === 'ADMIN'
    const t = useTranslation()
    const { activeChannel } = useWorkspace()
    const branding = useBranding()
    const [pendingCount, setPendingCount] = useState(0)
    const [moreOpen, setMoreOpen] = useState(false)

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

    const studioHref = activeChannel?.id
        ? `/dashboard/studio/${activeChannel.id}`
        : '/dashboard/studio'

    const allNavItems: NavItem[] = [
        ...topNav,
        { titleKey: 'nav.studio', href: studioHref, icon: Clapperboard, exact: false },
        ...bottomNav,
    ]

    const isActive = (item: NavItem) => {
        if (item.titleKey === 'nav.studio') return pathname?.startsWith('/dashboard/studio') ?? false
        return item.exact ? pathname === item.href : (pathname === item.href || pathname?.startsWith(item.href + '/'))
    }

    const allMoreItems: NavItem[] = [
        ...topNav.slice(2),
        { titleKey: 'nav.studio', href: studioHref, icon: Clapperboard },
        ...bottomNav.filter(i => i.href !== '/dashboard/client-board'),
    ]

    return (
        <>
            {/* ════════════════════════════════════════
                DESKTOP: slim 72px nav‑only sidebar
            ════════════════════════════════════════ */}
            <aside className="hidden md:flex h-screen w-[72px] flex-col border-r border-border bg-card shrink-0">

                {/* Logo */}
                <div className="flex items-center justify-center h-[48px] shrink-0">
                    <Link href="/dashboard">
                        <NextImage
                            src={branding.logoUrl}
                            alt={branding.appName}
                            width={32}
                            height={32}
                            className="rounded-xl object-contain"
                            unoptimized
                        />
                    </Link>
                </div>

                <Separator />

                {/* Nav list — scrolls if overflows */}
                <nav className="flex-1 min-h-0 overflow-y-auto py-1.5 px-2 flex flex-col gap-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {allNavItems.map(item => (
                        <NavPill
                            key={item.href}
                            item={item}
                            isActive={isActive(item)}
                            hasBadge={item.href === '/dashboard/client-board' && pendingCount > 0}
                            t={t}
                        />
                    ))}

                    {isAdmin && (
                        <>
                            <div className="my-1.5 px-1"><Separator /></div>
                            {adminNav.map(item => (
                                <NavPill
                                    key={item.href}
                                    item={item}
                                    isActive={isActive(item)}
                                    t={t}
                                />
                            ))}
                        </>
                    )}
                </nav>
            </aside>

            {/* ════════════════════════════════════════
                MOBILE: fixed bottom tab bar
            ════════════════════════════════════════ */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-card/90 backdrop-blur-xl border-t border-border flex items-stretch">
                {mobileTabItems.map(item => {
                    const active = isActive(item)
                    const isPending = item.href === '/dashboard/client-board' && pendingCount > 0
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative',
                                active ? 'text-primary' : 'text-muted-foreground'
                            )}
                        >
                            {active && <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-primary" />}
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

            {/* More sheet */}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl px-0">
                    <SheetHeader className="px-4 pb-3">
                        <SheetTitle className="text-sm">Menu</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-full pb-6">
                        <nav className="grid grid-cols-3 gap-2 px-4">
                            {allMoreItems.map(item => {
                                const active = isActive(item)
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMoreOpen(false)}
                                        className={cn(
                                            'flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all',
                                            active ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground hover:bg-muted'
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
