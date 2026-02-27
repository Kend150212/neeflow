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

// ─── Types ──────────────────────────────────────────

interface ChannelPlatform {
    id: string
    platform: string
    accountId: string
    accountName: string
    isActive: boolean
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
}

// ─── Media helper ────────────────────────────────────

function isVideo(media: MediaItem): boolean {
    if (media.type === 'video') return true
    const ext = (media.originalName || media.url || '').toLowerCase()
    return /\.(mp4|mov|webm|avi|mkv|ogg|3gp|flv|wmv|mpeg)$/.test(ext)
}

function MediaElement({ media, className }: { media: MediaItem; className?: string }) {
    if (isVideo(media)) {
        return (
            <div className={`relative ${className || ''}`}>
                <img
                    src={media.thumbnailUrl || media.url}
                    alt=""
                    className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
                        <Play className="h-4 w-4 text-white ml-0.5" />
                    </div>
                </div>
            </div>
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

// ─── Realistic Preview Components ───────────────────

function FacebookPreview({ content, media, accountName, postType, mediaRatio, firstComment }: {
    content: string; media: MediaItem[]; accountName: string; postType: string; mediaRatio: string; firstComment?: string
}) {
    if (postType === 'story') {
        return (
            <div className="rounded-xl overflow-hidden bg-gradient-to-b from-blue-600 to-blue-800 text-white relative" style={{ minHeight: 280 }}>
                {media.length > 0 && (
                    <MediaElement media={media[0]} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                )}
                <div className="relative z-10 p-4 flex flex-col justify-between h-full" style={{ minHeight: 280 }}>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                            {accountName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold">{accountName}</span>
                        <span className="text-xs opacity-60">Story</span>
                    </div>
                    <p className="text-sm font-medium drop-shadow-lg mt-auto">
                        {content.slice(0, 200)}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#1877F2' }}>
                    {accountName.charAt(0).toUpperCase()}
                </div>
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
                        <div className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: '#1877F2' }}>
                            {accountName.charAt(0).toUpperCase()}
                        </div>
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

function InstagramPreview({ content, media, accountName, mediaRatio }: {
    content: string; media: MediaItem[]; accountName: string; mediaRatio: string
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-3">
                <div className="h-8 w-8 rounded-full ring-2 ring-pink-500 ring-offset-2 ring-offset-background flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#E4405F' }}>
                    {accountName.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-semibold flex-1">{accountName}</p>
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </div>
            {media.length === 1 ? (
                <div className={`w-full bg-muted overflow-hidden ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16] max-h-[400px]' : 'aspect-square'
                    }`}>
                    <MediaElement media={media[0]} className="w-full h-full object-cover" />
                </div>
            ) : media.length > 1 ? (
                <div className="relative">
                    <div className="overflow-x-auto flex snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {media.map((m, i) => (
                            <div key={i} className={`flex-none w-full snap-center bg-muted overflow-hidden ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16] max-h-[400px]' : 'aspect-square'}`}>
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
                <div className={`w-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16] max-h-[400px]' : 'aspect-square'
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

function TikTokPreview({ content, media, accountName, mediaRatio }: {
    content: string; media: MediaItem[]; accountName: string; mediaRatio: string
}) {
    return (
        <div className={`rounded-xl overflow-hidden bg-black text-white relative ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'
            }`}>
            {media.length > 0 ? (
                <MediaElement media={media[0]} className="absolute inset-0 w-full h-full object-cover opacity-70" />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            )}
            <div className="relative z-10 flex h-full">
                {/* Right sidebar */}
                <div className="flex-1" />
                <div className="flex flex-col items-center justify-end gap-4 p-3 pb-16">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold border-2 border-white">
                        {accountName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Heart className="h-6 w-6" />
                        <span className="text-[10px]">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <MessageCircle className="h-6 w-6" />
                        <span className="text-[10px]">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Bookmark className="h-6 w-6" />
                        <span className="text-[10px]">0</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Share2 className="h-6 w-6" />
                        <span className="text-[10px]">0</span>
                    </div>
                </div>
                {/* Bottom caption */}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-xs font-semibold mb-1">@{accountName}</p>
                    <p className="text-xs leading-relaxed line-clamp-3">{content.slice(0, 150)}</p>
                </div>
            </div>
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Play className="h-12 w-12 opacity-30" />
            </div>
        </div>
    )
}

function XPreview({ content, accountName }: {
    content: string; accountName: string
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3 flex gap-3">
                <div className="h-10 w-10 rounded-full bg-black flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {accountName.charAt(0).toUpperCase()}
                </div>
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

function YouTubePreview({ content, media, accountName, mediaRatio }: {
    content: string; media: MediaItem[]; accountName: string; mediaRatio: string
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            {media.length > 0 ? (
                <div className={`relative w-full bg-muted overflow-hidden ${mediaRatio === '9:16' ? 'aspect-[9/16] max-h-[400px]' : mediaRatio === '1:1' ? 'aspect-square' : 'aspect-video'
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
                <div className={`w-full bg-muted flex items-center justify-center ${mediaRatio === '9:16' ? 'aspect-[9/16] max-h-[400px]' : mediaRatio === '1:1' ? 'aspect-square' : 'aspect-video'
                    }`}>
                    <Play className="h-8 w-8 text-muted-foreground/30" />
                </div>
            )}
            <div className="p-3 flex gap-3">
                <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {accountName.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-sm font-semibold line-clamp-2">{content.slice(0, 100)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{accountName} · 0 views · Just now</p>
                </div>
            </div>
        </div>
    )
}

function LinkedInPreview({ content, media, accountName, mediaRatio }: {
    content: string; media: MediaItem[]; accountName: string; mediaRatio: string
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#0A66C2' }}>
                    {accountName.charAt(0).toUpperCase()}
                </div>
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

// ─── Page ───────────────────────────────────────────

export default function ComposePage() {
    const branding = useBranding()
    const t = useTranslation()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { activeChannelId } = useWorkspace()
    const editPostId = searchParams.get('edit')
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
    // Image provider/model override for Generate Image dialog
    const [overrideImageProvider, setOverrideImageProvider] = useState('')
    const [overrideImageModel, setOverrideImageModel] = useState('')
    const [availableImageModels, setAvailableImageModels] = useState<{ id: string; name: string; type?: string }[]>([])
    const [loadingImageModels, setLoadingImageModels] = useState(false)
    const [byokProviders, setByokProviders] = useState<{ provider: string; name: string; source: string }[]>([])
    const [planProviders, setPlanProviders] = useState<{ provider: string; name: string; source: string }[]>([])
    const [planAllowedModels, setPlanAllowedModels] = useState<Record<string, string[]>>({})
    const [imageQuota, setImageQuota] = useState<{ used: number; limit: number }>({ used: 0, limit: 0 })
    const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '4:5'>('1:1')
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
    const [ttVisibility, setTtVisibility] = useState<'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'>('PUBLIC_TO_EVERYONE')
    const [ttAllowComment, setTtAllowComment] = useState(true)
    const [ttAllowDuet, setTtAllowDuet] = useState(false)
    const [ttAllowStitch, setTtAllowStitch] = useState(false)
    const [ttBrandedContent, setTtBrandedContent] = useState(false)
    const [ttAiGenerated, setTtAiGenerated] = useState(false)
    const [ttSettingsOpen, setTtSettingsOpen] = useState(true)
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
    const handleFileUploadRef = useRef<((files: FileList | null) => Promise<void>) | null>(null)
    const selectedChannelRef = useRef<Channel | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [aiScheduleSuggestions, setAiScheduleSuggestions] = useState<any[]>([])
    const [aiScheduleLoading, setAiScheduleLoading] = useState(false)

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
    }, [editPostId])

    // Load existing post when in edit mode
    useEffect(() => {
        if (!editPostId || channels.length === 0) return
        fetch(`/api/admin/posts/${editPostId}`)
            .then((r) => r.json())
            .then((post) => {
                setContent(post.content || '')
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
                // Restore selected platforms from platformStatuses
                if (post.platformStatuses && ch) {
                    const selectedIds = new Set<string>()
                    const fbTypes: Record<string, 'feed' | 'story' | 'reel'> = {}
                    for (const ps of post.platformStatuses) {
                        const match = ch.platforms.find(
                            (p) => p.platform === ps.platform && p.accountId === ps.accountId
                        )
                        if (match) {
                            selectedIds.add(match.id)
                            if (match.platform === 'facebook') fbTypes[match.id] = 'feed'
                        }
                    }
                    setSelectedPlatformIds(selectedIds)
                    setFbPostTypes(fbTypes)
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
                return [...(data.byok || []), ...(data.plan || [])]
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
                    return [...byok, ...planList]
                })
            })
            .then((allProviders) => {
                // Auto-select first available provider
                let currentProvider = overrideImageProvider || selectedChannel?.defaultImageProvider || ''
                if (!currentProvider && allProviders.length > 0) {
                    currentProvider = allProviders[0].provider
                    setOverrideImageProvider(currentProvider)
                }
                // Fetch models for selected provider
                if (currentProvider) {
                    setLoadingImageModels(true)
                    fetch('/api/user/api-keys/models', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ provider: currentProvider }),
                    }).then(r => r.json()).then(d => {
                        setAvailableImageModels(
                            (d.models || []).filter((m: { type?: string }) => m.type === 'image')
                        )
                    }).catch(() => { }).finally(() => setLoadingImageModels(false))
                }
            })
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

    // Toggle platform by unique ID
    const togglePlatform = (platformId: string) => {
        setSelectedPlatformIds((prev) => {
            const next = new Set(prev)
            if (next.has(platformId)) next.delete(platformId)
            else next.add(platformId)
            return next
        })
    }

    // Upload media — server-side upload to Google Drive (avoids CORS)
    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || !selectedChannel) return
        setUploading(true)
        let successCount = 0
        try {
            for (const file of Array.from(files)) {
                try {
                    toast.info(`Uploading ${file.name}...`)
                    const formData = new FormData()
                    formData.append('file', file)
                    formData.append('channelId', selectedChannel.id)

                    const res = await fetch('/api/admin/media', {
                        method: 'POST',
                        body: formData,
                    })

                    if (!res.ok) {
                        const err = await res.json()
                        toast.error(err.error || `Failed to upload ${file.name}`)
                        continue
                    }

                    const media = await res.json()
                    setAttachedMedia((prev) => [...prev, media])
                    successCount++
                } catch {
                    toast.error(`Upload failed: ${file.name}`)
                }
            }
            if (successCount > 0) toast.success(`${successCount} file(s) uploaded!`)
        } finally {
            setUploading(false)
        }
    }, [selectedChannel])
    // Keep ref updated so async callbacks (like Canva export) always use the latest version
    handleFileUploadRef.current = handleFileUpload

    const removeMedia = (id: string) => {
        setAttachedMedia((prev) => prev.filter((m) => m.id !== id))
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
                        for (const doc of data.docs) {
                            const alreadyAttached = attachedMedia.some((m: { id: string }) => m.id === doc.id)
                            if (alreadyAttached) continue
                            setAttachedMedia(prev => [...prev, {
                                id: doc.id,
                                url: `https://drive.google.com/uc?id=${doc.id}&export=download`,
                                thumbnailUrl: doc.thumbnails?.[0]?.url || null,
                                type: doc.mimeType,
                                originalName: doc.name,
                            }])
                        }
                        toast.success(`Added ${data.docs.length} file${data.docs.length > 1 ? 's' : ''} from Drive`)
                    }
                })
                .build()
            picker.setVisible(true)
        } catch (error) {
            console.error('Google Picker error:', error)
            toast.error('Failed to open Google Drive picker')
        }
        setLoadingDrivePicker(false)
    }, [attachedMedia])

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
                    win.document.write(`<!DOCTYPE html><html><head><title>${branding.appName} - Canva Export</title><style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { background: #0f1419; color: #e7e9ea; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
                        .container { padding: 48px; max-width: 480px; }
                        .logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 32px; }
                        .logo img { width: 40px; height: 40px; border-radius: 10px; }
                        .logo span { font-size: 24px; font-weight: 700; color: #10b981; }
                        .icon { font-size: 48px; margin-bottom: 16px; }
                        .message { font-size: 18px; line-height: 1.6; color: #d1d5db; }
                        ${spinnerCSS}
                    </style></head><body>
                        <div class="container">
                            <div class="logo"><img src="${branding.logoUrl}" alt="${branding.appName}" /><span>${branding.appName}</span></div>
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

            const triggerExport = async (popupRef?: Window | null) => {
                if (exported) return // prevent double-trigger
                exported = true

                toast.loading('Waiting for Canva to save...', { id: 'canva-export' })

                // Give Canva 3 seconds to save the design before exporting
                await new Promise(r => setTimeout(r, 3000))

                toast.loading('Exporting design from Canva...', { id: 'canva-export' })

                // Retry up to 3 times with delays
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const exportRes = await fetch(`/api/canva/designs?designId=${data.designId}`)
                        console.log('Canva export API response status:', exportRes.status)
                        const exportData = await exportRes.json()
                        console.log('Canva export API data:', {
                            status: exportData.status,
                            hasBase64: !!exportData.imageBase64,
                            base64Length: exportData.imageBase64?.length || 0,
                            urlsCount: exportData.urls?.length || 0,
                            error: exportData.error,
                        })

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

                                // Log to server for debugging (client console.log not visible in PM2)
                                fetch(`/api/canva/designs?_debug=1&step=uploading&channelId=${channelId}&fileSize=${file.size}&mediaId=${existingMediaId || 'new'}`).catch(() => { })

                                const uploadRes = await fetch('/api/admin/media', {
                                    method: 'POST',
                                    body: formData,
                                })

                                // Debug beacon: upload result
                                fetch(`/api/canva/designs?_debug=1&step=upload_result&status=${uploadRes.status}&ok=${uploadRes.ok}`).catch(() => { })

                                if (uploadRes.ok) {
                                    const newMedia = await uploadRes.json()
                                    // Debug beacon: media received
                                    fetch(`/api/canva/designs?_debug=1&step=media_received&mediaId=${newMedia.id}&url=${encodeURIComponent(newMedia.url || '')}&existingId=${existingMediaId || 'new'}`).catch(() => { })

                                    if (existingMediaId) {
                                        // REPLACE the original media at the same position
                                        setAttachedMedia((prev) => {
                                            const updated = prev.map((m) => m.id === existingMediaId ? newMedia : m)
                                            fetch(`/api/canva/designs?_debug=1&step=replace_done&prevLen=${prev.length}&updatedLen=${updated.length}&foundMatch=${prev.some(m => m.id === existingMediaId)}`).catch(() => { })
                                            return updated
                                        })
                                    } else {
                                        // NEW design — add to list
                                        setAttachedMedia((prev) => {
                                            fetch(`/api/canva/designs?_debug=1&step=append_done&prevLen=${prev.length}&newLen=${prev.length + 1}`).catch(() => { })
                                            return [...prev, newMedia]
                                        })
                                    }
                                    toast.success('🎨 Canva design imported!', { id: 'canva-export' })

                                    // Show success + close button in popup
                                    if (popupRef && !popupRef.closed) {
                                        writePopupStatus(popupRef, 'success', 'Design imported successfully! 🎉')
                                    }
                                } else {
                                    const err = await uploadRes.json().catch(() => ({}))
                                    fetch(`/api/canva/designs?_debug=1&step=upload_failed&error=${encodeURIComponent(err.error || 'unknown')}`).catch(() => { })
                                    toast.error(err.error || 'Failed to upload design', { id: 'canva-export' })

                                    if (popupRef && !popupRef.closed) {
                                        writePopupStatus(popupRef, 'error', err.error || 'Upload failed')
                                    }
                                }

                                setCanvaLoading(false)
                                return // success — exit
                            }

                            // Blob was empty — treat as failure for retry
                            console.warn('Canva export blob was empty, attempt:', attempt + 1)
                        }

                        // If not success and not last attempt, wait and retry
                        if (attempt < 2) {
                            toast.loading(`Export pending, retrying... (${attempt + 2}/3)`, { id: 'canva-export' })
                            await new Promise(r => setTimeout(r, 3000))
                        } else {
                            toast.error(exportData.error || 'Export failed after retries', { id: 'canva-export' })
                        }
                    } catch (err: unknown) {
                        const errMsg = err instanceof Error ? err.message : String(err)
                        console.error('Canva export attempt error:', errMsg, err)
                        if (attempt >= 2) {
                            toast.error(`Export error: ${errMsg}`, { id: 'canva-export' })
                        } else {
                            await new Promise(r => setTimeout(r, 3000))
                        }
                    }
                }
                // Show failure in popup — include hint to check browser console
                if (popupRef && !popupRef.closed) {
                    writePopupStatus(popupRef, 'error', 'Export failed. Check browser console (F12) for details.')
                }
                setCanvaLoading(false)
            }


            const checkClosed = setInterval(async () => {
                if (exported) { clearInterval(checkClosed); return }

                // Case 1: Popup was closed by user manually — trigger export
                if (popup && popup.closed) {
                    clearInterval(checkClosed)
                    await triggerExport()
                    return
                }

                // Case 2: Popup navigated back to our domain (user clicked "Return to app")
                // Keep popup OPEN — show status UI, run export, close popup only after success
                try {
                    if (popup && popup.location && popup.location.hostname === window.location.hostname) {
                        clearInterval(checkClosed)
                        // Show processing UI in popup
                        writePopupStatus(popup, 'loading', 'Importing your design from Canva...')
                        // Run export (popup will be updated and closed on success)
                        await triggerExport(popup)
                        return
                    }
                } catch {
                    // Cross-origin — popup is still on canva.com, that's fine
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

        // Build request body
        const promptToUse = useContentAsPrompt && content.trim() ? content.substring(0, 500) : aiImagePrompt
        const aspectDims: Record<string, [number, number]> = {
            '1:1': [1024, 1024], '16:9': [1280, 768], '9:16': [768, 1280],
            '4:3': [1024, 768], '3:4': [768, 1024], '4:5': [832, 1024],
        }
        const [w, h] = aspectDims[imageAspectRatio] || [1024, 1024]
        const body: Record<string, unknown> = { channelId: selectedChannel.id, prompt: promptToUse, width: w, height: h }
        if (overrideImageProvider) {
            const parts = overrideImageProvider.split(':')
            body.provider = parts.length > 1 ? parts.slice(1).join(':') : parts[0]
        }
        if (overrideImageModel) body.model = overrideImageModel

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
            // Auto-attach the media item
            addFromLibrary(data.mediaItem)
            setAiGeneratedPreview(data.mediaItem.url || data.mediaItem.thumbnailUrl)
            setLastUsedImageModel(data.model || data.provider)
            // Trigger reveal animation
            setAiImageJustCompleted(true)
            setTimeout(() => setAiImageJustCompleted(false), 2000)
            toast.success(`Image generated with ${data.model || data.provider}!`)
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
            if (data.firstComment) { setFbFirstComment(data.firstComment); filled++ }
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
                    allowComment: ttAllowComment,
                    allowDuet: ttAllowDuet,
                    allowStitch: ttAllowStitch,
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
        if (!selectedChannel || !content.trim()) {
            toast.error('Select a channel and add content')
            return
        }
        setSaving(true)
        try {
            let scheduledAt: string | null = null
            if (scheduleDate) {
                // Default time to 09:00 if user picked a date but left time blank
                const time = scheduleTime || '09:00'
                // Interpret date+time in channel's timezone, convert to UTC
                const channelTz = (selectedChannel as any)?.timezone || 'UTC'
                // Parse the date/time parts directly (no browser timezone interference)
                const [year, month, day] = scheduleDate.split('-').map(Number)
                const [hour, minute] = time.split(':').map(Number)
                // Create a UTC date with the same wall-clock values
                const asUTC = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
                // Find the offset of channelTz at this approximate moment
                // by formatting asUTC in both UTC and channelTz, then computing the difference
                const fmtOpts: Intl.DateTimeFormatOptions = { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
                const utcStr = new Intl.DateTimeFormat('en-US', fmtOpts).format(asUTC)
                const tzStr = new Intl.DateTimeFormat('en-US', { ...fmtOpts, timeZone: channelTz }).format(asUTC)
                const parseMDYHMS = (s: string) => { const [d, t] = s.split(', '); const [m2, d2, y2] = d.split('/').map(Number); const [h2, mm2, s2] = t.split(':').map(Number); return Date.UTC(y2, m2 - 1, d2, h2, mm2, s2) }
                const offsetMs = parseMDYHMS(tzStr) - parseMDYHMS(utcStr)
                // Subtract the offset: if channelTz is UTC-5, offset is -5h, so we ADD 5h to get UTC
                scheduledAt = new Date(asUTC.getTime() - offsetMs).toISOString()
            }

            const existingId = editPostId || postIdRef.current
            const url = existingId ? `/api/admin/posts/${existingId}` : '/api/admin/posts'
            const method = existingId ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId: selectedChannel.id, content,
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

    // Publish now (fire-and-forget — publishes in background on server)
    const handlePublishNow = async () => {
        if (!selectedChannel || !content.trim()) { toast.error('Select a channel and add content'); return }
        if (selectedPlatformIds.size === 0) { toast.error('Select at least one platform'); return }

        // ── Media validation per platform ──
        const hasVideo = attachedMedia.some(m => isVideo(m))
        const hasImage = attachedMedia.some(m => !isVideo(m))
        const selectedPlatforms = activePlatforms.filter(p => selectedPlatformIds.has(p.id))
        const errors: string[] = []

        for (const p of selectedPlatforms) {
            switch (p.platform) {
                case 'tiktok':
                    if (!hasVideo) errors.push('🎵 TikTok requires a video. Please upload a video.')
                    else if (mediaRatio === '16:9') errors.push('🎵 TikTok videos should be vertical (9:16). Landscape videos will be rejected.')
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

            // Fire publish in background — don't await
            fetch(`/api/admin/posts/${post.id}/publish`, { method: 'POST' })
                .catch(() => { /* server handles errors */ })

            toast.success('Publishing in background...')
            savedRef.current = true
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
        <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-1 py-1.5 shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-sm font-bold tracking-tight">{editPostId ? t('compose.editTitle') : t('compose.title')}</h1>

                </div>
                <div className="flex items-center gap-1.5">
                    {scheduleDate ? (
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
                            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" onClick={handleSaveDraft} disabled={saving || !content.trim()}>
                                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                {saving ? t('compose.saving') : t('compose.saveDraft')}
                            </Button>
                            <Button size="sm" className="h-7 text-xs cursor-pointer" onClick={handlePublishNow} disabled={publishing || !content.trim() || selectedPlatformIds.size === 0}>
                                {publishing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                {publishing ? t('compose.publishing') : t('compose.publish')}
                            </Button>
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

            {/* Mobile Tab Bar — hidden on lg+ */}
            <div className="lg:hidden flex items-center gap-0 border-b shrink-0 px-1 bg-background">
                {(['settings', 'editor', 'preview'] as const).map((tab) => {
                    const labels: Record<string, string> = { settings: '⚙️ Cài đặt', editor: '✏️ Soạn', preview: '👁 Xem trước' }
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setMobileTab(tab)}
                            className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 cursor-pointer ${mobileTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {labels[tab]}
                        </button>
                    )
                })}
            </div>

            {/* 3-Column Layout — fills remaining height */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5 flex-1 min-h-0">
                {/* ── Left: Platforms ── */}
                <div className={`lg:col-span-2 space-y-1 overflow-y-auto pr-0.5 ${mobileTab === 'settings' ? 'block' : 'hidden'} lg:block`}>
                    {/* Channel */}
                    <Card>
                        <CardHeader className="py-1.5 px-2.5">
                            <CardTitle className="text-xs">{t('compose.channel')}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-2.5 pb-2">
                            <Select
                                value={selectedChannel?.id || ''}
                                onValueChange={(v) => setSelectedChannel(channels.find((c) => c.id === v) || null)}
                            >
                                <SelectTrigger><SelectValue placeholder={t('compose.selectChannel')} /></SelectTrigger>
                                <SelectContent>
                                    {channels.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id}>{ch.displayName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="py-1.5 px-2.5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xs">{t('compose.platforms')}</CardTitle>
                                    <p className="text-[9px] text-muted-foreground">
                                        {t('compose.selectPlatforms')}
                                    </p>
                                </div>
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
                        </CardHeader>
                        <CardContent className="space-y-0.5 px-2.5 pb-2">
                            {activePlatforms.length ? (
                                activePlatforms.map((p) => {
                                    const isChecked = selectedPlatformIds.has(p.id)
                                    const isFacebook = p.platform === 'facebook'
                                    return (
                                        <div key={p.id}>
                                            <div
                                                className="flex items-center gap-1.5 py-0.5 cursor-pointer select-none"
                                                onClick={() => togglePlatform(p.id)}
                                            >
                                                <div className={`h-3.5 w-3.5 shrink-0 rounded-[3px] border shadow-xs flex items-center justify-center transition-colors ${isChecked
                                                    ? 'bg-primary border-primary text-primary-foreground'
                                                    : 'border-input bg-transparent'
                                                    }`}>
                                                    {isChecked && <Check className="h-2.5 w-2.5" />}
                                                </div>
                                                <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                                                    <PlatformIcon platform={p.platform} size="sm" />
                                                </div>
                                                <p className="text-[11px] font-medium leading-none truncate">
                                                    {p.accountName}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    {t('compose.noPlatforms')}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Schedule */}
                    <Card>
                        <CardHeader className="py-1.5 px-2.5">
                            <CardTitle className="text-xs flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" /> {t('compose.schedule')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 px-2.5 pb-2">
                            {/* AI-Powered Schedule Suggestion */}
                            <div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs cursor-pointer gap-2"
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
                                        try {
                                            const res = await fetch('/api/admin/posts/suggest-schedule', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    channelId: selectedChannel.id,
                                                    platforms,
                                                    content: content.slice(0, 200),
                                                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                                }),
                                            })
                                            const data = await res.json()
                                            if (!res.ok) {
                                                toast.error(data.error || 'Failed to get suggestions')
                                                return
                                            }
                                            setAiScheduleSuggestions(data.suggestions || [])
                                            toast.success('AI schedule suggestions ready!')
                                        } catch {
                                            toast.error('Failed to get AI suggestions')
                                        } finally {
                                            setAiScheduleLoading(false)
                                        }
                                    }}
                                >
                                    {aiScheduleLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                                    {aiScheduleLoading ? 'Analyzing best times...' : 'AI Suggest Best Times'}
                                </Button>
                                {aiScheduleSuggestions.length > 0 && (
                                    <div className="grid grid-cols-1 gap-1.5 mt-2">
                                        {aiScheduleSuggestions.map((s: { date: string; time: string; label: string; reason: string; score?: number }, i: number) => {
                                            const isSelected = scheduleDate === s.date && scheduleTime === s.time
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        setScheduleDate(s.date)
                                                        setScheduleTime(s.time)
                                                    }}
                                                    className={`text-left px-2.5 py-2 rounded-md text-xs transition-colors cursor-pointer ${isSelected
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{s.label}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            {s.score && (
                                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isSelected ? 'bg-primary-foreground/20' : s.score >= 90 ? 'bg-green-100 text-green-700' : s.score >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {s.score}%
                                                                </span>
                                                            )}
                                                            <span className="opacity-70">{s.date} {s.time}</span>
                                                        </div>
                                                    </div>
                                                    <p className="opacity-60 mt-0.5 text-[10px]">{s.reason}</p>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="border-t pt-1.5">
                                <Label className="text-[10px] text-muted-foreground">{t('compose.scheduleDate')}</Label>
                                <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="mt-0.5 h-7 text-xs" />
                            </div>
                            <div>
                                <Label className="text-[10px] text-muted-foreground">{t('compose.scheduleTime')}</Label>
                                <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="mt-0.5 h-7 text-xs" />
                            </div>
                            {/* Timezone indicator */}
                            <div className="flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground">
                                    🌐 {(selectedChannel as any)?.timezone || 'UTC'}
                                </span>
                            </div>
                            {scheduleDate && (
                                <Button variant="ghost" size="sm" onClick={() => { setScheduleDate(''); setScheduleTime(''); setAiScheduleSuggestions([]) }} className="text-xs cursor-pointer">
                                    <X className="h-3 w-3 mr-1" /> Clear schedule
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div >

                {/* ── Center: Editor ── */}
                < div className={`lg:col-span-6 space-y-1 overflow-y-auto px-0.5 ${mobileTab === 'editor' ? 'block' : 'hidden'} lg:block`} >
                    {/* AI Generate */}
                    < Card >
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
                                                        className="group inline-flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 text-left transition-all cursor-pointer"
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
                                                            className="w-full flex items-start gap-2 p-1.5 rounded-md hover:bg-accent/50 transition-colors text-left group cursor-pointer"
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
                    </Card >



                    {/* Content Editor */}
                    < Card >
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
                    </Card >

                    {/* Per-Platform Content Customization */}
                    {selectedPlatformIds.size > 0 && (
                        <Card>
                            <CardHeader className="py-1.5 px-2.5">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xs flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5" /> Platform Content
                                    </CardTitle>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-medium hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 cursor-pointer"
                                        disabled={customizingContent || !content.trim()}
                                        onClick={handleCustomizeContent}
                                    >
                                        {customizingContent ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                        {customizingContent ? 'Customizing...' : 'AI Customize'}
                                    </button>
                                </div>
                                {/* Platform tabs */}
                                {(() => {
                                    const uniquePlatforms = [...new Set(
                                        activePlatforms
                                            .filter((p) => selectedPlatformIds.has(p.id))
                                            .map((p) => p.platform)
                                    )]
                                    const platformIcons: Record<string, string> = {
                                        facebook: '📘', instagram: '📸', tiktok: '🎵',
                                        x: '𝕏', linkedin: '💼', pinterest: '📌', youtube: '▶️',
                                    }
                                    const platformLabels: Record<string, string> = {
                                        facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
                                        x: 'X', linkedin: 'LinkedIn', pinterest: 'Pinterest', youtube: 'YouTube',
                                    }
                                    if (Object.keys(contentPerPlatform).length === 0) {
                                        return (
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Click &quot;AI Customize&quot; to generate optimized content for each platform, or all platforms will use the master content above.
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
                                                    <span>{platformIcons[platform] || '📱'}</span>
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
                            {attachedMedia.length > 0 && (
                                <div className={`grid gap-2 ${mediaRatio === '9:16' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'
                                    }`}>
                                    {attachedMedia.map((media, index) => (
                                        <div
                                            key={media.id}
                                            className={`relative group rounded-lg overflow-hidden bg-muted ${mediaRatio === '16:9' ? 'aspect-video'
                                                : mediaRatio === '9:16' ? 'aspect-[9/16]'
                                                    : 'aspect-square'
                                                } ${aiImageJustCompleted && index === attachedMedia.length - 1 ? 'animate-ai-reveal' : ''}`}
                                        >
                                            {isVideo(media) ? (
                                                <div className="relative h-full w-full bg-muted">
                                                    <img
                                                        src={media.thumbnailUrl || media.url}
                                                        alt={media.originalName || ''}
                                                        className="h-full w-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
                                                            <Play className="h-4 w-4 text-white ml-0.5" />
                                                        </div>
                                                    </div>
                                                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1 rounded">{media.originalName}</span>
                                                </div>
                                            ) : (
                                                <img src={media.thumbnailUrl || media.url} alt={media.originalName || ''} className="h-full w-full object-cover" />
                                            )}
                                            <button
                                                onClick={() => removeMedia(media.id)}
                                                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                            {/* Edit in Canva — only for images */}
                                            {!isVideo(media) && (
                                                <button
                                                    onClick={() => openCanvaDesign(media.url, media.id)}
                                                    title="Edit in Canva"
                                                    className="absolute top-1 left-1 h-5 w-5 rounded-full bg-violet-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                >
                                                    <Palette className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* AI Image Generating Placeholder */}
                            {aiImageBgGenerating && (
                                <div className={`relative rounded-lg overflow-hidden bg-gradient-to-br from-purple-950/40 via-black/60 to-fuchsia-950/40 border border-purple-500/20 ${mediaRatio === '16:9' ? 'aspect-video' : mediaRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'}`}>
                                    {/* Shimmer effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s ease-in-out infinite' }} />
                                    {/* Center content */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                        {/* Logo with pulse */}
                                        <div className="relative">
                                            <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                                            <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-purple-600/30 to-fuchsia-600/30 border border-purple-500/30 flex items-center justify-center backdrop-blur-sm">
                                                <img src="/logo.png" alt="" className="h-7 w-7 object-contain animate-pulse" style={{ animationDuration: '2s' }} />
                                            </div>
                                        </div>
                                        {/* Text */}
                                        <div className="text-center">
                                            <p className="text-[11px] font-medium text-purple-300 animate-pulse">Creating magic...</p>
                                            <p className="text-[9px] text-purple-400/50 mt-0.5">AI is generating your image</p>
                                        </div>
                                    </div>
                                    {/* Corner sparkles */}
                                    <div className="absolute top-2 right-2">
                                        <Sparkles className="h-3 w-3 text-purple-400/40 animate-pulse" />
                                    </div>
                                    <div className="absolute bottom-2 left-2">
                                        <Sparkles className="h-2.5 w-2.5 text-fuchsia-400/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
                                    </div>
                                </div>
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
                                            <div className="text-xs font-semibold text-purple-300 group-hover:text-purple-200 transition-colors">AI Image</div>
                                            <div className="text-[9px] text-purple-400/60 leading-tight">Generate with AI</div>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => openCanvaDesign()}
                                    disabled={canvaLoading}
                                    className="flex-1 group relative overflow-hidden rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-violet-600/20 via-violet-500/15 to-indigo-500/20 border border-violet-500/30 hover:border-violet-400/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <div className="relative flex items-center gap-2">
                                        <div className="flex-shrink-0 h-7 w-7 rounded-md bg-violet-500/20 flex items-center justify-center">
                                            {canvaLoading ? <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin" /> : <Palette className="h-3.5 w-3.5 text-violet-400" />}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs font-semibold text-violet-300 group-hover:text-violet-200 transition-colors">Canva</div>
                                            <div className="text-[9px] text-violet-400/60 leading-tight">Design in Canva</div>
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
                                    </CardTitle>
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${fbSettingsOpen ? '' : '-rotate-90'}`} />
                                </button>
                            </CardHeader>
                            {fbSettingsOpen && (
                                <CardContent className="space-y-2 px-2.5 pb-2">
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

                                    {/* Carousel Toggle */}
                                    <div className="flex items-center justify-between py-1 border-t">
                                        <div className="flex items-center gap-1.5">
                                            <Layers className="h-3.5 w-3.5 text-blue-500" />
                                            <div>
                                                <p className="text-xs font-medium">Carousel</p>
                                                <p className="text-[10px] text-muted-foreground">Post images as a swipeable carousel</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${fbCarousel ? 'bg-blue-500' : 'bg-muted'}`}
                                            onClick={() => setFbCarousel(!fbCarousel)}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${fbCarousel ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
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
                                        <textarea
                                            value={ytThumbnailPrompt}
                                            onChange={(e) => setYtThumbnailPrompt(e.target.value)}
                                            placeholder="AI will generate a thumbnail prompt based on your content & selected style..."
                                            className="w-full min-h-[60px] resize-y rounded-lg border bg-transparent px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                                            rows={3}
                                        />
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
                    {selectedChannel?.platforms?.some(p => p.platform === 'tiktok' && selectedPlatformIds.has(p.id)) && (
                        <Card>
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
                                <CardContent className="space-y-2 px-2.5 pb-2">
                                    {/* Publish As */}
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

                                    {/* Visibility */}
                                    <div className="space-y-1 border-t pt-1.5">
                                        <Label className="text-[10px] text-muted-foreground">Who can see</Label>
                                        <Select value={ttVisibility} onValueChange={(v) => setTtVisibility(v as typeof ttVisibility)}>
                                            <SelectTrigger className="text-xs h-7">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PUBLIC_TO_EVERYONE">
                                                    <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> Public To Everyone</span>
                                                </SelectItem>
                                                <SelectItem value="MUTUAL_FOLLOW_FRIENDS">
                                                    <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> Mutual Follow Friends</span>
                                                </SelectItem>
                                                <SelectItem value="SELF_ONLY">
                                                    <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Self Only</span>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Allow User to */}
                                    <div className="border-t pt-1.5 space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Allow User to</Label>
                                        <div className="space-y-1">
                                            {[
                                                { label: 'Comment', value: ttAllowComment, setter: setTtAllowComment },
                                                { label: 'Duet', value: ttAllowDuet, setter: setTtAllowDuet },
                                                { label: 'Stitch', value: ttAllowStitch, setter: setTtAllowStitch },
                                            ].map(opt => (
                                                <div key={opt.label} className="flex items-center justify-between">
                                                    <p className="text-xs font-medium">{opt.label}</p>
                                                    <button
                                                        type="button"
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${opt.value ? 'bg-cyan-500' : 'bg-muted'}`}
                                                        onClick={() => opt.setter(!opt.value)}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${opt.value ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Branded Content & AI-Generated */}
                                    <div className="border-t pt-1.5 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <ShieldCheck className="h-3.5 w-3.5 text-cyan-500" />
                                                <p className="text-xs font-medium">Branded content</p>
                                            </div>
                                            <button
                                                type="button"
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ttBrandedContent ? 'bg-cyan-500' : 'bg-muted'}`}
                                                onClick={() => setTtBrandedContent(!ttBrandedContent)}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${ttBrandedContent ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                                                <p className="text-xs font-medium">AI-generated</p>
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
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Pinterest Settings — only when Pinterest platform is selected */}
                    {activePlatforms.some(p => selectedPlatformIds.has(p.id) && p.platform === 'pinterest') && (
                        <Card className="overflow-hidden border-[#E60023]/30">
                            <CardHeader
                                className="py-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                    setPinSettingsOpen(!pinSettingsOpen)
                                    // Fetch boards when opening settings for the first time
                                    if (!pinSettingsOpen && pinBoards.length === 0 && !pinBoardsLoading) {
                                        const pinterestPlatform = activePlatforms.find(p => selectedPlatformIds.has(p.id) && p.platform === 'pinterest')
                                        if (pinterestPlatform && selectedChannel) {
                                            setPinBoardsLoading(true)
                                            fetch(`/api/admin/channels/${selectedChannel.id}/pinterest-boards?accountId=${pinterestPlatform.accountId}`)
                                                .then(r => r.json())
                                                .then(data => {
                                                    if (data.needsReconnect) { setPinNeedsReconnect(true); return }
                                                    if (data.boards) { setPinNeedsReconnect(false); setPinBoards(data.boards) }
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
                                                    if (data.boards) { setPinNeedsReconnect(false); setPinBoards(data.boards) }
                                                })
                                                .catch(() => { })
                                                .finally(() => setPinBoardsLoading(false))
                                        }
                                        return (
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs">
                                                <span className="text-amber-600 flex-1">⚠️ Pinterest session expired.</span>
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
                                                                    className="w-full flex items-center gap-1.5 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors text-left"
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
                </div >

                {/* ── Right: Realistic Previews ── */}
                < div className={`lg:col-span-4 space-y-1 overflow-y-auto pl-0.5 ${mobileTab === 'preview' ? 'block' : 'hidden'} lg:block`} >

                    <Card>
                        <CardHeader className="py-1.5 px-2.5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs">Post Preview</CardTitle>
                                {content.trim() && uniqueSelectedPlatforms.length > 1 && (
                                    <p className="text-[10px] text-muted-foreground">
                                        {uniqueSelectedPlatforms.length} platforms
                                    </p>
                                )}
                            </div>
                            {/* Platform tab pills */}
                            {content.trim() && uniqueSelectedPlatforms.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                    {uniqueSelectedPlatforms.map((platform) => {
                                        const accountsForPlatform = selectedEntries.filter((e) => e.platform === platform)
                                        const isActive = effectivePreviewPlatform === platform
                                        return (
                                            <button
                                                key={platform}
                                                onClick={() => setPreviewPlatform(platform)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${isActive
                                                    ? 'text-white shadow-sm'
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                    }`}
                                                style={isActive ? { backgroundColor: platformColors[platform] || '#666' } : {}}
                                            >
                                                <PlatformIcon platform={platform} size="xs" />
                                                {platformLabels[platform] || platform}
                                                {accountsForPlatform.length > 1 && (
                                                    <span className={`text-[9px] ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                                                        ×{accountsForPlatform.length}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {(content.trim() || attachedMedia.length > 0) && effectivePreviewPlatform ? (() => {
                                // Find the first account of the currently previewed platform
                                const entry = selectedEntries.find((e) => e.platform === effectivePreviewPlatform)
                                if (!entry) return null
                                const name = entry.accountName
                                const accountsCount = selectedEntries.filter((e) => e.platform === effectivePreviewPlatform).length

                                return (
                                    <>
                                        {(() => {
                                            // Use per-platform content if available, otherwise fall back to master content
                                            const previewContent = contentPerPlatform[effectivePreviewPlatform]?.trim() || content
                                            switch (effectivePreviewPlatform) {
                                                case 'facebook':
                                                    return <FacebookPreview content={previewContent} media={attachedMedia} accountName={name} postType={fbPostTypes[entry.id] || 'feed'} mediaRatio={mediaRatio} firstComment={fbFirstComment || undefined} />
                                                case 'instagram':
                                                    return <InstagramPreview content={previewContent} media={attachedMedia} accountName={name} mediaRatio={mediaRatio} />
                                                case 'tiktok':
                                                    return <TikTokPreview content={previewContent} media={attachedMedia} accountName={name} mediaRatio={mediaRatio} />
                                                case 'x':
                                                case 'twitter':
                                                    return <XPreview content={previewContent} accountName={name} />
                                                case 'youtube':
                                                    return <YouTubePreview content={previewContent} media={attachedMedia} accountName={name} mediaRatio={mediaRatio} />
                                                case 'linkedin':
                                                    return <LinkedInPreview content={previewContent} media={attachedMedia} accountName={name} mediaRatio={mediaRatio} />
                                                default:
                                                    return <GenericPreview content={previewContent} media={attachedMedia} accountName={name} platform={effectivePreviewPlatform} mediaRatio={mediaRatio} />
                                            }
                                        })()}
                                        {accountsCount > 1 && (
                                            <p className="text-[10px] text-muted-foreground text-center">
                                                This content will be posted to {accountsCount} {platformLabels[effectivePreviewPlatform] || effectivePreviewPlatform} accounts
                                            </p>
                                        )}
                                    </>
                                )
                            })() : (
                                <div className="text-center py-4">
                                    <Hash className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
                                    <p className="text-xs text-muted-foreground">
                                        {selectedEntries.length === 0 ? 'Select platforms' : 'Start typing'}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {
                        scheduleDate && (
                            <Card>
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Clock className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Scheduled for</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(`${scheduleDate}T${scheduleTime || '00:00'}`).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    }
                </div >
            </div >

            {/* ── Generate Image Dialog ── */}
            < Dialog open={showImagePicker} onOpenChange={(open) => {
                setShowImagePicker(open)
            }} >
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-500" />
                            Generate Image
                        </DialogTitle>
                    </DialogHeader>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-muted rounded-lg p-1">
                        <button
                            onClick={() => setImagePickerTab('ai')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${imagePickerTab === 'ai'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            AI Generate
                        </button>
                        <button
                            onClick={() => setImagePickerTab('article')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${imagePickerTab === 'article'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Newspaper className="h-3.5 w-3.5" />
                            From Article
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="mt-4 min-h-[300px]">

                        {/* AI Generate */}
                        {imagePickerTab === 'ai' && (
                            <div className="space-y-4">
                                {/* Provider / Model selector */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Provider dropdown with SVG logos */}
                                    {(() => {
                                        // overrideImageProvider stores prefixed value like 'byok:gemini' or 'plan:gemini'
                                        const currentSelectValue = overrideImageProvider || '__auto__'
                                        // Extract bare provider name for display and API calls
                                        const rawProvider = (() => {
                                            if (!currentSelectValue || currentSelectValue === '__auto__') return selectedChannel?.defaultImageProvider || ''
                                            const parts = currentSelectValue.split(':')
                                            return parts.length > 1 ? parts.slice(1).join(':') : parts[0]
                                        })()
                                        const handleProviderChange = (selectVal: string) => {
                                            if (selectVal === '__auto__') {
                                                setOverrideImageProvider('')
                                                return
                                            }
                                            // Store full prefixed value: "byok:gemini" or "plan:gemini"
                                            setOverrideImageProvider(selectVal)
                                            setOverrideImageModel('')
                                            setAvailableImageModels([])
                                            // Parse source and provider name
                                            const [source, ...rest] = selectVal.split(':')
                                            const providerName = rest.join(':')
                                            if (providerName) {
                                                setLoadingImageModels(true)
                                                fetch('/api/user/api-keys/models', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ provider: providerName }),
                                                }).then(r => r.json()).then(d => {
                                                    // Filter by plan whitelist only when Plan source selected
                                                    const isPlan = source === 'plan'
                                                    const allowed = planAllowedModels[providerName]
                                                    let models = (d.models || []).filter((m: { type?: string }) => m.type === 'image')
                                                    if (isPlan && allowed && allowed.length > 0) {
                                                        models = models.filter((m: { id: string }) => allowed.includes(m.id))
                                                    }
                                                    setAvailableImageModels(models)
                                                }).catch(() => { }).finally(() => setLoadingImageModels(false))
                                            }
                                        }
                                        return (
                                            <Select value={currentSelectValue} onValueChange={handleProviderChange}>
                                                <SelectTrigger className="h-7 text-[11px] w-auto min-w-[160px] gap-1.5">
                                                    <SelectValue>
                                                        {rawProvider ? (
                                                            <span className="flex items-center gap-1.5">
                                                                <ProviderLogo provider={rawProvider} className="h-3.5 w-3.5" />
                                                                {byokProviders.find(p => p.provider === rawProvider)?.name ||
                                                                    planProviders.find(p => p.provider === rawProvider)?.name ||
                                                                    rawProvider}
                                                            </span>
                                                        ) : 'Auto-detect provider'}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__auto__" className="text-[11px]">
                                                        Auto-detect provider
                                                    </SelectItem>
                                                    {byokProviders.length > 0 && (
                                                        <>
                                                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">📌 Your Keys (unlimited)</div>
                                                            {byokProviders.map(p => (
                                                                <SelectItem key={`byok-${p.provider}`} value={`byok:${p.provider}`} className="text-[11px]">
                                                                    <span className="flex items-center gap-1.5">
                                                                        <ProviderLogo provider={p.provider} className="h-3.5 w-3.5" />
                                                                        {p.name}
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </>
                                                    )}
                                                    {planProviders.length > 0 && (
                                                        <>
                                                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">⚡ Plan ({imageQuota.limit === -1 ? '∞' : `${imageQuota.limit - imageQuota.used} left`})</div>
                                                            {planProviders.map(p => (
                                                                <SelectItem key={`plan-${p.provider}`} value={`plan:${p.provider}`} className="text-[11px]">
                                                                    <span className="flex items-center gap-1.5">
                                                                        <ProviderLogo provider={p.provider} className="h-3.5 w-3.5" />
                                                                        {p.name}
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        )
                                    })()}
                                    {/* Model dropdown */}
                                    <select
                                        value={overrideImageModel || selectedChannel?.defaultImageModel || ''}
                                        onChange={(e) => setOverrideImageModel(e.target.value)}
                                        disabled={loadingImageModels}
                                        className="h-7 text-[11px] rounded-md border bg-muted/50 px-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                    >
                                        <option value="">Default model</option>
                                        {availableImageModels.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                    {loadingImageModels && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                    {/* Quota badge */}
                                    {imageQuota.limit > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${imageQuota.used >= imageQuota.limit ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {imageQuota.used}/{imageQuota.limit} used
                                        </span>
                                    )}
                                    {imageQuota.limit === -1 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-400">∞ unlimited</span>
                                    )}
                                </div>
                                {/* No providers warning */}
                                {byokProviders.length === 0 && planProviders.length === 0 && (
                                    <p className="text-[10px] text-amber-400 bg-amber-500/10 rounded-md px-2 py-1.5">
                                        ⚠️ No image providers available. Add an API key in <strong>API Hub</strong> or upgrade your plan.
                                    </p>
                                )}

                                {/* Aspect Ratio selector */}
                                <div>
                                    <label className="text-[10px] text-muted-foreground font-medium mb-1.5 block">Aspect Ratio</label>
                                    <div className="flex gap-1.5">
                                        {[
                                            { value: '1:1' as const, label: '1:1', icon: <span className="w-4 h-4 border border-current rounded-[2px]" /> },
                                            { value: '16:9' as const, label: '16:9', icon: <span className="w-5 h-3 border border-current rounded-[2px]" /> },
                                            { value: '9:16' as const, label: '9:16', icon: <span className="w-3 h-5 border border-current rounded-[2px]" /> },
                                            { value: '4:3' as const, label: '4:3', icon: <span className="w-4.5 h-3.5 border border-current rounded-[2px]" style={{ width: '18px', height: '14px' }} /> },
                                            { value: '3:4' as const, label: '3:4', icon: <span className="border border-current rounded-[2px]" style={{ width: '14px', height: '18px' }} /> },
                                            { value: '4:5' as const, label: '4:5', icon: <span className="border border-current rounded-[2px]" style={{ width: '16px', height: '20px' }} /> },
                                        ].map(ratio => (
                                            <button
                                                key={ratio.value}
                                                type="button"
                                                onClick={() => setImageAspectRatio(ratio.value)}
                                                className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] font-medium transition-all cursor-pointer ${imageAspectRatio === ratio.value
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                                    }`}
                                            >
                                                {ratio.icon}
                                                {ratio.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Option: Use content as prompt or custom */}
                                {content.trim() && (
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setUseContentAsPrompt(true); setAiImagePrompt(content.substring(0, 500)) }}
                                            className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${useContentAsPrompt
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                                                }`}
                                        >
                                            <Sparkles className="h-4 w-4 mx-auto mb-1" />
                                            Auto from Content
                                            <p className="text-[10px] mt-0.5 font-normal opacity-70">Generate based on post content</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setUseContentAsPrompt(false); setAiImagePrompt('') }}
                                            className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${!useContentAsPrompt
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                                                }`}
                                        >
                                            <Pencil className="h-4 w-4 mx-auto mb-1" />
                                            Custom Prompt
                                            <p className="text-[10px] mt-0.5 font-normal opacity-70">Type your own image description</p>
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>{useContentAsPrompt && content.trim() ? 'Generated from your post content' : 'Image prompt'}</Label>
                                    {useContentAsPrompt && content.trim() ? (
                                        <div className="rounded-lg border bg-muted/50 p-3">
                                            <p className="text-xs text-muted-foreground line-clamp-4">{content.substring(0, 300)}{content.length > 300 ? '...' : ''}</p>
                                            <p className="text-[10px] text-muted-foreground/70 mt-2">AI will generate an image that matches this content</p>
                                        </div>
                                    ) : (
                                        <Input
                                            placeholder="Describe the image you want to generate..."
                                            value={aiImagePrompt}
                                            onChange={(e) => setAiImagePrompt(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && aiImagePrompt.trim() && handleAiImageGenerate()}
                                        />
                                    )}
                                    {visualIdea && !useContentAsPrompt && (
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            💡 AI suggestion: <span className="italic">{visualIdea}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Generate Button */}
                                <Button
                                    onClick={handleAiImageGenerate}
                                    disabled={generatingImage || (!aiImagePrompt.trim() && !useContentAsPrompt) || !selectedChannel}
                                    className="w-full cursor-pointer"
                                >
                                    {generatingImage ? (
                                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
                                    ) : (
                                        <><Sparkles className="h-4 w-4 mr-2" /> Generate Image</>
                                    )}
                                </Button>

                                {generatingImage && (
                                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Creating your image...</p>
                                    </div>
                                )}

                                {aiGeneratedPreview && !generatingImage && (
                                    <div className="space-y-3">
                                        <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                                            <img src={aiGeneratedPreview} alt="AI Generated" className="w-full h-full object-contain" />
                                        </div>
                                        {lastUsedImageModel && (
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Generated with {lastUsedImageModel}
                                                </Badge>
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="flex-1 cursor-pointer" onClick={handleAiImageGenerate} disabled={generatingImage}>
                                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
                                            </Button>
                                            <Button size="sm" className="flex-1 cursor-pointer" onClick={() => setShowImagePicker(false)}>
                                                <Check className="h-3.5 w-3.5 mr-1.5" /> Done
                                            </Button>
                                        </div>
                                        <p className="text-xs text-emerald-500 flex items-center gap-1">
                                            <Check className="h-3 w-3" /> Image saved to media library and attached to post
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 📰 Article */}
                        {imagePickerTab === 'article' && (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    If you pasted an article URL as your topic, we&apos;ll download the article&apos;s featured image.
                                </p>
                                {aiTopic.startsWith('http') ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs bg-muted rounded-md p-2">
                                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{aiTopic}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="cursor-pointer"
                                            disabled={downloadingStock !== null}
                                            onClick={async () => {
                                                if (!selectedChannel) return
                                                setDownloadingStock(-1)
                                                try {
                                                    const res = await fetch('/api/admin/posts/stock-images', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            action: 'download',
                                                            channelId: selectedChannel.id,
                                                            photoUrl: aiTopic,
                                                            alt: 'Article image',
                                                        }),
                                                    })
                                                    const data = await res.json()
                                                    if (!res.ok) throw new Error(data.error)
                                                    addFromLibrary(data.mediaItem)
                                                    toast.success('Article image downloaded and attached!')
                                                    setShowImagePicker(false)
                                                } catch (err) {
                                                    toast.error(err instanceof Error ? err.message : 'Failed to download image')
                                                } finally {
                                                    setDownloadingStock(null)
                                                }
                                            }}
                                        >
                                            {downloadingStock === -1 ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ImageIcon className="h-4 w-4 mr-1.5" />}
                                            Extract &amp; Download Article Image
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <Newspaper className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">No article URL detected.</p>
                                        <p className="text-xs text-muted-foreground mt-1">Paste an article URL in the AI topic input first.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Done Button — always visible at bottom */}
                    <div className="pt-3 border-t mt-4">
                        <Button variant="outline" className="w-full cursor-pointer" onClick={() => setShowImagePicker(false)}>
                            <Check className="h-4 w-4 mr-2" /> Done
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >

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
        </div >
    )
}
