'use client'

import React from 'react'

interface LogoProps {
    className?: string
}

export function GeminiLogo({ className = 'h-4 w-4' }: LogoProps) {
    return (
        <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M14 28C14 21.74 14 18.6 12.44 16.22C11.44 14.68 10.06 13.44 8.4 12.56C6.16 11.2 3.22 11.04 0 11.04V14C0 20.26 0 23.4 1.56 25.78C2.56 27.32 3.94 28.56 5.6 29.44C7.84 26.8 10.78 28.96 14 28.96V28Z"
                fill="url(#gemini_grad_a)"
            />
            <path
                d="M14 0C14 6.26 14 9.4 15.56 11.78C16.56 13.32 17.94 14.56 19.6 15.44C21.84 16.8 24.78 16.96 28 16.96V14C28 7.74 28 4.6 26.44 2.22C25.44 0.68 24.06 -0.56 22.4 -1.44C20.16 1.2 17.22 -0.96 14 -0.96V0Z"
                fill="url(#gemini_grad_b)"
            />
            <defs>
                <linearGradient id="gemini_grad_a" x1="0" y1="14" x2="14" y2="14" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1C7DED" />
                    <stop offset="1" stopColor="#1BA0E1" />
                </linearGradient>
                <linearGradient id="gemini_grad_b" x1="28" y1="14" x2="14" y2="14" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1C7DED" />
                    <stop offset="1" stopColor="#1BA0E1" />
                </linearGradient>
            </defs>
        </svg>
    )
}

export function OpenAILogo({ className = 'h-4 w-4' }: LogoProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
    )
}

export function RunwareLogo({ className = 'h-4 w-4' }: LogoProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="4" fill="url(#runware_grad)" />
            <path
                d="M7 8h3l2 3h5l-3-3h3l4 4-4 4h-3l3-3h-5l-2 3H7l-3-4 3-4z"
                fill="white"
                fillOpacity="0.95"
            />
            <defs>
                <linearGradient id="runware_grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#06B6D4" />
                    <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
            </defs>
        </svg>
    )
}

/** Map provider slug to logo component */
export function ProviderLogo({ provider, className = 'h-4 w-4' }: { provider: string; className?: string }) {
    switch (provider) {
        case 'gemini': return <GeminiLogo className={className} />
        case 'openai': return <OpenAILogo className={className} />
        case 'runware': return <RunwareLogo className={className} />
        default: return <div className={`${className} rounded-full bg-muted flex items-center justify-center text-[8px] font-bold`}>{provider.charAt(0).toUpperCase()}</div>
    }
}
