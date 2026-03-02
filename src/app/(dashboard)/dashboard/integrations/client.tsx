'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lock, ArrowRight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
    allowedIntegrations: string[]
}

interface IntegrationCard {
    slug: string
    name: string
    description: string
    badge?: string         // "Coming Soon" | "New" | undefined
    href?: string          // if active, where to navigate
    logo: React.ReactNode
    category: string
    tags: string[]
}

// ─── SVG Logos ───────────────────────────────────────────────────────────────

const LogoExternalDB = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <rect x="8" y="10" width="32" height="8" rx="4" fill="currentColor" className="text-primary" />
        <rect x="8" y="22" width="32" height="8" rx="4" fill="currentColor" className="text-primary/70" />
        <rect x="8" y="34" width="32" height="8" rx="4" fill="currentColor" className="text-primary/40" />
        <circle cx="36" cy="14" r="2" fill="white" />
        <circle cx="36" cy="26" r="2" fill="white" />
    </svg>
)

const LogoShopify = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <path d="M33.5 11.5C33.4 11.1 33 10.9 32.7 10.9C32.4 10.9 29.8 10.7 29.8 10.7C29.8 10.7 27.9 8.8 27.7 8.6C27.5 8.4 27.1 8.5 26.9 8.5L25.7 38.5L34.5 36.6L37.5 14.5C37.5 14.1 37.2 13.8 36.8 13.7L33.5 11.5Z" fill="#96BF48" />
        <path d="M26.9 8.5L25.7 38.5L13.5 36L16.5 12C16.7 11.5 17.1 11.2 17.6 11.2C18.1 11.2 22.3 10.8 22.3 10.8C22.3 10.8 22.5 10.8 22.6 11C22.7 11.1 23.2 12.4 23.2 12.4C23.2 12.4 26.1 9 26.9 8.5Z" fill="#5E8E3E" />
        <path d="M22 15.5C21.9 15.2 21.7 14.9 21.4 14.8C20.6 14.5 19.5 14.9 18.8 15.4C18.8 15.4 19.2 17.5 22 17.5C22 17.5 22.1 15.8 22 15.5Z" fill="white" />
    </svg>
)

const LogoWordPress = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="24" cy="24" r="18" fill="#21759B" />
        <path d="M8.5 24C8.5 17.1 13.3 11.4 19.7 9.6L9.7 35.8C8.9 32.2 8.5 28.2 8.5 24ZM30.2 23.2C30.2 21.1 29.5 19.6 28.9 18.4C28.1 17 27.4 15.8 27.4 14.4C27.4 12.8 28.6 11.3 30.3 11.3H30.5C27.3 8.4 23.1 6.5 18.5 6.5C12.2 6.5 6.7 9.7 3.5 14.6H5C6.9 14.6 9.9 14.4 9.9 14.4C10.9 14.3 11 15.8 10 15.9C10 15.9 9 16 7.9 16.1L14.7 36.5L18.9 23.9L15.9 16.1C14.9 16 14 15.9 14 15.9C13 15.8 13.1 14.3 14.1 14.4C14.1 14.4 17.2 14.6 19 14.6C21 14.6 24 14.4 24 14.4C25 14.3 25.1 15.8 24.1 15.9C24.1 15.9 23.1 16 22 16.1L28.7 36.3L30.6 29.8C31.5 27.2 30.2 24.7 30.2 23.2ZM24.4 25.6L19 41C20.6 41.5 22.3 41.8 24 41.8C26 41.8 27.9 41.4 29.7 40.7L24.4 25.6ZM38.3 16.9C38.4 17.6 38.4 18.3 38.4 19.1C38.4 21.3 38 23.8 36.8 26.9L31.8 41.2C37 38.2 40.5 32.5 40.5 24C40.5 21.4 40.1 18.9 38.3 16.9Z" fill="white" />
    </svg>
)

const LogoHubSpot = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <circle cx="32" cy="16" r="6" fill="#FF7A59" />
        <circle cx="32" cy="16" r="3" fill="white" />
        <path d="M26 16H20C17.8 16 16 17.8 16 20V28C16 30.2 17.8 32 20 32H28C30.2 32 32 30.2 32 28V22" stroke="#FF7A59" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M12 24H8" stroke="#FF7A59" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 12V8" stroke="#FF7A59" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 40V36" stroke="#FF7A59" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M36 24H40" stroke="#FF7A59" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
)

const LogoSalesforce = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <path d="M20 14C20 11.8 21.8 10 24 10C25.4 10 26.6 10.7 27.4 11.7C28.1 11.3 28.9 11 29.8 11C32.6 11 34.8 13.2 34.8 16C34.8 16.3 34.8 16.6 34.7 16.9C36.6 17.5 38 19.3 38 21.5C38 24.3 35.8 26.5 33 26.5H15C12.2 26.5 10 24.3 10 21.5C10 19 11.8 17 14.1 16.6C14 16.3 14 16 14 15.5C14 14.7 14.2 14 14.5 13.4C13.1 12.8 12 11.4 12 9.7C12 7.7 13.5 6 15.5 6C17 6 18.3 6.9 18.9 8.2C19.3 8.1 19.6 8 20 8V14Z" fill="#00A1E0" />
        <rect x="17" y="28" width="14" height="14" rx="2" fill="#00A1E0" opacity="0.3" />
        <path d="M20 31H28M20 35H25" stroke="#00A1E0" strokeWidth="2" strokeLinecap="round" />
    </svg>
)

const LogoGoogleSheets = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <rect x="10" y="6" width="28" height="36" rx="3" fill="#0F9D58" />
        <rect x="14" y="14" width="20" height="2" rx="1" fill="white" />
        <rect x="14" y="19" width="20" height="2" rx="1" fill="white" opacity="0.7" />
        <rect x="14" y="24" width="20" height="2" rx="1" fill="white" opacity="0.7" />
        <rect x="14" y="29" width="14" height="2" rx="1" fill="white" opacity="0.5" />
        <rect x="10" y="6" width="28" height="8" rx="3" fill="#0D8450" />
        <path d="M30 6L38 14H32C30.9 14 30 13.1 30 12V6Z" fill="#087443" />
    </svg>
)

const LogoAirtable = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <rect x="6" y="20" width="15" height="20" rx="2" fill="#FCB400" />
        <rect x="24" y="14" width="18" height="12" rx="2" fill="#18BFFF" />
        <rect x="24" y="30" width="18" height="10" rx="2" fill="#F82B60" opacity="0.8" />
        <rect x="6" y="10" width="15" height="8" rx="2" fill="#FCB400" opacity="0.7" />
    </svg>
)

const LogoZapier = () => (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <path d="M24 6L27.5 17H39L30 24L33.5 35L24 28L14.5 35L18 24L9 17H20.5L24 6Z" fill="#FF4A00" />
    </svg>
)

// ─── Integration Definitions ─────────────────────────────────────────────────

const integrations: IntegrationCard[] = [
    {
        slug: 'external_db',
        name: 'External Database',
        description: 'Connect MySQL, MariaDB, PostgreSQL or SQLite. Query live data and auto-generate posts.',
        href: '/dashboard/integrations/external-db',
        logo: <LogoExternalDB />,
        category: 'Database',
        tags: ['MySQL', 'MariaDB', 'PostgreSQL', 'SQLite'],
    },
    {
        slug: 'shopify',
        name: 'Shopify',
        description: 'Sync products, orders and inventory from your Shopify store.',
        badge: 'Coming Soon',
        logo: <LogoShopify />,
        category: 'E-commerce',
        tags: ['Products', 'Orders', 'Inventory'],
    },
    {
        slug: 'wordpress',
        name: 'WordPress',
        description: 'Connect WooCommerce products and WordPress posts to your content pipeline.',
        badge: 'Coming Soon',
        logo: <LogoWordPress />,
        category: 'E-commerce',
        tags: ['WooCommerce', 'Products', 'Posts'],
    },
    {
        slug: 'hubspot',
        name: 'HubSpot',
        description: 'Pull contacts, deals and company data to power AI-driven content.',
        badge: 'Coming Soon',
        logo: <LogoHubSpot />,
        category: 'CRM',
        tags: ['Contacts', 'Deals', 'Pipeline'],
    },
    {
        slug: 'salesforce',
        name: 'Salesforce',
        description: 'Connect your Salesforce CRM and turn customer data into social content.',
        badge: 'Coming Soon',
        logo: <LogoSalesforce />,
        category: 'CRM',
        tags: ['Contacts', 'Leads', 'Opportunities'],
    },
    {
        slug: 'google_sheets',
        name: 'Google Sheets',
        description: 'Use any Google Sheet as a data source. Perfect for product catalogs and price lists.',
        badge: 'Coming Soon',
        logo: <LogoGoogleSheets />,
        category: 'Spreadsheet',
        tags: ['Spreadsheet', 'Products', 'CSV'],
    },
    {
        slug: 'airtable',
        name: 'Airtable',
        description: 'Connect Airtable bases to power chatbot answers and auto-post creation.',
        badge: 'Coming Soon',
        logo: <LogoAirtable />,
        category: 'Database',
        tags: ['Base', 'Tables', 'Views'],
    },
    {
        slug: 'zapier',
        name: 'Zapier',
        description: 'Trigger posts and chatbot actions from any Zapier-connected app.',
        badge: 'Coming Soon',
        logo: <LogoZapier />,
        category: 'Automation',
        tags: ['Webhook', 'Triggers', 'Automation'],
    },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function IntegrationsClient({ allowedIntegrations }: Props) {
    const isAllowed = (slug: string) => allowedIntegrations.includes(slug)

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

                {/* Header */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                        <Zap className="h-3.5 w-3.5" />
                        Integrations
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Connect your data</h1>
                    <p className="text-muted-foreground text-base">
                        Plug in any data. <span className="text-primary font-medium">Let AI do the rest.</span>
                    </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {integrations.map((intg) => {
                        const allowed = isAllowed(intg.slug)
                        const isComingSoon = !!intg.badge
                        const isLocked = !allowed && !isComingSoon
                        const isActive = allowed && !isComingSoon

                        return (
                            <div
                                key={intg.slug}
                                className={cn(
                                    'group relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-200',
                                    isActive
                                        ? 'border-primary/30 bg-primary/5 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(25,230,94,0.08)] cursor-pointer'
                                        : 'border-border/60 bg-card/50 opacity-75'
                                )}
                            >
                                {/* Status badge */}
                                {isComingSoon && (
                                    <div className="absolute top-3 right-3">
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                            Coming Soon
                                        </Badge>
                                    </div>
                                )}
                                {isLocked && (
                                    <div className="absolute top-3 right-3">
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-amber-500/50 text-amber-500">
                                            <Lock className="h-2.5 w-2.5 mr-1" />
                                            Upgrade
                                        </Badge>
                                    </div>
                                )}
                                {isActive && (
                                    <div className="absolute top-3 right-3">
                                        <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary border-primary/30">
                                            Active
                                        </Badge>
                                    </div>
                                )}

                                {/* Logo */}
                                <div className={cn(
                                    'w-14 h-14 rounded-xl flex items-center justify-center',
                                    isActive ? 'bg-primary/10' : 'bg-muted/50'
                                )}>
                                    {intg.logo}
                                </div>

                                {/* Info */}
                                <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-sm">{intg.name}</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {intg.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {intg.tags.map(tag => (
                                            <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* CTA */}
                                <div>
                                    {isActive && intg.href ? (
                                        <Button asChild size="sm" className="w-full h-8 text-xs gap-1.5">
                                            <Link href={intg.href}>
                                                Configure
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Link>
                                        </Button>
                                    ) : isLocked ? (
                                        <Button asChild size="sm" variant="outline" className="w-full h-8 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                                            <Link href="/dashboard/billing">
                                                <Lock className="h-3 w-3 mr-1.5" />
                                                Upgrade Plan
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="outline" className="w-full h-8 text-xs" disabled>
                                            Coming Soon
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer info */}
                <p className="text-xs text-muted-foreground text-center pb-4">
                    More integrations launching soon. Contact support to request a specific integration.
                </p>
            </div>
        </div>
    )
}
