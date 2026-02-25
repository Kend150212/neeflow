'use client'

import { useTranslation } from '@/lib/i18n'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
    Save, Plus, Trash2, Loader2, Bot,
    MessageSquare, Brain, Shield, Clock, Target,
    Image as ImageIcon, Video, HelpCircle, FileText,
    Link as LinkIcon, FileSpreadsheet, ExternalLink,
    Upload, FolderOpen, X, Check, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'

// ─── Types ──────────────────────────────────────────────
interface MediaItem {
    id: string; url: string; thumbnailUrl?: string | null
    originalName?: string | null; type: string
}
interface KnowledgeEntry {
    id: string; title: string; sourceType: string; sourceUrl?: string | null
    content: string; createdAt: string
}
interface BotConfigData {
    isEnabled: boolean
    botName: string
    greeting: string
    greetingMode: 'template' | 'auto'
    greetingImages: string[]
    personality: string
    language: string
    imageFolderId: string | null
    consultVideos: { title: string; url: string; description: string }[]
    confidenceThreshold: number
    maxBotReplies: number
    autoTagEnabled: boolean
    sentimentEnabled: boolean
    spamFilterEnabled: boolean
    autoTranslate: boolean
    smartAssignEnabled: boolean
    autoEscalateKeywords: string[]
    forbiddenTopics: string[]
    workingHoursOnly: boolean
    workingHoursStart: string | null
    workingHoursEnd: string | null
    workingDays: Record<string, { enabled: boolean; start: string; end: string }>
    offHoursMessage: string | null
    trainingPairs: { q: string; a: string; images?: string[] }[]
    exampleConvos: string[]
    enabledPlatforms: string[]
    applyToComments: boolean
    applyToMessages: boolean
    commentReplyMinDelay: number
    commentReplyMaxDelay: number
}

interface ChatBotTabProps {
    channelId: string
}

export default function ChatBotTab({ channelId }: ChatBotTabProps) {
    const t = useTranslation()
    const [config, setConfig] = useState<BotConfigData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Training inputs
    const [newTrainingText, setNewTrainingText] = useState('')
    const [newTrainingImages, setNewTrainingImages] = useState<string[]>([])
    const [newTrainingUrl, setNewTrainingUrl] = useState('')
    const [newQaPair, setNewQaPair] = useState({ q: '', a: '' })
    const [newVideoTitle, setNewVideoTitle] = useState('')
    const [newVideoUrl, setNewVideoUrl] = useState('')
    const [newVideoDesc, setNewVideoDesc] = useState('')
    const [newEscalateKeyword, setNewEscalateKeyword] = useState('')
    const [newForbiddenTopic, setNewForbiddenTopic] = useState('')

    // Media state
    const [uploading, setUploading] = useState(false)
    const [mediaBrowserTarget, setMediaBrowserTarget] = useState<'greeting' | 'training' | 'library' | 'video' | null>(null)
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
    const [mediaLoading, setMediaLoading] = useState(false)
    const [botFolderId, setBotFolderId] = useState<string | null>(null)
    const [libraryImages, setLibraryImages] = useState<MediaItem[]>([])
    const greetingDropRef = useRef<HTMLDivElement>(null)
    const trainingDropRef = useRef<HTMLDivElement>(null)
    const libraryDropRef = useRef<HTMLDivElement>(null)
    const videoDropRef = useRef<HTMLDivElement>(null)
    const [dragOver, setDragOver] = useState<string | null>(null)
    const [generatingQa, setGeneratingQa] = useState(false)

    // Knowledge base entries
    const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([])

    // Tab navigation
    const [botTab, setBotTab] = useState<'general' | 'training' | 'behavior' | 'escalation' | 'hours' | 'scope'>('general')
    const [trainingSubTab, setTrainingSubTab] = useState<'saved' | 'text' | 'url' | 'sheet' | 'images' | 'video' | 'qa'>('saved')

    // Per-page bot toggle
    const [pageAccounts, setPageAccounts] = useState<{ id: string; accountName: string; platform: string; botEnabled: boolean }[]>([])

    // ─── Upload helper ────────────────────────────────────
    const uploadFiles = async (files: FileList | File[], targetFolderId?: string): Promise<string[]> => {
        const urls: string[] = []
        setUploading(true)
        for (const file of Array.from(files)) {
            try {
                const formData = new FormData()
                formData.append('file', file)
                formData.append('channelId', channelId)
                if (targetFolderId) formData.append('folderId', targetFolderId)
                const res = await fetch('/api/admin/media', { method: 'POST', body: formData })
                if (res.ok) {
                    const data = await res.json()
                    urls.push(data.url || data.media?.url)
                } else {
                    const data = await res.json().catch(() => ({}))
                    if (res.status === 403 && data.code === 'GDRIVE_NOT_CONNECTED') {
                        toast.error('Chưa kết nối Google Drive', {
                            description: 'Vào Settings → API Keys để kết nối.',
                            action: { label: 'Kết nối', onClick: () => window.location.href = '/dashboard/api-keys' },
                        })
                        break
                    }
                    toast.error(`Upload failed: ${file.name}`)
                }
            } catch { toast.error(`Upload error: ${file.name}`) }
        }
        setUploading(false)
        return urls
    }

    // ─── Ensure bot media folder exists ───────────────────
    const ensureBotFolder = useCallback(async (): Promise<string | null> => {
        if (botFolderId) return botFolderId
        try {
            // Check if "ChatBot" folder exists
            const listRes = await fetch(`/api/admin/media/folders?channelId=${channelId}`)
            if (listRes.ok) {
                const { folders } = await listRes.json()
                const existing = folders.find((f: any) => f.name === 'ChatBot')
                if (existing) { setBotFolderId(existing.id); return existing.id }
            }
            // Create it
            const createRes = await fetch('/api/admin/media/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, name: 'ChatBot' }),
            })
            if (createRes.ok) {
                const { folder } = await createRes.json()
                setBotFolderId(folder.id)
                return folder.id
            }
        } catch { }
        return null
    }, [channelId, botFolderId])

    // ─── Load media browser items ─────────────────────────
    const loadMediaItems = useCallback(async (mediaType: 'image' | 'video' = 'image', folderId?: string) => {
        setMediaLoading(true)
        try {
            const params = new URLSearchParams({ channelId, type: mediaType })
            if (folderId) params.set('folderId', folderId)
            const res = await fetch(`/api/admin/media?${params}`)
            if (res.ok) {
                const data = await res.json()
                setMediaItems(data.media || data.items || [])
            }
        } catch { }
        setMediaLoading(false)
    }, [channelId])

    // ─── Load library images ──────────────────────────────
    const loadLibraryImages = useCallback(async () => {
        if (!config?.imageFolderId) return
        try {
            const params = new URLSearchParams({ channelId, type: 'image', folderId: config.imageFolderId })
            const res = await fetch(`/api/admin/media?${params}`)
            if (res.ok) {
                const data = await res.json()
                setLibraryImages(data.media || data.items || [])
            }
        } catch { }
    }, [channelId, config?.imageFolderId])

    // ─── Drag & drop handler factory ──────────────────────
    const makeDragHandlers = (zone: string, onDrop: (files: FileList) => void) => ({
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(zone) },
        onDragLeave: () => setDragOver(null),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault(); setDragOver(null)
            if (e.dataTransfer.files.length) onDrop(e.dataTransfer.files)
        },
    })

    // ─── Fetch config ─────────────────────────────────────
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`/api/admin/channels/${channelId}/bot-config`)
                if (res.ok) {
                    const data = await res.json()
                    setConfig({
                        isEnabled: data.isEnabled ?? true,
                        botName: data.botName || 'AI Assistant',
                        greeting: data.greeting || '',
                        greetingMode: data.greetingMode || 'template',
                        greetingImages: data.greetingImages || [],
                        personality: data.personality || '',
                        language: data.language || 'vi',
                        imageFolderId: data.imageFolderId || null,
                        consultVideos: data.consultVideos || [],
                        confidenceThreshold: data.confidenceThreshold ?? 0.7,
                        maxBotReplies: data.maxBotReplies ?? 10,
                        autoTagEnabled: data.autoTagEnabled ?? true,
                        sentimentEnabled: data.sentimentEnabled ?? true,
                        spamFilterEnabled: data.spamFilterEnabled ?? true,
                        autoTranslate: data.autoTranslate ?? false,
                        smartAssignEnabled: data.smartAssignEnabled ?? false,
                        autoEscalateKeywords: data.autoEscalateKeywords || [],
                        forbiddenTopics: data.forbiddenTopics || [],
                        workingHoursOnly: data.workingHoursOnly ?? false,
                        workingHoursStart: data.workingHoursStart || null,
                        workingHoursEnd: data.workingHoursEnd || null,
                        workingDays: data.workingDays || {
                            mon: { enabled: true, start: '08:00', end: '22:00' },
                            tue: { enabled: true, start: '08:00', end: '22:00' },
                            wed: { enabled: true, start: '08:00', end: '22:00' },
                            thu: { enabled: true, start: '08:00', end: '22:00' },
                            fri: { enabled: true, start: '08:00', end: '22:00' },
                            sat: { enabled: false, start: '08:00', end: '22:00' },
                            sun: { enabled: false, start: '08:00', end: '22:00' },
                        },
                        offHoursMessage: data.offHoursMessage || null,
                        trainingPairs: data.trainingPairs || [],
                        exampleConvos: data.exampleConvos || [],
                        enabledPlatforms: data.enabledPlatforms || ['all'],
                        applyToComments: data.applyToComments ?? true,
                        applyToMessages: data.applyToMessages ?? true,
                        commentReplyMinDelay: data.commentReplyMinDelay ?? 30,
                        commentReplyMaxDelay: data.commentReplyMaxDelay ?? 600,
                    })
                }
            } catch { /* ignore */ }

            // Fetch connected pages for per-page bot toggles
            try {
                const pagesRes = await fetch(`/api/admin/channels/${channelId}/platforms`)
                if (pagesRes.ok) {
                    const pagesData = await pagesRes.json()
                    setPageAccounts((pagesData || []).map((p: any) => ({
                        id: p.id,
                        accountName: p.accountName,
                        platform: p.platform,
                        botEnabled: (p.config as any)?.botEnabled === true,
                    })))
                }
            } catch { /* ignore */ }

            // Fetch knowledge base entries
            try {
                const kbRes = await fetch(`/api/admin/channels/${channelId}/knowledge`)
                if (kbRes.ok) {
                    const kbData = await kbRes.json()
                    setKnowledgeEntries(kbData || [])
                }
            } catch { /* ignore */ }

            setLoading(false)
        }
        fetchConfig()
    }, [channelId])

    // ─── Save config ──────────────────────────────────────
    const saveConfig = useCallback(async () => {
        if (!config) return
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/bot-config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            })
            if (res.ok) {
                toast.success('Bot settings saved!')
            } else {
                toast.error('Failed to save bot settings')
            }
        } catch {
            toast.error('Network error')
        } finally {
            setSaving(false)
        }
    }, [channelId, config])

    // ─── Helper to update config ──────────────────────────
    const update = <K extends keyof BotConfigData>(key: K, value: BotConfigData[K]) => {
        setConfig(prev => prev ? { ...prev, [key]: value } : prev)
    }

    // ─── Add training via Knowledge Base API ──────────────
    const refreshKnowledgeEntries = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/knowledge`)
            if (res.ok) {
                const data = await res.json()
                setKnowledgeEntries(data || [])
            }
        } catch { /* ignore */ }
    }, [channelId])

    const addKnowledgeEntry = async (title: string, content: string, sourceType: string, sourceUrl?: string) => {
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/knowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    content,
                    sourceType,
                    sourceUrl: sourceUrl || null,
                }),
            })
            if (res.ok) {
                toast.success(`Training data added: ${title}`)
                refreshKnowledgeEntries()
            } else {
                toast.error('Failed to add training data')
            }
        } catch {
            toast.error('Network error')
        }
    }

    const deleteKnowledgeEntry = async (entryId: string) => {
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/knowledge?entryId=${entryId}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                setKnowledgeEntries(prev => prev.filter(e => e.id !== entryId))
                toast.success('Training entry deleted')
            } else {
                toast.error('Failed to delete')
            }
        } catch {
            toast.error('Network error')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!config) return null

    return (
        <div className="space-y-4">
            {/* ─── Header with Save ─────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-primary" />
                    <div>
                        <h3 className="font-semibold">{t('chatbot.title')}</h3>
                        <p className="text-xs text-muted-foreground">{t('chatbot.subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="bot-enable" className="text-sm">{t('chatbot.enableBot')}</Label>
                        <Switch
                            id="bot-enable"
                            checked={config.isEnabled}
                            onCheckedChange={v => update('isEnabled', v)}
                        />
                    </div>
                    <Button onClick={saveConfig} disabled={saving} size="sm">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                        {t('chatbot.save')}
                    </Button>
                </div>
            </div>

            {!config.isEnabled && (
                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
                    <CardContent className="py-3">
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            ⚠️ {t('chatbot.botDisabled')}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Per-page bot toggles */}
            {config.isEnabled && pageAccounts.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Target className="h-4 w-4 text-blue-500" />
                            {t('chatbot.perPageBotTitle') || 'Bot per Page'}
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {t('chatbot.perPageBotDesc') || 'Enable or disable the bot for each connected page'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {pageAccounts.map(page => (
                            <div key={page.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40">
                                <div className="flex items-center gap-2 min-w-0">
                                    {page.platform === 'facebook' ? (
                                        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#1877F2" /><path d="M16.5 12.05h-2.7V18h-2.93v-5.95H9.5v-2.5h1.37V7.88c0-1.97.84-3.13 3.17-3.13h1.95v2.5h-1.22c-.91 0-.97.34-.97.97v1.33h2.22l-.52 2.5z" fill="#fff" /></svg>
                                    ) : page.platform === 'instagram' ? (
                                        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><defs><linearGradient id={`ig-${page.id}`} x1="0" y1="24" x2="24" y2="0"><stop offset="0%" stopColor="#FED373" /><stop offset="25%" stopColor="#F15245" /><stop offset="50%" stopColor="#D92E7F" /><stop offset="75%" stopColor="#9B36B7" /><stop offset="100%" stopColor="#515ECF" /></linearGradient></defs><circle cx="12" cy="12" r="12" fill={`url(#ig-${page.id})`} /><rect x="5" y="5" width="14" height="14" rx="4" stroke="#fff" strokeWidth="1.5" fill="none" /><circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.5" fill="none" /><circle cx="16.5" cy="7.5" r="1" fill="#fff" /></svg>
                                    ) : page.platform === 'tiktok' ? (
                                        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#000" /><path d="M16.5 7.5a3.5 3.5 0 01-2.5-1V13a4 4 0 11-4-4v2a2 2 0 102 2V5h2a3.5 3.5 0 002.5 2.5z" fill="#fff" /></svg>
                                    ) : page.platform === 'youtube' ? (
                                        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#FF0000" /><path d="M10 15.5v-7l6 3.5-6 3.5z" fill="#fff" /></svg>
                                    ) : page.platform === 'x' || page.platform === 'twitter' ? (
                                        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#000" /><path d="M13.8 10.5L18 6h-1.3l-3.6 3.9L10 6H6l4.4 6.4L6 17h1.3l3.8-4.1L14.3 17H18l-4.2-6.5zm-1.3 1.5l-.5-.6L8 7h1.5l3 4.2.5.6L17 16h-1.5l-3-4z" fill="#fff" /></svg>
                                    ) : page.platform === 'linkedin' ? (
                                        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#0A66C2" /><path d="M8.5 10v6h-2v-6h2zm-1-3.2a1.15 1.15 0 110 2.3 1.15 1.15 0 010-2.3zM10 10h1.9v.8a2.1 2.1 0 011.9-1c2 0 2.4 1.3 2.4 3.1V16h-2v-2.8c0-.7 0-1.6-1-1.6s-1.1.7-1.1 1.5V16H10v-6z" fill="#fff" /></svg>
                                    ) : page.platform === 'pinterest' ? (
                                        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#E60023" /><path d="M12 5a7 7 0 00-2.6 13.5c0-.6.1-1.5.3-2.2l.8-3.3s-.2-.4-.2-1c0-1 .6-1.7 1.3-1.7.6 0 .9.5.9 1 0 .6-.4 1.5-.6 2.4-.2.7.3 1.3 1 1.3 1.3 0 2.3-1.4 2.3-3.3 0-1.7-1.2-3-3-3-2 0-3.3 1.5-3.3 3.2 0 .6.2 1.3.5 1.6.1 0 .1.1.1.2l-.2.7c0 .1-.1.2-.3.1-1-.5-1.6-1.9-1.6-3 0-2.5 1.8-4.8 5.2-4.8 2.7 0 4.8 1.9 4.8 4.5 0 2.7-1.7 4.9-4.1 4.9-.8 0-1.5-.4-1.8-.9l-.5 1.9c-.2.7-.7 1.5-1 2A7 7 0 0012 5z" fill="#fff" /></svg>
                                    ) : (
                                        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#666" /><path d="M12 7a2 2 0 00-2 2v2H8v3h2v6h3v-6h2l.5-3H13V9.5a.5.5 0 01.5-.5H15V7h-3z" fill="#fff" /></svg>
                                    )}
                                    <span className="text-sm truncate">{page.accountName}</span>
                                </div>
                                <Switch
                                    checked={page.botEnabled}
                                    onCheckedChange={async (v) => {
                                        setPageAccounts(prev => prev.map(p =>
                                            p.id === page.id ? { ...p, botEnabled: v } : p
                                        ))
                                        try {
                                            await fetch(`/api/admin/channels/${channelId}/platforms/${page.id}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ botEnabled: v }),
                                            })
                                            toast.success(v ? `Bot enabled for ${page.accountName}` : `Bot disabled for ${page.accountName}`)
                                        } catch {
                                            toast.error('Failed to update')
                                            setPageAccounts(prev => prev.map(p =>
                                                p.id === page.id ? { ...p, botEnabled: !v } : p
                                            ))
                                        }
                                    }}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* ─── Tab Navigation ───────────────────── */}
            <div className="flex items-center gap-1 border-b pb-0 mb-4 overflow-x-auto">
                {[
                    { key: 'general' as const, icon: MessageSquare, label: t('chatbot.general.title'), color: 'text-blue-500' },
                    { key: 'training' as const, icon: Brain, label: t('chatbot.training.title'), color: 'text-purple-500' },
                    { key: 'behavior' as const, icon: Target, label: t('chatbot.behavior.title'), color: 'text-cyan-500' },
                    { key: 'escalation' as const, icon: Shield, label: t('chatbot.escalation.title'), color: 'text-red-500' },
                    { key: 'hours' as const, icon: Clock, label: t('chatbot.hours.title'), color: 'text-amber-500' },
                    { key: 'scope' as const, icon: Target, label: t('chatbot.scope.title'), color: 'text-teal-500' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setBotTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap
                            ${botTab === tab.key
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                    >
                        <tab.icon className={`h-3.5 w-3.5 ${botTab === tab.key ? tab.color : ''}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── GENERAL TAB ───────────────────────── */}
            {botTab === 'general' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs">{t('chatbot.general.botName')}</Label>
                            <Input
                                value={config.botName}
                                onChange={e => update('botName', e.target.value)}
                                placeholder="AI Assistant"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">{t('chatbot.general.language')}</Label>
                            <select
                                value={config.language}
                                onChange={e => update('language', e.target.value)}
                                className="w-full mt-1 h-9 px-3 text-sm rounded-md border border-input bg-background"
                            >
                                <option value="vi">Tiếng Việt</option>
                                <option value="en">English</option>
                                <option value="fr">Français</option>
                                <option value="ja">日本語</option>
                                <option value="ko">한국어</option>
                                <option value="zh">中文</option>
                            </select>
                        </div>
                    </div>
                    {/* Greeting Mode Toggle */}
                    <div>
                        <Label className="text-xs">{t('chatbot.general.greetingMode')}</Label>
                        <div className="flex gap-2 mt-1">
                            <Button size="sm" variant={config.greetingMode === 'template' ? 'default' : 'outline'}
                                onClick={() => update('greetingMode', 'template')} className="text-xs gap-1">
                                <MessageSquare className="h-3 w-3" /> {t('chatbot.general.modeTemplate')}
                            </Button>
                            <Button size="sm" variant={config.greetingMode === 'auto' ? 'default' : 'outline'}
                                onClick={() => update('greetingMode', 'auto')} className="text-xs gap-1">
                                <Sparkles className="h-3 w-3" /> {t('chatbot.general.modeAuto')}
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {config.greetingMode === 'template'
                                ? t('chatbot.general.modeTemplateDesc')
                                : t('chatbot.general.modeAutoDesc')}
                        </p>
                    </div>

                    {config.greetingMode === 'template' && (
                        <div>
                            <Label className="text-xs">{t('chatbot.general.greetingMessage')}</Label>
                            <Textarea
                                value={config.greeting}
                                onChange={e => update('greeting', e.target.value)}
                                placeholder={t('chatbot.general.greetingPlaceholder')}
                                rows={3} className="mt-1"
                            />
                        </div>
                    )}

                    {/* Greeting Images — Drag & Drop + Media Browse */}
                    <div>
                        <Label className="text-xs flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" /> {t('chatbot.general.greetingImages')}
                        </Label>
                        {config.greetingImages.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {config.greetingImages.map((url, i) => (
                                    <div key={i} className="relative group">
                                        <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                                        <button
                                            className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => update('greetingImages', config.greetingImages.filter((_, j) => j !== i))}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div
                            ref={greetingDropRef}
                            className={`mt-2 border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
                                ${dragOver === 'greeting' ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                            {...makeDragHandlers('greeting', async (files) => {
                                const folderId = await ensureBotFolder()
                                const urls = await uploadFiles(files, folderId || undefined)
                                if (urls.length) update('greetingImages', [...config.greetingImages, ...urls])
                            })}
                            onClick={() => { setMediaBrowserTarget('greeting'); loadMediaItems('image') }}
                        >
                            {uploading ? (
                                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> {t('chatbot.mediaBrowser.uploading')}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">{t('chatbot.mediaBrowser.dragDropHint')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs">{t('chatbot.general.personality')}</Label>
                        <Textarea
                            value={config.personality}
                            onChange={e => update('personality', e.target.value)}
                            placeholder={t('chatbot.general.personalityPlaceholder')}
                            rows={4}
                            className="mt-1"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {t('chatbot.general.personalityHint')}
                        </p>
                    </div>
                </div>
            )}

            {/* ─── TRAINING TAB ─────────────────────── */}
            {botTab === 'training' && (
                <div className="flex gap-4 min-h-[400px]">
                    {/* Left Sidebar Menu */}
                    <div className="w-44 shrink-0 space-y-1">
                        {[
                            { key: 'saved' as const, icon: Check, label: 'Saved Data', color: 'text-green-500', count: knowledgeEntries.length },
                            { key: 'text' as const, icon: FileText, label: 'Text', color: 'text-blue-500' },
                            { key: 'url' as const, icon: LinkIcon, label: 'URL', color: 'text-green-500' },
                            { key: 'sheet' as const, icon: FileSpreadsheet, label: 'Google Sheet', color: 'text-emerald-500' },
                            { key: 'images' as const, icon: ImageIcon, label: 'Images', color: 'text-orange-500' },
                            { key: 'video' as const, icon: Video, label: 'Video', color: 'text-red-500' },
                            { key: 'qa' as const, icon: HelpCircle, label: 'Q&A Pairs', color: 'text-indigo-500' },
                        ].map(item => (
                            <button
                                key={item.key}
                                onClick={() => setTrainingSubTab(item.key)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors text-left
                                    ${trainingSubTab === item.key
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                            >
                                <item.icon className={`h-3.5 w-3.5 ${trainingSubTab === item.key ? item.color : ''}`} />
                                {item.label}
                                {'count' in item && (item.count ?? 0) > 0 && (
                                    <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1">{item.count}</Badge>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Right Content Panel */}
                    <div className="flex-1 min-w-0 space-y-4">

                        {/* ── Saved Knowledge Entries ── */}
                        {trainingSubTab === 'saved' && (
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Check className="h-4 w-4 text-green-500" />
                                        Saved Training Data
                                        <Badge variant="secondary" className="text-[9px]">{knowledgeEntries.length}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 pb-3">
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {knowledgeEntries.map(entry => (
                                            <div key={entry.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded-md group">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    {entry.sourceType === 'url' ? (
                                                        <LinkIcon className="h-3.5 w-3.5 text-green-500" />
                                                    ) : entry.sourceType === 'google_sheet' ? (
                                                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                                                    ) : (
                                                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate">{entry.title}</p>
                                                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                                                        {entry.content.substring(0, 150)}{entry.content.length > 150 ? '...' : ''}
                                                    </p>
                                                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                                                        {new Date(entry.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm" variant="ghost"
                                                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                                                    onClick={() => deleteKnowledgeEntry(entry.id)}
                                                >
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ── Text Training ── */}
                        {trainingSubTab === 'text' && (
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-500" />
                                        {t('chatbot.training.textTitle')}
                                    </CardTitle>
                                    <CardDescription className="text-[11px]">
                                        {t('chatbot.training.textDesc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 pb-3 space-y-3">
                                    <Textarea
                                        value={newTrainingText}
                                        onChange={e => setNewTrainingText(e.target.value)}
                                        placeholder={t('chatbot.training.textPlaceholder')}
                                        rows={6}
                                    />
                                    {/* Training Image Attachments */}
                                    {newTrainingImages.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {newTrainingImages.map((url, i) => (
                                                <div key={i} className="relative group">
                                                    <img src={url} alt="" className="h-12 w-12 rounded object-cover border" />
                                                    <button className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => setNewTrainingImages(prev => prev.filter((_, j) => j !== i))}>
                                                        <X className="h-2.5 w-2.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <div
                                            ref={trainingDropRef}
                                            className={`flex-1 border-2 border-dashed rounded-md p-2 text-center transition-colors
                                            ${dragOver === 'training' ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'}`}
                                            {...makeDragHandlers('training', async (files) => {
                                                const folderId = await ensureBotFolder()
                                                const urls = await uploadFiles(files, folderId || undefined)
                                                if (urls.length) setNewTrainingImages(prev => [...prev, ...urls])
                                            })}
                                        >
                                            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                                                <Upload className="h-3 w-3" /> {t('chatbot.training.dragImagesHint')}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm" variant="outline" className="shrink-0"
                                            onClick={() => { setMediaBrowserTarget('training'); loadMediaItems('image') }}
                                        >
                                            <FolderOpen className="h-3 w-3 mr-1" /> {t('chatbot.mediaBrowser.browseMedia')}
                                        </Button>
                                    </div>
                                    <Button
                                        size="sm" variant="outline"
                                        onClick={async () => {
                                            if (!newTrainingText.trim()) return
                                            const content = newTrainingImages.length
                                                ? `${newTrainingText.trim()}\n\n[Attached images: ${newTrainingImages.join(', ')}]`
                                                : newTrainingText.trim()
                                            await addKnowledgeEntry(
                                                `Training text - ${new Date().toLocaleDateString()}`,
                                                content, 'text'
                                            )
                                            setNewTrainingText('')
                                            setNewTrainingImages([])
                                        }}
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> {t('chatbot.training.addTextTraining')}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* ── URL Training ── */}
                        {trainingSubTab === 'url' && (
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <LinkIcon className="h-4 w-4 text-green-500" />
                                        {t('chatbot.training.urlTitle')}
                                    </CardTitle>
                                    <CardDescription className="text-[11px]">
                                        {t('chatbot.training.urlDesc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 pb-3">
                                    <div className="flex gap-2">
                                        <Input
                                            value={newTrainingUrl}
                                            onChange={e => setNewTrainingUrl(e.target.value)}
                                            placeholder={t('chatbot.training.urlPlaceholder')}
                                            className="text-sm"
                                        />
                                        <Button
                                            size="sm" variant="outline"
                                            onClick={async () => {
                                                if (!newTrainingUrl.trim()) return
                                                await addKnowledgeEntry(
                                                    `URL: ${new URL(newTrainingUrl.trim()).hostname}`,
                                                    `Source URL: ${newTrainingUrl.trim()}\n(Content will be crawled automatically)`,
                                                    'url',
                                                    newTrainingUrl.trim()
                                                )
                                                setNewTrainingUrl('')
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> {t('chatbot.training.addUrl')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ── Google Sheet Training ── */}
                        {trainingSubTab === 'sheet' && (
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                                        {t('chatbot.training.sheetTitle')}
                                    </CardTitle>
                                    <CardDescription className="text-[11px]">
                                        {t('chatbot.training.sheetDesc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 pb-3">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder={t('chatbot.training.sheetPlaceholder')}
                                            className="text-sm"
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                    const url = (e.target as HTMLInputElement).value.trim()
                                                    if (!url) return
                                                    await addKnowledgeEntry(
                                                        `Google Sheet: ${url.substring(0, 50)}...`,
                                                        `Source: ${url}\n(Data will be fetched)`,
                                                        'google_sheet',
                                                        url
                                                    );
                                                    (e.target as HTMLInputElement).value = ''
                                                }
                                            }}
                                        />
                                        <Button size="sm" variant="outline" className="shrink-0">
                                            <ExternalLink className="h-3 w-3 mr-1" /> {t('chatbot.training.addSheet')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ── Image Library ── */}
                        {trainingSubTab === 'images' && (
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 text-orange-500" />
                                        {t('chatbot.training.imageLibTitle')}
                                    </CardTitle>
                                    <CardDescription className="text-[11px]">
                                        {t('chatbot.training.imageLibDesc')}
                                        <br />
                                        {t('chatbot.training.imageLibExample')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 pb-3 space-y-3">
                                    {/* Auto-create or connect to dedicated folder */}
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" className="text-xs gap-1"
                                            onClick={async () => {
                                                const fId = await ensureBotFolder()
                                                if (fId) {
                                                    update('imageFolderId', fId)
                                                    toast.success(t('chatbot.training.folderReady'))
                                                    loadLibraryImages()
                                                }
                                            }}>
                                            <FolderOpen className="h-3 w-3" /> {config.imageFolderId ? t('chatbot.training.refresh') : t('chatbot.training.createBotFolder')}
                                        </Button>
                                        {config.imageFolderId && (
                                            <Badge variant="secondary" className="text-[9px] gap-1">
                                                <Check className="h-2.5 w-2.5" /> {t('chatbot.training.folderConnected')}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Thumbnails grid */}
                                    {libraryImages.length > 0 && (
                                        <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                                            {libraryImages.map(img => (
                                                <div key={img.id} className="relative group" title={img.originalName || ''}>
                                                    <img src={img.thumbnailUrl || img.url} alt={img.originalName || ''}
                                                        className="h-14 w-full rounded object-cover border" />
                                                    <p className="text-[8px] text-muted-foreground truncate mt-0.5">{img.originalName}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Drag-drop upload area */}
                                    <div
                                        ref={libraryDropRef}
                                        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
                                        ${dragOver === 'library' ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                                        {...makeDragHandlers('library', async (files) => {
                                            const fId = config.imageFolderId || await ensureBotFolder()
                                            if (fId && !config.imageFolderId) update('imageFolderId', fId)
                                            const urls = await uploadFiles(files, fId || undefined)
                                            if (urls.length) { toast.success(t('chatbot.training.imagesAdded').replace('{count}', String(urls.length))); loadLibraryImages() }
                                        })}
                                        onClick={() => { setMediaBrowserTarget('library'); loadMediaItems('image') }}
                                    >
                                        {uploading ? (
                                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" /> {t('chatbot.mediaBrowser.uploading')}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
                                                <p className="text-xs text-muted-foreground">{t('chatbot.training.dragOrBrowse')}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ── Video Consultation ── */}
                        {trainingSubTab === 'video' && (
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Video className="h-4 w-4 text-red-500" />
                                        {t('chatbot.training.videoTitle')}
                                    </CardTitle>
                                    <CardDescription className="text-[11px]">
                                        {t('chatbot.training.videoDesc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 pb-3 space-y-2">
                                    {config.consultVideos.map((v, i) => (
                                        <div key={i} className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                                            <Video className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium">{v.title}</p>
                                                <a href={v.url} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline truncate block">{v.url}</a>
                                                {v.description && <p className="text-[10px] text-muted-foreground mt-0.5">{v.description}</p>}
                                            </div>
                                            <Button
                                                size="sm" variant="ghost" className="shrink-0"
                                                onClick={() => update('consultVideos', config.consultVideos.filter((_, j) => j !== i))}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}

                                    {/* Video Upload + Browse Media */}
                                    <div className="flex gap-2">
                                        <div
                                            ref={videoDropRef}
                                            className={`flex-1 border-2 border-dashed rounded-md p-3 text-center transition-colors cursor-pointer
                                            ${dragOver === 'video' ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'}`}
                                            {...makeDragHandlers('video', async (files) => {
                                                const folderId = await ensureBotFolder()
                                                const urls = await uploadFiles(files, folderId || undefined)
                                                for (const url of urls) {
                                                    const fileName = Array.from(files).find(f => f.type.startsWith('video/'))?.name || 'Video'
                                                    update('consultVideos', [
                                                        ...config.consultVideos,
                                                        { title: fileName.replace(/\.[^.]+$/, ''), url, description: '' },
                                                    ])
                                                }
                                            })}
                                            onClick={() => {
                                                const input = document.createElement('input')
                                                input.type = 'file'
                                                input.accept = 'video/*'
                                                input.multiple = true
                                                input.onchange = async (e) => {
                                                    const files = (e.target as HTMLInputElement).files
                                                    if (!files?.length) return
                                                    const folderId = await ensureBotFolder()
                                                    const urls = await uploadFiles(files, folderId || undefined)
                                                    for (let idx = 0; idx < urls.length; idx++) {
                                                        update('consultVideos', [
                                                            ...config.consultVideos,
                                                            { title: files[idx].name.replace(/\.[^.]+$/, ''), url: urls[idx], description: '' },
                                                        ])
                                                    }
                                                }
                                                input.click()
                                            }}
                                        >
                                            {uploading ? (
                                                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> {t('chatbot.mediaBrowser.uploading')}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                                                    <Upload className="h-3 w-3" /> {t('chatbot.training.dragVideoHint')}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            size="sm" variant="outline" className="shrink-0"
                                            onClick={() => { setMediaBrowserTarget('video'); loadMediaItems('video') }}
                                        >
                                            <FolderOpen className="h-3 w-3 mr-1" /> {t('chatbot.mediaBrowser.browseMedia')}
                                        </Button>
                                    </div>

                                    <Separator />

                                    {/* Manual URL entry */}
                                    <div className="space-y-2 border rounded-md p-3">
                                        <p className="text-[10px] text-muted-foreground font-medium">{t('chatbot.training.videoManualUrl')}</p>
                                        <Input
                                            value={newVideoTitle}
                                            onChange={e => setNewVideoTitle(e.target.value)}
                                            placeholder={t('chatbot.training.videoTitleInput')}
                                            className="text-sm"
                                        />
                                        <Input
                                            value={newVideoUrl}
                                            onChange={e => setNewVideoUrl(e.target.value)}
                                            placeholder={t('chatbot.training.videoUrlInput')}
                                            className="text-sm"
                                        />
                                        <Input
                                            value={newVideoDesc}
                                            onChange={e => setNewVideoDesc(e.target.value)}
                                            placeholder={t('chatbot.training.videoDescInput')}
                                            className="text-sm"
                                        />
                                        <Button
                                            size="sm" variant="outline"
                                            onClick={() => {
                                                if (!newVideoTitle.trim() || !newVideoUrl.trim()) return
                                                update('consultVideos', [
                                                    ...config.consultVideos,
                                                    { title: newVideoTitle.trim(), url: newVideoUrl.trim(), description: newVideoDesc.trim() },
                                                ])
                                                setNewVideoTitle('')
                                                setNewVideoUrl('')
                                                setNewVideoDesc('')
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> {t('chatbot.training.addVideo')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ── Q&A Training Pairs ── */}
                        {trainingSubTab === 'qa' && (
                            <Card>
                                <CardHeader className="py-3 px-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <HelpCircle className="h-4 w-4 text-indigo-500" />
                                            {t('chatbot.training.qaTitle')}
                                        </CardTitle>
                                        <Button
                                            size="sm" variant="outline"
                                            disabled={generatingQa}
                                            onClick={async () => {
                                                setGeneratingQa(true)
                                                try {
                                                    const res = await fetch(`/api/admin/channels/${channelId}/bot-config/generate-qa`, { method: 'POST' })
                                                    if (res.ok) {
                                                        const data = await res.json()
                                                        if (data.pairs?.length) {
                                                            update('trainingPairs', [...config.trainingPairs, ...data.pairs])
                                                            toast.success(t('chatbot.training.qaGenerated').replace('{count}', String(data.pairs.length)))
                                                        } else {
                                                            toast.info(t('chatbot.training.qaNoNew'))
                                                        }
                                                    } else {
                                                        const err = await res.json().catch(() => ({}))
                                                        toast.error(err.error || 'Failed to generate Q&A')
                                                    }
                                                } catch {
                                                    toast.error('Network error')
                                                }
                                                setGeneratingQa(false)
                                            }}
                                        >
                                            {generatingQa ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                            {generatingQa ? t('chatbot.training.generatingQa') : t('chatbot.training.generateQa')}
                                        </Button>
                                    </div>
                                    <CardDescription className="text-[11px]">
                                        {t('chatbot.training.qaDesc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 pb-3 space-y-2">
                                    {config.trainingPairs.map((pair, i) => (
                                        <div key={i} className="flex items-start gap-2 p-2 bg-muted/50 rounded-md text-xs">
                                            <div className="flex-1 min-w-0">
                                                <p><span className="font-medium text-blue-600">Q:</span> {pair.q}</p>
                                                <p><span className="font-medium text-green-600">A:</span> {pair.a}</p>
                                            </div>
                                            <Button
                                                size="sm" variant="ghost" className="shrink-0"
                                                onClick={() => update('trainingPairs', config.trainingPairs.filter((_, j) => j !== i))}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                    <div className="space-y-2 border rounded-md p-3">
                                        <Input
                                            value={newQaPair.q}
                                            onChange={e => setNewQaPair({ ...newQaPair, q: e.target.value })}
                                            placeholder={t('chatbot.training.questionPlaceholder')}
                                            className="text-sm"
                                        />
                                        <Textarea
                                            value={newQaPair.a}
                                            onChange={e => setNewQaPair({ ...newQaPair, a: e.target.value })}
                                            placeholder={t('chatbot.training.answerPlaceholder')}
                                            rows={2}
                                            className="text-sm"
                                        />
                                        <Button
                                            size="sm" variant="outline"
                                            onClick={() => {
                                                if (!newQaPair.q.trim() || !newQaPair.a.trim()) return
                                                update('trainingPairs', [
                                                    ...config.trainingPairs,
                                                    { q: newQaPair.q.trim(), a: newQaPair.a.trim() },
                                                ])
                                                setNewQaPair({ q: '', a: '' })
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> {t('chatbot.training.addQaPair')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                    </div>
                </div>
            )}

            {/* ─── BEHAVIOR TAB ─────────────────────── */}
            {botTab === 'behavior' && (
                <div className="space-y-4">
                    <div>
                        <Label className="text-xs">{t('chatbot.behavior.confidence')}: {(config.confidenceThreshold * 100).toFixed(0)}%</Label>
                        <p className="text-[10px] text-muted-foreground mb-2">
                            {t('chatbot.behavior.confidenceDesc')}
                        </p>
                        <Slider
                            value={[config.confidenceThreshold]}
                            min={0} max={1} step={0.05}
                            onValueChange={([v]) => update('confidenceThreshold', v)}
                        />
                    </div>

                    <div>
                        <Label className="text-xs">{t('chatbot.behavior.maxReplies')}</Label>
                        <Input
                            type="number" min={1} max={100}
                            value={config.maxBotReplies}
                            onChange={e => update('maxBotReplies', parseInt(e.target.value) || 10)}
                            className="mt-1 w-24"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {t('chatbot.behavior.maxRepliesDesc').replace('{count}', String(config.maxBotReplies))}
                        </p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { key: 'autoTagEnabled' as const, label: t('chatbot.behavior.autoTag'), desc: t('chatbot.behavior.autoTagDesc') },
                            { key: 'sentimentEnabled' as const, label: t('chatbot.behavior.sentiment'), desc: t('chatbot.behavior.sentimentDesc') },
                            { key: 'spamFilterEnabled' as const, label: t('chatbot.behavior.spamFilter'), desc: t('chatbot.behavior.spamFilterDesc') },
                            { key: 'autoTranslate' as const, label: t('chatbot.behavior.autoTranslate'), desc: t('chatbot.behavior.autoTranslateDesc') },
                            { key: 'smartAssignEnabled' as const, label: t('chatbot.behavior.smartAssign'), desc: t('chatbot.behavior.smartAssignDesc') },
                        ].map(item => (
                            <div key={item.key} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                <div>
                                    <p className="text-xs font-medium">{item.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                                </div>
                                <Switch
                                    checked={config[item.key]}
                                    onCheckedChange={v => update(item.key, v)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── ESCALATION TAB ─────────────────── */}
            {botTab === 'escalation' && (
                <div className="space-y-4">
                    <div>
                        <Label className="text-xs">{t('chatbot.escalation.keywordsLabel')}</Label>
                        <p className="text-[10px] text-muted-foreground mb-2">
                            {t('chatbot.escalation.keywordsDesc')}
                        </p>
                        <div className="flex flex-wrap gap-1 mb-2">
                            {config.autoEscalateKeywords.map((kw, i) => (
                                <Badge key={i} variant="destructive" className="text-[10px] gap-1">
                                    {kw}
                                    <button onClick={() => update('autoEscalateKeywords', config.autoEscalateKeywords.filter((_, j) => j !== i))}>×</button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newEscalateKeyword}
                                onChange={e => setNewEscalateKeyword(e.target.value)}
                                placeholder={t('chatbot.escalation.keywordsPlaceholder')}
                                className="text-sm"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && newEscalateKeyword.trim()) {
                                        update('autoEscalateKeywords', [...config.autoEscalateKeywords, newEscalateKeyword.trim()])
                                        setNewEscalateKeyword('')
                                    }
                                }}
                            />
                            <Button size="sm" variant="outline" onClick={() => {
                                if (newEscalateKeyword.trim()) {
                                    update('autoEscalateKeywords', [...config.autoEscalateKeywords, newEscalateKeyword.trim()])
                                    setNewEscalateKeyword('')
                                }
                            }}>
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <Label className="text-xs">{t('chatbot.escalation.forbiddenLabel')}</Label>
                        <p className="text-[10px] text-muted-foreground mb-2">
                            {t('chatbot.escalation.forbiddenDesc')}
                        </p>
                        <div className="flex flex-wrap gap-1 mb-2">
                            {config.forbiddenTopics.map((topic, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] gap-1 border-red-300">
                                    {topic}
                                    <button onClick={() => update('forbiddenTopics', config.forbiddenTopics.filter((_, j) => j !== i))}>×</button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newForbiddenTopic}
                                onChange={e => setNewForbiddenTopic(e.target.value)}
                                placeholder={t('chatbot.escalation.forbiddenPlaceholder')}
                                className="text-sm"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && newForbiddenTopic.trim()) {
                                        update('forbiddenTopics', [...config.forbiddenTopics, newForbiddenTopic.trim()])
                                        setNewForbiddenTopic('')
                                    }
                                }}
                            />
                            <Button size="sm" variant="outline" onClick={() => {
                                if (newForbiddenTopic.trim()) {
                                    update('forbiddenTopics', [...config.forbiddenTopics, newForbiddenTopic.trim()])
                                    setNewForbiddenTopic('')
                                }
                            }}>
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── WORKING HOURS TAB ─────────────── */}
            {botTab === 'hours' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium">{t('chatbot.hours.enableLabel')}</p>
                            <p className="text-[10px] text-muted-foreground">{t('chatbot.hours.enableDesc')}</p>
                        </div>
                        <Switch
                            checked={config.workingHoursOnly}
                            onCheckedChange={v => update('workingHoursOnly', v)}
                        />
                    </div>

                    {config.workingHoursOnly && (
                        <>
                            <div className="space-y-2">
                                <Label className="text-xs font-medium">Weekly Schedule</Label>
                                <div className="space-y-1">
                                    {[
                                        { key: 'mon', label: 'Monday' },
                                        { key: 'tue', label: 'Tuesday' },
                                        { key: 'wed', label: 'Wednesday' },
                                        { key: 'thu', label: 'Thursday' },
                                        { key: 'fri', label: 'Friday' },
                                        { key: 'sat', label: 'Saturday' },
                                        { key: 'sun', label: 'Sunday' },
                                    ].map(day => {
                                        const dayConfig = config.workingDays[day.key] || { enabled: true, start: '08:00', end: '22:00' }
                                        return (
                                            <div key={day.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${dayConfig.enabled ? 'bg-muted/40' : 'bg-muted/10 opacity-60'}`}>
                                                <Switch
                                                    checked={dayConfig.enabled}
                                                    onCheckedChange={v => {
                                                        const updated = { ...config.workingDays, [day.key]: { ...dayConfig, enabled: v } }
                                                        update('workingDays', updated)
                                                    }}
                                                />
                                                <span className={`text-xs w-20 ${dayConfig.enabled ? 'font-medium' : 'text-muted-foreground'}`}>{day.label}</span>
                                                {dayConfig.enabled ? (
                                                    <div className="flex items-center gap-2 ml-auto">
                                                        <Input
                                                            type="time"
                                                            value={dayConfig.start}
                                                            onChange={e => {
                                                                const updated = { ...config.workingDays, [day.key]: { ...dayConfig, start: e.target.value } }
                                                                update('workingDays', updated)
                                                            }}
                                                            className="h-7 w-28 text-xs"
                                                        />
                                                        <span className="text-[10px] text-muted-foreground">to</span>
                                                        <Input
                                                            type="time"
                                                            value={dayConfig.end}
                                                            onChange={e => {
                                                                const updated = { ...config.workingDays, [day.key]: { ...dayConfig, end: e.target.value } }
                                                                update('workingDays', updated)
                                                            }}
                                                            className="h-7 w-28 text-xs"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground ml-auto italic">Bot off</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">{t('chatbot.hours.offHoursMessage')}</Label>
                                <Textarea
                                    value={config.offHoursMessage || ''}
                                    onChange={e => update('offHoursMessage', e.target.value)}
                                    placeholder={t('chatbot.hours.offHoursPlaceholder')}
                                    rows={2}
                                    className="mt-1"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ─── SCOPE TAB ────────────────────── */}
            {botTab === 'scope' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                            <div>
                                <p className="text-xs font-medium">{t('chatbot.scope.messages')}</p>
                                <p className="text-[10px] text-muted-foreground">{t('chatbot.scope.messagesDesc')}</p>
                            </div>
                            <Switch
                                checked={config.applyToMessages}
                                onCheckedChange={v => update('applyToMessages', v)}
                            />
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                            <div>
                                <p className="text-xs font-medium">{t('chatbot.scope.comments')}</p>
                                <p className="text-[10px] text-muted-foreground">{t('chatbot.scope.commentsDesc')}</p>
                            </div>
                            <Switch
                                checked={config.applyToComments}
                                onCheckedChange={v => update('applyToComments', v)}
                            />
                        </div>
                    </div>

                    {/* Comment Reply Delay */}
                    {config.applyToComments && (
                        <Card className="mt-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-amber-500" />
                                    Comment Reply Delay
                                </CardTitle>
                                <CardDescription className="text-[11px]">
                                    Bot sẽ đợi ngẫu nhiên trong khoảng thời gian này trước khi trả lời comment, giúp phản hồi tự nhiên hơn.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-[11px] text-muted-foreground">Tối thiểu (giây)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={config.commentReplyMaxDelay}
                                            value={config.commentReplyMinDelay}
                                            onChange={e => {
                                                const v = Math.max(0, parseInt(e.target.value) || 0)
                                                update('commentReplyMinDelay', v)
                                            }}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[11px] text-muted-foreground">Tối đa (giây)</Label>
                                        <Input
                                            type="number"
                                            min={config.commentReplyMinDelay}
                                            max={3600}
                                            value={config.commentReplyMaxDelay}
                                            onChange={e => {
                                                const v = Math.max(config.commentReplyMinDelay, parseInt(e.target.value) || 0)
                                                update('commentReplyMaxDelay', v)
                                            }}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    ⏱️ Bot sẽ trả lời comment sau <strong>{config.commentReplyMinDelay}s</strong> → <strong>{config.commentReplyMaxDelay}s</strong> ({Math.round(config.commentReplyMinDelay / 60)} phút → {Math.round(config.commentReplyMaxDelay / 60)} phút)
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* ─── Bottom Save ─────────────────────── */}
            <div className="flex justify-end pt-2">
                <Button onClick={saveConfig} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    {t('chatbot.save')}
                </Button>
            </div>

            {/* ═══════════════════════════════════════ */}
            {/* MEDIA BROWSER MODAL                    */}
            {mediaBrowserTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setMediaBrowserTarget(null)}>
                    <div className="bg-background rounded-xl shadow-2xl w-[600px] max-h-[500px] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                                {mediaBrowserTarget === 'video' ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                                {mediaBrowserTarget === 'video' ? t('chatbot.mediaBrowser.videoTitle') : t('chatbot.mediaBrowser.title')}
                            </h4>
                            <Button size="sm" variant="ghost" onClick={() => setMediaBrowserTarget(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {mediaLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : mediaItems.length === 0 ? (
                                <div className="text-center py-10 text-sm text-muted-foreground">
                                    {mediaBrowserTarget === 'video' ? <Video className="h-8 w-8 mx-auto mb-2 opacity-40" /> : <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />}
                                    {mediaBrowserTarget === 'video' ? t('chatbot.mediaBrowser.videoEmpty') : t('chatbot.mediaBrowser.empty')}
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-3">
                                    {mediaItems.map(item => (
                                        <button key={item.id}
                                            className="group relative rounded-lg overflow-hidden border hover:border-primary transition-colors"
                                            onClick={() => {
                                                const url = item.url
                                                if (mediaBrowserTarget === 'greeting') {
                                                    update('greetingImages', [...(config?.greetingImages || []), url])
                                                } else if (mediaBrowserTarget === 'training') {
                                                    setNewTrainingImages(prev => [...prev, url])
                                                } else if (mediaBrowserTarget === 'library') {
                                                    toast.success(t('chatbot.mediaBrowser.selectedForLibrary'))
                                                } else if (mediaBrowserTarget === 'video') {
                                                    update('consultVideos', [
                                                        ...config.consultVideos,
                                                        { title: item.originalName?.replace(/\.[^.]+$/, '') || 'Video', url, description: '' },
                                                    ])
                                                    toast.success(t('chatbot.mediaBrowser.videoSelected'))
                                                }
                                                setMediaBrowserTarget(null)
                                            }}
                                        >
                                            {mediaBrowserTarget === 'video' ? (
                                                <div className="h-24 w-full bg-muted flex items-center justify-center relative">
                                                    {item.thumbnailUrl ? (
                                                        <img src={item.thumbnailUrl} alt={item.originalName || ''} className="h-24 w-full object-cover" />
                                                    ) : (
                                                        <Video className="h-8 w-8 text-muted-foreground" />
                                                    )}
                                                </div>
                                            ) : (
                                                <img src={item.thumbnailUrl || item.url} alt={item.originalName || ''}
                                                    className="h-24 w-full object-cover" />
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <Check className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                            </div>
                                            <p className="text-[9px] text-muted-foreground p-1 truncate">{item.originalName}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
