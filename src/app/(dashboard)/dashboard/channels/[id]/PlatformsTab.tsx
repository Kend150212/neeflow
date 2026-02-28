'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'
import {
    Globe,
    Search,
    Trash2,
    RefreshCw,
    Plus,
    Pencil,
    Eye,
    EyeOff,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import type { ChannelPlatformEntry, EasyLink } from './types'
import { platformIcons, platformOptions } from './constants'

interface PlatformsTabProps {
    channelId: string
    platforms: ChannelPlatformEntry[]
    setPlatforms: (v: ChannelPlatformEntry[] | ((prev: ChannelPlatformEntry[]) => ChannelPlatformEntry[])) => void
    isAdmin: boolean
    activeTab: string
}

export default function PlatformsTab({
    channelId,
    platforms,
    setPlatforms,
    isAdmin,
    activeTab,
}: PlatformsTabProps) {
    const t = useTranslation()

    // Platform search & filter
    const [platformSearch, setPlatformSearch] = useState('')
    const [hideDisabled, setHideDisabled] = useState(false)

    // Credential-based connect forms
    const [showBlueskyForm, setShowBlueskyForm] = useState(false)
    const [blueskyHandle, setBlueskyHandle] = useState('')
    const [blueskyAppPassword, setBlueskyAppPassword] = useState('')
    const [blueskyConnecting, setBlueskyConnecting] = useState(false)
    const [showXForm, setShowXForm] = useState(false)
    const [xApiKey, setXApiKey] = useState('')
    const [xApiKeySecret, setXApiKeySecret] = useState('')
    const [xAccessToken, setXAccessToken] = useState('')
    const [xAccessTokenSecret, setXAccessTokenSecret] = useState('')
    const [xConnecting, setXConnecting] = useState(false)

    // EasyConnect state
    const [easyLinks, setEasyLinks] = useState<EasyLink[]>([])
    const [easyLinksLoading, setEasyLinksLoading] = useState(false)
    const [showCreateLink, setShowCreateLink] = useState(false)
    const [newLinkTitle, setNewLinkTitle] = useState('')
    const [newLinkPassword, setNewLinkPassword] = useState('')
    const [creatingLink, setCreatingLink] = useState(false)
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
    const [editingLinkTitle, setEditingLinkTitle] = useState('')
    const [easyLinksLoaded, setEasyLinksLoaded] = useState(false)

    // Load EasyConnect links when tab active
    useEffect(() => {
        if (activeTab === 'platforms' && !easyLinksLoaded && channelId) {
            loadEasyLinks()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, channelId])

    const loadEasyLinks = async () => {
        if (!channelId) return
        setEasyLinksLoading(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/easy-connect`)
            if (res.ok) setEasyLinks(await res.json())
        } finally { setEasyLinksLoading(false); setEasyLinksLoaded(true) }
    }

    const createEasyLink = async () => {
        if (!newLinkTitle.trim()) return
        setCreatingLink(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/easy-connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newLinkTitle, password: newLinkPassword || undefined }),
            })
            if (res.ok) {
                const link = await res.json()
                setEasyLinks(prev => [link, ...prev])
                setShowCreateLink(false)
                setNewLinkTitle('')
                setNewLinkPassword('')
                toast.success('EasyConnect link created!')
            }
        } finally { setCreatingLink(false) }
    }

    const toggleEasyLink = async (linkId: string, isEnabled: boolean) => {
        await fetch(`/api/admin/channels/${channelId}/easy-connect/${linkId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isEnabled }),
        })
        setEasyLinks(prev => prev.map(l => l.id === linkId ? { ...l, isEnabled } : l))
    }

    const renameEasyLink = async (linkId: string) => {
        if (!editingLinkTitle.trim()) { setEditingLinkId(null); return }
        await fetch(`/api/admin/channels/${channelId}/easy-connect/${linkId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: editingLinkTitle.trim() }),
        })
        setEasyLinks(prev => prev.map(l => l.id === linkId ? { ...l, title: editingLinkTitle.trim() } : l))
        setEditingLinkId(null)
        toast.success('Link renamed')
    }

    const deleteEasyLink = async (linkId: string) => {
        if (!confirm('Delete this EasyConnect link? Clients will no longer be able to use it.')) return
        await fetch(`/api/admin/channels/${channelId}/easy-connect/${linkId}`, { method: 'DELETE' })
        setEasyLinks(prev => prev.filter(l => l.id !== linkId))
        toast.success('Link deleted')
    }

    const copyEasyLink = (token: string, linkId: string) => {
        const url = `${window.location.origin}/connect/${token}`
        navigator.clipboard.writeText(url)
        setCopiedLinkId(linkId)
        setTimeout(() => setCopiedLinkId(null), 2000)
    }

    // Platform CRUD
    const togglePlatformActive = async (platformId: string, active: boolean) => {
        try {
            await fetch(`/api/admin/channels/${channelId}/platforms`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platformId, isActive: active }),
            })
            setPlatforms((prev: ChannelPlatformEntry[]) => prev.map(p => p.id === platformId ? { ...p, isActive: active } : p))
        } catch {
            toast.error(t('channels.platforms.connectFailed'))
        }
    }

    const deletePlatformConnection = async (platformId: string) => {
        try {
            await fetch(`/api/admin/channels/${channelId}/platforms?platformId=${platformId}`, { method: 'DELETE' })
            setPlatforms((prev: ChannelPlatformEntry[]) => prev.filter(p => p.id !== platformId))
            toast.success(t('channels.platforms.disconnected'))
        } catch {
            toast.error(t('channels.platforms.disconnectFailed'))
        }
    }

    const toggleAllPlatforms = async (active: boolean) => {
        const toToggle = platforms.filter(p => p.isActive !== active)
        if (toToggle.length === 0) return
        await Promise.all(
            toToggle.map(p =>
                fetch(`/api/admin/channels/${channelId}/platforms`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ platformId: p.id, isActive: active }),
                })
            )
        )
        setPlatforms((prev: ChannelPlatformEntry[]) => prev.map(p => ({ ...p, isActive: active })))
    }

    const openOAuthPopup = (key: string, label: string) => {
        const w = 500, h = 700
        const left = window.screenX + (window.outerWidth - w) / 2
        const top = window.screenY + (window.outerHeight - h) / 2
        const popup = window.open(
            `/api/oauth/${key}?channelId=${channelId}`,
            `${key}-oauth`,
            `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
        )
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'oauth-success' && e.data?.platform === key) {
                window.removeEventListener('message', handler)
                toast.success(`${label} connected successfully!`)
                fetch(`/api/admin/channels/${channelId}/platforms`).then(r => r.ok ? r.json() : []).then(data => setPlatforms(data)).catch(() => { })
            }
        }
        window.addEventListener('message', handler)
        const check = setInterval(() => {
            if (popup?.closed) {
                clearInterval(check)
                window.removeEventListener('message', handler)
                fetch(`/api/admin/channels/${channelId}/platforms`).then(r => r.ok ? r.json() : []).then(data => setPlatforms(data)).catch(() => { })
            }
        }, 1000)
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                        <CardTitle className="text-base">{t('channels.platforms.title')}</CardTitle>
                        <CardDescription>{t('channels.platforms.desc')}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* OAuth Connect Strip */}
                    <div className="border rounded-lg p-3 bg-muted/20">
                        <p className="text-[11px] font-medium text-muted-foreground mb-2">Connect a platform</p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: 'facebook', label: 'Facebook', border: 'border-blue-500/30', hover: 'hover:bg-blue-500/10' },
                                { key: 'instagram', label: 'Instagram', border: 'border-pink-500/30', hover: 'hover:bg-pink-500/10' },
                                { key: 'youtube', label: 'YouTube', border: 'border-red-500/30', hover: 'hover:bg-red-500/10' },
                                { key: 'tiktok', label: 'TikTok', border: 'border-neutral-500/30', hover: 'hover:bg-neutral-500/10' },
                                { key: 'linkedin', label: 'LinkedIn', border: 'border-blue-600/30', hover: 'hover:bg-blue-600/10' },
                                { key: 'pinterest', label: 'Pinterest', border: 'border-red-600/30', hover: 'hover:bg-red-600/10' },
                                { key: 'threads', label: 'Threads', border: 'border-neutral-600/30', hover: 'hover:bg-neutral-600/10' },
                                { key: 'gbp', label: 'Google Business', border: 'border-blue-400/30', hover: 'hover:bg-blue-400/10' },
                            ].map(({ key, label, border, hover }) => (
                                <Button
                                    key={key}
                                    variant="outline"
                                    size="sm"
                                    className={`gap-1.5 h-7 text-xs ${border} ${hover}`}
                                    onClick={() => openOAuthPopup(key, label)}
                                >
                                    {platformIcons[key]}
                                    <span>{label}</span>
                                </Button>
                            ))}
                            {/* X — credential-based */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-7 text-xs border-neutral-500/30 hover:bg-neutral-500/10"
                                onClick={() => setShowXForm(f => !f)}
                            >
                                {platformIcons['x']}
                                <span>X</span>
                            </Button>
                            {/* Bluesky — credential-based */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-7 text-xs border-sky-500/30 hover:bg-sky-500/10"
                                onClick={() => setShowBlueskyForm(f => !f)}
                            >
                                {platformIcons['bluesky']}
                                <span>Bluesky</span>
                            </Button>
                        </div>

                        {/* Bluesky Form */}
                        {showBlueskyForm && (
                            <div className="mt-3 border rounded-lg p-3 bg-muted/30 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">{t('channels.blueskyConnectTitle') || 'Connect Bluesky Account'}</p>
                                <p className="text-[11px] text-muted-foreground">{t('channels.blueskyConnectHint') || 'Use an App Password from bsky.app → Settings → App Passwords'}</p>
                                <input
                                    type="text"
                                    placeholder="Handle (e.g. user.bsky.social)"
                                    value={blueskyHandle}
                                    onChange={e => setBlueskyHandle(e.target.value)}
                                    className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <input
                                    type="password"
                                    placeholder="App Password"
                                    value={blueskyAppPassword}
                                    onChange={e => setBlueskyAppPassword(e.target.value)}
                                    className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <Button
                                    size="sm"
                                    className="h-7 text-xs w-full"
                                    disabled={blueskyConnecting || !blueskyHandle || !blueskyAppPassword}
                                    onClick={async () => {
                                        setBlueskyConnecting(true)
                                        try {
                                            const res = await fetch('/api/oauth/bluesky', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ handle: blueskyHandle, appPassword: blueskyAppPassword, channelId }),
                                            })
                                            const data = await res.json()
                                            if (!res.ok) throw new Error(data.error || 'Connection failed')
                                            toast.success(`Bluesky @${data.handle || blueskyHandle} connected!`)
                                            setShowBlueskyForm(false)
                                            setBlueskyHandle('')
                                            setBlueskyAppPassword('')
                                            fetch(`/api/admin/channels/${channelId}/platforms`).then(r => r.ok ? r.json() : []).then(d => setPlatforms(d)).catch(() => { })
                                        } catch (err) {
                                            toast.error(err instanceof Error ? err.message : 'Failed to connect Bluesky')
                                        } finally {
                                            setBlueskyConnecting(false)
                                        }
                                    }}
                                >
                                    {blueskyConnecting ? 'Connecting...' : 'Connect'}
                                </Button>
                            </div>
                        )}

                        {/* X (Twitter) Form */}
                        {showXForm && (
                            <div className="mt-3 border border-neutral-500/30 rounded-lg p-3 bg-muted/30 space-y-3">
                                <div>
                                    <p className="text-xs font-semibold mb-0.5">Connect X (Twitter) Account</p>
                                    <p className="text-[11px] text-muted-foreground">You need a <strong>Twitter Developer App</strong> with <strong>Read and Write</strong> permissions + <strong>User Authentication</strong> enabled.</p>
                                </div>
                                <div className="text-[11px] text-muted-foreground space-y-1 border rounded p-2 bg-background/50">
                                    <p className="font-semibold text-foreground">📋 How to get API credentials:</p>
                                    <p><span className="font-medium text-foreground">Step 1:</span> Go to <a href="https://developer.x.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">developer.x.com</a> → Sign in → Click <strong>+ Create Project</strong></p>
                                    <p><span className="font-medium text-foreground">Step 2:</span> Create an App → In App Settings → enable <strong>OAuth 1.0a</strong> → set permissions to <strong>Read and Write</strong></p>
                                    <p><span className="font-medium text-foreground">Step 3:</span> Set Callback URL to your app URL (e.g. <code className="bg-muted px-1 rounded">https://yourdomain.com</code>)</p>
                                    <p><span className="font-medium text-foreground">Step 4:</span> Go to <strong>Keys and tokens</strong> tab → copy:</p>
                                    <ul className="ml-3 space-y-0.5 list-disc">
                                        <li><strong>API Key</strong> (Consumer Key)</li>
                                        <li><strong>API Key Secret</strong> (Consumer Secret)</li>
                                        <li><strong>Access Token</strong> — click Generate if not shown</li>
                                        <li><strong>Access Token Secret</strong></li>
                                    </ul>
                                    <p className="text-amber-500">⚠️ Free tier = 1,500 tweets/month. Basic plan ($100/month) = 3M tweets/month</p>
                                </div>
                                <input type="password" placeholder="API Key (Consumer Key)" value={xApiKey} onChange={e => setXApiKey(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                                <input type="password" placeholder="API Key Secret (Consumer Secret)" value={xApiKeySecret} onChange={e => setXApiKeySecret(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                                <input type="password" placeholder="Access Token" value={xAccessToken} onChange={e => setXAccessToken(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                                <input type="password" placeholder="Access Token Secret" value={xAccessTokenSecret} onChange={e => setXAccessTokenSecret(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                                <Button
                                    size="sm"
                                    className="h-7 text-xs w-full"
                                    disabled={xConnecting || !xApiKey || !xApiKeySecret || !xAccessToken || !xAccessTokenSecret}
                                    onClick={async () => {
                                        setXConnecting(true)
                                        try {
                                            const res = await fetch('/api/oauth/x/connect', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ apiKey: xApiKey, apiKeySecret: xApiKeySecret, accessToken: xAccessToken, accessTokenSecret: xAccessTokenSecret, channelId }),
                                            })
                                            const data = await res.json()
                                            if (!res.ok) throw new Error(data.error || 'Connection failed')
                                            toast.success(`X @${data.username || data.accountName} connected!`)
                                            setShowXForm(false)
                                            setXApiKey(''); setXApiKeySecret(''); setXAccessToken(''); setXAccessTokenSecret('')
                                            fetch(`/api/admin/channels/${channelId}/platforms`).then(r => r.ok ? r.json() : []).then(d => setPlatforms(d)).catch(() => { })
                                        } catch (err) {
                                            toast.error(err instanceof Error ? err.message : 'Failed to connect X')
                                        } finally {
                                            setXConnecting(false)
                                        }
                                    }}
                                >
                                    {xConnecting ? 'Verifying & Connecting...' : 'Connect X Account'}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Search and Bulk Actions */}
                    {platforms.length > 0 && (
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search accounts..."
                                    value={platformSearch}
                                    onChange={(e) => setPlatformSearch(e.target.value)}
                                    className="pl-9 h-8 text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant={hideDisabled ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setHideDisabled(!hideDisabled)}
                                    className="gap-1.5 h-8 text-xs"
                                    title={hideDisabled ? 'Show all accounts' : 'Hide disabled accounts'}
                                >
                                    {hideDisabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                    {hideDisabled ? 'Show All' : 'Hide Disabled'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => toggleAllPlatforms(true)} className="gap-1.5 h-8 text-xs">
                                    <ToggleRight className="h-3.5 w-3.5" /> Enable All
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => toggleAllPlatforms(false)} className="gap-1.5 h-8 text-xs">
                                    <ToggleLeft className="h-3.5 w-3.5" /> Disable All
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Platform List — grouped by platform type */}
                    {platforms.length === 0 ? (
                        <div className="text-center py-8">
                            <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-sm font-medium">{t('channels.platforms.noPlatforms')}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t('channels.platforms.noPlatformsDesc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(() => {
                                const visiblePlatforms = isAdmin
                                    ? (hideDisabled ? platforms.filter(p => p.isActive) : platforms)
                                    : platforms.filter(p => p.isActive)
                                const searchLower = platformSearch.toLowerCase()
                                const filtered = searchLower
                                    ? visiblePlatforms.filter(p =>
                                        p.accountName.toLowerCase().includes(searchLower) ||
                                        p.accountId.toLowerCase().includes(searchLower) ||
                                        p.platform.toLowerCase().includes(searchLower)
                                    )
                                    : visiblePlatforms
                                const grouped = filtered.reduce<Record<string, ChannelPlatformEntry[]>>((groups, p) => {
                                    const key = p.platform
                                    if (!groups[key]) groups[key] = []
                                    groups[key].push(p)
                                    return groups
                                }, {})
                                return Object.entries(grouped).map(([platformKey, items]) => {
                                    const info = platformOptions.find(o => o.value === platformKey)
                                    return (
                                        <div key={platformKey} className="border rounded-lg overflow-hidden">
                                            <div
                                                className="flex items-center gap-2.5 px-4 py-2.5 border-b"
                                                style={{ backgroundColor: `${info?.color || '#888'}10` }}
                                            >
                                                {platformIcons[platformKey] || (
                                                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: info?.color || '#888' }} />
                                                )}
                                                <span className="text-sm font-semibold">{info?.label || platformKey}</span>
                                                <Badge variant="secondary" className="text-[10px] ml-auto">{items.length}</Badge>
                                            </div>
                                            <div className="divide-y">
                                                {items.map((p) => (
                                                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                                                        <div>
                                                            <p className="text-sm font-medium">{p.accountName}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{p.accountId}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Switch checked={p.isActive} onCheckedChange={(checked) => togglePlatformActive(p.id, checked)} />
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                                                title="Reconnect to refresh token"
                                                                onClick={() => openOAuthPopup(p.platform, p.accountName)}
                                                            >
                                                                <RefreshCw className="h-3 w-3" /> Reconnect
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                onClick={() => deletePlatformConnection(p.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })
                            })()}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── EasyConnect Links ───────────────── */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <span>🔗</span> EasyConnect Links
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                                Share a secure link with clients — they connect their social accounts directly without sharing passwords.
                            </CardDescription>
                        </div>
                        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowCreateLink(v => !v)}>
                            <Plus className="h-3.5 w-3.5" /> New Link
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                    {/* Create Link Form */}
                    {showCreateLink && (
                        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground">New EasyConnect Link</p>
                            <Input placeholder='Link title (e.g. "For client Nike")' className="h-8 text-sm" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} />
                            <Input type="password" placeholder="Password (optional)" className="h-8 text-sm" value={newLinkPassword} onChange={e => setNewLinkPassword(e.target.value)} />
                            <div className="flex gap-2">
                                <Button size="sm" className="h-8 text-xs" onClick={createEasyLink} disabled={creatingLink || !newLinkTitle.trim()}>
                                    {creatingLink ? 'Creating...' : 'Create Link'}
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowCreateLink(false)}>Cancel</Button>
                            </div>
                        </div>
                    )}

                    {easyLinksLoading && <p className="text-xs text-muted-foreground py-2">Loading links...</p>}

                    {!easyLinksLoading && easyLinks.length === 0 && !showCreateLink && (
                        <div className="text-center py-6">
                            <p className="text-sm text-muted-foreground">No EasyConnect links yet.</p>
                            <p className="text-xs text-muted-foreground mt-1">Create a link to share with your clients.</p>
                        </div>
                    )}

                    {/* Link List */}
                    {easyLinks.map(link => (
                        <div key={link.id} className="flex items-center gap-3 px-3 py-2.5 border rounded-lg hover:bg-muted/20 transition-colors">
                            <div className="flex-1 min-w-0">
                                {editingLinkId === link.id ? (
                                    <div className="flex items-center gap-1.5">
                                        <Input
                                            className="h-7 text-sm"
                                            value={editingLinkTitle}
                                            onChange={e => setEditingLinkTitle(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') renameEasyLink(link.id); if (e.key === 'Escape') setEditingLinkId(null) }}
                                            autoFocus
                                        />
                                        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => renameEasyLink(link.id)}>Save</Button>
                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingLinkId(null)}>✕</Button>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium truncate">{link.title}</p>
                                )}
                                <p className="text-xs text-muted-foreground font-mono truncate">
                                    {typeof window !== 'undefined' ? window.location.origin : ''}/connect/{link.token.slice(0, 16)}...
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Switch checked={link.isEnabled} onCheckedChange={checked => toggleEasyLink(link.id, checked)} title={link.isEnabled ? 'Disable link' : 'Enable link'} />
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => copyEasyLink(link.token, link.id)}>
                                    {copiedLinkId === link.id ? '✓ Copied' : 'Copy URL'}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Rename link" onClick={() => { setEditingLinkId(link.id); setEditingLinkTitle(link.title) }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteEasyLink(link.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </>
    )
}
