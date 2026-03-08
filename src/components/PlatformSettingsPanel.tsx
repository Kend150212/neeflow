'use client'

/**
 * PlatformSettingsPanel
 *
 * Registry-driven per-platform settings panel used in AI Post Creator modals.
 * Only shows options humans must choose — AI auto-generates everything else
 * (captions, hashtags, titles, tags, etc.).
 */

import { ChevronDown, Calendar, Clock, LayoutGrid, Film, CircleDot, Camera, Video, Scissors, Globe, EyeOff, Lock, Bell, ShieldCheck, MessageSquare, Link, Layers, Plus, Check, Sparkles, Send, Users } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'
import { PlatformIcon } from '@/components/platform-icons'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformSettings {
    // Schedule (single-post only)
    scheduleDate: string
    scheduleTime: string

    // Facebook — AI writes caption/hashtags; user controls Post Type + first comment
    fbPostType: 'feed' | 'reel' | 'story'
    fbEnableFirstComment: boolean
    fbFirstComment: string

    // Instagram
    igPostType: 'feed' | 'reel' | 'story'
    igShareToStory: boolean

    // YouTube — AI writes title/description/tags; user controls publish settings
    ytPostType: 'video' | 'shorts'
    ytCategory: string
    ytPrivacy: 'public' | 'unlisted' | 'private'
    ytNotifySubscribers: boolean
    ytMadeForKids: boolean

    // TikTok — full compliance settings (per TikTok Direct Post guidelines)
    ttPostType: 'video' | 'carousel'
    ttPublishMode: 'direct' | 'inbox'
    ttTitle: string
    ttVisibility: '' | 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'
    ttAllowComment: boolean
    ttAllowDuet: boolean
    ttAllowStitch: boolean
    ttCommercialDisclosure: boolean
    ttYourBrand: boolean
    ttBrandedContent: boolean
    ttAiGenerated: boolean

    // Pinterest — AI writes title/description; user provides board (from API) + link
    pinBoardId: string
    pinBoard: string
    pinLink: string
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
    scheduleDate: '',
    scheduleTime: '',
    fbPostType: 'feed',
    fbEnableFirstComment: false,
    fbFirstComment: '',
    igPostType: 'feed',
    igShareToStory: false,
    ytPostType: 'video',
    ytCategory: '',
    ytPrivacy: 'public',
    ytNotifySubscribers: true,
    ytMadeForKids: false,
    // TikTok defaults
    ttPostType: 'video',
    ttPublishMode: 'direct',
    ttTitle: '',
    ttVisibility: '',           // No default — TikTok requires explicit selection (guideline Point 2)
    ttAllowComment: true,
    ttAllowDuet: false,
    ttAllowStitch: false,
    ttCommercialDisclosure: false,
    ttYourBrand: false,
    ttBrandedContent: false,
    ttAiGenerated: true,         // AI-generated is true by default for AI flows
    pinBoardId: '',
    pinBoard: '',
    pinLink: '',
}

export interface PinterestBoard { id: string; name: string }

/** Minimal shape of TikTok creator_info returned by /api/tiktok/creator-info */
export interface TikTokCreatorInfo {
    can_post: boolean
    privacy_level_options: string[]
    duet_disabled: boolean
    stitch_disabled: boolean
    max_video_post_duration_sec?: number
}

interface Props {
    /** List of platform slugs that are currently selected (e.g. ['facebook','instagram']) */
    selectedPlatforms: string[]
    settings: PlatformSettings
    onChange: (patch: Partial<PlatformSettings>) => void
    /** Hide schedule picker in bulk mode */
    isBulk?: boolean
    /** Pinterest boards loaded from API */
    pinterestBoards?: PinterestBoard[]
    pinterestBoardsLoading?: boolean
    /** TikTok creator info loaded from /api/tiktok/creator-info */
    tikTokCreatorInfo?: TikTokCreatorInfo | null
    tikTokCreatorInfoLoading?: boolean
    /** Account name label for TikTok "Posting as…" banner */
    tikTokAccountName?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ToggleSwitch({ on, color = 'bg-primary', onChange, disabled }: { on: boolean; color?: string; onChange: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange()}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${on && !disabled ? color : 'bg-muted'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${on && !disabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    )
}

function PostTypeButton({ label, icon: Icon, active, color, onClick }: { label: string; icon: React.ElementType; active: boolean; color: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border transition-all cursor-pointer text-[11px] font-medium ${active ? `${color} ` : 'border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground'}`}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </button>
    )
}

function SectionCard({ platform, title, colorClass, children }: { platform: string; title: string; colorClass?: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(true)
    return (
        <div className={`rounded-lg border bg-card overflow-hidden ${colorClass || ''}`}>
            <button
                type="button"
                className="flex items-center justify-between w-full px-3 py-2 cursor-pointer"
                onClick={() => setOpen(o => !o)}
            >
                <span className="text-xs font-semibold flex items-center gap-1.5">
                    <PlatformIcon platform={platform} size="sm" />
                    {title}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
            </button>
            {open && <div className="px-3 pb-3 space-y-3 border-t">{children}</div>}
        </div>
    )
}

// ── Pinterest Board Picker ─────────────────────────────────────────────────────

function PinterestBoardPicker({
    settings,
    onChange,
    boards,
    loading,
}: {
    settings: PlatformSettings
    onChange: (p: Partial<PlatformSettings>) => void
    boards: PinterestBoard[]
    loading: boolean
}) {
    const [creatingNew, setCreatingNew] = useState(false)
    const [newBoardName, setNewBoardName] = useState('')

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <span className="h-3 w-3 border-2 border-[#E60023]/40 border-t-[#E60023] rounded-full animate-spin inline-block" />
                Loading boards…
            </div>
        )
    }

    if (creatingNew) {
        return (
            <div className="space-y-1.5">
                <input
                    autoFocus
                    type="text"
                    value={newBoardName}
                    onChange={e => setNewBoardName(e.target.value)}
                    placeholder="New board name…"
                    className="w-full h-7 rounded-md border bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-1.5">
                    <button type="button"
                        onClick={() => {
                            if (newBoardName.trim()) {
                                onChange({ pinBoardId: '__new__', pinBoard: newBoardName.trim() })
                                setCreatingNew(false)
                            }
                        }}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary text-primary-foreground cursor-pointer">
                        <Check className="h-3 w-3" /> Save
                    </button>
                    <button type="button" onClick={() => setCreatingNew(false)}
                        className="text-[10px] px-2 py-1 rounded-md border cursor-pointer text-muted-foreground">
                        Cancel
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-1.5">
            <Select
                value={settings.pinBoardId || ''}
                onValueChange={v => {
                    if (v === '__new__') { setCreatingNew(true); return }
                    const board = boards.find(b => b.id === v)
                    onChange({ pinBoardId: v, pinBoard: board?.name || '' })
                }}
            >
                <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select a Pinterest board…" />
                </SelectTrigger>
                <SelectContent>
                    {boards.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                    <SelectItem value="__new__">
                        <span className="flex items-center gap-1 text-primary">
                            <Plus className="h-3 w-3" /> Create new board
                        </span>
                    </SelectItem>
                </SelectContent>
            </Select>
            {boards.length === 0 && (
                <p className="text-[9px] text-muted-foreground">No boards found. Click &quot;Create new board&quot; to create one.</p>
            )}
        </div>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlatformSettingsPanel({
    selectedPlatforms,
    settings,
    onChange,
    isBulk = false,
    pinterestBoards = [],
    pinterestBoardsLoading = false,
    tikTokCreatorInfo,
    tikTokCreatorInfoLoading = false,
    tikTokAccountName,
}: Props) {

    const renderFacebook = (s: PlatformSettings) => (
        <div className="pt-3 space-y-3">
            {/* Post Type */}
            <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                <div className="grid grid-cols-3 gap-1">
                    {([['feed', 'Feed', LayoutGrid], ['reel', 'Reel', Film], ['story', 'Story', CircleDot]] as const).map(([val, lbl, Icon]) => (
                        <PostTypeButton key={val} label={lbl} icon={Icon} active={s.fbPostType === val}
                            color="border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            onClick={() => onChange({ fbPostType: val })} />
                    ))}
                </div>
            </div>
            {/* First Comment */}
            <div className="flex items-center justify-between border-t pt-2">
                <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                    <div>
                        <p className="text-xs font-medium">First Comment</p>
                        <p className="text-[9px] text-muted-foreground">Auto-posted right after publishing</p>
                    </div>
                </div>
                <ToggleSwitch on={s.fbEnableFirstComment} color="bg-blue-500" onChange={() => onChange({ fbEnableFirstComment: !s.fbEnableFirstComment })} />
            </div>
            {s.fbEnableFirstComment && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-blue-400/80 leading-relaxed">
                        AI will automatically generate the first comment based on your product content and selected tone.
                    </p>
                </div>
            )}
            <p className="text-[9px] text-muted-foreground italic">Caption &amp; hashtags are AI-generated.</p>
        </div>
    )

    const renderInstagram = (s: PlatformSettings) => (
        <>
            <div className="space-y-1 pt-3">
                <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                <div className="grid grid-cols-3 gap-1">
                    {([['feed', 'Feed', LayoutGrid], ['reel', 'Reel', Film], ['story', 'Story', CircleDot]] as const).map(([val, lbl, Icon]) => (
                        <PostTypeButton key={val} label={lbl} icon={Icon} active={s.igPostType === val}
                            color="border-pink-500 bg-pink-500/10 text-pink-600 dark:text-pink-400"
                            onClick={() => onChange({ igPostType: val })} />
                    ))}
                </div>
            </div>
            {s.igPostType === 'feed' && (
                <div className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center gap-1.5">
                        <Camera className="h-3.5 w-3.5 text-pink-500" />
                        <div>
                            <p className="text-xs font-medium">Also Share to Story</p>
                            <p className="text-[9px] text-muted-foreground">Repost feed to Stories automatically</p>
                        </div>
                    </div>
                    <ToggleSwitch on={s.igShareToStory} color="bg-pink-500" onChange={() => onChange({ igShareToStory: !s.igShareToStory })} />
                </div>
            )}
            <p className="text-[9px] text-muted-foreground italic border-t pt-2">Caption &amp; hashtags are AI-generated.</p>
        </>
    )

    const renderYouTube = (s: PlatformSettings) => (
        <>
            <div className="space-y-1 pt-3">
                <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                <div className="grid grid-cols-2 gap-1">
                    {([['video', 'Video', Video], ['shorts', 'Shorts', Scissors]] as const).map(([val, lbl, Icon]) => (
                        <PostTypeButton key={val} label={lbl} icon={Icon} active={s.ytPostType === val}
                            color="border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                            onClick={() => onChange({ ytPostType: val })} />
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t pt-2">
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Privacy</Label>
                    <Select value={s.ytPrivacy} onValueChange={v => onChange({ ytPrivacy: v as 'public' | 'unlisted' | 'private' })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="public"><span className="flex items-center gap-1"><Globe className="h-3 w-3" />Public</span></SelectItem>
                            <SelectItem value="unlisted"><span className="flex items-center gap-1"><EyeOff className="h-3 w-3" />Unlisted</span></SelectItem>
                            <SelectItem value="private"><span className="flex items-center gap-1"><Lock className="h-3 w-3" />Private</span></SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Category</Label>
                    <Select value={s.ytCategory} onValueChange={v => onChange({ ytCategory: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                            {['Entertainment', 'Education', 'Howto & Style', 'People & Blogs', 'Science & Technology', 'Sports', 'Music', 'Gaming', 'News & Politics', 'Film & Animation'].map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="border-t pt-2 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs font-medium">Notify Subscribers</span>
                    </div>
                    <ToggleSwitch on={s.ytNotifySubscribers} color="bg-red-500" onChange={() => onChange({ ytNotifySubscribers: !s.ytNotifySubscribers })} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
                        <div>
                            <span className="text-xs font-medium">Made for Kids</span>
                            <p className="text-[9px] text-muted-foreground">Required by COPPA</p>
                        </div>
                    </div>
                    <ToggleSwitch on={s.ytMadeForKids} color="bg-red-500" onChange={() => onChange({ ytMadeForKids: !s.ytMadeForKids })} />
                </div>
            </div>
            <p className="text-[9px] text-muted-foreground italic border-t pt-2">Title, description &amp; tags are AI-generated.</p>
        </>
    )

    const renderTikTok = (s: PlatformSettings) => {
        const ci = tikTokCreatorInfo
        const brandedContentConflict = s.ttCommercialDisclosure && s.ttBrandedContent && s.ttVisibility === 'SELF_ONLY'
        const showBrandedDisclaimer = s.ttCommercialDisclosure && s.ttBrandedContent
        const ttNickname = tikTokAccountName || 'Your TikTok Account'

        return (
            <div className="space-y-3 pt-3">

                {/* ── Account banner ── */}
                <div className="flex items-center gap-2 p-2 rounded-md bg-[#00F2EA]/5 border border-[#00F2EA]/20">
                    <div className="h-6 w-6 rounded-full bg-[#00F2EA]/20 flex items-center justify-center text-[10px] font-bold text-[#00F2EA] shrink-0">
                        {ttNickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                        <p className="text-[10px] text-muted-foreground">Posting to TikTok as</p>
                        <p className="text-xs font-semibold">{ttNickname}</p>
                    </div>
                    {tikTokCreatorInfoLoading && <span className="ml-auto text-[9px] text-muted-foreground animate-pulse">Loading…</span>}
                </div>

                {/* ── can_post=false warning ── */}
                {ci && !ci.can_post && (
                    <div className="flex items-start gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/30">
                        <span className="text-destructive text-[11px] mt-0.5">⛔</span>
                        <p className="text-[10px] text-destructive leading-relaxed">
                            This TikTok account has reached its posting limit. Please try again later.
                        </p>
                    </div>
                )}

                {/* ── Publish As ── */}
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Publish As</Label>
                    <div className="grid grid-cols-2 gap-1">
                        {([
                            { value: 'direct' as const, label: 'Direct Publishing', icon: Send },
                            { value: 'inbox' as const, label: 'App Notification', icon: Bell },
                        ]).map(opt => {
                            const isActive = s.ttPublishMode === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border transition-all cursor-pointer text-[11px] font-medium ${isActive
                                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                        : 'border-border hover:border-cyan-300 text-muted-foreground hover:text-foreground'
                                        }`}
                                    onClick={() => onChange({ ttPublishMode: opt.value })}
                                >
                                    <opt.icon className="h-3.5 w-3.5" />
                                    {opt.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* ── Post Type ── */}
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                    <div className="grid grid-cols-2 gap-1">
                        {([
                            { value: 'video' as const, label: 'Video', icon: Video },
                            { value: 'carousel' as const, label: 'Image Carousel', icon: LayoutGrid },
                        ]).map(opt => {
                            const isActive = s.ttPostType === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border transition-all cursor-pointer text-[11px] font-medium ${isActive
                                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                        : 'border-border hover:border-cyan-300 text-muted-foreground hover:text-foreground'
                                        }`}
                                    onClick={() => onChange({ ttPostType: opt.value })}
                                >
                                    <opt.icon className="h-3.5 w-3.5" />
                                    {opt.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* ── Carousel ≥2 images warning ── */}
                {s.ttPostType === 'carousel' && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                        <span className="text-amber-400 text-[11px]">⚠️</span>
                        <p className="text-[10px] text-amber-400 leading-relaxed">
                            TikTok Carousel requires at least <strong>2 images</strong>. Please add images in the Media step.
                        </p>
                    </div>
                )}

                {/* ── Video Title ── */}
                <div className="space-y-1 border-t pt-2">
                    <Label className="text-[10px] text-muted-foreground">
                        Video Title <span className="text-muted-foreground/60">(optional, max 2200)</span>
                    </Label>
                    <input
                        type="text"
                        maxLength={2200}
                        value={s.ttTitle}
                        onChange={e => onChange({ ttTitle: e.target.value })}
                        placeholder="Leave blank to use caption as title"
                        className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    />
                </div>

                {/* ── Who can see (Privacy) ── */}
                <div className="space-y-1 border-t pt-2">
                    <Label className="text-[10px] text-muted-foreground">
                        Who can see <span className="text-destructive">*</span>
                    </Label>
                    <Select
                        value={s.ttVisibility}
                        onValueChange={v => {
                            const newVis = v as typeof s.ttVisibility
                            if (newVis === 'SELF_ONLY' && s.ttCommercialDisclosure && s.ttBrandedContent) return
                            onChange({ ttVisibility: newVis })
                        }}
                    >
                        <SelectTrigger className={`text-xs h-7 ${s.ttVisibility === '' ? 'text-muted-foreground' : ''}`}>
                            <SelectValue placeholder="Select privacy…" />
                        </SelectTrigger>
                        <SelectContent>
                            {(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'] as const)
                                .filter(opt => !ci || ci.privacy_level_options.includes(opt) || opt === 'PUBLIC_TO_EVERYONE')
                                .map(opt => {
                                    const labelMap: Record<string, { label: string; icon: React.ReactNode }> = {
                                        PUBLIC_TO_EVERYONE: { label: 'Public To Everyone', icon: <Globe className="h-3 w-3" /> },
                                        MUTUAL_FOLLOW_FRIENDS: { label: 'Mutual Follow Friends', icon: <Users className="h-3 w-3" /> },
                                        SELF_ONLY: { label: 'Self Only', icon: <Lock className="h-3 w-3" /> },
                                    }
                                    const item = labelMap[opt] || { label: opt, icon: null }
                                    const isDisabled = opt === 'SELF_ONLY' && s.ttCommercialDisclosure && s.ttBrandedContent
                                    return (
                                        <SelectItem key={opt} value={opt} disabled={isDisabled}>
                                            <span className="flex items-center gap-1.5">
                                                {item.icon} {item.label}
                                                {isDisabled && <span className="text-[9px] text-destructive ml-1">(unavailable for Branded Content)</span>}
                                            </span>
                                        </SelectItem>
                                    )
                                })}
                        </SelectContent>
                    </Select>
                    {brandedContentConflict && (
                        <p className="text-[10px] text-destructive">Branded content visibility cannot be set to private.</p>
                    )}
                </div>

                {/* ── Allow User to (Comment / Duet / Stitch) ── */}
                <div className="border-t pt-2 space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Allow User to</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Comment', value: s.ttAllowComment, key: 'ttAllowComment' as const, isDisabled: false },
                            { label: 'Duet', value: s.ttAllowDuet, key: 'ttAllowDuet' as const, isDisabled: s.ttPostType !== 'video' || (ci?.duet_disabled ?? false) },
                            { label: 'Stitch', value: s.ttAllowStitch, key: 'ttAllowStitch' as const, isDisabled: s.ttPostType !== 'video' || (ci?.stitch_disabled ?? false) },
                        ].map(opt => (
                            <div key={opt.label} className="flex flex-col items-center gap-1">
                                <p className={`text-[10px] font-medium ${opt.isDisabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>{opt.label}</p>
                                <ToggleSwitch
                                    on={opt.value}
                                    color="bg-cyan-500"
                                    disabled={opt.isDisabled}
                                    onChange={() => onChange({ [opt.key]: !opt.value })}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Disclose video content (Commercial Disclosure) ── */}
                <div className="border-t pt-2 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium">Disclose video content</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                                Turn on to disclose that this video promotes goods or services in exchange for something of value. Your video could promote yourself, a third party, or both.
                            </p>
                        </div>
                        <ToggleSwitch
                            on={s.ttCommercialDisclosure}
                            color="bg-cyan-500"
                            onChange={() => {
                                const next = !s.ttCommercialDisclosure
                                onChange({
                                    ttCommercialDisclosure: next,
                                    ...(next ? {} : { ttYourBrand: false, ttBrandedContent: false }),
                                })
                            }}
                        />
                    </div>
                    {s.ttCommercialDisclosure && (
                        <div className="space-y-2">
                            <div className="flex items-start gap-1.5 p-2 rounded-md bg-blue-500/10 border border-blue-500/30">
                                <span className="text-blue-400 text-[11px] mt-0.5 flex-shrink-0">ℹ️</span>
                                <p className="text-[10px] text-blue-400 leading-relaxed">
                                    Your video will be labeled &quot;Promotional content&quot;.<br />
                                    This cannot be changed once your video is posted.
                                </p>
                            </div>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mt-0.5 accent-cyan-500"
                                    checked={s.ttYourBrand}
                                    onChange={e => onChange({ ttYourBrand: e.target.checked })}
                                />
                                <div>
                                    <p className="text-xs font-semibold">Your brand</p>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">You are promoting yourself or your own business. This video will be classified as Brand Organic.</p>
                                </div>
                            </label>
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mt-0.5 accent-cyan-500"
                                    checked={s.ttBrandedContent}
                                    onChange={e => {
                                        const checked = e.target.checked
                                        const updates: Partial<PlatformSettings> = { ttBrandedContent: checked }
                                        if (checked && s.ttVisibility === 'SELF_ONLY') {
                                            updates.ttVisibility = 'PUBLIC_TO_EVERYONE'
                                        }
                                        onChange(updates)
                                    }}
                                />
                                <div>
                                    <p className="text-xs font-semibold">Branded content</p>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">You are promoting another brand or a third party. This video will be classified as Branded Content.</p>
                                </div>
                            </label>
                            {!s.ttYourBrand && !s.ttBrandedContent && (
                                <p className="text-[9px] text-muted-foreground italic">You need to indicate if your content promotes yourself, a third party, or both.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── AI-Generated content ── */}
                <div className="border-t pt-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                            <p className="text-xs font-medium">AI-generated content</p>
                        </div>
                        <ToggleSwitch
                            on={s.ttAiGenerated}
                            color="bg-cyan-500"
                            onChange={() => onChange({ ttAiGenerated: !s.ttAiGenerated })}
                        />
                    </div>
                </div>

                {/* ── Music Usage Confirmation ── */}
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

            </div>
        )
    }

    const renderPinterest = (s: PlatformSettings) => (
        <div className="space-y-3 pt-3">
            {/* Board */}
            <div className="space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                    <Layers className="h-3.5 w-3.5 text-[#E60023]" />
                    <Label className="text-[10px] text-muted-foreground">Board</Label>
                </div>
                <PinterestBoardPicker
                    settings={s}
                    onChange={onChange}
                    boards={pinterestBoards}
                    loading={pinterestBoardsLoading}
                />
            </div>
            {/* Destination Link */}
            <div className="space-y-1 border-t pt-2">
                <div className="flex items-center gap-1.5 mb-1">
                    <Link className="h-3.5 w-3.5 text-[#E60023]" />
                    <Label className="text-[10px] text-muted-foreground">Destination Link</Label>
                </div>
                <Input value={s.pinLink} onChange={e => onChange({ pinLink: e.target.value })}
                    placeholder="https://yourstore.com/product" className="h-7 text-xs" />
            </div>
            <p className="text-[9px] text-muted-foreground italic">Pin title &amp; description are AI-generated.</p>
        </div>
    )

    const renderAIHandlesAll = () => (
        <p className="text-[10px] text-muted-foreground pt-3 pb-1 italic">AI generates the full post. No extra settings needed.</p>
    )

    const REGISTRY: Record<string, { label: string; render: (s: PlatformSettings) => React.ReactNode }> = {
        facebook: { label: 'Facebook Settings', render: renderFacebook },
        instagram: { label: 'Instagram Settings', render: renderInstagram },
        youtube: { label: 'YouTube Settings', render: renderYouTube },
        tiktok: { label: 'TikTok Settings', render: renderTikTok },
        pinterest: { label: 'Pinterest Settings', render: renderPinterest },
        linkedin: { label: 'LinkedIn Settings', render: renderAIHandlesAll },
        twitter: { label: 'X (Twitter) Settings', render: renderAIHandlesAll },
        threads: { label: 'Threads Settings', render: renderAIHandlesAll },
        bluesky: { label: 'Bluesky Settings', render: renderAIHandlesAll },
        gbp: { label: 'Google Business Settings', render: renderAIHandlesAll },
    }

    const activePlatforms = selectedPlatforms.filter(p => REGISTRY[p])

    if (activePlatforms.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4 space-y-2">
                <p className="text-xs text-muted-foreground">Select platforms to see settings</p>
            </div>
        )
    }

    return (
        <div className="space-y-2.5">
            {/* Schedule — single post only */}
            {!isBulk && (
                <div className="rounded-lg border bg-card p-3 space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        Schedule
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Date</Label>
                            <input type="date" value={settings.scheduleDate}
                                onChange={e => onChange({ scheduleDate: e.target.value })}
                                className="w-full h-7 rounded-md border bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Time</Label>
                            <input type="time" value={settings.scheduleTime}
                                onChange={e => onChange({ scheduleTime: e.target.value })}
                                className="w-full h-7 rounded-md border bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                    </div>
                    {settings.scheduleDate && (
                        <p className="text-[9px] text-muted-foreground text-center">
                            Post will be scheduled for {settings.scheduleDate}{settings.scheduleTime ? ` at ${settings.scheduleTime}` : ''}
                        </p>
                    )}
                    {!settings.scheduleDate && (
                        <p className="text-[9px] text-muted-foreground text-center">Leave blank to post immediately</p>
                    )}
                </div>
            )}

            {/* Per-platform settings */}
            {activePlatforms.map(platform => {
                const entry = REGISTRY[platform]
                return (
                    <SectionCard key={platform} platform={platform} title={entry.label}>
                        {entry.render(settings)}
                    </SectionCard>
                )
            })}
        </div>
    )
}
