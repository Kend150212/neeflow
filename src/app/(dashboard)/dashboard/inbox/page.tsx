'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useWorkspace } from '@/lib/workspace-context'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
    MessageSquare,
    Search,
    Bot,
    UserCircle,
    Send,
    Sparkles,
    StickyNote,
    Check,
    MoreVertical,
    Tag,
    UserPlus,
    UserX,
    CheckCircle2,
    Archive,
    Mail,
    Clock,
    Smile,
    Frown,
    Meh,
    Inbox,
    Loader2,
    RefreshCcw,
    ThumbsUp,
    Reply,
    Heart,
    ExternalLink,
    Volume2,
    VolumeX,
    Settings,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    Save,
    Trash2,
    PanelLeftClose,
    PanelLeft,
    AlertTriangle,
    LayoutTemplate,
    Columns,
    Square,
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Types ─────────────────────────────
interface PlatformAccount {
    id: string
    platform: string
    accountId: string
    accountName: string
    channelId: string
}

interface Conversation {
    id: string
    channelId: string
    platform: string
    externalUserId: string
    externalUserName: string | null
    externalUserAvatar: string | null
    status: string
    mode: 'BOT' | 'AGENT' | 'PAUSED'
    assignedTo: string | null
    agent: { id: string; name: string | null; email: string } | null
    tags: string[]
    sentiment: string | null
    intent: string | null
    type: string
    metadata: any
    priority: number
    aiSummary: string | null
    lastMessageAt: string | null
    unreadCount: number
    lastMessage: string | null
    lastMessageSender: string | null
    platformAccount: {
        id: string
        accountName: string
        platform: string
    }
    createdAt: string
}

interface InboxMessage {
    id: string
    externalId: string | null
    direction: string
    senderType: string
    content: string
    contentOriginal: string | null
    detectedLang: string | null
    mediaUrl: string | null
    mediaType: string | null
    senderName: string | null
    senderAvatar: string | null
    confidence: number | null
    sentAt: string
}

interface StatusCounts {
    new: number
    open: number
    done: number
    archived: number
    mine: number
    all: number
}

// ─── Per-pane state ────────────────────
interface PanelState {
    conversation: Conversation | null
    messages: InboxMessage[]
    replyText: string
    replyToName: string | null
    replyToMsgId: string | null   // externalId of the message being replied to
    replyToContent: string | null // preview text of quoted message
    selectedImage: File | null
    dragOver: boolean
    showEmojiPicker: boolean
    aiSuggesting: boolean
    postExpanded: boolean
    likedCommentIds: Set<string>
    msgPage: number
    msgHasMore: boolean
    loadingMessages: boolean
    loadingMoreMsg: boolean
}

const initPanel = (): PanelState => ({
    conversation: null,
    messages: [],
    replyText: '',
    replyToName: null,
    replyToMsgId: null,
    replyToContent: null,
    selectedImage: null,
    dragOver: false,
    showEmojiPicker: false,
    aiSuggesting: false,
    postExpanded: false,
    likedCommentIds: new Set(),
    msgPage: 1,
    msgHasMore: false,
    loadingMessages: false,
    loadingMoreMsg: false,
})

// ─── Platform SVG icons ───────────────
function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
    switch (platform) {
        case 'facebook':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.875V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12" fill="#1877F2" />
                </svg>
            )
        case 'instagram':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <defs>
                        <linearGradient id="ig-grad" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#FFC107" />
                            <stop offset=".5" stopColor="#F44336" />
                            <stop offset="1" stopColor="#9C27B0" />
                        </linearGradient>
                    </defs>
                    <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
                    <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
                    <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
                </svg>
            )
        case 'tiktok':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="6" fill="#010101" />
                    <path d="M16.6 5.82a4.28 4.28 0 01-1.04-2.47h-.01V3.2h-2.97v11.88a2.56 2.56 0 01-2.56 2.44 2.56 2.56 0 01-2.56-2.56 2.56 2.56 0 012.56-2.56c.27 0 .53.04.77.11V9.44a5.6 5.6 0 00-.77-.05 5.56 5.56 0 00-5.56 5.56A5.56 5.56 0 009.97 20.5a5.56 5.56 0 005.56-5.56V9.2a7.24 7.24 0 004.24 1.36V7.6a4.28 4.28 0 01-3.17-1.78z" fill="white" />
                </svg>
            )
        case 'linkedin':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="4" fill="#0A66C2" />
                    <path d="M7.5 10v7.5M7.5 7v.01M10.5 17.5v-4.25c0-1.5 1-2.25 2-2.25s1.5.75 1.5 2v4.5M10.5 10v7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )
        case 'youtube':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="6" fill="#FF0000" />
                    <path d="M10 15.5v-7l6 3.5-6 3.5z" fill="white" />
                </svg>
            )
        case 'pinterest':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#E60023" />
                    <path d="M12 5.5c-3.59 0-6.5 2.91-6.5 6.5 0 2.76 1.72 5.11 4.14 6.05-.06-.52-.11-1.32.02-1.89l.78-3.33s-.2-.4-.2-.98c0-.92.53-1.6 1.2-1.6.56 0 .84.42.84.93 0 .57-.36 1.42-.55 2.2-.16.66.33 1.2.98 1.2 1.18 0 2.09-1.24 2.09-3.04 0-1.59-1.14-2.7-2.77-2.7-1.89 0-3 1.42-3 2.88 0 .57.22 1.18.5 1.52a.2.2 0 01.04.19l-.18.76c-.03.12-.1.15-.22.09-.82-.38-1.34-1.59-1.34-2.56 0-2.08 1.51-4 4.36-4 2.29 0 4.06 1.63 4.06 3.81 0 2.27-1.43 4.1-3.42 4.1-.67 0-1.3-.35-1.51-.76l-.41 1.57c-.15.57-.55 1.29-.82 1.73.62.19 1.27.3 1.96.3 3.59 0 6.5-2.91 6.5-6.5s-2.91-6.5-6.5-6.5z" fill="white" />
                </svg>
            )
        default:
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="6" fill="#666" />
                    <path d="M12 7v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
            )
    }
}

const platformConfig: Record<string, { color: string; label: string }> = {
    facebook: { color: 'bg-blue-500/10 text-blue-600', label: 'Facebook' },
    instagram: { color: 'bg-pink-500/10 text-pink-600', label: 'Instagram' },
    tiktok: { color: 'bg-gray-800/10 text-gray-800 dark:text-gray-200', label: 'TikTok' },
    linkedin: { color: 'bg-blue-700/10 text-blue-700', label: 'LinkedIn' },
    zalo: { color: 'bg-blue-400/10 text-blue-500', label: 'Zalo' },
    youtube: { color: 'bg-red-500/10 text-red-600', label: 'YouTube' },
    pinterest: { color: 'bg-red-400/10 text-red-500', label: 'Pinterest' },
    whatsapp: { color: 'bg-green-500/10 text-green-600', label: 'WhatsApp' },
    telegram: { color: 'bg-sky-500/10 text-sky-600', label: 'Telegram' },
    google_business: { color: 'bg-amber-500/10 text-amber-600', label: 'Google Business' },
}

// ─── Platforms that support direct messaging / inbox ─
const MESSAGING_PLATFORMS = new Set([
    'facebook',
    'instagram',
    'whatsapp',
    'telegram',
    'zalo',
    'google_business',
])

// ─── Status filters config ───────────
const statusFilterItems = [
    { key: 'new', labelKey: 'unassigned', icon: Mail },
    { key: 'open', labelKey: 'assigned', icon: UserPlus },
    { key: 'mine', labelKey: 'mine', icon: UserCircle },
    { key: 'done', labelKey: 'resolved', icon: CheckCircle2 },
    { key: 'archived', labelKey: 'archived', icon: Archive },
    { key: 'all', labelKey: 'all', icon: Inbox },
]

// ─── Tabs ─────────────────────────────
const inboxTabs = [
    { key: 'all', labelKey: 'all' },
    { key: 'messages', labelKey: 'messages' },
    { key: 'comments', labelKey: 'comments' },
    { key: 'reviews', labelKey: 'reviews' },
]

// ─── Sentiment icon ───────────────────
function SentimentIcon({ sentiment }: { sentiment: string | null }) {
    if (sentiment === 'positive') return <Smile className="h-3.5 w-3.5 text-green-500" />
    if (sentiment === 'negative') return <Frown className="h-3.5 w-3.5 text-red-500" />
    return <Meh className="h-3.5 w-3.5 text-muted-foreground/50" />
}

// ─── Time formatter ───────────────────
function timeAgo(date: string, t: (key: string) => string) {
    const now = new Date()
    const d = new Date(date)
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    // Today: show time like "9:19 PM"
    if (diff < 86400 && now.getDate() === d.getDate()) {
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
    // Yesterday
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth()) {
        return t('inbox.yesterday')
    }
    // Within 7 days: show day name
    if (diff < 604800) {
        return d.toLocaleDateString('en-US', { weekday: 'short' })
    }
    // Older: show date
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function InboxPage() {
    const { data: session } = useSession()
    const { activeChannel } = useWorkspace()
    const t = useTranslation()

    // ─── State ────────────────────────
    const [statusFilter, setStatusFilter] = useState('all')
    const [activeTab, setActiveTab] = useState('messages')
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([])
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [channelMembers, setChannelMembers] = useState<any[]>([])
    const [openReactMsgId, setOpenReactMsgId] = useState<string | null>(null)
    const [botAvatarByChannel, setBotAvatarByChannel] = useState<Record<string, string | null>>({})
    const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([])
    const [counts, setCounts] = useState<StatusCounts>({ new: 0, open: 0, done: 0, archived: 0, mine: 0, all: 0 })
    const [loading, setLoading] = useState(true)
    // Conversations pagination
    const CONV_LIMIT = 30
    const MSG_LIMIT = 40
    const [convPage, setConvPage] = useState(1)
    const [convHasMore, setConvHasMore] = useState(false)
    const [loadingMoreConv, setLoadingMoreConv] = useState(false)
    const [sendingReply, setSendingReply] = useState(false)
    const [updatingConv, setUpdatingConv] = useState(false)
    const [syncingProfiles, setSyncingProfiles] = useState(false)

    // ─── Multi-pane layout ────────────
    const MAX_PANELS = 4
    const [panelLayout, setPanelLayout] = useState<1 | 2 | 4>(1)
    const [activePanel, setActivePanel] = useState(0)
    const [panels, setPanels] = useState<PanelState[]>(
        Array.from({ length: MAX_PANELS }, initPanel)
    )
    const messagesEndRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])
    const updatePanel = (idx: number, updates: Partial<PanelState>) =>
        setPanels(prev => prev.map((p, i) => i === idx ? { ...p, ...updates } : p))

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const prevUnreadRef = useRef<number>(0)
    const prevEscalationIdsRef = useRef<Set<string>>(new Set())
    const audioContextRef = useRef<AudioContext | null>(null)
    const notifIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const [soundMuted, setSoundMuted] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('inbox-sound-muted') === 'true'
        }
        return false
    })
    const soundMutedRef = useRef(soundMuted)

    // ─── Active panel compatibility shims ────────────────────────────────────
    // Derive current panel state as named vars so all existing JSX works unchanged.
    const activeP = panels[activePanel]
    const selectedConversation = activeP.conversation
    const messages = activeP.messages
    const replyText = activeP.replyText
    const replyToName = activeP.replyToName
    const selectedImage = activeP.selectedImage
    const dragOver = activeP.dragOver
    const showEmojiPicker = activeP.showEmojiPicker
    const aiSuggesting = activeP.aiSuggesting
    const postExpanded = activeP.postExpanded
    const likedCommentIds = activeP.likedCommentIds
    const loadingMessages = activeP.loadingMessages
    const msgHasMore = activeP.msgHasMore
    const loadingMoreMsg = activeP.loadingMoreMsg
    const setSelectedConversation = (v: Conversation | null | ((p: Conversation | null) => Conversation | null)) => {
        const next = typeof v === 'function' ? v(activeP.conversation) : v
        updatePanel(activePanel, { conversation: next })
    }
    const setMessages = (v: InboxMessage[] | ((p: InboxMessage[]) => InboxMessage[])) => {
        const next = typeof v === 'function' ? v(activeP.messages) : v
        updatePanel(activePanel, { messages: next })
    }
    const setReplyText = (v: string) => updatePanel(activePanel, { replyText: v })
    const setReplyToName = (v: string | null) => updatePanel(activePanel, { replyToName: v })
    const setSelectedImage = (v: File | null) => updatePanel(activePanel, { selectedImage: v })
    const setDragOver = (v: boolean) => updatePanel(activePanel, { dragOver: v })
    const setShowEmojiPicker = (v: boolean | ((p: boolean) => boolean)) => {
        const next = typeof v === 'function' ? v(activeP.showEmojiPicker) : v
        updatePanel(activePanel, { showEmojiPicker: next })
    }
    const setAiSuggesting = (v: boolean) => updatePanel(activePanel, { aiSuggesting: v })
    const setPostExpanded = (v: boolean) => updatePanel(activePanel, { postExpanded: v })
    const setLikedCommentIds = (v: Set<string> | ((p: Set<string>) => Set<string>)) => {
        const next = typeof v === 'function' ? v(activeP.likedCommentIds) : v
        updatePanel(activePanel, { likedCommentIds: next })
    }
    // messagesEndRef → active panel's slot
    const messagesEndRef = { current: messagesEndRefs.current[activePanel] }

    // ─── AI Settings state ───────────
    const [showAiSettings, setShowAiSettings] = useState(false)
    const [aiProvider, setAiProvider] = useState('')
    const [aiModel, setAiModel] = useState('')
    const [savingAi, setSavingAi] = useState(false)
    const [userApiKeys, setUserApiKeys] = useState<{ provider: string; name: string; defaultModel: string | null; isDefault: boolean }[]>([])
    const [availableModels, setAvailableModels] = useState<{ id: string; name: string; type: string }[]>([])
    const [loadingModels, setLoadingModels] = useState(false)

    // Fetch user's configured API keys + current channel AI settings
    useEffect(() => {
        const fetchUserKeys = async () => {
            try {
                const res = await fetch('/api/user/api-keys')
                if (res.ok) {
                    const data = await res.json()
                    setUserApiKeys(data.filter((k: any) => k.isActive !== false))
                }
            } catch { /* ignore */ }
        }
        fetchUserKeys()
    }, [])

    // Fetch current channel AI settings
    useEffect(() => {
        if (!activeChannel?.id) return
        const fetchChannelAi = async () => {
            try {
                const res = await fetch(`/api/admin/channels/${activeChannel.id}`)
                if (res.ok) {
                    const data = await res.json()
                    setAiProvider(data.defaultAiProvider || '')
                    setAiModel(data.defaultAiModel || '')
                }
            } catch { /* ignore */ }
        }
        fetchChannelAi()
    }, [activeChannel?.id])

    // Fetch models when provider changes
    useEffect(() => {
        if (!aiProvider) { setAvailableModels([]); return }
        const hasKey = userApiKeys.some(k => k.provider === aiProvider)
        if (!hasKey) { setAvailableModels([]); return }

        const fetchModels = async () => {
            setLoadingModels(true)
            try {
                const res = await fetch('/api/user/api-keys/models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: aiProvider }),
                })
                if (res.ok) {
                    const data = await res.json()
                    setAvailableModels(
                        (data.models || []).filter((m: any) => m.type === 'text')
                    )
                }
            } catch { /* ignore */ }
            setLoadingModels(false)
        }
        fetchModels()
    }, [aiProvider, userApiKeys])

    const saveAiSettings = useCallback(async () => {
        if (!activeChannel?.id) return
        setSavingAi(true)
        try {
            const res = await fetch(`/api/admin/channels/${activeChannel.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    defaultAiProvider: aiProvider || null,
                    defaultAiModel: aiModel || null,
                }),
            })
            if (res.ok) {
                toast.success(t('inbox.toast.aiSettingsSaved'))
            } else {
                toast.error(t('inbox.toast.aiSettingsFailed'))
            }
        } catch {
            toast.error(t('inbox.toast.networkError'))
        } finally {
            setSavingAi(false)
        }
    }, [activeChannel?.id, aiProvider, aiModel])

    // ─── Notification sound (Web Audio API — two-tone chime) ─
    const toggleSoundMute = useCallback(() => {
        setSoundMuted(prev => {
            const next = !prev
            soundMutedRef.current = next
            localStorage.setItem('inbox-sound-muted', String(next))
            return next
        })
    }, [])

    const playNotificationSound = useCallback(() => {
        if (soundMutedRef.current) return
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            }
            const ctx = audioContextRef.current
            // First tone — C6
            const osc1 = ctx.createOscillator()
            const gain1 = ctx.createGain()
            osc1.connect(gain1)
            gain1.connect(ctx.destination)
            osc1.frequency.setValueAtTime(1047, ctx.currentTime) // C6
            osc1.type = 'sine'
            gain1.gain.setValueAtTime(0.25, ctx.currentTime)
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
            osc1.start(ctx.currentTime)
            osc1.stop(ctx.currentTime + 0.15)
            // Second tone — E6 (higher)
            const osc2 = ctx.createOscillator()
            const gain2 = ctx.createGain()
            osc2.connect(gain2)
            gain2.connect(ctx.destination)
            osc2.frequency.setValueAtTime(1319, ctx.currentTime + 0.15) // E6
            osc2.type = 'sine'
            gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15)
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
            osc2.start(ctx.currentTime + 0.15)
            osc2.stop(ctx.currentTime + 0.4)
        } catch (e) {
            console.warn('Could not play notification sound:', e)
        }
    }, [])

    // ─── Browser notification ─────────
    const showBrowserNotification = useCallback((title: string, body: string, conversationId?: string) => {
        if (typeof window === 'undefined') return
        if (Notification.permission === 'granted') {
            const n = new Notification(title, {
                body,
                icon: '/icon-192.png',
                tag: `inbox-${Date.now()}`, // unique tag so each notification shows
            })
            n.onclick = () => {
                window.focus()
                n.close()
                if (conversationId) {
                    window.location.href = `/dashboard/inbox?conversation=${conversationId}`
                }
            }
            setTimeout(() => n.close(), 8000)
        }
    }, [])

    // ─── Request notification permission ─
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    // ─── Background polling — auto-refresh conversations + messages ─
    useEffect(() => {
        const pollInterval = setInterval(async () => {
            try {
                // 1. Fetch latest conversations (page 1 only)
                const params = new URLSearchParams()
                if (activeChannel?.id) params.set('channelId', activeChannel.id)
                if (statusFilter !== 'all' && statusFilter !== 'mine') params.set('status', statusFilter)
                if (statusFilter === 'mine') params.set('mine', 'true')
                if (activeTab !== 'all') params.set('tab', activeTab)
                if (selectedPlatformIds.length === 1) params.set('platformAccountId', selectedPlatformIds[0])
                params.set('limit', String(CONV_LIMIT))
                params.set('page', '1')

                const res = await fetch(`/api/inbox/conversations?${params}`)
                if (!res.ok) return
                const data = await res.json()
                const freshConversations = data.conversations || []
                const freshCounts = data.counts || counts

                // 2. Detect new inbound messages by comparing total unread
                const totalUnread = freshConversations.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0)
                if (totalUnread > prevUnreadRef.current) {
                    playNotificationSound()
                    // Show in-app toast
                    const newest = freshConversations[0]
                    const senderName = newest?.externalUserName || t('inbox.unknown')
                    const preview = newest?.lastMessage?.substring(0, 60) || t('inbox.toast.newMessage')
                    toast(`📬 ${senderName}`, {
                        description: preview,
                        action: {
                            label: t('inbox.actions.view'),
                            onClick: () => {
                                // Auto-select the conversation
                                const conv = freshConversations.find((c: any) => c.id === newest?.id)
                                if (conv) {
                                    setSelectedConversation(conv)
                                }
                            },
                        },
                    })
                    // Browser notification (if tab is in background)
                    if (document.hidden) {
                        showBrowserNotification(
                            t('inbox.toast.newMessage'),
                            `${senderName}: ${preview}`,
                            newest?.id
                        )
                    }
                }
                prevUnreadRef.current = totalUnread

                // 3. Detect NEW agent escalations (conversations that switched to AGENT mode)
                const nowEscalated = freshConversations.filter((c: any) =>
                    c.mode === 'AGENT' && c.status !== 'done' && c.status !== 'archived'
                )
                const newEscalations = nowEscalated.filter((c: any) => !prevEscalationIdsRef.current.has(c.id))
                if (newEscalations.length > 0) {
                    playNotificationSound()
                    newEscalations.forEach((conv: any) => {
                        const senderName = conv.externalUserName || t('inbox.unknown')
                        showBrowserNotification(
                            `🚨 ${t('inbox.escalation.agentNeeded') || 'Agent Needed'}`,
                            `${senderName} ${t('inbox.escalation.needsHumanAgent') || 'needs a human agent'}`,
                            conv.id
                        )
                    })
                }
                prevEscalationIdsRef.current = new Set(nowEscalated.map((c: any) => c.id))

                // 3. Merge + re-sort — server already returns page-1 sorted by lastMessageAt desc.
                // Keep extra-loaded (page 2+) convs at bottom, re-sort first-page items by lastMessageAt.
                setCounts(freshCounts)
                setConversations(prev => {
                    const freshMap = new Map(freshConversations.map((c: Conversation) => [c.id, c]))
                    const freshIds = new Set(freshConversations.map((c: Conversation) => c.id))
                    // Conversations only in prev (older pages loaded via "load more")
                    const extraOlder = prev.filter(c => !freshIds.has(c.id))
                    // Fresh page-1 conversations in server sort order, merged with any local-only updates
                    const freshSorted = freshConversations.map((c: Conversation) => freshMap.get(c.id) as Conversation)
                    return [...freshSorted, ...extraOlder]
                })

                // 4. Refresh messages for all open panels
                for (let pi = 0; pi < MAX_PANELS; pi++) {
                    const panelConv = panels[pi]?.conversation
                    if (!panelConv) continue
                    try {
                        const msgRes = await fetch(`/api/inbox/conversations/${panelConv.id}/messages?page=1&limit=${MSG_LIMIT}`)
                        if (msgRes.ok) {
                            const msgData = await msgRes.json()
                            setPanels(cur => cur.map((p, i) => {
                                if (i !== pi || !p.conversation) return p
                                const freshMsgs: InboxMessage[] = msgData.messages || []
                                if (freshMsgs.length === 0) return p
                                if (freshMsgs[freshMsgs.length - 1]?.id === p.messages[p.messages.length - 1]?.id) return p
                                const freshIds = new Set(freshMsgs.map(m => m.id))
                                // Also strip any temp- optimistic messages that have now been persisted in freshMsgs
                                const olderMsgs = p.messages.filter(m => !freshIds.has(m.id) && !m.id.startsWith('temp-'))
                                return { ...p, messages: [...olderMsgs, ...freshMsgs] }
                            }))
                        }
                    } catch { /* ignore */ }
                }
            } catch {
                // Silently ignore polling errors
            }
        }, 3000) // Every 3 seconds

        // Initial unread count
        prevUnreadRef.current = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

        return () => clearInterval(pollInterval)
    }, [activeChannel?.id, statusFilter, activeTab, selectedPlatformIds, selectedConversation?.id, playNotificationSound, showBrowserNotification]) // eslint-disable-line

    // ─── Fetch platform accounts ──────
    const fetchPlatforms = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (activeChannel?.id) params.set('channelId', activeChannel.id)
            const res = await fetch(`/api/inbox/platforms?${params}`)
            if (res.ok) {
                const data = await res.json()
                setPlatformAccounts(data.platforms || [])
            }
        } catch (e) {
            console.error('Failed to fetch platforms:', e)
        }
    }, [activeChannel?.id])

    // ─── Fetch conversations (initial/reset) ──────────
    const fetchConversations = useCallback(async () => {
        setLoading(true)
        setConvPage(1)
        try {
            const params = new URLSearchParams()
            if (activeChannel?.id) params.set('channelId', activeChannel.id)
            if (statusFilter !== 'all' && statusFilter !== 'mine') params.set('status', statusFilter)
            if (statusFilter === 'mine') params.set('mine', 'true')
            if (searchQuery) params.set('search', searchQuery)
            if (activeTab !== 'all') params.set('tab', activeTab)
            if (selectedPlatformIds.length === 1) params.set('platformAccountId', selectedPlatformIds[0])
            params.set('limit', String(CONV_LIMIT))
            params.set('page', '1')

            const res = await fetch(`/api/inbox/conversations?${params}`)
            if (res.ok) {
                const data = await res.json()
                setConversations(data.conversations || [])
                setCounts(data.counts || { new: 0, open: 0, done: 0, archived: 0, mine: 0, all: 0 })
                setConvHasMore((data.conversations || []).length === CONV_LIMIT)
            }
        } catch (e) {
            console.error('Failed to fetch conversations:', e)
        } finally {
            setLoading(false)
        }
    }, [activeChannel?.id, statusFilter, searchQuery, selectedPlatformIds, activeTab])

    // ─── Load more conversations ──────────
    const loadMoreConversations = useCallback(async () => {
        const nextPage = convPage + 1
        setLoadingMoreConv(true)
        try {
            const params = new URLSearchParams()
            if (activeChannel?.id) params.set('channelId', activeChannel.id)
            if (statusFilter !== 'all' && statusFilter !== 'mine') params.set('status', statusFilter)
            if (statusFilter === 'mine') params.set('mine', 'true')
            if (searchQuery) params.set('search', searchQuery)
            if (activeTab !== 'all') params.set('tab', activeTab)
            if (selectedPlatformIds.length === 1) params.set('platformAccountId', selectedPlatformIds[0])
            params.set('limit', String(CONV_LIMIT))
            params.set('page', String(nextPage))

            const res = await fetch(`/api/inbox/conversations?${params}`)
            if (res.ok) {
                const data = await res.json()
                const more = data.conversations || []
                setConversations(prev => {
                    const existingIds = new Set(prev.map(c => c.id))
                    return [...prev, ...more.filter((c: Conversation) => !existingIds.has(c.id))]
                })
                setConvHasMore(more.length === CONV_LIMIT)
                setConvPage(nextPage)
            }
        } catch (e) {
            console.error('Failed to load more conversations:', e)
        } finally {
            setLoadingMoreConv(false)
        }
    }, [activeChannel?.id, statusFilter, searchQuery, selectedPlatformIds, activeTab, convPage])

    // ─── Fetch messages for a pane (initial/reset) ─
    const fetchMessages = useCallback(async (convId: string, panelIdx: number) => {
        updatePanel(panelIdx, { loadingMessages: true, msgPage: 1, msgHasMore: false })
        try {
            const params = new URLSearchParams()
            params.set('limit', String(MSG_LIMIT))
            params.set('page', '1')
            params.set('markRead', 'true') // Clear unreadCount on explicit open
            const res = await fetch(`/api/inbox/conversations/${convId}/messages?${params}`)
            if (res.ok) {
                const data = await res.json()
                const msgs = data.messages || []
                updatePanel(panelIdx, { messages: msgs, msgHasMore: data.total > MSG_LIMIT })
                // Immediately clear unread badge in conversation list
                setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c))
            }
        } catch (e) {
            console.error('Failed to fetch messages:', e)
        } finally {
            updatePanel(panelIdx, { loadingMessages: false })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [MSG_LIMIT])

    // ─── Load earlier messages (older pages) ──────────
    const loadEarlierMessages = useCallback(async (panelIdx: number) => {
        setPanels(prev => {
            const panel = prev[panelIdx]
            if (!panel.conversation || panel.loadingMoreMsg) return prev
            const nextPage = panel.msgPage + 1
            // Start loading
            const started = prev.map((p, i) => i === panelIdx ? { ...p, loadingMoreMsg: true } : p)
            // Do async work outside
            fetch(`/api/inbox/conversations/${panel.conversation.id}/messages?limit=${MSG_LIMIT}&page=${nextPage}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (!data) return
                    const older: InboxMessage[] = data.messages || []
                    setPanels(cur => cur.map((p, i) => {
                        if (i !== panelIdx) return p
                        const existingIds = new Set(p.messages.map(m => m.id))
                        return {
                            ...p,
                            messages: [...older.filter(m => !existingIds.has(m.id)), ...p.messages],
                            msgHasMore: older.length === MSG_LIMIT,
                            msgPage: nextPage,
                            loadingMoreMsg: false,
                        }
                    }))
                })
                .catch(() => setPanels(cur => cur.map((p, i) => i === panelIdx ? { ...p, loadingMoreMsg: false } : p)))
            return started
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [MSG_LIMIT])

    // ─── Send reply (per pane) ────────
    const handleSendReply = useCallback(async (panelIdx: number) => {
        setPanels(prev => {
            const panel = prev[panelIdx]
            const conv = panel.conversation
            if (!conv || (!panel.replyText.trim() && !panel.selectedImage)) return prev

            let contentToSend = panel.replyText.trim()
            const imageToSend = panel.selectedImage

            if (conv.type !== 'comment') {
                contentToSend = contentToSend.replace(/^@\[[^\]]+\]\s*/, '')
                if (!contentToSend && !imageToSend) return prev
            }

            const tempId = `temp-${Date.now()}`
            const displayText = imageToSend
                ? contentToSend ? `${contentToSend}\n📷 Image` : '📷 Image'
                : contentToSend
            const optimisticMessage: InboxMessage = {
                id: tempId, externalId: null, direction: 'outbound', senderType: 'agent',
                content: displayText, contentOriginal: null, detectedLang: null,
                mediaUrl: imageToSend ? URL.createObjectURL(imageToSend) : null,
                mediaType: imageToSend ? 'image' : null,
                senderName: null, senderAvatar: null, confidence: null,
                sentAt: new Date().toISOString(),
            }

            // Update conversation list immediately
            const displayContent = (contentToSend || '📷 Image').replace(/@\[([^\]]+)\]/g, '@$1')
            setConversations(prevConvs => prevConvs.map(c =>
                c.id === conv.id
                    ? { ...c, lastMessage: displayContent, lastMessageSender: 'agent', mode: 'AGENT' as const, lastMessageAt: new Date().toISOString() }
                    : c
            ))

            // Send via API in background
            const sendAsync = async () => {
                const replyToExternalId = panel.replyToMsgId ?? undefined
                let res: Response
                if (imageToSend) {
                    const formData = new FormData()
                    formData.append('content', contentToSend || '📷 Image')
                    formData.append('image', imageToSend)
                    res = await fetch(`/api/inbox/conversations/${conv.id}/messages`, { method: 'POST', body: formData })
                } else {
                    res = await fetch(`/api/inbox/conversations/${conv.id}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: contentToSend, ...(replyToExternalId && { replyToExternalId }) }),
                    })
                }
                if (res.ok) {
                    const data = await res.json()
                    setPanels(cur => cur.map((p, i) => i === panelIdx
                        ? { ...p, messages: p.messages.map(m => m.id === tempId ? { ...optimisticMessage, ...data.message } : m) }
                        : p
                    ))
                } else {
                    toast.error(t('inbox.toast.sendFailed'))
                }
            }
            sendAsync().catch(() => toast.error(t('inbox.toast.sendNetworkError')))

            // Optimistic: add message, clear input
            return prev.map((p, i) => i === panelIdx ? {
                ...p,
                messages: [...p.messages, optimisticMessage],
                replyText: '',
                replyToName: null,
                replyToMsgId: null,
                replyToContent: null,
                selectedImage: null,
                showEmojiPicker: false,
                conversation: conv ? { ...conv, mode: 'AGENT' as const } : null,
            } : p)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t])

    // ─── Update conversation ──────────
    const updateConversation = useCallback(async (convId: string, body: Record<string, any>, panelIdx?: number) => {
        setUpdatingConv(true)
        try {
            const res = await fetch(`/api/inbox/conversations/${convId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (res.ok) {
                const data = await res.json()
                const updated = data.conversation
                setConversations(prev => prev.map(c => c.id === convId ? { ...c, ...updated } : c))
                // Update conversation in whichever panels reference it
                setPanels(prev => prev.map(p =>
                    p.conversation?.id === convId
                        ? { ...p, conversation: { ...p.conversation!, ...updated } }
                        : p
                ))
                toast.success(t('inbox.toast.updated'))
                fetchConversations()
            } else {
                toast.error(t('inbox.toast.updateFailed'))
            }
        } catch (e) {
            toast.error(t('inbox.toast.updateFailed'))
        } finally {
            setUpdatingConv(false)
        }
    }, [fetchConversations, t])

    // ─── Effects ──────────────────────
    useEffect(() => {
        fetchPlatforms()
    }, [fetchPlatforms])

    useEffect(() => {
        fetchConversations()
    }, [fetchConversations])

    // Auto-scroll each pane to bottom when its messages change
    useEffect(() => {
        panels.forEach((_, i) => {
            messagesEndRefs.current[i]?.scrollIntoView({ behavior: 'smooth' })
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panels.map(p => p.messages.length).join(',')])

    // Close reaction picker when clicking outside
    useEffect(() => {
        if (!openReactMsgId) return
        const handler = () => setOpenReactMsgId(null)
        document.addEventListener('click', handler)
        return () => document.removeEventListener('click', handler)
    }, [openReactMsgId])

    // Load bot avatar for each channel seen in panels
    useEffect(() => {
        const channelIds = panels.map(p => p.conversation?.channelId).filter(Boolean) as string[]
        const unseen = channelIds.filter(id => !(id in botAvatarByChannel))
        if (unseen.length === 0) return
        unseen.forEach(async (cid) => {
            try {
                const res = await fetch(`/api/admin/channels/${cid}/bot-config`)
                if (res.ok) {
                    const data = await res.json()
                    setBotAvatarByChannel(prev => ({ ...prev, [cid]: data.botAvatarUrl || null }))
                }
            } catch { /* ignore */ }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panels.map(p => p.conversation?.channelId).join(',')])

    // Debounced search
    const handleSearchChange = (value: string) => {
        setSearchQuery(value)
    }

    // Select conversation → load into active pane
    const selectConversation = (conv: Conversation) => {
        updatePanel(activePanel, { conversation: conv, postExpanded: false, replyText: '', replyToName: null })
        fetchMessages(conv.id, activePanel)
    }

    // ─── Toggle platform filter ───────
    const togglePlatformFilter = (platformId: string) => {
        setSelectedPlatformIds(prev =>
            prev.includes(platformId)
                ? prev.filter(p => p !== platformId)
                : [...prev, platformId]
        )
    }

    // ─── Platform tree (group by platform type, messaging-only) ─
    const messagingAccounts = platformAccounts.filter(p => MESSAGING_PLATFORMS.has(p.platform))
    const platformTree = messagingAccounts.reduce((acc, p) => {
        if (!acc[p.platform]) acc[p.platform] = []
        acc[p.platform].push(p)
        return acc
    }, {} as Record<string, PlatformAccount[]>)

    // ─── Filter conversations client-side by selected platforms ─
    const filteredConversations = selectedPlatformIds.length > 0
        ? conversations.filter(c => selectedPlatformIds.includes(c.platformAccount?.id))
        : conversations

    // ─── AI stats ─────────────────────
    const botActive = conversations.filter(c => c.mode === 'BOT').length
    const needsAgent = conversations.filter(c => c.mode === 'AGENT' && c.status !== 'done' && c.status !== 'archived').length
    const angryCount = conversations.filter(c => c.sentiment === 'negative').length
    const waitingCount = conversations.filter(c => c.status === 'new').length

    return (
        <div className="absolute inset-0 flex overflow-hidden">
            {/* ═══ LEFT SIDEBAR — Filters ═══ */}
            <div className={cn(
                'hidden md:flex border-r flex-col shrink-0 bg-card transition-all duration-200 overflow-hidden relative',
                sidebarCollapsed ? 'w-[50px]' : 'w-[250px]'
            )}>
                {/* Channel indicator */}
                <div className="p-3 border-b">
                    <div className="flex items-center gap-2 px-1">
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="shrink-0 cursor-pointer flex items-center justify-center w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 transition-colors shadow-sm"
                            title={sidebarCollapsed ? t('inbox.sidebar.expandSidebar') : t('inbox.sidebar.collapseSidebar')}
                        >
                            {sidebarCollapsed ? (
                                <PanelLeft className="h-3.5 w-3.5 text-white" />
                            ) : (
                                <PanelLeftClose className="h-3.5 w-3.5 text-white" />
                            )}
                        </button>
                        {!sidebarCollapsed && (
                            <span className="text-sm font-semibold whitespace-nowrap flex items-center gap-2">
                                {t('inbox.title')}
                                {needsAgent > 0 && (
                                    <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">
                                        {needsAgent}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                    {!sidebarCollapsed && (
                        <p className="text-[10px] text-muted-foreground px-1 mt-1 whitespace-nowrap">
                            {activeChannel?.displayName || t('inbox.allChannels')}
                        </p>
                    )}
                </div>

                <ScrollArea className="flex-1">
                    {/* Status filters */}
                    <div className="p-2">
                        {!sidebarCollapsed && (
                            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {t('inbox.sidebar.status')}
                            </p>
                        )}
                        <nav className="space-y-0.5 mt-1">
                            {statusFilterItems.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setStatusFilter(f.key)}
                                    title={sidebarCollapsed ? t(`inbox.filters.${f.labelKey}`) : undefined}
                                    className={cn(
                                        'w-full flex items-center rounded-md transition-colors cursor-pointer',
                                        sidebarCollapsed ? 'justify-center p-1.5' : 'gap-2.5 px-2.5 py-1.5 text-xs',
                                        statusFilter === f.key
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-muted-foreground hover:bg-primary/8 hover:text-foreground'
                                    )}
                                >
                                    <f.icon className="h-3.5 w-3.5 shrink-0" />
                                    {!sidebarCollapsed && <span className="flex-1 text-left whitespace-nowrap">{t(`inbox.filters.${f.labelKey}`)}</span>}
                                    {!sidebarCollapsed && (counts[f.key as keyof StatusCounts] ?? 0) > 0 && (
                                        <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[9px]">
                                            {counts[f.key as keyof StatusCounts]}
                                        </Badge>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {!sidebarCollapsed && <Separator className="mx-2" />}

                    {!sidebarCollapsed && (
                        <>
                            <Separator className="mx-2" />

                            {/* Platform / Account tree */}
                            <div className="p-2">
                                <div className="flex items-center justify-between px-2 py-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('inbox.sidebar.platforms')}
                                    </p>
                                    {selectedPlatformIds.length > 0 && (
                                        <button
                                            onClick={() => setSelectedPlatformIds([])}
                                            className="text-[9px] text-primary hover:underline cursor-pointer"
                                        >
                                            {t('inbox.sidebar.clear')}
                                        </button>
                                    )}
                                </div>
                                {Object.keys(platformTree).length === 0 ? (
                                    <p className="px-2.5 py-2 text-[11px] text-muted-foreground/60 italic">
                                        {t('inbox.sidebar.noPlatforms')}
                                    </p>
                                ) : (
                                    <div className="space-y-1 mt-1">
                                        {Object.entries(platformTree).map(([platform, accounts]) => (
                                            <div key={platform}>
                                                <div className="w-full flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground">
                                                    <PlatformIcon platform={platform} size={16} />
                                                    <span className="font-medium">{platformConfig[platform]?.label || platform}</span>
                                                </div>
                                                {accounts.map(account => (
                                                    <button
                                                        key={account.id}
                                                        onClick={() => togglePlatformFilter(account.id)}
                                                        className={cn(
                                                            'w-full flex items-center gap-2 pl-7 pr-2 py-1 text-[11px] rounded-md transition-colors cursor-pointer',
                                                            selectedPlatformIds.includes(account.id)
                                                                ? 'bg-primary/10 text-primary font-medium'
                                                                : 'text-muted-foreground hover:bg-primary/8 hover:text-foreground'
                                                        )}
                                                    >
                                                        <span className="flex-1 text-left text-wrap break-words">{account.accountName}</span>
                                                        {selectedPlatformIds.includes(account.id) && (
                                                            <Check className="h-3 w-3 text-primary shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Separator className="mx-2" />

                            {/* ═══ PERSISTENT AGENT ESCALATION BANNER ═══ */}
                            {!sidebarCollapsed && needsAgent > 0 && (() => {
                                const escalated = conversations.filter(c =>
                                    c.mode === 'AGENT' && c.status !== 'done' && c.status !== 'archived'
                                )
                                return (
                                    <div className="mx-2 my-2 rounded-lg border border-red-500/40 bg-red-500/10 overflow-hidden">
                                        <div className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 border-b border-red-500/20">
                                            <span className="relative flex h-2 w-2 shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                            </span>
                                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide flex-1">
                                                {needsAgent} {t('inbox.escalation.agentNeeded') || 'Needs Agent'}
                                            </p>
                                        </div>
                                        <div className="divide-y divide-red-500/10 max-h-48 overflow-y-auto">
                                            {escalated.map(conv => (
                                                <div key={conv.id} className="flex items-center gap-2 px-3 py-2">
                                                    <button
                                                        className="text-[10px] text-left flex-1 min-w-0 cursor-pointer"
                                                        onClick={() => {
                                                            const freePane = panels.findIndex(p => !p.conversation)
                                                            const pIdx = freePane >= 0 ? freePane : activePanel
                                                            setActivePanel(pIdx)
                                                            updatePanel(pIdx, { conversation: conv })
                                                        }}
                                                    >
                                                        <span className="font-medium text-foreground truncate block">{conv.externalUserName || t('inbox.unknown')}</span>
                                                        <span className="text-muted-foreground">{conv.platform}</span>
                                                    </button>
                                                    <button
                                                        className="shrink-0 text-[9px] px-2 py-0.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/20 cursor-pointer font-medium whitespace-nowrap"
                                                        onClick={() => updateConversation(conv.id, { assignedTo: session?.user?.id })}
                                                    >
                                                        {t('inbox.escalation.assignMe') || 'Assign me'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* AI Quick Stats */}
                            <div className="p-2">
                                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {t('inbox.sidebar.aiStats')}
                                </p>
                                <div className="space-y-1 mt-1 px-2.5">
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <Bot className="h-3.5 w-3.5 text-green-500" />
                                        <span>{t('inbox.sidebar.botActive').replace('{count}', String(botActive))}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <Frown className="h-3.5 w-3.5 text-red-500" />
                                        <span>{t('inbox.sidebar.negative').replace('{count}', String(angryCount))}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                                        <span>{t('inbox.sidebar.waiting').replace('{count}', String(waitingCount))}</span>
                                    </div>
                                </div>
                            </div>

                            <Separator className="mx-2" />

                            {/* AI Settings */}
                            <div className="p-2">
                                <button
                                    onClick={() => setShowAiSettings(!showAiSettings)}
                                    className="w-full flex items-center justify-between px-2 py-1 cursor-pointer"
                                >
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('inbox.sidebar.aiSettings')}
                                    </p>
                                    {showAiSettings ? (
                                        <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </button>
                                {showAiSettings && (
                                    <div className="space-y-2 mt-2 px-1">
                                        {/* Provider — from user's API keys */}
                                        <div>
                                            <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">{t('inbox.sidebar.provider')}</label>
                                            {userApiKeys.length === 0 ? (
                                                <div className="mt-1 rounded-md bg-muted/50 border border-border p-2">
                                                    <p className="text-[10px] text-muted-foreground">{t('inbox.sidebar.noAiKeys')}</p>
                                                    <a href="/dashboard/api-keys" className="text-[10px] text-primary hover:underline">
                                                        {t('inbox.sidebar.setupApiKeys')}
                                                    </a>
                                                </div>
                                            ) : (
                                                <select
                                                    value={aiProvider}
                                                    onChange={e => {
                                                        setAiProvider(e.target.value)
                                                        setAiModel('')
                                                    }}
                                                    className="w-full mt-0.5 h-7 px-2 text-[11px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                                >
                                                    <option value="">{t('inbox.sidebar.selectProvider')}</option>
                                                    {userApiKeys.map(k => (
                                                        <option key={k.provider} value={k.provider}>
                                                            {k.name || k.provider}
                                                            {k.isDefault ? ' ★' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>

                                        {/* Model — fetched from user's API key */}
                                        {aiProvider && (
                                            <div>
                                                <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
                                                    {t('inbox.sidebar.model')}
                                                    {loadingModels && <Loader2 className="inline h-2.5 w-2.5 animate-spin ml-1" />}
                                                </label>
                                                <select
                                                    value={aiModel}
                                                    onChange={e => setAiModel(e.target.value)}
                                                    disabled={loadingModels}
                                                    className="w-full mt-0.5 h-7 px-2 text-[11px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                                >
                                                    <option value="">{loadingModels ? t('inbox.sidebar.loadingModels') : t('inbox.sidebar.selectModel')}</option>
                                                    {availableModels.map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Save */}
                                        <Button
                                            size="sm"
                                            className="w-full h-7 text-[10px]"
                                            onClick={saveAiSettings}
                                            disabled={savingAi || !aiProvider}
                                        >
                                            {savingAi ? (
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            ) : (
                                                <Save className="h-3 w-3 mr-1" />
                                            )}
                                            {t('inbox.sidebar.saveAiSettings')}
                                        </Button>

                                        {/* Current config display */}
                                        {aiProvider && aiModel && (
                                            <div className="rounded-md bg-primary/5 border border-primary/10 p-2">
                                                <p className="text-[9px] text-muted-foreground break-words">{t('inbox.sidebar.provider')}: <span className="text-foreground font-medium">{userApiKeys.find(k => k.provider === aiProvider)?.name || aiProvider}</span></p>
                                                <p className="text-[9px] text-muted-foreground break-words">{t('inbox.sidebar.model')}: <span className="text-foreground font-medium">{availableModels.find(m => m.id === aiModel)?.name || aiModel}</span></p>
                                            </div>
                                        )}

                                        <Separator className="my-1" />

                                        {/* Notification Sound Toggle */}
                                        <div>
                                            <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">{t('inbox.sidebar.notification')}</label>
                                            <button
                                                onClick={toggleSoundMute}
                                                className={cn(
                                                    'w-full mt-1 flex items-center gap-2 px-2.5 py-2 rounded-md border transition-colors cursor-pointer',
                                                    soundMuted
                                                        ? 'border-border bg-muted/30 text-muted-foreground'
                                                        : 'border-primary/30 bg-primary/5 text-foreground'
                                                )}
                                            >
                                                {soundMuted ? (
                                                    <VolumeX className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                ) : (
                                                    <Volume2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                                )}
                                                <span className="text-[11px] flex-1 text-left">
                                                    {soundMuted ? t('inbox.sidebar.soundOff') : t('inbox.sidebar.soundOn')}
                                                </span>
                                                <span className={cn(
                                                    'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                                                    soundMuted
                                                        ? 'bg-muted text-muted-foreground'
                                                        : 'bg-primary/10 text-primary'
                                                )}>
                                                    {soundMuted ? t('inbox.sidebar.muted') : t('inbox.sidebar.active')}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </ScrollArea>
            </div>


            {/* ═══ CENTER — Conversation List ═══ */}
            <div className={cn(
                "w-[320px] border-r flex-col shrink-0 bg-background overflow-hidden flex",
                selectedConversation ? 'hidden md:flex' : 'flex'
            )}>
                {/* Tabs */}
                <div className="border-b">
                    <div className="flex">
                        {inboxTabs.map(tab => {
                            const tabUnread = conversations.reduce((sum, c) => {
                                if ((c.unreadCount ?? 0) === 0) return sum
                                if (tab.key === 'all') return sum + (c.unreadCount ?? 0)
                                if (tab.key === 'messages' && c.type === 'message') return sum + (c.unreadCount ?? 0)
                                if (tab.key === 'comments' && c.type === 'comment') return sum + (c.unreadCount ?? 0)
                                if (tab.key === 'reviews' && c.type === 'review') return sum + (c.unreadCount ?? 0)
                                return sum
                            }, 0)
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => {
                                        setActiveTab(tab.key)
                                        setSelectedConversation(null)
                                        setMessages([])
                                    }}
                                    className={cn(
                                        'flex-1 py-2.5 text-xs font-medium transition-colors relative cursor-pointer',
                                        activeTab === tab.key
                                            ? 'text-primary'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        {t(`inbox.tabs.${tab.labelKey}`)}
                                        {tabUnread > 0 && (
                                            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                                                {tabUnread > 99 ? '99+' : tabUnread}
                                            </span>
                                        )}
                                    </span>
                                    {activeTab === tab.key && (
                                        <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Search + refresh + pane layout switcher */}
                <div className="p-2 border-b flex gap-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={e => handleSearchChange(e.target.value)}
                            placeholder={t('inbox.search')}
                            className="h-8 pl-8 text-xs"
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => fetchConversations()}
                        disabled={loading}
                    >
                        <RefreshCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    </Button>
                    {/* Sync missing profiles button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title="Sync Facebook names & avatars"
                        onClick={async () => {
                            setSyncingProfiles(true)
                            try {
                                const res = await fetch('/api/inbox/sync-profiles', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(activeChannel?.id ? { channelId: activeChannel.id } : {})
                                })
                                const data = await res.json()
                                if (res.ok) {
                                    toast.success(`✅ Synced ${data.synced}/${data.total} profiles`)
                                    if (data.failed > 0 && data.errors?.length) {
                                        console.warn('[Sync Profiles] Errors:', data.errors)
                                    }
                                    fetchConversations()
                                } else {
                                    toast.error('Sync failed')
                                }
                            } catch {
                                toast.error('Sync error')
                            } finally {
                                setSyncingProfiles(false)
                            }
                        }}
                        disabled={syncingProfiles}
                    >
                        {syncingProfiles
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <UserPlus className="h-3.5 w-3.5" />}
                    </Button>
                    {/* Pane layout switcher */}
                    <div className="flex items-center gap-0.5 border rounded-md p-0.5 bg-muted/40">
                        {([1, 2, 4] as const).map(n => (
                            <button
                                key={n}
                                onClick={() => setPanelLayout(n)}
                                title={`${n} pane${n > 1 ? 's' : ''}`}
                                className={cn(
                                    'h-7 px-1.5 rounded text-xs font-medium transition-colors',
                                    panelLayout === n
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                )}
                            >
                                {n === 1 ? (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>
                                ) : n === 2 ? (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="7.5" y="1" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="7.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="1" y="7.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {loading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2 animate-spin" />
                            <p className="text-xs text-muted-foreground">{t('inbox.loading')}</p>
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-8 text-center">
                            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground font-medium">{t('inbox.noConversations')}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                                {t('inbox.noConversationsDesc')}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y flex flex-col">
                            {filteredConversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => selectConversation(conv)}
                                    className={cn(
                                        'w-full flex gap-3 p-3 text-left transition-colors cursor-pointer',
                                        selectedConversation?.id === conv.id
                                            ? 'bg-primary/5 border-l-2 border-l-primary'
                                            : conv.mode === 'AGENT' && conv.status !== 'done' && conv.status !== 'archived'
                                                ? 'hover:bg-amber-500/10 border-l-2 border-l-amber-500 bg-amber-500/5'
                                                : 'hover:bg-primary/6 border-l-2 border-l-transparent'
                                    )}
                                >
                                    {/* Avatar */}
                                    <div className="relative">
                                        <Avatar className="h-9 w-9">
                                            {conv.externalUserAvatar && (
                                                <AvatarImage src={conv.externalUserAvatar} alt={conv.externalUserName || ''} />
                                            )}
                                            <AvatarFallback className={cn(
                                                'text-xs font-medium',
                                                platformConfig[conv.platform]?.color || 'bg-gray-100'
                                            )}>
                                                {conv.externalUserName?.charAt(0)?.toUpperCase() || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="absolute -bottom-0.5 -right-0.5">
                                            <PlatformIcon platform={conv.platform} size={14} />
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-semibold truncate">
                                                {conv.externalUserName || t('inbox.unknown')}
                                            </span>
                                            <span className={cn(
                                                "text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0 whitespace-nowrap",
                                                (conv.type || 'message') === 'message' && 'bg-blue-500/15 text-blue-500',
                                                (conv.type || 'message') === 'comment' && 'bg-orange-500/15 text-orange-500',
                                                (conv.type || 'message') === 'review' && 'bg-purple-500/15 text-purple-500',
                                            )}>
                                                {(conv.type || 'message') === 'message' ? t('inbox.typeMessage') : (conv.type || 'message') === 'comment' ? t('inbox.typeComment') : t('inbox.typeReview')}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap ml-auto">
                                                {conv.lastMessageAt ? timeAgo(conv.lastMessageAt, t) : ''}
                                            </span>
                                        </div>
                                        {/* Page name */}
                                        {conv.platformAccount?.accountName && (
                                            <div className="text-[9px] text-muted-foreground/60 truncate mt-0.5">
                                                {t('inbox.via')} {conv.platformAccount.accountName}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <p className="text-[11px] text-muted-foreground truncate flex-1">
                                                {(conv.lastMessage || t('inbox.noMessages')).replace(/@\[([^\]]+)\]/g, '@$1')}
                                            </p>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {conv.mode === 'BOT' && <Bot className="h-3 w-3 text-green-500" />}
                                                {conv.mode === 'AGENT' && conv.status !== 'done' && conv.status !== 'archived' && (
                                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                                                        </span>
                                                        <span className="text-[8px] font-bold uppercase tracking-wide">{t('inbox.agentBadge')}</span>
                                                    </span>
                                                )}
                                                {conv.mode === 'AGENT' && (conv.status === 'done' || conv.status === 'archived') && (
                                                    <UserCircle className="h-3 w-3 text-blue-500" />
                                                )}
                                                {/* Unread count bubble */}
                                                {conv.unreadCount > 0 && (
                                                    <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-green-500 text-black text-[9px] font-bold leading-none">
                                                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Tags + sentiment */}
                                        {(conv.tags.length > 0 || conv.sentiment) && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <SentimentIcon sentiment={conv.sentiment} />
                                                {conv.tags.slice(0, 2).map(tag => (
                                                    <Badge key={tag} variant="outline" className="h-3.5 px-1 text-[8px] font-normal">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                                {conv.intent && (
                                                    <Badge variant="secondary" className="h-3.5 px-1 text-[8px]">
                                                        {conv.intent === 'buy' ? '🛒' : conv.intent === 'complaint' ? '⚠️' : conv.intent === 'support' ? '🔧' : 'ℹ️'}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {/* Load more conversations */}
                            {convHasMore && (
                                <div className="p-2 flex justify-center border-t">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                                        onClick={loadMoreConversations}
                                        disabled={loadingMoreConv}
                                    >
                                        {loadingMoreConv ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <ChevronDown className="h-3 w-3" />
                                        )}
                                        {loadingMoreConv ? 'Loading...' : 'Load more'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ RIGHT — Multi-Pane Detail Area ═══ */}
            <div className={cn(
                'flex-1 min-w-0 min-h-0 overflow-hidden',
                panelLayout === 1 ? 'flex flex-col' : panelLayout === 2 ? 'grid grid-cols-2' : 'grid grid-cols-2 grid-rows-2'
            )}>
                {Array.from({ length: panelLayout }, (_, paneIdx) => {
                    const pane = panels[paneIdx]
                    const paneConv = pane.conversation
                    const isActive = paneIdx === activePanel

                    return (
                        <div
                            key={paneIdx}
                            className={cn(
                                'flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-background relative',
                                panelLayout > 1 && 'border-l border-b',
                                panelLayout > 1 && isActive && 'ring-2 ring-inset ring-primary/60',
                            )}
                            onClick={() => {
                                if (paneIdx !== activePanel) setActivePanel(paneIdx)
                            }}
                        >
                            {/* Active pane indicator bar */}
                            {panelLayout > 1 && (
                                <div className={cn(
                                    'h-0.5 w-full shrink-0 transition-colors',
                                    isActive ? 'bg-primary' : 'bg-transparent'
                                )} />
                            )}
                            {paneConv ? (
                                (() => {
                                    // For non-active panels, derive panel state locally
                                    const paneSC = paneConv
                                    const paneMsgs = pane.messages
                                    const paneReplyText = pane.replyText
                                    const paneReplyToName = pane.replyToName
                                    const paneReplyToContent = pane.replyToContent
                                    const paneSelectedImage = pane.selectedImage
                                    const paneDragOver = pane.dragOver
                                    const paneShowEmojiPicker = pane.showEmojiPicker
                                    const panePostExpanded = pane.postExpanded
                                    const paneLikedIds = pane.likedCommentIds
                                    const paneLoadingMessages = pane.loadingMessages
                                    const paneMsgHasMore = pane.msgHasMore
                                    const paneLoadingMoreMsg = pane.loadingMoreMsg
                                    const paneAiSuggesting = pane.aiSuggesting
                                    const sc = paneSC
                                    return (
                                        <div className="flex flex-col flex-1 min-h-0">
                                            {/* Header */}
                                            <div className="flex items-center gap-3 px-2 py-3 border-b bg-card shrink-0">
                                                {/* Back button - mobile only */}
                                                <button
                                                    className="md:hidden shrink-0 p-1 rounded hover:bg-accent"
                                                    onClick={(e) => { e.stopPropagation(); updatePanel(paneIdx, { conversation: null, messages: [] }) }}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </button>
                                                <Avatar className="h-8 w-8">
                                                    {sc.externalUserAvatar && (
                                                        <AvatarImage src={sc.externalUserAvatar} alt={sc.externalUserName || ''} />
                                                    )}
                                                    <AvatarFallback className={cn(
                                                        'text-xs',
                                                        platformConfig[sc.platform]?.color
                                                    )}>
                                                        {(sc.externalUserName || sc.externalUserId || '?').charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold">
                                                            {sc.externalUserName || sc.externalUserId}
                                                        </span>
                                                        <PlatformIcon platform={sc.platform} size={16} />
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {sc.platformAccount?.accountName}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {sc.mode === 'BOT' && (
                                                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-green-300 text-green-600 bg-green-50 dark:bg-green-500/10">
                                                                <Bot className="h-2.5 w-2.5 mr-0.5" />
                                                                {t('inbox.header.botActive')}
                                                            </Badge>
                                                        )}
                                                        {sc.mode === 'AGENT' && (
                                                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400">
                                                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                                                {t('inbox.header.needsAgent')}
                                                            </Badge>
                                                        )}
                                                        {sc.sentiment && <SentimentIcon sentiment={sc.sentiment} />}
                                                        {sc.intent && (
                                                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                                                                {sc.intent === 'buy' ? t('inbox.header.buyIntent') : sc.intent === 'complaint' ? t('inbox.header.complaint') : sc.intent}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-1.5">
                                                    {sc.mode === 'BOT' ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1.5"
                                                            disabled={updatingConv}
                                                            onClick={() => updateConversation(sc.id, { action: 'takeover' }, paneIdx)}
                                                        >
                                                            <UserCircle className="h-3.5 w-3.5" />
                                                            {t('inbox.actions.takeOver')}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1.5"
                                                            disabled={updatingConv}
                                                            onClick={() => updateConversation(sc.id, { action: 'transferToBot' }, paneIdx)}
                                                        >
                                                            <Bot className="h-3.5 w-3.5" />
                                                            {t('inbox.actions.transferToBot')}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-xs gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        disabled={updatingConv}
                                                        onClick={() => updateConversation(sc.id, { status: 'done' }, paneIdx)}
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        {t('inbox.actions.resolve')}
                                                    </Button>
                                                    {/* Assign to member */}
                                                    <DropdownMenu onOpenChange={async (open) => {
                                                        if (open && sc?.channelId) {
                                                            try {
                                                                const r = await fetch(`/api/inbox/channels/${sc.channelId}/members`)
                                                                if (r.ok) {
                                                                    const d = await r.json()
                                                                    setChannelMembers(d.members || [])
                                                                }
                                                            } catch { /* ignore */ }
                                                        }
                                                    }}>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className={cn(
                                                                    'h-7 text-xs gap-1.5',
                                                                    sc.assignedTo && 'border-blue-500/50 text-blue-500'
                                                                )}
                                                            >
                                                                <UserPlus className="h-3.5 w-3.5" />
                                                                {sc.agent?.name
                                                                    ? sc.agent.name.split(' ')[0]
                                                                    : t('inbox.actions.assign') || 'Assign'}
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-52">
                                                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                                                {t('inbox.actions.assignTo') || 'Assign to'}
                                                            </div>
                                                            {channelMembers.length === 0 ? (
                                                                <div className="px-2 py-2 text-xs text-muted-foreground">Loading...</div>
                                                            ) : (
                                                                <>
                                                                    {channelMembers.map((member: any) => (
                                                                        <DropdownMenuItem
                                                                            key={member.id}
                                                                            className="text-xs cursor-pointer gap-2"
                                                                            onClick={() => updateConversation(sc.id, { assignedTo: sc.assignedTo === member.id ? null : member.id }, paneIdx)}
                                                                        >
                                                                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                                                {member.name?.charAt(0) || member.email?.charAt(0) || '?'}
                                                                            </div>
                                                                            <span className="flex-1 truncate">{member.name || member.email}</span>
                                                                            {sc.assignedTo === member.id && (
                                                                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                                            )}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                    {sc.assignedTo && (
                                                                        <>
                                                                            <div className="my-1 border-t" />
                                                                            <DropdownMenuItem
                                                                                className="text-xs cursor-pointer text-muted-foreground"
                                                                                onClick={() => updateConversation(sc.id, { assignedTo: null }, paneIdx)}
                                                                            >
                                                                                <UserX className="h-3.5 w-3.5 mr-2" />
                                                                                {t('inbox.actions.unassign') || 'Unassign'}
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                className="text-xs cursor-pointer"
                                                                onClick={() => updateConversation(sc.id, { status: 'archived' }, paneIdx)}
                                                            >
                                                                <Archive className="h-3.5 w-3.5 mr-2" />
                                                                {t('inbox.actions.archive')}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-xs cursor-pointer">
                                                                <Sparkles className="h-3.5 w-3.5 mr-2" />
                                                                {t('inbox.actions.aiSummary')}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-xs cursor-pointer text-red-500 focus:text-red-500"
                                                                onClick={async () => {
                                                                    if (!window.confirm(t('inbox.actions.deleteConfirm'))) return
                                                                    try {
                                                                        const res = await fetch(`/api/inbox/conversations/${sc.id}`, { method: 'DELETE' })
                                                                        if (res.ok) {
                                                                            setConversations(prev => prev.filter(c => c.id !== sc.id))
                                                                            updatePanel(paneIdx, { conversation: null, messages: [] })
                                                                            toast.success(t('inbox.toast.conversationDeleted'))
                                                                        } else {
                                                                            toast.error(t('inbox.toast.deleteFailed'))
                                                                        }
                                                                    } catch {
                                                                        toast.error(t('inbox.toast.deleteFailed'))
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                                {t('inbox.actions.delete')}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>

                                            {/* Agent escalation alert banner */}
                                            {sc.mode === 'AGENT' && sc.status !== 'done' && sc.status !== 'archived' && (
                                                <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 shrink-0">
                                                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                                    <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
                                                        <span className="font-semibold">{t('inbox.escalation.botEscalated')}</span> {t('inbox.escalation.needsHumanAgent')}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 text-[10px] px-2 border-amber-400/50 text-amber-600 hover:bg-amber-500/20 shrink-0"
                                                        onClick={() => {
                                                            setActivePanel(paneIdx)
                                                            const replyInput = document.querySelector<HTMLInputElement>('[data-reply-input]')
                                                            replyInput?.focus()
                                                        }}
                                                    >
                                                        {t('inbox.escalation.replyNow')}
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Post preview for comment conversations */}
                                            {sc.type === 'comment' && sc.metadata && (
                                                <div className="px-4 pt-3 pb-1 border-b border-border/50 shrink-0">
                                                    <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
                                                        <div className="p-3">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <span className="text-[10px] font-medium text-blue-400/80">{t('inbox.postPreview.originalPost')}</span>
                                                                <a
                                                                    href={(sc.metadata as any).postPermalink || '#'}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] text-muted-foreground hover:text-blue-400 transition-colors"
                                                                >
                                                                    {t('inbox.postPreview.viewOnFacebook')}
                                                                </a>
                                                            </div>
                                                            {(sc.metadata as any).postContent && (
                                                                <div>
                                                                    <p className={cn(
                                                                        'text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap',
                                                                        !panePostExpanded && 'line-clamp-3'
                                                                    )}>
                                                                        {(sc.metadata as any).postContent}
                                                                    </p>
                                                                    {(sc.metadata as any).postContent.length > 200 && (
                                                                        <button
                                                                            onClick={() => updatePanel(paneIdx, { postExpanded: !panePostExpanded })}
                                                                            className="text-[10px] text-blue-400 hover:text-blue-300 font-medium mt-1 cursor-pointer"
                                                                        >
                                                                            {panePostExpanded ? t('inbox.postPreview.seeLess') : t('inbox.postPreview.seeMore')}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {(sc.metadata as any).postImages?.length > 0 && (
                                                            (sc.metadata as any).postImages.length === 1 ? (
                                                                <div className="w-full bg-black/20">
                                                                    <img
                                                                        src={(sc.metadata as any).postImages[0]}
                                                                        alt="Post image"
                                                                        className="w-full h-auto max-h-[200px] object-contain"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-2 gap-0.5">
                                                                    {((sc.metadata as any).postImages as string[]).slice(0, 4).map((img: string, idx: number) => (
                                                                        <div key={idx} className="relative bg-black/20 overflow-hidden">
                                                                            <img
                                                                                src={img}
                                                                                alt={`Post image ${idx + 1}`}
                                                                                className="w-full h-auto object-contain max-h-[150px]"
                                                                            />
                                                                            {idx === 3 && (sc.metadata as any).postImages.length > 4 && (
                                                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                                                    <span className="text-white font-bold text-lg">
                                                                                        +{(sc.metadata as any).postImages.length - 4}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Chat history */}
                                            <ScrollArea className="flex-1 min-h-0 p-4">
                                                {/* Load earlier messages button */}
                                                {!paneLoadingMessages && paneMsgHasMore && (
                                                    <div className="flex justify-center mb-4">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs gap-1.5"
                                                            onClick={() => loadEarlierMessages(paneIdx)}
                                                            disabled={paneLoadingMoreMsg}
                                                        >
                                                            {paneLoadingMoreMsg ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <ChevronUp className="h-3 w-3" />
                                                            )}
                                                            {paneLoadingMoreMsg ? 'Loading...' : 'Load earlier messages'}
                                                        </Button>
                                                    </div>
                                                )}
                                                {paneLoadingMessages ? (
                                                    <div className="flex items-center justify-center h-32">
                                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : paneMsgs.length === 0 ? (
                                                    <div className="flex items-center justify-center h-32">
                                                        <p className="text-xs text-muted-foreground">{t('inbox.chat.noMessagesYet')}</p>
                                                    </div>
                                                ) : sc.type === 'comment' ? (
                                                    /* ═══ Facebook-style threaded comment thread ═══ */
                                                    <div className="space-y-0.5">
                                                        {paneMsgs.map((msg: InboxMessage, idx: number) => {
                                                            const isReply = msg.direction === 'outbound'
                                                            const prevMsg = idx > 0 ? paneMsgs[idx - 1] : null
                                                            const isFirstReplyInGroup = isReply && (!prevMsg || prevMsg.direction === 'inbound')
                                                            const senderName = msg.senderName
                                                                || (msg.direction === 'inbound' ? sc.externalUserName : null)
                                                                || t('inbox.chat.user')
                                                            const senderAvatar = msg.senderAvatar
                                                                || (msg.direction === 'inbound' ? sc.externalUserAvatar : null)
                                                                || null
                                                            const bracketMatch = msg.content.match(/^@\[([^\]]+)\]\s?/)
                                                            const legacyMatch = !bracketMatch ? msg.content.match(/^@(\S+)\s/) : null
                                                            const mentionName = bracketMatch ? bracketMatch[1] : legacyMatch ? legacyMatch[1] : null
                                                            const mentionMatchUsed = bracketMatch || legacyMatch
                                                            const contentWithoutMention = mentionName && mentionMatchUsed
                                                                ? msg.content.substring(mentionMatchUsed[0].length)
                                                                : msg.content

                                                            return (
                                                                <div key={msg.id} className={cn(
                                                                    'group',
                                                                    isReply && 'ml-10 relative'
                                                                )}>
                                                                    {isReply && isFirstReplyInGroup && (
                                                                        <div className="absolute -left-5 top-0 w-5 h-5 border-l-2 border-b-2 border-muted-foreground/20 rounded-bl-lg" />
                                                                    )}
                                                                    <div className="flex gap-2 py-1">
                                                                        <Avatar className={cn('shrink-0 mt-0.5', isReply ? 'h-7 w-7' : 'h-8 w-8')}>
                                                                            {msg.direction === 'inbound' && senderAvatar ? (
                                                                                <AvatarImage src={senderAvatar} alt={senderName} />
                                                                            ) : null}
                                                                            <AvatarFallback className={cn(
                                                                                'text-[10px] font-medium',
                                                                                msg.direction === 'outbound'
                                                                                    ? msg.senderType === 'bot'
                                                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                                                                    : 'bg-gray-100 dark:bg-gray-800'
                                                                            )}>
                                                                                {msg.direction === 'outbound'
                                                                                    ? msg.senderType === 'bot' ? '🤖' : 'S'
                                                                                    : senderName.charAt(0).toUpperCase()
                                                                                }
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className={cn(
                                                                                'inline-block rounded-2xl px-3 py-2 max-w-[85%]',
                                                                                isReply
                                                                                    ? 'bg-muted/80 dark:bg-muted/50'
                                                                                    : 'bg-muted/60 dark:bg-muted/40'
                                                                            )}>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="text-xs font-semibold">
                                                                                        {msg.direction === 'outbound'
                                                                                            ? msg.senderType === 'bot'
                                                                                                ? '🤖 AI Bot'
                                                                                                : sc.platformAccount?.accountName || 'Page'
                                                                                            : senderName
                                                                                        }
                                                                                    </span>
                                                                                    {msg.direction === 'outbound' && msg.senderType !== 'bot' && (
                                                                                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                                                                                            ✍️ Author
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-xs leading-relaxed whitespace-pre-wrap mt-0.5">
                                                                                    {mentionName && (
                                                                                        <span className="text-blue-500 font-semibold">@{mentionName} </span>
                                                                                    )}
                                                                                    {contentWithoutMention}
                                                                                </p>
                                                                            </div>
                                                                            <div className="flex items-center gap-3 mt-0.5 ml-3">
                                                                                {msg.direction === 'inbound' && msg.externalId && sc && (
                                                                                    <button
                                                                                        className={cn(
                                                                                            'text-[10px] font-semibold transition-colors',
                                                                                            paneLikedIds.has(msg.externalId)
                                                                                                ? 'text-blue-500'
                                                                                                : 'text-muted-foreground hover:text-blue-500'
                                                                                        )}
                                                                                        onClick={async () => {
                                                                                            if (paneLikedIds.has(msg.externalId!)) return
                                                                                            try {
                                                                                                const res = await fetch(`/api/inbox/conversations/${sc.id}/like`, {
                                                                                                    method: 'POST',
                                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                                    body: JSON.stringify({ commentExternalId: msg.externalId }),
                                                                                                })
                                                                                                if (res.ok) {
                                                                                                    updatePanel(paneIdx, { likedCommentIds: new Set([...paneLikedIds, msg.externalId!]) })
                                                                                                    toast.success(t('inbox.toast.liked'))
                                                                                                } else {
                                                                                                    const data = await res.json()
                                                                                                    toast.error(data.error || t('inbox.toast.likeFailed'))
                                                                                                }
                                                                                            } catch {
                                                                                                toast.error(t('inbox.toast.likeFailed'))
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        {paneLikedIds.has(msg.externalId) ? '💙 Liked' : '👍 Like'}
                                                                                    </button>
                                                                                )}
                                                                                {msg.direction === 'inbound' && msg.externalId && sc.type === 'comment' && (
                                                                                    <button
                                                                                        className="text-[10px] font-semibold text-muted-foreground hover:text-purple-500 transition-colors"
                                                                                        onClick={async () => {
                                                                                            const privateMsg = prompt('Send a private DM to this commenter:')
                                                                                            if (!privateMsg?.trim()) return
                                                                                            try {
                                                                                                const res = await fetch(`/api/inbox/conversations/${sc.id}/private-reply`, {
                                                                                                    method: 'POST',
                                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                                    body: JSON.stringify({ commentExternalId: msg.externalId, message: privateMsg.trim() }),
                                                                                                })
                                                                                                if (res.ok) {
                                                                                                    toast.success(t('inbox.toast.privateReplySent'))
                                                                                                    fetchMessages(sc.id, paneIdx)
                                                                                                } else {
                                                                                                    const data = await res.json()
                                                                                                    toast.error(data.error || t('inbox.toast.privateReplyFailed'))
                                                                                                }
                                                                                            } catch {
                                                                                                toast.error(t('inbox.toast.privateReplyFailed'))
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        📩 Private Reply
                                                                                    </button>
                                                                                )}
                                                                                {msg.direction === 'inbound' && (
                                                                                    <button
                                                                                        className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                                                                        onClick={async () => {
                                                                                            if (sc.mode === 'BOT') {
                                                                                                await updateConversation(sc.id, { action: 'takeover' }, paneIdx)
                                                                                                updatePanel(paneIdx, { conversation: { ...sc, mode: 'AGENT' as const } })
                                                                                            }
                                                                                            setActivePanel(paneIdx)
                                                                                            updatePanel(paneIdx, { replyToName: senderName, replyText: `@[${senderName}] ` })
                                                                                            setTimeout(() => {
                                                                                                const textarea = document.querySelector('textarea')
                                                                                                if (textarea) {
                                                                                                    textarea.focus()
                                                                                                    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
                                                                                                }
                                                                                            }, 50)
                                                                                        }}
                                                                                    >
                                                                                        Reply
                                                                                    </button>
                                                                                )}
                                                                                <span className="text-[10px] text-muted-foreground/60">
                                                                                    {timeAgo(msg.sentAt, t)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                        <div ref={el => { messagesEndRefs.current[paneIdx] = el }} />
                                                    </div>
                                                ) : (
                                                    /* ═══ Normal DM-style chat ═══ */
                                                    <div className="space-y-3">
                                                        {paneMsgs.map((msg: InboxMessage) => (
                                                            <div
                                                                key={msg.id}
                                                                className={cn(
                                                                    'flex gap-2 group',
                                                                    msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                                                                )}
                                                            >
                                                                {msg.direction === 'inbound' && (
                                                                    <Avatar className="h-7 w-7 shrink-0 mt-1">
                                                                        {sc.externalUserAvatar && (
                                                                            <AvatarImage src={sc.externalUserAvatar} alt={sc.externalUserName || ''} />
                                                                        )}
                                                                        <AvatarFallback className="text-[10px] bg-gray-100 dark:bg-gray-800">
                                                                            {sc.externalUserName?.charAt(0)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                )}
                                                                <div className={cn(
                                                                    'max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                                                                    msg.direction === 'outbound'
                                                                        ? msg.senderType === 'bot'
                                                                            ? 'bg-muted text-foreground'
                                                                            : 'bg-muted text-foreground'
                                                                        : 'bg-muted'
                                                                )}>
                                                                    {msg.senderType === 'bot' && (
                                                                        <div className="flex items-center gap-1 mb-1.5 text-green-600 dark:text-green-400 text-[10px] font-medium">
                                                                            {botAvatarByChannel[sc.channelId] ? (
                                                                                <img src={botAvatarByChannel[sc.channelId]!} alt="bot" className="h-4 w-4 rounded-full object-cover" />
                                                                            ) : (
                                                                                <Bot className="h-3 w-3" />
                                                                            )}
                                                                            AI Bot
                                                                            {msg.confidence != null && (
                                                                                <span className="text-muted-foreground">
                                                                                    · {Math.round(msg.confidence * 100)}%
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {/* --- Attachment renderers --- */}
                                                                    {msg.mediaUrl && msg.mediaType === 'image' && (
                                                                        <img
                                                                            src={msg.mediaUrl}
                                                                            alt="Attached image"
                                                                            className="max-w-[200px] rounded-lg mb-1.5"
                                                                        />
                                                                    )}
                                                                    {msg.mediaUrl && msg.mediaType === 'audio' && (
                                                                        <div className="mb-1.5 min-w-[200px]">
                                                                            <audio controls src={msg.mediaUrl} className="w-full h-8" style={{ colorScheme: 'dark' }} />
                                                                        </div>
                                                                    )}
                                                                    {msg.mediaUrl && msg.mediaType === 'video' && (
                                                                        <div className="mb-1.5 max-w-[260px]">
                                                                            <video controls src={msg.mediaUrl} className="rounded-lg w-full" />
                                                                        </div>
                                                                    )}
                                                                    {msg.mediaUrl && !['image', 'audio', 'video'].includes(msg.mediaType || '') && (
                                                                        <a
                                                                            href={msg.mediaUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-1.5 mb-1.5 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] underline"
                                                                        >
                                                                            📎 {msg.mediaType ? `File (${msg.mediaType})` : 'Attachment'}
                                                                        </a>
                                                                    )}
                                                                    {/* Only show text if it's not just the [Attachment] placeholder */}
                                                                    {(!msg.mediaUrl || msg.content !== '[Attachment]') && (
                                                                        <div className={cn(
                                                                            'whitespace-pre-wrap',
                                                                            msg.direction === 'outbound' && msg.senderType === 'agent' && 'text-foreground dark:text-green-400'
                                                                        )}>{msg.content}</div>
                                                                    )}
                                                                    <div className={cn(
                                                                        'text-[9px] mt-1.5',
                                                                        msg.direction === 'outbound' && msg.senderType !== 'bot'
                                                                            ? 'text-muted-foreground dark:text-green-500'
                                                                            : 'text-muted-foreground'
                                                                    )}>
                                                                        {new Date(msg.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </div>
                                                                {msg.direction === 'outbound' && msg.senderType === 'agent' && (
                                                                    <Avatar className="h-7 w-7 shrink-0 mt-1">
                                                                        <AvatarFallback className="text-[10px] bg-primary/10">
                                                                            A
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                )}
                                                                {/* Hover action buttons: Reply + Reactions */}
                                                                {msg.direction === 'inbound' && (
                                                                    <div className="flex flex-col justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        {/* Reply button */}
                                                                        <button
                                                                            title="Reply"
                                                                            onClick={() => updatePanel(paneIdx, {
                                                                                replyToName: sc.externalUserName || 'Customer',
                                                                                replyToMsgId: msg.externalId || null,
                                                                                replyToContent: msg.content,
                                                                            })}
                                                                            className="flex items-center justify-center h-6 w-6 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground text-sm"
                                                                        >
                                                                            ↩
                                                                        </button>
                                                                        {/* Reaction picker – click-based, stable */}
                                                                        {msg.externalId && (
                                                                            <div className="relative">
                                                                                <button
                                                                                    title="React"
                                                                                    onClick={e => { e.stopPropagation(); setOpenReactMsgId(v => v === msg.id ? null : msg.id) }}
                                                                                    className="flex items-center justify-center h-6 w-6 rounded-full bg-muted hover:bg-accent text-muted-foreground text-sm"
                                                                                >
                                                                                    😊
                                                                                </button>
                                                                                {openReactMsgId === msg.id && (
                                                                                    <div
                                                                                        className="absolute left-7 top-0 flex items-center gap-0.5 bg-popover border rounded-full px-2 py-1.5 shadow-xl z-50"
                                                                                        onClick={e => e.stopPropagation()}
                                                                                    >
                                                                                        {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                                                                                            <button
                                                                                                key={emoji}
                                                                                                onClick={async () => {
                                                                                                    setOpenReactMsgId(null)
                                                                                                    await fetch(`/api/inbox/conversations/${sc?.id}/react`, {
                                                                                                        method: 'POST',
                                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                                        body: JSON.stringify({ externalId: msg.externalId, emoji }),
                                                                                                    })
                                                                                                }}
                                                                                                className="text-lg hover:scale-125 transition-transform px-0.5"
                                                                                            >
                                                                                                {emoji}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                )}
                                                                {msg.direction === 'outbound' && (
                                                                    <div className="flex flex-col justify-center mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            title="Reply"
                                                                            onClick={() => updatePanel(paneIdx, {
                                                                                replyToName: 'Agent',
                                                                                replyToMsgId: msg.externalId || null,
                                                                                replyToContent: msg.content,
                                                                            })}
                                                                            className="flex items-center justify-center h-6 w-6 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground text-sm"
                                                                        >
                                                                            ↩
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <div ref={el => { messagesEndRefs.current[paneIdx] = el }} />
                                                    </div>
                                                )}
                                            </ScrollArea>

                                            {/* Reply box */}
                                            <div className="border-t bg-card p-3 shrink-0">
                                                {/* Reply-to quoted message indicator */}
                                                {paneReplyToName && (
                                                    <div className="mb-2 rounded-lg border-l-2 border-primary bg-muted/60 px-2 py-1.5 flex items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[10px] font-semibold text-primary mb-0.5">{paneReplyToName}</div>
                                                            <div className="text-[11px] text-muted-foreground truncate">
                                                                {paneReplyToContent ? paneReplyToContent.replace(/^\[Attachment\]$/, '📎 Attachment').substring(0, 80) : '...'}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => updatePanel(paneIdx, { replyToName: null, replyToMsgId: null, replyToContent: null })}
                                                            className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Image preview */}
                                                {paneSelectedImage && (
                                                    <div className="relative inline-block mb-2">
                                                        <img src={URL.createObjectURL(paneSelectedImage)} alt="Preview" className="h-20 rounded-lg border object-cover" />
                                                        <button
                                                            onClick={() => updatePanel(paneIdx, { selectedImage: null })}
                                                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] font-bold hover:scale-110 transition-transform"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="flex flex-col gap-2">
                                                    {/* Textarea with drag-drop */}
                                                    <div
                                                        className="relative"
                                                        onDragOver={(e) => { e.preventDefault(); updatePanel(paneIdx, { dragOver: true }) }}
                                                        onDragLeave={() => updatePanel(paneIdx, { dragOver: false })}
                                                        onDrop={(e) => {
                                                            e.preventDefault()
                                                            updatePanel(paneIdx, { dragOver: false })
                                                            const file = e.dataTransfer.files?.[0]
                                                            if (file && file.type.startsWith('image/')) {
                                                                updatePanel(paneIdx, { selectedImage: file })
                                                            } else if (file) {
                                                                toast.error(t('inbox.toast.onlyImages'))
                                                            }
                                                        }}
                                                    >
                                                        {paneDragOver && (
                                                            <div className="absolute inset-0 z-10 rounded-xl border-2 border-dashed border-primary bg-primary/5 flex items-center justify-center pointer-events-none">
                                                                <span className="text-xs font-medium text-primary">{t('inbox.chat.dropImageHere')}</span>
                                                            </div>
                                                        )}
                                                        <textarea
                                                            data-reply-input={isActive ? 'true' : undefined}
                                                            value={paneReplyText}
                                                            onChange={e => updatePanel(paneIdx, { replyText: e.target.value })}
                                                            onFocus={() => { if (paneIdx !== activePanel) setActivePanel(paneIdx) }}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault()
                                                                    handleSendReply(paneIdx)
                                                                }
                                                            }}
                                                            placeholder={sc.mode === 'BOT' ? t('inbox.chat.takeOverToReply') : t('inbox.chat.typeReply')}
                                                            disabled={sc.mode === 'BOT'}
                                                            rows={panelLayout === 4 ? 1 : 2}
                                                            className="w-full resize-none rounded-xl border bg-background px-3.5 py-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </div>

                                                    {/* Toolbar */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-0.5">
                                                            {/* Emoji picker */}
                                                            <div className="relative">
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                                    disabled={sc.mode === 'BOT'}
                                                                    title={t('inbox.chat.emoji')}
                                                                    onClick={() => updatePanel(paneIdx, { showEmojiPicker: !paneShowEmojiPicker })}
                                                                >
                                                                    <Smile className="h-4 w-4" />
                                                                </Button>
                                                                {paneShowEmojiPicker && (
                                                                    <div className="absolute bottom-full left-0 mb-1 bg-popover border rounded-xl shadow-xl p-2 z-50 w-[260px]">
                                                                        <div className="grid grid-cols-8 gap-0.5">
                                                                            {['😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '😢', '😡', '🙏', '👍', '👎', '❤️', '🔥', '🎉', '✅', '⭐', '💯', '👏', '🤝', '😘', '🥺', '😭', '🤩', '😤', '💪', '🙌', '💀', '🤣', '😅', '🫶', '💕', '💖', '😱', '🤗', '😏', '🤭', '😬', '🥳', '🎊', '💐', '🌟', '⚡', '💡', '📌', '📣', '🏠', '🛎️'].map(emoji => (
                                                                                <button
                                                                                    key={emoji}
                                                                                    className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-md transition-colors text-base"
                                                                                    onClick={() => {
                                                                                        updatePanel(paneIdx, { replyText: paneReplyText + emoji, showEmojiPicker: false })
                                                                                    }}
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Image upload */}
                                                            <label className={cn(
                                                                'flex items-center justify-center h-7 w-7 rounded-md cursor-pointer text-muted-foreground hover:text-foreground hover:bg-primary/8 transition-colors',
                                                                sc.mode === 'BOT' && 'opacity-50 pointer-events-none'
                                                            )} title={t('inbox.chat.uploadImage')}>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    disabled={sc.mode === 'BOT'}
                                                                    onChange={e => {
                                                                        const file = e.target.files?.[0]
                                                                        if (file) updatePanel(paneIdx, { selectedImage: file })
                                                                        e.target.value = ''
                                                                    }}
                                                                />
                                                            </label>

                                                            <div className="w-px h-4 bg-border mx-0.5" />

                                                            {/* AI Suggest */}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 px-2 gap-1 text-muted-foreground hover:text-amber-500 text-[11px]"
                                                                disabled={sc.mode === 'BOT' || paneAiSuggesting}
                                                                title={t('inbox.chat.aiSuggestReply')}
                                                                onClick={async () => {
                                                                    updatePanel(paneIdx, { aiSuggesting: true })
                                                                    try {
                                                                        const res = await fetch(`/api/inbox/conversations/${sc.id}/suggest`, { method: 'POST' })
                                                                        if (res.ok) {
                                                                            const data = await res.json()
                                                                            updatePanel(paneIdx, { replyText: data.suggestion })
                                                                            toast.success(t('inbox.toast.aiSuggestionReady'))
                                                                        } else {
                                                                            const data = await res.json()
                                                                            toast.error(data.error || t('inbox.toast.aiSuggestFailed'))
                                                                        }
                                                                    } catch {
                                                                        toast.error(t('inbox.toast.aiSuggestFailed'))
                                                                    } finally {
                                                                        updatePanel(paneIdx, { aiSuggesting: false })
                                                                    }
                                                                }}
                                                            >
                                                                {paneAiSuggesting ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Sparkles className="h-3.5 w-3.5" />
                                                                )}
                                                                AI
                                                            </Button>

                                                            <div className="w-px h-4 bg-border mx-0.5" />

                                                            {/* Bot / Agent transfer */}
                                                            {sc.mode === 'BOT' ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 px-2 gap-1 text-[11px] text-muted-foreground hover:text-blue-500"
                                                                    disabled={updatingConv}
                                                                    onClick={() => updateConversation(sc.id, { action: 'takeover' }, paneIdx)}
                                                                    title={t('inbox.chat.takeOverFromBot')}
                                                                >
                                                                    <UserCircle className="h-3.5 w-3.5" />
                                                                    Agent
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 px-2 gap-1 text-[11px] text-muted-foreground hover:text-green-500"
                                                                    disabled={updatingConv}
                                                                    onClick={() => updateConversation(sc.id, { action: 'transfer_bot' }, paneIdx)}
                                                                    title={t('inbox.chat.transferToBotTitle')}
                                                                >
                                                                    <Bot className="h-3.5 w-3.5" />
                                                                    Bot
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* Send button */}
                                                        <Button
                                                            size="sm"
                                                            className="h-7 px-3 gap-1.5 text-xs"
                                                            disabled={sc.mode === 'BOT' || (!paneReplyText.trim() && !paneSelectedImage)}
                                                            onClick={() => handleSendReply(paneIdx)}
                                                        >
                                                            <Send className="h-3.5 w-3.5" />
                                                            {t('inbox.chat.send')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()
                            ) : (
                                /* Empty pane state */
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <MessageSquare className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                                        {panelLayout > 1 ? (
                                            <>
                                                <p className="text-xs text-muted-foreground font-medium">
                                                    Panel {paneIdx + 1}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                                    {isActive ? 'Select a conversation from the list' : 'Click here then select a conversation'}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <h3 className="text-sm font-medium text-foreground mb-1">{t('inbox.emptyState.selectConversation')}</h3>
                                                <p className="text-xs text-muted-foreground">{t('inbox.emptyState.selectConversationDesc')}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
