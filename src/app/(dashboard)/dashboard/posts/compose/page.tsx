'use client'

import { useBranding } from '@/lib/use-branding'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import {
    ArrowLeft,
    Send,
    Save,
    Calendar,
    Clock,
    Loader2,
    Sparkles,
    Upload,
    X,
    ImageIcon,
    Check,
    Hash,
    Heart,
    MessageCircle,
    Share2,
    ThumbsUp,
    Bookmark,
    MoreHorizontal,
    Play,
    Repeat2,
    Globe,
    FolderOpen,
    RectangleHorizontal,
    RectangleVertical,
    Square,
    ChevronLeft,
    HardDrive,
    Folder,
    ChevronRight,
    Bold,
    Italic,
    Type,
    Smile,
    AtSign,
    Link2,
    ChevronDown,
    MessageSquare,
    Layers,
    Film,
    LayoutGrid,
    CircleDot,
    Camera,
    Users,
    Video,
    Scissors,
    Tag,
    Lock,
    Eye,
    EyeOff,
    ShieldCheck,
    Bell,
    Code2,
    Baby,
    Palette,
    Search,
    CheckCircle2,
    Pencil,
    FolderPlus,
    Trash2,
    Newspaper,
    RefreshCw,
    Lightbulb,
    ExternalLink,
    Building2,
    ZoomIn,
    Music,
    Plus,
    TrendingUp,
} from 'lucide-react'
import { PlatformIcon } from '@/components/platform-icons'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { THUMBNAIL_STYLES, DEFAULT_THUMBNAIL_STYLE_ID } from '@/lib/thumbnail-styles'
import Image from 'next/image'
import { ProviderLogo } from '@/components/ui/provider-logos'

import { toast } from 'sonner'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    useSortable,
    arrayMove,
    rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Types ──────────────────────────────────────────

interface ChannelPlatform {
    id: string
    platform: string
    accountId: string
    accountName: string
    isActive: boolean
    avatarUrl?: string | null
    config?: Record<string, unknown> | null
}

interface Channel {
    id: string
    displayName: string
    name: string
    language: string
    defaultAiProvider: string | null
    defaultAiModel: string | null
    defaultImageProvider: string | null
    defaultImageModel: string | null
    requireApproval: 'none' | 'optional' | 'required'
    platforms: ChannelPlatform[]
}

interface MediaItem {
    id: string
    url: string
    thumbnailUrl: string | null
    type: string
    originalName: string | null
    duration?: number          // seconds — populated from video metadata on attach
    // Canva import placeholder fields
    isCanvaLoading?: boolean
    canvaError?: string | null
    canvaDesignId?: string
    canvaRetryFn?: () => void
}

// ─── Media helper ────────────────────────────────────

function isVideo(media: MediaItem): boolean {
    if (media.type === 'video') return true
    const ext = (media.originalName || media.url || '').toLowerCase()
    return /\.(mp4|mov|webm|avi|mkv|ogg|3gp|flv|wmv|mpeg)$/.test(ext)
}

function MediaElement({ media, className, videoControls }: { media: MediaItem; className?: string; videoControls?: boolean }) {
    if (isVideo(media)) {
        return (
            <video
                src={media.url}
                className={className}
                autoPlay
                muted
                loop
                playsInline
                controls={!!videoControls}
                poster={media.thumbnailUrl || undefined}
                style={{ objectFit: 'cover' }}
            />
        )
    }
    return <img src={media.thumbnailUrl || media.url} alt="" className={className} />
}

// ─── Platform config ────────────────────────────────

const platformLimits: Record<string, number> = {
    facebook: 63206, instagram: 2200, x: 280, twitter: 280,
    tiktok: 2200, youtube: 5000, linkedin: 3000, pinterest: 500,
}

const platformLabels: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', x: 'X (Twitter)',
    twitter: 'Twitter', tiktok: 'TikTok', youtube: 'YouTube',
    linkedin: 'LinkedIn', pinterest: 'Pinterest',
}

const platformColors: Record<string, string> = {
    facebook: '#1877F2', instagram: '#E4405F', x: '#000000',
    twitter: '#1DA1F2', tiktok: '#00F2EA', youtube: '#FF0000',
    linkedin: '#0A66C2', pinterest: '#E60023',
}

// ─── AI Image model display names ────────────────────────────────────────────
// Used to show friendly names when building the plan model list from admin config
const MODEL_DISPLAY_NAMES: Record<string, string> = {
    // Google Gemini image models
    'gemini-2.0-flash-exp': 'Gemini 2.0 Flash (Image) Experimental',
    'gemini-2.0-flash-preview-image-generation': 'Gemini 2.0 Flash (Image) Experimental',
    'gemini-3.1-flash-image-preview': 'Nano Banana 2',
    'gemini-3-pro-image-preview': 'Nano Banana Pro',
    'gemini-2.5-flash-image': 'Nano Banana',
    'imagen-3.0-generate-002': 'Imagen 4',
    'imagen-3.0-generate-001': 'Imagen 3',
    // OpenAI image models
    'dall-e-3': 'DALL·E 3',
    'dall-e-2': 'DALL·E 2',
    'gpt-image-1': 'GPT Image 1',
    // Runware models
    'runware:100@1': 'FLUX.1 [Dev]',
    'runware:101@1': 'FLUX.1 [Schnell]',
    'civitai:133005@1': 'Juggernaut XL',
    'runware:5@1': 'Stable Diffusion XL',
}

// Supported file types for upload
const ACCEPTED_FILE_TYPES = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
    // Videos
    'video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/x-msvideo',
    'video/x-matroska', 'video/ogg', 'video/3gpp', 'video/x-flv',
    'video/x-ms-wmv', 'video/mpeg',
].join(',')

// ─── Platform brand SVG icons (for badges — brand color on neutral bg, matching channel list design) ───
const platformBadgeIcons: Record<string, React.ReactNode> = {
    facebook: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
    instagram: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#E4405F"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z" /></svg>,
    youtube: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>,
    tiktok: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>,
    x: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
    twitter: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#1DA1F2"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>,
    linkedin: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>,
    pinterest: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#E60023"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" /></svg>,
    bluesky: <svg viewBox="0 0 600 530" className="w-2.5 h-2.5" fill="#0085ff"><path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 590-17.88 590 68.825c0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.19-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.193.516-3.707 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.098-34.605-132.23 82.697-152.19-67.108 11.421-142.55-7.45-163.25-81.433C20.15 217.613 10 86.535 10 68.825c0-86.703 77.742-60.816 125.72-24.795z" /></svg>,
    threads: <svg viewBox="0 0 192 192" className="w-2.5 h-2.5" fill="currentColor"><path d="M141.537 88.988a66.667 66.667 0 00-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.741C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.424 74.204 17.109 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.07 0h-.113C68.882.195 47.292 9.643 32.788 28.08 19.882 44.485 13.224 67.315 13.001 95.932L13 96v.067c.224 28.617 6.882 51.447 19.788 67.854C47.292 182.358 68.882 191.806 96.957 192h.113c24.96-.169 42.502-6.72 57.048-21.253 18.574-18.557 18.023-41.773 11.945-56.01-4.245-9.896-12.33-18.31-24.526-24.749zM96.45 129.12c-10.433.578-21.287-4.098-21.826-14.15-.408-7.638 5.44-16.148 23.144-17.18 2.024-.117 4.012-.173 5.97-.173 6.146 0 11.879.6 17.086 1.768-1.946 24.18-14.16 29.083-24.374 29.735z" /></svg>,
    gbp: <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#4285F4"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>,
}

// ─── Realistic Preview Components ───────────────────

// Helper: extract avatar URL — prefers the dedicated avatarUrl field, then falls back to config
function getPlatformAvatar(platform: ChannelPlatform | undefined): string | null {
    if (!platform) return null
    // Prefer the top-level avatarUrl field (set by OAuth callbacks)
    if (platform.avatarUrl) return platform.avatarUrl
    if (!platform.config) return null
    const cfg = platform.config as Record<string, unknown>
    // Common fields: picture, avatar, profilePicture, profile_picture_url
    const url = cfg.picture || cfg.avatar || cfg.profilePicture || cfg.profile_picture_url
    if (typeof url === 'string') return url
    // Facebook style: { picture: { data: { url } } }
    if (cfg.picture && typeof cfg.picture === 'object') {
        const pic = cfg.picture as Record<string, unknown>
        if (pic.data && typeof pic.data === 'object') {
            const data = pic.data as Record<string, unknown>
            if (typeof data.url === 'string') return data.url
        }
    }
    return null
}

// Avatar circle — shows real photo if available, fallback to colored initials
function AccountAvatar({ name, avatarUrl, size = 'md', style }: {
    name: string
    avatarUrl?: string | null
    size?: 'sm' | 'md' | 'lg'
    style?: React.CSSProperties
}) {
    const sizeClass = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm'
    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={name}
                className={`${sizeClass} rounded-full object-cover shrink-0`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement | null)?.style && ((e.currentTarget.nextSibling as HTMLElement).style.display = 'flex') }}
            />
        )
    }
    return (
        <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold shrink-0`} style={style}>
            {name.charAt(0).toUpperCase()}
        </div>
    )
}

function FacebookPreview({ content, media, accountName, accountAvatar, postType, mediaRatio, firstComment }: {
    content: string; media: MediaItem[]; accountName: string; accountAvatar?: string | null; postType: string; mediaRatio: string; firstComment?: string
}) {
    const fbColor = '#1877F2'
    if (postType === 'story' || postType === 'reel') {
        const isReel = postType === 'reel'
        return (
            <div className="rounded-xl overflow-hidden bg-black text-white relative aspect-[9/16]">
                {media.length > 0 ? (
                    <MediaElement media={media[0]} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-900" />
                )}
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
                {/* Header */}
                <div className="relative z-10 p-3 pt-4 flex items-center gap-2">
                    <AccountAvatar name={accountName} avatarUrl={accountAvatar} size="sm" style={{ backgroundColor: '#1877F2' }} />
                    <span className="text-[11px] font-semibold drop-shadow">{accountName}</span>
                    <span className="text-[10px] opacity-70 ml-auto">{isReel ? '▶ Reel' : 'Story'}</span>
                </div>
                {/* Progress bar (story style) */}
                <div className="absolute top-2 left-2 right-2 h-0.5 bg-white/30 rounded-full">
                    <div className="h-full w-1/3 bg-white rounded-full" />
                </div>
                {/* Bottom caption */}
                {content && (
                    <div className="absolute bottom-6 left-3 right-3 z-10">
                        <p className="text-xs font-medium drop-shadow-lg line-clamp-3 leading-relaxed">
                            {content.slice(0, 200)}
                        </p>
                    </div>
                )}
                {/* Like/Comment sidebar for Reel */}
                {isReel && (
                    <div className="absolute right-2 bottom-16 z-10 flex flex-col items-center gap-3">
                        <div className="flex flex-col items-center gap-0.5">
                            <Heart className="h-5 w-5 drop-shadow" />
                            <span className="text-[9px]">0</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                            <MessageCircle className="h-5 w-5 drop-shadow" />
                            <span className="text-[9px]">0</span>
                        </div>
                        <Share2 className="h-5 w-5 drop-shadow" />
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-3">
                <AccountAvatar name={accountName} avatarUrl={accountAvatar} style={{ backgroundColor: fbColor }} />
                <div className="flex-1">
                    <p className="text-sm font-semibold">{accountName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Just now · <Globe className="h-3 w-3" />
                    </p>
                </div>
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </div>
            {/* Content */}
            <div className="px-3 pb-2">
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {content.slice(0, platformLimits.facebook)}
                </p>
            </div>
            {/* Media */}
            {media.length === 1 && (
                <div className={`w-full bg-muted overflow-hidden ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'
                    }`}>
                    <MediaElement media={media[0]} className="w-full h-full object-cover" />
                </div>
            )}
            {media.length === 2 && (
                <div className="grid grid-cols-2 gap-0.5">
                    {media.slice(0, 2).map((m, i) => (
                        <div key={i} className="aspect-square bg-muted overflow-hidden">
                            <MediaElement media={m} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>
            )}
            {media.length >= 3 && (
                <div className="grid grid-cols-2 gap-0.5">
                    <div className="row-span-2 aspect-square bg-muted overflow-hidden">
                        <MediaElement media={media[0]} className="w-full h-full object-cover" />
                    </div>
                    <div className="aspect-[2/1] bg-muted overflow-hidden">
                        <MediaElement media={media[1]} className="w-full h-full object-cover" />
                    </div>
                    <div className="aspect-[2/1] bg-muted overflow-hidden relative">
                        <MediaElement media={media[2]} className="w-full h-full object-cover" />
                        {media.length > 3 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-2xl font-bold">
                                +{media.length - 3}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Reactions bar */}
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center justify-between border-t">
                <span>👍 ❤️ 0</span>
                <span>{firstComment ? '1 Comment' : '0 Comments'} · 0 Shares</span>
            </div>
            {/* Actions */}
            <div className="flex items-center border-t divide-x">
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                    <ThumbsUp className="h-4 w-4" /> Like
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                    <MessageCircle className="h-4 w-4" /> Comment
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                    <Share2 className="h-4 w-4" /> Share
                </button>
            </div>
            {/* First Comment */}
            {firstComment && (
                <div className="px-3 py-2 border-t">
                    <div className="flex gap-2">
                        <AccountAvatar name={accountName} avatarUrl={accountAvatar} size="sm" style={{ backgroundColor: fbColor }} />
                        <div className="bg-muted rounded-xl px-3 py-1.5 flex-1">
                            <p className="text-xs font-semibold">{accountName}</p>
                            <p className="text-xs whitespace-pre-wrap break-words">{firstComment}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function InstagramPreview({ content, media, accountName, accountAvatar, mediaRatio }: {
    content: string; media: MediaItem[]; accountName: string; accountAvatar?: string | null; mediaRatio: string
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-3">
                <div className="h-8 w-8 rounded-full ring-2 ring-pink-500 ring-offset-2 ring-offset-background overflow-hidden shrink-0">
                    <AccountAvatar name={accountName} avatarUrl={accountAvatar} size="sm" style={{ backgroundColor: '#E4405F' }} />
                </div>
                <p className="text-sm font-semibold flex-1">{accountName}</p>
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </div>
            {media.length === 1 ? (
                <div className={`w-full bg-muted overflow-hidden ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'
                    }`}>
                    <MediaElement media={media[0]} className="w-full h-full object-cover" />
                </div>
            ) : media.length > 1 ? (
                <div className="relative">
                    <div className="overflow-x-auto flex snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {media.map((m, i) => (
                            <div key={i} className={`flex-none w-full snap-center bg-muted overflow-hidden ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'}`}>
                                <MediaElement media={m} className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                    {/* Carousel dots */}
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                        {media.map((_, i) => (
                            <div key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-white/50'}`} />
                        ))}
                    </div>
                    {/* Item count badge */}
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                        1/{media.length}
                    </div>
                </div>
            ) : (
                <div className={`w-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'
                    }`}>
                    <p className="text-white text-center font-medium px-6 text-sm leading-relaxed">
                        {content.slice(0, 150)}
                    </p>
                </div>
            )}
            <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Heart className="h-5 w-5 cursor-pointer hover:text-red-500 transition-colors" />
                        <MessageCircle className="h-5 w-5 cursor-pointer" />
                        <Send className="h-5 w-5 cursor-pointer" />
                    </div>
                    <Bookmark className="h-5 w-5 cursor-pointer" />
                </div>
                <p className="text-xs font-semibold">0 likes</p>
                <p className="text-xs leading-relaxed">
                    <span className="font-semibold">{accountName}</span>{' '}
                    {content.slice(0, platformLimits.instagram)}
                </p>
            </div>
        </div>
    )
}

function TikTokPreview({ content, media, accountName, accountAvatar, mediaRatio = '9:16', postType = 'video' }: {
    content: string; media: MediaItem[]; accountName: string; accountAvatar?: string | null; mediaRatio?: string; postType?: 'video' | 'carousel'
}) {
    const [activeIdx, setActiveIdx] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)
    const isDraggingRef = useRef(false)
    const dragStartXRef = useRef(0)
    const dragScrollLeftRef = useRef(0)
    const hasVideo = media.some(m => isVideo(m))
    const isCarousel = postType === 'carousel'

    // Sync dot indicator when user scrolls
    const handleScroll = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        const idx = Math.round(el.scrollLeft / el.offsetWidth)
        setActiveIdx(idx)
    }, [])

    const goTo = (idx: number) => {
        const el = scrollRef.current
        if (!el) return
        el.scrollTo({ left: idx * el.offsetWidth, behavior: 'smooth' })
        setActiveIdx(idx)
    }

    // Mouse drag handlers for desktop carousel swipe
    const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const el = scrollRef.current
        if (!el) return
        isDraggingRef.current = true
        dragStartXRef.current = e.pageX - el.offsetLeft
        dragScrollLeftRef.current = el.scrollLeft
        el.style.cursor = 'grabbing'
    }, [])
    const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return
        const el = scrollRef.current
        if (!el) return
        e.preventDefault()
        const walk = (e.pageX - el.offsetLeft) - dragStartXRef.current
        el.scrollLeft = dragScrollLeftRef.current - walk
    }, [])
    const onMouseUpOrLeave = useCallback(() => {
        isDraggingRef.current = false
        if (scrollRef.current) scrollRef.current.style.cursor = 'grab'
    }, [])

    // Aspect ratio class for video mode image container
    const videoRatioClass = mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '1:1' ? 'aspect-square' : '' /* 9:16 → fill */

    if (isCarousel) {
        // ── TikTok Photo / Image Carousel mode ──────────────────────
        return (
            <div className="relative w-full h-full text-white overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#111' }}>

                {/* ── Full-bleed scrollable carousel ── */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUpOrLeave}
                    onMouseLeave={onMouseUpOrLeave}
                    className="absolute flex overflow-x-scroll snap-x snap-mandatory select-none"
                    style={{ top: '36px', bottom: 0, left: 0, right: 0, scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
                >
                    {media.length > 0 ? media.map((m, i) => (
                        <div key={i} className="flex-none w-full h-full snap-center overflow-hidden bg-zinc-900">
                            <img
                                src={m.thumbnailUrl || m.url}
                                alt={`Slide ${i + 1}`}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )) : (
                        <div className="flex-none w-full h-full snap-center bg-zinc-900 flex items-center justify-center">
                            <p className="text-white/30 text-[11px]">No images</p>
                        </div>
                    )}
                </div>

                {/* Bottom gradient for readability of caption/sidebar */}
                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none z-10" />

                {/* Top bar (always on top, z-20) */}
                <div className="absolute top-0 left-0 right-0 z-20 pt-1 pb-1 flex items-center justify-center bg-gradient-to-b from-black/60 to-transparent">
                    <button className="px-3 py-1 text-[11px] font-medium text-white/60">Following</button>
                    <div className="flex flex-col items-center">
                        <button className="px-3 py-1 text-[12px] font-bold text-white">For You</button>
                        <div className="w-6 h-[2px] bg-white rounded-full" />
                    </div>
                    <button className="px-3 py-1 text-[11px] font-medium text-white/60">Explore</button>
                    <div className="absolute right-3 top-1.5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                    </div>
                </div>

                {/* Slide counter badge */}
                {media.length > 1 && (
                    <div className="absolute z-20 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ top: '44px', right: '10px' }}>
                        {activeIdx + 1}/{media.length}
                    </div>
                )}

                {/* Right sidebar — overlaid on image */}
                <div className="absolute right-2 bottom-16 z-20 flex flex-col items-center gap-3">
                    <div className="relative mb-1">
                        <div className="w-9 h-9 rounded-full border-2 border-white overflow-hidden">
                            <AccountAvatar name={accountName} avatarUrl={accountAvatar} style={{ backgroundColor: '#555' }} />
                        </div>
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#FE2C55] flex items-center justify-center">
                            <Plus className="h-2.5 w-2.5 text-white" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                        <Heart className="h-6 w-6 fill-white text-white drop-shadow" />
                        <span className="text-[9px] font-semibold drop-shadow">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                        <MessageCircle className="h-6 w-6 fill-white text-white drop-shadow" />
                        <span className="text-[9px] font-semibold drop-shadow">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                        <Bookmark className="h-6 w-6 fill-white text-white drop-shadow" />
                        <span className="text-[9px] font-semibold drop-shadow">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                        <Share2 className="h-6 w-6 text-white drop-shadow" />
                        <span className="text-[9px] font-semibold drop-shadow">0</span>
                    </div>
                    <div className="w-8 h-8 rounded-full border-4 border-zinc-700 bg-zinc-600 flex items-center justify-center overflow-hidden animate-spin" style={{ animationDuration: '4s' }}>
                        <div className="w-3 h-3 rounded-full bg-zinc-900 flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-zinc-500" />
                        </div>
                    </div>
                </div>

                {/* Dot indicators — above caption, below image */}
                {media.length > 1 && (
                    <div className="absolute z-20 flex justify-center gap-1" style={{ bottom: '52px', left: 0, right: '48px' }}>
                        {media.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                className={`h-1 rounded-full transition-all cursor-pointer ${i === activeIdx ? 'w-4 bg-[#FE2C55]' : 'w-1 bg-white/50'}`}
                            />
                        ))}
                    </div>
                )}

                {/* Bottom caption — overlaid on image */}
                <div className="absolute bottom-2 left-0 right-12 z-20 px-3 space-y-1">
                    <p className="text-[11px] font-bold drop-shadow">@{accountName}</p>
                    <p className="text-[10px] leading-relaxed line-clamp-2 drop-shadow">{content.slice(0, 120) || 'Your caption will appear here…'}</p>
                    <div className="flex items-center gap-1.5">
                        <Music className="h-3 w-3 shrink-0 text-white" />
                        <p className="text-[9px] text-white/80 whitespace-nowrap animate-marquee">
                            ♫ original sound — @{accountName}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ♫ original sound — @{accountName}
                        </p>
                    </div>
                </div>
            </div>
        )
    }


    // ── Video / single-image mode ────────────────────────────────────
    const coverMedia = media[0]
    const isFullScreen = !mediaRatio || mediaRatio === '9:16'
    return (
        <div className="relative w-full h-full bg-black text-white overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {/* Background: full-screen for 9:16, gradient otherwise */}
            {isFullScreen ? (
                coverMedia ? (
                    isVideo(coverMedia) ? (
                        <video
                            key={coverMedia.url}
                            src={coverMedia.url}
                            className="absolute inset-0 w-full h-full object-cover"
                            autoPlay muted loop playsInline
                            poster={coverMedia.thumbnailUrl || undefined}
                        />
                    ) : (
                        <img src={coverMedia.thumbnailUrl || coverMedia.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
                )
            ) : (
                // Non-9:16 ratio — dark background + centred image box
                <div className="absolute inset-0 bg-zinc-900">
                    {coverMedia && (
                        <div className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 mx-0 ${videoRatioClass} overflow-hidden`}>
                            {isVideo(coverMedia) ? (
                                <video
                                    key={coverMedia.url}
                                    src={coverMedia.url}
                                    className="w-full h-full object-cover"
                                    autoPlay muted loop playsInline
                                    poster={coverMedia.thumbnailUrl || undefined}
                                />
                            ) : (
                                <img src={coverMedia.thumbnailUrl || coverMedia.url} alt="" className="w-full h-full object-cover" />
                            )}
                        </div>
                    )}
                </div>
            )}
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 z-20 pt-1 pb-2 flex items-center justify-center gap-0">
                <button className="px-3 py-1 text-[11px] font-medium text-white/60">Following</button>
                <div className="flex flex-col items-center">
                    <button className="px-3 py-1 text-[12px] font-bold text-white">For You</button>
                    <div className="w-6 h-[2px] bg-white rounded-full" />
                </div>
                <button className="px-3 py-1 text-[11px] font-medium text-white/60">Explore</button>
                <div className="absolute right-3 top-1.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                </div>
            </div>

            {/* Play icon (images only) */}
            {!hasVideo && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="w-14 h-14 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
                        <Play className="h-7 w-7 fill-white text-white ml-1" />
                    </div>
                </div>
            )}

            {/* Right sidebar */}
            <div className="absolute right-2 bottom-20 z-20 flex flex-col items-center gap-4">
                <div className="relative mb-1">
                    <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
                        <AccountAvatar name={accountName} avatarUrl={accountAvatar} style={{ backgroundColor: '#555' }} />
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#FE2C55] flex items-center justify-center">
                        <Plus className="h-2.5 w-2.5 text-white" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <div className="w-10 h-10 flex items-center justify-center">
                        <Heart className="h-7 w-7 fill-white text-white" />
                    </div>
                    <span className="text-[10px] font-semibold">0</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <div className="w-10 h-10 flex items-center justify-center">
                        <MessageCircle className="h-7 w-7 fill-white text-white" />
                    </div>
                    <span className="text-[10px] font-semibold">0</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <div className="w-10 h-10 flex items-center justify-center">
                        <Bookmark className="h-7 w-7 fill-white text-white" />
                    </div>
                    <span className="text-[10px] font-semibold">0</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <div className="w-10 h-10 flex items-center justify-center">
                        <Share2 className="h-7 w-7 text-white" />
                    </div>
                    <span className="text-[10px] font-semibold">0</span>
                </div>
                <div className="w-9 h-9 rounded-full border-4 border-zinc-800 bg-zinc-700 flex items-center justify-center overflow-hidden animate-spin" style={{ animationDuration: '4s' }}>
                    <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    </div>
                </div>
            </div>

            {/* Bottom caption */}
            <div className="absolute bottom-3 left-0 right-14 z-20 px-3 space-y-1.5">
                <p className="text-[11px] font-bold drop-shadow">@{accountName}</p>
                <p className="text-[10px] leading-relaxed line-clamp-2 drop-shadow">{content.slice(0, 120) || 'Your caption will appear here…'}</p>
                <div className="flex items-center gap-1.5">
                    <Music className="h-3 w-3 shrink-0 text-white" />
                    <div className="overflow-hidden flex-1">
                        <p className="text-[9px] text-white/80 whitespace-nowrap animate-marquee">
                            ♫ original sound — @{accountName}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ♫ original sound — @{accountName}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}


function XPreview({ content, accountName, accountAvatar }: {
    content: string; accountName: string; accountAvatar?: string | null
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3 flex gap-3">
                <AccountAvatar name={accountName} avatarUrl={accountAvatar} style={{ backgroundColor: '#000' }} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                        <p className="text-sm font-bold">{accountName}</p>
                        <p className="text-sm text-muted-foreground">@{accountName.toLowerCase().replace(/\s/g, '')} · now</p>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap break-words leading-relaxed">
                        {content.slice(0, platformLimits.x)}
                    </p>
                    <div className="flex items-center justify-between mt-3 text-muted-foreground max-w-[280px]">
                        <button className="flex items-center gap-1 text-xs hover:text-blue-500 transition-colors cursor-pointer">
                            <MessageCircle className="h-4 w-4" /> 0
                        </button>
                        <button className="flex items-center gap-1 text-xs hover:text-green-500 transition-colors cursor-pointer">
                            <Repeat2 className="h-4 w-4" /> 0
                        </button>
                        <button className="flex items-center gap-1 text-xs hover:text-red-500 transition-colors cursor-pointer">
                            <Heart className="h-4 w-4" /> 0
                        </button>
                        <button className="flex items-center gap-1 text-xs hover:text-blue-500 transition-colors cursor-pointer">
                            <Share2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function YouTubePreview({ content, media, accountName, accountAvatar, mediaRatio }: {
    content: string; media: MediaItem[]; accountName: string; accountAvatar?: string | null; mediaRatio: string
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            {media.length > 0 ? (
                <div className={`relative w-full bg-muted overflow-hidden ${mediaRatio === '9:16' ? 'aspect-[9/16]' : mediaRatio === '1:1' ? 'aspect-square' : 'aspect-video'
                    }`}>
                    <MediaElement media={media[0]} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center">
                            <Play className="h-6 w-6 text-white ml-0.5" />
                        </div>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1 rounded">0:00</div>
                </div>
            ) : (
                <div className={`w-full bg-muted flex items-center justify-center ${mediaRatio === '9:16' ? 'aspect-[9/16]' : mediaRatio === '1:1' ? 'aspect-square' : 'aspect-video'
                    }`}>
                    <Play className="h-8 w-8 text-muted-foreground/30" />
                </div>
            )}
            <div className="p-3 flex gap-3">
                <AccountAvatar name={accountName} avatarUrl={accountAvatar} size="sm" style={{ backgroundColor: '#FF0000' }} />
                <div>
                    <p className="text-sm font-semibold line-clamp-2">{content.slice(0, 100)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{accountName} · 0 views · Just now</p>
                </div>
            </div>
        </div>
    )
}

function LinkedInPreview({ content, media, accountName, accountAvatar, mediaRatio }: {
    content: string; media: MediaItem[]; accountName: string; accountAvatar?: string | null; mediaRatio: string
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-3">
                <AccountAvatar name={accountName} avatarUrl={accountAvatar} style={{ backgroundColor: '#0A66C2' }} />
                <div className="flex-1">
                    <p className="text-sm font-semibold">{accountName}</p>
                    <p className="text-xs text-muted-foreground">Just now · <Globe className="h-3 w-3 inline" /></p>
                </div>
            </div>
            <div className="px-3 pb-2">
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content.slice(0, platformLimits.linkedin)}</p>
            </div>
            {media.length === 1 && (
                <div className={`w-full bg-muted overflow-hidden ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16] max-h-[400px]' : 'aspect-square'
                    }`}>
                    <MediaElement media={media[0]} className="w-full h-full object-cover" />
                </div>
            )}
            {media.length === 2 && (
                <div className="grid grid-cols-2 gap-0.5">
                    {media.slice(0, 2).map((m, i) => (
                        <div key={i} className="aspect-square bg-muted overflow-hidden">
                            <MediaElement media={m} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>
            )}
            {media.length >= 3 && (
                <div className="grid grid-cols-2 gap-0.5">
                    <div className="row-span-2 aspect-square bg-muted overflow-hidden">
                        <MediaElement media={media[0]} className="w-full h-full object-cover" />
                    </div>
                    <div className="aspect-[2/1] bg-muted overflow-hidden">
                        <MediaElement media={media[1]} className="w-full h-full object-cover" />
                    </div>
                    <div className="aspect-[2/1] bg-muted overflow-hidden relative">
                        <MediaElement media={media[2]} className="w-full h-full object-cover" />
                        {media.length > 3 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-2xl font-bold">
                                +{media.length - 3}
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                👍 0 · 0 comments
            </div>
            <div className="flex items-center border-t divide-x">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                    <ThumbsUp className="h-4 w-4" /> Like
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                    <MessageCircle className="h-4 w-4" /> Comment
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                    <Share2 className="h-4 w-4" /> Share
                </button>
            </div>
        </div>
    )
}

function GenericPreview({ content, media, accountName, platform, mediaRatio }: {
    content: string; media: MediaItem[]; accountName: string; platform: string; mediaRatio: string
}) {
    const limit = platformLimits[platform] || 5000
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-3">
                <div className="h-9 w-9 rounded-full flex items-center justify-center bg-muted">
                    <PlatformIcon platform={platform} size="md" />
                </div>
                <div>
                    <p className="text-sm font-semibold">{accountName}</p>
                    <p className="text-[10px] text-muted-foreground">{platformLabels[platform] || platform}</p>
                </div>
            </div>
            <div className="px-3 pb-3">
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content.slice(0, limit)}</p>
            </div>
            {media.length === 1 && (
                <div className={`px-3 pb-3 overflow-hidden ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16] max-h-[400px]' : 'aspect-square'
                    }`}>
                    <MediaElement media={media[0]} className="w-full h-full rounded-lg object-cover" />
                </div>
            )}
            {media.length >= 2 && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-1">
                    {media.slice(0, 4).map((m, i) => (
                        <div key={i} className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                            <MediaElement media={m} className="w-full h-full object-cover" />
                            {i === 3 && media.length > 4 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-bold rounded-lg">
                                    +{media.length - 4}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── SortableMediaCard ──────────────────────────────

interface SortableMediaCardProps {
    media: MediaItem
    index: number
    mediaRatio: string
    isLast: boolean
    aiImageJustCompleted: boolean
    onRemove: (id: string) => void
    onZoom: (url: string | null) => void
    onEditInCanva: (url?: string, id?: string) => void
    onRefresh?: (id: string, updated: MediaItem) => void
}

function isVideoMedia(media: MediaItem) {
    return media.type === 'video' || (media.url || '').match(/\.(mp4|mov|avi|webm|mkv)$/i) !== null
}

function SortableMediaCard({ media, index, mediaRatio, isLast, aiImageJustCompleted, onRemove, onZoom, onEditInCanva, onRefresh }: SortableMediaCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id })

    // Poll for thumbnail if video doesn't have one yet (background transcode running)
    const needsThumbnail = media.type === 'video' && !media.thumbnailUrl
    useEffect(() => {
        if (!needsThumbnail || !onRefresh) return
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/admin/media/${media.id}/thumbnail`)
                if (res.ok) {
                    const updated = await res.json() as MediaItem
                    if (updated.thumbnailUrl) {
                        onRefresh(media.id, updated)
                        clearInterval(interval)
                    }
                }
            } catch { /* ignore */ }
        }, 3000)
        return () => clearInterval(interval)
    }, [needsThumbnail, media.id, onRefresh])

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    }

    const aspectClass = mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'

    // ── Canva placeholder ────────────────────────────
    if (media.isCanvaLoading || media.canvaError) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className={`relative group rounded-lg overflow-hidden border ${media.canvaError ? 'border-red-500/40 bg-red-950/20' : 'border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-black/60 to-indigo-950/40'} ${aspectClass}`}
            >
                {media.isCanvaLoading && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/5 to-transparent" style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s ease-in-out infinite' }} />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1">
                    <div className="flex items-center gap-1">
                        <img src="/logo.png" alt="NeeFlow" className="h-4 w-4 object-contain" />
                        <span className="text-[8px] text-muted-foreground">×</span>
                        <img src="/CIRCLE LOGO - GRADIENT - RGB.svg" alt="Canva" className="h-4 w-4 object-contain" />
                    </div>
                    {media.isCanvaLoading ? (
                        <>
                            <Loader2 className="h-3 w-3 text-violet-400 animate-spin" />
                            <p className="text-[7px] text-violet-300 text-center leading-tight">Importing...</p>
                        </>
                    ) : (
                        <>
                            <p className="text-[7px] text-red-400 text-center leading-tight">{media.canvaError}</p>
                            {media.canvaRetryFn && (
                                <button onClick={media.canvaRetryFn} className="text-[8px] px-1.5 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer">
                                    Retry
                                </button>
                            )}
                        </>
                    )}
                </div>
                <button onClick={() => onRemove(media.id)} className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <X className="h-2.5 w-2.5" />
                </button>
            </div>
        )
    }

    // ── Normal media item ────────────────────────────
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`relative group rounded-lg overflow-hidden bg-muted cursor-grab active:cursor-grabbing ${aspectClass} ${aiImageJustCompleted && isLast ? 'animate-ai-reveal' : ''}`}
        >

            {isVideoMedia(media) ? (
                <div className="relative h-full w-full bg-muted">
                    {media.thumbnailUrl ? (
                        <img
                            src={media.thumbnailUrl}
                            alt={media.originalName || ''}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        /* No thumbnail yet — background transcode still running */
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-gray-900 to-gray-800 px-1.5">
                            <div className="h-7 w-7 rounded-full bg-black/40 flex items-center justify-center">
                                <Play className="h-4 w-4 text-white/60 ml-0.5" />
                            </div>
                            <p className="text-[7px] text-muted-foreground text-center leading-tight truncate w-full">{media.originalName}</p>
                            <p className="text-[7px] text-primary/70 animate-pulse">Processing…</p>
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {media.thumbnailUrl && (
                            <div className="h-6 w-6 rounded-full bg-black/50 flex items-center justify-center">
                                <Play className="h-3 w-3 text-white ml-0.5" />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <img
                    src={media.thumbnailUrl || media.url}
                    alt={media.originalName || ''}
                    className="h-full w-full object-cover cursor-pointer"
                    onClick={() => onZoom(media.url || media.thumbnailUrl)}
                />
            )}

            {/* Delete button */}
            <button
                onClick={() => onRemove(media.id)}
                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
                <X className="h-2.5 w-2.5" />
            </button>

            {/* Zoom button */}
            {!isVideoMedia(media) && (
                <button
                    onClick={() => onZoom(media.url || media.thumbnailUrl)}
                    title="View full size"
                    className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/80"
                >
                    <ZoomIn className="h-2.5 w-2.5" />
                </button>
            )}

            {/* Edit in Canva */}
            {!isVideoMedia(media) && (
                <button
                    onClick={() => onEditInCanva(media.url, media.id)}
                    title="Edit in Canva"
                    className="absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[#7d2ae8] text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:bg-[#9037ff] hover:scale-105 shadow-lg"
                >
                    <img src="/CIRCLE LOGO - GRADIENT - RGB.svg" alt="Canva" className="h-4 w-4 object-contain flex-shrink-0" />
                    <span className="text-[9px] font-bold hidden group-hover:inline whitespace-nowrap">Edit in Canva</span>
                </button>
            )}
        </div>
    )
}

// ─── Page ───────────────────────────────────────────

export default function ComposePage() {
    const branding = useBranding()
    const t = useTranslation()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { activeChannelId } = useWorkspace()
    const editPostId = searchParams.get('edit')
    const editSource = searchParams.get('source') // 'client-board' when opened from approval flow
    const [editPostStatus, setEditPostStatus] = useState<string | null>(null) // status of the post being edited
    // Mobile tab: 'settings' | 'editor' | 'preview'
    const [mobileTab, setMobileTab] = useState<'settings' | 'editor' | 'preview'>('editor')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const savedRef = useRef(false) // track if post has been saved/published
    const postIdRef = useRef<string | null>(editPostId) // track created post ID to avoid duplicates
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showLinkInput, setShowLinkInput] = useState(false)
    const [linkInputValue, setLinkInputValue] = useState('')

    // State
    const [channels, setChannels] = useState<Channel[]>([])
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
    const [content, setContent] = useState('')
    // Per-platform content customization
    const [contentPerPlatform, setContentPerPlatform] = useState<Record<string, string>>({})
    const [customizingContent, setCustomizingContent] = useState(false)
    const [activeContentTab, setActiveContentTab] = useState<string | null>(null)
    // Use platform ID as unique key (not platform:accountId which can collide)
    const [selectedPlatformIds, setSelectedPlatformIds] = useState<Set<string>>(new Set())
    const [attachedMedia, setAttachedMedia] = useState<MediaItem[]>([])
    const [scheduleDate, setScheduleDate] = useState('')
    const [scheduleTime, setScheduleTime] = useState('')
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [requestApproval, setRequestApproval] = useState(false) // for 'optional' approval mode
    const [generating, setGenerating] = useState(false)
    const [generatingMeta, setGeneratingMeta] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadingFileName, setUploadingFileName] = useState('')
    const [dragging, setDragging] = useState(false)
    const [aiTopic, setAiTopic] = useState('')
    // AI Suggestions & Trending
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestions, setSuggestions] = useState<{ topic: string; emoji: string; keyword?: string; angle?: string; relatedKeywords?: string[] }[]>([])
    const [loadingSuggestions, setLoadingSuggestions] = useState(false)
    const [showTrending, setShowTrending] = useState(false)
    const [trendingArticles, setTrendingArticles] = useState<{ title: string; source: string; link: string; publishedAt: string }[]>([])
    const [loadingTrending, setLoadingTrending] = useState(false)
    const [trendingCategory, setTrendingCategory] = useState('general')
    const [trendingKeywords, setTrendingKeywords] = useState('')
    // Image Picker
    const [showImagePicker, setShowImagePicker] = useState(false)
    const [imagePickerTab, setImagePickerTab] = useState<'ai' | 'article'>('ai')
    const [useContentAsPrompt, setUseContentAsPrompt] = useState(true)
    const [aiImagePrompt, setAiImagePrompt] = useState('')
    const [generatingImage, setGeneratingImage] = useState(false)
    const [aiGeneratedPreview, setAiGeneratedPreview] = useState<string | null>(null)
    const [lastUsedImageModel, setLastUsedImageModel] = useState<string | null>(null)
    const [aiImageBgGenerating, setAiImageBgGenerating] = useState(false)
    const [aiImageJustCompleted, setAiImageJustCompleted] = useState(false)
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
    // Image provider/model override for Generate Image dialog
    const [overrideImageProvider, setOverrideImageProvider] = useState('')
    const [overrideImageModel, setOverrideImageModel] = useState('')
    const [availableImageModels, setAvailableImageModels] = useState<{ id: string; name: string; type?: string }[]>([])
    const [loadingImageModels, setLoadingImageModels] = useState(false)
    const [byokProviders, setByokProviders] = useState<{ provider: string; name: string; source: string }[]>([])
    const [planProviders, setPlanProviders] = useState<{ provider: string; name: string; source: string }[]>([])
    const [planAllowedModels, setPlanAllowedModels] = useState<Record<string, string[]>>({})
    const [imageQuota, setImageQuota] = useState<{ used: number; limit: number }>({ used: 0, limit: -1 })
    const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '4:5'>('1:1')
    // ─── Studio AI extra state ─────────────────────────────────────────────────
    const [refImageDataUrl, setRefImageDataUrl] = useState<string | null>(null)         // base64 preview of reference image
    const [refImageFile, setRefImageFile] = useState<File | null>(null)
    const refImageInputRef = useRef<HTMLInputElement>(null)
    const [refImageStrength, setRefImageStrength] = useState(70)             // 0 = ignore ref, 100 = copy ref exactly
    const [selectedStyle, setSelectedStyle] = useState('')                              // style preset keyword
    const [typoText, setTypoText] = useState('')                                        // text to render in image
    const [typoFont, setTypoFont] = useState('Inter')                                   // font for typography
    const [brandingEnabled, setBrandingEnabled] = useState(false)
    const [brandLogoDataUrl, setBrandLogoDataUrl] = useState<string | null>(null)       // uploaded logo preview
    const [brandLogoPosition, setBrandLogoPosition] = useState(8)                       // 0-8 (3x3 grid index)
    const [brandLogoOpacity, setBrandLogoOpacity] = useState(80)                        // 0-100
    const brandLogoInputRef = useRef<HTMLInputElement>(null)
    const [aiHistoryMedia, setAiHistoryMedia] = useState<MediaItem[]>([])
    const [loadingAiHistory, setLoadingAiHistory] = useState(false)
    const [stockQuery, setStockQuery] = useState('')
    const [stockPhotos, setStockPhotos] = useState<{ id: number; src: { original: string; medium: string; small: string }; photographer: string; alt: string }[]>([])
    const [searchingStock, setSearchingStock] = useState(false)
    const [downloadingStock, setDownloadingStock] = useState<number | null>(null)
    const [includeSourceLink, setIncludeSourceLink] = useState(true)
    const [includeBusinessInfo, setIncludeBusinessInfo] = useState(true)
    const [appliedContext, setAppliedContext] = useState<{
        vibe?: boolean; knowledge?: number; hashtags?: number;
        templates?: number; businessInfo?: boolean; brandProfile?: boolean;
    } | null>(null)
    const [visualIdea, setVisualIdea] = useState('')
    // Facebook post type per platform ID
    const [fbPostTypes, setFbPostTypes] = useState<Record<string, 'feed' | 'story' | 'reel'>>({})
    const [fbCarousel, setFbCarousel] = useState(false)
    const [fbFirstComment, setFbFirstComment] = useState('')
    const [fbSettingsOpen, setFbSettingsOpen] = useState(true)
    // Instagram settings
    const [igPostType, setIgPostType] = useState<'feed' | 'reel' | 'story'>('feed')
    const [igShareToStory, setIgShareToStory] = useState(false)
    const [igCollaborators, setIgCollaborators] = useState('')
    const [igSettingsOpen, setIgSettingsOpen] = useState(true)
    // YouTube settings
    const [ytPostType, setYtPostType] = useState<'video' | 'shorts'>('video')
    const [ytVideoTitle, setYtVideoTitle] = useState('')
    const [ytCategory, setYtCategory] = useState('')
    const [ytTags, setYtTags] = useState('')
    const [ytPrivacy, setYtPrivacy] = useState<'public' | 'unlisted' | 'private'>('public')
    const [ytMadeForKids, setYtMadeForKids] = useState(false)
    const [ytNotifySubscribers, setYtNotifySubscribers] = useState(true)
    const [ytThumbnailPrompt, setYtThumbnailPrompt] = useState('')
    const [ytSettingsOpen, setYtSettingsOpen] = useState(true)
    // YouTube 3 title options + 3 thumbnail prompts
    const [ytTitleOptions, setYtTitleOptions] = useState<string[]>([])
    const [ytThumbnailPrompts, setYtThumbnailPrompts] = useState<string[]>([])
    const [ytSelectedTitleIdx, setYtSelectedTitleIdx] = useState(0)
    const [ytSelectedThumbIdx, setYtSelectedThumbIdx] = useState(0)
    // Thumbnail style selector
    const [thumbnailStyleId, setThumbnailStyleId] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('asocial_yt_thumbnail_style') || DEFAULT_THUMBNAIL_STYLE_ID
        }
        return DEFAULT_THUMBNAIL_STYLE_ID
    })
    const [styleModalOpen, setStyleModalOpen] = useState(false)
    const [styleSearch, setStyleSearch] = useState('')
    // TikTok settings
    const [ttPostType, setTtPostType] = useState<'video' | 'carousel'>('video')
    const [ttPublishMode, setTtPublishMode] = useState<'direct' | 'inbox'>('direct')
    // No default — TikTok requires user to manually select privacy (guideline Point 2)
    const [ttVisibility, setTtVisibility] = useState<'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' | ''>('')
    // All interaction settings must be unchecked by default (guideline Point 3)
    const [ttAllowComment, setTtAllowComment] = useState(false)
    const [ttAllowDuet, setTtAllowDuet] = useState(false)
    const [ttAllowStitch, setTtAllowStitch] = useState(false)
    // Commercial content disclosure (guideline Point 4): outer toggle + sub-checkboxes
    const [ttCommercialDisclosure, setTtCommercialDisclosure] = useState(false)
    const [ttYourBrand, setTtYourBrand] = useState(false)
    const [ttBrandedContent, setTtBrandedContent] = useState(false)
    const [ttAiGenerated, setTtAiGenerated] = useState(false)
    const [ttSettingsOpen, setTtSettingsOpen] = useState(true)
    // Point 3b: track auto-switch so we can notify user
    const [ttAutoSwitchedToPublic, setTtAutoSwitchedToPublic] = useState(false)
    // Point 2a: separate title field for TikTok (editable, distinct from caption)
    const [ttTitle, setTtTitle] = useState('')
    // Points 1b,1c,2b,2c: live creator_info from TikTok API
    const [ttCreatorInfo, setTtCreatorInfo] = useState<{
        can_post: boolean
        privacy_level_options: string[]
        comment_disabled: boolean
        duet_disabled: boolean
        stitch_disabled: boolean
        max_video_post_duration_sec: number
    } | null>(null)
    const [ttCreatorInfoLoading, setTtCreatorInfoLoading] = useState(false)
    // Pinterest settings
    const [pinBoardId, setPinBoardId] = useState('')
    const [pinTitle, setPinTitle] = useState('')
    const [pinLink, setPinLink] = useState('')
    const [pinSettingsOpen, setPinSettingsOpen] = useState(true)
    const [pinBoards, setPinBoards] = useState<{ id: string; name: string }[]>([])
    const [pinBoardsLoading, setPinBoardsLoading] = useState(false)
    const [pinCreatingBoard, setPinCreatingBoard] = useState(false)
    const [pinNewBoardName, setPinNewBoardName] = useState('')
    const [pinNewBoardPrivacy, setPinNewBoardPrivacy] = useState('PUBLIC')
    const [pinShowCreateBoard, setPinShowCreateBoard] = useState(false)
    const [pinNeedsReconnect, setPinNeedsReconnect] = useState(false)
    const [pinSandboxTokenInput, setPinSandboxTokenInput] = useState('')
    const [pinSandboxSaving, setPinSandboxSaving] = useState(false)
    const [previewPlatform, setPreviewPlatform] = useState<string>('')
    const [mediaRatio, setMediaRatio] = useState<'16:9' | '9:16' | '1:1'>('1:1')
    const [showMediaLibrary, setShowMediaLibrary] = useState(false)
    const [libraryMedia, setLibraryMedia] = useState<MediaItem[]>([])
    const [loadingLibrary, setLoadingLibrary] = useState(false)
    const [libFolders, setLibFolders] = useState<{ id: string; name: string; _count: { media: number; children: number } }[]>([])
    const [libFolderId, setLibFolderId] = useState<string | null>(null)
    const [libBreadcrumbs, setLibBreadcrumbs] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'All Files' }])
    const [libSearch, setLibSearch] = useState('')
    const [libDragging, setLibDragging] = useState(false)
    const [libUploading, setLibUploading] = useState(false)
    const [libRenameItem, setLibRenameItem] = useState<MediaItem | null>(null)
    const [libRenameName, setLibRenameName] = useState('')
    const [libNewFolderName, setLibNewFolderName] = useState('')
    const [libShowNewFolder, setLibShowNewFolder] = useState(false)
    const libFileInputRef = useRef<HTMLInputElement>(null)
    const [loadingDrivePicker, setLoadingDrivePicker] = useState(false)
    const [canvaLoading, setCanvaLoading] = useState(false)
    const [canvaExpiredModal, setCanvaExpiredModal] = useState<{ reconnectUrl: string } | null>(null)
    const handleFileUploadRef = useRef<((files: FileList | null) => Promise<void>) | null>(null)
    const selectedChannelRef = useRef<Channel | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [aiScheduleSuggestions, setAiScheduleSuggestions] = useState<any[]>([])
    const [aiScheduleLoading, setAiScheduleLoading] = useState(false)
    const [aiHourlyLoading, setAiHourlyLoading] = useState(false)
    // AI Heatmap scheduler state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [aiHeatmap, setAiHeatmap] = useState<{
        dayScores: Record<string, number>
        holidays: { date: string; name: string }[]
        bestDay: string
        bestTime: string
        bestDayHourlyScores: Record<string, number>
        engagement: string
        reason: string
    } | null>(null)
    const [heatmapViewMonth, setHeatmapViewMonth] = useState(() => new Date().getMonth() + 1)
    const [heatmapViewYear, setHeatmapViewYear] = useState(() => new Date().getFullYear())
    const [heatmapSelectedDay, setHeatmapSelectedDay] = useState<string | null>(null)

    // Load channels — only include active platforms
    useEffect(() => {
        fetch('/api/admin/channels')
            .then((r) => r.json())
            .then((data: Channel[]) => {
                // Filter only active platforms
                const filtered = data.map((ch) => ({
                    ...ch,
                    platforms: (ch.platforms || []).filter((p) => p.isActive),
                }))
                setChannels(filtered)
                // Auto-select: prefer workspace channel, then first with platforms
                if (!editPostId) {
                    const workspaceCh = activeChannelId ? filtered.find((ch) => ch.id === activeChannelId) : null
                    const first = workspaceCh || filtered.find((ch) => ch.platforms.length > 0)
                    if (first) setSelectedChannel(first)
                }
            })
            .catch(() => toast.error('Failed to load channels'))
    }, [editPostId, activeChannelId])

    // Pre-fill from ?platformContent= and ?images= (redirect from AI Post Creator in Data Explorer)
    useEffect(() => {
        const prePlatformContent = searchParams.get('platformContent')
        const preImages = searchParams.get('images')

        if (prePlatformContent) {
            try {
                const parsed: Record<string, string> = JSON.parse(decodeURIComponent(prePlatformContent))
                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                    setContentPerPlatform(parsed)
                    // Auto-open the first platform tab so user sees content immediately
                    const firstPlatform = Object.keys(parsed)[0]
                    if (firstPlatform) setActiveContentTab(firstPlatform)
                }
            } catch { /* skip invalid */ }
        }

        if (preImages) {
            try {
                const urls: string[] = JSON.parse(decodeURIComponent(preImages))
                if (urls.length > 0) {
                    setAttachedMedia(urls.map((url, i) => ({
                        id: `db-img-${i}`,
                        url,
                        type: 'IMAGE' as const,
                        filename: url.split('/').pop() || `image-${i}.jpg`,
                        originalName: url.split('/').pop() || `image-${i}.jpg`,
                        thumbnailUrl: url,
                        size: 0,
                        width: null,
                        height: null,
                        mimeType: 'image/jpeg',
                        createdAt: new Date().toISOString(),
                    })))
                }
            } catch { /* skip invalid */ }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // run once on mount

    // Pre-fill from ?shopifyProductId= (redirect from Shopify Catalog)
    useEffect(() => {
        const shopifyProductId = searchParams.get('shopifyProductId')
        if (!shopifyProductId) return

        fetch(`/api/integrations/shopify/products/${shopifyProductId}`)
            .then((r) => r.json())
            .then((product) => {
                if (!product || product.error) return

                // Set content to product name + description
                const productContent = [
                    product.name,
                    product.description ? `\n\n${product.description}` : '',
                ].join('').trim()
                setContent(productContent)

                // Pre-fill AI topic with product name
                setAiTopic(product.name)

                // Attach product images
                if (product.images && product.images.length > 0) {
                    setAttachedMedia(product.images.slice(0, 10).map((url: string, i: number) => ({
                        id: `shopify-img-${i}`,
                        url,
                        type: 'IMAGE' as const,
                        filename: url.split('/').pop() || `product-${i}.jpg`,
                        originalName: url.split('/').pop() || `product-${i}.jpg`,
                        thumbnailUrl: url,
                        size: 0,
                        width: null,
                        height: null,
                        mimeType: 'image/jpeg',
                        createdAt: new Date().toISOString(),
                    })))
                }
            })
            .catch(console.error)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // run once on mount

    // Re-select channel when workspace changes (and channels already loaded)
    useEffect(() => {
        if (!activeChannelId || channels.length === 0 || editPostId) return
        const workspaceCh = channels.find((ch) => ch.id === activeChannelId)
        if (workspaceCh) setSelectedChannel(workspaceCh)
    }, [activeChannelId, channels, editPostId])

    // Load existing post when in edit mode
    useEffect(() => {
        if (!editPostId || channels.length === 0) return
        fetch(`/api/admin/posts/${editPostId}`)
            .then((r) => r.json())
            .then((post) => {
                setContent(post.content || '')
                setEditPostStatus(post.status || null)
                setAttachedMedia((post.media || []).map((m: { mediaItem: MediaItem }) => m.mediaItem))
                // Find and select the channel
                const ch = channels.find((c) => c.id === post.channel.id)
                if (ch) setSelectedChannel(ch)
                // Restore schedule
                if (post.scheduledAt) {
                    const channelTz = (post.channel as any)?.timezone || (selectedChannel as any)?.timezone || 'UTC'
                    const d = new Date(post.scheduledAt)
                    // Format date and time in channel timezone
                    const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: channelTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
                    const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: channelTz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
                    setScheduleDate(dateParts)
                    setScheduleTime(timeParts)
                }
                // Restore contentPerPlatform from post
                if (post.contentPerPlatform && typeof post.contentPerPlatform === 'object') {
                    const cpp = post.contentPerPlatform as Record<string, string>
                    setContentPerPlatform(cpp)
                    // Auto-open first platform tab
                    const firstKey = Object.keys(cpp).find(k => cpp[k]?.trim())
                    if (firstKey) setActiveContentTab(firstKey)
                }

                // Restore selected platforms.
                // Use post.channel.platforms (embedded in API response) for matching — always correct.
                // Also use ch.platforms as fallback for IDs (ch.platforms has the same records but from React state).
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const postChannelPlatforms: { id: string; platform: string; accountId: string }[] =
                    (post.channel?.platforms as any[]) ||
                    (ch?.platforms as any[]) ||
                    []

                const selectedIds = new Set<string>()
                const fbTypes: Record<string, 'feed' | 'story' | 'reel'> = {}
                let restoredFbCarousel = false
                let restoredFbFirstComment = ''
                let restoredIgPostType: 'feed' | 'reel' | 'story' = 'feed'
                let restoredIgShareToStory = false
                let restoredIgCollaborators = ''
                let restoredTtPostType: 'video' | 'carousel' = 'video'
                let restoredTtPublishMode: 'direct' | 'inbox' = 'direct'
                let restoredYtPostType: 'video' | 'shorts' = 'video'
                let restoredYtPrivacy: 'public' | 'unlisted' | 'private' = 'public'
                let restoredYtCategory = ''
                let restoredYtMadeForKids = false
                let restoredPinBoardId = ''

                // ── Restore from saved platformStatuses ───────────────────────
                if (Array.isArray(post.platformStatuses) && post.platformStatuses.length > 0) {
                    for (const ps of post.platformStatuses) {
                        // First try exact match (platform + accountId)
                        let match = postChannelPlatforms.find(
                            (p) => p.platform === ps.platform && p.accountId === ps.accountId
                        )
                        // Fallback: platform-only match (handles isActive filter edge case)
                        if (!match) {
                            match = postChannelPlatforms.find((p) => p.platform === ps.platform)
                        }
                        if (!match) continue
                        selectedIds.add(match.id)
                        const cfg = (ps.config as Record<string, unknown>) || {}
                        if (match.platform === 'facebook') {
                            fbTypes[match.id] = (cfg.postType as 'feed' | 'story' | 'reel') || 'feed'
                            if (cfg.carousel === true) restoredFbCarousel = true
                            // Restore firstComment — stored as `firstComment` in config
                            if (cfg.firstComment) restoredFbFirstComment = cfg.firstComment as string
                            else if (cfg.enableFirstComment && cfg.firstComment) restoredFbFirstComment = cfg.firstComment as string
                        }
                        if (match.platform === 'instagram') {
                            restoredIgPostType = (cfg.postType as 'feed' | 'reel' | 'story') || 'feed'
                            restoredIgShareToStory = cfg.shareToStory === true
                            if (cfg.collaborators) restoredIgCollaborators = cfg.collaborators as string
                        }
                        if (match.platform === 'tiktok') {
                            restoredTtPostType = (cfg.postType as 'video' | 'carousel') || 'video'
                            restoredTtPublishMode = (cfg.publishMode as 'direct' | 'inbox') || 'direct'
                        }
                        if (match.platform === 'youtube') {
                            restoredYtPostType = (cfg.postType as 'video' | 'shorts') || 'video'
                            restoredYtPrivacy = (cfg.privacy as 'public' | 'unlisted' | 'private') || 'public'
                            if (cfg.category) restoredYtCategory = cfg.category as string
                            if (cfg.madeForKids === true) restoredYtMadeForKids = true
                        }
                        if (match.platform === 'pinterest') {
                            if (cfg.boardId) restoredPinBoardId = cfg.boardId as string
                        }
                    }
                }

                // ── Supplement: add platforms from contentPerPlatform that are missing from platformStatuses ─
                // Covers two cases:
                // 1. Posts created before platformStatuses were introduced (selectedIds still 0).
                // 2. Partial saves where some platforms (e.g. Bluesky, Threads) have a platformStatus
                //    record but FB/IG do not — the old `selectedIds.size === 0` guard would skip them.
                if (post.contentPerPlatform) {
                    const cpp = post.contentPerPlatform as Record<string, string>
                    const cpKeys = Object.keys(cpp).map(k => k.toLowerCase())
                    postChannelPlatforms.forEach(p => {
                        if (cpKeys.includes(p.platform.toLowerCase()) && !selectedIds.has(p.id)) {
                            selectedIds.add(p.id)
                            // Set default FB post type for each facebook account not already in fbTypes
                            if (p.platform === 'facebook' && !fbTypes[p.id]) {
                                fbTypes[p.id] = 'feed'
                            }
                        }
                    })
                }

                if (selectedIds.size > 0) {
                    setSelectedPlatformIds(selectedIds)
                    setFbPostTypes(fbTypes)
                    setFbCarousel(restoredFbCarousel)
                    if (restoredFbFirstComment) setFbFirstComment(restoredFbFirstComment)
                    setIgPostType(restoredIgPostType)
                    setIgShareToStory(restoredIgShareToStory)
                    if (restoredIgCollaborators) setIgCollaborators(restoredIgCollaborators)
                    setTtPostType(restoredTtPostType)
                    setTtPublishMode(restoredTtPublishMode)
                    setYtPostType(restoredYtPostType)
                    setYtPrivacy(restoredYtPrivacy)
                    if (restoredYtCategory) setYtCategory(restoredYtCategory)
                    setYtMadeForKids(restoredYtMadeForKids)
                    if (restoredPinBoardId) setPinBoardId(restoredPinBoardId)
                }

                savedRef.current = true // prevent auto-save of loaded data
            })
            .catch(() => toast.error('Failed to load post'))
    }, [editPostId, channels])

    // When channel changes (new post only), auto-select all active platforms
    useEffect(() => {
        if (editPostId) return // skip for edit mode — platforms restored from post
        if (selectedChannel?.platforms) {
            setSelectedPlatformIds(new Set(selectedChannel.platforms.map((p) => p.id)))
            // Default FB pages to "feed"
            const fbTypes: Record<string, 'feed' | 'story' | 'reel'> = {}
            selectedChannel.platforms.forEach((p) => {
                if (p.platform === 'facebook') fbTypes[p.id] = 'feed'
            })
            setFbPostTypes(fbTypes)
        }
    }, [selectedChannel, editPostId])

    // Keep ref in sync for async callbacks (Canva export etc.)
    useEffect(() => { selectedChannelRef.current = selectedChannel }, [selectedChannel])

    // ── Points 1b,1c,2b,2c: Fetch TikTok creator_info when TikTok is selected ──
    useEffect(() => {
        const ttPlatform = selectedChannel?.platforms?.find(p => p.platform === 'tiktok' && selectedPlatformIds.has(p.id))
        if (!ttPlatform) { setTtCreatorInfo(null); return }
        setTtCreatorInfoLoading(true)
        fetch(`/api/tiktok/creator-info?platformId=${ttPlatform.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setTtCreatorInfo(data) })
            .catch(() => { /* non-blocking */ })
            .finally(() => setTtCreatorInfoLoading(false))
    }, [selectedChannel, selectedPlatformIds])

    // ── Fetch image providers when Generate Image dialog opens ──
    useEffect(() => {
        if (!showImagePicker) return
        const IMAGE_PROVIDERS = ['runware', 'openai', 'gemini']

        // Primary: use /api/user/image-providers (returns byok + plan + quota)
        fetch('/api/user/image-providers')
            .then(r => r.ok ? r.json() : Promise.reject('endpoint failed'))
            .then((data: { byok: { provider: string; name: string; source: string }[]; plan: { provider: string; name: string; source: string }[]; quota: { used: number; limit: number }; allowedImageModels?: { provider: string; models: string[] }[] }) => {
                setByokProviders(data.byok || [])
                setPlanProviders(data.plan || [])
                setImageQuota(data.quota || { used: 0, limit: 0 })
                // Build allowed models map from plan-level allowedImageModels
                const allowedMap: Record<string, string[]> = {}
                for (const entry of (data.allowedImageModels || [])) {
                    if (entry.models && entry.models.length > 0) {
                        allowedMap[entry.provider] = entry.models
                    }
                }
                setPlanAllowedModels(allowedMap)
                // Return tuple so next .then() can access allowedMap from closure
                return { allProviders: [...(data.byok || []), ...(data.plan || [])], allowedMap }
            })
            .catch(() => {
                // Fallback: use same APIs as channel setup page
                return Promise.all([
                    fetch('/api/user/api-keys').then(r => r.json()).catch(() => []),
                    fetch('/api/user/ai-providers').then(r => r.json()).catch(() => []),
                ]).then(([keys, platforms]) => {
                    const userKeys = Array.isArray(keys) ? keys : []
                    const byok = userKeys
                        .filter((k: { provider: string }) => IMAGE_PROVIDERS.includes(k.provider))
                        .map((k: { provider: string; name: string }) => ({
                            provider: k.provider,
                            name: k.name || k.provider.charAt(0).toUpperCase() + k.provider.slice(1),
                            source: 'byok' as const,
                        }))
                    setByokProviders(byok)

                    const platformList = Array.isArray(platforms) ? platforms : []
                    const planList = platformList
                        .filter((p: { provider: string; status: string }) => IMAGE_PROVIDERS.includes(p.provider) && p.status === 'ACTIVE')
                        .map((p: { provider: string; name: string }) => ({
                            provider: p.provider,
                            name: p.name || p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
                            source: 'plan' as const,
                        }))
                    setPlanProviders(planList)
                    return { allProviders: [...byok, ...planList], allowedMap: {} as Record<string, string[]> }
                })
            })
            .then(({ allProviders, allowedMap }: { allProviders: { provider: string; name: string; source: string }[]; allowedMap: Record<string, string[]> }) => {
                // Auto-select first available provider (use prefixed value so keySource is sent correctly)
                let currentProvider = overrideImageProvider || ''
                if (!currentProvider && allProviders.length > 0) {
                    const first = allProviders[0]
                    // Store with source prefix: 'plan:runware' or 'byok:runware'
                    currentProvider = `${first.source}:${first.provider}`
                    setOverrideImageProvider(currentProvider)
                }
                // Fetch models for selected provider
                // NOTE: params come from closure — allowedMap is passed via .then chain below
                if (currentProvider) {
                    const parts = currentProvider.split(':')
                    const isPlan = parts[0] === 'plan'
                    const providerName = parts.length > 1 ? parts.slice(1).join(':') : parts[0]
                    if (isPlan) {
                        // Plan: fetch models from platform API Hub key (server handles whitelist + key)
                        setLoadingImageModels(true)
                        fetch('/api/admin/posts/plan-models', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: providerName }),
                        }).then(r => r.json()).then(d => {
                            const models = (d.models || []).map((m: { id: string; name?: string }) => ({
                                id: m.id,
                                name: m.name || MODEL_DISPLAY_NAMES[m.id] || m.id,
                                type: 'image' as const,
                            }))
                            setAvailableImageModels(models)
                        }).catch(() => { }).finally(() => setLoadingImageModels(false))
                    } else {
                        setLoadingImageModels(true)
                        fetch('/api/user/api-keys/models', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: providerName }),
                        }).then(r => r.json()).then(d => {
                            setAvailableImageModels(
                                (d.models || []).filter((m: { type?: string }) => m.type === 'image')
                            )
                        }).catch(() => { }).finally(() => setLoadingImageModels(false))
                    }
                }
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showImagePicker])

    // ── Restore branding from localStorage + fetch AI image history when dialog opens ──
    useEffect(() => {
        if (!showImagePicker || !selectedChannel) return
        // Restore branding panel
        try {
            const saved = localStorage.getItem(`studio-branding-${selectedChannel.id}`)
            if (saved) {
                const b = JSON.parse(saved)
                if (b.logoDataUrl) setBrandLogoDataUrl(b.logoDataUrl)
                if (typeof b.position === 'number') setBrandLogoPosition(b.position)
                if (typeof b.opacity === 'number') setBrandLogoOpacity(b.opacity)
                if (typeof b.enabled === 'boolean') setBrandingEnabled(b.enabled)
            }
        } catch { /* ignore */ }
        // Fetch AI-generated image history
        setLoadingAiHistory(true)
        fetch(`/api/admin/media?channelId=${selectedChannel.id}&source=ai&limit=20&sort=newest`)
            .then(r => r.ok ? r.json() : { media: [] })
            .then(d => setAiHistoryMedia(d.media || []))
            .catch(() => { })
            .finally(() => setLoadingAiHistory(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showImagePicker])

    // ── Auto-fetch Pinterest boards when Pinterest is selected ──
    useEffect(() => {

        const hasPinterest = activePlatforms.some(p => selectedPlatformIds.has(p.id) && p.platform === 'pinterest')
        if (!hasPinterest || !selectedChannel || pinBoardsLoading) return
        // Skip if already fetched and no reconnect needed
        if (pinBoards.length > 0 && !pinNeedsReconnect) return
        const pintPlatform = activePlatforms.find(p => selectedPlatformIds.has(p.id) && p.platform === 'pinterest')
        if (!pintPlatform) return
        setPinBoardsLoading(true)
        fetch(`/api/admin/channels/${selectedChannel.id}/pinterest-boards?accountId=${pintPlatform.accountId}`)
            .then(r => r.json())
            .then(data => {
                if (data.needsReconnect) { setPinNeedsReconnect(true); return }
                if (data.boards) { setPinNeedsReconnect(false); setPinBoards(data.boards) }
            })
            .catch(() => { })
            .finally(() => setPinBoardsLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChannel, selectedPlatformIds])


    // Get active platforms from selected channel
    const activePlatforms = selectedChannel?.platforms || []

    // ─── Instagram media validation ────────────────────────
    const igValidation = useMemo(() => {
        const isIgSelected = selectedChannel?.platforms?.some(p => p.platform === 'instagram' && selectedPlatformIds.has(p.id))
        if (!isIgSelected) return { errors: [], warnings: [] }

        const errors: string[] = []
        const warnings: string[] = []
        const unsupportedFormats = ['.webp', '.bmp', '.svg', '.tiff', '.tif', '.gif']

        // Check if media is attached
        if (attachedMedia.length === 0) {
            errors.push('Instagram requires at least one image or video.')
            return { errors, warnings }
        }

        const hasVideo = attachedMedia.some(m => isVideo(m))
        const hasImage = attachedMedia.some(m => !isVideo(m))

        // Check unsupported formats
        for (const media of attachedMedia) {
            const name = (media.originalName || media.url || '').toLowerCase()
            const bad = unsupportedFormats.find(fmt => name.endsWith(fmt))
            if (bad) {
                errors.push(`"${media.originalName || 'File'}" is ${bad.replace('.', '').toUpperCase()} format — Instagram only supports JPEG and PNG.`)
            }
            // Warn about unsupported video formats (Instagram supports MP4 and MOV with H.264)
            if (isVideo(media)) {
                const unsupportedVideoFmts = ['.avi', '.mkv', '.wmv', '.webm', '.flv', '.3gp']
                const videoFmt = unsupportedVideoFmts.find(fmt => name.endsWith(fmt))
                if (videoFmt) {
                    warnings.push(`"${media.originalName || 'Video'}" is ${videoFmt.replace('.', '').toUpperCase()} format — Instagram only supports MP4 or MOV (H.264). This may cause upload failures.`)
                }
            }
        }

        // ─── Aspect ratio validation ─────────────────────────
        if (igPostType === 'reel') {
            if (!hasVideo) {
                errors.push('Reels require a video. Please attach an MP4 video file.')
            }
            if (mediaRatio === '16:9') {
                errors.push('Reels require vertical video (9:16). Your video is 16:9 (landscape) — please change aspect ratio to 9:16 or switch to Feed post type.')
            }
            if (mediaRatio === '1:1') {
                warnings.push('Reels work best with 9:16 (vertical). Square (1:1) is supported but not ideal.')
            }
            if (attachedMedia.length > 1) {
                warnings.push('Reels only use the first video — extra media will be ignored.')
            }
        } else if (igPostType === 'story') {
            if (mediaRatio === '16:9') {
                errors.push('Stories require vertical media (9:16). Your media is 16:9 (landscape) — please change aspect ratio to 9:16.')
            }
            if (mediaRatio === '1:1') {
                warnings.push('Stories work best with 9:16 (vertical). Square (1:1) will have black bars.')
            }
            if (attachedMedia.length > 1) {
                warnings.push('Story only uses the first media item.')
            }
        } else {
            // Feed post
            if (hasVideo && attachedMedia.length === 1) {
                if (mediaRatio === '16:9') {
                    errors.push('Instagram feed videos are posted as Reels, which require vertical (9:16) or square (1:1). Your video is 16:9 (landscape) — this will be rejected. Please change aspect ratio or use a different video.')
                } else {
                    warnings.push('Single videos on feed are automatically posted as Reels.')
                }
            }
            // Feed images support 1:1, 4:5, 1.91:1 (16:9-ish)
        }

        return { errors, warnings }
    }, [attachedMedia, igPostType, mediaRatio, selectedChannel, selectedPlatformIds])

    // ─── Facebook media validation ──────────────────────────
    const fbValidation = useMemo(() => {
        const isFbSelected = selectedChannel?.platforms?.some(p => p.platform === 'facebook' && selectedPlatformIds.has(p.id))
        if (!isFbSelected) return { errors: [], warnings: [] }

        const errors: string[] = []
        const warnings: string[] = []

        const selectedFbIds = selectedChannel?.platforms?.filter(p => p.platform === 'facebook' && selectedPlatformIds.has(p.id)).map(p => p.id) || []
        const currentFbType = selectedFbIds.length > 0 ? (fbPostTypes[selectedFbIds[0]] || 'feed') : 'feed'

        const hasVideo = attachedMedia.some(m => isVideo(m))
        const hasImage = attachedMedia.some(m => !isVideo(m))
        const imageCount = attachedMedia.filter(m => !isVideo(m)).length

        if (currentFbType === 'reel') {
            if (!hasVideo) {
                errors.push('Facebook Reels require a video. Please attach an MP4 or MOV video file.')
            }
            if (hasImage && hasVideo) {
                warnings.push('Mixed media: Facebook will use the video only. Images will be ignored for Reels.')
            }
            if (attachedMedia.length > 1 && hasVideo) {
                warnings.push('Reels only use the first video — extra media will be ignored.')
            }
            if (mediaRatio === '16:9') {
                warnings.push('Reels work best in 9:16 (vertical). Your media is landscape (16:9) — consider changing aspect ratio for better reach.')
            }
            if (mediaRatio === '1:1') {
                warnings.push('Reels work best in 9:16 (vertical). Square (1:1) is supported but not ideal.')
            }
        } else if (currentFbType === 'story') {
            if (attachedMedia.length === 0) {
                warnings.push('Stories require at least one image or video.')
            }
            if (attachedMedia.length > 1) {
                warnings.push('Only the first media item will be used for the Story.')
            }
            if (mediaRatio === '16:9') {
                warnings.push('Stories work best in 9:16 (vertical). Your media is 16:9 (landscape) — it will be letterboxed.')
            }
            if (mediaRatio === '1:1') {
                warnings.push('Stories work best in 9:16 (vertical). Square (1:1) will have black bars on top and bottom.')
            }
        }

        return { errors, warnings }
    }, [attachedMedia, fbPostTypes, mediaRatio, selectedChannel, selectedPlatformIds])


    // Toggle platform by unique ID
    const togglePlatform = (platformId: string) => {
        setSelectedPlatformIds((prev) => {
            const next = new Set(prev)
            if (next.has(platformId)) next.delete(platformId)
            else next.add(platformId)
            return next
        })
    }

    // Upload media — 3-step presigned direct-to-R2 flow:
    // 1. POST /api/admin/media/presign → get presignedUrl + mediaItemId
    // 2. PUT presignedUrl directly to R2 with XHR (tracks progress %)
    // 3. PATCH /api/admin/media/{id}/confirm → finalize + trigger bg transcode
    // Falls back to server upload if R2 presign unavailable.
    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || !selectedChannel) return
        setUploading(true)
        let successCount = 0
        const fileArray = Array.from(files)

        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i]
            setUploadingFileName(file.name)
            setUploadProgress(0)

            try {
                // ── Step 1: Get presigned URL ────────────────────────────
                const presignRes = await fetch('/api/admin/media/presign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channelId: selectedChannel.id,
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                    }),
                })

                if (!presignRes.ok) {
                    // R2 not configured — fallback to server upload
                    const err = await presignRes.json().catch(() => ({}))
                    if (err?.error === 'R2 not configured') {
                        // ── Fallback: server-side upload ──────────────────
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('channelId', selectedChannel.id)
                        const media = await new Promise<Record<string, unknown>>((resolve, reject) => {
                            const xhr = new XMLHttpRequest()
                            xhr.upload.onprogress = (e) => {
                                if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
                            }
                            xhr.onload = () => {
                                if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
                                else { try { reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed')) } catch { reject(new Error('Upload failed')) } }
                            }
                            xhr.onerror = () => reject(new Error('Network error'))
                            xhr.open('POST', '/api/admin/media')
                            xhr.send(formData)
                        })
                        setAttachedMedia((prev) => [...prev, media as unknown as (typeof prev)[0]])
                        successCount++
                        continue
                    }
                    throw new Error(err?.error || 'Failed to get upload URL')
                }

                const { presignedUrl, mediaItemId } = await presignRes.json() as { presignedUrl: string; mediaItemId: string; publicUrl: string }

                // ── Step 2: PUT directly to R2 (tracks real upload progress) ──
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest()
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
                    }
                    xhr.onload = () => {
                        // R2 returns 200 for successful PUT
                        if (xhr.status >= 200 && xhr.status < 300) resolve()
                        else reject(new Error(`R2 upload failed: ${xhr.status}`))
                    }
                    xhr.onerror = () => reject(new Error('Network error during R2 upload'))
                    xhr.open('PUT', presignedUrl)
                    xhr.setRequestHeader('Content-Type', file.type)
                    xhr.send(file)
                })

                // ── Step 3: Confirm upload & get final MediaItem ─────────
                const confirmRes = await fetch(`/api/admin/media/${mediaItemId}/confirm`, {
                    method: 'PATCH',
                })
                if (!confirmRes.ok) {
                    const err = await confirmRes.json().catch(() => ({}))
                    throw new Error(err?.error || 'Failed to confirm upload')
                }
                const media = await confirmRes.json()
                setAttachedMedia((prev) => [...prev, media])
                successCount++

            } catch (err: unknown) {
                toast.error(`Upload failed: ${file.name}${err instanceof Error ? ` — ${err.message}` : ''}`)
            }
        }

        setUploadProgress(0)
        setUploadingFileName('')
        setUploading(false)
        if (successCount > 0) toast.success(`${successCount} file(s) uploaded!`)
    }, [selectedChannel])

    // Keep ref updated so async callbacks (like Canva export) always use the latest version
    handleFileUploadRef.current = handleFileUpload

    const removeMedia = (id: string) => {
        setAttachedMedia((prev) => prev.filter((m) => m.id !== id))
    }

    // ── Drag-and-drop reorder for media grid ──────────
    const mediaDndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    )
    const handleMediaDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setAttachedMedia((prev) => {
            const oldIndex = prev.findIndex(m => m.id === active.id)
            const newIndex = prev.findIndex(m => m.id === over.id)
            if (oldIndex === -1 || newIndex === -1) return prev
            return arrayMove(prev, oldIndex, newIndex)
        })
    }

    // Track dimensions of ALL attached media items for validation
    const [mediaDimensions, setMediaDimensions] = useState<Record<string, { w: number; h: number; ratio: number }>>({})
    // Auto-detect dimensions for ALL attached media (and set mediaRatio from first)
    useEffect(() => {
        if (attachedMedia.length === 0) {
            setMediaDimensions({})
            return
        }
        for (let idx = 0; idx < attachedMedia.length; idx++) {
            const media = attachedMedia[idx]
            const isVid = isVideo(media)
            const srcUrl = isVid ? (media.thumbnailUrl || media.url) : media.url
            const fullUrl = srcUrl.startsWith('http') ? srcUrl : `${window.location.origin}${srcUrl}`

            const onDimensions = (w: number, h: number) => {
                if (!w || !h) return
                const ratio = w / h
                console.log(`[AutoRatio] Media "${media.originalName || media.id}" (${idx + 1}/${attachedMedia.length}): ${w}x${h} → ratio ${ratio.toFixed(2)}`)
                setMediaDimensions(prev => ({ ...prev, [media.id]: { w, h, ratio } }))
                // Auto-set the ratio selector from the FIRST media item
                if (idx === 0) {
                    if (ratio > 1.4) setMediaRatio('16:9')
                    else if (ratio < 0.75) setMediaRatio('9:16')
                    else setMediaRatio('1:1')
                }
            }

            if (isVid && !media.thumbnailUrl) {
                const video = document.createElement('video')
                video.preload = 'metadata'
                video.onloadedmetadata = () => {
                    onDimensions(video.videoWidth, video.videoHeight)
                    // Also capture duration and write it back to the MediaItem
                    const dur = video.duration
                    if (dur && isFinite(dur)) {
                        setAttachedMedia(prev => prev.map(m =>
                            m.id === media.id ? { ...m, duration: Math.round(dur) } : m
                        ))
                    }
                    video.src = ''
                }
                video.onerror = () => console.warn(`[AutoRatio] Failed to load video: ${media.originalName}`)
                video.src = fullUrl
            } else {

                const img = new window.Image()
                img.onload = () => onDimensions(img.naturalWidth, img.naturalHeight)
                img.onerror = () => console.warn(`[AutoRatio] Failed to load image: ${media.originalName}`)
                img.src = fullUrl
            }
        }
        // Re-detect when media list changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attachedMedia.map(m => m.id).join(',')])

    // Drag & drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files)
        }
    }, [handleFileUpload])

    // Fetch media library for current channel
    const fetchLibrary = useCallback(async (folderId?: string | null, search?: string) => {
        if (!selectedChannel) return
        setLoadingLibrary(true)
        try {
            const params = new URLSearchParams({ channelId: selectedChannel.id, limit: '50' })
            const fid = folderId !== undefined ? folderId : libFolderId
            if (fid) params.set('folderId', fid)
            else params.set('folderId', 'root')
            const sq = search !== undefined ? search : libSearch
            if (sq) params.set('search', sq)

            // Fetch media + folders in parallel
            const [mediaRes, foldersRes] = await Promise.all([
                fetch(`/api/admin/media?${params}`),
                fetch(`/api/admin/media/folders?channelId=${selectedChannel.id}${fid ? `&parentId=${fid}` : ''}`),
            ])
            const mediaData = await mediaRes.json()
            const foldersData = await foldersRes.json()
            setLibraryMedia(mediaData.media || [])
            setLibFolders(foldersData.folders || [])
        } catch {
            toast.error('Failed to load media library')
        } finally {
            setLoadingLibrary(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChannel, libFolderId, libSearch])

    const openLibrary = useCallback(() => {
        setShowMediaLibrary(true)
        setLibFolderId(null)
        setLibBreadcrumbs([{ id: null, name: 'All Files' }])
        setLibSearch('')
        fetchLibrary(null, '')
    }, [fetchLibrary])

    const navigateLibFolder = useCallback((folderId: string | null, folderName?: string) => {
        if (folderId === null) {
            setLibBreadcrumbs([{ id: null, name: 'All Files' }])
        } else {
            setLibBreadcrumbs(prev => [...prev, { id: folderId, name: folderName || 'Folder' }])
        }
        setLibFolderId(folderId)
        fetchLibrary(folderId)
    }, [fetchLibrary])

    const navigateLibBreadcrumb = useCallback((index: number) => {
        setLibBreadcrumbs(prev => {
            const bc = prev[index]
            setLibFolderId(bc.id)
            fetchLibrary(bc.id)
            return prev.slice(0, index + 1)
        })
    }, [fetchLibrary])

    // Library-specific upload (uploads into current folder)
    const handleLibUpload = useCallback(async (files: FileList | null) => {
        if (!files || !selectedChannel) return
        setLibUploading(true)
        let count = 0
        try {
            for (const file of Array.from(files)) {
                toast.info(`Uploading ${file.name}...`)
                const formData = new FormData()
                formData.append('file', file)
                formData.append('channelId', selectedChannel.id)
                if (libFolderId) formData.append('folderId', libFolderId)
                const res = await fetch('/api/admin/media', { method: 'POST', body: formData })
                if (!res.ok) {
                    const err = await res.json()
                    toast.error(err.error || `Failed: ${file.name}`)
                    continue
                }
                count++
            }
            if (count > 0) {
                toast.success(`${count} file(s) uploaded!`)
                fetchLibrary()
            }
        } finally {
            setLibUploading(false)
        }
    }, [selectedChannel, libFolderId, fetchLibrary])

    // Library rename media
    const handleLibRename = useCallback(async () => {
        if (!libRenameItem || !libRenameName.trim()) return
        try {
            const res = await fetch(`/api/admin/media/${libRenameItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalName: libRenameName.trim() }),
            })
            if (!res.ok) throw new Error()
            setLibraryMedia(prev => prev.map(m => m.id === libRenameItem.id ? { ...m, originalName: libRenameName.trim() } : m))
            toast.success('Renamed!')
            setLibRenameItem(null)
        } catch {
            toast.error('Rename failed')
        }
    }, [libRenameItem, libRenameName])

    // Library create folder
    const handleLibCreateFolder = useCallback(async () => {
        if (!libNewFolderName.trim() || !selectedChannel) return
        try {
            const res = await fetch('/api/admin/media/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: libNewFolderName.trim(), channelId: selectedChannel.id, parentId: libFolderId }),
            })
            if (!res.ok) throw new Error()
            toast.success('Folder created!')
            setLibNewFolderName('')
            setLibShowNewFolder(false)
            fetchLibrary()
        } catch {
            toast.error('Failed to create folder')
        }
    }, [libNewFolderName, selectedChannel, libFolderId, fetchLibrary])

    // Google Picker API — opens Google's native file picker
    const openGooglePicker = useCallback(async () => {
        setLoadingDrivePicker(true)
        try {
            // 1. Get picker config (access token + client ID)
            const configRes = await fetch('/api/user/gdrive/picker-config')
            if (!configRes.ok) {
                const err = await configRes.json()
                toast.error(err.error || 'Google Drive not connected. Connect in API Keys page.')
                setLoadingDrivePicker(false)
                return
            }
            const { accessToken, appId } = await configRes.json()

            // 2. Load Google Picker script if not loaded
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const win = window as any
            if (!win.google?.picker) {
                await new Promise<void>((resolve, reject) => {
                    if (document.getElementById('google-picker-script')) {
                        const check = setInterval(() => {
                            if (win.google?.picker) { clearInterval(check); resolve() }
                        }, 100)
                        setTimeout(() => { clearInterval(check); reject(new Error('Timeout')) }, 10000)
                        return
                    }
                    const script = document.createElement('script')
                    script.id = 'google-picker-script'
                    script.src = 'https://apis.google.com/js/api.js'
                    script.onload = () => {
                        win.gapi.load('picker', { callback: () => resolve() })
                    }
                    script.onerror = () => reject(new Error('Failed to load Google Picker'))
                    document.head.appendChild(script)
                })
            }

            // 3. Build and show picker with folder navigation
            const gPicker = win.google.picker

            // Create a view that shows images & videos BUT with folder navigation
            const docsView = new gPicker.DocsView()
                .setIncludeFolders(true)
                .setSelectFolderEnabled(false)
                .setMimeTypes('image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime,video/avi,video/webm')

            const picker = new gPicker.PickerBuilder()
                .addView(docsView)
                .setOAuthToken(accessToken)
                .setAppId(appId)
                .enableFeature(gPicker.Feature.MULTISELECT_ENABLED)
                .setMaxItems(10)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .setCallback((data: any) => {
                    if (data.action === gPicker.Action.PICKED && data.docs) {
                        if (!selectedChannel) {
                            toast.error('Please select a channel first')
                            return
                        }
                        const channelId = selectedChannel.id
                        for (const doc of data.docs) {
                            if (attachedMedia.some((m: { id: string }) => m.id === doc.id)) continue

                            const placeholderId = `drive-import-${doc.id}`

                            // Show loading spinner immediately — replace when R2 URL ready
                            setAttachedMedia(prev => [...prev, {
                                id: placeholderId,
                                url: '',
                                thumbnailUrl: null,
                                type: doc.mimeType?.startsWith('video/') ? 'video' : 'image',
                                originalName: doc.name,
                                isCanvaLoading: true,
                                canvaError: null,
                            }])

                            // Download via server (picker token) → upload to R2 → public URL
                            // pickerToken is passed directly so the server can bypass scope limitations
                            fetch('/api/user/gdrive/import-file', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    fileId: doc.id,
                                    mimeType: doc.mimeType,
                                    fileName: doc.name,
                                    channelId,
                                    pickerToken: accessToken,
                                }),
                            })
                                .then(async res => {
                                    const body = await res.json().catch(() => ({}))
                                    if (!res.ok) throw new Error(body.error || `Import failed (${res.status})`)
                                    // Replace placeholder with real MediaItem (has proper R2 thumbnailUrl)
                                    setAttachedMedia(prev => prev.map(m => m.id === placeholderId ? body : m))
                                })
                                .catch(err => {
                                    toast.error(`Failed to import "${doc.name}": ${err.message}`)
                                    setAttachedMedia(prev => prev.filter(m => m.id !== placeholderId))
                                })
                        }
                        toast.success(`Importing ${data.docs.length} file${data.docs.length > 1 ? 's' : ''} from Drive…`)
                    }
                })
                .build()
            picker.setVisible(true)
        } catch (error) {
            console.error('Google Picker error:', error)
            toast.error('Failed to open Google Drive picker')
        }
        setLoadingDrivePicker(false)
    }, [attachedMedia, selectedChannel])


    // ─── Canva design handler ────────────────────────────────────
    const openCanvaDesign = useCallback(async (existingMediaUrl?: string, existingMediaId?: string) => {
        if (canvaLoading) return // prevent double-click
        const channel = selectedChannelRef.current
        if (!channel?.id) { toast.error('Please select a channel first'); return }
        const channelId = channel.id
        setCanvaLoading(true)
        try {
            // Determine dimensions from current ratio
            const dims = mediaRatio === '16:9' ? { width: 1920, height: 1080 }
                : mediaRatio === '9:16' ? { width: 1080, height: 1920 }
                    : { width: 1080, height: 1080 }

            const res = await fetch('/api/canva/designs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    designType: 'custom',
                    width: dims.width,
                    height: dims.height,
                    title: `${branding.appName} Design ${new Date().toLocaleDateString()}`,
                    ...(existingMediaUrl ? { imageUrl: existingMediaUrl } : {}),
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                // Token expired (refresh token also failed) — show reconnect modal
                if (data.error === 'canva_token_expired' && data.reconnectUrl) {
                    setCanvaExpiredModal({ reconnectUrl: data.reconnectUrl })
                    setCanvaLoading(false)
                    return
                }
                // If user hasn't connected Canva yet, redirect to OAuth
                if (data.error === 'canva_not_connected' && data.connectUrl) {
                    toast('🎨 Connecting to Canva...', { icon: '🔗' })
                    window.location.href = data.connectUrl
                    return
                }
                toast.error(data.message || data.error || 'Failed to open Canva')
                setCanvaLoading(false)
                return
            }

            if (!data.editUrl) {
                toast.error('No Canva editor URL returned')
                setCanvaLoading(false)
                return
            }

            // Open Canva editor in popup
            const popup = window.open(data.editUrl, 'canva-editor', 'width=1200,height=800,menubar=no,toolbar=no')
            toast.success(existingMediaUrl
                ? '🎨 Editing image in Canva! Close the tab when done.'
                : '🎨 Canva editor opened! Close the tab when done to import your design.'
            )

            // Poll for popup close OR popup returning to our domain
            let exported = false

            // Helper: write status page into the popup
            const writePopupStatus = (win: Window, status: 'loading' | 'success' | 'error', message: string) => {
                try {
                    const icon = status === 'loading' ? '⏳' : status === 'success' ? '✅' : '❌'
                    const spinnerCSS = status === 'loading' ? `
                        .spinner { width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 24px; }
                        @keyframes spin { to { transform: rotate(360deg); } }
                    ` : ''
                    const closeBtn = status !== 'loading' ? `
                        <button onclick="window.close()" style="margin-top:24px;padding:12px 32px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-weight:600;transition:background 0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                            Close Window
                        </button>
                    ` : '<p style="color:#9ca3af;font-size:14px;margin-top:12px;">Please keep this window open...</p>'

                    win.document.open()
                    win.document.write(`<!DOCTYPE html><html><head><title>${branding.appName} × Canva</title><style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { background: #0d0f14; color: #e7e9ea; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
                        .container { padding: 48px 56px; max-width: 500px; }
                        .logos { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 32px; }
                        .logo-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
                        .logo-wrap img { width: 52px; height: 52px; border-radius: 14px; object-fit: contain; }
                        .logo-name { font-size: 13px; font-weight: 600; color: #9ca3af; letter-spacing: 0.03em; }
                        .link-badge {
                          display: flex; align-items: center; justify-content: center;
                          width: 32px; height: 32px; margin: 0 10px; margin-bottom: 22px;
                          border-radius: 50%; background: #1e2330; border: 1px solid #2d3447;
                        }
                        .link-badge svg { width: 14px; height: 14px; color: #6b7280; }
                        .canva-logo { width: 52px; height: 52px; border-radius: 14px; background: #7d2ae8; display: flex; align-items: center; justify-content: center; }
                        .message { font-size: 17px; font-weight: 600; line-height: 1.5; color: #f3f4f6; margin-bottom: 8px; }
                        .sub { font-size: 13px; color: #6b7280; }
                        ${spinnerCSS}
                        .spinner { margin: 24px auto 20px; }
                        .icon { font-size: 40px; margin: 20px 0 16px; }
                    </style></head><body>
                        <div class="container">
                            <div class="logos">
                                <div class="logo-wrap">
                                    <img src="${branding.logoUrl}" alt="${branding.appName}" />
                                    <span class="logo-name">${branding.appName}</span>
                                </div>
                                <div class="link-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                                </div>
                                <div class="logo-wrap">
                                    <img src="/CIRCLE LOGO - GRADIENT - RGB.svg" alt="Canva" />
                                    <span class="logo-name">Canva</span>
                                </div>
                            </div>
                            ${status === 'loading' ? '<div class="spinner"></div>' : `<div class="icon">${icon}</div>`}
                            <p class="message">${message}</p>
                            ${closeBtn}
                        </div>
                    </body></html>`)
                    win.document.close()
                } catch {
                    // Can't write to popup (cross-origin or closed)
                }
            }

            // Unique ID for this import's placeholder in the media grid
            const placeholderIdRef = existingMediaId
                ? existingMediaId  // editing existing image → reuse its slot
                : `canva-placeholder-${Date.now()}`

            // Insert or update the placeholder item in the media list
            const setPlaceholderLoading = () => {
                setAttachedMedia((prev) => {
                    const placeholder: MediaItem = {
                        id: placeholderIdRef,
                        url: '',
                        thumbnailUrl: null,
                        type: 'image',
                        originalName: null,
                        isCanvaLoading: true,
                        canvaError: null,
                    }
                    // Replace if slot already exists (edit mode OR retry of failed import)
                    const alreadyExists = prev.some(m => m.id === placeholderIdRef || m.id === existingMediaId)
                    if (alreadyExists) {
                        return prev.map((m) =>
                            (m.id === placeholderIdRef || m.id === existingMediaId) ? placeholder : m
                        )
                    }
                    // Brand-new import — append placeholder
                    return [...prev, placeholder]
                })
            }

            const setPlaceholderError = (errMsg: string, retryFn: () => void) => {
                setAttachedMedia((prev) =>
                    prev.map((m) => m.id === placeholderIdRef
                        ? { ...m, isCanvaLoading: false, canvaError: errMsg, canvaRetryFn: retryFn }
                        : m
                    )
                )
            }

            const replacePlaceholderWithMedia = (newMedia: MediaItem) => {
                setAttachedMedia((prev) =>
                    prev.map((m) => m.id === placeholderIdRef ? newMedia : m)
                )
            }

            const triggerExport = async () => {
                if (exported) return // prevent double-trigger
                exported = true

                // 1) Close the popup immediately — user doesn't need to wait on it
                if (popup && !popup.closed) {
                    try { popup.close() } catch { /* ignore */ }
                }

                // 2) Show branded placeholder in compose grid right away
                setPlaceholderLoading()
                toast.loading('Importing from Canva...', { id: 'canva-export' })

                // Give Canva 5 seconds to save the design before exporting
                await new Promise(r => setTimeout(r, 5000))

                const doExport = async (): Promise<void> => {
                    // Retry up to 5 times with delays
                    for (let attempt = 0; attempt < 5; attempt++) {
                        try {
                            const exportRes = await fetch(`/api/canva/designs?designId=${data.designId}&channelId=${encodeURIComponent(channelId)}`)
                            console.log('Canva export API response status:', exportRes.status)
                            const exportData = await exportRes.json()

                            // Token expired during export — show reconnect modal
                            if (exportRes.status === 401 && exportData.error === 'canva_token_expired') {
                                toast.dismiss('canva-export')
                                setCanvaExpiredModal({ reconnectUrl: exportData.reconnectUrl })
                                setAttachedMedia(prev => prev.filter(m => m.id !== placeholderIdRef))
                                setCanvaLoading(false)
                                return
                            }
                            console.log('Canva export API data:', {
                                status: exportData.status,
                                hasBase64: !!exportData.imageBase64,
                                base64Length: exportData.imageBase64?.length || 0,
                                urlsCount: exportData.urls?.length || 0,
                                error: exportData.error,
                            })

                            if (exportData.status === 'media_ready') {
                                // Server uploaded all pages to R2 — pages is always an array
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const pages: any[] = exportData.pages ?? (exportData.media ? [exportData.media] : [])
                                if (pages.length === 0) break // treat as failed attempt

                                const [firstPage, ...restPages] = pages
                                // Slot first page into the existing placeholder
                                replacePlaceholderWithMedia(firstPage)
                                // Append additional pages directly to the media list
                                if (restPages.length > 0) {
                                    setAttachedMedia(prev => [...prev, ...restPages])
                                }
                                const label = pages.length > 1
                                    ? `🎨 Imported ${pages.length} pages from Canva!`
                                    : '🎨 Canva design imported!'
                                toast.success(label, { id: 'canva-export' })
                                // Warn if server capped the page count
                                if (exportData.truncated) {
                                    toast(`⚠️ Only ${exportData.truncated.imported} of ${exportData.truncated.total} pages imported (max 20).`, {
                                        duration: 6000,
                                        style: { background: '#92400e', color: '#fef3c7' },
                                    })
                                }
                                setCanvaLoading(false)
                                return
                            }

                            if (exportData.status === 'success') {
                                let blob: Blob | null = null

                                // Prefer server-proxied base64 (avoids CORS issues)
                                if (exportData.imageBase64) {
                                    console.log('Decoding base64 image...')
                                    const binary = atob(exportData.imageBase64)
                                    const bytes = new Uint8Array(binary.length)
                                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
                                    blob = new Blob([bytes], { type: exportData.contentType || 'image/png' })
                                    console.log('Blob created, size:', blob.size)
                                } else if (exportData.urls?.length > 0) {
                                    // Fallback: try fetching URL directly
                                    try {
                                        const imgRes = await fetch(exportData.urls[0])
                                        if (imgRes.ok) blob = await imgRes.blob()
                                    } catch { /* CORS likely blocked */ }
                                }

                                if (blob && blob.size > 0) {
                                    const file = new File([blob], `canva-design-${Date.now()}.png`, { type: 'image/png' })

                                    // Upload the file to the server
                                    const formData = new FormData()
                                    formData.append('file', file)
                                    formData.append('channelId', channelId)

                                    fetch(`/api/canva/designs?_debug=1&step=uploading&channelId=${channelId}&fileSize=${file.size}&mediaId=${placeholderIdRef}`).catch(() => { })

                                    const uploadRes = await fetch('/api/admin/media', {
                                        method: 'POST',
                                        body: formData,
                                    })

                                    fetch(`/api/canva/designs?_debug=1&step=upload_result&status=${uploadRes.status}&ok=${uploadRes.ok}`).catch(() => { })

                                    if (uploadRes.ok) {
                                        const newMedia = await uploadRes.json()
                                        fetch(`/api/canva/designs?_debug=1&step=media_received&mediaId=${newMedia.id}`).catch(() => { })

                                        // 3) Replace placeholder with real media
                                        replacePlaceholderWithMedia(newMedia)
                                        toast.success('🎨 Canva design imported!', { id: 'canva-export' })
                                        setCanvaLoading(false)
                                        return
                                    } else {
                                        const err = await uploadRes.json().catch(() => ({}))
                                        const errMsg = err.error || 'Upload failed'
                                        fetch(`/api/canva/designs?_debug=1&step=upload_failed&error=${encodeURIComponent(errMsg)}`).catch(() => { })
                                        toast.dismiss('canva-export')
                                        // 4a) Switch placeholder to error state with retry button
                                        setPlaceholderError(errMsg, () => { setPlaceholderLoading(); doExport() })
                                        setCanvaLoading(false)
                                        return
                                    }
                                }
                                // Blob empty — try next attempt
                                console.warn('Canva export blob was empty, attempt:', attempt + 1)
                            }

                            // Not success yet — retry
                            if (attempt < 4) {
                                toast.loading(`Importing... (${attempt + 2}/5)`, { id: 'canva-export' })
                                await new Promise(r => setTimeout(r, 4000))
                            }
                        } catch (err: unknown) {
                            const errMsg = err instanceof Error ? err.message : String(err)
                            console.error('Canva export attempt error:', errMsg, err)
                            if (attempt < 4) {
                                await new Promise(r => setTimeout(r, 4000))
                            }
                        }
                    }

                    // All retries exhausted
                    toast.dismiss('canva-export')
                    // 4b) Switch placeholder to error state with retry button
                    setPlaceholderError('Export failed after retries. Tap Retry.', () => { setPlaceholderLoading(); doExport() })
                    setCanvaLoading(false)
                }

                await doExport()
            }

            let returnedToApp = false // true ONLY when popup navigates to our domain (user clicked "Return to NeeFlow")

            const checkClosed = setInterval(async () => {
                if (exported) { clearInterval(checkClosed); return }

                // Case 1: Popup navigated back to our domain → user clicked "Return to NeeFlow"
                try {
                    if (popup && popup.location && popup.location.hostname === window.location.hostname) {
                        returnedToApp = true
                        clearInterval(checkClosed)
                        await triggerExport()
                        return
                    }
                } catch {
                    // Cross-origin — popup still on canva.com, not ready yet
                }

                // Case 2: Popup closed — check HOW it was closed
                if (popup && popup.closed) {
                    clearInterval(checkClosed)
                    if (returnedToApp) {
                        // Already handled above (race: popup closed right after navigation)
                        if (!exported) await triggerExport()
                    } else {
                        // User clicked native X — cancel silently, remove any loading placeholder
                        setAttachedMedia(prev => prev.filter(m => m.id !== placeholderIdRef))
                        setCanvaLoading(false)
                        console.log('Canva popup closed via X — export cancelled')
                    }
                    return
                }
            }, 1000)

            // Timeout after 10 minutes
            setTimeout(() => {
                clearInterval(checkClosed)
                if (popup && !popup.closed) popup.close()
                setCanvaLoading(false)
            }, 600000)
        } catch {
            toast.error('Failed to open Canva')
            setCanvaLoading(false)
        }
    }, [mediaRatio])

    const addFromLibrary = (media: MediaItem) => {
        if (attachedMedia.some((m) => m.id === media.id)) {
            toast.error('Already added')
            return
        }
        setAttachedMedia((prev) => [...prev, media])
    }

    // Fetch AI topic suggestions
    const fetchSuggestions = useCallback(async () => {
        if (!selectedChannel) return
        setLoadingSuggestions(true)
        try {
            const res = await fetch('/api/admin/posts/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: selectedChannel.id }),
            })
            const data = await res.json()
            if (res.ok && data.suggestions) {
                setSuggestions(data.suggestions)
            } else {
                toast.error(data.error || 'Failed to get suggestions')
            }
        } catch { toast.error('Failed to fetch suggestions') }
        finally { setLoadingSuggestions(false) }
    }, [selectedChannel])

    // Fetch trending news
    const fetchTrending = useCallback(async (cat?: string) => {
        if (!selectedChannel) return
        const category = cat || trendingCategory
        setLoadingTrending(true)
        try {
            const res = await fetch('/api/admin/posts/trending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: selectedChannel.id, category }),
            })
            const data = await res.json()
            if (data.articles) {
                setTrendingArticles(data.articles)
                if (data.keywords) setTrendingKeywords(data.keywords)
            } else {
                toast.error('No articles found')
            }
        } catch { toast.error('Failed to fetch trending news') }
        finally { setLoadingTrending(false) }
    }, [selectedChannel, trendingCategory])

    // AI Generate
    const handleGenerate = async () => {
        if (!selectedChannel || !aiTopic.trim()) {
            toast.error('Enter a topic or paste an article link for AI generation')
            return
        }
        setGenerating(true)
        try {
            const platforms = activePlatforms
                .filter((p) => selectedPlatformIds.has(p.id))
                .map((p) => p.platform)
            const res = await fetch('/api/admin/posts/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannel.id,
                    topic: aiTopic,
                    platforms,
                    includeSourceLink,
                    includeBusinessInfo,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Generation failed')
                return
            }
            setContent(data.content || '')

            // Populate per-platform content if returned
            if (data.contentPerPlatform && Object.keys(data.contentPerPlatform).length > 0) {
                setContentPerPlatform(data.contentPerPlatform)
                const platforms = activePlatforms
                    .filter((p) => selectedPlatformIds.has(p.id))
                    .map((p) => p.platform)
                const uniquePlats = [...new Set(platforms)]
                const firstPlatform = uniquePlats.find(p => data.contentPerPlatform[p])
                    || Object.keys(data.contentPerPlatform)[0]
                if (firstPlatform) {
                    setActiveContentTab(firstPlatform)
                    // If main content is empty or only hashtags, use first platform's content
                    const mainContent = data.content || ''
                    const isOnlyHashtags = mainContent.trim().split(/\s+/).every((w: string) => w.startsWith('#'))
                    if (!mainContent.trim() || isOnlyHashtags) {
                        setContent(data.contentPerPlatform[firstPlatform])
                    }
                }
                toast.success(`✨ Content generated for ${Object.keys(data.contentPerPlatform).length} platform(s)!`)
            } else if (data.articlesFetched > 0) {
                toast.success(`Content generated from ${data.articlesFetched} article(s)!`)
            } else {
                toast.success('Content generated!')
            }

            // Set visual idea for image generation
            if (data.visualIdea) {
                setVisualIdea(data.visualIdea)
                setAiImagePrompt(data.visualIdea)
            }

            // Save applied context metadata
            if (data.appliedContext) {
                setAppliedContext(data.appliedContext)
            }

            // Auto-download and attach article images (og:image) when generating from URL
            if (data.imageUrls && data.imageUrls.length > 0 && selectedChannel) {
                for (const imgUrl of data.imageUrls.slice(0, 3)) {
                    try {
                        const uploadRes = await fetch('/api/admin/media/from-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: imgUrl, channelId: selectedChannel.id }),
                        })
                        if (uploadRes.ok) {
                            const media = await uploadRes.json()
                            if (media && media.id) {
                                setAttachedMedia((prev) => {
                                    if (prev.some((m) => m.id === media.id)) return prev
                                    return [...prev, media]
                                })
                            }
                        }
                    } catch { /* skip failed image download */ }
                }
                toast.success('Article images attached!')
            }
        } catch { toast.error('AI generation failed — check your AI API key in API Hub') }
        finally { setGenerating(false) }
    }

    // AI Image Generation — generates image in background, auto-attaches to post
    const handleAiImageGenerate = async () => {
        if (!selectedChannel || (!aiImagePrompt.trim() && !useContentAsPrompt)) return
        setGeneratingImage(true)
        setAiGeneratedPreview(null)

        // Build prompt — inject style + typography
        let promptToUse = useContentAsPrompt && content.trim() ? content.substring(0, 500) : aiImagePrompt
        if (selectedStyle) promptToUse = `${promptToUse}, ${selectedStyle} style`
        if (typoText.trim()) promptToUse = `${promptToUse}, with the text "${typoText}" rendered in ${typoFont} font integrated naturally into the design`

        const aspectDims: Record<string, [number, number]> = {
            '1:1': [1024, 1024], '16:9': [1280, 768], '9:16': [768, 1280],
            '4:3': [1024, 768], '3:4': [768, 1024], '4:5': [832, 1024],
        }
        const [w, h] = aspectDims[imageAspectRatio] || [1024, 1024]
        const body: Record<string, unknown> = { channelId: selectedChannel.id, prompt: promptToUse, width: w, height: h }
        if (overrideImageProvider) {
            const parts = overrideImageProvider.split(':')
            if (parts.length > 1) {
                body.keySource = parts[0]           // 'byok' or 'plan'
                body.provider = parts.slice(1).join(':')
            } else {
                body.provider = parts[0]
            }
        }
        if (overrideImageModel) body.model = overrideImageModel
        // Ref image (image-to-image) — send base64 if model supports it
        if (refImageDataUrl) {
            body.refImageBase64 = refImageDataUrl
            body.imageStrength = refImageStrength / 100  // 0.0–1.0: 1.0 = identical, 0.0 = ignore
        }

        // Close modal immediately and show placeholder in media grid
        setShowImagePicker(false)
        setAiImageBgGenerating(true)
        setGeneratingImage(false)

        try {
            const res = await fetch('/api/admin/posts/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            let finalMediaItem = data.mediaItem

            // ── Client-side Watermark via Canvas ──────────────────────────────
            if (brandingEnabled && brandLogoDataUrl && finalMediaItem?.url) {
                try {
                    const canvas = document.createElement('canvas')
                    const ctx = canvas.getContext('2d')
                    if (ctx) {
                        // Load generated image
                        const genImg = new window.Image(); genImg.crossOrigin = 'anonymous'
                        await new Promise<void>((resolve, reject) => {
                            genImg.onload = () => resolve(); genImg.onerror = reject
                            genImg.src = finalMediaItem.url
                        })
                        canvas.width = genImg.naturalWidth || 1024
                        canvas.height = genImg.naturalHeight || 1024
                        ctx.drawImage(genImg, 0, 0)

                        // Load logo
                        const logoImg = new window.Image()
                        await new Promise<void>((resolve, reject) => {
                            logoImg.onload = () => resolve(); logoImg.onerror = reject
                            logoImg.src = brandLogoDataUrl
                        })

                        // Position based on 3x3 grid (0=TL,1=TC,2=TR, 3=ML,4=MC,5=MR, 6=BL,7=BC,8=BR)
                        const logoSize = Math.round(canvas.width * 0.15)
                        const pad = Math.round(canvas.width * 0.03)
                        const col = brandLogoPosition % 3
                        const row = Math.floor(brandLogoPosition / 3)
                        const x = col === 0 ? pad : col === 2 ? canvas.width - logoSize - pad : (canvas.width - logoSize) / 2
                        const y = row === 0 ? pad : row === 2 ? canvas.height - logoSize - pad : (canvas.height - logoSize) / 2

                        ctx.globalAlpha = brandLogoOpacity / 100
                        ctx.drawImage(logoImg, x, y, logoSize, logoSize)
                        ctx.globalAlpha = 1

                        // Export as blob and re-upload
                        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
                        if (blob) {
                            const formData = new FormData()
                            formData.append('file', blob, 'ai-branded.png')
                            formData.append('channelId', selectedChannel.id)
                            const uploadRes = await fetch('/api/admin/media', { method: 'POST', body: formData })
                            if (uploadRes.ok) {
                                const uploadData = await uploadRes.json()
                                finalMediaItem = uploadData.mediaItem || uploadData
                            }
                        }
                    }
                } catch { /* watermark failed silently, use original */ }
            }

            // Auto-attach the (possibly watermarked) media item
            addFromLibrary(finalMediaItem)
            setAiGeneratedPreview(finalMediaItem.url || finalMediaItem.thumbnailUrl)
            setLastUsedImageModel(data.model || data.provider)
            // Refresh AI history
            if (selectedChannel) {
                fetch(`/api/admin/media?channelId=${selectedChannel.id}&source=ai&limit=20&sort=newest`)
                    .then(r => r.ok ? r.json() : { media: [] })
                    .then(d => setAiHistoryMedia(d.media || []))
                    .catch(() => { })
            }
            // Update quota from server response
            if (data.quota) setImageQuota(data.quota)
            // Trigger reveal animation
            setAiImageJustCompleted(true)
            setTimeout(() => setAiImageJustCompleted(false), 2000)
            const modelLabel = data.model || data.provider || 'AI'
            if (data.usingPlatformKey) {
                const quota = data.quota as { used: number; limit: number } | undefined
                const remaining = quota && quota.limit > 0 ? quota.limit - quota.used : null
                const remainingStr = remaining !== null
                    ? ` · ${remaining} image${remaining !== 1 ? 's' : ''} left this month`
                    : ''
                toast.success(`✨ Image generated with ${modelLabel}${remainingStr}`)
            } else {
                toast.success(`✨ Image generated with ${modelLabel}`)
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Image generation failed')
        } finally {
            setAiImageBgGenerating(false)
        }
    }


    // Stock Photo Search via Pexels
    const handleStockSearch = async () => {
        if (!stockQuery.trim()) return
        setSearchingStock(true)
        try {
            const res = await fetch('/api/admin/posts/stock-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'search', query: stockQuery, perPage: 15 }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setStockPhotos(data.photos || [])
            if (data.photos?.length === 0) toast.info('No photos found — try different keywords')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Stock search failed')
        } finally {
            setSearchingStock(false)
        }
    }

    // AI Generate platform metadata (first comment, pin title, yt titles x3, etc.)
    const handleGenerateMetadata = async (requestedPlatforms?: string[]) => {
        if (!selectedChannel || !content.trim()) {
            toast.error('Write your post content first')
            return
        }
        setGeneratingMeta(true)
        try {
            // Determine which platforms to generate for
            const platforms = requestedPlatforms || activePlatforms
                .filter((p) => selectedPlatformIds.has(p.id))
                .map((p) => p.platform)

            const res = await fetch('/api/admin/posts/generate-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: selectedChannel.id, content, platforms, thumbnailStyleId }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Failed to generate metadata')
                return
            }

            // Fill in the generated fields
            let filled = 0
            if (typeof data.firstComment === 'string' && data.firstComment.trim()) { setFbFirstComment(data.firstComment.trim()); filled++ }
            if (data.pinTitle) { setPinTitle(data.pinTitle); filled++ }
            if (data.pinLink) { setPinLink(data.pinLink); filled++ }
            // YouTube: 3 titles
            if (data.ytTitles && Array.isArray(data.ytTitles) && data.ytTitles.length > 0) {
                setYtTitleOptions(data.ytTitles)
                setYtSelectedTitleIdx(0)
                setYtVideoTitle(data.ytTitles[0])
                filled++
            } else if (data.ytTitle) {
                setYtVideoTitle(data.ytTitle)
                setYtTitleOptions([data.ytTitle])
                filled++
            }
            if (data.ytTags) { setYtTags(data.ytTags); filled++ }
            if (data.ytCategory) { setYtCategory(data.ytCategory); filled++ }
            // YouTube: 3 thumbnail prompts
            if (data.ytThumbnailPrompts && Array.isArray(data.ytThumbnailPrompts) && data.ytThumbnailPrompts.length > 0) {
                setYtThumbnailPrompts(data.ytThumbnailPrompts)
                setYtSelectedThumbIdx(0)
                setYtThumbnailPrompt(data.ytThumbnailPrompts[0])
                filled++
            } else if (data.ytThumbnailPrompt) {
                setYtThumbnailPrompt(data.ytThumbnailPrompt)
                setYtThumbnailPrompts([data.ytThumbnailPrompt])
                filled++
            }

            toast.success(`✨ AI filled ${filled} field(s)`)
        } catch {
            toast.error('AI metadata generation failed')
        } finally {
            setGeneratingMeta(false)
        }
    }

    // Standalone: generate ONLY YouTube thumbnail prompts
    const [ytThumbnailLoading, setYtThumbnailLoading] = useState(false)
    const handleGenerateThumbnailPrompt = async () => {
        if (!selectedChannel || !content.trim()) {
            toast.error('Write your post content first')
            return
        }
        setYtThumbnailLoading(true)
        try {
            const res = await fetch('/api/admin/posts/generate-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannel.id,
                    content,
                    platforms: ['youtube'],
                    thumbnailStyleId,
                    thumbnailOnly: true,
                }),
            })
            const data = await res.json()
            if (!res.ok) { toast.error(data.error || 'Failed'); return }
            if (data.ytThumbnailPrompts?.length > 0) {
                setYtThumbnailPrompts(data.ytThumbnailPrompts)
                setYtSelectedThumbIdx(0)
                setYtThumbnailPrompt(data.ytThumbnailPrompts[0])
                toast.success('✨ 3 thumbnail prompts generated')
            } else if (data.ytThumbnailPrompt) {
                setYtThumbnailPrompt(data.ytThumbnailPrompt)
                setYtThumbnailPrompts([data.ytThumbnailPrompt])
                toast.success('✨ Thumbnail prompt generated')
            } else {
                toast.error('No prompt returned')
            }
        } catch {
            toast.error('Thumbnail prompt generation failed')
        } finally {
            setYtThumbnailLoading(false)
        }
    }

    // AI Customize content for each platform
    const handleCustomizeContent = async () => {
        if (!selectedChannel || !content.trim()) {
            toast.error('Write your post content first')
            return
        }
        const platforms = activePlatforms
            .filter((p) => selectedPlatformIds.has(p.id))
            .map((p) => p.platform)
        const uniquePlatforms = [...new Set(platforms)]
        if (uniquePlatforms.length === 0) {
            toast.error('Select at least one platform')
            return
        }
        setCustomizingContent(true)
        try {
            const res = await fetch('/api/admin/posts/customize-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: selectedChannel.id, content, platforms: uniquePlatforms }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Failed to customize content')
                return
            }
            setContentPerPlatform(data.contentPerPlatform || {})
            const firstPlatform = uniquePlatforms.find(p => data.contentPerPlatform?.[p])
            if (firstPlatform) setActiveContentTab(firstPlatform)
            toast.success(`✨ Content customized for ${Object.keys(data.contentPerPlatform || {}).length} platform(s)`)
        } catch {
            toast.error('AI content customization failed')
        } finally {
            setCustomizingContent(false)
        }
    }

    // Build platforms payload from selected IDs
    const buildPlatformsPayload = () => {
        return activePlatforms
            .filter((p) => selectedPlatformIds.has(p.id))
            .map((p) => ({
                platform: p.platform,
                accountId: p.accountId,
                ...(p.platform === 'facebook' ? {
                    postType: fbPostTypes[p.id] || 'feed',
                    carousel: fbCarousel,
                    firstComment: fbFirstComment || undefined,
                } : {}),
                ...(p.platform === 'instagram' ? {
                    postType: igPostType,
                    shareToStory: igShareToStory,
                    collaborators: igCollaborators || undefined,
                } : {}),
                ...(p.platform === 'youtube' ? {
                    postType: ytPostType,
                    videoTitle: ytVideoTitle || undefined,
                    category: ytCategory || undefined,
                    tags: ytTags || undefined,
                    privacy: ytPrivacy,
                    notifySubscribers: ytNotifySubscribers,
                    madeForKids: ytMadeForKids,
                } : {}),
                ...(p.platform === 'tiktok' ? {
                    postType: ttPostType,
                    publishMode: ttPublishMode,
                    visibility: ttVisibility,
                    title: ttTitle || undefined,  // Point 2a: separate title field
                    allowComment: ttAllowComment,
                    allowDuet: ttAllowDuet,
                    allowStitch: ttAllowStitch,
                    commercialDisclosure: ttCommercialDisclosure,
                    yourBrand: ttYourBrand,
                    brandedContent: ttBrandedContent,
                    aiGenerated: ttAiGenerated,
                } : {}),
                ...(p.platform === 'pinterest' ? {
                    boardId: pinBoardId || undefined,
                    pinTitle: pinTitle || undefined,
                    pinLink: pinLink || undefined,
                } : {}),
                mediaRatio,
            }))
    }

    // Save draft (or update existing)
    const handleSaveDraft = async () => {
        const hasPlatformContent = Object.values(contentPerPlatform).some(v => v.trim())
        if (!selectedChannel || (!content.trim() && !hasPlatformContent)) {
            toast.error('Select a channel and add content')
            return
        }
        setSaving(true)
        try {
            let scheduledAt: string | null = null
            if (scheduleDate) {
                // Default time to 09:00 if user picked a date but left time blank
                const time = scheduleTime || '09:00'
                // Interpret date+time as a wall-clock time in the channel's timezone,
                // then convert to UTC for storage.
                const channelTz = (selectedChannel as any)?.timezone || 'UTC'
                const [year, month, day] = scheduleDate.split('-').map(Number)
                const [hour, minute] = time.split(':').map(Number)

                // ── Reliable timezone-to-UTC conversion ─────────────────────────────────
                // Step 1: create a candidate UTC instant with the same numeric values as
                //         the user's local wall-clock time.
                const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))

                // Step 2: format that candidate in channelTz to see what clock it shows.
                //         Use en-CA which outputs unambiguous YYYY-MM-DD — no year truncation.
                const formatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: channelTz,
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false,
                })
                const parts = formatter.formatToParts(candidate)
                const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10)
                const tzYear = get('year'), tzMonth = get('month'), tzDay = get('day')
                const tzHour = get('hour'), tzMinute = get('minute'), tzSecond = get('second')

                // Step 3: offset = tz wall-clock - UTC wall-clock (how far ahead tz is)
                const tzWallMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond)
                const utcWallMs = candidate.getTime()
                const offsetMs = tzWallMs - utcWallMs

                // Step 4: true UTC = user's intended time minus the offset
                scheduledAt = new Date(utcWallMs - offsetMs).toISOString()
            }

            const existingId = editPostId || postIdRef.current
            const url = existingId ? `/api/admin/posts/${existingId}` : '/api/admin/posts'
            const method = existingId ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannel.id,
                    // If no main content but platformContent exists, use first platform's content as preview
                    content: content.trim() || Object.values(contentPerPlatform).find(v => v.trim()) || '',
                    contentPerPlatform: Object.keys(contentPerPlatform).length > 0 ? contentPerPlatform : undefined,
                    status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
                    scheduledAt,
                    mediaIds: attachedMedia.map((m) => m.id),
                    platforms: buildPlatformsPayload(),
                    requestApproval,  // used when channel.requireApproval === 'optional'
                }),
            })
            if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Failed to save'); return }
            const data = await res.json()
            if (!postIdRef.current) postIdRef.current = data.id
            toast.success(scheduledAt ? 'Post scheduled!' : 'Draft saved!')
            savedRef.current = true
            router.push('/dashboard/posts')
        } catch { toast.error('Failed to save') }
        finally { setSaving(false) }
    }

    // ─── Approval flow actions (from client-board) ────────────────────────────
    const [approving, setApproving] = useState(false)
    const [resubmitting, setResubmitting] = useState(false)

    const handleApprove = async () => {
        const postId = editPostId || postIdRef.current
        if (!postId) return
        setApproving(true)
        try {
            const res = await fetch('/api/admin/content-pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve', postId }),
            })
            if (res.ok) {
                toast.success('Post approved!')
                router.back()
            } else {
                const d = await res.json()
                toast.error(d.error || 'Failed to approve')
            }
        } catch {
            toast.error('Network error')
        } finally {
            setApproving(false)
        }
    }

    const handleResubmit = async () => {
        const postId = editPostId || postIdRef.current
        if (!postId) return
        setResubmitting(true)
        try {
            // Step 1: Save content silently (no status change, no navigation)
            if (content.trim()) {
                const saveRes = await fetch(`/api/admin/posts/${postId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: content.trim(),
                        contentPerPlatform: Object.keys(contentPerPlatform).length > 0 ? contentPerPlatform : undefined,
                        mediaIds: attachedMedia.map((m) => m.id),
                        // NOTE: no 'status' field — preserves current status, lets requeue set it
                    }),
                })
                if (!saveRes.ok) {
                    const err = await saveRes.json()
                    toast.error(err.error || 'Failed to save content')
                    return
                }
            }
            // Step 2: Requeue — sets status back to PENDING_APPROVAL (or CLIENT_REVIEW for smartflow)
            const res = await fetch('/api/admin/content-pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'requeue', postId }),
            })
            if (res.ok) {
                toast.success(t('compose.resubmitSuccess'))
                router.back()
            } else {
                const d = await res.json()
                toast.error(d.error || 'Failed to resubmit')
            }
        } catch {
            toast.error('Network error')
        } finally {
            setResubmitting(false)
        }
    }

    const isApprovalMode = editSource === 'client-board' && editPostStatus === 'PENDING_APPROVAL'
    const isResubmitMode = editSource === 'client-board' && editPostStatus === 'REJECTED'

    // Publish now (fire-and-forget — publishes in background on server)
    const handlePublishNow = async () => {
        if (!selectedChannel || !content.trim()) { toast.error('Select a channel and add content'); return }
        if (selectedPlatformIds.size === 0) { toast.error('Select at least one platform'); return }

        // ── TikTok-specific pre-publish checks (Points 1b & 1c) ──
        const selectedPlatforms = activePlatforms.filter(p => selectedPlatformIds.has(p.id))
        const hasTikTok = selectedPlatforms.some(p => p.platform === 'tiktok')
        if (hasTikTok && ttCreatorInfo) {
            if (!ttCreatorInfo.can_post) {
                toast.error('TikTok: This account has reached its posting limit. Please try again later.')
                return
            }
            // Point 1c: check video duration
            if (ttPostType === 'video') {
                const videoItem = attachedMedia.find(m => isVideo(m))
                if (videoItem?.duration && ttCreatorInfo.max_video_post_duration_sec) {
                    if (videoItem.duration > ttCreatorInfo.max_video_post_duration_sec) {
                        const maxMin = Math.ceil(ttCreatorInfo.max_video_post_duration_sec / 60)
                        const vidMin = Math.ceil(videoItem.duration / 60)
                        toast.error(`TikTok: Video too long (${vidMin} min). Your account allows max ${maxMin} min.`)
                        setPublishing(false)
                        return
                    }
                }

            }
        }

        // ── Media validation per platform ──
        const hasVideo = attachedMedia.some(m => isVideo(m))
        const hasImage = attachedMedia.some(m => !isVideo(m))
        const errors: string[] = []

        for (const p of selectedPlatforms) {
            switch (p.platform) {
                case 'tiktok':
                    if (ttPostType === 'video') {
                        if (!hasVideo) errors.push('🎵 TikTok (Video): Please upload a video.')
                        else if (mediaRatio === '16:9') errors.push('🎵 TikTok videos should be vertical (9:16). Landscape videos will be rejected.')
                    } else if (ttPostType === 'carousel') {
                        const imgCount = attachedMedia.filter(m => !isVideo(m)).length
                        if (imgCount < 2) errors.push('🎵 TikTok Carousel requires at least 2 images. Please add more images.')
                    }
                    // Point 2: Privacy must be selected (no default allowed)
                    if (!ttVisibility) errors.push('🎵 TikTok: Please select who can see your post (privacy setting is required).')
                    // Point 4: If commercial disclosure is on, at least one sub-option must be checked
                    if (ttCommercialDisclosure && !ttYourBrand && !ttBrandedContent) errors.push('🎵 TikTok: Please indicate if your content promotes yourself, a third party, or both.')
                    break
                case 'youtube':
                    if (!hasVideo) errors.push('▶️ YouTube requires a video. Please upload a video.')
                    break
                case 'facebook': {
                    const fbType = fbPostTypes[p.id] || 'feed'
                    if (fbType === 'reel' && !hasVideo) errors.push('📘 Facebook Reels require a video.')
                    if (fbType === 'reel' && hasVideo && mediaRatio === '16:9') errors.push('📘 Facebook Reels require vertical video (9:16). Your video is landscape — please change aspect ratio.')
                    if (fbType === 'story' && !hasVideo && !hasImage) errors.push('📘 Facebook Stories require media (image or video).')
                    if (fbType === 'story' && mediaRatio === '16:9') errors.push('📘 Facebook Stories should be vertical (9:16). Landscape media may be cropped.')
                    break
                }
                case 'instagram':
                    if (igPostType === 'reel' && !hasVideo) errors.push('📸 Instagram Reels require a video.')
                    if (igPostType === 'reel' && hasVideo && mediaRatio === '16:9') errors.push('📸 Instagram Reels require vertical video (9:16). Landscape will be rejected.')
                    if (igPostType === 'story' && !hasVideo && !hasImage) errors.push('📸 Instagram Stories require media (image or video).')
                    if (igPostType === 'story' && mediaRatio === '16:9') errors.push('📸 Instagram Stories require vertical (9:16). Landscape will be rejected.')
                    if (igPostType === 'feed' && attachedMedia.length === 0) errors.push('📸 Instagram Feed requires at least one image or video.')
                    if (igPostType === 'feed' && hasVideo && attachedMedia.length === 1 && mediaRatio === '16:9') errors.push('📸 Instagram feed videos become Reels — 16:9 landscape will be rejected. Change ratio to 9:16.')
                    // IG aspect ratio check: all images must be within 4:5 (0.8) to 1.91:1
                    if (igPostType === 'feed' && attachedMedia.length > 0) {
                        for (const m of attachedMedia) {
                            if (isVideo(m)) continue
                            const dims = mediaDimensions[m.id]
                            if (dims) {
                                if (dims.ratio < 0.8 || dims.ratio > 1.91) {
                                    errors.push(`📸 Instagram does not support the aspect ratio of "${m.originalName || 'image'}" (${dims.w}×${dims.h}, ratio ${dims.ratio.toFixed(2)}). Must be between 4:5 (portrait) and 1.91:1 (landscape).`)
                                }
                            }
                        }
                    }
                    break
                case 'pinterest':
                    if (!hasImage) errors.push('📌 Pinterest requires an image. Please attach an image to your post.')
                    break
            }
        }

        // De-duplicate errors
        const uniqueErrors = [...new Set(errors)]
        if (uniqueErrors.length > 0) {
            uniqueErrors.forEach(err => toast.error(err, { duration: 5000 }))
            return
        }
        setPublishing(true)
        try {
            const existingId = editPostId || postIdRef.current
            const url = existingId ? `/api/admin/posts/${existingId}` : '/api/admin/posts'
            const method = existingId ? 'PUT' : 'POST'

            const createRes = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannel.id, content,
                    contentPerPlatform: Object.keys(contentPerPlatform).length > 0 ? contentPerPlatform : undefined,
                    status: 'PUBLISHING',
                    mediaIds: attachedMedia.map((m) => m.id),
                    platforms: buildPlatformsPayload(),
                }),
            })
            if (!createRes.ok) {
                const err = await createRes.json()
                toast.error(err.error || 'Failed to create post')
                return
            }
            const post = await createRes.json()

            // Fire publish in background — don't block UX
            fetch(`/api/admin/posts/${post.id}/publish`, { method: 'POST' }).catch(() => { /* background */ })

            savedRef.current = true
            toast.success('Post saved! Publishing in background…', { duration: 5000 })
            // Point 5d: notify user about TikTok processing time
            const hasTikTokPlatform = selectedChannel?.platforms?.some(p => p.platform === 'tiktok' && selectedPlatformIds.has(p.id))
            if (hasTikTokPlatform) {
                setTimeout(() => {
                    toast.info('⏱ TikTok: Content may take a few minutes to process and appear on your profile.', { duration: 8000 })
                }, 600)
            }
            router.push('/dashboard/posts')
        } catch {
            toast.error('Network error — failed to save post')
        } finally {
            setPublishing(false)
        }
    }


    // Delete post
    const handleDeletePost = async () => {
        const targetId = editPostId || postIdRef.current
        if (!targetId) return
        try {
            await fetch(`/api/admin/posts/${targetId}`, { method: 'DELETE' })
            toast.success('Post deleted')
            router.push('/dashboard/posts')
        } catch {
            toast.error('Failed to delete post')
        }
    }

    const charCount = content.length

    // Get selected platform entries for preview
    const selectedEntries = activePlatforms.filter((p) => selectedPlatformIds.has(p.id))

    // Deduplicate platforms for preview tabs
    const uniqueSelectedPlatforms = [...new Set(selectedEntries.map((p) => p.platform))]

    // Auto-select first platform for preview if current is invalid
    const effectivePreviewPlatform = uniqueSelectedPlatforms.includes(previewPlatform)
        ? previewPlatform
        : uniqueSelectedPlatforms[0] || ''

    return (
        <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-1 py-1.5 shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer rounded-xl hover:bg-primary/8" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-base font-bold tracking-tight">{editPostId ? t('compose.editTitle') : t('compose.title')}</h1>
                        <p className="text-xs text-muted-foreground hidden sm:block">Design, refine, and publish across your network with AI assistance.</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {isApprovalMode ? (
                        // ── PENDING_APPROVAL: Approve + Save ──────────────────────────────
                        <>
                            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={handleSaveDraft} disabled={saving}>
                                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                {saving ? t('compose.saving') : t('compose.saveDraft')}
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 text-xs cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                                onClick={handleApprove}
                                disabled={approving}
                            >
                                {approving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : (
                                    <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                )}
                                {approving ? t('compose.approving') : t('compose.approve')}
                            </Button>
                        </>
                    ) : isResubmitMode ? (
                        // ── REJECTED: Save + Gửi duyệt lại ──────────────────────────────
                        <>
                            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={handleSaveDraft} disabled={saving}>
                                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                {saving ? t('compose.saving') : t('compose.save')}
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 text-xs cursor-pointer bg-amber-500 hover:bg-amber-600 text-white border-0"
                                onClick={handleResubmit}
                                disabled={resubmitting || saving}
                            >
                                {resubmitting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : (
                                    <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l3-3 3 3" /></svg>
                                )}
                                {resubmitting ? t('compose.resubmitting') : t('compose.resubmit')}
                            </Button>
                        </>
                    ) : scheduleDate ? (
                        // Schedule mode — amber button
                        <Button
                            size="sm"
                            className="h-7 text-xs cursor-pointer bg-amber-500 hover:bg-amber-600 text-white border-0"
                            onClick={handleSaveDraft}
                            disabled={saving || !content.trim()}
                        >
                            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Calendar className="h-3.5 w-3.5 mr-1" />}
                            {saving ? t('compose.scheduling') : t('compose.schedule')}
                        </Button>
                    ) : (
                        // Normal mode — Save Draft + Publish Now
                        <>
                            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={handleSaveDraft} disabled={saving || (!content.trim() && !Object.values(contentPerPlatform).some(v => v.trim()))}>
                                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                {saving ? t('compose.saving') : t('compose.saveDraft')}
                            </Button>
                            {(() => {
                                // ── Compute publish block reason for tooltip ──
                                const hasTikTokSelected = selectedChannel?.platforms?.some(p => p.platform === 'tiktok' && selectedPlatformIds.has(p.id))
                                let publishBlockReason = ''
                                if (hasTikTokSelected) {
                                    if (ttCreatorInfo && !ttCreatorInfo.can_post)
                                        publishBlockReason = '⛔ TikTok: This account has reached its posting limit.'
                                    else if (!ttVisibility)
                                        publishBlockReason = '🔒 TikTok: Please select a privacy setting before publishing.'
                                    else if (ttCommercialDisclosure && !ttYourBrand && !ttBrandedContent)
                                        publishBlockReason = '📋 TikTok: Please indicate if this promotes yourself or a third party (commercial content disclosure required).'
                                }
                                const isBlocked = publishing || !content.trim() || selectedPlatformIds.size === 0 || !!publishBlockReason
                                return (
                                    <div title={publishBlockReason || undefined} className="inline-flex">
                                        <Button
                                            size="sm"
                                            className={`h-7 text-xs ${isBlocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                            onClick={handlePublishNow}
                                            disabled={isBlocked}
                                        >
                                            {publishing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                            {publishing ? t('compose.publishing') : t('compose.publish')}
                                        </Button>
                                    </div>
                                )
                            })()}
                        </>
                    )}
                    {/* Approval indicator */}
                    {selectedChannel?.requireApproval === 'required' && (
                        <Badge className="h-6 text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/30 gap-1 px-2">
                            <ShieldCheck className="h-3 w-3" />
                            {t('compose.requiresApproval')}
                        </Badge>
                    )}
                    {selectedChannel?.requireApproval === 'optional' && (
                        <button
                            type="button"
                            onClick={() => setRequestApproval(!requestApproval)}
                            className={`flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium border transition-colors cursor-pointer ${requestApproval
                                ? 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                                }`}
                        >
                            <ShieldCheck className="h-3 w-3" />
                            {requestApproval ? t('compose.submitForApproval') : t('compose.publish')}
                        </button>
                    )}
                    {/* Delete button — only in edit mode */}
                    {editPostId && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="h-px bg-border/60" />

            {/* Mobile Tab Bar — hidden on lg+ */}
            <div className="lg:hidden flex items-center gap-0 border-b shrink-0 px-1 bg-background">
                {([
                    {
                        id: 'settings' as const,
                        label: t('compose.channel'),
                        icon: (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                            </svg>
                        ),
                    },
                    {
                        id: 'editor' as const,
                        label: t('compose.content'),
                        icon: (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        ),
                    },
                    {
                        id: 'preview' as const,
                        label: t('compose.preview'),
                        icon: (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                        ),
                    },
                ]).map(({ id, label, icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setMobileTab(id)}
                        className={`flex-1 py-2 flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors border-b-2 cursor-pointer ${mobileTab === id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {icon}
                        {label}
                    </button>
                ))}
            </div>

            {/* 3-Column Layout — fills remaining height */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 min-h-0 divide-x divide-border/60">
                {/* ── Left: Channels & Settings ── */}
                <div className={`lg:col-span-2 flex flex-col overflow-hidden ${mobileTab === 'settings' ? 'flex' : 'hidden'} lg:flex`}>
                    {/* Channel indicator (read-only — driven by workspace) */}
                    <div className="px-4 pt-4 pb-2 shrink-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('compose.channel')}</p>
                        <div className="h-8 px-3 flex items-center gap-2 bg-muted/40 border border-border/50 rounded-md">
                            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-primary">{selectedChannel?.displayName?.[0]?.toUpperCase() || '?'}</span>
                            </div>
                            <span className="text-xs font-medium truncate text-foreground">
                                {selectedChannel?.displayName || t('compose.selectChannel')}
                            </span>
                        </div>
                    </div>

                    {/* Platform toggle list — Design style */}
                    <div className="flex-1 overflow-y-auto px-3 pb-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('compose.platforms')}</p>
                            {activePlatforms.length > 0 && (
                                <button
                                    type="button"
                                    className="text-[9px] font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                                    onClick={() => {
                                        if (selectedPlatformIds.size === activePlatforms.length) {
                                            setSelectedPlatformIds(new Set())
                                        } else {
                                            setSelectedPlatformIds(new Set(activePlatforms.map(p => p.id)))
                                        }
                                    }}
                                >
                                    {selectedPlatformIds.size === activePlatforms.length ? t('compose.deselectAll') : t('compose.selectAll')}
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {activePlatforms.length ? (() => {
                                // Group by platform type, preserve order of first appearance
                                const platformOrder: string[] = []
                                const groups: Record<string, typeof activePlatforms> = {}
                                activePlatforms.forEach((p) => {
                                    if (!groups[p.platform]) { groups[p.platform] = []; platformOrder.push(p.platform) }
                                    groups[p.platform].push(p)
                                })
                                return platformOrder.map((platformKey) => {
                                    const accounts = groups[platformKey]
                                    const label = platformLabels[platformKey] || platformKey
                                    const groupCheckedCount = accounts.filter(p => selectedPlatformIds.has(p.id)).length
                                    const allGroupChecked = groupCheckedCount === accounts.length
                                    return (
                                        <div key={platformKey}>
                                            {/* Group header */}
                                            <div className="flex items-center gap-1.5 mb-1 px-1">
                                                <span className="flex items-center justify-center w-3.5 h-3.5 shrink-0">
                                                    {platformBadgeIcons[platformKey] ?? <PlatformIcon platform={platformKey} size="xs" />}
                                                </span>
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1 truncate">{label}</span>
                                                <span className="text-[9px] text-muted-foreground/60">{groupCheckedCount}/{accounts.length}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedPlatformIds(prev => {
                                                            const next = new Set(prev)
                                                            if (allGroupChecked) { accounts.forEach(p => next.delete(p.id)) }
                                                            else { accounts.forEach(p => next.add(p.id)) }
                                                            return next
                                                        })
                                                    }}
                                                    className="text-[8px] font-medium text-primary/70 hover:text-primary transition-colors cursor-pointer shrink-0"
                                                >
                                                    {allGroupChecked ? '✕' : '✓'}
                                                </button>
                                            </div>
                                            {/* Accounts in group */}
                                            <div className="space-y-0.5 pl-1">
                                                {accounts.map((p) => {
                                                    const isChecked = selectedPlatformIds.has(p.id)
                                                    return (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => togglePlatform(p.id)}
                                                            className={`flex items-start gap-2 px-2 py-2 rounded-xl cursor-pointer select-none transition-all duration-150 ${isChecked
                                                                ? 'bg-primary/10 border border-primary/20'
                                                                : 'hover:bg-muted/50 border border-transparent'
                                                                }`}
                                                        >
                                                            {/* Avatar with platform icon overlay */}
                                                            <div className="relative shrink-0 mt-0.5">
                                                                {getPlatformAvatar(p) ? (
                                                                    <img
                                                                        src={getPlatformAvatar(p)!}
                                                                        alt={p.accountName}
                                                                        className="h-7 w-7 rounded-full object-cover border border-border/50"
                                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }}
                                                                    />
                                                                ) : null}
                                                                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getPlatformAvatar(p) ? 'hidden' : ''}`}
                                                                    style={{ backgroundColor: platformColors[p.platform] || '#666' }}>
                                                                    {p.accountName?.[0]?.toUpperCase() || '?'}
                                                                </div>
                                                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                                                                    {platformBadgeIcons[p.platform] ?? <PlatformIcon platform={p.platform} size="xs" />}
                                                                </span>
                                                            </div>
                                                            {/* Name */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-xs font-medium leading-tight line-clamp-2 break-words ${isChecked ? 'text-primary' : 'text-foreground'}`}>
                                                                    {p.accountName}
                                                                </p>
                                                            </div>
                                                            {/* Toggle */}
                                                            <div className={`w-8 h-4 rounded-full relative transition-colors shrink-0 mt-1.5 ${isChecked ? 'bg-primary' : 'bg-muted'}`}>
                                                                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${isChecked ? 'right-0.5 bg-background' : 'left-0.5 bg-muted-foreground/50'}`} />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })
                            })() : (
                                <p className="text-xs text-muted-foreground px-1">{t('compose.noPlatforms')}</p>
                            )}
                        </div>
                    </div>

                </div>

                {/* ── Center: Editor ── */}
                <div className={`lg:col-span-7 space-y-1.5 overflow-y-auto px-4 py-4 ${mobileTab === 'editor' ? 'block' : 'hidden'} lg:block`}>
                    {/* AI Generate */}
                    <Card >
                        <CardHeader className="py-1.5 px-2.5">
                            <CardTitle className="text-xs flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> {t('compose.generateAI')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-2.5 pb-2 space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    placeholder={t('compose.topicPlaceholder')}
                                    value={aiTopic}
                                    onChange={(e) => setAiTopic(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                />
                                <Button onClick={handleGenerate} disabled={generating || !aiTopic.trim()} size="sm" className="shrink-0 cursor-pointer">
                                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                </Button>
                            </div>

                            {/* URL & Business Info toggles */}
                            <div className="flex flex-wrap gap-3">
                                {aiTopic.startsWith('http') && (
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={includeSourceLink}
                                            onChange={(e) => setIncludeSourceLink(e.target.checked)}
                                            className="h-3 w-3 rounded accent-primary"
                                        />
                                        🔗 Include source link
                                    </label>
                                )}
                                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={includeBusinessInfo}
                                        onChange={(e) => setIncludeBusinessInfo(e.target.checked)}
                                        className="h-3 w-3 rounded accent-primary"
                                    />
                                    <Building2 className="h-3 w-3 text-blue-400" />
                                    Include business info
                                </label>
                            </div>

                            {/* Applied Context Indicator */}
                            {appliedContext && (
                                <div className="flex flex-wrap items-center gap-1">
                                    <span className="text-[9px] text-muted-foreground mr-0.5">AI used:</span>
                                    {appliedContext.vibe && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[9px] font-medium">
                                            🎨 Vibe
                                        </span>
                                    )}
                                    {(appliedContext.knowledge ?? 0) > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-medium">
                                            📚 Knowledge ({appliedContext.knowledge})
                                        </span>
                                    )}
                                    {(appliedContext.hashtags ?? 0) > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-medium">
                                            # Hashtags ({appliedContext.hashtags})
                                        </span>
                                    )}
                                    {(appliedContext.templates ?? 0) > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[9px] font-medium">
                                            📋 Templates ({appliedContext.templates})
                                        </span>
                                    )}
                                    {appliedContext.businessInfo && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[9px] font-medium">
                                            🏢 Business
                                        </span>
                                    )}
                                    {appliedContext.brandProfile && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 text-[9px] font-medium">
                                            🎯 Brand
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Suggested Topics */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => { setShowSuggestions(!showSuggestions); if (!showSuggestions && suggestions.length === 0) fetchSuggestions() }}
                                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <Lightbulb className="h-3 w-3" />
                                    Suggested Topics
                                    <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
                                </button>
                                {showSuggestions && (
                                    <div className="mt-1.5">
                                        {loadingSuggestions ? (
                                            <div className="flex items-center gap-1.5 py-2">
                                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                <span className="text-[10px] text-muted-foreground">Generating suggestions...</span>
                                            </div>
                                        ) : suggestions.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {suggestions.map((s, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => { setAiTopic(s.topic); setShowSuggestions(false) }}
                                                        title={s.angle || s.topic}
                                                        className="group inline-flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg border bg-card hover:bg-primary/6 hover:border-primary/30 text-left transition-all cursor-pointer"
                                                    >
                                                        <span className="inline-flex items-center gap-1 text-[10px]">
                                                            <span>{s.emoji}</span>
                                                            <span className="font-medium group-hover:text-primary transition-colors">{s.topic}</span>
                                                        </span>
                                                        {s.keyword && (
                                                            <span className="inline-flex items-center gap-1 text-[8px] text-muted-foreground">
                                                                <Search className="h-2 w-2" />
                                                                {s.keyword}
                                                                {s.relatedKeywords && s.relatedKeywords.length > 0 && (
                                                                    <span className="text-muted-foreground/50">· {s.relatedKeywords.slice(0, 2).join(' · ')}</span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={fetchSuggestions}
                                                    disabled={loadingSuggestions}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer self-start"
                                                >
                                                    <RefreshCw className="h-2.5 w-2.5" /> Refresh
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground py-1">No suggestions yet. Click Refresh to get ideas.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Trending News */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => { setShowTrending(!showTrending); if (!showTrending && trendingArticles.length === 0) fetchTrending() }}
                                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <Newspaper className="h-3 w-3" />
                                    Trending News
                                    <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showTrending ? 'rotate-180' : ''}`} />
                                </button>
                                {showTrending && (
                                    <div className="mt-1.5 space-y-1.5">
                                        {/* Category selector */}
                                        <div className="flex items-center gap-1.5">
                                            <select
                                                value={trendingCategory}
                                                onChange={(e) => { setTrendingCategory(e.target.value); fetchTrending(e.target.value) }}
                                                className="h-6 text-[10px] rounded border bg-muted/50 px-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                <option value="general">General</option>
                                                <option value="technology">Technology</option>
                                                <option value="business">Business</option>
                                                <option value="health">Health</option>
                                                <option value="science">Science</option>
                                                <option value="entertainment">Entertainment</option>
                                                <option value="sports">Sports</option>
                                            </select>
                                            {trendingKeywords && (
                                                <span className="text-[9px] text-muted-foreground truncate">Keywords: {trendingKeywords}</span>
                                            )}
                                            <button
                                                onClick={() => fetchTrending()}
                                                disabled={loadingTrending}
                                                className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                            >
                                                <RefreshCw className={`h-2.5 w-2.5 ${loadingTrending ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>

                                        {/* Articles list */}
                                        {loadingTrending ? (
                                            <div className="flex items-center gap-1.5 py-3">
                                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                <span className="text-[10px] text-muted-foreground">Fetching news...</span>
                                            </div>
                                        ) : trendingArticles.length > 0 ? (
                                            <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                                                {trendingArticles.map((article, i) => {
                                                    const timeAgo = article.publishedAt
                                                        ? (() => {
                                                            const diff = Date.now() - new Date(article.publishedAt).getTime()
                                                            const hours = Math.floor(diff / 3600000)
                                                            if (hours < 1) return `${Math.floor(diff / 60000)}m ago`
                                                            if (hours < 24) return `${hours}h ago`
                                                            return `${Math.floor(hours / 24)}d ago`
                                                        })()
                                                        : ''
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => { setAiTopic(article.link); setShowTrending(false); toast.success('Article URL added — click ✨ to generate!') }}
                                                            className="w-full flex items-start gap-2 p-1.5 rounded-md hover:bg-primary/6 transition-colors text-left group cursor-pointer"
                                                        >
                                                            <Newspaper className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">{article.title}</p>
                                                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                                                    {article.source}{article.source && timeAgo ? ' • ' : ''}{timeAgo}
                                                                </p>
                                                            </div>
                                                            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground py-2">No articles found. Try a different category.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                        </CardContent>
                    </Card>



                    {/* Content Editor */}
                    <Card >
                        <CardHeader className="py-1.5 px-2.5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs">Content</CardTitle>
                                <span className={`text-[10px] ${charCount > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                                    {charCount > 0 ? `${charCount}` : ''}
                                </span>
                            </div>
                            {/* Content Toolbar */}
                            <div className="flex items-center gap-0 pt-0.5 border-b pb-1 -mx-0.5 flex-wrap">
                                {/* Bold */}
                                <button
                                    type="button"
                                    title="Bold text"
                                    className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    onClick={() => {
                                        const ta = textareaRef.current
                                        if (!ta) return
                                        const start = ta.selectionStart
                                        const end = ta.selectionEnd
                                        const selected = content.substring(start, end)
                                        const newContent = content.substring(0, start) + `**${selected || 'bold'}**` + content.substring(end)
                                        setContent(newContent)
                                        setTimeout(() => { ta.focus(); ta.setSelectionRange(start + 2, start + 2 + (selected || 'bold').length) }, 0)
                                    }}
                                >
                                    <Bold className="h-4 w-4" />
                                </button>
                                {/* Hashtag */}
                                <button
                                    type="button"
                                    title="Insert hashtag"
                                    className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    onClick={() => {
                                        const ta = textareaRef.current
                                        if (ta) {
                                            const pos = ta.selectionStart
                                            const before = content.substring(0, pos)
                                            const after = content.substring(pos)
                                            const prefix = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : ''
                                            setContent(before + prefix + '#' + after)
                                            setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + prefix.length + 1, pos + prefix.length + 1) }, 0)
                                        } else {
                                            setContent(prev => prev + (prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '') + '#')
                                        }
                                    }}
                                >
                                    <Hash className="h-4 w-4" />
                                </button>
                                {/* @Mention */}
                                <button
                                    type="button"
                                    title="Insert mention"
                                    className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    onClick={() => {
                                        const ta = textareaRef.current
                                        if (ta) {
                                            const pos = ta.selectionStart
                                            const before = content.substring(0, pos)
                                            const after = content.substring(pos)
                                            const prefix = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : ''
                                            setContent(before + prefix + '@' + after)
                                            setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + prefix.length + 1, pos + prefix.length + 1) }, 0)
                                        } else {
                                            setContent(prev => prev + (prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '') + '@')
                                        }
                                    }}
                                >
                                    <AtSign className="h-4 w-4" />
                                </button>
                                {/* Link */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        title="Insert link"
                                        className={`h-7 w-7 rounded flex items-center justify-center transition-colors cursor-pointer ${showLinkInput ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                        onClick={() => {
                                            setShowLinkInput(!showLinkInput)
                                            setLinkInputValue('')
                                        }}
                                    >
                                        <Link2 className="h-4 w-4" />
                                    </button>
                                    {showLinkInput && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowLinkInput(false)} />
                                            <div className="absolute top-9 left-0 z-50 bg-popover border rounded-xl shadow-xl p-3 w-[280px]">
                                                <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Paste or type a URL</p>
                                                <div className="flex gap-1.5">
                                                    <Input
                                                        value={linkInputValue}
                                                        onChange={(e) => setLinkInputValue(e.target.value)}
                                                        placeholder="https://example.com"
                                                        className="text-xs h-8"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && linkInputValue.trim()) {
                                                                e.preventDefault()
                                                                const ta = textareaRef.current
                                                                const url = linkInputValue.trim().startsWith('http') ? linkInputValue.trim() : `https://${linkInputValue.trim()}`
                                                                if (ta) {
                                                                    const pos = ta.selectionStart
                                                                    const before = content.substring(0, pos)
                                                                    const after = content.substring(pos)
                                                                    const prefix = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : ''
                                                                    setContent(before + prefix + url + after)
                                                                    setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + prefix.length + url.length, pos + prefix.length + url.length) }, 0)
                                                                } else {
                                                                    setContent(prev => prev + (prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '') + url)
                                                                }
                                                                setShowLinkInput(false)
                                                                setLinkInputValue('')
                                                            } else if (e.key === 'Escape') {
                                                                setShowLinkInput(false)
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                                                        disabled={!linkInputValue.trim()}
                                                        onClick={() => {
                                                            const ta = textareaRef.current
                                                            const url = linkInputValue.trim().startsWith('http') ? linkInputValue.trim() : `https://${linkInputValue.trim()}`
                                                            if (ta) {
                                                                const pos = ta.selectionStart
                                                                const before = content.substring(0, pos)
                                                                const after = content.substring(pos)
                                                                const prefix = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : ''
                                                                setContent(before + prefix + url + after)
                                                                setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + prefix.length + url.length, pos + prefix.length + url.length) }, 0)
                                                            } else {
                                                                setContent(prev => prev + (prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '') + url)
                                                            }
                                                            setShowLinkInput(false)
                                                            setLinkInputValue('')
                                                        }}
                                                    >
                                                        Insert
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="w-px h-5 bg-border mx-1" />
                                {/* Emoji Picker */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        title="Emoji"
                                        className={`h-7 w-7 rounded flex items-center justify-center transition-colors cursor-pointer ${showEmojiPicker ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    >
                                        <Smile className="h-4 w-4" />
                                    </button>
                                    {showEmojiPicker && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                                            <div className="absolute top-9 left-0 z-50 bg-popover border rounded-xl shadow-xl p-2 w-[260px]">
                                                <div className="grid grid-cols-8 gap-1">
                                                    {['😀', '😂', '🤣', '😍', '🥰', '😎', '🤩', '🥳', '😤', '🔥', '💯', '❤️', '👏', '🙌', '💪', '✨', '🎉', '🎊', '👍', '👎', '🤔', '😱', '😢', '🤝', '💡', '📌', '🚀', '📢', '💰', '🛒', '🎯', '📈', '⭐', '🏆', '💎', '🌟', '❗', '✅', '📣', '🔔', '🎁', '💝', '🌈', '☀️', '🌙', '💫', '🍀', '🦋'].map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            type="button"
                                                            className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted transition-colors cursor-pointer text-base"
                                                            onClick={() => {
                                                                const ta = textareaRef.current
                                                                if (!ta) { setContent(prev => prev + emoji); setShowEmojiPicker(false); return }
                                                                const pos = ta.selectionStart
                                                                const newContent = content.substring(0, pos) + emoji + content.substring(pos)
                                                                setContent(newContent)
                                                                setShowEmojiPicker(false)
                                                                setTimeout(() => { ta.focus(); ta.setSelectionRange(pos + emoji.length, pos + emoji.length) }, 0)
                                                            }}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Write your post content here..."
                                className="w-full min-h-[120px] resize-y rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                                rows={5}
                            />
                        </CardContent>
                    </Card>

                    {/* Per-Platform Content Customization */}
                    {selectedPlatformIds.size > 0 && (
                        <Card>
                            <CardHeader className="py-1.5 px-2.5">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xs flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5" /> Platform Content
                                    </CardTitle>
                                </div>

                                {/* Platform tabs */}
                                {(() => {
                                    const uniquePlatforms = [...new Set(
                                        activePlatforms
                                            .filter((p) => selectedPlatformIds.has(p.id))
                                            .map((p) => p.platform)
                                    )]
                                    const platformLabels: Record<string, string> = {
                                        facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
                                        x: 'X', linkedin: 'LinkedIn', pinterest: 'Pinterest', youtube: 'YouTube',
                                    }
                                    if (Object.keys(contentPerPlatform).length === 0) {
                                        return (
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Platform-specific content will appear here when available.
                                            </p>
                                        )
                                    }
                                    return (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {uniquePlatforms.map((platform) => (
                                                <button
                                                    key={platform}
                                                    type="button"
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${activeContentTab === platform
                                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                                        : contentPerPlatform[platform]
                                                            ? 'bg-muted text-foreground hover:bg-muted/80'
                                                            : 'bg-muted/50 text-muted-foreground hover:bg-muted/80'
                                                        }`}
                                                    onClick={() => setActiveContentTab(activeContentTab === platform ? null : platform)}
                                                >
                                                    <PlatformIcon platform={platform} size="sm" />
                                                    {platformLabels[platform] || platform}
                                                    {contentPerPlatform[platform] && <Check className="h-2.5 w-2.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    )
                                })()}
                            </CardHeader>
                            {activeContentTab && contentPerPlatform[activeContentTab] && (
                                <CardContent>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                {activeContentTab.charAt(0).toUpperCase() + activeContentTab.slice(1)} version
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-muted-foreground">
                                                    {contentPerPlatform[activeContentTab]?.length || 0}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                                    onClick={() => {
                                                        const updated = { ...contentPerPlatform }
                                                        delete updated[activeContentTab!]
                                                        setContentPerPlatform(updated)
                                                        if (Object.keys(updated).length === 0) setActiveContentTab(null)
                                                    }}
                                                >
                                                    ↺ Reset to Master
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={contentPerPlatform[activeContentTab] || ''}
                                            onChange={(e) => setContentPerPlatform({
                                                ...contentPerPlatform,
                                                [activeContentTab]: e.target.value,
                                            })}
                                            className="w-full min-h-[100px] resize-y rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                                            rows={4}
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Media */}
                    <Card
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`transition-all ${dragging ? 'ring-2 ring-primary border-primary' : ''}`}
                    >
                        <CardHeader className="py-1.5 px-2.5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs flex items-center gap-1.5">
                                    <ImageIcon className="h-3.5 w-3.5" /> Media
                                    {uploading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                </CardTitle>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 cursor-pointer bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-400" onClick={openLibrary} disabled={!selectedChannel}>
                                        <FolderOpen className="h-3 w-3 mr-0.5" />
                                        Library
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 cursor-pointer bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400" onClick={openGooglePicker} disabled={loadingDrivePicker}>
                                        {loadingDrivePicker ? <Loader2 className="h-3 w-3 mr-0.5 animate-spin" /> : <HardDrive className="h-3 w-3 mr-0.5" />}
                                        Drive
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 cursor-pointer bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-400" onClick={() => fileInputRef.current?.click()} disabled={uploading || !selectedChannel}>
                                        <Upload className="h-3 w-3 mr-0.5" />
                                        Upload
                                    </Button>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept={ACCEPTED_FILE_TYPES}
                                    className="hidden"
                                    onChange={(e) => { handleFileUpload(e.target.files); if (e.target) e.target.value = '' }}
                                />
                            </div>
                            {/* Aspect Ratio Selector */}
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-muted-foreground">Ratio:</span>
                                {(['16:9', '1:1', '9:16'] as const).map((ratio) => (
                                    <button
                                        key={ratio}
                                        onClick={() => setMediaRatio(ratio)}
                                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${mediaRatio === ratio
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                            }`}
                                    >
                                        {ratio === '16:9' && <RectangleHorizontal className="h-2.5 w-2.5" />}
                                        {ratio === '1:1' && <Square className="h-2.5 w-2.5" />}
                                        {ratio === '9:16' && <RectangleVertical className="h-2.5 w-2.5" />}
                                        {ratio}
                                    </button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-1.5 px-2.5 pb-2">
                            {(attachedMedia.length > 0 || aiImageBgGenerating || uploading) && (
                                <DndContext
                                    sensors={mediaDndSensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleMediaDragEnd}
                                >
                                    <SortableContext
                                        items={attachedMedia.map(m => m.id)}
                                        strategy={rectSortingStrategy}
                                    >
                                        <div className={`grid gap-1.5 ${mediaRatio === '9:16' ? 'grid-cols-5 sm:grid-cols-6' : 'grid-cols-4 sm:grid-cols-5'}`}>
                                            {attachedMedia.map((media, index) => (
                                                <SortableMediaCard
                                                    key={media.id}
                                                    media={media}
                                                    index={index}
                                                    mediaRatio={mediaRatio}
                                                    isLast={index === attachedMedia.length - 1}
                                                    aiImageJustCompleted={aiImageJustCompleted}
                                                    onRemove={removeMedia}
                                                    onZoom={(url) => setLightboxUrl(url ?? null)}
                                                    onEditInCanva={openCanvaDesign}
                                                    onRefresh={(id, updated) => {
                                                        setAttachedMedia(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m))
                                                    }}
                                                />
                                            ))}
                                            {/* AI Image Generating Placeholder — inside grid as a cell */}
                                            {aiImageBgGenerating && (
                                                <div className={`relative rounded-lg overflow-hidden border ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'}`}
                                                    style={{ background: 'linear-gradient(135deg, #0e1a14 0%, #0a1a10 50%, #0e1a14 100%)', borderColor: 'rgba(43,238,157,0.2)' }}>
                                                    {/* Shimmer sweep */}
                                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(43,238,157,0.06), transparent)', backgroundSize: '200% 100%', animation: 'shimmer 2s ease-in-out infinite' }} />
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                                                        <div className="relative">
                                                            {/* Green ping ring */}
                                                            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(43,238,157,0.15)', animationDuration: '2s' }} />
                                                            {/* Brand logo badge */}
                                                            <div className="relative h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(43,238,157,0.12)', border: '1.5px solid rgba(43,238,157,0.3)' }}>
                                                                <img
                                                                    src={branding.logoUrl || '/logo.png'}
                                                                    alt=""
                                                                    className="h-6 w-6 object-contain animate-pulse"
                                                                    style={{ animationDuration: '2s' }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <p className="text-[8px] font-semibold animate-pulse" style={{ color: '#2bee9d', animationDuration: '2s' }}>Creating...</p>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Upload Progress Placeholder */}
                                            {uploading && uploadingFileName && (
                                                <div className={`relative rounded-lg overflow-hidden border border-primary/30 bg-muted/30 flex flex-col items-center justify-center gap-1.5 p-2 ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'
                                                    }`}>
                                                    {/* shimmer bg */}
                                                    <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(135deg,var(--primary)/30,transparent)' }} />
                                                    <div className="relative z-10 flex flex-col items-center gap-1.5 w-full px-2">
                                                        <div className="h-6 w-6 rounded border border-primary/40 bg-primary/10 flex items-center justify-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                        </div>
                                                        <p className="text-[8px] text-muted-foreground text-center truncate w-full leading-tight">{uploadingFileName}</p>
                                                        {/* progress bar */}
                                                        <div className="w-full bg-muted rounded-full overflow-hidden" style={{ height: 4 }}>
                                                            <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                                                        </div>
                                                        <p className="text-[9px] font-bold text-primary">{uploadProgress}%</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                            {/* Drop zone — always visible */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border border-dashed rounded-md text-center cursor-pointer transition-all ${dragging
                                    ? 'border-primary bg-primary/5 py-2 px-3'
                                    : attachedMedia.length > 0
                                        ? 'py-1.5 px-2 hover:border-primary/30'
                                        : 'py-2 px-3 hover:border-primary/30'
                                    }`}
                            >
                                {dragging ? (
                                    <p className="text-xs font-medium text-primary">Drop files here</p>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground">{attachedMedia.length > 0 ? '+ Add more' : 'Click or drag to upload'}</p>
                                )}
                            </div>
                            {/* ── CTA Action Bar — AI Image & Canva ── */}
                            <div className="flex gap-2 mt-2">
                                {imageQuota.limit === 0 && byokProviders.length === 0 ? (
                                    <a
                                        href="/dashboard/billing"
                                        className="flex-1 group relative overflow-hidden rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-amber-600/20 via-orange-500/15 to-yellow-500/20 border border-amber-500/30 hover:border-amber-400/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] no-underline"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-yellow-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        <div className="relative flex items-center gap-2">
                                            <div className="flex-shrink-0 h-7 w-7 rounded-md bg-amber-500/20 flex items-center justify-center">
                                                <Sparkles className="h-3.5 w-3.5 text-amber-400 group-hover:animate-pulse" />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-xs font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">Upgrade to Create Image</div>
                                                <div className="text-[9px] text-amber-400/60 leading-tight">Unlock AI image generation</div>
                                            </div>
                                        </div>
                                    </a>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setShowImagePicker(true)
                                            setAiGeneratedPreview(null)
                                            if (content.trim()) {
                                                setUseContentAsPrompt(true)
                                                setAiImagePrompt(content.substring(0, 500))
                                            } else if (aiTopic.trim() && !aiImagePrompt) {
                                                setUseContentAsPrompt(false)
                                                setAiImagePrompt(aiTopic)
                                            } else {
                                                setUseContentAsPrompt(false)
                                            }
                                        }}
                                        className="flex-1 group relative overflow-hidden rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-purple-600/20 via-purple-500/15 to-fuchsia-500/20 border border-purple-500/30 hover:border-purple-400/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-fuchsia-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        <div className="relative flex items-center gap-2">
                                            <div className="flex-shrink-0 h-7 w-7 rounded-md bg-purple-500/20 flex items-center justify-center">
                                                <Sparkles className="h-3.5 w-3.5 text-purple-400 group-hover:animate-pulse" />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-xs font-semibold text-foreground group-hover:text-foreground/80 transition-colors">AI Image</div>
                                                <div className="text-[9px] text-muted-foreground leading-tight">Generate with AI</div>
                                            </div>
                                        </div>
                                    </button>
                                )}
                                <button
                                    onClick={() => openCanvaDesign()}
                                    disabled={canvaLoading}
                                    className="flex-1 group relative overflow-hidden rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-violet-600/20 via-violet-500/15 to-indigo-500/20 border border-violet-500/30 hover:border-violet-400/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <div className="relative flex items-center gap-2">
                                        {canvaLoading ? <Loader2 className="h-6 w-6 text-violet-400 animate-spin" /> : <img src="/CIRCLE LOGO - GRADIENT - RGB.svg" alt="Canva" className="h-7 w-7 object-contain flex-shrink-0" />}
                                        <div className="text-left">
                                            <div className="text-xs font-semibold text-foreground group-hover:text-foreground/80 transition-colors">Canva</div>
                                            <div className="text-[9px] text-muted-foreground leading-tight">Design in Canva</div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Facebook Settings — only when Facebook platform is selected */}
                    {selectedChannel?.platforms?.some(p => p.platform === 'facebook' && selectedPlatformIds.has(p.id)) && (
                        <Card>
                            <CardHeader className="py-1.5 px-2.5">
                                <button
                                    type="button"
                                    className="flex items-center justify-between w-full cursor-pointer"
                                    onClick={() => setFbSettingsOpen(!fbSettingsOpen)}
                                >
                                    <CardTitle className="text-xs flex items-center gap-1.5">
                                        <PlatformIcon platform="facebook" size="sm" />
                                        Facebook Settings
                                        {fbValidation.errors.length > 0 && (
                                            <Badge variant="destructive" className="ml-2 text-[9px] px-1.5 py-0">{fbValidation.errors.length} error{fbValidation.errors.length > 1 ? 's' : ''}</Badge>
                                        )}
                                        {fbValidation.errors.length === 0 && fbValidation.warnings.length > 0 && (
                                            <Badge className="ml-2 text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-600 border-amber-500/30">{fbValidation.warnings.length} warning{fbValidation.warnings.length > 1 ? 's' : ''}</Badge>
                                        )}
                                    </CardTitle>
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${fbSettingsOpen ? '' : '-rotate-90'}`} />
                                </button>
                            </CardHeader>
                            {fbSettingsOpen && (
                                <CardContent className="space-y-2 px-2.5 pb-2">
                                    {/* Validation Errors */}
                                    {fbValidation.errors.length > 0 && (
                                        <div className="space-y-1">
                                            {fbValidation.errors.map((err, i) => (
                                                <div key={i} className="flex items-start gap-1.5 p-1.5 rounded-md bg-red-500/10 border border-red-500/20">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                                                    <p className="text-[10px] text-red-600 dark:text-red-400">{err}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Validation Warnings */}
                                    {fbValidation.warnings.length > 0 && (
                                        <div className="space-y-1">
                                            {fbValidation.warnings.map((warn, i) => (
                                                <div key={i} className="flex items-start gap-1.5 p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                                                    <p className="text-[10px] text-amber-600 dark:text-amber-400">{warn}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Post Type */}
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                                        <div className="grid grid-cols-3 gap-1">
                                            {[
                                                { value: 'feed' as const, label: 'Feed', icon: LayoutGrid },
                                                { value: 'reel' as const, label: 'Reel', icon: Film },
                                                { value: 'story' as const, label: 'Story', icon: CircleDot },
                                            ].map(opt => {
                                                const selectedFbIds = selectedChannel?.platforms?.filter(p => p.platform === 'facebook' && selectedPlatformIds.has(p.id)).map(p => p.id) || []
                                                const currentType = selectedFbIds.length > 0 ? (fbPostTypes[selectedFbIds[0]] || 'feed') : 'feed'
                                                const isActive = currentType === opt.value
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border transition-all cursor-pointer text-[11px] font-medium ${isActive
                                                            ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                            : 'border-border hover:border-blue-300 text-muted-foreground hover:text-foreground'
                                                            }`}
                                                        onClick={() => {
                                                            const newTypes = { ...fbPostTypes }
                                                            selectedFbIds.forEach(id => { newTypes[id] = opt.value })
                                                            setFbPostTypes(newTypes)
                                                        }}
                                                    >
                                                        <opt.icon className="h-3.5 w-3.5" />
                                                        {opt.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* First Comment */}
                                    <div className="space-y-2 border-t pt-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-blue-500" />
                                                <div>
                                                    <p className="text-sm font-medium">First Comment</p>
                                                    <p className="text-[10px] text-muted-foreground">Auto-comment after posting (great for hashtags)</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-500 transition-colors disabled:opacity-50 cursor-pointer"
                                                disabled={generatingMeta || !content.trim()}
                                                onClick={() => handleGenerateMetadata(['facebook'])}
                                            >
                                                {generatingMeta ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                AI Generate
                                            </button>
                                        </div>
                                        <textarea
                                            value={fbFirstComment}
                                            onChange={(e) => setFbFirstComment(e.target.value)}
                                            placeholder="Add your first comment here... #hashtag #marketing"
                                            className="w-full min-h-[60px] resize-y rounded-lg border bg-transparent px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                                            rows={2}
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Instagram Settings — only when Instagram platform is selected */}
                    {selectedChannel?.platforms?.some(p => p.platform === 'instagram' && selectedPlatformIds.has(p.id)) && (
                        <Card>
                            <CardHeader className="py-1.5 px-2.5">
                                <button
                                    type="button"
                                    className="flex items-center justify-between w-full cursor-pointer"
                                    onClick={() => setIgSettingsOpen(!igSettingsOpen)}
                                >
                                    <CardTitle className="text-xs flex items-center gap-1.5">
                                        <PlatformIcon platform="instagram" size="sm" />
                                        Instagram Settings
                                        {igValidation.errors.length > 0 && (
                                            <Badge variant="destructive" className="ml-2 text-[9px] px-1.5 py-0">{igValidation.errors.length} error{igValidation.errors.length > 1 ? 's' : ''}</Badge>
                                        )}
                                        {igValidation.errors.length === 0 && igValidation.warnings.length > 0 && (
                                            <Badge className="ml-2 text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-600 border-amber-500/30">{igValidation.warnings.length} warning{igValidation.warnings.length > 1 ? 's' : ''}</Badge>
                                        )}
                                    </CardTitle>
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${igSettingsOpen ? '' : '-rotate-90'}`} />
                                </button>
                            </CardHeader>
                            {igSettingsOpen && (
                                <CardContent className="space-y-2 px-2.5 pb-2">
                                    {/* Validation Errors */}
                                    {igValidation.errors.length > 0 && (
                                        <div className="space-y-1">
                                            {igValidation.errors.map((err, i) => (
                                                <div key={i} className="flex items-start gap-1.5 p-1.5 rounded-md bg-red-500/10 border border-red-500/20">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                                                    <p className="text-[10px] text-red-600 dark:text-red-400">{err}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Validation Warnings */}
                                    {igValidation.warnings.length > 0 && (
                                        <div className="space-y-1">
                                            {igValidation.warnings.map((warn, i) => (
                                                <div key={i} className="flex items-start gap-1.5 p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                                                    <p className="text-[10px] text-amber-600 dark:text-amber-400">{warn}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Post Type */}
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                                        <div className="grid grid-cols-3 gap-1">
                                            {[
                                                { value: 'feed' as const, label: 'Feed', icon: LayoutGrid },
                                                { value: 'reel' as const, label: 'Reel', icon: Film },
                                                { value: 'story' as const, label: 'Story', icon: CircleDot },
                                            ].map(opt => {
                                                const isActive = igPostType === opt.value
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border transition-all cursor-pointer text-[11px] font-medium ${isActive
                                                            ? 'border-pink-500 bg-pink-500/10 text-pink-600 dark:text-pink-400'
                                                            : 'border-border hover:border-pink-300 text-muted-foreground hover:text-foreground'
                                                            }`}
                                                        onClick={() => setIgPostType(opt.value)}
                                                    >
                                                        <opt.icon className="h-3.5 w-3.5" />
                                                        {opt.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Also Share to Story */}
                                    {igPostType === 'feed' && (
                                        <div className="flex items-center justify-between py-1 border-t">
                                            <div className="flex items-center gap-1.5">
                                                <Camera className="h-3.5 w-3.5 text-pink-500" />
                                                <div>
                                                    <p className="text-xs font-medium">Also Share to Story</p>
                                                    <p className="text-[10px] text-muted-foreground">Automatically share your feed post to Stories</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${igShareToStory ? 'bg-pink-500' : 'bg-muted'}`}
                                                onClick={() => setIgShareToStory(!igShareToStory)}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${igShareToStory ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Collaborators */}
                                    <div className="space-y-2 border-t pt-3">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-pink-500" />
                                            <div>
                                                <p className="text-sm font-medium">Collaborators</p>
                                                <p className="text-[10px] text-muted-foreground">Invite up to 3 collaborators (public profiles only)</p>
                                            </div>
                                        </div>
                                        <Input
                                            value={igCollaborators}
                                            onChange={(e) => setIgCollaborators(e.target.value)}
                                            placeholder="@username1, @username2, @username3"
                                            className="text-xs"
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* YouTube Settings — only when YouTube platform is selected */}
                    {selectedChannel?.platforms?.some(p => p.platform === 'youtube' && selectedPlatformIds.has(p.id)) && (
                        <Card>
                            <CardHeader className="py-1.5 px-2.5">
                                <button
                                    type="button"
                                    className="flex items-center justify-between w-full cursor-pointer"
                                    onClick={() => setYtSettingsOpen(!ytSettingsOpen)}
                                >
                                    <CardTitle className="text-xs flex items-center gap-1.5">
                                        <PlatformIcon platform="youtube" size="sm" />
                                        YouTube Settings
                                    </CardTitle>
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${ytSettingsOpen ? '' : '-rotate-90'}`} />
                                </button>
                            </CardHeader>
                            {ytSettingsOpen && (
                                <CardContent className="space-y-2 px-2.5 pb-2">
                                    {/* Post Type */}
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                                        <div className="grid grid-cols-2 gap-1">
                                            {[
                                                { value: 'video' as const, label: 'Video', icon: Video },
                                                { value: 'shorts' as const, label: 'Shorts', icon: Scissors },
                                            ].map(opt => {
                                                const isActive = ytPostType === opt.value
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border transition-all cursor-pointer text-[11px] font-medium ${isActive
                                                            ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                                                            : 'border-border hover:border-red-300 text-muted-foreground hover:text-foreground'
                                                            }`}
                                                        onClick={() => setYtPostType(opt.value)}
                                                    >
                                                        <opt.icon className="h-3.5 w-3.5" />
                                                        {opt.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Video Title — 3 AI options */}
                                    <div className="space-y-1.5 border-t pt-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] text-muted-foreground">Video Title</Label>
                                            <button
                                                type="button"
                                                className="flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-500 transition-colors disabled:opacity-50 cursor-pointer"
                                                disabled={generatingMeta || !content.trim()}
                                                onClick={() => handleGenerateMetadata(['youtube'])}
                                            >
                                                {generatingMeta ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                ✨ AI Generate 3 Titles
                                            </button>
                                        </div>
                                        <Input
                                            value={ytVideoTitle}
                                            onChange={(e) => setYtVideoTitle(e.target.value)}
                                            placeholder="Enter video title..."
                                            className="text-sm"
                                        />
                                        {/* 3 title options from AI */}
                                        {ytTitleOptions.length > 1 && (
                                            <div className="space-y-1">
                                                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">AI Options — click to use</p>
                                                {ytTitleOptions.map((title, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        className={`w-full text-left px-2.5 py-1.5 rounded-md border text-xs transition-all cursor-pointer flex items-start gap-2 ${ytSelectedTitleIdx === idx
                                                            ? 'border-red-500 bg-red-500/10 text-foreground'
                                                            : 'border-border hover:border-red-300 text-muted-foreground hover:text-foreground'
                                                            }`}
                                                        onClick={() => {
                                                            setYtSelectedTitleIdx(idx)
                                                            setYtVideoTitle(title)
                                                        }}
                                                    >
                                                        <span className={`shrink-0 mt-0.5 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${ytSelectedTitleIdx === idx ? 'border-red-500' : 'border-muted-foreground/30'
                                                            }`}>
                                                            {ytSelectedTitleIdx === idx && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                                                        </span>
                                                        <span className="leading-snug">{title}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Category & Tags */}
                                    <div className="grid grid-cols-2 gap-3 border-t pt-3">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Category</Label>
                                            <Select value={ytCategory} onValueChange={setYtCategory}>
                                                <SelectTrigger className="text-xs">
                                                    <SelectValue placeholder="Select Category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[
                                                        'Film & Animation', 'Autos & Vehicles', 'Music', 'Pets & Animals',
                                                        'Sports', 'Travel & Events', 'Gaming', 'People & Blogs',
                                                        'Comedy', 'Entertainment', 'News & Politics', 'Howto & Style',
                                                        'Education', 'Science & Technology', 'Nonprofits & Activism'
                                                    ].map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Privacy</Label>
                                            <Select value={ytPrivacy} onValueChange={(v) => setYtPrivacy(v as 'public' | 'unlisted' | 'private')}>
                                                <SelectTrigger className="text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="public">
                                                        <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> Public</span>
                                                    </SelectItem>
                                                    <SelectItem value="unlisted">
                                                        <span className="flex items-center gap-1.5"><EyeOff className="h-3 w-3" /> Unlisted</span>
                                                    </SelectItem>
                                                    <SelectItem value="private">
                                                        <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Private</span>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Video Tags */}
                                    <div className="space-y-2 border-t pt-3">
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-red-500" />
                                            <Label className="text-xs text-muted-foreground">Video Tags</Label>
                                        </div>
                                        <Input
                                            value={ytTags}
                                            onChange={(e) => setYtTags(e.target.value)}
                                            placeholder="tag1, tag2, tag3..."
                                            className="text-xs"
                                        />
                                    </div>

                                    {/* Thumbnail Style + Prompts */}
                                    <div className="space-y-2 border-t pt-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ImageIcon className="h-4 w-4 text-red-500" />
                                                <Label className="text-xs text-muted-foreground">Thumbnail</Label>
                                            </div>
                                            <button
                                                type="button"
                                                className="flex items-center gap-1 text-[10px] font-medium text-purple-600 hover:text-purple-500 transition-colors cursor-pointer"
                                                onClick={() => setStyleModalOpen(true)}
                                            >
                                                <Palette className="h-3 w-3" />
                                                {THUMBNAIL_STYLES.find(s => s.id === thumbnailStyleId)?.name || 'Select Style'}
                                            </button>
                                        </div>
                                        {/* Selected style preview */}
                                        {(() => {
                                            const style = THUMBNAIL_STYLES.find(s => s.id === thumbnailStyleId)
                                            if (!style) return null
                                            return (
                                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/50">
                                                    <Image
                                                        src={style.preview}
                                                        alt={style.name}
                                                        width={64}
                                                        height={36}
                                                        className="rounded object-cover"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-medium truncate">{style.name}</p>
                                                        <p className="text-[9px] text-muted-foreground truncate">{style.description}</p>
                                                    </div>
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                                </div>
                                            )
                                        })()}
                                        {/* Active thumbnail prompt */}
                                        <div className="relative">
                                            <textarea
                                                value={ytThumbnailPrompt}
                                                onChange={(e) => setYtThumbnailPrompt(e.target.value)}
                                                placeholder="AI will generate a thumbnail prompt based on your content & selected style..."
                                                className="w-full min-h-[60px] resize-y rounded-lg border bg-transparent px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                                                rows={3}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleGenerateThumbnailPrompt}
                                                disabled={ytThumbnailLoading || !content.trim()}
                                                className="absolute bottom-2 right-2 flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {ytThumbnailLoading ? (
                                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-2.5 w-2.5" />
                                                )}
                                                {ytThumbnailLoading ? 'Generating...' : 'Create Prompt'}
                                            </button>
                                        </div>
                                        {/* 3 thumbnail prompt options */}
                                        {ytThumbnailPrompts.length > 1 && (
                                            <div className="space-y-1">
                                                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Prompt options</p>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {ytThumbnailPrompts.map((_, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            className={`py-1 px-2 rounded border text-[10px] font-medium transition-all cursor-pointer ${ytSelectedThumbIdx === idx
                                                                ? 'border-red-500 bg-red-500/10 text-red-600'
                                                                : 'border-border hover:border-red-300 text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            onClick={() => {
                                                                setYtSelectedThumbIdx(idx)
                                                                setYtThumbnailPrompt(ytThumbnailPrompts[idx])
                                                            }}
                                                        >
                                                            Prompt {idx + 1}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Toggles */}
                                    <div className="border-t pt-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Bell className="h-4 w-4 text-red-500" />
                                                <p className="text-sm font-medium">Notify Subscribers</p>
                                            </div>
                                            <button
                                                type="button"
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ytNotifySubscribers ? 'bg-red-500' : 'bg-muted'}`}
                                                onClick={() => setYtNotifySubscribers(!ytNotifySubscribers)}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${ytNotifySubscribers ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4 text-red-500" />
                                                <div>
                                                    <p className="text-sm font-medium">Made for Kids</p>
                                                    <p className="text-[10px] text-muted-foreground">Required by COPPA regulations</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ytMadeForKids ? 'bg-red-500' : 'bg-muted'}`}
                                                onClick={() => setYtMadeForKids(!ytMadeForKids)}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${ytMadeForKids ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* TikTok Settings — only when TikTok platform is selected */}
                    {selectedChannel?.platforms?.some(p => p.platform === 'tiktok' && selectedPlatformIds.has(p.id)) && (() => {
                        // Detect if Branded Content + SELF_ONLY conflict
                        const brandedContentConflict = ttCommercialDisclosure && ttBrandedContent && ttVisibility === 'SELF_ONLY'
                        // Compute the TikTok account nickname for display
                        const ttPlatform = selectedChannel?.platforms?.find(p => p.platform === 'tiktok' && selectedPlatformIds.has(p.id))
                        const ttNickname = ttPlatform?.accountName || ttPlatform?.accountId || 'Your TikTok Account'

                        // Compute disclaimer text based on commercial disclosure state
                        const showBrandedDisclaimer = ttCommercialDisclosure && ttBrandedContent

                        return (
                            <Card className="border-[#00F2EA]/30">
                                <CardHeader className="py-1.5 px-2.5">
                                    <button
                                        type="button"
                                        className="flex items-center justify-between w-full cursor-pointer"
                                        onClick={() => setTtSettingsOpen(!ttSettingsOpen)}
                                    >
                                        <CardTitle className="text-xs flex items-center gap-1.5">
                                            <PlatformIcon platform="tiktok" size="sm" />
                                            TikTok Settings
                                        </CardTitle>
                                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${ttSettingsOpen ? '' : '-rotate-90'}`} />
                                    </button>
                                </CardHeader>
                                {ttSettingsOpen && (
                                    <CardContent className="space-y-3 px-2.5 pb-3">

                                        {/* Point 1a: Creator nickname */}
                                        <div className="flex items-center gap-2 p-2 rounded-md bg-[#00F2EA]/5 border border-[#00F2EA]/20">
                                            <div className="h-6 w-6 rounded-full bg-[#00F2EA]/20 flex items-center justify-center text-[10px] font-bold text-[#00F2EA]">
                                                {ttNickname.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <p className="text-[10px] text-muted-foreground">Posting to TikTok as</p>
                                                <p className="text-xs font-semibold">{ttNickname}</p>
                                            </div>
                                            {ttCreatorInfoLoading && <span className="ml-auto text-[9px] text-muted-foreground animate-pulse">Loading…</span>}
                                        </div>

                                        {/* Point 1b: can_post=false warning */}
                                        {ttCreatorInfo && !ttCreatorInfo.can_post && (
                                            <div className="flex items-start gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/30">
                                                <span className="text-destructive text-[11px] mt-0.5">⛔</span>
                                                <p className="text-[10px] text-destructive leading-relaxed">
                                                    This TikTok account has reached its posting limit. Please try again later.
                                                </p>
                                            </div>
                                        )}

                                        {/* Point 1c: video duration warning — shown in real-time */}
                                        {(() => {
                                            if (!ttCreatorInfo?.max_video_post_duration_sec || ttPostType !== 'video') return null
                                            const videoItem = attachedMedia.find(m => isVideo(m))
                                            if (!videoItem?.duration) return null
                                            if (videoItem.duration <= ttCreatorInfo.max_video_post_duration_sec) return null
                                            const maxMin = Math.ceil(ttCreatorInfo.max_video_post_duration_sec / 60)
                                            const vidMin = Math.ceil(videoItem.duration / 60)
                                            return (
                                                <div className="flex items-start gap-1.5 p-2 rounded-md bg-orange-500/10 border border-orange-500/30">
                                                    <span className="text-orange-500 text-[11px] mt-0.5">⚠️</span>
                                                    <p className="text-[10px] text-orange-600 dark:text-orange-400 leading-relaxed">
                                                        Video too long: <strong>{vidMin} min</strong>. Your account allows max <strong>{maxMin} min</strong>. Please trim or use a shorter video.
                                                    </p>
                                                </div>
                                            )
                                        })()}


                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Publish As</Label>
                                            <div className="grid grid-cols-2 gap-1">
                                                {[
                                                    { value: 'direct' as const, label: 'Direct Publishing', icon: Send },
                                                    { value: 'inbox' as const, label: 'App Notification', icon: Bell },
                                                ].map(opt => {
                                                    const isActive = ttPublishMode === opt.value
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border transition-all cursor-pointer text-[11px] font-medium ${isActive
                                                                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                                                : 'border-border hover:border-cyan-300 text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            onClick={() => setTtPublishMode(opt.value)}
                                                        >
                                                            <opt.icon className="h-3.5 w-3.5" />
                                                            {opt.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Post Type */}
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                                            <div className="grid grid-cols-2 gap-1">
                                                {[
                                                    { value: 'video' as const, label: 'Video', icon: Video },
                                                    { value: 'carousel' as const, label: 'Image Carousel', icon: Layers },
                                                ].map(opt => {
                                                    const isActive = ttPostType === opt.value
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border transition-all cursor-pointer text-[11px] font-medium ${isActive
                                                                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                                                : 'border-border hover:border-cyan-300 text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            onClick={() => setTtPostType(opt.value)}
                                                        >
                                                            <opt.icon className="h-3.5 w-3.5" />
                                                            {opt.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Real-time warning: TikTok carousel needs ≥ 2 images */}
                                        {ttPostType === 'carousel' && (() => {
                                            const imgCount = attachedMedia.filter(m => !isVideo(m)).length
                                            if (imgCount >= 2) return null
                                            return (
                                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                                                    <span className="text-amber-400 text-[11px]">⚠️</span>
                                                    <p className="text-[10px] text-amber-400 leading-relaxed">
                                                        TikTok Carousel requires at least <strong>2 images</strong>.
                                                        {imgCount === 0 ? ' No images attached yet.' : ` Only ${imgCount} image attached.`}
                                                    </p>
                                                </div>
                                            )
                                        })()}

                                        {/* Point 2a: Video Title — separate editable field */}
                                        <div className="space-y-1 border-t pt-2">
                                            <Label className="text-[10px] text-muted-foreground">Video Title <span className="text-muted-foreground/60">(optional, max 2200)</span></Label>
                                            <input
                                                type="text"
                                                maxLength={2200}
                                                value={ttTitle}
                                                onChange={e => setTtTitle(e.target.value)}
                                                placeholder="Leave blank to use caption as title"
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                                            />
                                        </div>

                                        {/* Point 2b: Visibility — options from creator_info, no default */}
                                        <div className="space-y-1 border-t pt-2">
                                            <Label className="text-[10px] text-muted-foreground">Who can see <span className="text-destructive">*</span></Label>
                                            <Select value={ttVisibility} onValueChange={(v) => {
                                                const newVis = v as typeof ttVisibility
                                                // If Branded Content is on, block SELF_ONLY
                                                if (newVis === 'SELF_ONLY' && ttCommercialDisclosure && ttBrandedContent) return
                                                setTtAutoSwitchedToPublic(false) // user manually changed — dismiss banner
                                                setTtVisibility(newVis)
                                            }}>
                                                <SelectTrigger className={`text-xs h-7 ${ttVisibility === '' ? 'text-muted-foreground' : ''}`}>
                                                    <SelectValue placeholder="Select privacy…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {/* Strictly only the 3 standard TikTok options, per creator_info — no FOLLOWER_OF_CREATOR */}
                                                    {(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'] as const)
                                                        .filter(opt => !ttCreatorInfo || ttCreatorInfo.privacy_level_options.includes(opt) || opt === 'PUBLIC_TO_EVERYONE')
                                                        .map(opt => {
                                                            const labelMap: Record<string, { label: string; icon: React.ReactNode }> = {
                                                                PUBLIC_TO_EVERYONE: { label: 'Public To Everyone', icon: <Globe className="h-3 w-3" /> },
                                                                MUTUAL_FOLLOW_FRIENDS: { label: 'Mutual Follow Friends', icon: <Users className="h-3 w-3" /> },
                                                                SELF_ONLY: { label: 'Self Only', icon: <Lock className="h-3 w-3" /> },
                                                                FOLLOWER_OF_CREATOR: { label: 'Followers Only', icon: <Users className="h-3 w-3" /> },
                                                            }
                                                            const item = labelMap[opt] || { label: opt, icon: null }
                                                            const isDisabled = opt === 'SELF_ONLY' && ttCommercialDisclosure && ttBrandedContent
                                                            const selectItem = (
                                                                <SelectItem key={opt} value={opt} disabled={isDisabled}>
                                                                    <span className="flex items-center gap-1.5">
                                                                        {item.icon} {item.label}
                                                                        {isDisabled && <span className="text-[9px] text-destructive ml-1">(unavailable for Branded Content)</span>}
                                                                    </span>
                                                                </SelectItem>
                                                            )
                                                            if (isDisabled) {
                                                                return (
                                                                    <div key={opt} title="Branded content visibility cannot be set to private.">
                                                                        {selectItem}
                                                                    </div>
                                                                )
                                                            }
                                                            return selectItem
                                                        })}
                                                </SelectContent>
                                            </Select>
                                            {brandedContentConflict && (
                                                <p className="text-[10px] text-destructive">Branded content visibility cannot be set to private.</p>
                                            )}
                                            {/* Point 3b — auto-switch notification banner */}
                                            {ttAutoSwitchedToPublic && !brandedContentConflict && (
                                                <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                                                    <span className="text-amber-400 text-[11px] mt-0.5">⚠️</span>
                                                    <p className="text-[10px] text-amber-400 leading-relaxed">
                                                        Visibility automatically changed to <strong>Public</strong> — Branded Content cannot be set to private.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Point 2c: Interaction settings — horizontal 3-col, toggles, always all 3 visible */}
                                        <div className="border-t pt-2 space-y-1.5">
                                            <Label className="text-[10px] text-muted-foreground">Allow User to</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { label: 'Comment', value: ttAllowComment, setter: setTtAllowComment, isDisabled: false },
                                                    { label: 'Duet', value: ttAllowDuet, setter: setTtAllowDuet, isDisabled: ttPostType !== 'video' },
                                                    { label: 'Stitch', value: ttAllowStitch, setter: setTtAllowStitch, isDisabled: ttPostType !== 'video' },
                                                ].map(opt => (
                                                    <div key={opt.label} className="flex flex-col items-center gap-1">
                                                        <p className={`text-[10px] font-medium ${opt.isDisabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>{opt.label}</p>
                                                        <button
                                                            type="button"
                                                            disabled={opt.isDisabled}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${opt.isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${opt.value && !opt.isDisabled ? 'bg-cyan-500' : 'bg-muted'}`}
                                                            onClick={() => !opt.isDisabled && opt.setter(!opt.value)}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${opt.value && !opt.isDisabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Point 4: Commercial Content Disclosure */}
                                        <div className="border-t pt-2 space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-xs font-medium">Disclose video content</p>
                                                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">Turn on to disclose that this video promotes goods or services in exchange for something of value. Your video could promote yourself, a third party, or both.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${ttCommercialDisclosure ? 'bg-cyan-500' : 'bg-muted'}`}
                                                    onClick={() => {
                                                        const next = !ttCommercialDisclosure
                                                        setTtCommercialDisclosure(next)
                                                        if (!next) {
                                                            setTtYourBrand(false)
                                                            setTtBrandedContent(false)
                                                        }
                                                    }}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${ttCommercialDisclosure ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </div>

                                            {/* Sub-options — visible when disclosure is on */}
                                            {ttCommercialDisclosure && (
                                                <div className="space-y-2">
                                                    {/* Info banner */}
                                                    <div className="flex items-start gap-1.5 p-2 rounded-md bg-blue-500/10 border border-blue-500/30">
                                                        <span className="text-blue-400 text-[11px] mt-0.5 flex-shrink-0">ℹ️</span>
                                                        <p className="text-[10px] text-blue-400 leading-relaxed">
                                                            Your video will be labeled &quot;Promotional content&quot;.<br />
                                                            This cannot be changed once your video is posted.
                                                        </p>
                                                    </div>
                                                    {/* Your Brand */}
                                                    <label className="flex items-start gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="mt-0.5 accent-cyan-500"
                                                            checked={ttYourBrand}
                                                            onChange={e => setTtYourBrand(e.target.checked)}
                                                        />
                                                        <div>
                                                            <p className="text-xs font-semibold">Your brand</p>
                                                            <p className="text-[10px] text-muted-foreground leading-relaxed">You are promoting yourself or your own business. This video will be classified as Brand Organic.</p>
                                                        </div>
                                                    </label>
                                                    {/* Branded Content */}
                                                    <label className="flex items-start gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="mt-0.5 accent-cyan-500"
                                                            checked={ttBrandedContent}
                                                            onChange={e => {
                                                                setTtBrandedContent(e.target.checked)
                                                                // Auto-switch to Public if branded content is turned on while private
                                                                if (e.target.checked && ttVisibility === 'SELF_ONLY') {
                                                                    setTtVisibility('PUBLIC_TO_EVERYONE')
                                                                    setTtAutoSwitchedToPublic(true) // show notification banner
                                                                } else {
                                                                    setTtAutoSwitchedToPublic(false)
                                                                }
                                                            }}
                                                        />
                                                        <div>
                                                            <p className="text-xs font-semibold">Branded content</p>
                                                            <p className="text-[10px] text-muted-foreground leading-relaxed">You are promoting another brand or a third party. This video will be classified as Branded Content.</p>
                                                        </div>
                                                    </label>
                                                    {/* At-least-one validation hint */}
                                                    {!ttYourBrand && !ttBrandedContent && (
                                                        <p className="text-[9px] text-muted-foreground italic">You need to indicate if your content promotes yourself, a third party, or both.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* AI-Generated toggle */}
                                        <div className="border-t pt-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                                                    <p className="text-xs font-medium">AI-generated content</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ttAiGenerated ? 'bg-cyan-500' : 'bg-muted'}`}
                                                    onClick={() => setTtAiGenerated(!ttAiGenerated)}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${ttAiGenerated ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Point 5: Music Usage Confirmation disclaimer */}
                                        <div className="border-t pt-2">
                                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                By posting, you agree to TikTok&apos;s{' '}
                                                {showBrandedDisclaimer && (
                                                    <>
                                                        <a
                                                            href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[#00F2EA] hover:underline"
                                                        >
                                                            Branded Content Policy
                                                        </a>
                                                        {' '}and{' '}
                                                    </>
                                                )}
                                                <a
                                                    href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#00F2EA] hover:underline"
                                                >
                                                    Music Usage Confirmation
                                                </a>
                                                .
                                            </p>
                                        </div>

                                    </CardContent>
                                )}
                            </Card>
                        )
                    })()}

                    {/* Pinterest Settings — only when Pinterest platform is selected */}
                    {activePlatforms.some(p => selectedPlatformIds.has(p.id) && p.platform === 'pinterest') && (
                        <Card className="overflow-hidden border-[#E60023]/30">
                            <CardHeader
                                className="py-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                    setPinSettingsOpen(!pinSettingsOpen)
                                    // Fetch boards when opening settings, or when we need to reconnect
                                    if (!pinSettingsOpen && (pinBoards.length === 0 || pinNeedsReconnect) && !pinBoardsLoading) {
                                        const pinterestPlatform = activePlatforms.find(p => selectedPlatformIds.has(p.id) && p.platform === 'pinterest')
                                        if (pinterestPlatform && selectedChannel) {
                                            setPinBoardsLoading(true)
                                            fetch(`/api/admin/channels/${selectedChannel.id}/pinterest-boards?accountId=${pinterestPlatform.accountId}`)
                                                .then(r => r.json())
                                                .then(data => {
                                                    if (data.needsReconnect) { setPinNeedsReconnect(true); return }
                                                    setPinNeedsReconnect(false)
                                                    if (Array.isArray(data.boards)) { setPinBoards(data.boards) }
                                                })
                                                .catch(() => { })
                                                .finally(() => setPinBoardsLoading(false))
                                        }
                                    }
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                                        <div className="h-4 w-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: '#E60023' }}>P</div>
                                        Pinterest Settings
                                    </CardTitle>
                                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${pinSettingsOpen ? 'rotate-90' : ''}`} />
                                </div>
                            </CardHeader>
                            {pinSettingsOpen && (
                                <CardContent className="px-3 pb-3 pt-0 space-y-2">
                                    {/* Reconnect banner — shown when token is expired */}
                                    {pinNeedsReconnect && (() => {
                                        const pinterestPlatform = activePlatforms.find(p => selectedPlatformIds.has(p.id) && p.platform === 'pinterest')
                                        const fetchBoards = () => {
                                            if (!pinterestPlatform || !selectedChannel) return
                                            setPinBoardsLoading(true)
                                            fetch(`/api/admin/channels/${selectedChannel.id}/pinterest-boards?accountId=${pinterestPlatform.accountId}`)
                                                .then(r => r.json())
                                                .then(data => {
                                                    if (data.needsReconnect) return
                                                    setPinNeedsReconnect(false)
                                                    if (Array.isArray(data.boards)) { setPinBoards(data.boards) }
                                                })
                                                .catch(() => { })
                                                .finally(() => setPinBoardsLoading(false))
                                        }
                                        return (
                                            <div className="flex flex-col gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-amber-600 flex-1">⚠️ Pinterest token expired. Generate a new Sandbox token in API Hub, then retry.</span>
                                                    <button
                                                        type="button"
                                                        className="text-[10px] px-2 py-1 rounded border border-amber-500/40 text-amber-600 hover:bg-amber-500/10 cursor-pointer whitespace-nowrap"
                                                        onClick={fetchBoards}
                                                    >
                                                        ↺ Retry
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="text-[10px] px-2 py-1 rounded bg-[#E60023] text-white font-medium hover:bg-[#c0001d] cursor-pointer whitespace-nowrap"
                                                        onClick={() => {
                                                            if (!pinterestPlatform || !selectedChannel) return
                                                            const w = 500, h = 700
                                                            const left = window.screenX + (window.outerWidth - w) / 2
                                                            const top = window.screenY + (window.outerHeight - h) / 2
                                                            const popup = window.open(
                                                                `/api/oauth/pinterest?channelId=${selectedChannel.id}`,
                                                                'pinterest-oauth',
                                                                `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
                                                            )
                                                            const handler = (e: MessageEvent) => {
                                                                if (e.data?.type === 'oauth-success' && e.data?.platform === 'pinterest') {
                                                                    window.removeEventListener('message', handler)
                                                                    setTimeout(fetchBoards, 800)
                                                                }
                                                            }
                                                            window.addEventListener('message', handler)
                                                            const check = setInterval(() => {
                                                                if (popup?.closed) { clearInterval(check); window.removeEventListener('message', handler); setTimeout(fetchBoards, 800) }
                                                            }, 1000)
                                                        }}
                                                    >
                                                        Reconnect
                                                    </button>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground">
                                                    Go to{' '}
                                                    <a href="/admin/integrations" target="_blank" rel="noopener noreferrer" className="underline text-amber-600">
                                                        Admin → API Hub → Pinterest
                                                    </a>
                                                    {' '}→ paste token in <strong>Sandbox Token</strong> field → Apply. Then click Retry.
                                                </p>
                                            </div>
                                        )
                                    })()}


                                    {/* Board Selection */}
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground">Board</Label>
                                        <Select
                                            value={pinShowCreateBoard ? '__create__' : pinBoardId}
                                            onValueChange={v => {
                                                if (v === '__create__') {
                                                    setPinShowCreateBoard(true)
                                                    setPinNewBoardName('')
                                                } else {
                                                    setPinShowCreateBoard(false)
                                                    setPinBoardId(v)
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder={pinBoardsLoading ? 'Loading boards...' : 'Select a board'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {pinBoards.map(b => (
                                                    <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                                                ))}
                                                {pinBoards.length === 0 && !pinBoardsLoading && (
                                                    <SelectItem value="_none" disabled className="text-xs text-muted-foreground">No boards found</SelectItem>
                                                )}
                                                <SelectItem value="__create__" className="text-xs text-[#E60023] font-medium border-t mt-1 pt-1">
                                                    ＋ Create new board...
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Inline create form — shown when "Create new board" is selected */}
                                        {pinShowCreateBoard && (
                                            <div className="space-y-2 p-2 rounded-md border border-[#E60023]/30 bg-[#E60023]/5">
                                                <input
                                                    type="text"
                                                    placeholder="Board name..."
                                                    value={pinNewBoardName}
                                                    onChange={e => setPinNewBoardName(e.target.value)}
                                                    onKeyDown={e => e.key === 'Escape' && setPinShowCreateBoard(false)}
                                                    className="w-full h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-[#E60023]/50"
                                                    autoFocus
                                                />
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={pinNewBoardPrivacy}
                                                        onChange={e => setPinNewBoardPrivacy(e.target.value)}
                                                        className="flex-1 h-7 px-2 text-xs rounded-md border bg-background focus:outline-none"
                                                    >
                                                        <option value="PUBLIC">🌐 Public</option>
                                                        <option value="PROTECTED">🔒 Secret</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setPinShowCreateBoard(false); setPinBoardId(pinBoards[0]?.id || '') }}
                                                        className="h-7 px-2 text-xs rounded-md border text-muted-foreground hover:bg-muted cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!pinNewBoardName.trim() || pinCreatingBoard}
                                                        className="h-7 px-3 text-xs rounded-md bg-[#E60023] text-white font-medium disabled:opacity-50 cursor-pointer hover:bg-[#c0001d] transition-colors"
                                                        onClick={async () => {
                                                            const pinterestPlatform = activePlatforms.find(p => selectedPlatformIds.has(p.id) && p.platform === 'pinterest')
                                                            if (!pinterestPlatform || !selectedChannel) return
                                                            setPinCreatingBoard(true)
                                                            try {
                                                                const res = await fetch(`/api/admin/channels/${selectedChannel.id}/pinterest-boards`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        accountId: pinterestPlatform.accountId,
                                                                        name: pinNewBoardName.trim(),
                                                                        privacy: pinNewBoardPrivacy,
                                                                    }),
                                                                })
                                                                const data = await res.json()
                                                                if (data.needsReconnect) {
                                                                    setPinNeedsReconnect(true)
                                                                    setPinShowCreateBoard(false)
                                                                    return
                                                                }
                                                                if (!res.ok) throw new Error(data.error || 'Failed')
                                                                const newBoard = data.board
                                                                setPinBoards(prev => [...prev, { id: newBoard.id, name: newBoard.name }])
                                                                setPinBoardId(newBoard.id)
                                                                setPinShowCreateBoard(false)
                                                                setPinNewBoardName('')
                                                            } catch (err) {
                                                                const msg = err instanceof Error ? err.message : 'Unknown error'
                                                                toast.error('Failed to create board: ' + msg)
                                                            } finally {
                                                                setPinCreatingBoard(false)
                                                            }
                                                        }}
                                                    >
                                                        {pinCreatingBoard ? '...' : 'Create'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Pin Title + AI Button */}
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] text-muted-foreground">Pin Title</Label>
                                            <button
                                                type="button"
                                                className="flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-500 transition-colors disabled:opacity-50 cursor-pointer"
                                                disabled={generatingMeta || !content.trim()}
                                                onClick={() => handleGenerateMetadata(['pinterest'])}
                                            >
                                                {generatingMeta ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                AI Fill
                                            </button>
                                        </div>
                                        <Input
                                            className="h-8 text-xs"
                                            placeholder="Enter pin title (max 100 chars)"
                                            maxLength={100}
                                            value={pinTitle}
                                            onChange={e => setPinTitle(e.target.value)}
                                        />
                                    </div>
                                    {/* Destination Link */}
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground">Destination Link</Label>
                                        <Input
                                            className="h-8 text-xs"
                                            placeholder="https://example.com"
                                            value={pinLink}
                                            onChange={e => setPinLink(e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Media Library Modal */}
                    {showMediaLibrary && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                            <Card className="w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                                <CardHeader className="pb-2 border-b space-y-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <FolderOpen className="h-4 w-4" />
                                            Media Library — {selectedChannel?.displayName}
                                            {attachedMedia.length > 0 && (
                                                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                                                    {attachedMedia.length} selected
                                                </span>
                                            )}
                                        </CardTitle>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => setLibShowNewFolder(true)} className="cursor-pointer h-7 px-2 text-[10px]" title="New Folder">
                                                <FolderPlus className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => libFileInputRef.current?.click()} disabled={libUploading} className="cursor-pointer h-7 px-2 text-[10px]" title="Upload">
                                                {libUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                            </Button>
                                            <input ref={libFileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { handleLibUpload(e.target.files); if (e.target) e.target.value = '' }} />
                                            <Button variant="ghost" size="sm" onClick={() => setShowMediaLibrary(false)} className="cursor-pointer h-7 px-2">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    {/* Search bar */}
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Search by filename..."
                                            value={libSearch}
                                            onChange={(e) => {
                                                setLibSearch(e.target.value)
                                                fetchLibrary(libFolderId, e.target.value)
                                            }}
                                            className="w-full h-7 pl-7 pr-3 text-xs rounded-md border bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    {/* Breadcrumbs */}
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        {libBreadcrumbs.map((bc, i) => (
                                            <span key={i} className="flex items-center gap-0.5">
                                                {i > 0 && <ChevronRight className="h-2.5 w-2.5" />}
                                                <button
                                                    onClick={() => navigateLibBreadcrumb(i)}
                                                    className={`hover:text-foreground transition-colors ${i === libBreadcrumbs.length - 1 ? 'text-foreground font-medium' : ''}`}
                                                >
                                                    {bc.name}
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <CardDescription className="text-[10px]">Click to add media. Hover for actions. Drag & drop files to upload.</CardDescription>
                                </CardHeader>

                                {/* Content area with drag-drop */}
                                <CardContent
                                    className={`overflow-y-auto flex-1 py-3 relative transition-colors ${libDragging ? 'bg-primary/5' : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setLibDragging(true) }}
                                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setLibDragging(false) }}
                                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setLibDragging(false); if (e.dataTransfer.files?.length) handleLibUpload(e.dataTransfer.files) }}
                                >
                                    {/* Drag overlay */}
                                    {libDragging && (
                                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
                                            <div className="text-center">
                                                <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
                                                <p className="text-sm font-medium text-primary">Drop files here to upload</p>
                                                {libFolderId && <p className="text-xs text-muted-foreground">Into current folder</p>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Create folder inline */}
                                    {libShowNewFolder && (
                                        <div className="mb-3 flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                                            <FolderPlus className="h-4 w-4 text-amber-500 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Folder name..."
                                                value={libNewFolderName}
                                                onChange={(e) => setLibNewFolderName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleLibCreateFolder()}
                                                className="flex-1 h-6 text-xs bg-transparent border-none focus:outline-none"
                                                autoFocus
                                            />
                                            <Button size="sm" className="h-6 px-2 text-[10px] cursor-pointer" onClick={handleLibCreateFolder} disabled={!libNewFolderName.trim()}>Create</Button>
                                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] cursor-pointer" onClick={() => { setLibShowNewFolder(false); setLibNewFolderName('') }}>Cancel</Button>
                                        </div>
                                    )}

                                    {loadingLibrary ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    ) : (
                                        <>
                                            {/* Folders */}
                                            {libFolders.length > 0 && (
                                                <div className="mb-3">
                                                    <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Folders</p>
                                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                                        {libFolders.map((folder) => (
                                                            <div key={folder.id} className="group relative">
                                                                <button
                                                                    onClick={() => navigateLibFolder(folder.id, folder.name)}
                                                                    className="w-full flex items-center gap-1.5 p-2 rounded-md border bg-card hover:bg-primary/6 transition-colors text-left"
                                                                >
                                                                    <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-medium truncate">{folder.name}</p>
                                                                        <p className="text-[9px] text-muted-foreground">{folder._count.media} files</p>
                                                                    </div>
                                                                </button>
                                                                {/* Delete folder button */}
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation()
                                                                        if (!confirm(`Delete folder "${folder.name}"? Contents will be moved to parent.`)) return
                                                                        try {
                                                                            const res = await fetch(`/api/admin/media/folders/${folder.id}`, { method: 'DELETE' })
                                                                            if (!res.ok) throw new Error()
                                                                            toast.success('Folder deleted')
                                                                            fetchLibrary()
                                                                        } catch {
                                                                            toast.error('Failed to delete folder')
                                                                        }
                                                                    }}
                                                                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                                                                >
                                                                    <X className="h-2.5 w-2.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Media grid */}
                                            {libraryMedia.length === 0 && libFolders.length === 0 ? (
                                                <div className="text-center py-12">
                                                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                                    <p className="text-sm text-muted-foreground">No media found{libSearch ? ` for "${libSearch}"` : ''}.</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Drag & drop files here or click the upload button.</p>
                                                </div>
                                            ) : libraryMedia.length > 0 && (
                                                <>
                                                    {libFolders.length > 0 && <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Files</p>}
                                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                                        {libraryMedia.map((media) => {
                                                            const isAttached = attachedMedia.some((m) => m.id === media.id)
                                                            return (
                                                                <div
                                                                    key={media.id}
                                                                    className={`relative rounded-lg overflow-hidden bg-muted aspect-square group transition-all ${isAttached ? 'ring-2 ring-primary opacity-60' : 'hover:ring-2 hover:ring-primary/50'
                                                                        }`}
                                                                >
                                                                    {/* Media content — click to add */}
                                                                    <div
                                                                        className="h-full w-full cursor-pointer"
                                                                        onClick={() => !isAttached && addFromLibrary(media)}
                                                                    >
                                                                        {isVideo(media) ? (
                                                                            <div className="relative h-full w-full bg-muted">
                                                                                <img
                                                                                    src={media.thumbnailUrl || media.url}
                                                                                    alt={media.originalName || ''}
                                                                                    className="h-full w-full object-cover"
                                                                                />
                                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                                    <div className="h-6 w-6 rounded-full bg-black/50 flex items-center justify-center">
                                                                                        <Play className="h-3 w-3 text-white ml-0.5" />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <img src={media.thumbnailUrl || media.url} alt={media.originalName || ''} className="h-full w-full object-cover" />
                                                                        )}
                                                                    </div>

                                                                    {/* Attached check overlay */}
                                                                    {isAttached && (
                                                                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center pointer-events-none">
                                                                            <Check className="h-5 w-5 text-primary" />
                                                                        </div>
                                                                    )}

                                                                    {/* Action buttons — top right on hover */}
                                                                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                                        {/* Rename */}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setLibRenameItem(media)
                                                                                setLibRenameName(media.originalName || '')
                                                                            }}
                                                                            className="h-5 w-5 rounded-full bg-foreground/80 text-background flex items-center justify-center cursor-pointer"
                                                                            title="Rename"
                                                                        >
                                                                            <Pencil className="h-2.5 w-2.5" />
                                                                        </button>
                                                                        {/* Delete */}
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation()
                                                                                if (!confirm(`Delete "${media.originalName}"? This cannot be undone.`)) return
                                                                                try {
                                                                                    const res = await fetch(`/api/admin/media/${media.id}`, { method: 'DELETE' })
                                                                                    if (!res.ok) throw new Error()
                                                                                    setLibraryMedia((prev) => prev.filter((m) => m.id !== media.id))
                                                                                    setAttachedMedia((prev) => prev.filter((m) => m.id !== media.id))
                                                                                    toast.success('Media deleted')
                                                                                } catch {
                                                                                    toast.error('Failed to delete media')
                                                                                }
                                                                            }}
                                                                            className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center cursor-pointer"
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 className="h-2.5 w-2.5" />
                                                                        </button>
                                                                    </div>

                                                                    {/* Filename */}
                                                                    <span className="absolute bottom-0 inset-x-0 text-[8px] bg-black/60 text-white px-1 py-0.5 truncate">
                                                                        {media.originalName}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </CardContent>

                                {/* Footer */}
                                <div className="border-t px-4 py-3 flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                        {libraryMedia.length} file{libraryMedia.length !== 1 ? 's' : ''}{libFolders.length > 0 ? `, ${libFolders.length} folder${libFolders.length !== 1 ? 's' : ''}` : ''}
                                    </span>
                                    <Button
                                        size="sm"
                                        onClick={() => setShowMediaLibrary(false)}
                                        className="cursor-pointer"
                                    >
                                        <Check className="h-4 w-4 mr-1" />
                                        Done
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Rename Media Dialog */}
                    {libRenameItem && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
                            <Card className="w-full max-w-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Rename Media</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <input
                                        type="text"
                                        value={libRenameName}
                                        onChange={(e) => setLibRenameName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleLibRename()}
                                        className="w-full h-8 px-3 text-xs rounded-md border bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => setLibRenameItem(null)} className="cursor-pointer">Cancel</Button>
                                        <Button size="sm" onClick={handleLibRename} disabled={!libRenameName.trim()} className="cursor-pointer">Rename</Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>

                {/* ── Right: Realistic Previews ── */}
                <div className={`lg:col-span-3 flex flex-col overflow-hidden ${mobileTab === 'preview' ? 'flex' : 'hidden'} lg:flex`}>
                    {/* Panel header */}
                    <div className="px-4 pt-4 pb-2 shrink-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Real-time Preview</p>
                    </div>
                    <div className="flex-1 overflow-y-auto pb-4 flex flex-col px-2">
                        {/* Platform switcher — OUTSIDE phone, above */}
                        {uniqueSelectedPlatforms.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap mb-2 px-1">
                                {uniqueSelectedPlatforms.map((platform) => {
                                    const isActive = effectivePreviewPlatform === platform
                                    return (
                                        <button
                                            key={platform}
                                            onClick={() => setPreviewPlatform(platform)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${isActive
                                                ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                                                : 'border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground'
                                                }`}
                                        >
                                            <span
                                                className="flex items-center justify-center h-5 w-5 rounded-full shrink-0 bg-background border border-border"
                                            >
                                                {platformBadgeIcons[platform] ?? <PlatformIcon platform={platform} size="xs" />}
                                            </span>
                                            <span className="capitalize">{platformLabels[platform] || platform}</span>
                                            {uniqueSelectedPlatforms.length > 1 && selectedEntries.filter((e) => e.platform === platform).length > 1 && (
                                                <span className="ml-0.5 bg-muted text-muted-foreground text-[9px] rounded-full px-1">
                                                    ×{selectedEntries.filter((e) => e.platform === platform).length}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Phone frame — correct aspect ratio, full column width */}
                        <div className="relative w-full" style={{ aspectRatio: '9 / 19.5' }}>
                            {/* Phone shell */}
                            <div className="absolute inset-0 rounded-[2.5rem] border-[3px] border-border/80 bg-card shadow-xl overflow-hidden">
                                {/* Notch */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-border/80 rounded-b-2xl z-10" />
                                {/* Status bar */}
                                <div className="flex items-center justify-between px-5 pt-6 pb-1">
                                    <span className="text-[9px] font-semibold text-muted-foreground">9:41</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3.5 h-2 rounded-[2px] border border-muted-foreground/50">
                                            <div className="w-2.5 h-full bg-muted-foreground/60 rounded-[1px]" />
                                        </div>
                                    </div>
                                </div>
                                {/* Screen content — scrollable inside phone. TikTok = full-bleed (no padding). Others get px-2 pb-6. */}
                                <div className={`overflow-y-auto absolute inset-0 top-[44px] ${effectivePreviewPlatform === 'tiktok' ? '' : 'px-2 pb-6'}`}>
                                    {(content.trim() || attachedMedia.length > 0 || Object.values(contentPerPlatform).some(v => v.trim())) && effectivePreviewPlatform ? (() => {
                                        const entry = selectedEntries.find((e) => e.platform === effectivePreviewPlatform)
                                        if (!entry) return null
                                        const name = entry.accountName
                                        const accountAvatar = getPlatformAvatar(entry)
                                        const accountsCount = selectedEntries.filter((e) => e.platform === effectivePreviewPlatform).length
                                        const previewContent = contentPerPlatform[effectivePreviewPlatform]?.trim() || content
                                        return (
                                            <>
                                                {(() => {
                                                    switch (effectivePreviewPlatform) {
                                                        case 'facebook':
                                                            return <FacebookPreview content={previewContent} media={attachedMedia} accountName={name} accountAvatar={accountAvatar} postType={fbPostTypes[entry.id] || 'feed'} mediaRatio={mediaRatio} firstComment={fbFirstComment || undefined} />
                                                        case 'instagram':
                                                            return <InstagramPreview content={previewContent} media={attachedMedia} accountName={name} accountAvatar={accountAvatar} mediaRatio={mediaRatio} />
                                                        case 'tiktok':
                                                            return <TikTokPreview content={previewContent} media={attachedMedia} accountName={name} accountAvatar={accountAvatar} mediaRatio={mediaRatio} postType={ttPostType} />
                                                        case 'x':
                                                        case 'twitter':
                                                            return <XPreview content={previewContent} accountName={name} accountAvatar={accountAvatar} />
                                                        case 'youtube':
                                                            return <YouTubePreview content={previewContent} media={attachedMedia} accountName={name} accountAvatar={accountAvatar} mediaRatio={mediaRatio} />
                                                        case 'linkedin':
                                                            return <LinkedInPreview content={previewContent} media={attachedMedia} accountName={name} accountAvatar={accountAvatar} mediaRatio={mediaRatio} />
                                                        default:
                                                            return <GenericPreview content={previewContent} media={attachedMedia} accountName={name} platform={effectivePreviewPlatform} mediaRatio={mediaRatio} />
                                                    }
                                                })()}
                                                {accountsCount > 1 && (
                                                    <p className="text-[9px] text-muted-foreground text-center mt-1">
                                                        +{accountsCount - 1} more {platformLabels[effectivePreviewPlatform] || effectivePreviewPlatform} accounts
                                                    </p>
                                                )}
                                            </>
                                        )
                                    })() : (
                                        /* Neeflow placeholder */
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                            <div className="w-14 h-14 rounded-3xl bg-primary/15 flex items-center justify-center shadow-inner overflow-hidden">
                                                {branding.logoUrl ? (
                                                    <img
                                                        src={branding.logoUrl}
                                                        alt={branding.appName}
                                                        className="w-10 h-10 object-contain"
                                                        onError={(e) => {
                                                            const el = e.currentTarget
                                                            el.style.display = 'none'
                                                            const fb = el.nextSibling as HTMLElement | null
                                                            if (fb) fb.style.display = 'flex'
                                                        }}
                                                    />
                                                ) : null}
                                                <span className="text-primary font-bold text-xl" style={{ display: branding.logoUrl ? 'none' : 'block' }}>
                                                    {branding.appName?.charAt(0) || 'N'}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-foreground/80 tracking-wide">{branding.appName || 'Neeflow'}</p>
                                            <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-4">
                                                {selectedEntries.length === 0 ? 'Select a platform to preview' : 'Start typing to preview your post'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                {/* Home indicator */}
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-border/70 rounded-full" />
                            </div>
                        </div>

                        {/* Schedule badge — below phone */}
                        {scheduleDate && (
                            <div className="mt-3 shrink-0">
                                <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-xl px-3 py-2">
                                    <Clock className="h-4 w-4 text-primary shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium">Scheduled</p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {new Date(`${scheduleDate}T${scheduleTime || '00:00'}`).toLocaleString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Schedule section (full) — below phone ── */}
                        <div className="mt-3 shrink-0 border border-border/60 rounded-xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {t('compose.schedule')}
                                </div>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
                                    📅 Today, {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                </span>
                            </div>
                            {/* Body */}
                            <div className="px-3 py-2.5 space-y-3">

                                {/* AI Best Time button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs cursor-pointer gap-2 border-amber-400/40 hover:border-amber-400 hover:bg-amber-50/10"
                                    disabled={!selectedChannel || generating || aiScheduleLoading}
                                    onClick={async () => {
                                        if (!selectedChannel) return
                                        const platforms = activePlatforms
                                            .filter((p) => selectedPlatformIds.has(p.id))
                                            .map((p) => p.platform)
                                        if (platforms.length === 0) {
                                            toast.error('Select at least one platform')
                                            return
                                        }
                                        setAiScheduleLoading(true)
                                        setAiHeatmap(null)
                                        try {
                                            const res = await fetch('/api/admin/posts/suggest-schedule', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    channelId: selectedChannel.id,
                                                    platforms,
                                                    content: content.slice(0, 200),
                                                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                                    viewMonth: heatmapViewMonth,
                                                    viewYear: heatmapViewYear,
                                                }),
                                            })
                                            const data = await res.json()
                                            if (!res.ok) {
                                                toast.error(data.error || 'Failed to get suggestions')
                                                return
                                            }
                                            setAiHeatmap(data)
                                            // Auto-select best day to show hourly
                                            if (data.bestDay) setHeatmapSelectedDay(data.bestDay)
                                            toast.success('✨ AI schedule heatmap ready!')
                                        } catch {
                                            toast.error('Failed to get AI suggestions')
                                        } finally {
                                            setAiScheduleLoading(false)
                                        }
                                    }}
                                >
                                    {aiScheduleLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                                    {aiScheduleLoading ? 'Analyzing best times...' : '✨ AI Best Time'}
                                </Button>

                                {/* ── Heatmap Calendar ── */}
                                {aiHeatmap && (() => {
                                    const { dayScores, holidays, bestDay, bestTime, bestDayHourlyScores, engagement } = aiHeatmap
                                    const today = new Date()
                                    const todayStr2 = today.toISOString().split('T')[0]
                                    const daysInViewMonth = new Date(heatmapViewYear, heatmapViewMonth, 0).getDate()
                                    const firstDayOfMonth = new Date(heatmapViewYear, heatmapViewMonth - 1, 1).getDay() // 0=Sun
                                    // Shift to Mon-start: Sun→6, Mon→0, Tue→1, …
                                    const startOffset = (firstDayOfMonth + 6) % 7
                                    const monthName = new Date(heatmapViewYear, heatmapViewMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                                    const holidayMap: Record<string, string> = {}
                                    holidays.forEach(h => { holidayMap[h.date] = h.name })

                                    // Color: score 0-19=very faint, 20-49=light, 50-79=medium, 80-100=dark/full
                                    const scoreToClass = (score: number, isSelected: boolean, isBest: boolean) => {
                                        if (isSelected) return 'bg-primary ring-2 ring-primary text-primary-foreground font-bold scale-110 shadow-md shadow-primary/30'
                                        if (isBest && !isSelected) return 'bg-primary/90 text-primary-foreground font-bold ring-1 ring-primary/60'
                                        if (score >= 80) return 'bg-emerald-500/80 dark:bg-emerald-400/70 text-white font-semibold'
                                        if (score >= 60) return 'bg-emerald-500/55 dark:bg-emerald-500/50 text-white font-medium'
                                        if (score >= 40) return 'bg-emerald-500/35 dark:bg-emerald-500/35 text-foreground'
                                        if (score >= 20) return 'bg-emerald-500/18 dark:bg-emerald-500/20 text-muted-foreground'
                                        return 'bg-muted/40 text-muted-foreground/50'
                                    }

                                    const activeDayHourly = aiHeatmap.bestDayHourlyScores || bestDayHourlyScores

                                    const selectedDayLabel = heatmapSelectedDay
                                        ? new Date(heatmapSelectedDay + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : ''

                                    return (
                                        <div className="space-y-2.5">
                                            {/* Month header + nav */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-semibold text-foreground">{monthName}</span>
                                                <div className="flex gap-0.5">
                                                    <button
                                                        onClick={() => {
                                                            const prev = new Date(heatmapViewYear, heatmapViewMonth - 2, 1)
                                                            setHeatmapViewMonth(prev.getMonth() + 1)
                                                            setHeatmapViewYear(prev.getFullYear())
                                                        }}
                                                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                                                    >
                                                        <ChevronLeft className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const next = new Date(heatmapViewYear, heatmapViewMonth, 1)
                                                            setHeatmapViewMonth(next.getMonth() + 1)
                                                            setHeatmapViewYear(next.getFullYear())
                                                        }}
                                                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                                                    >
                                                        <ChevronRight className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Day-of-week headers — Mon-Sun */}
                                            <div className="grid grid-cols-7 gap-0.5">
                                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                                                    <div key={i} className="text-center text-[9px] font-bold text-muted-foreground/60 pb-0.5">{d}</div>
                                                ))}

                                                {/* Empty cells before day 1 */}
                                                {Array.from({ length: startOffset }).map((_, i) => (
                                                    <div key={`empty-${i}`} className="aspect-square" />
                                                ))}

                                                {/* Day cells */}
                                                {Array.from({ length: daysInViewMonth }).map((_, i) => {
                                                    const dayNum = i + 1
                                                    const mm = String(heatmapViewMonth).padStart(2, '0')
                                                    const dd = String(dayNum).padStart(2, '0')
                                                    const dateStr = `${heatmapViewYear}-${mm}-${dd}`
                                                    const score = dayScores[dateStr] ?? 0
                                                    const isToday = dateStr === todayStr2
                                                    const isSelected = heatmapSelectedDay === dateStr
                                                    const isBest = dateStr === bestDay
                                                    const isPast = dateStr < todayStr2
                                                    const holiday = holidayMap[dateStr]

                                                    return (
                                                        <div key={dateStr} className="relative">
                                                            <button
                                                                title={holiday ? `🎉 ${holiday} — Score: ${score}` : `Score: ${score}`}
                                                                disabled={isPast}
                                                                onClick={async () => {
                                                                    setHeatmapSelectedDay(dateStr)
                                                                    setScheduleDate(dateStr)
                                                                    // Re-fetch hourly breakdown for selected day
                                                                    if (isPast || !selectedChannel) return
                                                                    const platforms2 = activePlatforms
                                                                        .filter(p => selectedPlatformIds.has(p.id))
                                                                        .map(p => p.platform)
                                                                    setAiHourlyLoading(true)
                                                                    try {
                                                                        const res2 = await fetch('/api/admin/posts/suggest-schedule', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({
                                                                                channelId: selectedChannel.id,
                                                                                platforms: platforms2,
                                                                                content: content.slice(0, 200),
                                                                                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                                                                viewMonth: heatmapViewMonth,
                                                                                viewYear: heatmapViewYear,
                                                                                selectedDay: dateStr,
                                                                            }),
                                                                        })
                                                                        const d2 = await res2.json()
                                                                        if (res2.ok) {
                                                                            // Merge: keep dayScores from original, update hourly + bestTime
                                                                            setAiHeatmap((prev) => prev ? {
                                                                                ...prev,
                                                                                bestDayHourlyScores: d2.bestDayHourlyScores,
                                                                                bestTime: d2.bestTime,
                                                                                hourlyForDay: d2.hourlyForDay,
                                                                                engagement: d2.engagement,
                                                                                reason: d2.reason,
                                                                            } : prev)
                                                                        }
                                                                    } catch { /* silent */ } finally {
                                                                        setAiHourlyLoading(false)
                                                                    }
                                                                }}
                                                                className={`w-full aspect-square rounded-[3px] flex items-center justify-center text-[10px] transition-all duration-150 cursor-pointer relative ${isPast ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110 hover:z-10'} ${scoreToClass(score, isSelected, isBest)}`}
                                                            >
                                                                {dayNum}
                                                                {isToday && !isSelected && (
                                                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 border border-background" />
                                                                )}
                                                                {holiday && (
                                                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 border border-background" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Legend dots */}
                                            <div className="flex items-center gap-3 px-0.5 text-[9px] text-muted-foreground">
                                                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />Today</div>
                                                {holidays.length > 0 && <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Holiday</div>}
                                                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />Best day</div>
                                            </div>

                                            {/* Holidays list */}
                                            {holidays.filter(h => h.date.startsWith(`${heatmapViewYear}-${String(heatmapViewMonth).padStart(2, '0')}`)).length > 0 && (
                                                <div className="space-y-1">
                                                    {holidays.filter(h => h.date.startsWith(`${heatmapViewYear}-${String(heatmapViewMonth).padStart(2, '0')}`)).map(h => (
                                                        <div key={h.date} className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                                                            <span>🎉</span>
                                                            <span className="font-medium">{new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                            <span className="text-muted-foreground">—</span>
                                                            <span>{h.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Hourly heatmap for selected day */}
                                            {heatmapSelectedDay && (
                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] font-semibold text-foreground/70 flex items-center gap-1.5">
                                                        Hourly engagement — {selectedDayLabel}
                                                        {aiHourlyLoading && <span className="text-[9px] text-muted-foreground animate-pulse">↻ updating...</span>}
                                                    </div>
                                                    <div className="grid grid-cols-6 gap-1">
                                                        {Array.from({ length: 24 }).map((_, hr) => {
                                                            const hrStr = String(hr).padStart(2, '0')
                                                            const hrScore = activeDayHourly[hrStr] ?? 0
                                                            const isSelectedHour = scheduleTime === `${hrStr}:00`
                                                            const hrOpacity = hrScore >= 80 ? 'bg-emerald-500/85 text-white font-bold'
                                                                : hrScore >= 60 ? 'bg-emerald-500/60 text-white font-semibold'
                                                                    : hrScore >= 40 ? 'bg-emerald-500/38 text-foreground'
                                                                        : hrScore >= 20 ? 'bg-emerald-500/20 text-muted-foreground'
                                                                            : 'bg-muted/40 text-muted-foreground/40'
                                                            return (
                                                                <button
                                                                    key={hrStr}
                                                                    title={`${hrStr}:00 — Score: ${hrScore}`}
                                                                    onClick={() => setScheduleTime(`${hrStr}:00`)}
                                                                    className={`h-7 rounded text-[9px] transition-all duration-100 cursor-pointer hover:scale-105 ${isSelectedHour ? 'ring-2 ring-primary bg-primary text-primary-foreground font-bold' : hrOpacity}`}
                                                                >
                                                                    {hrStr}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                    {/* Legend gradient */}
                                                    <div className="mt-1 space-y-0.5">
                                                        <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-muted/50 via-emerald-500/40 to-emerald-500/90" />
                                                        <div className="flex justify-between text-[9px] text-muted-foreground">
                                                            <span>Low</span><span>Good</span><span className="text-emerald-600 dark:text-emerald-400 font-bold">Best</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Recommended Slot */}
                                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/8 border border-primary/25">
                                                <div className="space-y-0.5">
                                                    <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">AI Recommended</p>
                                                    <p className="text-sm font-bold text-foreground">
                                                        {new Date(bestDay + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {bestTime}
                                                    </p>
                                                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                        <TrendingUp className="h-2.5 w-2.5" />
                                                        {engagement}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-[11px] px-3 cursor-pointer"
                                                    onClick={() => {
                                                        setScheduleDate(bestDay)
                                                        setScheduleTime(bestTime)
                                                        setHeatmapSelectedDay(bestDay)
                                                        toast.success('Best time applied!')
                                                    }}
                                                >
                                                    Use This
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Manual Date + Time inputs (always visible) */}
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground">{t('compose.scheduleDate')}</Label>
                                        <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="mt-0.5 h-7 text-xs" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground">{t('compose.scheduleTime')}</Label>
                                        <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="mt-0.5 h-7 text-xs" />
                                    </div>
                                </div>

                                {/* Timezone + Clear */}
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground">
                                        🌐 {(selectedChannel as any)?.timezone || 'UTC'}
                                    </span>
                                    {scheduleDate && (
                                        <Button variant="ghost" size="sm" onClick={() => { setScheduleDate(''); setScheduleTime(''); setAiScheduleSuggestions([]); setAiHeatmap(null); setHeatmapSelectedDay(null) }} className="text-xs cursor-pointer h-6 px-2">
                                            <X className="h-3 w-3 mr-1" /> Clear
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Image Lightbox ── */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer animate-in fade-in duration-200"
                    onClick={() => setLightboxUrl(null)}
                    onKeyDown={(e) => e.key === 'Escape' && setLightboxUrl(null)}
                    tabIndex={0}
                    role="dialog"
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); setLightboxUrl(null) }}
                        className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer z-10"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt="Full size preview"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )
            }

            {/* ── AI Image Studio Dialog ── */}
            <Dialog open={showImagePicker} onOpenChange={(open) => { setShowImagePicker(open) }}>
                <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-hidden p-0 text-white flex flex-col" showCloseButton={false}
                    style={{ background: '#0e1a14', border: '1px solid rgba(43,238,157,0.12)' }}>

                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(43,238,157,0.1)', background: 'rgba(16,34,26,0.8)' }}>
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#2bee9d,#1ab87a)' }}>
                                <Sparkles className="h-4 w-4 text-[#0e1a14]" />
                            </div>
                            <span className="text-sm font-bold tracking-tight" style={{ color: '#2bee9d' }}>AI Image Studio</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            {imageQuota.limit > 0 && (
                                <span className="text-[11px] px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(43,238,157,0.12)', color: '#2bee9d' }}>
                                    {imageQuota.used}/{imageQuota.limit} used
                                </span>
                            )}
                            {imageQuota.limit === -1 && (
                                <span className="text-[11px] px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(43,238,157,0.12)', color: '#2bee9d' }}>∞ unlimited</span>
                            )}
                            <button type="button" onClick={() => setShowImagePicker(false)} className="h-8 w-8 rounded-full flex items-center justify-center transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <X className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                            </button>
                        </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="flex flex-1 min-h-0 overflow-hidden">

                        {/* ════ LEFT: Branding Kit + Recent AI Images ════ */}
                        <div className="w-[240px] shrink-0 flex flex-col overflow-y-auto p-4 gap-5" style={{ borderRight: '1px solid rgba(43,238,157,0.1)' }}>

                            {/* BRANDING KIT */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(43,238,157,0.5)' }}>Branding Kit</p>

                                <label className="flex items-center gap-2.5 cursor-pointer mb-4">
                                    <div
                                        onClick={() => {
                                            const next = !brandingEnabled
                                            setBrandingEnabled(next)
                                            if (selectedChannel) {
                                                try { localStorage.setItem(`studio-branding-${selectedChannel.id}`, JSON.stringify({ logoDataUrl: brandLogoDataUrl, position: brandLogoPosition, opacity: brandLogoOpacity, enabled: next })) } catch { }
                                            }
                                        }}
                                        className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                                        style={{ background: brandingEnabled ? '#2bee9d' : 'rgba(255,255,255,0.12)' }}
                                    >
                                        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: brandingEnabled ? 'translateX(22px)' : 'translateX(2px)' }} />
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Apply Watermark</span>
                                </label>

                                <div
                                    onClick={() => brandLogoInputRef.current?.click()}
                                    className="relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all overflow-hidden mb-3"
                                    style={{ height: '88px', borderColor: brandingEnabled ? 'rgba(43,238,157,0.35)' : 'rgba(255,255,255,0.08)', opacity: brandingEnabled ? 1 : 0.4, pointerEvents: brandingEnabled ? 'auto' : 'none' }}
                                >
                                    {brandLogoDataUrl ? (
                                        <img src={brandLogoDataUrl} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" style={{ color: 'rgba(43,238,157,0.4)' }} />
                                            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Upload Logo</p>
                                        </>
                                    )}
                                </div>
                                <input ref={brandLogoInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    const reader = new FileReader()
                                    reader.onload = ev => {
                                        const url = ev.target?.result as string
                                        setBrandLogoDataUrl(url)
                                        if (selectedChannel) { try { localStorage.setItem(`studio-branding-${selectedChannel.id}`, JSON.stringify({ logoDataUrl: url, position: brandLogoPosition, opacity: brandLogoOpacity, enabled: brandingEnabled })) } catch { } }
                                    }
                                    reader.readAsDataURL(file)
                                    if (e.target) e.target.value = ''
                                }} />

                                <div style={{ opacity: brandingEnabled ? 1 : 0.3, pointerEvents: brandingEnabled ? 'auto' : 'none' }}>
                                    <p className="text-[10px] mb-1.5" style={{ color: 'rgba(43,238,157,0.5)' }}>Position</p>
                                    <div className="grid grid-cols-3 gap-1 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(43,238,157,0.08)' }}>
                                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(pos => (
                                            <button key={pos} type="button"
                                                onClick={() => { setBrandLogoPosition(pos); if (selectedChannel) { try { localStorage.setItem(`studio-branding-${selectedChannel.id}`, JSON.stringify({ logoDataUrl: brandLogoDataUrl, position: pos, opacity: brandLogoOpacity, enabled: brandingEnabled })) } catch { } } }}
                                                className="h-7 rounded transition-all cursor-pointer"
                                                style={brandLogoPosition === pos ? { background: '#2bee9d', boxShadow: '0 0 10px rgba(43,238,157,0.4)' } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-3" style={{ opacity: brandingEnabled ? 1 : 0.3, pointerEvents: brandingEnabled ? 'auto' : 'none' }}>
                                    <p className="text-[10px] mb-1.5" style={{ color: 'rgba(43,238,157,0.5)' }}>Opacity: {brandLogoOpacity}%</p>
                                    <input type="range" min={10} max={100} value={brandLogoOpacity}
                                        onChange={e => { const v = Number(e.target.value); setBrandLogoOpacity(v); if (selectedChannel) { try { localStorage.setItem(`studio-branding-${selectedChannel.id}`, JSON.stringify({ logoDataUrl: brandLogoDataUrl, position: brandLogoPosition, opacity: v, enabled: brandingEnabled })) } catch { } } }}
                                        className="w-full h-1.5 rounded-full cursor-pointer" style={{ accentColor: '#2bee9d' }}
                                    />
                                </div>
                            </div>

                            {/* RECENT AI IMAGES */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(43,238,157,0.5)' }}>Recent AI Images</p>
                                {loadingAiHistory ? (
                                    <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" style={{ color: 'rgba(43,238,157,0.4)' }} /></div>
                                ) : aiHistoryMedia.length === 0 ? (
                                    <p className="text-[11px] text-center py-3" style={{ color: 'rgba(255,255,255,0.2)' }}>No AI images yet</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {aiHistoryMedia.slice(0, 12).map(item => (
                                            <button key={item.id} type="button" title={item.originalName || 'AI image'}
                                                onClick={() => { addFromLibrary(item); setShowImagePicker(false) }}
                                                className="aspect-square rounded-lg overflow-hidden transition-all cursor-pointer"
                                                style={{ border: '1px solid rgba(43,238,157,0.1)' }}
                                            >
                                                <img src={item.url} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ════ RIGHT: AI Controls ════ */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">

                            {/* AI ENGINE */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(43,238,157,0.5)' }}>AI Engine</p>
                                <div className="space-y-2">
                                    {(() => {
                                        const currentSelectValue = overrideImageProvider || '__auto__'
                                        const rawProvider = (() => {
                                            if (!currentSelectValue || currentSelectValue === '__auto__') return selectedChannel?.defaultImageProvider || ''
                                            const parts = currentSelectValue.split(':')
                                            return parts.length > 1 ? parts.slice(1).join(':') : parts[0]
                                        })()
                                        const handleProviderChange = (selectVal: string) => {
                                            if (selectVal === '__auto__') { setOverrideImageProvider(''); return }
                                            setOverrideImageProvider(selectVal)
                                            setOverrideImageModel('')
                                            setAvailableImageModels([])
                                            const [source, ...rest] = selectVal.split(':')
                                            const providerName = rest.join(':')
                                            if (providerName) {
                                                if (source === 'plan') {
                                                    setLoadingImageModels(true)
                                                    fetch('/api/admin/posts/plan-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: providerName }) })
                                                        .then(r => r.json()).then(d => { setAvailableImageModels((d.models || []).map((m: { id: string; name?: string }) => ({ id: m.id, name: m.name || MODEL_DISPLAY_NAMES[m.id] || m.id, type: 'image' as const }))) })
                                                        .catch(() => { }).finally(() => setLoadingImageModels(false))
                                                } else {
                                                    setLoadingImageModels(true)
                                                    fetch('/api/user/api-keys/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: providerName }) })
                                                        .then(r => r.json()).then(d => { setAvailableImageModels((d.models || []).filter((m: { type?: string }) => m.type === 'image')) })
                                                        .catch(() => { }).finally(() => setLoadingImageModels(false))
                                                }
                                            }
                                        }
                                        return (
                                            <Select value={currentSelectValue} onValueChange={handleProviderChange}>
                                                <SelectTrigger className="w-full h-10 text-sm focus:ring-0" style={{ background: 'rgba(43,238,157,0.05)', border: '1px solid rgba(43,238,157,0.15)', color: 'white' }}>
                                                    <SelectValue>
                                                        {rawProvider ? (byokProviders.find(p => p.provider === rawProvider)?.name || planProviders.find(p => p.provider === rawProvider)?.name || rawProvider) : 'Auto-detect provider'}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent style={{ background: '#162e24', border: '1px solid rgba(43,238,157,0.15)', color: 'white' }}>
                                                    <SelectItem value="__auto__" className="text-sm">Auto-detect provider</SelectItem>
                                                    {byokProviders.length > 0 && (<>
                                                        <div className="px-2 py-1 text-[10px] font-bold" style={{ color: 'rgba(43,238,157,0.5)' }}>📌 YOUR KEYS (unlimited)</div>
                                                        {byokProviders.map(p => <SelectItem key={`byok-${p.provider}`} value={`byok:${p.provider}`} className="text-sm">{p.name}</SelectItem>)}
                                                    </>)}
                                                    {planProviders.length > 0 && imageQuota.limit !== 0 && (<>
                                                        <div className="px-2 py-1 text-[10px] font-bold" style={{ color: 'rgba(43,238,157,0.5)' }}>⚡ PLAN ({imageQuota.limit === -1 ? '∞' : `${imageQuota.limit - imageQuota.used} left`})</div>
                                                        {planProviders.map(p => <SelectItem key={`plan-${p.provider}`} value={`plan:${p.provider}`} className="text-sm">{p.name}</SelectItem>)}
                                                    </>)}
                                                </SelectContent>
                                            </Select>
                                        )
                                    })()}
                                    <div className="relative">
                                        <select value={overrideImageModel || selectedChannel?.defaultImageModel || ''} onChange={e => setOverrideImageModel(e.target.value)} disabled={loadingImageModels}
                                            className="w-full h-10 text-sm rounded-lg px-3 focus:outline-none disabled:opacity-50"
                                            style={{ background: 'rgba(43,238,157,0.05)', border: '1px solid rgba(43,238,157,0.15)', color: 'white' }}>
                                            <option value="">Default model</option>
                                            {availableImageModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        {loadingImageModels && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin" style={{ color: 'rgba(43,238,157,0.5)' }} />}
                                    </div>
                                    {byokProviders.length === 0 && planProviders.length === 0 && (
                                        <p className="text-[11px] rounded-lg px-3 py-2" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                                            ⚠️ No providers. Add an API key in <strong>API Hub</strong> or upgrade your plan.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* ASPECT RATIO */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(43,238,157,0.5)' }}>Aspect Ratio</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { value: '1:1' as const, label: '1:1' },
                                        { value: '16:9' as const, label: '16:9' },
                                        { value: '9:16' as const, label: '9:16' },
                                        { value: '4:3' as const, label: '4:3' },
                                        { value: '3:4' as const, label: '3:4' },
                                        { value: '4:5' as const, label: '4:5' },
                                    ] as { value: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '4:5', label: string }[]).map(r => (
                                        <button key={r.value} type="button" onClick={() => setImageAspectRatio(r.value)}
                                            className="py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                                            style={imageAspectRatio === r.value
                                                ? { background: '#2bee9d', color: '#0e1a14', boxShadow: '0 0 12px rgba(43,238,157,0.3)' }
                                                : { background: 'rgba(43,238,157,0.05)', border: '1px solid rgba(43,238,157,0.12)', color: 'rgba(255,255,255,0.5)' }}>
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* REFERENCE IMAGE — with drag & drop */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(43,238,157,0.5)' }}>Reference Image</p>
                                <div
                                    onClick={() => { if (!refImageDataUrl) refImageInputRef.current?.click() }}
                                    onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                                    onDragEnter={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#2bee9d' }}
                                    onDragLeave={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(43,238,157,0.2)' }}
                                    onDrop={e => {
                                        e.preventDefault(); e.stopPropagation();
                                        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(43,238,157,0.2)'
                                        const file = e.dataTransfer.files?.[0]
                                        if (!file || !file.type.startsWith('image/')) return
                                        setRefImageFile(file)
                                        const reader = new FileReader()
                                        reader.onload = ev => setRefImageDataUrl(ev.target?.result as string)
                                        reader.readAsDataURL(file)
                                    }}
                                    className="relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden"
                                    style={{ height: '100px', borderColor: 'rgba(43,238,157,0.2)', cursor: refImageDataUrl ? 'default' : 'pointer' }}
                                >
                                    {refImageDataUrl ? (
                                        <>
                                            <img src={refImageDataUrl} alt="Ref" className="h-full w-full object-contain p-1" />
                                            <button type="button" onClick={e => { e.stopPropagation(); setRefImageDataUrl(null); setRefImageFile(null) }}
                                                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center"
                                                style={{ background: 'rgba(0,0,0,0.7)' }}>
                                                <X className="h-3 w-3 text-white" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(43,238,157,0.4)' }}>
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                            </svg>
                                            <p className="text-xs font-medium" style={{ color: 'rgba(43,238,157,0.5)' }}>Drop image or click to upload</p>
                                        </>
                                    )}
                                </div>
                                <input ref={refImageInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    setRefImageFile(file)
                                    const reader = new FileReader()
                                    reader.onload = ev => setRefImageDataUrl(ev.target?.result as string)
                                    reader.readAsDataURL(file)
                                    if (e.target) e.target.value = ''
                                }} />

                                {/* Similarity strength slider — only when ref image uploaded */}
                                {refImageDataUrl && (
                                    <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(43,238,157,0.05)', border: '1px solid rgba(43,238,157,0.12)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(43,238,157,0.6)' }}>Similarity to Reference</p>
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(43,238,157,0.15)', color: '#2bee9d' }}>{refImageStrength}%</span>
                                        </div>
                                        <input
                                            type="range" min={10} max={100} step={5} value={refImageStrength}
                                            onChange={e => setRefImageStrength(Number(e.target.value))}
                                            className="w-full h-1.5 rounded-full cursor-pointer"
                                            style={{ accentColor: '#2bee9d' }}
                                        />
                                        <div className="flex justify-between mt-1.5">
                                            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Creative freedom</span>
                                            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Copy exactly</span>
                                        </div>
                                        {/* Quick presets */}
                                        <div className="flex gap-1.5 mt-2">
                                            {[{ v: 30, label: '30% Creative' }, { v: 70, label: '70% Similar' }, { v: 100, label: '100% Clone' }].map(p => (
                                                <button key={p.v} type="button" onClick={() => setRefImageStrength(p.v)}
                                                    className="flex-1 py-1 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                                                    style={refImageStrength === p.v
                                                        ? { background: '#2bee9d', color: '#0e1a14' }
                                                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(43,238,157,0.12)', color: 'rgba(255,255,255,0.4)' }}>
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* TYPOGRAPHY */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(43,238,157,0.5)' }}>Typography</p>
                                <div className="space-y-2">
                                    <input type="text" placeholder="Text to render in image..." value={typoText} onChange={e => setTypoText(e.target.value)}
                                        className="w-full h-10 rounded-lg px-3 text-sm placeholder:text-white/25 focus:outline-none"
                                        style={{ background: 'rgba(43,238,157,0.05)', border: '1px solid rgba(43,238,157,0.15)', color: 'white' }} />
                                    <select value={typoFont} onChange={e => setTypoFont(e.target.value)} className="w-full h-10 rounded-lg px-3 text-sm focus:outline-none"
                                        style={{ background: 'rgba(43,238,157,0.05)', border: '1px solid rgba(43,238,157,0.15)', color: 'white' }}>
                                        {['Inter', 'Space Grotesk', 'Playfair Display', 'Montserrat', 'Roboto', 'Oswald', 'Bebas Neue'].map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* PROMPT + STYLE PRESETS */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(43,238,157,0.5)' }}>Prompt & Style</p>

                                {/* Style preset grid — 3 columns so nothing is cut */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {([
                                        {
                                            id: '', label: 'None', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                                            )
                                        },
                                        {
                                            id: 'cinematic', label: 'Cinematic', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M7 6V18M17 6V18M2 10h20M2 14h20" stroke="currentColor" strokeWidth="1.5" /></svg>
                                            )
                                        },
                                        {
                                            id: '3d-render', label: '3D Render', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                                            )
                                        },
                                        {
                                            id: 'cyberpunk', label: 'Cyberpunk', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M13 2L4.5 13.5H11L10.5 22L19.5 10.5H13L13 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                                            )
                                        },
                                        {
                                            id: 'anime', label: 'Anime', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M6 8c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.5" /><path d="M3 20c0-3.87 4.03-7 9-7s9 3.13 9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                            )
                                        },
                                        {
                                            id: 'neon', label: 'Neon', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                            )
                                        },
                                        {
                                            id: 'minimalist', label: 'Minimal', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" /><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                            )
                                        },
                                        {
                                            id: 'ethereal', label: 'Ethereal', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M2 12c2-4 5-6 10-6s8 2 10 6c-2 4-5 6-10 6S4 16 2 12z" stroke="currentColor" strokeWidth="1.5" /><path d="M6 6c0 4 2.5 7 6 7s6-3 6-7" stroke="currentColor" strokeWidth="1.5" /></svg>
                                            )
                                        },
                                        {
                                            id: 'vintage', label: 'Vintage', icon: (
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /><circle cx="18" cy="7" r="1" fill="currentColor" /></svg>
                                            )
                                        },
                                    ] as { id: string, label: string, icon: React.ReactNode }[]).map(s => (
                                        <button key={s.id} type="button" onClick={() => setSelectedStyle(s.id)}
                                            className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all cursor-pointer"
                                            style={selectedStyle === s.id
                                                ? { background: 'rgba(43,238,157,0.12)', border: '1.5px solid #2bee9d', boxShadow: '0 0 12px rgba(43,238,157,0.2)', color: '#2bee9d' }
                                                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(43,238,157,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                                            {s.icon}
                                            <span className="text-[9px] font-bold uppercase tracking-tight">{s.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Dual mode toggle */}
                                {content.trim() && (
                                    <div className="flex gap-1.5 mb-3">
                                        <button type="button" onClick={() => { setUseContentAsPrompt(true); setAiImagePrompt(content.substring(0, 500)) }}
                                            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-1"
                                            style={useContentAsPrompt ? { background: 'rgba(43,238,157,0.12)', border: '1px solid rgba(43,238,157,0.4)', color: '#2bee9d' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                                            <Sparkles className="h-3.5 w-3.5" />
                                            Auto from Content
                                        </button>
                                        <button type="button" onClick={() => { setUseContentAsPrompt(false); setAiImagePrompt('') }}
                                            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex flex-col items-center gap-1"
                                            style={!useContentAsPrompt ? { background: 'rgba(43,238,157,0.12)', border: '1px solid rgba(43,238,157,0.4)', color: '#2bee9d' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                                            <Pencil className="h-3.5 w-3.5" />
                                            Custom Prompt
                                        </button>
                                    </div>
                                )}

                                {useContentAsPrompt && content.trim() ? (
                                    <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(43,238,157,0.05)', border: '1px solid rgba(43,238,157,0.12)' }}>
                                        <p className="text-xs line-clamp-3" style={{ color: 'rgba(255,255,255,0.45)' }}>{content.substring(0, 250)}{content.length > 250 ? '...' : ''}</p>
                                        <p className="text-[10px] mt-1.5" style={{ color: 'rgba(43,238,157,0.4)' }}>AI will match this content</p>
                                    </div>
                                ) : (
                                    <textarea placeholder="Describe the image you want to generate..." value={aiImagePrompt}
                                        onChange={e => setAiImagePrompt(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && e.ctrlKey && aiImagePrompt.trim() && handleAiImageGenerate()}
                                        rows={3} className="w-full rounded-xl px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none resize-none mb-3"
                                        style={{ background: 'rgba(43,238,157,0.05)', border: '1px solid rgba(43,238,157,0.15)', color: 'white' }} />
                                )}

                                {visualIdea && !useContentAsPrompt && (
                                    <p className="text-[11px] mb-3" style={{ color: 'rgba(43,238,157,0.5)' }}>💡 {visualIdea}</p>
                                )}

                                <button type="button" onClick={handleAiImageGenerate}
                                    disabled={generatingImage || (!aiImagePrompt.trim() && !useContentAsPrompt) || !selectedChannel}
                                    className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                                    style={{ background: 'linear-gradient(135deg, #2bee9d, #1ab87a)', color: '#0e1a14', boxShadow: '0 0 24px rgba(43,238,157,0.25)', opacity: (generatingImage || (!aiImagePrompt.trim() && !useContentAsPrompt) || !selectedChannel) ? 0.4 : 1 }}>
                                    {generatingImage ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate Image</>}
                                </button>

                                {aiGeneratedPreview && !generatingImage && (
                                    <div className="mt-4 space-y-3">
                                        <div className="relative rounded-xl overflow-hidden aspect-video" style={{ background: 'rgba(0,0,0,0.4)' }}>
                                            <img src={aiGeneratedPreview} alt="AI Generated" className="w-full h-full object-contain" />
                                        </div>
                                        {lastUsedImageModel && (
                                            <p className="text-[11px] flex items-center gap-1" style={{ color: 'rgba(43,238,157,0.6)' }}>
                                                <Check className="h-3 w-3" style={{ color: '#2bee9d' }} /> Generated with {lastUsedImageModel}
                                            </p>
                                        )}
                                        <div className="flex gap-2">
                                            <button type="button" onClick={handleAiImageGenerate} disabled={generatingImage} className="flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                                                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                                            </button>
                                            <button type="button" onClick={() => setShowImagePicker(false)} className="flex-1 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-semibold" style={{ background: 'rgba(43,238,157,0.15)', border: '1px solid rgba(43,238,157,0.3)', color: '#2bee9d' }}>
                                                <Check className="h-3.5 w-3.5" /> Done
                                            </button>
                                        </div>
                                        <p className="text-[11px] flex items-center gap-1" style={{ color: '#2bee9d' }}>
                                            <Check className="h-3 w-3" /> Saved to media library &amp; attached
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Thumbnail Style Selector Modal ── */}
            < Dialog open={styleModalOpen} onOpenChange={setStyleModalOpen} >
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Palette className="h-5 w-5 text-purple-500" />
                            Choose Thumbnail Style
                        </DialogTitle>
                    </DialogHeader>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search styles..."
                            value={styleSearch}
                            onChange={(e) => setStyleSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {/* Style Grid */}
                    <div className="flex-1 overflow-y-auto -mx-1 px-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
                            {THUMBNAIL_STYLES
                                .filter(s => {
                                    if (!styleSearch.trim()) return true
                                    const q = styleSearch.toLowerCase()
                                    return s.name.toLowerCase().includes(q)
                                        || s.description.toLowerCase().includes(q)
                                        || s.tags.some(t => t.toLowerCase().includes(q))
                                })
                                .map(style => {
                                    const isSelected = thumbnailStyleId === style.id
                                    return (
                                        <button
                                            key={style.id}
                                            type="button"
                                            className={`group relative rounded-xl border-2 overflow-hidden transition-all cursor-pointer hover:shadow-lg ${isSelected
                                                ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-md'
                                                : 'border-border hover:border-purple-300'
                                                }`}
                                            onClick={() => {
                                                setThumbnailStyleId(style.id)
                                                localStorage.setItem('asocial_yt_thumbnail_style', style.id)
                                                setStyleModalOpen(false)
                                                setStyleSearch('')
                                            }}
                                        >
                                            {/* Preview image */}
                                            <div className="aspect-video relative bg-muted">
                                                <Image
                                                    src={style.preview}
                                                    alt={style.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 640px) 50vw, 33vw"
                                                />
                                                {isSelected && (
                                                    <div className="absolute top-1.5 right-1.5 bg-purple-500 text-white rounded-full p-0.5">
                                                        <Check className="h-3 w-3" />
                                                    </div>
                                                )}
                                                {/* Default badge */}
                                                {isSelected && (
                                                    <div className="absolute bottom-1.5 left-1.5 bg-purple-500/90 backdrop-blur text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                                        Default
                                                    </div>
                                                )}
                                            </div>
                                            {/* Info */}
                                            <div className="p-2">
                                                <p className="text-xs font-semibold truncate">{style.name}</p>
                                                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">{style.description}</p>
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {style.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[8px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Delete Post Confirmation */}
            < AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. The post and all associated media links will be permanently deleted.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePost} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >

            {/* ─── Canva Session Expired Modal ─────────────────────────── */}
            {
                canvaExpiredModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[#7d2ae8]/10 border border-[#7d2ae8]/30 flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#7d2ae8]" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">Canva Session Expired</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Your Canva connection needs to be refreshed</p>
                                </div>
                            </div>
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Your Canva session has <strong className="text-foreground">expired</strong>. This usually happens after a period of inactivity. Click <strong className="text-foreground">Reconnect Canva</strong> to restore the connection — it only takes a few seconds and you will be brought back here.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => { window.location.href = canvaExpiredModal.reconnectUrl }}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-[#7d2ae8] hover:bg-[#6d22d0] text-white text-sm font-semibold transition-colors cursor-pointer"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Reconnect Canva
                                </button>
                                <button
                                    onClick={() => setCanvaExpiredModal(null)}
                                    className="w-full py-2 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    )
}
