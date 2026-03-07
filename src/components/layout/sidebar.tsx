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
import { useState, useEffect } from 'react'
import { useWorkspace } from '@/lib/workspace-context'
import { useBranding } from '@/lib/use-branding'

interface IntegrationShortcut {
    slug: string
    name: string
    href: string
}

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
                    'w-full text-center text-[7px] font-semibold uppercase tracking-normal truncate',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
            >
                {t(item.titleKey)}
            </span>
        </Link>
    )
}

// ── Integration shortcut logos ────────────────────────────────────────────────
const IntegrationLogo = ({ slug }: { slug: string }) => {
    if (slug === 'shopify') return (
        <svg viewBox="0 0 256 292" className="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg">
            <path d="M223.773 57.472c-.185-1.354-1.354-2.092-2.277-2.153a441.847 441.847 0 00-19.886-1.477s-13.166-13.104-14.58-14.519c-1.415-1.414-4.183-1.107-5.598-.677-.185.062-2.83.862-7.136 2.215C171.088 29.618 164.197 18 153.808 18c-.369 0-.738.062-1.108.062C150.793 15.602 148.27 14 145.377 14c-24.24 0-35.83 30.295-39.46 45.677-9.19 2.83-15.686 4.86-16.485 5.106-5.045 1.6-5.229 1.785-5.905 6.522C83.097 74.73 64 225.18 64 225.18l152.979 26.44L256 236.694c0 0-31.887-177.77-32.227-179.222zM181.8 42.246l-11.32 3.507c0-1.23 0-2.523.062-3.877.062-5.167-.738-10.15-2.4-14.211C174.04 28.325 178.969 35.093 181.8 42.246zm-20.84 6.46l-23.748 7.382c2.277-8.858 6.583-17.654 12.98-23.438 2.277-2.092 5.414-4.43 9.19-5.598 2.031 4.92 2.646 11.565 1.578 21.654zm-18.502-36.015c3.015 0 5.537 1.353 7.629 3.938-5.845 1.845-12.12 6.152-16.67 12.98-4.06 6.03-7.197 15.134-8.12 23.254-5.537 1.723-11.012 3.446-16.055 5.045C112.986 40.584 125.66 12.691 142.458 12.691z" fill="#95BF47" />
            <path d="M221.496 55.319a441.847 441.847 0 00-19.886-1.477s-13.166-13.104-14.58-14.519c-.554-.553-1.292-.8-2.092-.862l-8.919 180.838 42.709-9.435 16.116-154.484c-.185-.369-12.981-1.477-13.348-.061z" fill="#5E8E3E" />
            <path d="M153.808 96.74l-5.291 21.9s-5.291-3.077-11.627-3.077c-9.374 0-9.804 5.845-9.804 7.382 0 8.12 20.808 11.196 20.808 30.11 0 14.888-9.435 24.485-22.17 24.485-15.256 0-22.97-9.50-22.97-9.50l4.122-13.474s7.75 6.706 14.334 6.706c4.245 0 5.967-3.323 5.967-5.722 0-10.026-17.1-10.457-17.1-27.85 0-14.334 10.272-28.175 30.971-28.175 8.243 0 13.78 2.215 13.78 2.215z" fill="white" />
        </svg>
    )
    if (slug === 'external_db') return (
        <svg viewBox="0 0 48 48" fill="none" className="h-[18px] w-[18px]">
            <rect x="8" y="10" width="32" height="8" rx="4" fill="currentColor" className="text-primary" />
            <rect x="8" y="22" width="32" height="8" rx="4" fill="currentColor" className="text-primary/70" />
            <rect x="8" y="34" width="32" height="8" rx="4" fill="currentColor" className="text-primary/40" />
            <circle cx="36" cy="14" r="2" fill="white" />
            <circle cx="36" cy="26" r="2" fill="white" />
        </svg>
    )
    return null
}

// ── Integration shortcut pill ─────────────────────────────────────────────────
function IntegrationPill({
    shortcut,
    isActive,
}: {
    shortcut: IntegrationShortcut
    isActive: boolean
}) {
    return (
        <Link
            href={shortcut.href}
            title={shortcut.name}
            className={cn(
                'relative flex flex-col items-center gap-[3px] py-2 px-1 rounded-xl transition-all duration-150 group w-full overflow-hidden',
                isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            <IntegrationLogo slug={shortcut.slug} />
            <span className={cn(
                'w-full text-center text-[7px] font-semibold uppercase tracking-normal truncate',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
            )}>
                {shortcut.name}
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
    const [integrationShortcuts, setIntegrationShortcuts] = useState<IntegrationShortcut[]>([])

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

    useEffect(() => {
        const fetchShortcuts = () => {
            fetch('/api/integrations/sidebar-status')
                .then(r => r.ok ? r.json() : { items: [] })
                .then(d => setIntegrationShortcuts(d.items ?? []))
                .catch(() => { })
        }
        fetchShortcuts()
        const id = setInterval(fetchShortcuts, 60_000)
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

                    {integrationShortcuts.length > 0 && (
                        <>
                            <div className="my-1.5 px-1"><Separator /></div>
                            {integrationShortcuts.map(shortcut => (
                                <IntegrationPill
                                    key={shortcut.slug}
                                    shortcut={shortcut}
                                    isActive={pathname?.startsWith(shortcut.href) ?? false}
                                />
                            ))}
                        </>
                    )}

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
