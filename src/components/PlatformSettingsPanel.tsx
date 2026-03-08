'use client'

/**
 * PlatformSettingsPanel
 *
 * Registry-driven per-platform settings panel used in AI Post Creator modals.
 * Only shows options humans must choose — AI auto-generates everything else
 * (captions, hashtags, titles, tags, etc.).
 */

import { ChevronDown, Calendar, Clock, LayoutGrid, Film, CircleDot, Camera, Video, Scissors, Globe, EyeOff, Lock, Bell, ShieldCheck, MessageSquare, Link, Layers, Plus, Check } from 'lucide-react'
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

    // TikTok
    ttPostType: 'video' | 'carousel'

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
    ttPostType: 'video',
    pinBoardId: '',
    pinBoard: '',
    pinLink: '',
}

export interface PinterestBoard { id: string; name: string }

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
            <p className="text-[9px] text-muted-foreground italic border-t pt-2">Caption & hashtags are AI-generated.</p>
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
            <p className="text-[9px] text-muted-foreground italic border-t pt-2">Title, description & tags are AI-generated.</p>
        </>
    )

    const renderTikTok = (s: PlatformSettings) => (
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
    )

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
            <p className="text-[9px] text-muted-foreground italic">Pin title & description are AI-generated.</p>
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
