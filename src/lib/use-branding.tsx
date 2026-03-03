'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface BrandingSettings {
    appName: string
    tagline: string
    logoUrl: string
    faviconUrl: string
    primaryColor: string
    supportEmail: string
    copyrightText: string
    footerLinks: { label: string; href: string }[]
}

export const DEFAULT_BRANDING: BrandingSettings = {
    appName: 'NeeFlow',
    tagline: 'Social Media Management',
    logoUrl: '/logo.png',
    faviconUrl: '/favicon.ico',
    primaryColor: '#7c3aed',
    supportEmail: '',
    copyrightText: '',
    footerLinks: [],
}

const BrandingContext = createContext<BrandingSettings>(DEFAULT_BRANDING)

/**
 * BrandingProvider — accepts server-fetched initialBranding to prevent the
 * FOUC (Flash of Original Content) caused by starting with DEFAULT_BRANDING
 * and then fetching the real branding from the API on mount.
 */
export function BrandingProvider({
    children,
    initialBranding,
}: {
    children: ReactNode
    initialBranding?: BrandingSettings
}) {
    const [branding, setBranding] = useState<BrandingSettings>(
        initialBranding ?? DEFAULT_BRANDING
    )

    useEffect(() => {
        // Only re-fetch if we didn't get server-side branding (fallback safety)
        if (!initialBranding) {
            fetch('/api/admin/branding')
                .then(r => r.ok ? r.json() : DEFAULT_BRANDING)
                .then(d => setBranding({ ...DEFAULT_BRANDING, ...d }))
                .catch(() => { })
        }
    }, [initialBranding])

    return (
        <BrandingContext.Provider value={branding}>
            {children}
        </BrandingContext.Provider>
    )
}

export function useBranding(): BrandingSettings {
    return useContext(BrandingContext)
}
