'use client'
import React from 'react'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from '@/lib/i18n'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { use } from 'react'
import {
    ArrowLeft,
    Save,
    Megaphone,
    Globe,
    Settings,
    BookOpen,
    FileText,
    Hash,
    Bell,
    Palette,
    Plus,
    Trash2,
    Link as LinkIcon,
    FileSpreadsheet,
    Type,
    ExternalLink,
    GripVertical,
    Sparkles,
    Loader2,
    Send,
    Zap,
    Download,
    Search,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    Users,
    UserPlus,
    Shield,
    ChevronDown,
    ChevronUp,
    Check,
    Eye,
    EyeOff,
    X,
    Phone,
    MapPin,
    Globe as Globe2,
    Target,
    Lightbulb,
    Bot,
    MessageSquareDot,
    Pencil,
    Camera,
} from 'lucide-react'
import ChatBotTab from './ChatBotTab'
import AutoContentTab from './AutoContentTab'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

// ─── Types ──────────────────────────────────────────
interface KnowledgeEntry {
    id: string
    title: string
    sourceType: string
    sourceUrl: string | null
    content: string
    createdAt: string
}

interface ContentTemplate {
    id: string
    name: string
    platform: string | null
    templateContent: string
    variables: string[]
    createdAt: string
}

interface HashtagGroup {
    id: string
    name: string
    hashtags: string[]
    usageCount: number
}

interface AiProviderInfo {
    id: string
    provider: string
    name: string
    status: string
    hasApiKey: boolean
}

interface AiModelInfo {
    id: string
    name: string
    type: string
    description?: string
}

interface ChannelPlatformEntry {
    id: string
    platform: string
    accountId: string
    accountName: string
    avatarUrl?: string | null
    isActive: boolean
    config?: Record<string, unknown>
}

const platformIcons: Record<string, React.ReactNode> = {
    facebook: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
    ),
    instagram: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#E4405F"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z" /></svg>
    ),
    youtube: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
    ),
    tiktok: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
    ),
    x: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
    ),
    linkedin: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
    ),
    pinterest: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#E60023"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" /></svg>
    ),
    gbp: (
        <svg viewBox="0 0 64 64" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="30" width="48" height="28" rx="3" fill="#4285F4" />
            <path d="M8 44 L56 58 L56 30 L8 30Z" fill="#3367D6" opacity="0.4" />
            <path d="M4 20 Q32 14 60 20 L56 34 Q32 28 8 34Z" fill="#4285F4" />
            <path d="M4 20 Q12 17 20 20 L16 34 Q8 31 4 34Z" fill="#3367D6" />
            <path d="M20 20 Q28 17 36 20 L32 34 Q24 31 20 34Z" fill="#3367D6" />
            <path d="M36 20 Q44 17 52 20 L48 34 Q40 31 36 34Z" fill="#3367D6" />
            <path d="M52 20 Q56 18 60 20 L56 34 Q52 32 48 34Z" fill="#3367D6" />
            <ellipse cx="32" cy="34" rx="24" ry="4" fill="#3367D6" />
            <circle cx="44" cy="46" r="10" fill="white" />
            <path d="M49 46h-5.5v2.5h3.2c-0.3 1.5-1.6 2.5-3.2 2.5-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5c0.9 0 1.7 0.3 2.3 0.9l1.8-1.8C46.7 42.4 45.4 42 44 42c-3 0-5.5 2.5-5.5 5.5S41 53 44 53c3 0 5.5-2.5 5.5-5.5 0-0.3 0-0.6-0.5-1.5z" fill="#4285F4" />
        </svg>
    ),
    threads: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.56c-1.096-3.98-3.832-5.988-8.136-5.974h-.013c-2.806.02-4.929.926-6.31 2.694-1.296 1.66-1.974 4.074-2.013 7.169.039 3.094.717 5.508 2.014 7.168 1.382 1.77 3.505 2.674 6.31 2.694h.013c2.447-.017 4.33-.604 5.6-1.745 1.358-1.222 2.065-2.979 2.1-5.222l.008-.018c-.033-.632-.185-1.163-.452-1.578-.396-.615-.98-1.004-1.636-1.089-.508-.065-1.021.012-1.389.211-.182.098-.333.228-.424.396.182.32.321.676.414 1.065.14.587.147 1.266.02 1.916-.232 1.186-.899 2.183-1.881 2.81-.893.571-1.99.83-3.176.748-1.523-.105-2.862-.733-3.769-1.768-.823-.94-1.276-2.163-1.312-3.54-.036-1.392.353-2.647 1.126-3.636.87-1.113 2.193-1.82 3.829-2.046.776-.107 1.534-.113 2.249-.02-.022-1.123-.177-2.023-.489-2.755-.397-.932-1.05-1.461-1.941-1.574-.505-.064-1.037.02-1.449.23-.255.13-.471.312-.639.538l-1.596-1.297c.34-.417.77-.756 1.276-1.006.774-.384 1.655-.56 2.542-.51 1.48.084 2.652.72 3.482 1.89.764 1.076 1.162 2.522 1.182 4.298l.003.188c1.116.115 2.098.588 2.804 1.395.828.946 1.24 2.198 1.194 3.627-.037 2.656-.912 4.824-2.602 6.445-1.619 1.553-3.937 2.35-6.887 2.37zM9.206 14.633c.013.557.17 1.032.468 1.372.366.418.918.65 1.601.674.711.024 1.379-.135 1.876-.447.436-.273.74-.672.858-1.123.076-.294.087-.624.031-.954-.086-.51-.389-.91-.82-1.09-.314-.13-.72-.182-1.14-.145-1.235.108-2.469.65-2.874 1.713z" /></svg>
    ),
    bluesky: (
        <svg viewBox="0 0 600 530" className="w-4 h-4" fill="#0085ff" xmlns="http://www.w3.org/2000/svg">
            <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 590 -17.88 590 68.825c0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.19-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.193.516-3.707 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.098-34.605-132.23 82.697-152.19-67.108 11.421-142.55-7.45-163.25-81.433C20.15 217.613 10 86.535 10 68.825c0-86.703 77.742-60.816 125.72-24.795z" />
        </svg>
    ),
}


const platformOptions = [
    { value: 'facebook', label: 'Facebook', color: '#1877F2' },
    { value: 'instagram', label: 'Instagram', color: '#E4405F' },
    { value: 'youtube', label: 'YouTube', color: '#FF0000' },
    { value: 'tiktok', label: 'TikTok', color: '#00F2EA' },
    { value: 'x', label: 'X / Twitter', color: '#000000' },
    { value: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
    { value: 'pinterest', label: 'Pinterest', color: '#E60023' },
    { value: 'gbp', label: 'Google Business', color: '#4285F4' },
    { value: 'threads', label: 'Threads', color: '#000000' },
    { value: 'bluesky', label: 'Bluesky', color: '#0085ff' },
]

interface ChannelDetail {
    id: string
    name: string
    displayName: string
    description: string | null
    isActive: boolean
    language: string
    descriptionsPerPlatform: Record<string, string>
    vibeTone: Record<string, string>
    seoTags: string[]
    colorPalette: string[]
    notificationEmail: string | null
    requireApproval: string  // 'none' | 'optional' | 'required'
    storageProvider: string | null
    useDefaultStorage: boolean
    webhookDiscord: Record<string, string>
    webhookTelegram: Record<string, string>
    webhookSlack: Record<string, string>
    webhookCustom: Record<string, string>
    knowledgeBase: KnowledgeEntry[]
    contentTemplates: ContentTemplate[]
    hashtagGroups: HashtagGroup[]
    _count: { posts: number; mediaItems: number }
    defaultAiProvider: string | null
    defaultAiModel: string | null
    defaultImageProvider: string | null
    defaultImageModel: string | null
    brandProfile: {
        targetAudience?: string
        contentTypes?: string
        brandValues?: string
        communicationStyle?: string
    } | null
    businessInfo: {
        phone?: string
        address?: string
        website?: string
        socials?: Record<string, string>
        custom?: { label: string; url: string }[]
    } | null
}

const sourceTypeIcons: Record<string, typeof Type> = {
    text: Type,
    url: LinkIcon,
    google_sheet: FileSpreadsheet,
    file: FileText,
}

const sourceTypeLabels: Record<string, string> = {
    text: 'Text',
    url: 'URL',
    google_sheet: 'Google Sheets',
    file: 'File',
}

// ─── Page ───────────────────────────────────────────
export default function ChannelDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const t = useTranslation()
    const router = useRouter()
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER'
    const isAdminOrManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER'
    const [channel, setChannel] = useState<ChannelDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)
    const isInitialLoad = useRef(true)
    const [analyzing, setAnalyzing] = useState(false)
    const [activeTab, setActiveTab] = useState('general')

    // Editable fields
    const [displayName, setDisplayName] = useState('')
    const [description, setDescription] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const [language, setLanguage] = useState('en')
    const [timezone, setTimezone] = useState('UTC')
    const [isActive, setIsActive] = useState(true)
    const [notificationEmail, setNotificationEmail] = useState('')
    const [requireApproval, setRequireApproval] = useState<'none' | 'optional' | 'required'>('none')
    const [vibeTone, setVibeTone] = useState<Record<string, string>>({})

    // Knowledge Base state
    const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([])
    const [newKbTitle, setNewKbTitle] = useState('')
    const [newKbType, setNewKbType] = useState('text')
    const [newKbUrl, setNewKbUrl] = useState('')
    const [newKbContent, setNewKbContent] = useState('')
    const [addingKb, setAddingKb] = useState(false)

    // Content Templates state
    const [templates, setTemplates] = useState<ContentTemplate[]>([])
    const [newTplName, setNewTplName] = useState('')
    const [newTplContent, setNewTplContent] = useState('')
    const [addingTpl, setAddingTpl] = useState(false)

    // Hashtag Groups state
    const [hashtags, setHashtags] = useState<HashtagGroup[]>([])
    const [newHashName, setNewHashName] = useState('')
    const [newHashTags, setNewHashTags] = useState('')
    const [addingHash, setAddingHash] = useState(false)

    // AI provider/model
    const [aiProvider, setAiProvider] = useState('')
    const [aiModel, setAiModel] = useState('')
    const [imageProvider, setImageProvider] = useState('')
    const [imageModel, setImageModel] = useState('')
    const [requireOwnApiKey, setRequireOwnApiKey] = useState(false)
    const [generatingDesc, setGeneratingDesc] = useState(false)
    const [generatingVibe, setGeneratingVibe] = useState(false)
    const [newVibeFieldName, setNewVibeFieldName] = useState('')
    const [addingVibeField, setAddingVibeField] = useState(false)
    const [availableProviders, setAvailableProviders] = useState<AiProviderInfo[]>([])
    const [availableModels, setAvailableModels] = useState<AiModelInfo[]>([])
    const [availableImageModels, setAvailableImageModels] = useState<AiModelInfo[]>([])
    const [loadingModels, setLoadingModels] = useState(false)
    const [loadingImageModels, setLoadingImageModels] = useState(false)
    const [userConfiguredProviders, setUserConfiguredProviders] = useState<string[]>([])

    // Webhook state
    const [webhookDiscordUrl, setWebhookDiscordUrl] = useState('')
    const [webhookTelegramToken, setWebhookTelegramToken] = useState('')
    const [webhookTelegramChatId, setWebhookTelegramChatId] = useState('')
    const [webhookSlackUrl, setWebhookSlackUrl] = useState('')
    const [webhookCustomUrl, setWebhookCustomUrl] = useState('')
    const [webhookZaloAppId, setWebhookZaloAppId] = useState('')
    const [webhookZaloSecretKey, setWebhookZaloSecretKey] = useState('')
    const [webhookZaloRefreshToken, setWebhookZaloRefreshToken] = useState('')
    const [webhookZaloUserId, setWebhookZaloUserId] = useState('')
    const [webhookZaloOaName, setWebhookZaloOaName] = useState('')
    const [webhookZaloConnectedAt, setWebhookZaloConnectedAt] = useState('')
    const [zaloConnecting, setZaloConnecting] = useState(false)
    const [zaloFollowers, setZaloFollowers] = useState<{ userId: string; displayName: string; avatar: string }[]>([])
    const [zaloLoadingFollowers, setZaloLoadingFollowers] = useState(false)
    const [testingWebhook, setTestingWebhook] = useState<string | null>(null)

    // Business Info state
    const [bizPhone, setBizPhone] = useState('')
    const [bizAddress, setBizAddress] = useState('')
    const [bizWebsite, setBizWebsite] = useState('')
    const [bizSocials, setBizSocials] = useState<Record<string, string>>({})
    const [bizCustomLinks, setBizCustomLinks] = useState<{ label: string; url: string }[]>([])
    const [newCustomLabel, setNewCustomLabel] = useState('')
    const [newCustomUrl, setNewCustomUrl] = useState('')

    // Brand Profile state
    const [brandTargetAudience, setBrandTargetAudience] = useState('')
    const [brandContentTypes, setBrandContentTypes] = useState('')
    const [brandValues, setBrandValues] = useState('')
    const [brandCommStyle, setBrandCommStyle] = useState('')

    // Platform state
    const [platforms, setPlatforms] = useState<ChannelPlatformEntry[]>([])
    const [addingPlatform, setAddingPlatform] = useState(false)
    const [newPlatform, setNewPlatform] = useState('')
    const [newPlatformAccountId, setNewPlatformAccountId] = useState('')
    const [newPlatformAccountName, setNewPlatformAccountName] = useState('')
    const [savingPlatform, setSavingPlatform] = useState(false)

    const [platformSearch, setPlatformSearch] = useState('')
    const [hideDisabled, setHideDisabled] = useState(false)
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
    interface EasyLink { id: string; title: string; token: string; isEnabled: boolean; expiresAt?: string | null; createdAt: string }
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

    const loadEasyLinks = async () => {
        if (!id) return
        setEasyLinksLoading(true)
        try {
            const res = await fetch(`/api/admin/channels/${id}/easy-connect`)
            if (res.ok) setEasyLinks(await res.json())
        } finally { setEasyLinksLoading(false); setEasyLinksLoaded(true) }
    }

    // Auto-load links when platforms tab is active
    useEffect(() => {
        if (activeTab === 'platforms' && !easyLinksLoaded && id) {
            loadEasyLinks()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, id])

    const createEasyLink = async () => {
        if (!newLinkTitle.trim()) return
        setCreatingLink(true)
        try {
            const res = await fetch(`/api/admin/channels/${id}/easy-connect`, {
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
        await fetch(`/api/admin/channels/${id}/easy-connect/${linkId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isEnabled }),
        })
        setEasyLinks(prev => prev.map(l => l.id === linkId ? { ...l, isEnabled } : l))
    }

    const renameEasyLink = async (linkId: string) => {
        if (!editingLinkTitle.trim()) { setEditingLinkId(null); return }
        await fetch(`/api/admin/channels/${id}/easy-connect/${linkId}`, {
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
        await fetch(`/api/admin/channels/${id}/easy-connect/${linkId}`, { method: 'DELETE' })
        setEasyLinks(prev => prev.filter(l => l.id !== linkId))
        toast.success('Link deleted')
    }

    const copyEasyLink = (token: string, linkId: string) => {
        const url = `${window.location.origin}/connect/${token}`
        navigator.clipboard.writeText(url)
        setCopiedLinkId(linkId)
        setTimeout(() => setCopiedLinkId(null), 2000)
    }

    // Members state
    const [members, setMembers] = useState<any[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [addingMember, setAddingMember] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState('')
    const [selectedRole, setSelectedRole] = useState('MANAGER')
    const [expandedMember, setExpandedMember] = useState<string | null>(null)
    const [savingPermissions, setSavingPermissions] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [sendingInvite, setSendingInvite] = useState(false)

    const fetchChannel = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/channels/${id}`)
            if (res.ok) {
                const data = await res.json()
                setChannel(data)
                setDisplayName(data.displayName)
                setDescription(data.description || '')
                setAvatarUrl(data.avatarUrl || null)
                setLanguage(data.language)
                setTimezone(data.timezone || 'UTC')
                setIsActive(data.isActive)
                setNotificationEmail(data.notificationEmail || '')
                setRequireApproval((data.requireApproval as 'none' | 'optional' | 'required') || 'none')
                setVibeTone(data.vibeTone || {})
                setKnowledgeEntries(data.knowledgeBase || [])
                setTemplates(data.contentTemplates || [])
                setHashtags(data.hashtagGroups || [])
                // AI defaults
                setAiProvider(data.defaultAiProvider || '')
                setAiModel(data.defaultAiModel || '')
                setImageProvider(data.defaultImageProvider || '')
                setImageModel(data.defaultImageModel || '')
                setRequireOwnApiKey(data.requireOwnApiKey ?? false)
                // Webhooks
                setWebhookDiscordUrl(data.webhookDiscord?.url || '')
                setWebhookTelegramToken(data.webhookTelegram?.botToken || '')
                setWebhookTelegramChatId(data.webhookTelegram?.chatId || '')
                setWebhookSlackUrl(data.webhookSlack?.url || '')
                setWebhookZaloAppId(data.webhookZalo?.appId || '')
                setWebhookZaloSecretKey(data.webhookZalo?.secretKey || '')
                setWebhookZaloRefreshToken(data.webhookZalo?.refreshToken || '')
                setWebhookZaloUserId(data.webhookZalo?.userId || '')
                setWebhookZaloOaName(data.webhookZalo?.oaName || '')
                setWebhookZaloConnectedAt(data.webhookZalo?.connectedAt || '')
                setWebhookCustomUrl(data.webhookCustom?.url || '')
                // Business Info
                const biz = data.businessInfo || {}
                setBizPhone(biz.phone || '')
                setBizAddress(biz.address || '')
                setBizWebsite(biz.website || '')
                setBizSocials(biz.socials || {})
                setBizCustomLinks(biz.custom || [])
                // Brand Profile
                const bp = data.brandProfile || {}
                setBrandTargetAudience(bp.targetAudience || '')
                setBrandContentTypes(bp.contentTypes || '')
                setBrandValues(bp.brandValues || '')
                setBrandCommStyle(bp.communicationStyle || '')
            } else {
                toast.error(t('channels.notFound'))
                router.push('/dashboard/channels')
            }
        } catch {
            toast.error(t('channels.loadFailed'))
        } finally {
            setLoading(false)
        }
    }, [id, router])

    useEffect(() => {
        fetchChannel()
        // Fetch platforms
        fetch(`/api/admin/channels/${id}/platforms`)
            .then(r => r.ok ? r.json() : [])
            .then(data => setPlatforms(data))
            .catch(() => { })
        // Fetch members
        fetch(`/api/admin/channels/${id}/members`)
            .then(r => r.ok ? r.json() : [])
            .then(data => setMembers(data))
            .catch(() => { })
    }, [fetchChannel, id])

    // Handle OAuth redirect success
    const searchParams = useSearchParams()
    useEffect(() => {
        const oauthPlatform = searchParams.get('oauth')
        const imported = searchParams.get('imported')
        const oauthError = searchParams.get('error')
        const tab = searchParams.get('tab')

        if (tab === 'platforms') {
            setActiveTab('platforms')
        }

        if (oauthPlatform && imported) {
            const name = oauthPlatform.charAt(0).toUpperCase() + oauthPlatform.slice(1)
            toast.success(`${name} connected! ${imported} account(s) imported.`)
            // Refresh platform list
            fetch(`/api/admin/channels/${id}/platforms`)
                .then(r => r.ok ? r.json() : [])
                .then(data => setPlatforms(data))
                .catch(() => { })
            // Clean URL params
            router.replace(`/dashboard/channels/${id}`, { scroll: false })
        } else if (oauthError) {
            toast.error(`OAuth error: ${oauthError}`)
            router.replace(`/dashboard/channels/${id}`, { scroll: false })
        }

        // Handle Zalo OAuth callback
        const zaloStatus = searchParams.get('zalo')
        if (zaloStatus === 'connected') {
            toast.success('Zalo OA connected successfully! / Kết nối Zalo OA thành công!')
            fetchChannel()
            setActiveTab('webhooks')
            router.replace(`/dashboard/channels/${id}`, { scroll: false })
        } else if (zaloStatus === 'error') {
            const zaloMsg = searchParams.get('message') || 'Zalo OAuth failed'
            toast.error(zaloMsg)
            router.replace(`/dashboard/channels/${id}`, { scroll: false })
        }
    }, [searchParams, id, router, fetchChannel])

    // Fetch AI providers from API Hub + user's configured keys
    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const res = await fetch('/api/user/ai-providers')
                if (res.ok) {
                    const data = await res.json()
                    setAvailableProviders(data)
                }
            } catch { /* silently ignore */ }
        }
        const fetchUserKeys = async () => {
            try {
                const res = await fetch('/api/user/api-keys')
                if (res.ok) {
                    const data = await res.json()
                    setUserConfiguredProviders(data.map((k: { provider: string }) => k.provider))
                }
            } catch { /* silently ignore */ }
        }
        fetchProviders()
        fetchUserKeys()
    }, [])

    // Fetch models when provider changes — uses user's key
    useEffect(() => {
        if (!aiProvider) {
            setAvailableModels([])
            return
        }
        // Only fetch models if user has this provider configured
        if (!userConfiguredProviders.includes(aiProvider)) {
            setAvailableModels([])
            return
        }

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
                    // Filter to text models only for content generation
                    setAvailableModels(
                        (data.models || []).filter((m: AiModelInfo) => m.type === 'text')
                    )
                }
            } catch { /* silently ignore */ }
            setLoadingModels(false)
        }
        fetchModels()
    }, [aiProvider, userConfiguredProviders])

    // Fetch image models when image provider changes
    useEffect(() => {
        if (!imageProvider) {
            setAvailableImageModels([])
            return
        }
        if (!userConfiguredProviders.includes(imageProvider)) {
            setAvailableImageModels([])
            return
        }
        const fetchImageModels = async () => {
            setLoadingImageModels(true)
            try {
                const res = await fetch('/api/user/api-keys/models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: imageProvider }),
                })
                if (res.ok) {
                    const data = await res.json()
                    setAvailableImageModels(
                        (data.models || []).filter((m: AiModelInfo) => m.type === 'image')
                    )
                }
            } catch { /* silently ignore */ }
            setLoadingImageModels(false)
        }
        fetchImageModels()
    }, [imageProvider, userConfiguredProviders])

    // ─── Save General Settings ──────────────────────
    const handleAvatarUpload = async (file: File) => {
        setUploadingAvatar(true)
        try {
            const formData = new FormData()
            formData.append('avatar', file)
            const res = await fetch(`/api/admin/channels/${id}/avatar`, { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Upload failed')
            setAvatarUrl(data.avatarUrl)
            toast.success('Avatar updated')
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setUploadingAvatar(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/channels/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName,
                    description: description || null,
                    language,
                    timezone,
                    isActive,
                    notificationEmail: notificationEmail || null,
                    requireApproval,
                    vibeTone,
                    defaultAiProvider: aiProvider || null,
                    defaultAiModel: aiModel || null,
                    defaultImageProvider: imageProvider || null,
                    defaultImageModel: imageModel || null,

                    ...(isAdmin ? { requireOwnApiKey } : {}),
                    webhookDiscord: webhookDiscordUrl ? { url: webhookDiscordUrl } : {},
                    webhookTelegram: webhookTelegramToken ? { botToken: webhookTelegramToken, chatId: webhookTelegramChatId } : {},
                    webhookSlack: webhookSlackUrl ? { url: webhookSlackUrl } : {},
                    webhookZalo: (webhookZaloRefreshToken || webhookZaloOaName) ? {
                        appId: webhookZaloAppId,
                        secretKey: webhookZaloSecretKey,
                        refreshToken: webhookZaloRefreshToken,
                        userId: webhookZaloUserId,
                        oaName: webhookZaloOaName,
                        connectedAt: webhookZaloConnectedAt,
                    } : {},
                    webhookCustom: webhookCustomUrl ? { url: webhookCustomUrl } : {},
                    brandProfile: {
                        targetAudience: brandTargetAudience || undefined,
                        contentTypes: brandContentTypes || undefined,
                        brandValues: brandValues || undefined,
                        communicationStyle: brandCommStyle || undefined,
                    },
                    businessInfo: {
                        phone: bizPhone || undefined,
                        address: bizAddress || undefined,
                        website: bizWebsite || undefined,
                        socials: Object.keys(bizSocials).length > 0 ? bizSocials : undefined,
                        custom: bizCustomLinks.length > 0 ? bizCustomLinks : undefined,
                    },
                }),
            })
            if (res.ok) {
                toast.success(t('channels.saved'))
                fetchChannel()
            } else {
                toast.error(t('channels.saveFailed'))
            }
        } catch {
            toast.error(t('channels.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    // ─── Auto-save (debounced 2s) ────────────────────────
    const autoSave = useCallback(async () => {
        if (!channel) return
        setAutoSaveStatus('saving')
        try {
            const res = await fetch(`/api/admin/channels/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName,
                    description: description || null,
                    language,
                    timezone,
                    isActive,
                    notificationEmail: notificationEmail || null,
                    requireApproval,
                    vibeTone,
                    defaultAiProvider: aiProvider || null,
                    defaultAiModel: aiModel || null,
                    defaultImageProvider: imageProvider || null,
                    defaultImageModel: imageModel || null,
                    ...(isAdmin ? { requireOwnApiKey } : {}),
                    brandProfile: {
                        targetAudience: brandTargetAudience || undefined,
                        contentTypes: brandContentTypes || undefined,
                        brandValues: brandValues || undefined,
                        communicationStyle: brandCommStyle || undefined,
                    },
                    businessInfo: {
                        phone: bizPhone || undefined,
                        address: bizAddress || undefined,
                        website: bizWebsite || undefined,
                        socials: Object.keys(bizSocials).length > 0 ? bizSocials : undefined,
                        custom: bizCustomLinks.length > 0 ? bizCustomLinks : undefined,
                    },
                }),
            })
            if (res.ok) {
                setAutoSaveStatus('saved')
                setTimeout(() => setAutoSaveStatus('idle'), 3000)
            } else {
                setAutoSaveStatus('idle')
            }
        } catch {
            setAutoSaveStatus('idle')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel, id, displayName, description, language, timezone, isActive, notificationEmail, requireApproval, vibeTone, aiProvider, aiModel, isAdmin, requireOwnApiKey, bizPhone, bizAddress, bizWebsite, bizSocials, bizCustomLinks, brandTargetAudience, brandContentTypes, brandValues, brandCommStyle])

    useEffect(() => {
        // Skip auto-save on initial load
        if (isInitialLoad.current) {
            if (channel) isInitialLoad.current = false
            return
        }
        if (!channel) return

        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = setTimeout(() => {
            autoSave()
        }, 2000)

        return () => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayName, description, language, isActive, notificationEmail, requireApproval, vibeTone, aiProvider, aiModel, requireOwnApiKey, bizPhone, bizAddress, bizWebsite, bizSocials, bizCustomLinks, brandTargetAudience, brandContentTypes, brandValues, brandCommStyle])

    // ─── AI Analysis ────────────────────────────────
    const handleAnalyze = async () => {
        if (!displayName || !description) {
            toast.error(t('channels.ai.needDescription'))
            return
        }
        setAnalyzing(true)
        toast.info(t('channels.ai.started'))

        try {
            // First save description
            await fetch(`/api/admin/channels/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description }),
            })

            // Call AI analysis
            const res = await fetch(`/api/admin/channels/${id}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelName: displayName,
                    description,
                    language,
                    targetAudience: brandTargetAudience || undefined,
                    contentTypes: brandContentTypes || undefined,
                    brandValues: brandValues || undefined,
                    communicationStyle: brandCommStyle || undefined,
                    provider: aiProvider || undefined,
                    model: aiModel || undefined,
                }),
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || t('channels.ai.failed'))
            }

            const analysis = await res.json()

            // Apply Vibe & Tone
            if (analysis.vibeTone) {
                setVibeTone(analysis.vibeTone)
                await fetch(`/api/admin/channels/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vibeTone: analysis.vibeTone }),
                })
            }

            // Create Knowledge Base entries
            if (analysis.knowledgeBase?.length) {
                for (const entry of analysis.knowledgeBase) {
                    await fetch(`/api/admin/channels/${id}/knowledge`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: entry.title,
                            sourceType: 'text',
                            content: entry.content,
                        }),
                    })
                }
            }

            // Create Content Templates
            if (analysis.contentTemplates?.length) {
                for (const tpl of analysis.contentTemplates) {
                    await fetch(`/api/admin/channels/${id}/templates`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: tpl.name,
                            templateContent: tpl.templateContent,
                        }),
                    })
                }
            }

            // Create Hashtag Groups
            if (analysis.hashtagGroups?.length) {
                for (const group of analysis.hashtagGroups) {
                    await fetch(`/api/admin/channels/${id}/hashtags`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: group.name,
                            hashtags: group.hashtags,
                        }),
                    })
                }
            }

            // Refresh all data
            await fetchChannel()
            toast.success(t('channels.ai.complete'))
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('channels.ai.failed'))
        } finally {
            setAnalyzing(false)
        }
    }

    // ─── Knowledge Base CRUD ────────────────────────
    const addKbEntry = async () => {
        if (!newKbTitle) return
        setAddingKb(true)
        try {
            const res = await fetch(`/api/admin/channels/${id}/knowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newKbTitle,
                    sourceType: newKbType,
                    sourceUrl: newKbUrl || null,
                    content: newKbContent,
                }),
            })
            if (res.ok) {
                const entry = await res.json()
                setKnowledgeEntries([entry, ...knowledgeEntries])
                setNewKbTitle('')
                setNewKbType('text')
                setNewKbUrl('')
                setNewKbContent('')
                toast.success(t('channels.knowledge.added'))
            }
        } catch {
            toast.error(t('channels.knowledge.addFailed'))
        } finally {
            setAddingKb(false)
        }
    }

    const deleteKbEntry = async (entryId: string) => {
        try {
            await fetch(`/api/admin/channels/${id}/knowledge?entryId=${entryId}`, { method: 'DELETE' })
            setKnowledgeEntries(knowledgeEntries.filter((e) => e.id !== entryId))
            toast.success(t('channels.knowledge.deleted'))
        } catch {
            toast.error(t('channels.knowledge.deleteFailed'))
        }
    }

    // ─── Content Templates CRUD ─────────────────────
    const addTemplate = async () => {
        if (!newTplName || !newTplContent) return
        setAddingTpl(true)
        try {
            const res = await fetch(`/api/admin/channels/${id}/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newTplName,
                    templateContent: newTplContent,
                }),
            })
            if (res.ok) {
                const tpl = await res.json()
                setTemplates([tpl, ...templates])
                setNewTplName('')
                setNewTplContent('')
                toast.success(t('channels.templates.added'))
            }
        } catch {
            toast.error(t('channels.templates.addFailed'))
        } finally {
            setAddingTpl(false)
        }
    }

    const deleteTemplate = async (templateId: string) => {
        try {
            await fetch(`/api/admin/channels/${id}/templates?templateId=${templateId}`, { method: 'DELETE' })
            setTemplates(templates.filter((t) => t.id !== templateId))
            toast.success(t('channels.templates.deleted'))
        } catch {
            toast.error(t('channels.templates.deleteFailed'))
        }
    }

    // ─── Hashtag Groups CRUD ────────────────────────
    const addHashtagGroup = async () => {
        if (!newHashName) return
        setAddingHash(true)
        try {
            const tags = newHashTags.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)
            const res = await fetch(`/api/admin/channels/${id}/hashtags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newHashName, hashtags: tags }),
            })
            if (res.ok) {
                const group = await res.json()
                setHashtags([...hashtags, group])
                setNewHashName('')
                setNewHashTags('')
                toast.success(t('channels.hashtags.added'))
            }
        } catch {
            toast.error(t('channels.hashtags.addFailed'))
        } finally {
            setAddingHash(false)
        }
    }

    const deleteHashtagGroup = async (groupId: string) => {
        try {
            await fetch(`/api/admin/channels/${id}/hashtags?groupId=${groupId}`, { method: 'DELETE' })
            setHashtags(hashtags.filter((h) => h.id !== groupId))
            toast.success(t('channels.hashtags.deleted'))
        } catch {
            toast.error(t('channels.hashtags.deleteFailed'))
        }
    }

    // ─── Generate SEO Description ────────────────────
    const handleGenerateDescription = async () => {
        if (!displayName || !description) {
            toast.error(t('channels.ai.needDescription'))
            return
        }
        setGeneratingDesc(true)
        try {
            const res = await fetch(`/api/admin/channels/${id}/generate-description`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelName: displayName,
                    shortDescription: description,
                    language,
                    targetAudience: brandTargetAudience || undefined,
                    contentTypes: brandContentTypes || undefined,
                    brandValues: brandValues || undefined,
                    communicationStyle: brandCommStyle || undefined,
                    provider: aiProvider || undefined,
                    model: aiModel || undefined,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                setDescription(data.description)
                toast.success(t('channels.ai.descGenerated'))
            } else {
                const err = await res.json()
                toast.error(err.error || t('channels.ai.descFailed'))
            }
        } catch {
            toast.error(t('channels.ai.descFailed'))
        } finally {
            setGeneratingDesc(false)
        }
    }

    // ─── Generate Vibe & Tone ───────────────────────
    const handleGenerateVibe = async () => {
        if (!displayName || !description) {
            toast.error(t('channels.ai.needDescription'))
            return
        }
        setGeneratingVibe(true)
        try {
            const res = await fetch(`/api/admin/channels/${id}/generate-vibe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelName: displayName,
                    description,
                    language,
                    provider: aiProvider || undefined,
                    model: aiModel || undefined,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                if (data.vibeTone) {
                    setVibeTone(data.vibeTone)
                    toast.success(t('channels.vibe.vibeGenerated'))
                }
            } else {
                const err = await res.json()
                toast.error(err.error || t('channels.vibe.vibeFailed'))
            }
        } catch {
            toast.error(t('channels.vibe.vibeFailed'))
        } finally {
            setGeneratingVibe(false)
        }
    }

    // ─── Webhook Test ────────────────────────────────
    const handleWebhookTest = async (platform: string) => {
        setTestingWebhook(platform)
        try {
            const payload: Record<string, string> = { platform }
            if (platform === 'discord') payload.url = webhookDiscordUrl
            if (platform === 'telegram') {
                payload.botToken = webhookTelegramToken
                payload.chatId = webhookTelegramChatId
            }
            if (platform === 'slack') payload.url = webhookSlackUrl
            if (platform === 'zalo') {
                payload.appId = webhookZaloAppId
                payload.secretKey = webhookZaloSecretKey
                payload.refreshToken = webhookZaloRefreshToken
                payload.userId = webhookZaloUserId
            }
            if (platform === 'custom') payload.url = webhookCustomUrl

            const res = await fetch(`/api/admin/channels/${id}/webhook-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (data.success) {
                toast.success(t('channels.webhooks.testSuccess'))
            } else {
                toast.error(data.message || t('channels.webhooks.testFailed'))
            }
        } catch {
            toast.error(t('channels.webhooks.testFailed'))
        } finally {
            setTestingWebhook(null)
        }
    }

    // ─── Platform CRUD ───────────────────────────────
    const addPlatformConnection = async () => {
        if (!newPlatform || !newPlatformAccountId || !newPlatformAccountName) return
        setSavingPlatform(true)
        try {
            const res = await fetch(`/api/admin/channels/${id}/platforms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: newPlatform,
                    accountId: newPlatformAccountId,
                    accountName: newPlatformAccountName,
                }),
            })
            if (res.ok) {
                const entry = await res.json()
                setPlatforms([...platforms, entry])
                setNewPlatform('')
                setNewPlatformAccountId('')
                setNewPlatformAccountName('')
                setAddingPlatform(false)
                toast.success(t('channels.platforms.connected'))
            } else {
                const err = await res.json()
                toast.error(err.error || t('channels.platforms.connectFailed'))
            }
        } catch {
            toast.error(t('channels.platforms.connectFailed'))
        } finally {
            setSavingPlatform(false)
        }
    }

    const togglePlatformActive = async (platformId: string, isActive: boolean) => {
        // Optimistic update first (functional form avoids stale closure)
        setPlatforms(prev => prev.map(p => p.id === platformId ? { ...p, isActive } : p))
        try {
            await fetch(`/api/admin/channels/${id}/platforms`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platformId, isActive }),
            })
        } catch {
            // Rollback on error
            setPlatforms(prev => prev.map(p => p.id === platformId ? { ...p, isActive: !isActive } : p))
            toast.error(t('channels.platforms.connectFailed'))
        }
    }

    const deletePlatformConnection = async (platformId: string) => {
        try {
            await fetch(`/api/admin/channels/${id}/platforms?platformId=${platformId}`, { method: 'DELETE' })
            setPlatforms(platforms.filter(p => p.id !== platformId))
            toast.success(t('channels.platforms.disconnected'))
        } catch {
            toast.error(t('channels.platforms.disconnectFailed'))
        }
    }


    // Toggle all platforms active/inactive
    const toggleAllPlatforms = async (active: boolean) => {
        const toToggle = platforms.filter(p => p.isActive !== active)
        if (toToggle.length === 0) return
        // If disabling all: reset filter FIRST so list stays visible during & after the API calls
        if (!active) setHideDisabled(false)
        // Optimistic update
        setPlatforms(prev => prev.map(p => ({ ...p, isActive: active })))
        // Fire all API calls in parallel (best-effort, no rollback needed for bulk toggle)
        await Promise.all(
            toToggle.map(p =>
                fetch(`/api/admin/channels/${id}/platforms`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ platformId: p.id, isActive: active }),
                })
            )
        )
    }

    // ─── Loading state ──────────────────────────────
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 bg-muted rounded animate-pulse"></div>
                <div className="h-[400px] bg-muted rounded-xl animate-pulse"></div>
            </div>
        )
    }

    if (!channel) return null

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/channels')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                            <Megaphone className="h-5 w-5" />
                            {channel.displayName}
                        </h1>
                        <p className="text-xs text-muted-foreground font-mono">/{channel.name}</p>
                    </div>
                    <Badge variant={channel.isActive ? 'default' : 'secondary'}>
                        {channel.isActive ? t('channels.active') : t('channels.inactive')}
                    </Badge>
                </div>
                <div className="flex items-center gap-3">
                    {autoSaveStatus === 'saving' && (
                        <span className="text-xs text-muted-foreground animate-pulse">{t('channels.saving')}</span>
                    )}
                    {autoSaveStatus === 'saved' && (
                        <span className="text-xs text-green-500">{t('channels.autoSaved')} ✓</span>
                    )}
                    <Button onClick={handleSave} disabled={saving} className="gap-2 w-full sm:w-auto">
                        <Save className="h-4 w-4" />
                        {saving ? t('common.saving') : t('common.save')}
                    </Button>
                </div>
            </div>

            {/* ─── Responsive Nav + Content Layout ─────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                {/* ─── Mobile: Horizontal scrollable tabs (< lg) ─── */}
                <div className="lg:hidden overflow-x-auto pb-2 mb-3 border-b flex gap-1 scrollbar-hide">
                    {([
                        { v: 'general', icon: <Settings className="h-3.5 w-3.5 shrink-0" />, label: t('channels.tabs.general') },
                        { v: 'platforms', icon: <Globe className="h-3.5 w-3.5 shrink-0" />, label: 'Connections' },
                        { v: 'ai', icon: <Bot className="h-3.5 w-3.5 shrink-0" />, label: 'AI Setup' },
                        { v: 'chatbot', icon: <MessageSquareDot className="h-3.5 w-3.5 shrink-0" />, label: 'Chat Bot' },
                        { v: 'auto-content', icon: <Zap className="h-3.5 w-3.5 shrink-0" />, label: 'Client Board' },
                        { v: 'vibe', icon: <Palette className="h-3.5 w-3.5 shrink-0" />, label: t('channels.tabs.vibe') },
                        { v: 'knowledge', icon: <BookOpen className="h-3.5 w-3.5 shrink-0" />, label: t('channels.tabs.knowledge') },
                        { v: 'templates', icon: <FileText className="h-3.5 w-3.5 shrink-0" />, label: t('channels.tabs.templates') },
                        { v: 'hashtags', icon: <Hash className="h-3.5 w-3.5 shrink-0" />, label: t('channels.tabs.hashtags') },
                        { v: 'webhooks', icon: <Bell className="h-3.5 w-3.5 shrink-0" />, label: t('channels.tabs.webhooks') },
                        { v: 'members', icon: <Users className="h-3.5 w-3.5 shrink-0" />, label: t('channels.tabs.members') },
                        { v: 'customers', icon: <UserPlus className="h-3.5 w-3.5 shrink-0" />, label: 'Customers' },
                    ] as { v: string; icon: React.ReactNode; label: string }[]).map(({ v, icon, label }) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => setActiveTab(v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-all shrink-0 ${activeTab === v
                                ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </div>
                {/* ─── Desktop: Sidebar + Content (≥ lg) ──────────── */}
                <div className="flex gap-6 items-start">
                    {/* Left Side Menu — desktop only */}
                    <nav className="hidden lg:flex flex-col w-52 shrink-0 gap-0.5 rounded-xl border bg-card p-2 sticky top-20">
                        {([
                            { v: 'general', icon: <Settings className="h-4 w-4 shrink-0" />, label: t('channels.tabs.general') },
                            { v: 'platforms', icon: <Globe className="h-4 w-4 shrink-0" />, label: 'Connections' },
                            { v: 'ai', icon: <Bot className="h-4 w-4 shrink-0" />, label: 'AI Setup' },
                            { v: 'chatbot', icon: <MessageSquareDot className="h-4 w-4 shrink-0" />, label: 'Chat Bot' },
                            { v: 'auto-content', icon: <Zap className="h-4 w-4 shrink-0" />, label: 'Client Board' },
                            { v: 'vibe', icon: <Palette className="h-4 w-4 shrink-0" />, label: t('channels.tabs.vibe') },
                            { v: 'knowledge', icon: <BookOpen className="h-4 w-4 shrink-0" />, label: t('channels.tabs.knowledge') },
                            { v: 'templates', icon: <FileText className="h-4 w-4 shrink-0" />, label: t('channels.tabs.templates') },
                            { v: 'hashtags', icon: <Hash className="h-4 w-4 shrink-0" />, label: t('channels.tabs.hashtags') },
                            { v: 'webhooks', icon: <Bell className="h-4 w-4 shrink-0" />, label: t('channels.tabs.webhooks') },
                            { v: 'members', icon: <Users className="h-4 w-4 shrink-0" />, label: t('channels.tabs.members') },
                            { v: 'customers', icon: <UserPlus className="h-4 w-4 shrink-0" />, label: 'Customers' },
                        ] as { v: string; icon: React.ReactNode; label: string }[]).map(({ v, icon, label }) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setActiveTab(v)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left w-full ${activeTab === v
                                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                            >
                                {icon}
                                {label}
                            </button>
                        ))}
                    </nav>
                    {/* Content Area */}
                    <div className="flex-1 min-w-0">


                        {/* ─── General Tab ───────────────────── */}
                        <TabsContent value="general" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">{t('channels.generalSettings')}</CardTitle>
                                    <CardDescription>{t('channels.generalSettingsDesc')}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* ── Channel Avatar ────────────────────────────────── */}
                                    <div className="flex items-center gap-4 pb-2 border-b border-border">
                                        <div className="relative group">
                                            <div className="h-16 w-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                                                {avatarUrl
                                                    ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                                                    : <span className="text-primary font-bold text-2xl">{displayName[0]?.toUpperCase()}</span>
                                                }
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => avatarInputRef.current?.click()}
                                                disabled={uploadingAvatar}
                                                className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                title="Change avatar"
                                            >
                                                {uploadingAvatar
                                                    ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                                                    : <Camera className="h-5 w-5 text-white" />
                                                }
                                            </button>
                                            <input
                                                ref={avatarInputRef}
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp,image/gif"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleAvatarUpload(file)
                                                    e.target.value = ''
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Channel Avatar</p>
                                            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · max 2MB</p>
                                            {avatarUrl && (
                                                <button
                                                    type="button"
                                                    className="text-xs text-destructive hover:underline mt-1"
                                                    onClick={async () => {
                                                        await fetch(`/api/admin/channels/${id}/avatar`, { method: 'DELETE' })
                                                        setAvatarUrl(null)
                                                        toast.success('Avatar removed')
                                                    }}
                                                >
                                                    Remove avatar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>{t('channels.displayName')}</Label>
                                            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('channels.language')}</Label>
                                            <Select value={language} onValueChange={setLanguage}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="en">English</SelectItem>
                                                    <SelectItem value="vi">Vietnamese</SelectItem>
                                                    <SelectItem value="fr">French</SelectItem>
                                                    <SelectItem value="de">German</SelectItem>
                                                    <SelectItem value="ja">Japanese</SelectItem>
                                                    <SelectItem value="ko">Korean</SelectItem>
                                                    <SelectItem value="zh">Chinese</SelectItem>
                                                    <SelectItem value="es">Spanish</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('channels.timezone')}</Label>
                                            <select
                                                value={timezone}
                                                onChange={(e) => setTimezone(e.target.value)}
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                                            >
                                                <optgroup label={t('channels.timezoneGroups.northAmerica')}>
                                                    <option value="America/New_York">Eastern (New York)</option>
                                                    <option value="America/Chicago">Central (Chicago)</option>
                                                    <option value="America/Denver">Mountain (Denver)</option>
                                                    <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                                                    <option value="America/Anchorage">Alaska</option>
                                                    <option value="Pacific/Honolulu">Hawaii</option>
                                                    <option value="America/Toronto">Toronto</option>
                                                    <option value="America/Vancouver">Vancouver</option>
                                                </optgroup>
                                                <optgroup label={t('channels.timezoneGroups.europe')}>
                                                    <option value="Europe/London">London (GMT)</option>
                                                    <option value="Europe/Paris">Paris (CET)</option>
                                                    <option value="Europe/Berlin">Berlin (CET)</option>
                                                    <option value="Europe/Amsterdam">Amsterdam (CET)</option>
                                                    <option value="Europe/Moscow">Moscow</option>
                                                    <option value="Europe/Istanbul">Istanbul</option>
                                                </optgroup>
                                                <optgroup label={t('channels.timezoneGroups.asia')}>
                                                    <option value="Asia/Ho_Chi_Minh">Ho Chi Minh (ICT)</option>
                                                    <option value="Asia/Bangkok">Bangkok (ICT)</option>
                                                    <option value="Asia/Singapore">Singapore (SGT)</option>
                                                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                                                    <option value="Asia/Seoul">Seoul (KST)</option>
                                                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                                                    <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                                                    <option value="Asia/Taipei">Taipei (CST)</option>
                                                    <option value="Asia/Dubai">Dubai (GST)</option>
                                                    <option value="Asia/Kolkata">India (IST)</option>
                                                    <option value="Asia/Jakarta">Jakarta (WIB)</option>
                                                </optgroup>
                                                <optgroup label={t('channels.timezoneGroups.oceania')}>
                                                    <option value="Australia/Sydney">Sydney (AEST)</option>
                                                    <option value="Australia/Melbourne">Melbourne (AEST)</option>
                                                    <option value="Pacific/Auckland">Auckland (NZST)</option>
                                                </optgroup>
                                                <optgroup label={t('channels.timezoneGroups.southAmerica')}>
                                                    <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                                                    <option value="America/Argentina/Buenos_Aires">Buenos Aires (ART)</option>
                                                    <option value="America/Bogota">Bogotá (COT)</option>
                                                </optgroup>
                                                <optgroup label={t('channels.timezoneGroups.other')}>
                                                    <option value="UTC">UTC</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>

                                    {/* ─── Brand Profile (Important for AI) ────── */}
                                    <div className="rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/5 p-4 space-y-4">
                                        <div>
                                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                                <Target className="h-4 w-4 text-amber-500" />
                                                {t('channels.businessInfo.brandProfile')}
                                                <span className="text-[10px] font-medium bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">{t('channels.businessInfo.recommended')}</span>
                                            </h4>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                ⚡ <strong>{t('channels.businessInfo.fillBefore')}</strong> {t('channels.businessInfo.aiUsesInfo')}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs flex items-center gap-1.5">
                                                    <Target className="h-3 w-3" /> {t('channels.businessInfo.targetAudience')}
                                                </Label>
                                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                    {t('channels.businessInfo.targetAudienceHint')}
                                                </p>
                                                <Textarea
                                                    placeholder={t('channels.businessInfo.targetAudiencePlaceholder')}
                                                    value={brandTargetAudience}
                                                    onChange={(e) => setBrandTargetAudience(e.target.value)}
                                                    className="text-xs min-h-[60px]"
                                                    rows={2}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs flex items-center gap-1.5">
                                                    <FileText className="h-3 w-3" /> {t('channels.businessInfo.contentTypes')}
                                                </Label>
                                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                    {t('channels.businessInfo.contentTypesHint')}
                                                </p>
                                                <Textarea
                                                    placeholder={t('channels.businessInfo.contentTypesPlaceholder')}
                                                    value={brandContentTypes}
                                                    onChange={(e) => setBrandContentTypes(e.target.value)}
                                                    className="text-xs min-h-[60px]"
                                                    rows={2}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs flex items-center gap-1.5">
                                                    <Lightbulb className="h-3 w-3" /> {t('channels.businessInfo.coreBrandValues')}
                                                </Label>
                                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                    {t('channels.businessInfo.coreBrandValuesHint')}
                                                </p>
                                                <Textarea
                                                    placeholder={t('channels.businessInfo.coreBrandValuesPlaceholder')}
                                                    value={brandValues}
                                                    onChange={(e) => setBrandValues(e.target.value)}
                                                    className="text-xs min-h-[60px]"
                                                    rows={2}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs flex items-center gap-1.5">
                                                    <Megaphone className="h-3 w-3" /> {t('channels.businessInfo.communicationStyle')}
                                                </Label>
                                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                    {t('channels.businessInfo.communicationStyleHint')}
                                                </p>
                                                <Textarea
                                                    placeholder={t('channels.businessInfo.communicationStylePlaceholder')}
                                                    value={brandCommStyle}
                                                    onChange={(e) => setBrandCommStyle(e.target.value)}
                                                    className="text-xs min-h-[60px]"
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>{t('channels.descriptionLabel')}</Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleGenerateDescription}
                                                disabled={generatingDesc || !description}
                                                className="gap-1.5 text-xs text-purple-400 hover:text-purple-300 h-7"
                                            >
                                                {generatingDesc ? (
                                                    <><Loader2 className="h-3 w-3 animate-spin" /> {t('channels.ai.generatingDesc')}</>
                                                ) : (
                                                    <><Sparkles className="h-3 w-3" /> {t('channels.ai.generateDesc')}</>
                                                )}
                                            </Button>
                                        </div>
                                        <Textarea
                                            placeholder={t('channels.descriptionPlaceholder')}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={4}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {t('channels.descriptionHint')}
                                        </p>
                                    </div>

                                    {/* AI Analyze Button */}
                                    <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-500/5 via-violet-500/5 to-indigo-500/5 border-purple-500/20">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-medium flex items-center gap-2">
                                                    <Sparkles className="h-4 w-4 text-purple-400" />
                                                    {t('channels.ai.title')}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {t('channels.ai.desc')}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={handleAnalyze}
                                                disabled={analyzing || !description}
                                                className="gap-2 border-purple-500/30 hover:bg-purple-500/10 text-purple-400 hover:text-purple-300"
                                            >
                                                {analyzing ? (
                                                    <><Loader2 className="h-4 w-4 animate-spin" /> {t('channels.ai.analyzing')}</>
                                                ) : (
                                                    <><Sparkles className="h-4 w-4" /> {t('channels.ai.analyze')}</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* AI Setup Notice */}
                                    <div className={`rounded-lg border p-3 flex items-center justify-between ${userConfiguredProviders.length > 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-orange-500/30 bg-orange-500/5 border-dashed'}`}>
                                        <div className="flex items-center gap-3">
                                            <Bot className={`h-5 w-5 ${userConfiguredProviders.length > 0 ? 'text-emerald-500' : 'text-orange-400'}`} />
                                            <div>
                                                <p className={`text-xs font-medium ${userConfiguredProviders.length > 0 ? 'text-emerald-500' : 'text-orange-400'}`}>
                                                    {userConfiguredProviders.length > 0
                                                        ? t('channels.aiConfig.aiConfiguredStatus').replace('{count}', String(userConfiguredProviders.length))
                                                        : t('channels.aiConfig.aiNotConfigured')
                                                    }
                                                </p>
                                                {userConfiguredProviders.length === 0 && (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {t('channels.aiConfig.goToAiSetup')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setActiveTab('ai')}
                                            className="gap-1.5 text-xs h-7 shrink-0"
                                        >
                                            <Bot className="h-3 w-3" />
                                            {userConfiguredProviders.length > 0 ? t('channels.aiConfig.manage') : t('channels.aiConfig.setUp')}
                                        </Button>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label>{t('channels.notificationEmail')}</Label>
                                        <Input
                                            type="email"
                                            placeholder="notifications@example.com"
                                            value={notificationEmail}
                                            onChange={(e) => setNotificationEmail(e.target.value)}
                                        />
                                    </div>
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label>{t('channels.active')}</Label>
                                            <p className="text-xs text-muted-foreground">{t('channels.activeDesc')}</p>
                                        </div>
                                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <Label>{t('channels.approval.title')}</Label>
                                            <p className="text-xs text-muted-foreground">{t('channels.approval.desc')}</p>
                                        </div>
                                        <Select value={requireApproval} onValueChange={(v) => setRequireApproval(v as 'none' | 'optional' | 'required')}>
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{t('channels.approval.none')}</span>
                                                        <span className="text-[10px] text-muted-foreground">{t('channels.approval.noneDesc')}</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="optional">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{t('channels.approval.optional')}</span>
                                                        <span className="text-[10px] text-muted-foreground">{t('channels.approval.optionalDesc')}</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="required">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{t('channels.approval.required')}</span>
                                                        <span className="text-[10px] text-muted-foreground">{t('channels.approval.requiredDesc')}</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>


                            {/* ─── Business Info Card ────────────── */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Globe2 className="h-4 w-4" />
                                        {t('channels.businessInfo.title')}
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        {t('channels.businessInfo.desc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs flex items-center gap-1.5">
                                                <Phone className="h-3 w-3" /> {t('channels.businessInfo.phone')}
                                            </Label>
                                            <Input
                                                placeholder="+1 (234) 567-8900"
                                                value={bizPhone}
                                                onChange={(e) => setBizPhone(e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs flex items-center gap-1.5">
                                                <Globe2 className="h-3 w-3" /> {t('channels.businessInfo.website')}
                                            </Label>
                                            <Input
                                                placeholder="https://example.com"
                                                value={bizWebsite}
                                                onChange={(e) => setBizWebsite(e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3" /> {t('channels.businessInfo.address')}
                                        </Label>
                                        <Input
                                            placeholder="123 Main St, City, State, ZIP"
                                            value={bizAddress}
                                            onChange={(e) => setBizAddress(e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </div>

                                    <Separator />

                                    {/* Social Links */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-medium">{t('channels.businessInfo.socialMediaLinks')}</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {[
                                                { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/brand' },
                                                { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/brand' },
                                                { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@brand' },
                                                { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@brand' },
                                                { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/brand' },
                                                { key: 'x', label: 'X / Twitter', placeholder: 'https://x.com/brand' },
                                                { key: 'threads', label: 'Threads', placeholder: 'https://threads.net/@brand' },
                                                { key: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/brand' },
                                            ].map((social) => (
                                                <div key={social.key} className="flex items-center gap-2">
                                                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                                        {platformIcons[social.key] || <Globe2 className="h-3.5 w-3.5" />}
                                                    </div>
                                                    <Input
                                                        placeholder={social.placeholder}
                                                        value={bizSocials[social.key] || ''}
                                                        onChange={(e) => setBizSocials((prev) => ({
                                                            ...prev,
                                                            [social.key]: e.target.value,
                                                        }))}
                                                        className="h-7 text-xs flex-1"
                                                    />
                                                    {bizSocials[social.key] && (
                                                        <button
                                                            onClick={() => setBizSocials((prev) => {
                                                                const next = { ...prev }
                                                                delete next[social.key]
                                                                return next
                                                            })}
                                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Custom Links */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-medium">{t('channels.businessInfo.customLinks')}</Label>
                                        {bizCustomLinks.length > 0 && (
                                            <div className="space-y-2">
                                                {bizCustomLinks.map((link, i) => (
                                                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                                                        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{link.label}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setBizCustomLinks((prev) => prev.filter((_, idx) => idx !== i))}
                                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder={t('channels.businessInfo.customLinkLabelPlaceholder')}
                                                value={newCustomLabel}
                                                onChange={(e) => setNewCustomLabel(e.target.value)}
                                                className="h-7 text-xs flex-1"
                                            />
                                            <Input
                                                placeholder="https://..."
                                                value={newCustomUrl}
                                                onChange={(e) => setNewCustomUrl(e.target.value)}
                                                className="h-7 text-xs flex-1"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs cursor-pointer"
                                                disabled={!newCustomLabel.trim() || !newCustomUrl.trim()}
                                                onClick={() => {
                                                    setBizCustomLinks((prev) => [...prev, { label: newCustomLabel, url: newCustomUrl }])
                                                    setNewCustomLabel('')
                                                    setNewCustomUrl('')
                                                }}
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> {t('channels.businessInfo.add')}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: t('channels.stats.posts'), value: channel._count.posts, icon: FileText },
                                    { label: t('channels.stats.media'), value: channel._count.mediaItems, icon: Palette },
                                    { label: t('channels.stats.knowledge'), value: knowledgeEntries.length, icon: BookOpen },
                                    { label: t('channels.stats.templates'), value: templates.length, icon: FileText },
                                ].map((stat) => (
                                    <Card key={stat.label} className="p-4 text-center">
                                        <stat.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                                        <p className="text-2xl font-bold">{stat.value}</p>
                                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        {/* ─── AI Setup Tab ───────────────── */}
                        <TabsContent value="ai" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Bot className="h-5 w-5" />
                                        {t('channels.aiConfig.channelTitle')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('channels.aiConfig.channelDesc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {isAdminOrManager ? (
                                        <>
                                            {/* ── Text AI Provider ─── */}
                                            <div className="space-y-4">
                                                <Label className="text-sm font-semibold flex items-center gap-2">
                                                    🧠 {t('channels.aiConfig.textProvider')}
                                                </Label>
                                                <p className="text-xs text-muted-foreground -mt-2">
                                                    {t('channels.aiConfig.textProviderDesc')}
                                                </p>

                                                {/* User Key Status */}
                                                {userConfiguredProviders.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-orange-500/30 bg-orange-500/5 p-3">
                                                        <p className="text-xs text-orange-400 font-medium">⚠ {t('channels.aiConfig.noKeysWarning')}</p>
                                                        <a href="/dashboard/api-keys" className="text-xs text-primary hover:underline font-medium mt-1 inline-block">→ {t('channels.aiConfig.goToKeys')}</a>
                                                    </div>
                                                ) : (
                                                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center justify-between">
                                                        <p className="text-xs text-emerald-500">✓ {t('channels.aiConfig.providersConfigured').replace('{count}', String(userConfiguredProviders.length))}</p>
                                                        <a href="/dashboard/api-keys" className="text-[11px] text-primary hover:underline">{t('channels.aiConfig.manageKeys')}</a>
                                                    </div>
                                                )}

                                                {/* Provider & Model */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>{t('channels.ai.provider')}</Label>
                                                        <Select value={aiProvider || '__default__'} onValueChange={(v) => { setAiProvider(v === '__default__' ? '' : v); setAiModel('') }}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={t('channels.ai.useGlobal')} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__default__">{t('channels.ai.useGlobal')}</SelectItem>
                                                                {availableProviders
                                                                    .filter(p => userConfiguredProviders.includes(p.provider))
                                                                    .map((p) => (
                                                                        <SelectItem key={p.provider} value={p.provider}>
                                                                            {p.name} ✓
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-xs text-muted-foreground">{t('channels.aiConfig.providerHint')}</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="flex items-center gap-2">
                                                            {t('channels.ai.model')}
                                                            {loadingModels && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                        </Label>
                                                        <Select value={aiModel || '__default__'} onValueChange={(v) => setAiModel(v === '__default__' ? '' : v)} disabled={loadingModels || !aiProvider}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={aiProvider ? t('channels.aiConfig.selectModel') : t('channels.aiConfig.selectProviderFirst')} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__default__">{t('channels.ai.useGlobal')}</SelectItem>
                                                                {availableModels.map((m) => (
                                                                    <SelectItem key={m.id} value={m.id}>
                                                                        {m.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-xs text-muted-foreground">{t('channels.ai.modelDesc')}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <Separator />

                                            {/* ── Image AI Provider ─── */}
                                            <div className="space-y-4">
                                                <Label className="text-sm font-semibold flex items-center gap-2">
                                                    🖼️ {t('channels.aiConfig.imageProviderLabel')}
                                                </Label>
                                                <p className="text-xs text-muted-foreground -mt-2">
                                                    {t('channels.aiConfig.imageProviderDesc')}
                                                </p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>{t('channels.aiConfig.imageProvider')}</Label>
                                                        <Select value={imageProvider || '__default__'} onValueChange={(v) => { setImageProvider(v === '__default__' ? '' : v); setImageModel('') }}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Auto-detect" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__default__">{t('channels.aiConfig.imageProviderAuto')}</SelectItem>
                                                                {availableProviders
                                                                    .filter(p => userConfiguredProviders.includes(p.provider) && ['runware', 'openai', 'gemini'].includes(p.provider))
                                                                    .map((p) => (
                                                                        <SelectItem key={p.provider} value={p.provider}>
                                                                            {p.name} ✓
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-xs text-muted-foreground">{t('channels.aiConfig.imageProviderHint')}</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="flex items-center gap-2">
                                                            {t('channels.aiConfig.imageModel')}
                                                            {loadingImageModels && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                        </Label>
                                                        <Select value={imageModel || '__default__'} onValueChange={(v) => setImageModel(v === '__default__' ? '' : v)} disabled={loadingImageModels || !imageProvider}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={imageProvider ? t('channels.aiConfig.selectModel') : t('channels.aiConfig.selectProviderFirst')} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__default__">{t('channels.aiConfig.defaultModel')}</SelectItem>
                                                                {availableImageModels.map((m) => (
                                                                    <SelectItem key={m.id} value={m.id}>
                                                                        {m.name} {m.description ? `— ${m.description}` : ''}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-xs text-muted-foreground">{t('channels.aiConfig.imageModelHint')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="rounded-lg border border-dashed p-4 bg-muted/30 space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">{t('channels.aiConfig.title')}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {t('channels.aiConfig.channelManagedDesc')}
                                            </p>
                                            <a href="/dashboard/api-keys" className="text-xs text-primary hover:underline font-medium inline-block">
                                                → {t('channels.aiConfig.manageYourKeys')}
                                            </a>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Platforms Tab ───────────────── */}
                        <TabsContent value="platforms" className="space-y-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-3">
                                    <div>
                                        <CardTitle className="text-base">{t('channels.platforms.title')}</CardTitle>
                                        <CardDescription>{t('channels.platforms.desc')}</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* OAuth Connect Strip — always visible */}
                                    <div className="border rounded-lg p-3 bg-muted/20">
                                        <p className="text-[11px] font-medium text-muted-foreground mb-2">{t('channels.aiConfig.connectPlatform')}</p>

                                        <div className="flex flex-wrap gap-2">
                                            {
                                                [
                                                    { key: 'facebook', label: 'Facebook', border: 'border-blue-500/30', hover: 'hover:bg-blue-500/10' },
                                                    { key: 'instagram', label: 'Instagram', border: 'border-pink-500/30', hover: 'hover:bg-pink-500/10' },
                                                    { key: 'youtube', label: 'YouTube', border: 'border-red-500/30', hover: 'hover:bg-red-500/10' },
                                                    { key: 'tiktok', label: 'TikTok', border: 'border-neutral-500/30', hover: 'hover:bg-neutral-500/10' },
                                                    { key: 'linkedin', label: 'LinkedIn', border: 'border-blue-600/30', hover: 'hover:bg-blue-600/10' },
                                                    { key: 'pinterest', label: 'Pinterest', border: 'border-red-600/30', hover: 'hover:bg-red-600/10' },
                                                    { key: 'threads', label: 'Threads', border: 'border-neutral-600/30', hover: 'hover:bg-neutral-600/10' },
                                                    { key: 'gbp', label: 'Google Business', border: 'border-blue-400/30', hover: 'hover:bg-blue-400/10' },
                                                ].map(({ key, label, border, hover }) => {
                                                    const btn = (
                                                        <Button
                                                            key={key}
                                                            variant="outline"
                                                            size="sm"
                                                            className={`gap-1.5 h-7 text-xs ${border} ${hover}`}
                                                            onClick={() => {
                                                                const w = 500, h = 700
                                                                const left = window.screenX + (window.outerWidth - w) / 2
                                                                const top = window.screenY + (window.outerHeight - h) / 2
                                                                const popup = window.open(
                                                                    `/api/oauth/${key}?channelId=${id}`,
                                                                    `${key}-oauth`,
                                                                    `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
                                                                )
                                                                const handler = (e: MessageEvent) => {
                                                                    if (e.data?.type === 'oauth-success' && e.data?.platform === key) {
                                                                        window.removeEventListener('message', handler)
                                                                        toast.success(`${label} connected successfully!`)
                                                                        // Show cross-channel warning toast for FB/IG
                                                                        if (key === 'facebook' || key === 'instagram') {
                                                                            setTimeout(() => {
                                                                                toast.warning(t('channels.platformActions.fbCrossChannelToast'), { duration: 8000 })
                                                                            }, 1500)
                                                                        }
                                                                        // Show account-type warning for TikTok personal accounts
                                                                        if (key === 'tiktok' && e.data?.warning) {
                                                                            setTimeout(() => {
                                                                                toast.warning(e.data.warning, { duration: 12000 })
                                                                            }, 1000)
                                                                        }
                                                                        fetch(`/api/admin/channels/${id}/platforms`).then(r => r.ok ? r.json() : []).then(data => setPlatforms(data)).catch(() => { })
                                                                    }
                                                                }
                                                                window.addEventListener('message', handler)
                                                                const check = setInterval(() => {
                                                                    if (popup?.closed) { clearInterval(check); window.removeEventListener('message', handler); fetch(`/api/admin/channels/${id}/platforms`).then(r => r.ok ? r.json() : []).then(data => setPlatforms(data)).catch(() => { }) }
                                                                }, 1000)
                                                            }}
                                                        >
                                                            {platformIcons[key]}
                                                            <span>{label}</span>
                                                        </Button>
                                                    )
                                                    if (key === 'facebook') {
                                                        return (
                                                            <div key={key} className="relative group">
                                                                {btn}
                                                                <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover:flex w-72 items-start gap-2 rounded-lg border border-amber-500/40 bg-popover shadow-lg px-3 py-2.5 pointer-events-none">
                                                                    <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠️</span>
                                                                    <div>
                                                                        <p className="text-[11px] font-semibold text-amber-500 leading-tight">{t('channels.platformActions.fbTooltipTitle')}</p>
                                                                        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{t('channels.platformActions.fbTooltipDesc')}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    }
                                                    if (key === 'instagram') {
                                                        return (
                                                            <div key={key} className="relative group">
                                                                {btn}
                                                                <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover:flex w-72 items-start gap-2 rounded-lg border border-amber-500/40 bg-popover shadow-lg px-3 py-2.5 pointer-events-none">
                                                                    <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠️</span>
                                                                    <div>
                                                                        <p className="text-[11px] font-semibold text-amber-500 leading-tight">{t('channels.platformActions.igTooltipTitle')}</p>
                                                                        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{t('channels.platformActions.igTooltipDesc')}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    }
                                                    if (key === 'tiktok') {
                                                        return (
                                                            <div key={key} className="relative group">
                                                                {btn}
                                                                <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover:flex w-64 items-start gap-2 rounded-lg border border-amber-500/40 bg-popover shadow-lg px-3 py-2.5 pointer-events-none">
                                                                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mt-0.5 shrink-0 fill-amber-500" xmlns="http://www.w3.org/2000/svg"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
                                                                    <div>
                                                                        <p className="text-[11px] font-semibold text-amber-500 leading-tight">{t('channels.platformActions.tiktokTooltipTitle')}</p>
                                                                        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{t('channels.platformActions.tiktokTooltipDesc')}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    }
                                                    return btn
                                                })}
                                            {/* X — credential-based (requires developer API keys) */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5 h-7 text-xs border-neutral-500/30 hover:bg-neutral-500/10"
                                                onClick={() => setShowXForm(f => !f)}
                                            >
                                                {platformIcons['x']}
                                                <span>X</span>
                                            </Button>
                                            {/* Bluesky — credential-based, not OAuth */}
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

                                        {/* ⚠️ Facebook & Instagram cross-channel warning */}
                                        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/8 px-3 py-2.5 flex items-start gap-2.5">
                                            <span className="text-amber-500 text-base leading-none mt-0.5 shrink-0">⚠️</span>
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-semibold text-amber-500">{t('channels.platformActions.fbIgWarningTitle')}</p>
                                                <p className="text-[11px] text-amber-400/90 leading-relaxed">{t('channels.platformActions.fbIgWarningDesc')}</p>
                                                <p className="text-[11px] text-amber-400/80 font-medium leading-relaxed">👉 {t('channels.platformActions.fbIgWarningAction')}</p>
                                            </div>
                                        </div>

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
                                                                body: JSON.stringify({ handle: blueskyHandle, appPassword: blueskyAppPassword, channelId: id }),
                                                            })
                                                            const data = await res.json()
                                                            if (!res.ok) throw new Error(data.error || 'Connection failed')
                                                            toast.success(`Bluesky @${data.handle || blueskyHandle} connected!`)
                                                            setShowBlueskyForm(false)
                                                            setBlueskyHandle('')
                                                            setBlueskyAppPassword('')
                                                            fetch(`/api/admin/channels/${id}/platforms`).then(r => r.ok ? r.json() : []).then(d => setPlatforms(d)).catch(() => { })
                                                        } catch (err) {
                                                            toast.error(err instanceof Error ? err.message : 'Failed to connect Bluesky')
                                                        } finally {
                                                            setBlueskyConnecting(false)
                                                        }
                                                    }}
                                                >
                                                    {blueskyConnecting ? t('channels.blueskyBtn.connecting') : t('channels.blueskyBtn.connect')}
                                                </Button>
                                            </div>
                                        )}
                                        {/* X (Twitter) — credential-based connect */}
                                        {showXForm && (
                                            <div className="mt-3 border border-neutral-500/30 rounded-lg p-3 bg-muted/30 space-y-3">
                                                <div>
                                                    <p className="text-xs font-semibold mb-0.5">Connect X (Twitter) Account</p>
                                                    <p className="text-[11px] text-muted-foreground">You need a <strong>Twitter Developer App</strong> with <strong>Read and Write</strong> permissions + <strong>User Authentication</strong> enabled.</p>
                                                </div>

                                                {/* Step-by-step guide */}
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

                                                <input
                                                    type="password"
                                                    placeholder="API Key (Consumer Key)"
                                                    value={xApiKey}
                                                    onChange={e => setXApiKey(e.target.value)}
                                                    className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder="API Key Secret (Consumer Secret)"
                                                    value={xApiKeySecret}
                                                    onChange={e => setXApiKeySecret(e.target.value)}
                                                    className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder="Access Token"
                                                    value={xAccessToken}
                                                    onChange={e => setXAccessToken(e.target.value)}
                                                    className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder="Access Token Secret"
                                                    value={xAccessTokenSecret}
                                                    onChange={e => setXAccessTokenSecret(e.target.value)}
                                                    className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
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
                                                                body: JSON.stringify({ apiKey: xApiKey, apiKeySecret: xApiKeySecret, accessToken: xAccessToken, accessTokenSecret: xAccessTokenSecret, channelId: id }),
                                                            })
                                                            const data = await res.json()
                                                            if (!res.ok) throw new Error(data.error || 'Connection failed')
                                                            toast.success(`X @${data.username || data.accountName} connected!`)
                                                            setShowXForm(false)
                                                            setXApiKey(''); setXApiKeySecret(''); setXAccessToken(''); setXAccessTokenSecret('')
                                                            fetch(`/api/admin/channels/${id}/platforms`).then(r => r.ok ? r.json() : []).then(d => setPlatforms(d)).catch(() => { })
                                                        } catch (err) {
                                                            toast.error(err instanceof Error ? err.message : 'Failed to connect X')
                                                        } finally {
                                                            setXConnecting(false)
                                                        }
                                                    }}
                                                >
                                                    {xConnecting ? t('channels.xConnectBtn.connecting') : t('channels.xConnectBtn.connect')}
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
                                                    placeholder={t('channels.platformActions.searchAccounts')}
                                                    value={platformSearch}
                                                    onChange={(e) => setPlatformSearch(e.target.value)}
                                                    className="pl-9 h-8 text-sm"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    variant={hideDisabled ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setHideDisabled(v => !v)}
                                                    className="gap-1.5 h-8 text-xs"
                                                >
                                                    <EyeOff className="h-3.5 w-3.5" />
                                                    {t('channels.platformActions.hideDisabled')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}


                                    {/* ⚠️ Token Health Warning — show when any platform needs reconnection */}
                                    {platforms.some(p => (p.config as any)?.needsReconnect) && (
                                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5">
                                            <p className="text-sm font-semibold text-amber-500 flex items-center gap-2">
                                                ⚠️ {t('channels.platformActions.connectionIssue')}
                                            </p>
                                            <p className="text-xs text-amber-400/90">
                                                {t('channels.platformActions.connectionIssueDesc')}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {platforms.filter(p => (p.config as any)?.needsReconnect).map(p => (
                                                    <Badge key={p.id} variant="outline" className="text-[11px] border-amber-500/50 text-amber-500">
                                                        {platformIcons[p.platform]} {p.accountName}
                                                    </Badge>
                                                ))}
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
                                                // Filter based on role and hide-disabled toggle
                                                // Show All (hideDisabled=false): always show every account
                                                // Hide Disabled (hideDisabled=true): only show active accounts
                                                const visiblePlatforms = hideDisabled
                                                    ? platforms.filter(p => p.isActive)
                                                    : platforms
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
                                                            {/* Group Header */}
                                                            <div
                                                                className="flex items-center gap-2.5 px-4 py-2.5 border-b"
                                                                style={{ backgroundColor: `${info?.color || '#888'}10` }}
                                                            >
                                                                {platformIcons[platformKey] || (
                                                                    <span
                                                                        className="w-4 h-4 rounded-full shrink-0"
                                                                        style={{ backgroundColor: info?.color || '#888' }}
                                                                    />
                                                                )}
                                                                <span className="text-sm font-semibold">
                                                                    {info?.label || platformKey}
                                                                </span>
                                                                <Badge variant="secondary" className="text-[10px] ml-auto">
                                                                    {items.length}
                                                                </Badge>
                                                            </div>
                                                            {/* Accounts */}
                                                            <div className="divide-y">
                                                                {items.map((p) => (
                                                                    <div
                                                                        key={p.id}
                                                                        className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
                                                                    >
                                                                        <div className="flex items-center gap-2.5">
                                                                            {/* Avatar with platform icon overlay */}
                                                                            <div className="relative shrink-0">
                                                                                <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center ring-1 ring-border">
                                                                                    {p.avatarUrl ? (
                                                                                        <img
                                                                                            src={p.avatarUrl}
                                                                                            alt={p.accountName}
                                                                                            className="w-full h-full object-cover"
                                                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style') }}
                                                                                        />
                                                                                    ) : null}
                                                                                    <span className={`text-xs font-semibold text-muted-foreground ${p.avatarUrl ? 'hidden' : ''}`}>
                                                                                        {p.accountName.charAt(0).toUpperCase()}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center ring-1 ring-border">
                                                                                    {platformIcons[p.platform] || <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: platformOptions.find(o => o.value === p.platform)?.color || '#888' }} />}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-medium">{p.accountName}</p>
                                                                                <p className="text-xs text-muted-foreground font-mono">{p.accountId}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Switch
                                                                                checked={p.isActive}
                                                                                onCheckedChange={(checked) => togglePlatformActive(p.id, checked)}
                                                                            />
                                                                            {/* Reconnect button */}
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                                                                title="Reconnect to refresh token"
                                                                                onClick={() => {
                                                                                    const key = p.platform
                                                                                    const w = 500, h = 700
                                                                                    const left = window.screenX + (window.outerWidth - w) / 2
                                                                                    const top = window.screenY + (window.outerHeight - h) / 2
                                                                                    const popup = window.open(
                                                                                        `/api/oauth/${key}?channelId=${id}`,
                                                                                        `${key}-oauth`,
                                                                                        `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
                                                                                    )
                                                                                    const handler = (e: MessageEvent) => {
                                                                                        if (e.data?.type === 'oauth-success' && e.data?.platform === key) {
                                                                                            window.removeEventListener('message', handler)
                                                                                            toast.success(`${p.accountName} reconnected!`)
                                                                                            // Show account-type warning for TikTok personal accounts
                                                                                            if (key === 'tiktok' && e.data?.warning) {
                                                                                                setTimeout(() => {
                                                                                                    toast.warning(e.data.warning, { duration: 12000 })
                                                                                                }, 1000)
                                                                                            }
                                                                                            fetch(`/api/admin/channels/${id}/platforms`).then(r => r.ok ? r.json() : []).then(data => setPlatforms(data)).catch(() => { })
                                                                                        }
                                                                                    }
                                                                                    window.addEventListener('message', handler)
                                                                                    const check = setInterval(() => {
                                                                                        if (popup?.closed) { clearInterval(check); window.removeEventListener('message', handler); fetch(`/api/admin/channels/${id}/platforms`).then(r => r.ok ? r.json() : []).then(data => setPlatforms(data)).catch(() => { }) }
                                                                                    }, 1000)
                                                                                }}
                                                                            >
                                                                                <RefreshCw className="h-3 w-3" />
                                                                                Reconnect
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
                                                <span>🔗</span> {t('channels.easyConnect.title')}
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                {t('channels.easyConnect.desc')}
                                            </CardDescription>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="gap-1.5 h-8 text-xs"
                                            onClick={() => setShowCreateLink(v => !v)}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {t('channels.easyConnect.newLinkBtn')}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 pt-0">
                                    {/* Create Link Form */}
                                    {showCreateLink && (
                                        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                                            <p className="text-xs font-medium text-muted-foreground">{t('channels.easyConnect.newLink')}</p>
                                            <Input
                                                placeholder={t('channels.easyConnect.titlePlaceholder')}
                                                className="h-8 text-sm"
                                                value={newLinkTitle}
                                                onChange={e => setNewLinkTitle(e.target.value)}
                                            />
                                            <Input
                                                type="password"
                                                placeholder={t('channels.easyConnect.passwordPlaceholder')}
                                                className="h-8 text-sm"
                                                value={newLinkPassword}
                                                onChange={e => setNewLinkPassword(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <Button size="sm" className="h-8 text-xs" onClick={createEasyLink} disabled={creatingLink || !newLinkTitle.trim()}>
                                                    {creatingLink ? t('channels.easyConnect.creatingBtn') : t('channels.easyConnect.createBtn')}
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowCreateLink(false)}>
                                                    {t('common.cancel')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Load links when tab is opened */}
                                    {easyLinksLoading && <p className="text-xs text-muted-foreground py-2">{t('channels.easyConnect.loading')}</p>}

                                    {!easyLinksLoading && easyLinks.length === 0 && !showCreateLink && (
                                        <div className="text-center py-6">
                                            <p className="text-sm text-muted-foreground">{t('channels.easyConnect.noLinks')}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{t('channels.easyConnect.noLinksDesc')}</p>
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
                                                <Switch
                                                    checked={link.isEnabled}
                                                    onCheckedChange={checked => toggleEasyLink(link.id, checked)}
                                                    title={link.isEnabled ? 'Disable link' : 'Enable link'}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs gap-1"
                                                    onClick={() => copyEasyLink(link.token, link.id)}
                                                >
                                                    {copiedLinkId === link.id ? '✓ Copied' : 'Copy URL'}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground"
                                                    title="Rename link"
                                                    onClick={() => { setEditingLinkId(link.id); setEditingLinkTitle(link.title) }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                    onClick={() => deleteEasyLink(link.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Vibe & Tone Tab ───────────────── */}
                        <TabsContent value="vibe" className="space-y-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">{t('channels.vibe.title')}</CardTitle>
                                        <CardDescription>{t('channels.vibe.desc')}</CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateVibe}
                                        disabled={generatingVibe || !description}
                                    >
                                        {generatingVibe ? (
                                            <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {t('channels.vibe.generatingVibe')}</>
                                        ) : (
                                            <><Sparkles className="h-4 w-4 mr-1" /> {t('channels.vibe.generateVibe')}</>
                                        )}
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(['personality', 'writingStyle', 'vocabulary', 'targetAudience', 'brandValues'] as const).map((field) => {
                                        const vibeLabels: Record<string, string> = {
                                            personality: t('channels.vibe.personality'),
                                            writingStyle: t('channels.vibe.writingStyle'),
                                            vocabulary: t('channels.vibe.vocabulary'),
                                            targetAudience: t('channels.vibe.targetAudience'),
                                            brandValues: t('channels.vibe.brandValues'),
                                        }
                                        const vibePlaceholders: Record<string, string> = {
                                            personality: t('channels.vibe.personalityPlaceholder'),
                                            writingStyle: t('channels.vibe.writingStylePlaceholder'),
                                            vocabulary: t('channels.vibe.vocabularyPlaceholder'),
                                            targetAudience: t('channels.vibe.targetAudiencePlaceholder'),
                                            brandValues: t('channels.vibe.brandValuesPlaceholder'),
                                        }
                                        return (
                                            <div key={field} className="space-y-2">
                                                <Label>{vibeLabels[field]}</Label>
                                                <Textarea
                                                    placeholder={vibePlaceholders[field]}
                                                    value={vibeTone[field] || ''}
                                                    onChange={(e) => setVibeTone({ ...vibeTone, [field]: e.target.value })}
                                                    rows={2}
                                                />
                                            </div>
                                        )
                                    })}

                                    {/* Custom Fields */}
                                    {Object.keys(vibeTone)
                                        .filter((k) => !['personality', 'writingStyle', 'vocabulary', 'targetAudience', 'brandValues'].includes(k))
                                        .length > 0 && (
                                            <>
                                                <Separator />
                                                <Label className="text-sm font-medium">{t('channels.vibe.customFields')}</Label>
                                            </>
                                        )}
                                    {Object.keys(vibeTone)
                                        .filter((k) => !['personality', 'writingStyle', 'vocabulary', 'targetAudience', 'brandValues'].includes(k))
                                        .map((key) => (
                                            <div key={key} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() => {
                                                            const updated = { ...vibeTone }
                                                            delete updated[key]
                                                            setVibeTone(updated)
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <Textarea
                                                    placeholder={t('channels.vibe.customFieldValue')}
                                                    value={vibeTone[key] || ''}
                                                    onChange={(e) => setVibeTone({ ...vibeTone, [key]: e.target.value })}
                                                    rows={2}
                                                />
                                            </div>
                                        ))}

                                    {addingVibeField ? (
                                        <div className="flex items-center gap-2 rounded-md border border-dashed p-3 bg-muted/30">
                                            <Input
                                                autoFocus
                                                placeholder={t('channels.vibe.customFieldName')}
                                                value={newVibeFieldName}
                                                onChange={(e) => setNewVibeFieldName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newVibeFieldName.trim()) {
                                                        const key = newVibeFieldName.trim().replace(/\s+/g, '_').toLowerCase()
                                                        if (!vibeTone[key]) {
                                                            setVibeTone({ ...vibeTone, [key]: '' })
                                                        }
                                                        setNewVibeFieldName('')
                                                        setAddingVibeField(false)
                                                    } else if (e.key === 'Escape') {
                                                        setNewVibeFieldName('')
                                                        setAddingVibeField(false)
                                                    }
                                                }}
                                                className="flex-1"
                                            />
                                            <Button
                                                size="sm"
                                                variant="default"
                                                disabled={!newVibeFieldName.trim()}
                                                onClick={() => {
                                                    const key = newVibeFieldName.trim().replace(/\s+/g, '_').toLowerCase()
                                                    if (key && !vibeTone[key]) {
                                                        setVibeTone({ ...vibeTone, [key]: '' })
                                                    }
                                                    setNewVibeFieldName('')
                                                    setAddingVibeField(false)
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setNewVibeFieldName('')
                                                    setAddingVibeField(false)
                                                }}
                                            >
                                                ✕
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-dashed"
                                            onClick={() => setAddingVibeField(true)}
                                        >
                                            <Plus className="h-4 w-4 mr-1" /> {t('channels.vibe.addCustomField')}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Knowledge Base Tab ─────────────── */}
                        <TabsContent value="knowledge" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <BookOpen className="h-4 w-4" />
                                        {t('channels.knowledge.title')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('channels.knowledge.desc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Add new entry */}
                                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <Input
                                                    placeholder={t('channels.knowledge.entryTitle')}
                                                    value={newKbTitle}
                                                    onChange={(e) => setNewKbTitle(e.target.value)}
                                                />
                                            </div>
                                            <Select value={newKbType} onValueChange={setNewKbType}>
                                                <SelectTrigger className="w-[160px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="text">
                                                        <span className="flex items-center gap-2"><Type className="h-3.5 w-3.5" /> Text</span>
                                                    </SelectItem>
                                                    <SelectItem value="url">
                                                        <span className="flex items-center gap-2"><LinkIcon className="h-3.5 w-3.5" /> URL</span>
                                                    </SelectItem>
                                                    <SelectItem value="google_sheet">
                                                        <span className="flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5" /> Google Sheet</span>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {(newKbType === 'url' || newKbType === 'google_sheet') && (
                                            <Input
                                                placeholder={newKbType === 'google_sheet' ? 'https://docs.google.com/spreadsheets/d/...' : 'https://example.com/page'}
                                                value={newKbUrl}
                                                onChange={(e) => setNewKbUrl(e.target.value)}
                                            />
                                        )}

                                        <Textarea
                                            placeholder={newKbType === 'text' ? t('channels.knowledge.contentPlaceholder') : t('channels.knowledge.notesPlaceholder')}
                                            value={newKbContent}
                                            onChange={(e) => setNewKbContent(e.target.value)}
                                            rows={3}
                                        />

                                        <Button
                                            size="sm"
                                            onClick={addKbEntry}
                                            disabled={!newKbTitle || addingKb}
                                            className="gap-2"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {t('channels.knowledge.addEntry')}
                                        </Button>
                                    </div>

                                    <Separator />

                                    {/* Existing entries */}
                                    {knowledgeEntries.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">{t('channels.knowledge.noEntries')}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {knowledgeEntries.map((entry) => {
                                                const Icon = sourceTypeIcons[entry.sourceType] || Type
                                                return (
                                                    <div key={entry.id} className="flex items-start gap-3 p-3 border rounded-lg group hover:border-primary/20 transition-colors">
                                                        <div className="p-2 rounded-md bg-muted shrink-0 mt-0.5">
                                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-medium text-sm truncate">{entry.title}</h4>
                                                                <Badge variant="outline" className="text-[10px] shrink-0">
                                                                    {sourceTypeLabels[entry.sourceType] || entry.sourceType}
                                                                </Badge>
                                                            </div>
                                                            {entry.sourceUrl && (
                                                                <a
                                                                    href={entry.sourceUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                                                                >
                                                                    <ExternalLink className="h-3 w-3" />
                                                                    {entry.sourceUrl.length > 60 ? entry.sourceUrl.substring(0, 60) + '...' : entry.sourceUrl}
                                                                </a>
                                                            )}
                                                            {entry.content && (
                                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                                    {entry.content}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive"
                                                            onClick={() => deleteKbEntry(entry.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Templates Tab ──────────────────── */}
                        <TabsContent value="templates" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        {t('channels.templates.title')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('channels.templates.desc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                                        <Input
                                            placeholder={t('channels.templates.namePlaceholder')}
                                            value={newTplName}
                                            onChange={(e) => setNewTplName(e.target.value)}
                                        />
                                        <Textarea
                                            placeholder={t('channels.templates.contentPlaceholder')}
                                            value={newTplContent}
                                            onChange={(e) => setNewTplContent(e.target.value)}
                                            rows={4}
                                            className="font-mono text-sm"
                                        />
                                        <Button
                                            size="sm"
                                            onClick={addTemplate}
                                            disabled={!newTplName || !newTplContent || addingTpl}
                                            className="gap-2"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {t('channels.templates.addTemplate')}
                                        </Button>
                                    </div>

                                    <Separator />

                                    {templates.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">{t('channels.templates.noTemplates')}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {templates.map((tpl) => (
                                                <div key={tpl.id} className="flex items-start gap-3 p-3 border rounded-lg group hover:border-primary/20 transition-colors">
                                                    <div className="p-2 rounded-md bg-muted shrink-0 mt-0.5">
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm">{tpl.name}</h4>
                                                        <p className="text-xs text-muted-foreground mt-1 font-mono line-clamp-2">
                                                            {tpl.templateContent}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive"
                                                        onClick={() => deleteTemplate(tpl.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Hashtags Tab ───────────────────── */}
                        <TabsContent value="hashtags" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Hash className="h-4 w-4" />
                                        {t('channels.hashtags.title')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('channels.hashtags.desc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                                        <Input
                                            placeholder={t('channels.hashtags.namePlaceholder')}
                                            value={newHashName}
                                            onChange={(e) => setNewHashName(e.target.value)}
                                        />
                                        <Textarea
                                            placeholder={t('channels.hashtags.tagsPlaceholder')}
                                            value={newHashTags}
                                            onChange={(e) => setNewHashTags(e.target.value)}
                                            rows={2}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={addHashtagGroup}
                                            disabled={!newHashName || addingHash}
                                            className="gap-2"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {t('channels.hashtags.addGroup')}
                                        </Button>
                                    </div>

                                    <Separator />

                                    {hashtags.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">{t('channels.hashtags.noGroups')}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {hashtags.map((group) => (
                                                <div key={group.id} className="flex items-start gap-3 p-3 border rounded-lg group/item hover:border-primary/20 transition-colors">
                                                    <div className="p-2 rounded-md bg-muted shrink-0 mt-0.5">
                                                        <Hash className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium text-sm">{group.name}</h4>
                                                            <Badge variant="outline" className="text-[10px]">
                                                                {(group.hashtags as string[]).length} {t('channels.hashtags.tags')}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {(group.hashtags as string[]).slice(0, 8).map((tag, i) => (
                                                                <span key={i} className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                                    {tag.startsWith('#') ? tag : `#${tag}`}
                                                                </span>
                                                            ))}
                                                            {(group.hashtags as string[]).length > 8 && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    +{(group.hashtags as string[]).length - 8} {t('channels.hashtags.more')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 text-destructive"
                                                        onClick={() => deleteHashtagGroup(group.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Webhooks Tab ───────────────────── */}
                        <TabsContent value="webhooks" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Bell className="h-4 w-4" />
                                        {t('channels.webhooks.title')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('channels.webhooks.desc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Discord */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <span className="h-4 w-4 rounded-full bg-[#5865F2] inline-block" />
                                            Discord {t('channels.webhooks.webhookUrl')}
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="https://discord.com/api/webhooks/..."
                                                value={webhookDiscordUrl}
                                                onChange={(e) => setWebhookDiscordUrl(e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleWebhookTest('discord')}
                                                disabled={!webhookDiscordUrl || testingWebhook === 'discord'}
                                                className="gap-1.5 shrink-0"
                                            >
                                                {testingWebhook === 'discord' ? (
                                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                                                ) : (
                                                    <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Telegram */}
                                    <div className="space-y-3">
                                        <Label className="flex items-center gap-2">
                                            <span className="h-4 w-4 rounded-full bg-[#0088cc] inline-block" />
                                            Telegram
                                        </Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">{t('channels.webhooks.botToken')}</Label>
                                                <Input
                                                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v..."
                                                    value={webhookTelegramToken}
                                                    onChange={(e) => setWebhookTelegramToken(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">{t('channels.webhooks.chatId')}</Label>
                                                <Input
                                                    placeholder="-1001234567890"
                                                    value={webhookTelegramChatId}
                                                    onChange={(e) => setWebhookTelegramChatId(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleWebhookTest('telegram')}
                                            disabled={!webhookTelegramToken || !webhookTelegramChatId || testingWebhook === 'telegram'}
                                            className="gap-1.5"
                                        >
                                            {testingWebhook === 'telegram' ? (
                                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                                            ) : (
                                                <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                                            )}
                                        </Button>
                                    </div>

                                    <Separator />

                                    {/* Slack */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <span className="h-4 w-4 rounded-full bg-[#4A154B] inline-block" />
                                            Slack {t('channels.webhooks.webhookUrl')}
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="https://hooks.slack.com/services/..."
                                                value={webhookSlackUrl}
                                                onChange={(e) => setWebhookSlackUrl(e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleWebhookTest('slack')}
                                                disabled={!webhookSlackUrl || testingWebhook === 'slack'}
                                                className="gap-1.5 shrink-0"
                                            >
                                                {testingWebhook === 'slack' ? (
                                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                                                ) : (
                                                    <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Zalo OA */}
                                    <div className="space-y-3">
                                        <Label className="flex items-center gap-2">
                                            <span className="h-4 w-4 rounded-full bg-[#0068FF] inline-block" />
                                            Zalo OA
                                        </Label>

                                        {webhookZaloOaName ? (
                                            /* Connected state */
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                                                    <div className="h-8 w-8 rounded-full bg-[#0068FF] flex items-center justify-center">
                                                        <Check className="h-4 w-4 text-white" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{webhookZaloOaName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {t('channels.webhooks.connectedAt') || 'Connected'}{' '}
                                                            {webhookZaloConnectedAt ? new Date(webhookZaloConnectedAt).toLocaleDateString() : ''}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive gap-1.5 shrink-0"
                                                        onClick={() => {
                                                            setWebhookZaloAppId('')
                                                            setWebhookZaloSecretKey('')
                                                            setWebhookZaloRefreshToken('')
                                                            setWebhookZaloOaName('')
                                                            setWebhookZaloConnectedAt('')
                                                            toast.info('Zalo OA disconnected. Click Save to confirm. / Đã ngắt kết nối Zalo OA. Nhấn Lưu để xác nhận.')
                                                        }}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                        {t('common.disconnect') || 'Disconnect'}
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-muted-foreground">Người nhận thông báo (Follower)</Label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                                                            value={webhookZaloUserId}
                                                            onChange={(e) => setWebhookZaloUserId(e.target.value)}
                                                        >
                                                            <option value="">{zaloFollowers.length > 0 ? '-- Chọn follower --' : '-- Nhấn Load để tải danh sách --'}</option>
                                                            {zaloFollowers.map((f) => (
                                                                <option key={f.userId} value={f.userId}>
                                                                    {f.displayName} ({f.userId})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1.5 shrink-0"
                                                            disabled={zaloLoadingFollowers}
                                                            onClick={async () => {
                                                                setZaloLoadingFollowers(true)
                                                                try {
                                                                    const res = await fetch(`/api/admin/channels/${id}/zalo-followers`)
                                                                    const data = await res.json()
                                                                    if (res.ok && data.followers) {
                                                                        setZaloFollowers(data.followers)
                                                                        if (data.followers.length === 0) {
                                                                            toast.info('Không có follower nào. Hãy follow OA trước.')
                                                                        } else {
                                                                            toast.success(`Đã tải ${data.followers.length} follower`)
                                                                        }
                                                                    } else {
                                                                        toast.error(data.error || 'Không thể tải followers')
                                                                    }
                                                                } catch {
                                                                    toast.error('Lỗi kết nối')
                                                                } finally {
                                                                    setZaloLoadingFollowers(false)
                                                                }
                                                            }}
                                                        >
                                                            {zaloLoadingFollowers ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <RefreshCw className="h-3.5 w-3.5" />
                                                            )}
                                                            Load
                                                        </Button>
                                                    </div>
                                                    {webhookZaloUserId && (
                                                        <p className="text-xs text-muted-foreground">ID: {webhookZaloUserId}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleWebhookTest('zalo')}
                                                    disabled={!webhookZaloUserId || testingWebhook === 'zalo'}
                                                    className="gap-1.5"
                                                >
                                                    {testingWebhook === 'zalo' ? (
                                                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                                                    ) : (
                                                        <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                                                    )}
                                                </Button>
                                            </div>
                                        ) : (
                                            /* Not connected state */
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-muted-foreground/30">
                                                    <div className="h-8 w-8 rounded-full bg-[#0068FF]/10 flex items-center justify-center">
                                                        <LinkIcon className="h-4 w-4 text-[#0068FF]" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-muted-foreground">
                                                            {t('channels.webhooks.zaloNotConnected') || 'Chưa kết nối Zalo OA. Nhấn nút bên dưới để kết nối qua OAuth.'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    className="gap-1.5 bg-[#0068FF] hover:bg-[#0068FF]/90 text-white"
                                                    size="sm"
                                                    disabled={zaloConnecting}
                                                    onClick={() => {
                                                        setZaloConnecting(true)
                                                        window.location.href = `/api/oauth/zalo?channelId=${id}`
                                                    }}
                                                >
                                                    {zaloConnecting ? (
                                                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang kết nối...</>
                                                    ) : (
                                                        <><LinkIcon className="h-3.5 w-3.5" /> Connect Zalo OA / Kết nối Zalo OA</>
                                                    )}
                                                </Button>
                                                {isAdmin && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Admin cần cấu hình Zalo App ID + Secret trong{' '}
                                                        <a href="/admin/integrations" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                            Admin → Integrations
                                                        </a>{' '}
                                                        trước khi kết nối.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    {/* Custom */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-orange-400" />
                                            {t('channels.webhooks.customWebhook')}
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="https://your-server.com/webhook"
                                                value={webhookCustomUrl}
                                                onChange={(e) => setWebhookCustomUrl(e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleWebhookTest('custom')}
                                                disabled={!webhookCustomUrl || testingWebhook === 'custom'}
                                                className="gap-1.5 shrink-0"
                                            >
                                                {testingWebhook === 'custom' ? (
                                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                                                ) : (
                                                    <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {t('channels.webhooks.customWebhookDesc')}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Members Tab ───────────────────── */}
                        <TabsContent value="members" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base">{t('channels.members.title')}</CardTitle>
                                            <CardDescription>{t('channels.members.desc')}</CardDescription>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setAddingMember(!addingMember)
                                                if (!addingMember && isAdmin && allUsers.length === 0) {
                                                    fetch('/api/admin/users').then(r => r.ok ? r.json() : []).then(data => setAllUsers(data)).catch(() => { })
                                                }
                                            }}
                                            className="gap-1.5"
                                        >
                                            <UserPlus className="h-3.5 w-3.5" />
                                            {t('channels.members.addMember')}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Add member form */}
                                    {addingMember && (
                                        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                                            {/* Admin: Select existing user */}
                                            {isAdmin && (
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="col-span-2">
                                                        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('channels.members.selectUser')}</label>
                                                        <select
                                                            value={selectedUserId}
                                                            onChange={(e) => setSelectedUserId(e.target.value)}
                                                            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                                        >
                                                            <option value="">{t('channels.members.selectUser')}</option>
                                                            {allUsers
                                                                .filter(u => !members.some(m => m.userId === u.id))
                                                                .map(u => (
                                                                    <option key={u.id} value={u.id}>{u.name ? `${u.name} (${u.email})` : u.email}</option>
                                                                ))
                                                            }
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('channels.members.role')}</label>
                                                        <select
                                                            value={selectedRole}
                                                            onChange={(e) => setSelectedRole(e.target.value)}
                                                            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                                        >
                                                            <option value="OWNER">{t('channels.memberRoles.owner')}</option>
                                                            <option value="MANAGER">{t('channels.memberRoles.manager')}</option>
                                                            <option value="STAFF">{t('channels.memberRoles.staff')}</option>
                                                            <option value="CUSTOMER">{t('channels.memberRoles.customer')}</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Admin: Add by user button */}
                                            {isAdmin && selectedUserId && (
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(''); setAddingMember(false) }}>
                                                        {t('common.cancel')}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={async () => {
                                                            try {
                                                                const res = await fetch(`/api/admin/channels/${id}/members`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
                                                                })
                                                                if (res.status === 409) { toast.error(t('channels.members.alreadyMember')); return }
                                                                if (!res.ok) throw new Error()
                                                                const member = await res.json()
                                                                setMembers(prev => [...prev, member])
                                                                setSelectedUserId('')
                                                                setAddingMember(false)
                                                                toast.success(t('channels.members.added'))
                                                            } catch { toast.error(t('channels.members.addFailed')) }
                                                        }}
                                                    >
                                                        <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                                        {t('channels.members.addMember')}
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Divider for admin */}
                                            {isAdmin && (
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <div className="flex-1 border-t" />
                                                    <span>{t('channels.members.orInviteByEmail')}</span>
                                                    <div className="flex-1 border-t" />
                                                </div>
                                            )}

                                            {/* Email invite (all users) */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="col-span-2">
                                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('channels.members.inviteByEmail')}</label>
                                                    <Input
                                                        type="email"
                                                        placeholder={t('channels.members.emailPlaceholder')}
                                                        value={inviteEmail}
                                                        onChange={(e) => setInviteEmail(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('channels.members.role')}</label>
                                                    <select
                                                        value={selectedRole}
                                                        onChange={(e) => setSelectedRole(e.target.value)}
                                                        className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                                    >
                                                        <option value="OWNER">{t('channels.memberRoles.owner')}</option>
                                                        <option value="MANAGER">{t('channels.memberRoles.manager')}</option>
                                                        <option value="STAFF">{t('channels.memberRoles.staff')}</option>
                                                        <option value="CUSTOMER">{t('channels.memberRoles.customer')}</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" size="sm" onClick={() => { setInviteEmail(''); setAddingMember(false) }}>
                                                    {t('common.cancel')}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    disabled={!inviteEmail || sendingInvite}
                                                    onClick={async () => {
                                                        setSendingInvite(true)
                                                        try {
                                                            const res = await fetch(`/api/admin/channels/${id}/members`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ email: inviteEmail, role: selectedRole }),
                                                            })
                                                            if (res.status === 409) { toast.error(t('channels.members.alreadyMember')); return }
                                                            if (!res.ok) throw new Error()
                                                            const member = await res.json()
                                                            setMembers(prev => [...prev, member])
                                                            setInviteEmail('')
                                                            setAddingMember(false)
                                                            toast.success(t('channels.members.inviteSent'))
                                                        } catch { toast.error(t('channels.members.inviteFailed')) }
                                                        finally { setSendingInvite(false) }
                                                    }}
                                                >
                                                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                                    {sendingInvite ? t('channels.members.sending') : t('channels.members.sendInvite')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Members list */}
                                    {members.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                            <p className="font-medium">{t('channels.members.noMembers')}</p>
                                            <p className="text-xs mt-1">{t('channels.members.noMembersDesc')}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {members.map((member) => (
                                                <div key={member.id} className="border rounded-lg overflow-hidden">
                                                    <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                                                {member.user?.name?.[0]?.toUpperCase() || member.user?.email?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium">{member.user?.name || member.user?.email}</p>
                                                                <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' :
                                                                member.role === 'OWNER' ? 'bg-amber-500/10 text-amber-500' :
                                                                    member.role === 'MANAGER' ? 'bg-blue-500/10 text-blue-500' :
                                                                        member.role === 'STAFF' ? 'bg-indigo-500/10 text-indigo-400' :
                                                                            'bg-neutral-500/10 text-neutral-400'
                                                                }`}>
                                                                {member.role}
                                                            </span>
                                                            {isAdmin && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 gap-1"
                                                                    onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                                                                >
                                                                    <Shield className="h-3.5 w-3.5" />
                                                                    {expandedMember === member.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                                </Button>
                                                            )}
                                                            {isAdmin && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                                                    onClick={async () => {
                                                                        try {
                                                                            await fetch(`/api/admin/channels/${id}/members?memberId=${member.id}`, { method: 'DELETE' })
                                                                            setMembers(prev => prev.filter(m => m.id !== member.id))
                                                                            toast.success(t('channels.members.removed'))
                                                                        } catch {
                                                                            toast.error(t('channels.members.removeFailed'))
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Expanded permissions */}
                                                    {expandedMember === member.id && (
                                                        <div className="border-t px-4 py-3 bg-muted/20">
                                                            <p className="text-xs font-medium text-muted-foreground mb-3">
                                                                <Shield className="h-3 w-3 inline mr-1" />
                                                                {t('channels.members.permissions')}
                                                            </p>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                {[
                                                                    'canCreatePost', 'canEditPost', 'canDeletePost', 'canApprovePost',
                                                                    'canSchedulePost', 'canUploadMedia', 'canDeleteMedia', 'canViewMedia',
                                                                    'canCreateEmail', 'canManageContacts', 'canViewReports', 'canEditSettings',
                                                                ].map((perm) => (
                                                                    <label
                                                                        key={perm}
                                                                        className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-2 py-1.5 transition-colors"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={member.permission?.[perm] ?? false}
                                                                            onChange={async (e) => {
                                                                                const newVal = e.target.checked
                                                                                // Optimistic update
                                                                                setMembers(prev => prev.map(m =>
                                                                                    m.id === member.id
                                                                                        ? { ...m, permission: { ...m.permission, [perm]: newVal } }
                                                                                        : m
                                                                                ))
                                                                                try {
                                                                                    await fetch(`/api/admin/channels/${id}/members/${member.id}`, {
                                                                                        method: 'PUT',
                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                        body: JSON.stringify({ permissions: { ...member.permission, [perm]: newVal } }),
                                                                                    })
                                                                                } catch {
                                                                                    // Revert on error
                                                                                    setMembers(prev => prev.map(m =>
                                                                                        m.id === member.id
                                                                                            ? { ...m, permission: { ...m.permission, [perm]: !newVal } }
                                                                                            : m
                                                                                    ))
                                                                                    toast.error(t('channels.members.updateFailed'))
                                                                                }
                                                                            }}
                                                                            className="rounded border-muted-foreground/30"
                                                                        />
                                                                        <span>{t(`channels.members.permissionLabels.${perm}`)}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                            {/* Reset to defaults */}
                                                            <div className="mt-2 flex justify-end">
                                                                <button
                                                                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const res = await fetch(`/api/admin/channels/${id}/members/${member.id}/reset-permissions`, { method: 'POST' })
                                                                            if (!res.ok) throw new Error()
                                                                            const updated = await res.json()
                                                                            setMembers(prev => prev.map(m => m.id === member.id ? updated : m))
                                                                            toast.success(t('channels.memberPerms.resetSuccess'))
                                                                        } catch {
                                                                            toast.error(t('channels.memberPerms.resetFailed'))
                                                                        }
                                                                    }}
                                                                >
                                                                    {t('channels.memberPerms.resetToDefaults')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ─── Customers Tab ───────────────────── */}
                        <TabsContent value="customers" className="space-y-4">
                            <CustomersTab channelId={id} />
                        </TabsContent>

                        {/* ─── Chat Bot Tab ───────────────────── */}
                        <TabsContent value="chatbot" className="space-y-4">
                            <ChatBotTab channelId={id} />
                        </TabsContent>

                        {/* ─── Auto Content Pipeline Tab ──────── */}
                        <TabsContent value="auto-content" className="space-y-4">
                            <AutoContentTab channelId={id} />
                        </TabsContent>

                    </div>
                </div>
            </Tabs>
        </div>
    )
}

// ─────────────────────────────────────────────────────────
// Customers Tab Component
// ─────────────────────────────────────────────────────────
function CustomersTab({ channelId }: { channelId: string }) {
    const t = useTranslation()
    const [customers, setCustomers] = useState<{ user: { id: string; name: string | null; email: string; isActive: boolean } }[]>([])
    const [invites, setInvites] = useState<{ id: string; email: string; name: string | null; expiresAt: string; token: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [inviting, setInviting] = useState(false)
    const [inviteUrl, setInviteUrl] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!channelId) return
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/customers`)
            const data = await res.json()
            setCustomers(data.members || [])
            setInvites(data.invites || [])
        } finally {
            setLoading(false)
        }
    }, [channelId])

    useEffect(() => { load() }, [load])

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault()
        if (!email) return
        setInviting(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name }),
            })
            const data = await res.json()
            if (res.ok) {
                setInviteUrl(data.inviteUrl)
                setEmail('')
                setName('')
                load()
            }
        } finally {
            setInviting(false)
        }
    }

    async function toggleActive(customerId: string, isActive: boolean) {
        await fetch(`/api/admin/channels/${channelId}/customers/${customerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: isActive ? 'deactivate' : 'activate' }),
        })
        load()
    }

    async function removeCustomer(customerId: string) {
        if (!confirm('Remove this customer from the channel?')) return
        await fetch(`/api/admin/channels/${channelId}/customers/${customerId}`, { method: 'DELETE' })
        load()
    }

    async function removeInvite(inviteId: string) {
        if (!confirm('Cancel this invite?')) return
        await fetch(`/api/admin/channels/${channelId}/customers/${inviteId}`, { method: 'DELETE' })
        load()
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> {t('channels.customers.title')}</CardTitle>
                <CardDescription>{t('channels.customers.desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Invite form */}
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        placeholder={t('channels.customers.namePlaceholder')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="border border-border rounded-md px-3 py-2 text-sm bg-background flex-1"
                    />
                    <input
                        type="email"
                        placeholder={t('channels.customers.emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="border border-border rounded-md px-3 py-2 text-sm bg-background flex-1"
                    />
                    <Button type="submit" disabled={inviting || !email} size="sm" className="gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" />
                        {inviting ? t('channels.customers.sending') : t('channels.customers.sendInvite')}
                    </Button>
                </form>

                {/* Show invite URL after sending */}
                {inviteUrl && (
                    <div className="bg-muted rounded-lg px-4 py-3 text-sm">
                        <p className="text-muted-foreground mb-1">{t('channels.customers.inviteLinkSent')}</p>
                        <div className="flex items-center gap-2">
                            <code className="text-xs bg-background border border-border rounded px-2 py-1 flex-1 overflow-x-auto">{inviteUrl}</code>
                            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteUrl); setInviteUrl(null) }}>
                                {t('channels.customers.copyClose')}
                            </Button>
                        </div>
                    </div>
                )}

                <Separator />

                {/* Active customers */}
                <div>
                    <h4 className="text-sm font-medium mb-3">{t('channels.customers.activeCustomers')} ({customers.length})</h4>
                    {loading ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : customers.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">{t('channels.customers.noCustomers')}</p>
                    ) : (
                        <div className="space-y-2">
                            {customers.map(({ user }) => (
                                <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5">
                                    <div>
                                        <p className="text-sm font-medium">{user.name || user.email}</p>
                                        {user.name && <p className="text-xs text-muted-foreground">{user.email}</p>}\
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={user.isActive ? 'default' : 'secondary'} className="text-xs">
                                            {user.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                        <Button size="sm" variant="ghost" onClick={() => toggleActive(user.id, user.isActive)}>
                                            {user.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}\
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => removeCustomer(user.id)}>
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pending invites */}
                {invites.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium mb-3">{t('channels.customers.pendingInvites')} ({invites.length})</h4>
                        <div className="space-y-2">
                            {invites.map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-2.5">
                                    <div>
                                        <p className="text-sm font-medium">{inv.name || inv.email}</p>
                                        {inv.name && <p className="text-xs text-muted-foreground">{inv.email}</p>}
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Expires {new Date(inv.expiresAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">Pending</Badge>
                                        <Button size="sm" variant="ghost" title="Copy invite link" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`)}>
                                            <LinkIcon className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => removeInvite(inv.id)}>
                                            <X className="h-3.5 w-3.5 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}
