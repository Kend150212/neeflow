'use client'

import { useTranslation } from '@/lib/i18n'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
    Save, Plus, Trash2, Loader2, Bot,
    MessageSquare, Brain, Shield, Clock, Target,
    Image as ImageIcon, Video, HelpCircle, FileText,
    Link as LinkIcon, FileSpreadsheet, ExternalLink,
    Upload, FolderOpen, X, Check, Sparkles,
    MessageCircle, Zap, Send, BarChart3, ChevronDown,
    Search, Package, Edit, Download, Copy,
    RotateCcw, Paperclip, Tag, Ban, Eye, LayoutGrid,
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
    botModel: string | null
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
    // Smart Memory
    enableSmartMemory: boolean
    sessionTimeoutHours: number
    summariesBeforeMerge: number
}

interface ChatBotTabProps {
    channelId: string
}

export default function ChatBotTab({ channelId }: ChatBotTabProps) {
    const t = useTranslation()
    const [config, setConfig] = useState<BotConfigData>({
        isEnabled: true,
        botName: 'AI Assistant',
        greeting: '',
        greetingMode: 'template',
        greetingImages: [],
        personality: '',
        language: 'vi',
        imageFolderId: null,
        consultVideos: [],
        confidenceThreshold: 0.7,
        maxBotReplies: 10,
        botModel: null,
        autoTagEnabled: true,
        sentimentEnabled: true,
        spamFilterEnabled: true,
        autoTranslate: false,
        smartAssignEnabled: false,
        autoEscalateKeywords: [],
        forbiddenTopics: [],
        workingHoursOnly: false,
        workingHoursStart: null,
        workingHoursEnd: null,
        workingDays: {
            mon: { enabled: true, start: '08:00', end: '22:00' },
            tue: { enabled: true, start: '08:00', end: '22:00' },
            wed: { enabled: true, start: '08:00', end: '22:00' },
            thu: { enabled: true, start: '08:00', end: '22:00' },
            fri: { enabled: true, start: '08:00', end: '22:00' },
            sat: { enabled: false, start: '08:00', end: '22:00' },
            sun: { enabled: false, start: '08:00', end: '22:00' },
        },
        offHoursMessage: null,
        trainingPairs: [],
        exampleConvos: [],
        enabledPlatforms: ['all'],
        applyToComments: true,
        applyToMessages: true,
        commentReplyMinDelay: 30,
        commentReplyMaxDelay: 600,
        enableSmartMemory: false,
        sessionTimeoutHours: 8,
        summariesBeforeMerge: 5,
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [planLimits, setPlanLimits] = useState<Record<string, any> | null>(null)

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
    const [botTab, setBotTab] = useState<'general' | 'training' | 'behavior' | 'hours' | 'scope' | 'chattest' | 'learning' | 'usage' | 'pages'>('general')

    // Available AI text models (fetched from integrations)
    const [availableModels, setAvailableModels] = useState<{ provider: string; label: string; models: { id: string; name: string }[] }[]>([])
    const [modelsLoading, setModelsLoading] = useState(false)

    const [trainingSubTab, setTrainingSubTab] = useState<'saved' | 'text' | 'url' | 'sheet' | 'images' | 'video' | 'qa' | 'products' | 'promotions' | 'forbidden'>('saved')

    // Fetch text models from all configured integrations
    useEffect(() => {
        setModelsLoading(true)
        fetch('/api/admin/integrations/text-models')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setAvailableModels(data) })
            .catch(() => { })
            .finally(() => setModelsLoading(false))
    }, [])

    // Context preview dialog
    const [contextPreview, setContextPreview] = useState<null | {
        generatedAt: string
        sections: { label: string; count: number; content: string }[]
    }>(null)
    const [loadingContext, setLoadingContext] = useState(false)
    const fetchContextPreview = useCallback(async () => {
        setLoadingContext(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/bot-context`)
            if (!res.ok) throw new Error('failed')
            const data = await res.json()
            setContextPreview(data)
        } catch {
            toast.error('Không thể tải context bot')
        } finally {
            setLoadingContext(false)
        }
    }, [channelId])

    // Product catalog state
    type Product = { id: string; productId?: string | null; name: string; category?: string | null; price?: number | null; salePrice?: number | null; description?: string | null; features: string[]; images: string[]; tags: string[]; inStock: boolean; syncSource?: string | null }
    const [products, setProducts] = useState<Product[]>([])
    const [productsLoading, setProductsLoading] = useState(false)
    const [showProductForm, setShowProductForm] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [csvImporting, setCsvImporting] = useState(false)
    const [productSearch, setProductSearch] = useState('')
    const [newProduct, setNewProduct] = useState({ productId: '', name: '', category: '', price: '', salePrice: '', description: '', features: '', images: '', tags: '', inStock: true })
    const csvInputRef = useRef<HTMLInputElement>(null)
    // Inline cell editing: { rowId, field, value }
    const [inlineEdit, setInlineEdit] = useState<{ rowId: string; field: string; value: string } | null>(null)

    // Promotions / Holiday Pricing state
    type PriceGroup = { groupName: string; direction: 'increase' | 'decrease'; adjustType: 'fixed' | 'percent'; adjustment: number; productIds: string[] }
    type Promotion = { id: string; name: string; description?: string | null; startAt: string; endAt: string; isActive: boolean; priceGroups: PriceGroup[] }
    const [promotions, setPromotions] = useState<Promotion[]>([])
    const [promotionsLoading, setPromotionsLoading] = useState(false)
    const [showPromoForm, setShowPromoForm] = useState(false)
    const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)
    const emptyPromo = { name: '', description: '', startAt: '', endAt: '', isActive: true, priceGroups: [] as PriceGroup[] }
    const [newPromo, setNewPromo] = useState(emptyPromo)
    const [promoProductSearch, setPromoProductSearch] = useState('')



    // Chat test state
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot'; content: string; imageUrls?: string[]; attachments?: string[] }[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const [chatAttachments, setChatAttachments] = useState<string[]>([])  // uploaded image URLs to attach
    const chatEndRef = useRef<HTMLDivElement>(null)
    const chatImageInputRef = useRef<HTMLInputElement>(null)

    // Agent learning state
    const [learningData, setLearningData] = useState<any>(null)
    const [learningLoading, setLearningLoading] = useState(false)
    const [learningFetched, setLearningFetched] = useState(false)

    // RAG embedding stats
    const [embedStats, setEmbedStats] = useState<{ knowledge: { total: number; embedded: number }; products: { total: number; embedded: number } } | null>(null)
    const [embedLoading, setEmbedLoading] = useState(false)

    // Load embedding stats when entering training tab
    const loadEmbedStats = async () => {
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/bot-config/embed`)
            if (res.ok) setEmbedStats(await res.json())
        } catch { /* ignore */ }
    }

    // Bot Usage Analytics state
    const [usageData, setUsageData] = useState<any>(null)
    const [usageLoading, setUsageLoading] = useState(false)
    const [usagePeriod, setUsagePeriod] = useState<'today' | '7d' | '30d' | 'year'>('30d')

    const loadUsageData = async (period: string) => {
        setUsageLoading(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/bot-config/usage?period=${period}`)
            if (res.ok) setUsageData(await res.json())
        } catch { /* ignore */ }
        setUsageLoading(false)
    }

    // Normalize AI-returned learning data to safe types (AI can return objects instead of strings)
    const normalizeLearningData = (raw: any) => {
        if (!raw || typeof raw !== 'object') return {}

        // Convert any value to a safe string for rendering
        const itemToString = (v: any): string => {
            if (typeof v === 'string') return v
            if (typeof v === 'number' || typeof v === 'boolean') return String(v)
            if (v && typeof v === 'object') {
                // AI sometimes returns {term, meaning}, {word, definition}, {phrase}, {text}, {scenario, approach} etc.
                const str = v.term || v.word || v.phrase || v.text || v.value || v.name
                if (str) return typeof str === 'string' ? str : String(str)
                // Fallback: joined key=value pairs
                return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(' | ')
            }
            return ''
        }

        // Convert value to safe string array
        const toArr = (v: any): string[] => {
            if (Array.isArray(v)) return v.map(itemToString).filter(Boolean)
            if (typeof v === 'string' && v) return [v]
            return []
        }

        const tone = raw.toneAnalysis && typeof raw.toneAnalysis === 'object' ? raw.toneAnalysis : {}

        return {
            ...raw,
            vocabulary: toArr(raw.vocabulary),
            slangAndAbbreviations: toArr(raw.slangAndAbbreviations),
            greetingStyles: toArr(raw.greetingStyles),
            closingStyles: toArr(raw.closingStyles),
            keyPhrases: toArr(raw.keyPhrases),
            customerHandlingTechniques: toArr(raw.customerHandlingTechniques),
            dealingPatterns: Array.isArray(raw.dealingPatterns)
                ? raw.dealingPatterns.map((p: any) => ({
                    scenario: itemToString(typeof p === 'object' ? (p.scenario ?? p) : p),
                    approach: itemToString(typeof p === 'object' ? (p.approach ?? '') : ''),
                }))
                : [],
            toneAnalysis: Object.keys(tone).length > 0 ? {
                formality: String(tone.formality || ''),
                emojiUsage: String(tone.emojiUsage || ''),
                avgMessageLength: Number(tone.avgMessageLength) || 0,
                writingStyle: String(tone.writingStyle || ''),
                languages: toArr(tone.languages),
            } : undefined,
        }
    }

    // Per-page bot toggle
    const [pageAccounts, setPageAccounts] = useState<{ id: string; accountName: string; platform: string; botEnabled: boolean }[]>([])
    const [pagesExpanded, setPagesExpanded] = useState(false)

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

    // Auto-load library images when switching to images sub-tab
    useEffect(() => {
        if (trainingSubTab === 'images' && config?.imageFolderId) {
            loadLibraryImages()
        }
    }, [trainingSubTab, config?.imageFolderId, loadLibraryImages])

    // ─── Send chat message (text + optional image attachments) ──────
    const sendChatMessage = useCallback(async () => {
        const msg = chatInput.trim()
        if (!msg && chatAttachments.length === 0) return
        if (chatLoading) return

        // Build display content: text + image URLs appended so bot sees them
        const imgPart = chatAttachments.length > 0 ? '\n' + chatAttachments.join('\n') : ''
        const fullMsg = msg + imgPart

        const userEntry = { role: 'user' as const, content: msg, attachments: chatAttachments.length > 0 ? [...chatAttachments] : undefined }
        setChatInput('')
        setChatAttachments([])
        setChatMessages(prev => [...prev, userEntry])
        setChatLoading(true)
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

        try {
            const res = await fetch(`/api/admin/channels/${channelId}/bot-config/test-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: fullMsg, history: chatMessages }),
            })
            const data = await res.json()
            setChatMessages(prev => [...prev, { role: 'bot', content: data.reply || data.error || 'No response', imageUrls: data.imageUrls || [] }])
        } catch {
            setChatMessages(prev => [...prev, { role: 'bot', content: '❌ Lỗi kết nối' }])
        }
        setChatLoading(false)
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }, [chatInput, chatAttachments, chatLoading, chatMessages, channelId])

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
                        enableSmartMemory: data.enableSmartMemory ?? false,
                        sessionTimeoutHours: data.sessionTimeoutHours ?? 8,
                        summariesBeforeMerge: data.summariesBeforeMerge ?? 5,
                        botModel: data.botModel || null,
                    })
                }
            } catch { /* ignore */ }

            // Fetch connected pages for per-page bot toggles
            try {
                const pagesRes = await fetch(`/api/admin/channels/${channelId}/platforms`)
                if (pagesRes.ok) {
                    const pagesData = await pagesRes.json()
                    setPageAccounts((pagesData || [])
                        .filter((p: any) => p.isActive !== false)  // only show active/enabled accounts
                        .map((p: any) => ({
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

            // Fetch plan limits for feature gating
            try {
                const planRes = await fetch('/api/user/plan')
                if (planRes.ok) setPlanLimits(await planRes.json())
            } catch { /* ignore */ }

            setLoading(false)
        }
        fetchConfig()
    }, [channelId])

    // ─── Load product catalog when tab activates ─────────
    useEffect(() => {
        if (botTab === 'training' && trainingSubTab === 'products' && products.length === 0 && !productsLoading) {
            setProductsLoading(true)
            fetch(`/api/admin/channels/${channelId}/products`)
                .then(r => r.json())
                .then(data => { setProducts(Array.isArray(data) ? data : []); setProductsLoading(false) })
                .catch(() => setProductsLoading(false))
        }
    }, [botTab, trainingSubTab]) // eslint-disable-line react-hooks/exhaustive-deps

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
                toast.success(t('chatbot.toasts.saved'))
            } else {
                toast.error(t('chatbot.toasts.saveFailed'))
            }
        } catch {
            toast.error(t('chatbot.toasts.networkError'))
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
                toast.error(t('chatbot.toasts.trainingAddFailed'))
            }
        } catch {
            toast.error(t('chatbot.toasts.networkError'))
        }
    }

    const deleteKnowledgeEntry = async (entryId: string) => {
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/knowledge?entryId=${entryId}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                setKnowledgeEntries(prev => prev.filter(e => e.id !== entryId))
                toast.success(t('chatbot.toasts.trainingDeleted'))
            } else {
                toast.error(t('chatbot.toasts.trainingDeleteFailed'))
            }
        } catch {
            toast.error(t('chatbot.toasts.networkError'))
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }


    return (
        <>
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
                        <Button
                            onClick={fetchContextPreview}
                            disabled={loadingContext}
                            size="sm"
                            variant="outline"
                            title="Xem tất cả thông tin bot đang biết ngay lúc này"
                        >
                            {loadingContext ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                            Context Bot
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



                {/* ─── Tab Navigation ───────────────────── */}
                <div className="flex items-center gap-1 border-b pb-0 mb-4 overflow-x-auto">
                    {[
                        { key: 'general' as const, icon: MessageSquare, label: t('chatbot.general.title'), color: 'text-blue-500' },
                        { key: 'training' as const, icon: Brain, label: t('chatbot.training.title'), color: 'text-purple-500' },
                        { key: 'behavior' as const, icon: Target, label: t('chatbot.behavior.title'), color: 'text-cyan-500' },
                        { key: 'hours' as const, icon: Clock, label: t('chatbot.hours.title'), color: 'text-amber-500' },
                        { key: 'scope' as const, icon: Target, label: t('chatbot.scope.title'), color: 'text-teal-500' },
                        { key: 'chattest' as const, icon: MessageCircle, label: 'Chat Test', color: 'text-pink-500' },


                        { key: 'pages' as const, icon: LayoutGrid, label: 'Accounts', color: 'text-orange-500' },
                        { key: 'learning' as const, icon: Zap, label: 'Learning', color: 'text-yellow-500' },
                        ...(planLimits?.hasBotUsageAnalytics ? [{ key: 'usage' as const, icon: BarChart3, label: 'Usage', color: 'text-violet-500' }] : []),
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setBotTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap
                            ${botTab === tab.key
                                    ? 'border-primary text-primary bg-primary/5'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                        >
                            {tab.icon && <tab.icon className={`h-3.5 w-3.5 ${botTab === tab.key ? tab.color : ''}`} />}
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
                                    placeholder={t('chatbot.botNamePlaceholder')}
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
                        {/* Bot AI Model */}
                        <div>
                            <Label className="text-xs flex items-center gap-1.5"><span>🤖</span> AI Model</Label>
                            <select
                                value={config.botModel || ''}
                                onChange={e => update('botModel', e.target.value || null)}
                                disabled={modelsLoading}
                                className="w-full mt-1 h-9 px-3 text-sm rounded-md border border-input bg-background disabled:opacity-60"
                            >
                                <option value="">— Use channel default model —</option>
                                {availableModels.length > 0 ? (
                                    availableModels.map(group => (
                                        <optgroup key={group.provider} label={group.label}>
                                            {group.models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </optgroup>
                                    ))
                                ) : (
                                    /* Fallback static list if fetch fails */
                                    <>
                                        <optgroup label="Google Gemini">
                                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
                                        </optgroup>
                                        <optgroup label="OpenAI">
                                            <option value="gpt-4o">GPT-4o</option>
                                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                                            <option value="gpt-4.1">GPT-4.1</option>
                                            <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                                        </optgroup>
                                    </>
                                )}
                            </select>
                            <p className="text-xs text-muted-foreground mt-1">Override the channel&apos;s default AI model for this bot only.</p>
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
                    <div className="flex flex-col gap-4">
                        {/* Horizontal Tab Bar */}
                        <div className="flex flex-wrap gap-1 border-b pb-2">
                            {[
                                { key: 'saved' as const, icon: Check, label: t('chatbot.learning.savedTrainingData'), color: 'text-green-500', count: knowledgeEntries.length },
                                { key: 'text' as const, icon: FileText, label: t('chatbot.trainingTabs.text'), color: 'text-blue-500' },
                                { key: 'url' as const, icon: LinkIcon, label: t('chatbot.trainingTabs.url'), color: 'text-green-500' },
                                { key: 'sheet' as const, icon: FileSpreadsheet, label: t('chatbot.trainingTabs.googleSheet'), color: 'text-emerald-500' },
                                { key: 'images' as const, icon: ImageIcon, label: t('chatbot.trainingTabs.images'), color: 'text-orange-500' },
                                { key: 'video' as const, icon: Video, label: t('chatbot.trainingTabs.video'), color: 'text-red-500' },
                                { key: 'qa' as const, icon: HelpCircle, label: t('chatbot.trainingTabs.qaPairs'), color: 'text-indigo-500' },
                                { key: 'products' as const, icon: Package, label: t('chatbot.trainingTabs.products'), color: 'text-emerald-500', count: products.length },
                                { key: 'promotions' as const, icon: Tag, label: t('chatbot.trainingTabs.promotions'), color: 'text-pink-500', count: promotions.length },
                                { key: 'forbidden' as const, icon: Ban, label: t('chatbot.trainingTabs.forbidden'), color: 'text-red-500', count: config.forbiddenTopics?.length },



                            ].map(item => (
                                <button
                                    key={item.key}
                                    onClick={() => setTrainingSubTab(item.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all
                                    ${trainingSubTab === item.key
                                            ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
                                >
                                    <item.icon className={`h-3 w-3 ${trainingSubTab === item.key ? 'text-primary-foreground' : item.color}`} />
                                    {item.label}
                                    {'count' in item && (item.count ?? 0) > 0 && (
                                        <span className={`ml-0.5 text-[9px] px-1 rounded-full ${trainingSubTab === item.key ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{item.count}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* ─── Bot Knowledge Status ─── */}
                        <div className="flex items-center gap-2 px-1 py-1.5 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200/50 dark:border-violet-800/30">
                            <div className="flex-1 flex items-center gap-2 text-[11px]">
                                <span className="font-medium text-violet-700 dark:text-violet-300">{t('chatbot.ragStatus.label')}:</span>
                                {embedStats ? (
                                    <span className="text-muted-foreground">
                                        {t('chatbot.ragStatus.training')} {embedStats.knowledge.embedded}/{embedStats.knowledge.total} ·
                                        {t('chatbot.ragStatus.products')} {embedStats.products.embedded}/{embedStats.products.total}
                                        {embedStats.knowledge.embedded + embedStats.products.embedded === 0 && (
                                            <span className="text-amber-600 ml-1">{t('chatbot.ragStatus.noData')}</span>
                                        )}
                                    </span>
                                ) : (
                                    <button className="text-violet-500 underline text-[10px]" onClick={loadEmbedStats}>{t('chatbot.ragStatus.checkStatus')}</button>
                                )}
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 border-violet-300 text-violet-700 hover:bg-violet-100"
                                disabled={embedLoading}
                                onClick={async () => {
                                    setEmbedLoading(true)
                                    try {
                                        const res = await fetch(`/api/admin/channels/${channelId}/bot-config/embed`, { method: 'POST' })
                                        const data = await res.json()
                                        if (data.success) {
                                            toast.success(t('chatbot.toasts.syncSuccess').replace('{embedded}', data.embedded).replace('{total}', data.total))
                                            await loadEmbedStats()
                                        } else {
                                            toast.error(data.error || t('chatbot.toasts.syncFailed'))
                                        }
                                    } catch { toast.error(t('chatbot.toasts.networkError')) }
                                    setEmbedLoading(false)
                                }}
                            >
                                {embedLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                {embedLoading ? t('chatbot.ragStatus.syncing') : t('chatbot.ragStatus.syncBtn')}
                            </Button>
                        </div>

                        <div className="w-full space-y-4">

                            {/* ── Saved Knowledge Entries ── */}
                            {trainingSubTab === 'saved' && (
                                <Card>
                                    <CardHeader className="py-3 px-4">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            {t('chatbot.learning.savedTrainingData')}
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
                                            <div className="grid grid-cols-6 gap-2 min-h-[200px] max-h-[480px] overflow-y-auto">
                                                {libraryImages.map(img => (
                                                    <div key={img.id} className="relative group" title={img.originalName || ''}>
                                                        <img src={img.thumbnailUrl || img.url} alt={img.originalName || ''}
                                                            className="h-24 w-full rounded object-cover border" />
                                                        <p className="text-[8px] text-muted-foreground truncate mt-0.5">{img.originalName}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {libraryImages.length === 0 && config?.imageFolderId && (
                                            <p className="text-xs text-muted-foreground text-center py-4">Thư mục chưa có ảnh — kéo thả ảnh vào bên dưới để thêm</p>
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
                                                            toast.error(err.error || t('chatbot.toasts.networkError'))
                                                        }
                                                    } catch {
                                                        toast.error(t('chatbot.toasts.networkError'))
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



                {/* ─── FORBIDDEN RULES TAB ──────────────────────────── */}
                {botTab === 'training' && trainingSubTab === 'forbidden' && (() => {
                    const QUICK_RULES = [
                        t('chatbot.forbidden.quickRule0'),
                        t('chatbot.forbidden.quickRule1'),
                        t('chatbot.forbidden.quickRule2'),
                        t('chatbot.forbidden.quickRule3'),
                        t('chatbot.forbidden.quickRule4'),
                        t('chatbot.forbidden.quickRule5'),
                        t('chatbot.forbidden.quickRule6'),
                        t('chatbot.forbidden.quickRule7'),
                        t('chatbot.forbidden.quickRule8'),
                        t('chatbot.forbidden.quickRule9'),
                    ]

                    return (
                        <div className="flex flex-col gap-5">
                            {/* Header banner */}
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                                <Ban className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-bold text-red-700 dark:text-red-400">{t('chatbot.forbidden.header')}</h3>
                                    <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                                        {t('chatbot.forbidden.headerDesc')}
                                    </p>
                                </div>
                            </div>

                            {/* Current rules */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                    {t('chatbot.forbidden.listLabel')} ({config.forbiddenTopics.length})
                                </label>
                                {config.forbiddenTopics.length === 0 && (
                                    <p className="text-xs text-muted-foreground italic text-center py-6 border border-dashed rounded-lg">
                                        {t('chatbot.forbidden.empty')}
                                    </p>
                                )}
                                <div className="flex flex-col gap-1.5">
                                    {config.forbiddenTopics.map((rule, i) => (
                                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 hover:border-red-300 dark:hover:border-red-800 transition-colors group">
                                            <span className="text-red-500 mt-0.5 text-sm shrink-0">🚫</span>
                                            <span className="text-xs flex-1 leading-relaxed">{rule}</span>
                                            <button
                                                onClick={() => update('forbiddenTopics', config.forbiddenTopics.filter((_, j) => j !== i))}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0 text-lg leading-none px-1"
                                            >×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Add new rule */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t('chatbot.forbidden.addLabel')}</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={newForbiddenTopic}
                                        onChange={e => setNewForbiddenTopic(e.target.value)}
                                        placeholder={t('chatbot.forbidden.addPlaceholder')}
                                        className="text-xs"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newForbiddenTopic.trim()) {
                                                update('forbiddenTopics', [...config.forbiddenTopics, newForbiddenTopic.trim()])
                                                setNewForbiddenTopic('')
                                            }
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={!newForbiddenTopic.trim()}
                                        onClick={() => {
                                            if (newForbiddenTopic.trim()) {
                                                update('forbiddenTopics', [...config.forbiddenTopics, newForbiddenTopic.trim()])
                                                setNewForbiddenTopic('')
                                            }
                                        }}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Quick add */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t('chatbot.forbidden.quickLabel')}</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {QUICK_RULES.filter(r => !config.forbiddenTopics.includes(r)).map(rule => (
                                        <button
                                            key={rule}
                                            onClick={() => update('forbiddenTopics', [...config.forbiddenTopics, rule])}
                                            className="text-[10px] px-2.5 py-1 rounded-full border border-dashed border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-400 transition-colors text-left"
                                        >
                                            + {rule}
                                        </button>
                                    ))}
                                    {QUICK_RULES.every(r => config.forbiddenTopics.includes(r)) && (
                                        <p className="text-[10px] text-muted-foreground italic">{t('chatbot.forbidden.allAdded')}</p>
                                    )}
                                </div>
                            </div>

                            {/* Save reminder */}
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3">
                                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                    💡 {t('chatbot.forbidden.saveReminder')}
                                </p>
                            </div>
                        </div>
                    )
                })()}

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
                                    <Label className="text-xs font-medium">{t('chatbot.learning.weeklySchedule')}</Label>
                                    <div className="space-y-1">
                                        {[
                                            { key: 'mon', label: t('chatbot.days.monday') },
                                            { key: 'tue', label: t('chatbot.days.tuesday') },
                                            { key: 'wed', label: t('chatbot.days.wednesday') },
                                            { key: 'thu', label: t('chatbot.days.thursday') },
                                            { key: 'fri', label: t('chatbot.days.friday') },
                                            { key: 'sat', label: t('chatbot.days.saturday') },
                                            { key: 'sun', label: t('chatbot.days.sunday') },
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
                                                        <span className="text-[10px] text-muted-foreground ml-auto italic">{t('chatbot.learning.botOff')}</span>
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
                                        {t('chatbot.learning.commentReplyDelay')}
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

                        {/* ─── Smart Memory ─── */}
                        <Card className="mt-4 border-violet-500/30 bg-violet-500/5">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Brain className="h-4 w-4 text-violet-500" />
                                    {t('chatbot.behavior.smartMemory')} — {t('chatbot.behavior.smartMemorySubtitle')}
                                </CardTitle>
                                <CardDescription className="text-[11px]">
                                    {t('chatbot.behavior.smartMemoryDesc')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-sm">{t('chatbot.behavior.smartMemoryEnable')}</Label>
                                        <p className="text-[11px] text-muted-foreground">{t('chatbot.behavior.smartMemoryEnableDesc')}</p>
                                    </div>
                                    <Switch
                                        checked={config.enableSmartMemory}
                                        onCheckedChange={v => update('enableSmartMemory', v)}
                                    />
                                </div>

                                {config.enableSmartMemory && (
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                                        <div>
                                            <Label className="text-[11px] text-muted-foreground">{t('chatbot.behavior.smartMemoryTimeout')}</Label>
                                            <p className="text-[10px] text-muted-foreground mb-1">{t('chatbot.behavior.smartMemoryTimeoutDesc')}</p>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={168}
                                                value={config.sessionTimeoutHours}
                                                onChange={e => update('sessionTimeoutHours', Math.max(1, parseInt(e.target.value) || 8))}
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-muted-foreground">{t('chatbot.behavior.smartMemoryMerge')}</Label>
                                            <p className="text-[10px] text-muted-foreground mb-1">{t('chatbot.behavior.smartMemoryMergeDesc')}</p>
                                            <Input
                                                type="number"
                                                min={2}
                                                max={20}
                                                value={config.summariesBeforeMerge}
                                                onChange={e => update('summariesBeforeMerge', Math.max(2, parseInt(e.target.value) || 5))}
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                )}

                                <p className="text-[10px] text-muted-foreground border-t pt-2 border-border/50">
                                    💡 {t('chatbot.behavior.smartMemoryHint')
                                        .replace('{hours}', String(config.sessionTimeoutHours))
                                        .replace('{merge}', String(config.summariesBeforeMerge))}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ─── PRODUCTS TAB ───────────────────── */}
                {botTab === 'training' && trainingSubTab === 'products' && (
                    <div className="space-y-4">
                        {/* Hidden CSV input */}
                        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setCsvImporting(true)
                            const form = new FormData()
                            form.append('file', file)
                            try {
                                const res = await fetch(`/api/admin/channels/${channelId}/products/import`, { method: 'POST', body: form })
                                const data = await res.json()
                                toast.success(`✅ ${t('chatbot.products.importSuccess').replace('{imported}', data.imported).replace('{updated}', data.updated)}${data.errors?.length ? `, ${data.errors.length} lỗi` : ''}`)
                                const r2 = await fetch(`/api/admin/channels/${channelId}/products`)
                                setProducts(Array.isArray(await r2.json()) ? await r2.json() : [])
                            } catch { toast.error(t('chatbot.products.importFailed')) }
                            setCsvImporting(false)
                            e.target.value = ''
                        }} />

                        {/* 📖 Usage Guide */}
                        <Card className="border-blue-500/30 bg-blue-500/5">
                            <CardContent className="pt-4 pb-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <FileText className="h-4 w-4 text-blue-500" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-3">
                                        <p className="text-sm font-medium text-blue-400">{t('chatbot.products.guideTitle')}</p>

                                        {/* Steps */}
                                        <div className="grid grid-cols-1 gap-1 text-[11px] text-muted-foreground">
                                            <p>1️⃣ <strong>{t('chatbot.products.step1').replace(' — Nhấn', '').replace(' — Click', '').replace('Add manually', '').replace('Thêm thủ công', '')}</strong>{t('chatbot.products.step1').includes('—') ? ' — ' : ''}{t('chatbot.products.step1').split('—')[0].trim() !== t('chatbot.products.step1') ? t('chatbot.products.step1').split('—').slice(1).join('—') : ''} <span className="font-mono bg-muted px-1 rounded">{t('chatbot.products.step1Btn')}</span> {t('chatbot.products.step1End')}</p>
                                            <p>2️⃣ {t('chatbot.products.step2')} <span className="font-mono bg-muted px-1 rounded">{t('chatbot.products.step2Btn')}</span></p>
                                            <p>3️⃣ {t('chatbot.products.step3')}</p>
                                        </div>

                                        {/* Service/Booking tip */}
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2.5 text-[11px]">
                                            <p className="font-medium text-amber-400 mb-1.5">💡 {t('chatbot.products.serviceTitle')}</p>
                                            <p className="text-muted-foreground mb-1">{t('chatbot.products.serviceDesc')} <strong>{t('chatbot.products.serviceFeatureField')}</strong>:</p>
                                            <div className="font-mono text-[10px] bg-background/60 rounded p-2 whitespace-pre-wrap text-muted-foreground leading-relaxed">{`Tên:      Phòng 101 - Karaoke VIP
Danh mục: Dịch vụ
Giá gốc:  200000   ← gói rẻ nhất

Tính năng:
Combo 2h: 200,000đ
Combo 3h: 280,000đ
Combo 5h: 400,000đ
Cú đêm (22h–6h): 500,000đ
── Add-ons ──
Thêm 1 giờ: +50,000đ
Combo đồ ăn A: +80,000đ
Combo đồ uống: +60,000đ`}</div>
                                            <p className="text-[10px] text-muted-foreground/70 mt-1.5">{t('chatbot.products.serviceBotHint')}</p>
                                        </div>

                                        {/* CSV format note */}
                                        <p className="text-[10px] text-muted-foreground/60">
                                            {t('chatbot.products.csvNote')} <strong>features</strong> {t('chatbot.products.csvPipe')} <code>|</code>), images ({t('chatbot.products.csvPipe')} <code>|</code>), tags ({t('chatbot.products.csvPipe')} <code>|</code>), in_stock
                                        </p>

                                        {/* Download buttons */}
                                        <div className="flex gap-3 flex-wrap">
                                            <button
                                                className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                                                onClick={() => {
                                                    const sampleCsv = `id,name,category,price,sale_price,description,features,images,tags,in_stock
SP001,Kem Dưỡng Ẩm Vitamin C,Skincare,350000,280000,Dưỡng ẩm 24h giúp da sáng khỏe,Không paraben|SPF30|Da hỗn hợp,https://example.com/img1.jpg|https://example.com/img2.jpg,kem|dưỡng|vitamin c,true
SP002,Serum Collagen Gold,Skincare,450000,,Tăng sinh collagen giảm nếp nhăn,Collagen cao cấp|Không hương liệu,https://example.com/serum.jpg,serum|collagen,true
DV001,Phòng 101 - Karaoke VIP,Dịch vụ,200000,,Phòng VIP sức chứa 10 người màn hình 4K,"Combo 2h: 200,000đ|Combo 3h: 280,000đ|Combo 5h: 400,000đ|Cú đêm (22h-6h): 500,000đ|── Add-ons ──|Thêm 1 giờ: +50,000đ|Combo đồ ăn A: +80,000đ|Combo đồ uống: +60,000đ",https://example.com/room101.jpg,phong-101|karaoke|vip|booking|combo,true
DV002,Phòng 102 - Tiêu chuẩn,Dịch vụ,150000,,Phòng tiêu chuẩn sức chứa 6 người,"Combo 2h: 150,000đ|Combo 3h: 210,000đ|Cú đêm: 380,000đ|── Add-ons ──|Thêm 1 giờ: +40,000đ",https://example.com/room102.jpg,phong-102|karaoke|booking,true
`
                                                    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' })
                                                    const url = URL.createObjectURL(blob)
                                                    const a = document.createElement('a')
                                                    a.href = url; a.download = 'sample_products.csv'; a.click()
                                                    URL.revokeObjectURL(url)
                                                }}
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                {t('chatbot.products.downloadSample')}
                                            </button>
                                            <button
                                                className="inline-flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                                                onClick={() => {
                                                    const serviceCsv = `id,name,category,price,sale_price,description,features,images,tags,in_stock
DV001,Phòng 101 - Karaoke VIP,Dịch vụ,200000,,Phòng VIP sức chứa 10 người màn hình 4K,"Combo 2h: 200,000đ|Combo 3h: 280,000đ|Combo 5h: 400,000đ|Cú đêm (22h-6h): 500,000đ|── Add-ons ──|Thêm 1 giờ: +50,000đ|Combo đồ ăn A: +80,000đ|Combo đồ uống: +60,000đ",https://example.com/room101.jpg,phong-101|karaoke|vip|booking|combo,true
DV002,Phòng 102 - Tiêu chuẩn,Dịch vụ,150000,,Phòng tiêu chuẩn sức chứa 6 người,"Combo 2h: 150,000đ|Combo 3h: 210,000đ|Cú đêm: 380,000đ|── Add-ons ──|Thêm 1 giờ: +40,000đ",https://example.com/room102.jpg,phong-102|karaoke|booking,true
`
                                                    const blob = new Blob([serviceCsv], { type: 'text/csv;charset=utf-8;' })
                                                    const url = URL.createObjectURL(blob)
                                                    const a = document.createElement('a')
                                                    a.href = url; a.download = 'sample_services.csv'; a.click()
                                                    URL.revokeObjectURL(url)
                                                }}
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                {t('chatbot.products.downloadService')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Toolbar */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder={t('chatbot.products.searchPlaceholder')}
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    className="h-8 text-xs pl-8"
                                />
                            </div>
                            <Button size="sm" variant="outline" disabled={csvImporting} onClick={() => csvInputRef.current?.click()}>
                                {csvImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                                {t('chatbot.products.importCsv')}
                            </Button>
                            <Button size="sm" onClick={() => {
                                setEditingProduct(null)
                                setNewProduct({ productId: '', name: '', category: '', price: '', salePrice: '', description: '', features: '', images: '', tags: '', inStock: true })
                                setShowProductForm(true)
                            }}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> {t('chatbot.products.addProduct')}
                            </Button>
                        </div>

                        {/* Table */}
                        {productsLoading ? (
                            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-sm">{t('chatbot.products.loading')}</span>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex flex-col items-center py-10 gap-2 text-muted-foreground">
                                <Package className="h-10 w-10 opacity-30" />
                                <p className="text-sm">{t('chatbot.products.empty')}</p>
                            </div>
                        ) : (
                            <div className="rounded-lg border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-muted/70 border-b">
                                                <th className="py-2 px-2 text-left font-medium text-muted-foreground w-[72px] border-r border-border/40">{t('chatbot.products.colImage')}</th>
                                                <th className="py-2 px-2 text-left font-medium text-muted-foreground border-r border-border/40">{t('chatbot.products.colName')}</th>
                                                <th className="py-2 px-2 text-left font-medium text-muted-foreground w-28 border-r border-border/40">{t('chatbot.products.colCategory')}</th>
                                                <th className="py-2 px-2 text-right font-medium text-muted-foreground w-28 border-r border-border/40">{t('chatbot.products.colPrice')}</th>
                                                <th className="py-2 px-2 text-right font-medium text-muted-foreground w-28 border-r border-border/40">{t('chatbot.products.colSalePrice')}</th>
                                                <th className="py-2 px-2 text-left font-medium text-muted-foreground border-r border-border/40">{t('chatbot.products.colTags')}</th>
                                                <th className="py-2 px-2 text-center font-medium text-muted-foreground w-16 border-r border-border/40">{t('chatbot.products.colStock')}</th>
                                                <th className="py-2 px-2 text-center font-medium text-muted-foreground w-20">…</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {products
                                                .filter(p => !productSearch ||
                                                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                                    p.productId?.toLowerCase().includes(productSearch.toLowerCase()) ||
                                                    p.category?.toLowerCase().includes(productSearch.toLowerCase())
                                                )
                                                .map(p => {
                                                    // Helper: start inline editing a field
                                                    const startEdit = (field: string, current: string) =>
                                                        setInlineEdit({ rowId: p.id, field, value: current })
                                                    // Helper: commit inline edit to DB
                                                    const commitEdit = async () => {
                                                        if (!inlineEdit || inlineEdit.rowId !== p.id) return
                                                        const { field, value } = inlineEdit
                                                        const patch: Record<string, unknown> = {}
                                                        if (field === 'name') patch.name = value
                                                        else if (field === 'category') patch.category = value || null
                                                        else if (field === 'price') patch.price = value ? parseFloat(value) : null
                                                        else if (field === 'salePrice') patch.salePrice = value ? parseFloat(value) : null
                                                        else if (field === 'tags') patch.tags = value.split(',').map(s => s.trim()).filter(Boolean)
                                                        setInlineEdit(null)
                                                        const res = await fetch(`/api/admin/channels/${channelId}/products/${p.id}`, {
                                                            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
                                                        })
                                                        const updated = await res.json()
                                                        setProducts(prev => prev.map(x => x.id === updated.id ? updated : x))
                                                    }
                                                    const isEditing = (field: string) => inlineEdit?.rowId === p.id && inlineEdit?.field === field
                                                    const InlineCell = ({ field, value, className = '', numeric = false }: { field: string; value: string; className?: string; numeric?: boolean }) => (
                                                        isEditing(field) ? (
                                                            <input
                                                                autoFocus
                                                                type={numeric ? 'number' : 'text'}
                                                                value={inlineEdit!.value}
                                                                onChange={e => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                                                onBlur={commitEdit}
                                                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setInlineEdit(null) }}
                                                                className={`w-full bg-primary/5 border border-primary rounded px-1.5 py-0.5 outline-none text-xs ${numeric ? 'text-right' : ''} ${className}`}
                                                            />
                                                        ) : (
                                                            <div
                                                                title={t('chatbot.products.clickToEdit')}
                                                                onClick={() => startEdit(field, value)}
                                                                className={`cursor-text min-h-[20px] px-0.5 rounded hover:bg-primary/10 transition-colors ${numeric ? 'text-right' : ''} ${className}`}
                                                            >
                                                                {value || <span className="text-muted-foreground/40 italic">—</span>}
                                                            </div>
                                                        )
                                                    )
                                                    return (
                                                        <tr key={p.id} className="hover:bg-muted/20 transition-colors group">
                                                            {/* Image thumbnail */}
                                                            <td className="py-1.5 px-2 border-r border-border/40">
                                                                <div className="flex gap-0.5">
                                                                    {p.images?.length > 0 ? (
                                                                        p.images.slice(0, 2).map((url, i) => (
                                                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                                                                <img src={url} alt="" className="h-9 w-9 rounded object-cover border hover:opacity-80" onError={e => (e.currentTarget.style.display = 'none')} />
                                                                            </a>
                                                                        ))
                                                                    ) : (
                                                                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center border">
                                                                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            {/* Name */}
                                                            <td className="py-1.5 px-2 border-r border-border/40">
                                                                <InlineCell field="name" value={p.name} className="font-medium" />
                                                                {p.productId && <div className="text-[10px] font-mono text-muted-foreground">{p.productId}</div>}
                                                            </td>
                                                            {/* Category */}
                                                            <td className="py-1.5 px-2 border-r border-border/40 text-muted-foreground">
                                                                <InlineCell field="category" value={p.category || ''} />
                                                            </td>
                                                            {/* Price */}
                                                            <td className="py-1.5 px-2 border-r border-border/40">
                                                                <InlineCell field="price" value={p.price?.toString() || ''} numeric />
                                                            </td>
                                                            {/* Sale Price */}
                                                            <td className="py-1.5 px-2 border-r border-border/40">
                                                                {isEditing('salePrice') ? (
                                                                    <input autoFocus type="number"
                                                                        value={inlineEdit!.value}
                                                                        onChange={e => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                                                        onBlur={commitEdit}
                                                                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setInlineEdit(null) }}
                                                                        className="w-full bg-primary/5 border border-primary rounded px-1.5 py-0.5 outline-none text-xs text-right"
                                                                    />
                                                                ) : (
                                                                    <div title="Click để sửa" onClick={() => startEdit('salePrice', p.salePrice?.toString() || '')} className="cursor-text text-right px-0.5 rounded hover:bg-primary/10 text-emerald-500 min-h-[20px]">
                                                                        {p.salePrice ? p.salePrice.toLocaleString('vi-VN') : <span className="text-muted-foreground/40 italic">—</span>}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            {/* Tags */}
                                                            <td className="py-1.5 px-2 border-r border-border/40">
                                                                {isEditing('tags') ? (
                                                                    <input autoFocus type="text"
                                                                        value={inlineEdit!.value}
                                                                        onChange={e => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                                                        onBlur={commitEdit}
                                                                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setInlineEdit(null) }}
                                                                        className="w-full bg-primary/5 border border-primary rounded px-1.5 py-0.5 outline-none text-xs"
                                                                        placeholder="tag1, tag2, ..."
                                                                    />
                                                                ) : (
                                                                    <div title="Click để sửa tags" onClick={() => startEdit('tags', p.tags.join(', '))} className="cursor-text px-0.5 rounded hover:bg-primary/10 min-h-[20px]">
                                                                        <div className="flex flex-wrap gap-0.5">
                                                                            {p.tags?.slice(0, 4).map((tag, i) => (
                                                                                <span key={i} className="bg-muted px-1 py-0.5 rounded text-[9px] text-muted-foreground">{tag}</span>
                                                                            ))}
                                                                            {(p.tags?.length || 0) > 4 && <span className="text-[9px] text-muted-foreground">+{p.tags.length - 4}</span>}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            {/* Stock toggle */}
                                                            <td className="py-1.5 px-2 border-r border-border/40 text-center">
                                                                <button
                                                                    title="Click để toggle"
                                                                    onClick={async () => {
                                                                        const res = await fetch(`/api/admin/channels/${channelId}/products/${p.id}`, {
                                                                            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inStock: !p.inStock })
                                                                        })
                                                                        const updated = await res.json()
                                                                        setProducts(prev => prev.map(x => x.id === updated.id ? updated : x))
                                                                    }}
                                                                >
                                                                    {p.inStock
                                                                        ? <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-muted">{t('chatbot.products.inStock')}</Badge>
                                                                        : <Badge variant="destructive" className="text-[10px] cursor-pointer">{t('chatbot.products.outOfStock')}</Badge>
                                                                    }
                                                                </button>
                                                            </td>
                                                            {/* Actions */}
                                                            <td className="py-1.5 px-2">
                                                                <div className="flex gap-0.5 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {/* Edit (full form) */}
                                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title={t('chatbot.products.editFull')}
                                                                        onClick={() => {
                                                                            setEditingProduct(p)
                                                                            setNewProduct({ productId: p.productId || '', name: p.name, category: p.category || '', price: p.price?.toString() || '', salePrice: p.salePrice?.toString() || '', description: p.description || '', features: p.features.join('\n'), images: p.images.join('\n'), tags: p.tags.join(', '), inStock: p.inStock })
                                                                            setShowProductForm(true)
                                                                        }}>
                                                                        <Edit className="h-3 w-3" />
                                                                    </Button>
                                                                    {/* Duplicate */}
                                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title={t('chatbot.products.duplicate')}
                                                                        onClick={async () => {
                                                                            const payload = { ...p, id: undefined, productId: p.productId ? `${p.productId}-copy` : null, name: `${p.name} (copy)` }
                                                                            const res = await fetch(`/api/admin/channels/${channelId}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                                                                            const created = await res.json()
                                                                            setProducts(prev => { const idx = prev.findIndex(x => x.id === p.id); const next = [...prev]; next.splice(idx + 1, 0, created); return next })
                                                                            toast.success(t('chatbot.products.duplicated'))
                                                                        }}>
                                                                        <Copy className="h-3 w-3" />
                                                                    </Button>
                                                                    {/* Delete */}
                                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" title={t('chatbot.products.delete')}
                                                                        onClick={async () => {
                                                                            if (!confirm('Xóa sản phẩm này?')) return
                                                                            await fetch(`/api/admin/channels/${channelId}/products/${p.id}`, { method: 'DELETE' })
                                                                            setProducts(prev => prev.filter(x => x.id !== p.id))
                                                                            toast.success(t('chatbot.products.deleted'))
                                                                        }}>
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-3 py-1.5 bg-muted/30 border-t text-[10px] text-muted-foreground">
                                    {products.length} {t('chatbot.products.footer')}
                                </div>
                            </div>
                        )}

                        {/* Add / Edit Product Form Dialog */}
                        {showProductForm && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowProductForm(false)}>
                                <div className="bg-background rounded-xl shadow-2xl w-[560px] max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
                                    <h4 className="font-semibold text-sm mb-4">{editingProduct ? t('chatbot.products.editTitle') : t('chatbot.products.addTitle')}</h4>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldId')}</label>
                                                <Input className="h-8 text-xs mt-1" placeholder="SP001" value={newProduct.productId} onChange={e => setNewProduct(p => ({ ...p, productId: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldCategory')}</label>
                                                <Input className="h-8 text-xs mt-1" placeholder="Skincare" value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldName')}</label>
                                            <Input className="h-8 text-xs mt-1" placeholder="Kem Dưỡng Ẩm Vitamin C" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldPrice')}</label>
                                                <Input className="h-8 text-xs mt-1" type="number" placeholder="350000" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldSalePrice')}</label>
                                                <Input className="h-8 text-xs mt-1" type="number" placeholder="280000" value={newProduct.salePrice} onChange={e => setNewProduct(p => ({ ...p, salePrice: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldDesc')}</label>
                                            <textarea className="w-full mt-1 text-xs p-2 border rounded-md bg-background resize-none h-20" placeholder="Mô tả sản phẩm..." value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldFeatures')}</label>
                                            <textarea className="w-full mt-1 text-xs p-2 border rounded-md bg-background resize-none h-16" placeholder="Không paraben&#10;SPF30&#10;Dành cho da hỗn hợp" value={newProduct.features} onChange={e => setNewProduct(p => ({ ...p, features: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldImages')}</label>
                                            <textarea className="w-full mt-1 text-xs p-2 border rounded-md bg-background resize-none h-16" placeholder="https://cdn.example.com/image1.jpg&#10;https://cdn.example.com/image2.jpg" value={newProduct.images} onChange={e => setNewProduct(p => ({ ...p, images: e.target.value }))} />
                                            {newProduct.images && (
                                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                                    {newProduct.images.split('\n').filter(u => u.trim().startsWith('http')).slice(0, 4).map((url, i) => (
                                                        <img key={i} src={url.trim()} alt="" className="h-14 w-14 rounded object-cover border" onError={e => (e.currentTarget.style.display = 'none')} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">{t('chatbot.products.fieldTags')}</label>
                                            <Input className="h-8 text-xs mt-1" placeholder="kem, dưỡng, vitamin c, spf" value={newProduct.tags} onChange={e => setNewProduct(p => ({ ...p, tags: e.target.value }))} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="inStockCheck" checked={newProduct.inStock} onChange={e => setNewProduct(p => ({ ...p, inStock: e.target.checked }))} />
                                            <label htmlFor="inStockCheck" className="text-xs">{t('chatbot.products.fieldInStock')}</label>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <Button variant="outline" size="sm" onClick={() => setShowProductForm(false)}>{t('chatbot.products.cancel')}</Button>
                                        <Button size="sm" disabled={!newProduct.name.trim()} onClick={async () => {
                                            const payload = {
                                                productId: newProduct.productId || null,
                                                name: newProduct.name,
                                                category: newProduct.category || null,
                                                price: newProduct.price ? parseFloat(newProduct.price) : null,
                                                salePrice: newProduct.salePrice ? parseFloat(newProduct.salePrice) : null,
                                                description: newProduct.description || null,
                                                features: newProduct.features.split('\n').map(s => s.trim()).filter(Boolean),
                                                images: newProduct.images.split('\n').map(s => s.trim()).filter(Boolean),
                                                tags: newProduct.tags.split(',').map(s => s.trim()).filter(Boolean),
                                                inStock: newProduct.inStock,
                                            }
                                            if (editingProduct) {
                                                const res = await fetch(`/api/admin/channels/${channelId}/products/${editingProduct.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                                                const updated = await res.json()
                                                setProducts(prev => prev.map(x => x.id === updated.id ? updated : x))
                                                toast.success(t('chatbot.products.updateSuccess'))
                                            } else {
                                                const res = await fetch(`/api/admin/channels/${channelId}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                                                const created = await res.json()
                                                setProducts(prev => [created, ...prev])
                                                toast.success(t('chatbot.products.addSuccess'))
                                            }
                                            setShowProductForm(false)
                                        }}>
                                            {editingProduct ? t('chatbot.products.saveChanges') : t('chatbot.products.addBtn')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── PROMOTIONS TAB ──────────────────── */}
                {botTab === 'training' && trainingSubTab === 'promotions' && (() => {
                    // Fetch promotions on first open
                    if (promotions.length === 0 && !promotionsLoading) {
                        setPromotionsLoading(true)
                        fetch(`/api/admin/channels/${channelId}/promotions`)
                            .then(r => r.json())
                            .then((data: Promotion[]) => { setPromotions(data || []) })
                            .catch(() => { })
                            .finally(() => setPromotionsLoading(false))
                    }
                    // Also fetch products if not loaded yet
                    if (products.length === 0 && !productsLoading) {
                        setProductsLoading(true)
                        fetch(`/api/admin/channels/${channelId}/products`)
                            .then(r => r.json())
                            .then((data: Product[]) => setProducts(data || []))
                            .catch(() => { })
                            .finally(() => setProductsLoading(false))
                    }

                    const savePromo = async () => {
                        const payload = {
                            name: newPromo.name,
                            description: newPromo.description || null,
                            startAt: newPromo.startAt,
                            endAt: newPromo.endAt,
                            isActive: newPromo.isActive,
                            priceGroups: newPromo.priceGroups,
                        }
                        if (editingPromo) {
                            const res = await fetch(`/api/admin/channels/${channelId}/promotions/${editingPromo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                            const updated: Promotion = await res.json()
                            setPromotions(prev => prev.map(p => p.id === updated.id ? updated : p))
                            toast.success('Promotion updated!')
                        } else {
                            const res = await fetch(`/api/admin/channels/${channelId}/promotions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                            const created: Promotion = await res.json()
                            setPromotions(prev => [created, ...prev])
                            toast.success('Promotion created!')
                        }
                        setShowPromoForm(false)
                        setEditingPromo(null)
                        setNewPromo(emptyPromo)
                    }

                    const deletePromo = async (id: string) => {
                        await fetch(`/api/admin/channels/${channelId}/promotions/${id}`, { method: 'DELETE' })
                        setPromotions(prev => prev.filter(p => p.id !== id))
                        toast.success('Promotion deleted!')
                    }

                    const openEdit = (p: Promotion) => {
                        setEditingPromo(p)
                        setNewPromo({
                            name: p.name,
                            description: p.description || '',
                            startAt: new Date(p.startAt).toISOString().slice(0, 16),
                            endAt: new Date(p.endAt).toISOString().slice(0, 16),
                            isActive: p.isActive,
                            priceGroups: p.priceGroups,
                        })
                        setShowPromoForm(true)
                    }

                    const addGroup = () => {
                        setNewPromo(prev => ({
                            ...prev,
                            priceGroups: [...prev.priceGroups, { groupName: '', direction: 'increase', adjustType: 'fixed', adjustment: 0, productIds: [] }]
                        }))
                    }

                    const updateGroup = <K extends keyof PriceGroup>(idx: number, field: K, val: PriceGroup[K]) => {
                        setNewPromo(prev => {
                            const groups = [...prev.priceGroups]
                            groups[idx] = { ...groups[idx], [field]: val }
                            return { ...prev, priceGroups: groups }
                        })
                    }

                    const removeGroup = (idx: number) => {
                        setNewPromo(prev => ({ ...prev, priceGroups: prev.priceGroups.filter((_, i) => i !== idx) }))
                    }

                    const toggleProductInGroup = (idx: number, productId: string) => {
                        setNewPromo(prev => {
                            const groups = [...prev.priceGroups]
                            const ids = groups[idx].productIds
                            groups[idx] = { ...groups[idx], productIds: ids.includes(productId) ? ids.filter(i => i !== productId) : [...ids, productId] }
                            return { ...prev, priceGroups: groups }
                        })
                    }

                    const now = new Date()
                    const getStatus = (p: Promotion) => {
                        if (!p.isActive) return { label: 'Tắt', cls: 'bg-muted text-muted-foreground' }
                        const s = new Date(p.startAt), e = new Date(p.endAt)
                        if (now < s) return { label: 'Sắp diễn ra', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' }
                        if (now > e) return { label: 'Đã kết thúc', cls: 'bg-muted text-muted-foreground' }
                        return { label: '🔥 Đang hoạt động', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
                    }

                    return (
                        <div className="flex flex-col gap-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold">Promotions & Holiday Pricing</h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Bot will automatically apply promotional pricing and notify customers during active promotion windows.</p>
                                </div>
                                <Button size="sm" onClick={() => { setEditingPromo(null); setNewPromo(emptyPromo); setShowPromoForm(true) }}>
                                    + Add Promotion
                                </Button>
                            </div>

                            {/* Form Dialog */}
                            {showPromoForm && (
                                <div className="border rounded-xl p-4 bg-muted/30 flex flex-col gap-4">
                                    <h4 className="text-sm font-semibold">{editingPromo ? 'Edit Promotion' : 'Create New Promotion'}</h4>

                                    {/* Basic info */}
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">Promotion name *</label>
                                            <Input className="h-8 text-xs mt-1" placeholder="Women's Day 8/3, Valentine 14/2, Black Friday..." value={newPromo.name} onChange={e => setNewPromo(p => ({ ...p, name: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-muted-foreground">Description (bot will use this to introduce the promotion to customers)</label>
                                            <textarea
                                                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[60px] outline-none focus:ring-1 focus:ring-ring"
                                                placeholder="e.g. Special offer for International Women's Day 8/3 — 20% off all rooms..."
                                                value={newPromo.description}
                                                onChange={e => setNewPromo(p => ({ ...p, description: e.target.value }))}
                                            />
                                        </div>
                                        {/* Date/time pickers */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[11px] text-muted-foreground">Start *</label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                                                    value={newPromo.startAt}
                                                    onChange={e => setNewPromo(p => ({ ...p, startAt: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] text-muted-foreground">End *</label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                                                    value={newPromo.endAt}
                                                    onChange={e => setNewPromo(p => ({ ...p, endAt: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="promoActive" checked={newPromo.isActive} onChange={e => setNewPromo(p => ({ ...p, isActive: e.target.checked }))} />
                                            <label htmlFor="promoActive" className="text-xs">Activate promotion</label>
                                        </div>
                                    </div>

                                    {/* Price Groups */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[11px] text-muted-foreground font-medium">Price adjustment groups</label>
                                            <button onClick={addGroup} className="text-[11px] text-primary hover:underline">+ Add group</button>
                                        </div>
                                        {newPromo.priceGroups.length === 0 && (
                                            <p className="text-[11px] text-muted-foreground italic">No groups yet. Click "+ Add group" to create a price adjustment group.</p>
                                        )}
                                        {newPromo.priceGroups.map((g, idx) => (
                                            <div key={idx} className="border rounded-lg p-3 mb-2 flex flex-col gap-2 bg-background">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        className="h-7 text-xs flex-1"
                                                        placeholder="Tên nhóm (VD: Combo 2h, Combo 3h)"
                                                        value={g.groupName}
                                                        onChange={e => updateGroup(idx, 'groupName', e.target.value)}
                                                    />
                                                    <button onClick={() => removeGroup(idx)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-[10px] text-muted-foreground">Direction</label>
                                                        <select
                                                            className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-xs outline-none"
                                                            value={g.direction}
                                                            onChange={e => updateGroup(idx, 'direction', e.target.value as 'increase' | 'decrease')}
                                                        >
                                                            <option value="increase">↑ Increase</option>
                                                            <option value="decrease">↓ Decrease</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-muted-foreground">Type</label>
                                                        <select
                                                            className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-xs outline-none"
                                                            value={g.adjustType}
                                                            onChange={e => updateGroup(idx, 'adjustType', e.target.value as 'fixed' | 'percent')}
                                                        >
                                                            <option value="fixed">Fixed ($)</option>
                                                            <option value="percent">Percent (%)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-muted-foreground">Amount {g.adjustType === 'fixed' ? '($)' : '(%)'}</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-xs outline-none"
                                                            value={g.adjustment || ''}
                                                            placeholder={g.adjustType === 'fixed' ? '9.99' : '10'}
                                                            onChange={e => updateGroup(idx, 'adjustment', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                </div>
                                                {/* Product searchable list */}
                                                <div className="mt-1">
                                                    <label className="text-[10px] text-muted-foreground">Apply to products ({g.productIds.length} selected)</label>
                                                    {productsLoading ? (
                                                        <p className="text-[10px] text-muted-foreground italic mt-1">Đang tải sản phẩm...</p>
                                                    ) : products.length === 0 ? (
                                                        <p className="text-[10px] text-muted-foreground italic mt-1">No products in catalog yet.</p>
                                                    ) : (
                                                        <div className="mt-1.5 border rounded-lg overflow-hidden">
                                                            {/* Search */}
                                                            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30">
                                                                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                <input
                                                                    type="text"
                                                                    className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-muted-foreground"
                                                                    placeholder="Search products..."
                                                                    value={promoProductSearch}
                                                                    onChange={e => setPromoProductSearch(e.target.value)}
                                                                />
                                                                {promoProductSearch && (
                                                                    <button onClick={() => setPromoProductSearch('')} className="text-muted-foreground hover:text-foreground text-xs">×</button>
                                                                )}
                                                            </div>
                                                            {/* Product list */}
                                                            <div className="max-h-40 overflow-y-auto">
                                                                {products
                                                                    .filter(prod => !promoProductSearch || prod.name.toLowerCase().includes(promoProductSearch.toLowerCase()) || (prod.category || '').toLowerCase().includes(promoProductSearch.toLowerCase()))
                                                                    .map(prod => {
                                                                        const checked = g.productIds.includes(prod.id)
                                                                        return (
                                                                            <button
                                                                                key={prod.id}
                                                                                onClick={() => toggleProductInGroup(idx, prod.id)}
                                                                                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-xs border-b last:border-b-0 ${checked
                                                                                    ? 'bg-primary/10 text-primary'
                                                                                    : 'hover:bg-muted/50 text-foreground'
                                                                                    }`}
                                                                            >
                                                                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-border'
                                                                                    }`}>
                                                                                    {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                                                                </div>
                                                                                <span className="flex-1 truncate">{prod.name}</span>
                                                                                {prod.price && <span className="text-[10px] text-muted-foreground shrink-0">${prod.price.toFixed(2)}</span>}
                                                                            </button>
                                                                        )
                                                                    })
                                                                }
                                                                {products.filter(prod => !promoProductSearch || prod.name.toLowerCase().includes(promoProductSearch.toLowerCase()) || (prod.category || '').toLowerCase().includes(promoProductSearch.toLowerCase())).length === 0 && (
                                                                    <p className="text-[10px] text-muted-foreground italic px-3 py-2">No products found.</p>
                                                                )}
                                                            </div>
                                                            {/* Selection summary */}
                                                            {g.productIds.length > 0 && (
                                                                <div className="px-3 py-1.5 bg-primary/5 border-t flex items-center justify-between">
                                                                    <span className="text-[10px] text-primary font-medium">✓ {g.productIds.length} product(s) selected</span>
                                                                    <button onClick={() => updateGroup(idx, 'productIds', [])} className="text-[10px] text-muted-foreground hover:text-red-500">Deselect all</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => { setShowPromoForm(false); setEditingPromo(null); setNewPromo(emptyPromo) }}>Cancel</Button>
                                        <Button size="sm" disabled={!newPromo.name.trim() || !newPromo.startAt || !newPromo.endAt} onClick={savePromo}>
                                            {editingPromo ? 'Save Changes' : 'Create Promotion'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Promotion list */}
                            {promotionsLoading && <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>}
                            {!promotionsLoading && promotions.length === 0 && !showPromoForm && (
                                <div className="text-center py-10 text-muted-foreground">
                                    <Tag className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No promotions yet</p>
                                    <p className="text-xs mt-1">Create a promotion so the bot automatically quotes special pricing to customers.</p>
                                </div>
                            )}
                            <div className="flex flex-col gap-3">
                                {promotions.map(p => {
                                    const status = getStatus(p)
                                    const start = new Date(p.startAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                                    const end = new Date(p.endAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                                    return (
                                        <div key={p.id} className="border rounded-xl p-3 flex flex-col gap-2 bg-background hover:border-primary/30 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold truncate">{p.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">⏰ {start} → {end}</p>
                                                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                                                    {(p.priceGroups || []).length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {p.priceGroups.map((g, i) => (
                                                                <span key={i} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                                                    {g.groupName}: {g.direction === 'increase' ? '↑' : '↓'} {g.adjustType === 'fixed' ? g.adjustment.toLocaleString('vi-VN') + 'đ' : g.adjustment + '%'} ({g.productIds.length} SP)
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => openEdit(p)} className="text-xs px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">Sửa</button>
                                                    <button onClick={() => deletePromo(p.id)} className="text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-400 hover:text-red-600">Xóa</button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })()}

                {/* ─── CHAT TEST TAB ───────────────────── */}

                {botTab === 'chattest' && (
                    <div className="space-y-4">
                        {/* Hidden image file input for chat */}
                        <input
                            ref={chatImageInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={async (e) => {
                                const files = e.target.files
                                if (!files || files.length === 0) return
                                setChatLoading(true)
                                try {
                                    const urls = await uploadFiles(files)
                                    setChatAttachments(prev => [...prev, ...urls])
                                } catch { toast.error('Không thể upload hình') }
                                setChatLoading(false)
                                e.target.value = ''
                            }}
                        />

                        <Card className="overflow-hidden">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <MessageCircle className="h-4 w-4 text-pink-500" />
                                            Chat Test — Trò chuyện thử với Bot
                                        </CardTitle>
                                        <CardDescription className="text-[11px] mt-0.5">
                                            Nhắn tin test trực tiếp với bot. Bot dùng đúng personality, knowledge base, và agent learning.
                                        </CardDescription>
                                    </div>
                                    {chatMessages.length > 0 && (
                                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 shrink-0"
                                            onClick={() => { setChatMessages([]); setChatAttachments([]); setChatInput('') }}>
                                            <RotateCcw className="h-3.5 w-3.5" /> Start Over
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {/* Chat messages area */}
                                <div className="h-[420px] overflow-y-auto p-4 space-y-3 bg-muted/20">
                                    {chatMessages.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full text-center">
                                            <Bot className="h-12 w-12 text-muted-foreground/30 mb-3" />
                                            <p className="text-sm text-muted-foreground">Bắt đầu trò chuyện với bot</p>
                                            <p className="text-[10px] text-muted-foreground/60 mt-1">Gõ tin nhắn hoặc đính kèm hình ảnh để test</p>
                                        </div>
                                    )}
                                    {chatMessages.map((msg, i) => {
                                        // Auto-parse image URLs from bot text
                                        const imgExtRe = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|avif)(\?\S*)?/gi
                                        const botInlineImages = msg.role === 'bot' ? Array.from(msg.content.matchAll(imgExtRe)).map(m => m[0]) : []
                                        const cleanBotText = msg.role === 'bot' ? msg.content.replace(imgExtRe, '').trim() : msg.content
                                        const allBotImages = [...(msg.imageUrls || []), ...botInlineImages]

                                        return (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user'
                                                    ? 'bg-primary text-primary-foreground rounded-br-md'
                                                    : 'bg-muted rounded-bl-md'
                                                    }`}>
                                                    {/* Text */}
                                                    <div className="whitespace-pre-wrap break-words">
                                                        {msg.role === 'bot' ? cleanBotText : msg.content}
                                                    </div>
                                                    {/* User attached images */}
                                                    {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="flex gap-1.5 mt-2 flex-wrap">
                                                            {msg.attachments.map((url, j) => (
                                                                <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                                                                    <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover border border-white/20 hover:opacity-90 transition-opacity" onError={e => (e.currentTarget.style.display = 'none')} />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Bot images: from API imageUrls + inline URLs parsed from text */}
                                                    {msg.role === 'bot' && allBotImages.length > 0 && (
                                                        <div className="flex gap-1.5 mt-2 flex-wrap">
                                                            {allBotImages.map((url, j) => (
                                                                <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                                                                    <img src={url} alt="" className="h-28 w-28 rounded-lg object-cover border hover:opacity-90 transition-opacity shadow-sm" onError={e => (e.currentTarget.style.display = 'none')} />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {chatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                                                <div className="flex gap-1.5">
                                                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Attachment preview strip */}
                                {chatAttachments.length > 0 && (
                                    <div className="px-3 pt-2 pb-0 flex gap-2 flex-wrap border-t bg-background">
                                        {chatAttachments.map((url, i) => (
                                            <div key={i} className="relative group">
                                                <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border" onError={e => (e.currentTarget.style.display = 'none')} />
                                                <button
                                                    className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setChatAttachments(prev => prev.filter((_, j) => j !== i))}
                                                >✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Input area */}
                                <div className="border-t p-3 flex gap-2 items-center">
                                    {/* Attach image button */}
                                    <Button
                                        size="sm" variant="ghost" className="h-9 w-9 p-0 shrink-0"
                                        title="Đính kèm hình ảnh"
                                        disabled={chatLoading}
                                        onClick={() => chatImageInputRef.current?.click()}
                                    >
                                        <Paperclip className="h-4 w-4" />
                                    </Button>
                                    <Input
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        placeholder="Nhập tin nhắn test..."
                                        className="flex-1"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey && !chatLoading) {
                                                e.preventDefault()
                                                sendChatMessage()
                                            }
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        disabled={(!chatInput.trim() && chatAttachments.length === 0) || chatLoading}
                                        onClick={sendChatMessage}
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ─── LEARNING TAB ─────────────────────── */}
                {botTab === 'learning' && (
                    <div className="space-y-4">
                        {/* Analyze Button */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-yellow-500" />
                                    🧠 {t('chatbot.learning.title')} — {t('chatbot.learning.subtitle')}
                                </CardTitle>
                                <CardDescription className="text-[11px]">
                                    {t('chatbot.learning.desc')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        disabled={learningLoading}
                                        onClick={async () => {
                                            setLearningLoading(true)
                                            try {
                                                const res = await fetch(`/api/admin/channels/${channelId}/bot-config/learn`, { method: 'POST' })
                                                const data = await res.json()
                                                if (data.agentLearning) {
                                                    setLearningData(normalizeLearningData(data.agentLearning))
                                                    toast.success(data.message || 'Learning complete!')
                                                } else {
                                                    toast.error(data.error || 'Learning failed')
                                                }
                                            } catch { toast.error('Network error') }
                                            setLearningLoading(false)
                                        }}
                                    >
                                        {learningLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Brain className="h-4 w-4 mr-1" />}
                                        {learningLoading ? t('chatbot.learning.analyzing') : t('chatbot.learning.analyzeBtn')}
                                    </Button>
                                    {!learningFetched && (
                                        <Button
                                            size="sm" variant="outline"
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(`/api/admin/channels/${channelId}/bot-config/learn`)
                                                    const data = await res.json()
                                                    if (data.agentLearning && Object.keys(data.agentLearning).length > 0) {
                                                        setLearningData(normalizeLearningData(data.agentLearning))
                                                    }
                                                    setLearningFetched(true)
                                                } catch { /* ignore */ }
                                            }}
                                        >
                                            <BarChart3 className="h-4 w-4 mr-1" /> {t('chatbot.learning.loadReport')}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Learning Report */}
                        {learningData && Object.keys(learningData).length > 0 && (
                            <div className="space-y-3">
                                {/* Stats Overview */}
                                <div className="grid grid-cols-3 gap-3">
                                    <Card className="bg-blue-50 dark:bg-blue-950/30">
                                        <CardContent className="py-3 text-center">
                                            <p className="text-2xl font-bold text-blue-600">{learningData.totalConversationsAnalyzed || 0}</p>
                                            <p className="text-[10px] text-muted-foreground">{t('chatbot.learning.conversationsAnalyzed')}</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-green-50 dark:bg-green-950/30">
                                        <CardContent className="py-3 text-center">
                                            <p className="text-2xl font-bold text-green-600">{learningData.totalAgentMessages || 0}</p>
                                            <p className="text-[10px] text-muted-foreground">{t('chatbot.learning.agentMessages')}</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-purple-50 dark:bg-purple-950/30">
                                        <CardContent className="py-3 text-center">
                                            <p className="text-2xl font-bold text-purple-600">{learningData.totalPairsAnalyzed || 0}</p>
                                            <p className="text-[10px] text-muted-foreground">{t('chatbot.learning.qaPairsLearned')}</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Vocabulary */}
                                {learningData.vocabulary?.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs flex items-center gap-2">📝 {t('chatbot.learning.vocabularyTitle')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-1.5">
                                                {learningData.vocabulary.map((word: string, i: number) => (
                                                    <Badge key={i} variant="secondary" className="text-[10px]">{word}</Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Slang & Abbreviations */}
                                {learningData.slangAndAbbreviations?.length > 0 && (
                                    <Card className="border-pink-200 dark:border-pink-800">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs flex items-center gap-2">🔥 {t('chatbot.learning.slangTitle')}</CardTitle>
                                            <CardDescription className="text-[10px]">{t('chatbot.learning.slangDesc')}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-1.5">
                                                {learningData.slangAndAbbreviations.map((term: string, i: number) => (
                                                    <Badge key={i} variant="outline" className="text-[10px] border-pink-300 text-pink-700 dark:text-pink-400">{term}</Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Greeting & Closing Styles */}
                                <div className="grid grid-cols-2 gap-3">
                                    {learningData.greetingStyles?.length > 0 && (
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-xs">👋 {t('chatbot.learning.greetingTitle')}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ul className="space-y-1">
                                                    {learningData.greetingStyles.map((s: string, i: number) => (
                                                        <li key={i} className="text-[11px] text-muted-foreground">• {s}</li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    )}
                                    {learningData.closingStyles?.length > 0 && (
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-xs">🤝 {t('chatbot.learning.closingTitle')}</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ul className="space-y-1">
                                                    {learningData.closingStyles.map((s: string, i: number) => (
                                                        <li key={i} className="text-[11px] text-muted-foreground">• {s}</li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                {/* Dealing Patterns */}
                                {learningData.dealingPatterns?.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs flex items-center gap-2">🎯 {t('chatbot.learning.dealingTitle')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {learningData.dealingPatterns.map((p: any, i: number) => (
                                                    <div key={i} className="p-2 bg-muted/40 rounded-md">
                                                        <p className="text-[11px] font-medium">🔹 {p.scenario}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">→ {p.approach}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Key Phrases */}
                                {learningData.keyPhrases?.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs">💬 {t('chatbot.learning.keyPhrasesTitle')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-1.5">
                                                {learningData.keyPhrases.map((phrase: string, i: number) => (
                                                    <Badge key={i} className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{phrase}</Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Customer Handling Techniques */}
                                {learningData.customerHandlingTechniques?.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs">🛠️ {t('chatbot.learning.techniquesTitle')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ul className="space-y-1">
                                                {learningData.customerHandlingTechniques.map((tech: string, i: number) => (
                                                    <li key={i} className="text-[11px] text-muted-foreground">• {tech}</li>
                                                ))}
                                            </ul>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Tone Analysis */}
                                {learningData.toneAnalysis && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs">🎭 {t('chatbot.learning.toneTitle')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="p-2 bg-muted/40 rounded text-[11px]">
                                                    <span className="text-muted-foreground">{t('chatbot.learning.formality')}</span> <strong>{learningData.toneAnalysis.formality}</strong>
                                                </div>
                                                <div className="p-2 bg-muted/40 rounded text-[11px]">
                                                    <span className="text-muted-foreground">{t('chatbot.learning.emoji')}</span> <strong>{learningData.toneAnalysis.emojiUsage}</strong>
                                                </div>
                                                <div className="p-2 bg-muted/40 rounded text-[11px]">
                                                    <span className="text-muted-foreground">{t('chatbot.learning.avgLength')}</span> <strong>{learningData.toneAnalysis.avgMessageLength} chars</strong>
                                                </div>
                                                {learningData.toneAnalysis.writingStyle && (
                                                    <div className="p-2 bg-muted/40 rounded text-[11px]">
                                                        <span className="text-muted-foreground">{t('chatbot.learning.style')}</span> <strong>{learningData.toneAnalysis.writingStyle}</strong>
                                                    </div>
                                                )}
                                                {learningData.toneAnalysis.languages?.length > 0 && (
                                                    <div className="p-2 bg-muted/40 rounded text-[11px] col-span-2">
                                                        <span className="text-muted-foreground">{t('chatbot.learning.languages')}</span> <strong>{learningData.toneAnalysis.languages.join(', ')}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Last analyzed */}
                                {learningData.lastAnalyzedAt && (
                                    <p className="text-[10px] text-muted-foreground text-right">
                                        ⏰ {t('chatbot.learning.lastAnalyzed')} {new Date(learningData.lastAnalyzedAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── USAGE ANALYTICS TAB ─────────────────────── */}
                {botTab === 'usage' && planLimits?.hasBotUsageAnalytics && (() => {
                    if (!usageData && !usageLoading) loadUsageData(usagePeriod)
                    const periods = [
                        { key: 'today' as const, label: 'Hôm nay' },
                        { key: '7d' as const, label: '7 ngày' },
                        { key: '30d' as const, label: '30 ngày' },
                        { key: 'year' as const, label: 'Năm nay' },
                    ]
                    const maxBarTokens = usageData?.byDate?.reduce((m: number, d: any) => Math.max(m, d.tokens), 0) || 1
                    const maxModelTokens = usageData?.byModel?.reduce((m: number, d: any) => Math.max(m, d.tokens), 0) || 1
                    const fmtNum = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
                    const modelColors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-violet-500" />
                                        📊 Bot Usage Analytics
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Token sử dụng mỗi lần bot trả lời</p>
                                </div>
                                <div className="flex gap-1">
                                    {periods.map(p => (
                                        <button key={p.key}
                                            onClick={() => { setUsagePeriod(p.key); loadUsageData(p.key) }}
                                            className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors ${usagePeriod === p.key ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                        >{p.label}</button>
                                    ))}
                                </div>
                            </div>

                            {usageLoading && (
                                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                                </div>
                            )}
                            {!usageLoading && !usageData && (
                                <div className="text-center py-10 text-muted-foreground text-sm">Không có dữ liệu</div>
                            )}
                            {!usageLoading && usageData && (
                                <>
                                    {/* Stat Cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-xl border bg-muted/30 p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Tổng tokens</p>
                                            <p className="text-xl font-bold text-violet-500">{fmtNum(usageData.totalTokens)}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">↑ {fmtNum(usageData.promptTokens)} in / {fmtNum(usageData.completionTokens)} out</p>
                                        </div>
                                        <div className="rounded-xl border bg-muted/30 p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Số lần bot trả lời</p>
                                            <p className="text-xl font-bold text-blue-500">{fmtNum(usageData.repliesCount)}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {usageData.repliesCount > 0 ? `~${fmtNum(Math.round(usageData.totalTokens / usageData.repliesCount))} token/reply` : '—'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border bg-muted/30 p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Model chính</p>
                                            <p className="text-sm font-bold text-emerald-500 truncate">{usageData.topModel || '—'}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1 capitalize">{usageData.provider || '—'}</p>
                                        </div>
                                    </div>

                                    {/* API Key */}
                                    {usageData.apiKeyMasked && (
                                        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-[11px]">
                                            <span className="text-muted-foreground">🔑 API Key:</span>
                                            <code className="font-mono text-yellow-600 dark:text-yellow-400">{usageData.apiKeyMasked}</code>
                                            <span className="text-muted-foreground ml-auto capitalize">{usageData.provider}</span>
                                        </div>
                                    )}

                                    {/* Bar Chart by Day */}
                                    {usageData.byDate?.length > 0 && (
                                        <div className="rounded-xl border bg-muted/20 p-3">
                                            <p className="text-[11px] font-medium text-muted-foreground mb-3">Token theo ngày</p>
                                            <div className="flex items-end gap-0.5 h-24">
                                                {usageData.byDate.map((d: any) => {
                                                    const pct = Math.max(4, Math.round((d.tokens / maxBarTokens) * 100))
                                                    return (
                                                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${fmtNum(d.tokens)} tokens`}>
                                                            <div className="w-full rounded-sm bg-violet-500/70 hover:bg-violet-500 transition-all cursor-default" style={{ height: `${pct}%` }} />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[10px] text-muted-foreground">{usageData.byDate[0]?.date?.slice(5)}</span>
                                                <span className="text-[10px] text-muted-foreground">{usageData.byDate[usageData.byDate.length - 1]?.date?.slice(5)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Model Breakdown */}
                                    {usageData.byModel?.length > 0 && (
                                        <div className="rounded-xl border bg-muted/20 p-3">
                                            <p className="text-[11px] font-medium text-muted-foreground mb-3">Phân tích theo Model</p>
                                            <div className="space-y-2.5">
                                                {usageData.byModel.map((m: any, i: number) => {
                                                    const pct = Math.max(4, Math.round((m.tokens / maxModelTokens) * 100))
                                                    return (
                                                        <div key={m.model} className="space-y-1">
                                                            <div className="flex justify-between items-center text-[11px]">
                                                                <span className="font-mono font-medium">{m.model}</span>
                                                                <div className="flex gap-3 text-muted-foreground">
                                                                    <span>{fmtNum(m.tokens)} tokens</span>
                                                                    <span>{m.replies} replies</span>
                                                                </div>
                                                            </div>
                                                            <div className="h-1.5 w-full rounded-full bg-muted">
                                                                <div className={`h-1.5 rounded-full ${modelColors[i % modelColors.length]}`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )
                })()}



                {/* ─── ACCOUNTS (PER PAGE) TAB ─────────────── */}
                {botTab === 'pages' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <LayoutGrid className="h-4 w-4 text-orange-500" />
                            <div>
                                <h4 className="font-medium text-sm">Bot theo tài khoản</h4>
                                <p className="text-xs text-muted-foreground">Bật/tắt bot riêng cho từng trang đã kết nối</p>
                            </div>
                            {pageAccounts.length > 0 && (
                                <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    {pageAccounts.filter(p => p.botEnabled).length}/{pageAccounts.length} active
                                </span>
                            )}
                        </div>
                        {pageAccounts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                                <LayoutGrid className="h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">Chưa có tài khoản nào được kết nối</p>
                                <p className="text-xs text-muted-foreground">Thêm tài khoản trong tab <strong>Connections</strong> của channel</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {pageAccounts.map(page => (
                                    <div key={page.id} className="flex items-center justify-between py-2 px-3 rounded-lg border hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {page.platform === 'facebook' ? (
                                                <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#1877F2" /><path d="M16.5 12.05h-2.7V18h-2.93v-5.95H9.5v-2.5h1.37V7.88c0-1.97.84-3.13 3.17-3.13h1.95v2.5h-1.22c-.91 0-.97.34-.97.97v1.33h2.22l-.52 2.5z" fill="#fff" /></svg>
                                            ) : page.platform === 'instagram' ? (
                                                <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none"><defs><linearGradient id={`ig2-${page.id}`} x1="0" y1="24" x2="24" y2="0"><stop offset="0%" stopColor="#FED373" /><stop offset="25%" stopColor="#F15245" /><stop offset="50%" stopColor="#D92E7F" /><stop offset="75%" stopColor="#9B36B7" /><stop offset="100%" stopColor="#515ECF" /></linearGradient></defs><circle cx="12" cy="12" r="12" fill={`url(#ig2-${page.id})`} /><rect x="5" y="5" width="14" height="14" rx="4" stroke="#fff" strokeWidth="1.5" fill="none" /><circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.5" fill="none" /><circle cx="16.5" cy="7.5" r="1" fill="#fff" /></svg>
                                            ) : page.platform === 'tiktok' ? (
                                                <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#000" /><path d="M16.5 7.5a3.5 3.5 0 01-2.5-1V13a4 4 0 11-4-4v2a2 2 0 102 2V5h2a3.5 3.5 0 002.5 2.5z" fill="#fff" /></svg>
                                            ) : page.platform === 'youtube' ? (
                                                <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#FF0000" /><path d="M10 15.5v-7l6 3.5-6 3.5z" fill="#fff" /></svg>
                                            ) : page.platform === 'x' || page.platform === 'twitter' ? (
                                                <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#000" /><path d="M13.8 10.5L18 6h-1.3l-3.6 3.9L10 6H6l4.4 6.4L6 17h1.3l3.8-4.1L14.3 17H18l-4.2-6.5zm-1.3 1.5l-.5-.6L8 7h1.5l3 4.2.5.6L17 16h-1.5l-3-4z" fill="#fff" /></svg>
                                            ) : page.platform === 'linkedin' ? (
                                                <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#0A66C2" /><path d="M8.5 10v6h-2v-6h2zm-1-3.2a1.15 1.15 0 110 2.3 1.15 1.15 0 010-2.3zM10 10h1.9v.8a2.1 2.1 0 011.9-1c2 0 2.4 1.3 2.4 3.1V16h-2v-2.8c0-.7 0-1.6-1-1.6s-1.1.7-1.1 1.5V16H10v-6z" fill="#fff" /></svg>
                                            ) : page.platform === 'zalo' ? (
                                                <span className="h-6 w-6 flex-shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold">ZL</span>
                                            ) : (
                                                <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#666" /><path d="M12 7a2 2 0 00-2 2v2H8v3h2v6h3v-6h2l.5-3H13V9.5a.5.5 0 01.5-.5H15V7h-3z" fill="#fff" /></svg>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{page.accountName}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{page.platform}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-xs ${page.botEnabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                {page.botEnabled ? 'On' : 'Off'}
                                            </span>
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
                                                        toast.success(v ? `Bot ON: ${page.accountName}` : `Bot OFF: ${page.accountName}`)
                                                    } catch {
                                                        toast.error('Lỗi cập nhật')
                                                        setPageAccounts(prev => prev.map(p =>
                                                            p.id === page.id ? { ...p, botEnabled: !v } : p
                                                        ))
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
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

            {/* ─── BOT CONTEXT PREVIEW DIALOG ─── */}
            {contextPreview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setContextPreview(null)}
                >
                    <div
                        className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <div>
                                <h2 className="font-bold text-base flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-blue-500" />
                                    Context Bot hiện tại
                                </h2>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Generated {new Date(contextPreview.generatedAt).toLocaleString('vi-VN')} — đây là mọi thứ bot đang biết lúc này
                                </p>
                            </div>
                            <button onClick={() => setContextPreview(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
                            {contextPreview.sections.map((sec, i) => (
                                <div key={i} className="rounded-xl border bg-muted/40 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b">
                                        <span className="font-semibold text-xs uppercase tracking-wide">{sec.label}</span>
                                        <span className="text-[11px] bg-background border rounded-full px-2 py-0.5 font-mono">{sec.count}</span>
                                    </div>
                                    <pre className="px-4 py-3 text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground overflow-x-auto max-h-48">
                                        {sec.content}
                                    </pre>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t flex justify-between items-center">
                            <p className="text-[11px] text-muted-foreground">💡 Bot tự đọc context này mỗi lần trả lời — không cần reload thủ công</p>
                            <Button size="sm" variant="outline" onClick={() => setContextPreview(null)}>Đóng</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
