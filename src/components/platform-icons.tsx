import React from 'react'
import {
    siFacebook,
    siInstagram,
    siYoutube,
    siTiktok,
    siX,
    siThreads,
    siPinterest,
    siBluesky,
    siTwitter,
    siGooglemybusiness,
} from 'simple-icons'

// ─── Platform Icons using official Simple Icons brand SVGs ────────────────
// simple-icons provides 100% official SVG paths + brand hex colors.
// Each icon is rendered as a white mark on a rounded colored background.
// viewBox 24x24, scaled to 60% so it fits inside rounded badge.

function PlatformBadge({ path, hex }: { path: string; hex: string }) {
    return (
        <svg viewBox="0 0 24 24" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="5" fill={`#${hex}`} />
            <g transform="translate(4.8 4.8) scale(0.6)">
                <path d={path} fill="white" />
            </g>
        </svg>
    )
}

// LinkedIn — not in this version of simple-icons, use official path (viewBox 24x24, from brand kit)
const linkedinPath = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

export const platformIcons: Record<string, React.ReactNode> = {
    facebook: <PlatformBadge path={siFacebook.path} hex={siFacebook.hex} />,
    instagram: <PlatformBadge path={siInstagram.path} hex={siInstagram.hex} />,
    youtube: <PlatformBadge path={siYoutube.path} hex={siYoutube.hex} />,
    tiktok: <PlatformBadge path={siTiktok.path} hex={siTiktok.hex} />,
    x: <PlatformBadge path={siX.path} hex={siX.hex} />,
    twitter: <PlatformBadge path={siTwitter.path} hex={siTwitter.hex} />,
    threads: <PlatformBadge path={siThreads.path} hex={siThreads.hex} />,
    pinterest: <PlatformBadge path={siPinterest.path} hex={siPinterest.hex} />,
    bluesky: <PlatformBadge path={siBluesky.path} hex={siBluesky.hex} />,
    gbp: <PlatformBadge path={siGooglemybusiness.path} hex={siGooglemybusiness.hex} />,
    // LinkedIn path sourced from official LinkedIn Brand Guidelines (SVG 24x24)
    linkedin: <PlatformBadge path={linkedinPath} hex="0A66C2" />,
}

// Platform icon component with configurable size
export function PlatformIcon({ platform, size = 'sm' }: { platform: string; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        xs: 'w-3 h-3',
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    }

    const icon = platformIcons[platform]
    if (!icon) return null

    return (
        <span className={`inline-flex items-center justify-center shrink-0 ${sizeClasses[size]}`}>
            {icon}
        </span>
    )
}
