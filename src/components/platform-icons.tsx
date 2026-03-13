import React from 'react'

// ─── Platform SVG Icons — Official Brand Style ─────────────────────────────
// Each icon uses the brand's official colors with white mark on colored background.
// Source: Official brand guidelines / Simple Icons

export const platformIcons: Record<string, React.ReactNode> = {
    facebook: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#1877F2" />
            <path d="M16.5 8H14.5C14.2 8 14 8.2 14 8.5V10H16.5L16.1 12.5H14V19H11.5V12.5H9.5V10H11.5V8.5C11.5 6.8 12.8 5.5 14.5 5.5H16.5V8Z" fill="white" />
        </svg>
    ),
    instagram: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFDC80" />
                    <stop offset="25%" stopColor="#FCAF45" />
                    <stop offset="50%" stopColor="#F77737" />
                    <stop offset="75%" stopColor="#E1306C" />
                    <stop offset="100%" stopColor="#833AB4" />
                </linearGradient>
            </defs>
            <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
            <rect x="6" y="6" width="12" height="12" rx="3.5" stroke="white" strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none" />
            <circle cx="16" cy="8" r="0.8" fill="white" />
        </svg>
    ),
    youtube: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#FF0000" />
            <path d="M19 8.5C19 8.5 18.8 7.3 18.2 6.7C17.5 6 16.7 6 16.4 5.9C14.5 5.8 12 5.8 12 5.8C12 5.8 9.5 5.8 7.6 5.9C7.3 6 6.5 6 5.8 6.7C5.2 7.3 5 8.5 5 8.5C5 8.5 4.8 9.9 4.8 11.2V12.5C4.8 13.8 5 15.2 5 15.2C5 15.2 5.2 16.4 5.8 17C6.5 17.7 7.4 17.7 7.8 17.8C9.2 17.9 12 18 12 18C12 18 14.5 18 16.4 17.8C16.7 17.7 17.5 17.7 18.2 17C18.8 16.4 19 15.2 19 15.2C19 15.2 19.2 13.8 19.2 12.5V11.2C19.2 9.9 19 8.5 19 8.5Z" fill="#FF0000" />
            <path d="M10.3 14.4V9.6L15.3 12L10.3 14.4Z" fill="white" />
        </svg>
    ),
    tiktok: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#010101" />
            <path d="M17.5 9.5a5.5 5.5 0 0 1-3.5-1.2V15a4 4 0 1 1-4-4v2a2 2 0 1 0 2 2V5.5h2a3.5 3.5 0 0 0 3.5 3.5v0.5z" fill="white" />
        </svg>
    ),
    x: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#000000" />
            <path d="M13.96 10.68L18.52 5.5H17.42L13.47 9.99L10.3 5.5H6.5L11.27 12.33L6.5 17.74H7.6L11.78 13.01L15.14 17.74H18.94L13.96 10.68ZM12.33 12.38L11.85 11.71L8 6.28H9.77L12.77 10.62L13.25 11.29L17.41 17.01H15.64L12.33 12.38Z" fill="white" />
        </svg>
    ),
    twitter: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#000000" />
            <path d="M13.96 10.68L18.52 5.5H17.42L13.47 9.99L10.3 5.5H6.5L11.27 12.33L6.5 17.74H7.6L11.78 13.01L15.14 17.74H18.94L13.96 10.68ZM12.33 12.38L11.85 11.71L8 6.28H9.77L12.77 10.62L13.25 11.29L17.41 17.01H15.64L12.33 12.38Z" fill="white" />
        </svg>
    ),
    linkedin: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#0A66C2" />
            <path d="M7.5 9H9.5V17H7.5V9ZM8.5 8C7.9 8 7.5 7.6 7.5 7C7.5 6.4 7.9 6 8.5 6C9.1 6 9.5 6.4 9.5 7C9.5 7.6 9.1 8 8.5 8ZM11 9H12.9V10C13.3 9.4 14 9 15 9C16.9 9 17.5 10.2 17.5 12V17H15.5V12.5C15.5 11.7 15.3 11 14.5 11C13.7 11 13 11.6 13 12.5V17H11V9Z" fill="white" />
        </svg>
    ),
    pinterest: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#E60023" />
            <path d="M12 4C7.58 4 4 7.58 4 12c0 3.35 2.07 6.23 5.04 7.38-.07-.63-.13-1.6.03-2.28.14-.62.94-3.98.94-3.98s-.24-.48-.24-1.19c0-1.11.64-1.94 1.45-1.94.68 0 1.01.51 1.01 1.13 0 .69-.44 1.71-.66 2.66-.19.79.39 1.44 1.16 1.44 1.39 0 2.46-1.47 2.46-3.58 0-1.87-1.35-3.18-3.27-3.18-2.22 0-3.53 1.67-3.53 3.39 0 .67.26 1.39.58 1.79a.24.24 0 01.06.23c-.06.24-.19.79-.22.9-.03.14-.12.17-.27.1-.99-.46-1.61-1.9-1.61-3.06 0-2.49 1.81-4.77 5.22-4.77 2.74 0 4.87 1.95 4.87 4.55 0 2.72-1.71 4.9-4.09 4.9-.8 0-1.55-.41-1.81-.9l-.49 1.84c-.18.68-.66 1.53-.98 2.05.74.23 1.52.35 2.33.35 4.42 0 8-3.58 8-8s-3.58-8-8-8z" fill="white" />
        </svg>
    ),
    threads: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#000000" />
            <path d="M16.2 11.3c-.1-.05-.2-.1-.31-.14-.18-3.37-2.03-5.3-5.12-5.32h-.04c-1.85 0-3.39.79-4.34 2.23l1.7 1.17c.71-1.07 1.82-1.3 2.64-1.3h.03c1.02.01 1.79.3 2.29.88.36.42.6 1 .72 1.73-.9-.15-1.88-.2-2.93-.14-2.94.17-4.83 1.89-4.71 4.27.06 1.21.67 2.25 1.7 2.93.87.57 1.99.86 3.16.79 1.54-.08 2.75-.67 3.59-1.74.64-.82 1.04-1.87 1.22-3.2.73.44 1.28 1.03 1.58 1.72.51 1.19.54 3.15-1.06 4.74-1.4 1.4-3.08 2-5.62 2.02-2.82-.02-4.95-.93-6.34-2.69-1.31-1.66-1.99-4.06-2.01-7.14.02-3.05.7-5.43 1.99-7.08C9.74 4.55 11.87 3.64 14.69 3.62c2.84.02 5.01.93 6.45 2.7.71.87 1.24 1.96 1.59 3.23l1.99-.53c-.43-1.57-1.09-2.92-2-3.99C20.8 3.15 18.08 1.97 14.7 1.95h-.01C11.32 1.97 8.6 3.16 6.7 5.5 5.02 7.59 4.16 10.47 4.13 14c.03 3.54.89 6.36 2.57 8.42 1.9 2.34 4.62 3.53 8 3.55h.01c3.08-.02 5.25-.83 7.05-2.62 2.3-2.3 2.23-5.16 1.47-6.92-.52-1.22-1.52-2.27-3.03-3.06zm-5.23 4.96c-1.29.07-2.63-.51-2.7-1.75-.05-.94.67-2 2.86-2.12.25-.01.5-.02.74-.02.76 0 1.47.07 2.11.22-.24 2.99-1.75 3.59-3.01 3.67z" fill="white" />
        </svg>
    ),
    bluesky: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#0085FF" />
            <path d="M12 8.5C10.7 6.8 7.9 4 6 4 4.1 4 3 5.3 3 6.8c0 .7.3 4.2.5 5.2.6 2.3 2.9 2.9 5 2.5-3.6.6-4.5 2.6-2.5 4.6C7.8 20.7 9 20 10 18.5c1-1.5 1.5-2.9 2-4 .5 1.1 1 2.5 2 4 1 1.5 2.2 2.2 4 .6 2-2 1.1-4-2.5-4.6 2.1.4 4.4-.2 5-2.5.2-1 .5-4.5.5-5.2C21 5.3 19.9 4 18 4c-1.9 0-4.7 2.8-6 4.5z" fill="white" />
        </svg>
    ),
    gbp: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#4285F4" />
            <path d="M12 5L5 8.5V15.5L12 19L19 15.5V8.5L12 5Z" fill="white" opacity="0.2" />
            <circle cx="15" cy="14" r="4" fill="white" />
            <path d="M17 14h-2.5v1H16c-.2.9-1 1.5-2 1.5-1.1 0-2-.9-2-2s.9-2 2-2c.6 0 1.1.2 1.4.6l.7-.7C15.6 12 14.9 11.5 14 11.5c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5c1.4 0 2.5-1.1 2.5-2.5 0-.2 0-.3-.5--.5z" fill="#4285F4" />
        </svg>
    ),
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
