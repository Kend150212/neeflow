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
    <svg viewBox="0 0 48 48" className="w-10 h-10">
        <path d="M37.14 11.27c-.03-.22-.22-.35-.39-.37-.17-.02-3.63-.27-3.63-.27s-2.41-2.38-2.65-2.63c-.24-.24-.71-.17-.9-.11l-1.23.38C27.77 7.3 26.8 7 25.7 7c-2.23 0-3.3 1.4-3.68 2.34-1.07.33-2.28.7-2.28.7l-.01.03c-.66.2-1.36.63-1.85 1.73-.32.72-3.93 10.15-3.93 10.15L25 24.79l12.01-2.59S37.17 11.49 37.14 11.27zM28.62 9.5l-1.96.61c.01-.19.01-.38 0-.56.04-1.47-.83-2.14-1.52-2.35.41-.47.98-.72 1.63-.72.98 0 1.71.6 2.24 2.09l-.39.93zM24.9 7.89c.17.13.37.36.31 1.02l-2.41.75c.46-1.77 1.34-2.08 2.1-1.77zm8.29 10.76l-4.47 1.38.09-1.87c.01-.09-.01-.18-.06-.26L26.7 15.9s-.42-.26-.77-.12c-.35.14-.56.51-.56.51L24.6 18.8l-4.14 1.28L22.62 9.6l.91-.28a.45.45 0 00.31-.52l2.68-.83.38-.87c.57 1.86 1.24 2.07 1.24 2.07l3.03-.94c.51 0 1.61.96 2.02 8.12z" fill="#95BF47" />
        <path d="M36.75 10.9l-3.63-.27s-2.41-2.38-2.65-2.63c-.09-.09-.21-.14-.33-.14L25 24.79l12.01-2.59s-1.89-10.78-1.92-11c-.03-.22-.17-.27-.34-.3z" fill="#5E8E3E" />
        <path d="M26.17 17.1l-.68 2.02s-.75-.4-1.67-.4c-1.35 0-1.42.85-1.42 1.06 0 1.16 3.03 1.6 3.03 4.32 0 2.14-1.36 3.51-3.18 3.51-2.19 0-3.31-1.37-3.31-1.37l.59-1.94s1.15 1 2.12 1c.63 0 .89-.5.89-.86 0-1.51-2.49-1.58-2.49-4.08 0-2.1 1.51-4.13 4.56-4.13 1.17 0 1.56.37 1.56.37z" fill="white" />
        {/* Bag */}
        <path d="M10 22l1.5 17h25l1.5-17H10z" fill="#95BF47" opacity="0.15" />
    </svg>
)

const LogoWordPress = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10">
        <circle cx="24" cy="24" r="20" fill="#21759B" />
        <path d="M4.5 24C4.5 13.23 13.23 4.5 24 4.5S43.5 13.23 43.5 24 34.77 43.5 24 43.5 4.5 34.77 4.5 24zm2 0C6.5 33.65 14.35 41.5 24 41.5S41.5 33.65 41.5 24 33.65 6.5 24 6.5 6.5 14.35 6.5 24z" fill="white" opacity="0.3" />
        <path d="M7.07 24c0 7.1 4.13 13.25 10.12 16.14L8.41 18.22A16.87 16.87 0 007.07 24zM36.65 22.9c0-2.22-.8-3.76-1.48-4.95-.91-1.48-1.77-2.73-1.77-4.22 0-1.65 1.25-3.19 3.02-3.19h.23A16.92 16.92 0 0024 7.07c-5.85 0-11 3-14.03 7.55h1.05c1.72 0 4.38-.21 4.38-.21.89-.05 1 1.25.11 1.36 0 0-.89.1-1.88.16L19 38.5l4.07-12.2-2.9-7.94c-.88-.05-1.71-.16-1.71-.16-.89-.05-.79-1.4.1-1.36 0 0 2.72.21 4.33.21 1.72 0 4.38-.21 4.38-.21.89-.05 1 1.25.11 1.36 0 0-.89.1-1.88.16L31.8 38.4l1.86-6.22c.8-2.57.92-4.2.92-5.29zM24.35 25.69l-3.82 11.1c1.14.34 2.35.52 3.59.52a16.96 16.96 0 004.03-.49l-.04-.08-3.76-11.05zm9.95-13.19a13.34 13.34 0 01.11 1.73c0 1.71-.32 3.63-1.28 6.03L29.6 38.05C35.41 34.96 39.36 28.9 39.36 24c0-4.13-1.49-7.92-3.95-10.85l-1.11-.65z" fill="white" />
    </svg>
)

const LogoHubSpot = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10">
        <path d="M28.5 17.9V13.3a3.3 3.3 0 001.9-3 3.3 3.3 0 00-3.3-3.3 3.3 3.3 0 00-3.3 3.3 3.3 3.3 0 001.9 3v4.6a9.4 9.4 0 00-4.5 2L10 12.8a3.6 3.6 0 00-3.5-.7 3.6 3.6 0 00.9 7 3.6 3.6 0 002.9-1.5l10.8 6.9a9.4 9.4 0 000 4.8L11.3 36a3.6 3.6 0 10.9 2.5 3.6 3.6 0 00-.4-1.7l10.5-6.6a9.4 9.4 0 0012.7-3.5A9.4 9.4 0 0028.5 17.9zm-1.4 14.4a5 5 0 110-10 5 5 0 010 10z" fill="#FF7A59" />
    </svg>
)

const LogoSalesforce = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10">
        <path d="M20.1 12.2a7.3 7.3 0 0113.1-1.1 5.6 5.6 0 017.8 5.2 5.6 5.6 0 01-1.2 3.4 4.7 4.7 0 01.3 1.7 4.8 4.8 0 01-4.8 4.8H13.6a6.1 6.1 0 01-.6-12.2 7.3 7.3 0 017.1-1.8z" fill="#00A1E0" />
        <rect x="15" y="29" width="18" height="11" rx="2" fill="#00A1E0" opacity="0.2" />
        <path d="M19 32h10M19 36h7" stroke="#00A1E0" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 29v-3" stroke="#00A1E0" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 29v-3" stroke="#00A1E0" strokeWidth="2" strokeLinecap="round" />
    </svg>
)

const LogoGoogleSheets = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10">
        <path d="M30 4H12a2 2 0 00-2 2v36a2 2 0 002 2h24a2 2 0 002-2V14L30 4z" fill="#23A566" />
        <path d="M30 4l8 10h-6a2 2 0 01-2-2V4z" fill="#17764A" />
        {/* Grid lines */}
        <rect x="14" y="20" width="20" height="2" fill="white" rx="0.5" />
        <rect x="14" y="25" width="20" height="2" fill="white" rx="0.5" opacity="0.8" />
        <rect x="14" y="30" width="20" height="2" fill="white" rx="0.5" opacity="0.8" />
        <rect x="14" y="35" width="14" height="2" fill="white" rx="0.5" opacity="0.6" />
        {/* Vertical divider */}
        <rect x="22" y="20" width="1" height="17" fill="white" opacity="0.4" />
    </svg>
)

const LogoAirtable = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10">
        <path d="M24 6l18 6.5-18 6.5L6 12.5 24 6z" fill="#F82B60" />
        <path d="M26 20.5v17.4l16-5.75V15.5L26 20.5z" fill="#18BFFF" />
        <path d="M22 20.5L6 15.5v17.4l16 5.75V20.5z" fill="#FCB400" />
    </svg>
)

const LogoZapier = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10">
        <path d="M24 4a20 20 0 100 40A20 20 0 0024 4z" fill="#FF4A00" />
        <path d="M29.3 21H26l4-9h-9.3l-2 8.5H22l-4.3 13L29.3 21z" fill="white" />
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
