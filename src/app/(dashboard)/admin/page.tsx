import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import {
    Users,
    Plug,
    LayoutList,
    CreditCard,
    Tag,
    Activity,
    Paintbrush,
    FileText,
    BookOpen,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const adminItems = [
    {
        title: 'Users',
        description: 'Manage accounts & roles',
        href: '/admin/users',
        icon: Users,
        color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    },
    {
        title: 'API Hub',
        description: 'Configure integrations & keys',
        href: '/admin/integrations',
        icon: Plug,
        color: 'bg-primary/10 text-primary border-primary/20',
    },
    {
        title: 'Plans',
        description: 'Subscription tiers & features',
        href: '/admin/plans',
        icon: LayoutList,
        color: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    },
    {
        title: 'Billing',
        description: 'Revenue & subscriptions',
        href: '/admin/billing',
        icon: CreditCard,
        color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    },
    {
        title: 'Coupons',
        description: 'Discount codes & promotions',
        href: '/admin/billing/coupons',
        icon: Tag,
        color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    },
    {
        title: 'Activity',
        description: 'Audit logs & events',
        href: '/admin/activity',
        icon: Activity,
        color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    },
    {
        title: 'Branding',
        description: 'Logo, colors & app name',
        href: '/admin/branding',
        icon: Paintbrush,
        color: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    },
    {
        title: 'Legal',
        description: 'Terms, privacy & policies',
        href: '/admin/legal',
        icon: FileText,
        color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    },
    {
        title: 'Guide',
        description: 'Onboarding & documentation',
        href: '/admin/guide',
        icon: BookOpen,
        color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    },
]

export default async function AdminHubPage() {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') redirect('/dashboard')

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

                {/* Header */}
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Administration</p>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Hub</h1>
                    <p className="text-muted-foreground text-sm">Manage your platform settings and configurations.</p>
                </div>

                {/* iOS-style icon grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-3">
                    {adminItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl border bg-card/50 hover:bg-card hover:border-border hover:shadow-sm transition-all duration-150 text-center"
                        >
                            <div className={cn(
                                'w-12 h-12 rounded-2xl border flex items-center justify-center transition-transform duration-150 group-hover:scale-110',
                                item.color
                            )}>
                                <item.icon className="h-5 w-5" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-xs font-semibold leading-tight">{item.title}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2 hidden sm:block">{item.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>

            </div>
        </div>
    )
}
