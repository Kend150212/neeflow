'use client'

/**
 * PlatformSettingsPanel
 *
 * Registry-driven per-platform settings panel used in AI Post Creator modals.
 * Only shows options humans must choose — AI auto-generates everything else
 * (captions, hashtags, titles, tags, etc.).
 */

import { ChevronDown, Calendar, Clock, LayoutGrid, Film, CircleDot, Camera, Video, Scissors, Globe, EyeOff, Lock, Bell, ShieldCheck, MessageSquare, Link, Layers } from 'lucide-react'
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

    // Facebook — AI writes caption/hashtags; user only controls first comment
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

    // TikTok
    ttPostType: 'video' | 'carousel'

    // Pinterest — AI writes title/description; user provides board + link
    pinBoard: string
    pinLink: string
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
    scheduleDate: '',
    scheduleTime: '',
    fbEnableFirstComment: false,
    fbFirstComment: '',
    igPostType: 'feed',
    igShareToStory: false,
    ytPostType: 'video',
    ytCategory: '',
    ytPrivacy: 'public',
    ytNotifySubscribers: true,
    ytMadeForKids: false,
    ttPostType: 'video',
    pinBoard: '',
    pinLink: '',
}

interface Props {
    /** List of platform slugs that are currently selected (e.g. ['facebook','instagram']) */
    selectedPlatforms: string[]
    settings: PlatformSettings
    onChange: (patch: Partial<PlatformSettings>) => void
    /** Hide schedule picker in bulk mode */
    isBulk?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ToggleSwitch({ on, color = 'bg-primary', onChange }: { on: boolean; color?: string; onChange: () => void }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${on ? color : 'bg-muted'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
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

// ── Platform Registry ─────────────────────────────────────────────────────────
// To add support for a new platform, simply add an entry here.

interface RegistryEntry {
    label: string
    borderColor?: string
    render: (s: PlatformSettings, onChange: (p: Partial<PlatformSettings>) => void) => React.ReactNode
}

const PLATFORM_SETTINGS_REGISTRY: Record<string, RegistryEntry> = {

    // ── Facebook ──────────────────────────────────────────────────────────────
    // AI generates: caption, hashtags, post format
    // Human controls: whether to add a first comment (e.g. hashtag block)
    facebook: {
        label: 'Facebook Settings',
        render: (s, onChange) => (
            <div className="pt-3 space-y-3">
                <div className="flex items-center justify-between">
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
                    <textarea
                        value={s.fbFirstComment}
                        onChange={e => onChange({ fbFirstComment: e.target.value })}
                        placeholder="Add hashtags, links... #marketing"
                        className="w-full min-h-[52px] resize-y rounded-md border bg-transparent px-2.5 py-1.5 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                        rows={2}
                    />
                )}
                <p className="text-[9px] text-muted-foreground italic">Caption & hashtags are AI-generated.</p>
            </div>
        ),
    },

    // ── Instagram ─────────────────────────────────────────────────────────────
    // AI generates: caption, hashtags
    // Human controls: post type, share-to-story option
    instagram: {
        label: 'Instagram Settings',
        render: (s, onChange) => (
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
                <p className="text-[9px] text-muted-foreground italic border-t pt-2">Caption & hashtags are AI-generated.</p>
            </>
        ),
    },

    // ── YouTube ───────────────────────────────────────────────────────────────
    // AI generates: title, description, tags
    // Human controls: post type, privacy, category, notify subscribers, made for kids
    youtube: {
        label: 'YouTube Settings',
        render: (s, onChange) => (
            <>
                {/* Post Type */}
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
                {/* Privacy + Category */}
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
                {/* Toggles */}
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
                <p className="text-[9px] text-muted-foreground italic border-t pt-2">Title, description & tags are AI-generated.</p>
            </>
        ),
    },

    // ── TikTok ────────────────────────────────────────────────────────────────
    // AI generates: caption, hashtags
    // Human controls: post type (video vs carousel)
    tiktok: {
        label: 'TikTok Settings',
        borderColor: 'border-[#00F2EA]/30',
        render: (s, onChange) => (
            <div className="space-y-3 pt-3">
                <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Post Type</Label>
                    <div className="grid grid-cols-2 gap-1">
                        {([['video', 'Video', Video], ['carousel', 'Carousel', LayoutGrid]] as const).map(([val, lbl, Icon]) => (
                            <PostTypeButton key={val} label={lbl} icon={Icon} active={s.ttPostType === val}
                                color="border-[#00F2EA] bg-[#00F2EA]/10 text-[#00F2EA]"
                                onClick={() => onChange({ ttPostType: val })} />
                        ))}
                    </div>
                </div>
                <p className="text-[9px] text-muted-foreground italic">Caption & hashtags are AI-generated.</p>
            </div>
        ),
    },

    // ── Pinterest ─────────────────────────────────────────────────────────────
    // AI generates: pin title, description
    // Human controls: board name + destination link
    pinterest: {
        label: 'Pinterest Settings',
        render: (s, onChange) => (
            <div className="space-y-3 pt-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Layers className="h-3.5 w-3.5 text-[#E60023]" />
                        <Label className="text-[10px] text-muted-foreground">Board Name</Label>
                    </div>
                    <Input value={s.pinBoard} onChange={e => onChange({ pinBoard: e.target.value })}
                        placeholder="e.g. My Products, Inspiration" className="h-7 text-xs" />
                </div>
                <div className="space-y-1 border-t pt-2">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Link className="h-3.5 w-3.5 text-[#E60023]" />
                        <Label className="text-[10px] text-muted-foreground">Destination Link</Label>
                    </div>
                    <Input value={s.pinLink} onChange={e => onChange({ pinLink: e.target.value })}
                        placeholder="https://yourstore.com/product" className="h-7 text-xs" />
                </div>
                <p className="text-[9px] text-muted-foreground italic">Pin title & description are AI-generated.</p>
            </div>
        ),
    },

    // ── Platforms where AI handles everything ─────────────────────────────────
    linkedin: {
        label: 'LinkedIn Settings',
        render: () => (
            <p className="text-[10px] text-muted-foreground pt-3 pb-1 italic">AI generates the full post. No extra settings needed.</p>
        ),
    },
    twitter: {
        label: 'X (Twitter) Settings',
        render: () => (
            <p className="text-[10px] text-muted-foreground pt-3 pb-1 italic">AI generates the full post. No extra settings needed.</p>
        ),
    },
    threads: {
        label: 'Threads Settings',
        render: () => (
            <p className="text-[10px] text-muted-foreground pt-3 pb-1 italic">AI generates the full post. No extra settings needed.</p>
        ),
    },
    bluesky: {
        label: 'Bluesky Settings',
        render: () => (
            <p className="text-[10px] text-muted-foreground pt-3 pb-1 italic">AI generates the full post. No extra settings needed.</p>
        ),
    },
    gbp: {
        label: 'Google Business Settings',
        render: () => (
            <p className="text-[10px] text-muted-foreground pt-3 pb-1 italic">AI generates the full post. No extra settings needed.</p>
        ),
    },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlatformSettingsPanel({ selectedPlatforms, settings, onChange, isBulk = false }: Props) {
    // Platforms that have registry entries AND are currently selected
    const activePlatforms = selectedPlatforms.filter(p => PLATFORM_SETTINGS_REGISTRY[p])

    if (activePlatforms.length === 0 && isBulk) {
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
                const entry = PLATFORM_SETTINGS_REGISTRY[platform]
                return (
                    <SectionCard
                        key={platform}
                        platform={platform}
                        title={entry.label}
                        colorClass={entry.borderColor}
                    >
                        {entry.render(settings, onChange)}
                    </SectionCard>
                )
            })}

            {activePlatforms.length === 0 && !isBulk && (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">Select platforms above to see their settings</p>
                </div>
            )}
        </div>
    )
}
