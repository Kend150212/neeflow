'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
    Key, Plus, Trash2, Copy, Check, Loader2, AlertTriangle, Shield,
    Play, ChevronDown, ChevronRight, Send, Code2, BookOpen, Zap,
    Globe, Lock, BarChart3, FileText, Hash, Terminal, Eye, EyeOff,
    Layers, Cpu, MessageSquare, Users, Workflow, Settings2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────
interface ApiKey {
    id: string
    name: string
    keyPrefix: string
    isActive: boolean
    lastUsedAt: string | null
    createdAt: string
    apiKey?: string
}

interface EndpointDef {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    path: string
    title: string
    description: string
    category: string
    bodyExample?: Record<string, unknown>
    queryParams?: { name: string; desc: string; required?: boolean }[]
    pathParams?: { name: string; desc: string }[]
}

// ─── API Endpoint Definitions ───────────────────────────────────
const ENDPOINTS: EndpointDef[] = [
    // Channels
    {
        method: 'GET', path: '/api/v1/channels', title: 'List Channels',
        description: 'List all channels you have access to, including connected platforms.',
        category: 'Channels',
    },
    // Posts
    {
        method: 'GET', path: '/api/v1/posts', title: 'List Posts',
        description: 'List posts with filtering options. Supports pagination.',
        category: 'Posts',
        queryParams: [
            { name: 'channelId', desc: 'Filter by channel ID' },
            { name: 'status', desc: 'Filter by status (DRAFT, SCHEDULED, PUBLISHED, etc.)' },
            { name: 'limit', desc: 'Max results (default 20, max 100)' },
            { name: 'offset', desc: 'Offset for pagination (default 0)' },
        ],
    },
    {
        method: 'POST', path: '/api/v1/posts', title: 'Create Post',
        description: 'Create a new post with multi-platform support. Supports per-platform content and scheduling.',
        category: 'Posts',
        bodyExample: {
            channelId: '<CHANNEL_ID>',
            content: 'Your main post content here ✨',
            contentPerPlatform: { facebook: 'Facebook version...', instagram: 'IG version with #hashtags' },
            platforms: ['facebook', 'instagram'],
            status: 'DRAFT',
            scheduledAt: null,
            mediaIds: [],
        },
    },
    {
        method: 'GET', path: '/api/v1/posts/{id}', title: 'Get Post Detail',
        description: 'Get full post details including media, platform statuses, and approval history.',
        category: 'Posts',
        pathParams: [{ name: 'id', desc: 'Post ID' }],
    },
    {
        method: 'PUT', path: '/api/v1/posts/{id}', title: 'Update Post',
        description: 'Update a draft, scheduled, or rejected post. Cannot update published posts.',
        category: 'Posts',
        pathParams: [{ name: 'id', desc: 'Post ID' }],
        bodyExample: { content: 'Updated content', scheduledAt: '2026-03-01T10:00:00Z' },
    },
    {
        method: 'DELETE', path: '/api/v1/posts/{id}', title: 'Delete Post',
        description: 'Permanently delete a post.',
        category: 'Posts',
        pathParams: [{ name: 'id', desc: 'Post ID' }],
    },
    // Post Actions
    {
        method: 'POST', path: '/api/v1/posts/{id}/publish', title: 'Publish Post',
        description: 'Queue a post for immediate publishing. Status changes to PUBLISHING and the worker handles delivery.',
        category: 'Post Actions',
        pathParams: [{ name: 'id', desc: 'Post ID' }],
    },
    {
        method: 'POST', path: '/api/v1/posts/{id}/schedule', title: 'Schedule Post',
        description: 'Schedule a post for future publishing.',
        category: 'Post Actions',
        pathParams: [{ name: 'id', desc: 'Post ID' }],
        bodyExample: { scheduledAt: '2026-03-15T14:00:00Z' },
    },
    // Approvals
    {
        method: 'GET', path: '/api/v1/posts/{id}/approvals', title: 'List Approvals',
        description: 'Get approval history for a post.',
        category: 'Approvals',
        pathParams: [{ name: 'id', desc: 'Post ID' }],
    },
    {
        method: 'POST', path: '/api/v1/posts/{id}/approvals', title: 'Approve / Reject Post',
        description: 'Approve or reject a post pending approval.',
        category: 'Approvals',
        pathParams: [{ name: 'id', desc: 'Post ID' }],
        bodyExample: { action: 'APPROVED', comment: 'Looks great! 👍' },
    },
    // AI
    {
        method: 'POST', path: '/api/v1/ai/generate', title: 'Generate AI Content',
        description: 'Generate platform-optimized social media content using AI. Uses the channel\'s knowledge base, brand voice, and hashtag groups.',
        category: 'AI Content',
        bodyExample: {
            channelId: '<CHANNEL_ID>',
            topic: 'Summer collection launch with 30% discount',
            platforms: ['facebook', 'instagram', 'tiktok', 'x'],
            language: 'en',
        },
    },
    // Usage
    {
        method: 'GET', path: '/api/v1/usage', title: 'Get Usage & Limits',
        description: 'Get your current plan details, usage this month, and feature flags.',
        category: 'Account',
    },
    // Keys
    {
        method: 'GET', path: '/api/v1/keys', title: 'List API Keys',
        description: 'List all your API keys (requires session auth from the dashboard — not API key auth).',
        category: 'Key Management',
    },
    {
        method: 'POST', path: '/api/v1/keys', title: 'Create API Key',
        description: 'Generate a new API key. The raw key is shown only once.',
        category: 'Key Management',
        bodyExample: { name: 'My Production App' },
    },
    {
        method: 'DELETE', path: '/api/v1/keys', title: 'Revoke API Key',
        description: 'Permanently deactivate an API key.',
        category: 'Key Management',
        bodyExample: { keyId: '<KEY_ID>' },
    },
]

const METHOD_COLORS: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const METHOD_DOT: Record<string, string> = {
    GET: 'bg-emerald-400',
    POST: 'bg-blue-400',
    PUT: 'bg-amber-400',
    DELETE: 'bg-red-400',
}

const CATEGORIES = [...new Set(ENDPOINTS.map(e => e.category))]

const CATEGORY_ICONS: Record<string, typeof Code2> = {
    'Channels': Layers,
    'Posts': FileText,
    'Post Actions': Workflow,
    'Approvals': MessageSquare,
    'AI Content': Cpu,
    'Account': Users,
    'Key Management': Key,
}

/* ─── Side‑nav section IDs ──────────────────────────────────────── */
const FIXED_SECTIONS = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'authentication', label: 'Authentication', icon: Lock },
    { id: 'rate-limits', label: 'Rate Limits', icon: BarChart3 },
    { id: 'response-format', label: 'Response Format', icon: FileText },
]

// ─── Component ──────────────────────────────────────────────────
export default function DeveloperPortalPage() {
    // Key management state
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [keysLoading, setKeysLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [newKeyName, setNewKeyName] = useState('')
    const [showNewKey, setShowNewKey] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    // Playground state
    const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef | null>(null)
    const [apiKeyInput, setApiKeyInput] = useState('')
    const [showApiKey, setShowApiKey] = useState(false)
    const [playgroundBody, setPlaygroundBody] = useState('')
    const [playgroundPath, setPlaygroundPath] = useState('')
    const [playgroundQuery, setPlaygroundQuery] = useState('')
    const [playgroundResponse, setPlaygroundResponse] = useState<string | null>(null)
    const [playgroundStatus, setPlaygroundStatus] = useState<number | null>(null)
    const [playgroundLoading, setPlaygroundLoading] = useState(false)
    const [playgroundHeaders, setPlaygroundHeaders] = useState<Record<string, string>>({})

    // Docs state
    const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null)
    const [activeSection, setActiveSection] = useState('overview')

    const responseRef = useRef<HTMLPreElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const [navLeft, setNavLeft] = useState(0)

    useEffect(() => { fetchKeys() }, [])

    // ─── Find the dashboard scroll container & measure nav position ──
    const getScrollContainer = useCallback(() => {
        // DashboardMain's <main> has overflow-y-auto
        let el: HTMLElement | null = wrapperRef.current
        while (el) {
            const style = window.getComputedStyle(el)
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') return el
            el = el.parentElement
        }
        return null
    }, [])

    useEffect(() => {
        function measure() {
            if (wrapperRef.current) {
                setNavLeft(wrapperRef.current.getBoundingClientRect().left)
            }
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [])

    // ─── Intersection observer for active section tracking ─────────
    useEffect(() => {
        const scrollRoot = getScrollContainer()
        const allIds = [
            ...FIXED_SECTIONS.map(s => s.id),
            ...CATEGORIES.map(c => `cat-${c.toLowerCase().replace(/\s+/g, '-')}`),
            'playground',
            'api-keys',
        ]
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id)
                    }
                }
            },
            { root: scrollRoot, rootMargin: '-80px 0px -70% 0px', threshold: 0.1 }
        )
        allIds.forEach(id => {
            const el = document.getElementById(id)
            if (el) observer.observe(el)
        })
        return () => observer.disconnect()
    }, [getScrollContainer])

    async function fetchKeys() {
        try {
            const res = await fetch('/api/v1/keys')
            const data = await res.json()
            if (data.success) setKeys(data.data)
        } catch { /* ignore */ } finally {
            setKeysLoading(false)
        }
    }

    async function createKey() {
        if (!newKeyName.trim()) { toast.error('Please enter a key name'); return }
        setCreating(true)
        try {
            const res = await fetch('/api/v1/keys', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKeyName }),
            })
            const data = await res.json()
            if (data.success) {
                setShowNewKey(data.data.apiKey)
                setApiKeyInput(data.data.apiKey)
                setNewKeyName('')
                fetchKeys()
                toast.success('API key created!')
            } else toast.error(data.error?.message || 'Failed')
        } catch { toast.error('Failed') } finally { setCreating(false) }
    }

    async function revokeKey(keyId: string) {
        if (!confirm('Revoke this key? It will be permanently deactivated.')) return
        try {
            const res = await fetch('/api/v1/keys', {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyId }),
            })
            const data = await res.json()
            if (data.success) { fetchKeys(); toast.success('Key revoked') }
        } catch { toast.error('Failed') }
    }

    function copyText(text: string, id: string) {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        toast.success('Copied!')
        setTimeout(() => setCopiedId(null), 2000)
    }

    const selectEndpoint = useCallback((ep: EndpointDef) => {
        setSelectedEndpoint(ep)
        setPlaygroundPath(ep.path)
        setPlaygroundBody(ep.bodyExample ? JSON.stringify(ep.bodyExample, null, 2) : '')
        setPlaygroundQuery(ep.queryParams ? ep.queryParams.map(q => `${q.name}=`).join('&') : '')
        setPlaygroundResponse(null)
        setPlaygroundStatus(null)
        setPlaygroundHeaders({})
        // Scroll within the dashboard scroll container
        const target = document.getElementById('playground')
        const scrollRoot = getScrollContainer()
        if (target && scrollRoot) {
            const offset = target.offsetTop - scrollRoot.offsetTop
            scrollRoot.scrollTo({ top: offset, behavior: 'smooth' })
        } else {
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [getScrollContainer])

    async function executeRequest() {
        if (!apiKeyInput.trim()) { toast.error('Enter your API key first'); return }
        if (!selectedEndpoint) return

        setPlaygroundLoading(true)
        setPlaygroundResponse(null)

        try {
            let url = playgroundPath
            if (playgroundQuery) url += `?${playgroundQuery}`

            const opts: RequestInit = {
                method: selectedEndpoint.method,
                headers: { 'X-API-Key': apiKeyInput, 'Content-Type': 'application/json' },
            }
            if (['POST', 'PUT', 'DELETE'].includes(selectedEndpoint.method) && playgroundBody.trim()) {
                opts.body = playgroundBody
            }

            const res = await fetch(url, opts)
            const headers: Record<string, string> = {}
            res.headers.forEach((v, k) => {
                if (k.startsWith('x-ratelimit') || k === 'content-type') headers[k] = v
            })
            setPlaygroundHeaders(headers)
            setPlaygroundStatus(res.status)

            const text = await res.text()
            try {
                setPlaygroundResponse(JSON.stringify(JSON.parse(text), null, 2))
            } catch {
                setPlaygroundResponse(text)
            }
        } catch (err) {
            setPlaygroundResponse(`Error: ${err instanceof Error ? err.message : String(err)}`)
            setPlaygroundStatus(0)
        } finally {
            setPlaygroundLoading(false)
        }
    }

    const domain = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'

    function scrollTo(id: string) {
        const target = document.getElementById(id)
        const scrollRoot = getScrollContainer()
        if (target && scrollRoot) {
            const offset = target.offsetTop - scrollRoot.offsetTop
            scrollRoot.scrollTo({ top: offset, behavior: 'smooth' })
        } else {
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    // ─── Render ─────────────────────────────────────────────────
    return (
        <div ref={wrapperRef} className="min-h-screen -mx-3 -my-4 sm:-mx-6 sm:-my-6">

            {/* ─── Fixed Side Navigation ── */}
            <aside
                className="hidden lg:flex flex-col w-56 shrink-0 border-r bg-muted/20 overflow-y-auto py-4 px-2"
                style={{
                    position: 'fixed',
                    top: 48,
                    left: navLeft,
                    height: 'calc(100vh - 48px)',
                    zIndex: 30,
                }}
            >
                {/* Logo area */}
                <div className="px-3 mb-6">
                    <div className="flex items-center gap-2 text-sm font-bold">
                        <Code2 className="h-5 w-5 text-primary" />
                        <span>Developer API</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-1.5 bg-muted/50 rounded px-2 py-1">
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="truncate">/api/v1</span>
                    </div>
                </div>

                {/* Getting Started */}
                <div className="px-3 mb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Getting Started</p>
                </div>
                {FIXED_SECTIONS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => scrollTo(s.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md text-sm transition-all ${activeSection === s.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                    >
                        <s.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{s.label}</span>
                    </button>
                ))}

                {/* API Reference */}
                <div className="px-3 mt-5 mb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">API Reference</p>
                </div>
                {CATEGORIES.map(cat => {
                    const CatIcon = CATEGORY_ICONS[cat] || Hash
                    const catId = `cat-${cat.toLowerCase().replace(/\s+/g, '-')}`
                    return (
                        <button
                            key={cat}
                            onClick={() => scrollTo(catId)}
                            className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md text-sm transition-all ${activeSection === catId
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            <CatIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{cat}</span>
                            <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 h-4">
                                {ENDPOINTS.filter(e => e.category === cat).length}
                            </Badge>
                        </button>
                    )
                })}

                {/* Tools */}
                <div className="px-3 mt-5 mb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tools</p>
                </div>
                <button
                    onClick={() => scrollTo('playground')}
                    className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md text-sm transition-all ${activeSection === 'playground'
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                >
                    <Terminal className="h-3.5 w-3.5" />
                    Playground
                </button>
                <button
                    onClick={() => scrollTo('api-keys')}
                    className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md text-sm transition-all ${activeSection === 'api-keys'
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                >
                    <Key className="h-3.5 w-3.5" />
                    API Keys
                </button>
            </aside>

            {/* ─── Main Content (pushed right on lg to account for fixed sidebar) ── */}
            <main className="lg:ml-56 flex-1 max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-16">

                {/* ═══ OVERVIEW ═══ */}
                <section id="overview" className="scroll-mt-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-primary/10">
                            <Code2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Developer API</h1>
                            <p className="text-sm text-muted-foreground">
                                Programmatic access to channels, posts, AI generation, and more.
                            </p>
                        </div>
                    </div>

                    <div className="bg-muted/30 rounded-xl border p-4 mt-6">
                        <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                            <Zap className="h-4 w-4 text-primary" />
                            Quick Start
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">1</div>
                                <p className="text-muted-foreground pt-0.5">Create an API key in the <button onClick={() => scrollTo('api-keys')} className="text-primary hover:underline">API Keys</button> section below.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">2</div>
                                <p className="text-muted-foreground pt-0.5">Include the key in the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">X-API-Key</code> header of each request.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">3</div>
                                <p className="text-muted-foreground pt-0.5">Test your calls in the <button onClick={() => scrollTo('playground')} className="text-primary hover:underline">Playground</button>, then integrate into your app.</p>
                            </div>
                        </div>
                    </div>

                    {/* Base URL */}
                    <div className="mt-6 flex items-center gap-3 bg-background border rounded-lg px-4 py-3">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Base URL</p>
                            <code className="text-sm font-mono font-medium">{domain}/api/v1</code>
                        </div>
                        <Button variant="ghost" size="sm" className="ml-auto h-8 w-8 p-0" onClick={() => copyText(`${domain}/api/v1`, 'base-url')}>
                            {copiedId === 'base-url' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </section>

                {/* ═══ AUTHENTICATION ═══ */}
                <section id="authentication" className="scroll-mt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Lock className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-bold">Authentication</h2>
                    </div>
                    <div className="space-y-4 text-sm">
                        <p className="text-muted-foreground">
                            All API requests require an API key passed via the <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">X-API-Key</code> header.
                        </p>
                        <div className="relative group">
                            <pre className="bg-muted/50 rounded-xl border p-4 text-xs font-mono overflow-x-auto">
                                {`curl -H "X-API-Key: ask_xxxxxxxxxxxxxxxx" \\
  ${domain}/api/v1/channels`}
                            </pre>
                            <Button
                                variant="ghost" size="sm"
                                className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => copyText(`curl -H "X-API-Key: ask_xxxxxxxxxxxxxxxx" \\\n  ${domain}/api/v1/channels`, 'auth-curl')}
                            >
                                {copiedId === 'auth-curl' ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                            </Button>
                        </div>
                        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                            <div className="text-xs text-muted-foreground">
                                <strong className="text-foreground">Security:</strong> API keys are hashed using bcrypt — the raw key is shown only once at creation. Treat your key like a password and rotate regularly.
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ RATE LIMITS ═══ */}
                <section id="rate-limits" className="scroll-mt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-bold">Rate Limits</h2>
                    </div>
                    <div className="space-y-4 text-sm">
                        <p className="text-muted-foreground">API calls are quota-limited per plan per month. Check your limits in the response headers:</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { header: 'X-RateLimit-Limit', desc: 'Monthly quota', color: 'text-blue-400' },
                                { header: 'X-RateLimit-Remaining', desc: 'Calls remaining', color: 'text-emerald-400' },
                                { header: 'X-RateLimit-Reset', desc: 'Reset timestamp (ISO 8601)', color: 'text-amber-400' },
                            ].map(h => (
                                <div key={h.header} className="bg-muted/30 border rounded-xl p-4">
                                    <code className={`text-xs font-mono font-semibold ${h.color}`}>{h.header}</code>
                                    <p className="text-xs text-muted-foreground mt-1.5">{h.desc}</p>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            When your quota is exhausted, the API returns <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">429 Too Many Requests</code>.
                        </p>
                    </div>
                </section>

                {/* ═══ RESPONSE FORMAT ═══ */}
                <section id="response-format" className="scroll-mt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-bold">Response Format</h2>
                    </div>
                    <div className="space-y-3 text-sm">
                        <p className="text-muted-foreground">All responses follow a consistent JSON structure:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="relative group">
                                <p className="text-xs font-medium text-emerald-400 mb-2">✓ Success</p>
                                <pre className="bg-muted/50 border rounded-xl p-4 text-xs font-mono overflow-x-auto">
                                    {`{
  "success": true,
  "data": { ... }
}`}
                                </pre>
                            </div>
                            <div className="relative group">
                                <p className="text-xs font-medium text-red-400 mb-2">✕ Error</p>
                                <pre className="bg-muted/50 border rounded-xl p-4 text-xs font-mono overflow-x-auto">
                                    {`{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}`}
                                </pre>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ ENDPOINT REFERENCE (per category) ═══ */}
                {CATEGORIES.map(cat => {
                    const catId = `cat-${cat.toLowerCase().replace(/\s+/g, '-')}`
                    const CatIcon = CATEGORY_ICONS[cat] || Hash
                    const endpoints = ENDPOINTS.filter(e => e.category === cat)

                    return (
                        <section key={cat} id={catId} className="scroll-mt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <CatIcon className="h-5 w-5 text-primary" />
                                <h2 className="text-xl font-bold">{cat}</h2>
                                <Badge variant="outline" className="ml-1 text-[10px]">{endpoints.length} endpoint{endpoints.length > 1 ? 's' : ''}</Badge>
                            </div>

                            <div className="space-y-3">
                                {endpoints.map((ep, i) => {
                                    const epKey = `${ep.method}-${ep.path}`
                                    const isExpanded = expandedEndpoint === epKey
                                    return (
                                        <div key={i} className={`border rounded-xl overflow-hidden transition-all ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}>
                                            {/* Endpoint header row */}
                                            <button
                                                onClick={() => setExpandedEndpoint(isExpanded ? null : epKey)}
                                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                                            >
                                                <Badge variant="outline" className={`text-[10px] font-mono font-bold px-2 py-0.5 shrink-0 ${METHOD_COLORS[ep.method]}`}>
                                                    {ep.method}
                                                </Badge>
                                                <code className="text-xs font-mono flex-1 text-muted-foreground">{ep.path}</code>
                                                <span className="text-xs font-medium text-foreground shrink-0 hidden sm:inline">{ep.title}</span>
                                                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                                            </button>

                                            {/* Expanded detail */}
                                            {isExpanded && (
                                                <div className="border-t bg-muted/5 px-4 pb-4 space-y-4">
                                                    <p className="text-sm text-muted-foreground pt-3">{ep.description}</p>

                                                    {/* Path Params */}
                                                    {ep.pathParams && (
                                                        <div>
                                                            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                                                                <Hash className="h-3 w-3 text-primary" />
                                                                Path Parameters
                                                            </h4>
                                                            <div className="space-y-1">
                                                                {ep.pathParams.map(p => (
                                                                    <div key={p.name} className="flex items-center gap-2 text-xs">
                                                                        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary">{`{${p.name}}`}</code>
                                                                        <span className="text-muted-foreground">{p.desc}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Query Params */}
                                                    {ep.queryParams && (
                                                        <div>
                                                            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                                                                <Settings2 className="h-3 w-3 text-primary" />
                                                                Query Parameters
                                                            </h4>
                                                            <div className="bg-muted/30 rounded-lg overflow-hidden border">
                                                                {ep.queryParams.map((q, qi) => (
                                                                    <div key={q.name} className={`flex items-center gap-2 px-3 py-2 text-xs ${qi > 0 ? 'border-t' : ''}`}>
                                                                        <code className="font-mono text-primary font-medium w-20 shrink-0">{q.name}</code>
                                                                        <span className="text-muted-foreground flex-1">{q.desc}</span>
                                                                        {q.required && <Badge variant="destructive" className="text-[9px] h-4 px-1">required</Badge>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Body Example */}
                                                    {ep.bodyExample && (
                                                        <div>
                                                            <h4 className="text-xs font-semibold mb-2">Request Body</h4>
                                                            <div className="relative group">
                                                                <pre className="bg-muted/50 border rounded-lg p-3 text-[11px] font-mono overflow-x-auto">
                                                                    {JSON.stringify(ep.bodyExample, null, 2)}
                                                                </pre>
                                                                <Button
                                                                    variant="ghost" size="sm"
                                                                    className="absolute top-1.5 right-1.5 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => copyText(JSON.stringify(ep.bodyExample, null, 2), `body-${epKey}`)}
                                                                >
                                                                    {copiedId === `body-${epKey}` ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* curl Example */}
                                                    <div>
                                                        <h4 className="text-xs font-semibold mb-2">cURL Example</h4>
                                                        <div className="relative group">
                                                            <pre className="bg-muted/50 border rounded-lg p-3 text-[11px] font-mono overflow-x-auto">
                                                                {`curl${ep.method !== 'GET' ? ` -X ${ep.method}` : ''} \\
  -H "X-API-Key: YOUR_KEY" \\${ep.bodyExample ? `
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(ep.bodyExample)}' \\` : ''}
  ${domain}${ep.path}${ep.queryParams ? '?' + ep.queryParams.map(q => q.name + '=...').join('&') : ''}`}
                                                            </pre>
                                                        </div>
                                                    </div>

                                                    <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => selectEndpoint(ep)}>
                                                        <Play className="h-3 w-3" /> Try in Playground
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    )
                })}

                {/* ═══ PLAYGROUND ═══ */}
                <section id="playground" className="scroll-mt-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Terminal className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-bold">Playground</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left: Request */}
                        <div className="space-y-4">
                            {/* API Key */}
                            <div className="bg-muted/30 border rounded-xl p-4">
                                <label className="text-xs font-semibold mb-2 block flex items-center gap-1.5">
                                    <Lock className="h-3 w-3" /> API Key
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            type={showApiKey ? 'text' : 'password'}
                                            placeholder="ask_xxxxxxxxxxxxxxxx"
                                            value={apiKeyInput}
                                            onChange={e => setApiKeyInput(e.target.value)}
                                            className="font-mono text-xs pr-8"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>
                                {!apiKeyInput && keys.length === 0 && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        No API key yet? <button onClick={() => scrollTo('api-keys')} className="text-primary hover:underline">Create one below ↓</button>
                                    </p>
                                )}
                            </div>

                            {/* Endpoint Selector */}
                            <div className="bg-muted/30 border rounded-xl p-4">
                                <label className="text-xs font-semibold mb-2 block">Select Endpoint</label>
                                <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                                    {ENDPOINTS.filter(e => e.category !== 'Key Management').map((ep, i) => (
                                        <button
                                            key={i}
                                            onClick={() => selectEndpoint(ep)}
                                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${selectedEndpoint === ep
                                                ? 'bg-primary/10 border border-primary/30'
                                                : 'hover:bg-muted/50'
                                                }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${METHOD_DOT[ep.method]}`} />
                                            <Badge variant="outline" className={`text-[9px] font-mono font-bold px-1.5 shrink-0 ${METHOD_COLORS[ep.method]}`}>
                                                {ep.method}
                                            </Badge>
                                            <span className="text-xs truncate">{ep.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Request Config */}
                            {selectedEndpoint && (
                                <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className={`text-[10px] font-mono font-bold ${METHOD_COLORS[selectedEndpoint.method]}`}>
                                            {selectedEndpoint.method}
                                        </Badge>
                                        <span className="text-sm font-medium">{selectedEndpoint.title}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{selectedEndpoint.description}</p>

                                    <div>
                                        <label className="text-xs font-medium mb-1 block">URL Path</label>
                                        <Input value={playgroundPath} onChange={e => setPlaygroundPath(e.target.value)} className="font-mono text-xs" />
                                        {selectedEndpoint.pathParams && (
                                            <p className="text-[10px] text-muted-foreground mt-1">Replace <code>{'{id}'}</code> with an actual ID</p>
                                        )}
                                    </div>

                                    {selectedEndpoint.queryParams && (
                                        <div>
                                            <label className="text-xs font-medium mb-1 block">Query Parameters</label>
                                            <Input value={playgroundQuery} onChange={e => setPlaygroundQuery(e.target.value)} placeholder="key=value&key2=value2" className="font-mono text-xs" />
                                        </div>
                                    )}

                                    {['POST', 'PUT', 'DELETE'].includes(selectedEndpoint.method) && (
                                        <div>
                                            <label className="text-xs font-medium mb-1 block">Request Body (JSON)</label>
                                            <textarea
                                                value={playgroundBody}
                                                onChange={e => setPlaygroundBody(e.target.value)}
                                                rows={Math.min(10, (playgroundBody.split('\n').length || 3) + 1)}
                                                className="w-full bg-background border rounded-lg p-3 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                spellCheck={false}
                                            />
                                        </div>
                                    )}

                                    <Button onClick={executeRequest} disabled={playgroundLoading} className="w-full">
                                        {playgroundLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
                                        Send Request
                                    </Button>
                                </div>
                            )}

                            {!selectedEndpoint && (
                                <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-xl">
                                    <Play className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                    Select an endpoint above to start testing
                                </div>
                            )}
                        </div>

                        {/* Right: Response */}
                        <div className="lg:sticky lg:top-6 self-start">
                            <div className="bg-muted/30 border rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b">
                                    <span className="text-sm font-semibold">Response</span>
                                    {playgroundStatus !== null && (
                                        <Badge variant={playgroundStatus >= 200 && playgroundStatus < 300 ? 'default' : 'destructive'} className="text-xs">
                                            {playgroundStatus}
                                        </Badge>
                                    )}
                                </div>
                                <div className="p-4">
                                    {/* Rate Limit Headers */}
                                    {Object.keys(playgroundHeaders).length > 0 && (
                                        <div className="mb-3 space-y-1 pb-3 border-b border-border/50">
                                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Headers</h4>
                                            {Object.entries(playgroundHeaders).map(([k, v]) => (
                                                <div key={k} className="flex gap-2 text-[11px]">
                                                    <code className="text-primary font-mono">{k}:</code>
                                                    <code className="text-muted-foreground font-mono">{v}</code>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {playgroundResponse ? (
                                        <div className="relative group">
                                            <pre
                                                ref={responseRef}
                                                className="bg-background rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap border"
                                            >
                                                {playgroundResponse}
                                            </pre>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => copyText(playgroundResponse, 'response')}
                                            >
                                                {copiedId === 'response' ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                            </Button>
                                        </div>
                                    ) : playgroundLoading ? (
                                        <div className="text-center py-12">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                            <p className="text-xs text-muted-foreground mt-2">Sending request...</p>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground text-xs">
                                            Response will appear here after sending a request
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ API KEYS ═══ */}
                <section id="api-keys" className="scroll-mt-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Key className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-bold">API Keys</h2>
                    </div>

                    <div className="max-w-2xl space-y-4">
                        {/* Create new key */}
                        <div className="bg-muted/30 border rounded-xl p-4">
                            <label className="text-xs font-semibold mb-2 block">Create New API Key</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Key name (e.g. My App)"
                                    value={newKeyName}
                                    onChange={e => setNewKeyName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && createKey()}
                                    disabled={creating}
                                    className="flex-1"
                                />
                                <Button onClick={createKey} disabled={creating}>
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                                    Create
                                </Button>
                            </div>
                        </div>

                        {/* Newly created key */}
                        {showNewKey && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                                    <Shield className="h-4 w-4" />
                                    API Key Created — Copy Now!
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-background rounded-lg px-3 py-2 text-sm font-mono break-all border">
                                        {showNewKey}
                                    </code>
                                    <Button variant="outline" size="sm" onClick={() => copyText(showNewKey, 'new')}>
                                        {copiedId === 'new' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-amber-400 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    This key will not be shown again. Store it securely.
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setShowNewKey(null)} className="text-xs">Dismiss</Button>
                                    <Button variant="outline" size="sm" onClick={() => { scrollTo('playground'); setShowNewKey(null) }} className="text-xs gap-1">
                                        <Play className="h-3 w-3" /> Try in Playground
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Keys list */}
                        <div className="bg-muted/30 border rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b">
                                <span className="text-sm font-semibold">Your API Keys ({keys.length}/10)</span>
                            </div>
                            <div className="p-4">
                                {keysLoading ? (
                                    <div className="text-center py-6">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                    </div>
                                ) : keys.length === 0 ? (
                                    <p className="text-center py-6 text-sm text-muted-foreground">No keys yet. Create one above to get started.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {keys.map(key => (
                                            <div
                                                key={key.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${key.isActive
                                                    ? 'bg-background hover:shadow-sm'
                                                    : 'bg-muted/30 opacity-50'
                                                    }`}
                                            >
                                                <div className={`p-1.5 rounded-md ${key.isActive ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                                                    <Key className={`h-3.5 w-3.5 ${key.isActive ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium">{key.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono">{key.keyPrefix}••••••••</div>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground text-right shrink-0">
                                                    <div>{key.lastUsedAt ? `Used ${new Date(key.lastUsedAt).toLocaleDateString()}` : 'Never used'}</div>
                                                    <div>Created {new Date(key.createdAt).toLocaleDateString()}</div>
                                                </div>
                                                {key.isActive ? (
                                                    <Button variant="ghost" size="sm" onClick={() => revokeKey(key.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0 h-8 w-8 p-0">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                ) : (
                                                    <Badge variant="destructive" className="text-[10px]">Revoked</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bottom spacer */}
                <div className="h-24" />
            </main>
        </div>
    )
}
