'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n'
import {
    Key,
    Loader2,
    Eye,
    EyeOff,
    CheckCircle,
    Save,
    Trash2,
    BrainCircuit,
    ExternalLink,
    Info,
    RefreshCw,
    Star,
    Zap,
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

// ─── Provider metadata (guide info per provider) ───────────
interface ProviderGuide {
    description: string
    placeholder: string
    guideUrl: string
    guideLabel: string
    guideSteps: { title: string; detail: string }[]
    tips?: string[]
}

const providerGuides: Record<string, ProviderGuide> = {
    gemini: {
        description: 'Google AI Studio — Gemini Pro, Flash, Ultra',
        placeholder: 'AIza...',
        guideUrl: 'https://aistudio.google.com/apikey',
        guideLabel: 'Open Google AI Studio',
        guideSteps: [
            { title: 'Visit Google AI Studio', detail: 'Go to aistudio.google.com' },
            { title: 'Get API Key', detail: 'Click "Get API Key" at the top' },
            { title: 'Create or select project', detail: 'Create a new API key or select existing project' },
            { title: 'Copy API key', detail: 'Copy the key — free tier with RPM limits' },
        ],
        tips: ['Free tier supports 15 RPM for Gemini Flash', 'Gemini Pro/Flash available'],
    },
    openai: {
        description: 'GPT-4o, GPT-4o mini, o1, o3',
        placeholder: 'sk-...',
        guideUrl: 'https://platform.openai.com/api-keys',
        guideLabel: 'Open OpenAI Platform',
        guideSteps: [
            { title: 'Sign in', detail: 'Sign in at platform.openai.com' },
            { title: 'Navigate to API Keys', detail: 'Go to API Keys → Create new secret key' },
            { title: 'Name and copy', detail: 'Name your key and copy it' },
            { title: 'Billing required', detail: 'Note: Billing plan required for API usage' },
        ],
        tips: ['GPT-4o mini is most cost-effective for content generation'],
    },
    anthropic: {
        description: 'Claude 3.5 Sonnet, Haiku, Opus',
        placeholder: 'sk-ant-api...',
        guideUrl: 'https://console.anthropic.com/settings/keys',
        guideLabel: 'Open Anthropic Console',
        guideSteps: [
            { title: 'Create account', detail: 'Sign up at console.anthropic.com' },
            { title: 'Go to API Keys', detail: 'Navigate to Settings → API Keys' },
            { title: 'Create a key', detail: 'Click "Create Key" and copy it' },
            { title: 'Add credits', detail: 'Add billing credits to activate' },
        ],
        tips: ['Claude 3.5 Sonnet is excellent for creative writing'],
    },
    openrouter: {
        description: 'Access 100+ models via one API key',
        placeholder: 'sk-or-v1-...',
        guideUrl: 'https://openrouter.ai/keys',
        guideLabel: 'Open OpenRouter',
        guideSteps: [
            { title: 'Create account', detail: 'Sign up at openrouter.ai' },
            { title: 'Get API Key', detail: 'Go to Keys → Create Key' },
            { title: 'Add credits', detail: 'Add credits to your account' },
            { title: 'Choose models', detail: 'Access any model through a single API' },
        ],
        tips: ['One key for all models (GPT, Claude, Llama, Mistral...)'],
    },
    runware: {
        description: 'Image generation — FLUX, SDXL (also used by Neeflow Studio)',
        placeholder: 'Enter Runware API key...',
        guideUrl: 'https://my.runware.ai/signup',
        guideLabel: 'Open Runware Dashboard',
        guideSteps: [
            { title: 'Sign up at runware.ai', detail: 'Go to my.runware.ai and create account' },
            { title: 'Go to API Keys', detail: 'Dashboard → API Keys → Create Key' },
            { title: 'Create and copy', detail: 'Copy your key — used for text & image generation' },
        ],
        tips: ['One key covers text models and Studio image generation'],
    },
    fal_ai: {
        description: 'FLUX, Kling, Stable Diffusion — used by Neeflow Studio',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxx...',
        guideUrl: 'https://fal.ai/keys',
        guideLabel: 'Open Fal.ai Dashboard',
        guideSteps: [
            { title: 'Sign up at fal.ai', detail: 'Go to fal.ai and create a free account' },
            { title: 'Go to Keys section', detail: 'Navigate to your account → API Keys' },
            { title: 'Create and copy', detail: 'Click "Create Key", copy immediately — it won\'t be shown again' },
        ],
        tips: ['Fal.ai powers Studio image generation, face swap, img2img', 'Free credits on signup'],
    },
    studio_runware: {
        description: 'Image generation — FLUX, SDXL, DALL-E (Studio only)',
        placeholder: 'Enter Runware API key...',
        guideUrl: 'https://my.runware.ai/signup',
        guideLabel: 'Open Runware Dashboard',
        guideSteps: [
            { title: 'Sign up at runware.ai', detail: 'Go to my.runware.ai and create an account' },
            { title: 'Go to API Keys', detail: 'Dashboard → API Keys → Create Key' },
            { title: 'Copy your key', detail: 'Copy the key — used for Neeflow Studio image generation' },
        ],
        tips: ['Runware is used only for Neeflow Studio avatar/image generation', 'Separate from the Runware AI text provider above'],
    },
    studio_openai: {
        description: 'DALL-E 3 / DALL-E 2 image generation (Studio only)',
        placeholder: 'sk-...',
        guideUrl: 'https://platform.openai.com/api-keys',
        guideLabel: 'Open OpenAI Platform',
        guideSteps: [
            { title: 'Sign in to OpenAI', detail: 'Go to platform.openai.com' },
            { title: 'API Keys', detail: 'Navigate to API Keys → Create new secret key' },
            { title: 'Copy key', detail: 'Copy the key — used for DALL-E image generation in Studio' },
        ],
        tips: ['This key is used only for Neeflow Studio image generation via DALL-E', 'Separate from the OpenAI text key above'],
    },
}

const providerColors: Record<string, string> = {
    gemini: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    openai: 'bg-green-500/10 text-green-500 border-green-500/20',
    anthropic: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    openrouter: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    runware: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    synthetic: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    fal_ai: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    studio_runware: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    studio_openai: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
}


// ─── Types ─────────────────────────────────────────────────
interface AiProvider {
    id: string
    provider: string
    name: string
    status: string
}

interface UserApiKeyData {
    id: string
    provider: string
    name: string
    defaultModel: string | null
    isDefault: boolean
    isActive: boolean
}

interface ModelInfo {
    id: string
    name: string
    type: string
    description?: string
}

// ─── Status Badge ──────────────────────────────────────────
function StatusBadge({ hasKey, isDefault }: { hasKey: boolean; isDefault: boolean }) {
    if (hasKey && isDefault) {
        return (
            <Badge variant="outline" className="text-[10px] px-1.5 gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                <Star className="h-3 w-3 fill-current" />
                Default
            </Badge>
        )
    }
    if (hasKey) {
        return (
            <Badge variant="outline" className="text-[10px] px-1.5 gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                <CheckCircle className="h-3 w-3" />
                Configured
            </Badge>
        )
    }
    return (
        <Badge variant="outline" className="text-[10px] px-1.5 gap-1 bg-muted text-muted-foreground">
            Not configured
        </Badge>
    )
}

// ─── Provider Card ─────────────────────────────────────────
function ProviderCard({
    provider,
    existingKey,
    apiKeyValue,
    showKey,
    isSaving,
    isDeleting,
    isTesting,
    testResult,
    showGuide,
    models,
    isLoadingModels,
    selectedModel,
    onApiKeyChange,
    onToggleShow,
    onSave,
    onDelete,
    onTest,
    onToggleGuide,
    onFetchModels,
    onModelSelect,
    onSetDefault,
}: {
    provider: AiProvider
    existingKey: UserApiKeyData | undefined
    apiKeyValue: string
    showKey: boolean
    isSaving: boolean
    isDeleting: boolean
    isTesting: boolean
    testResult?: { success: boolean; message: string }
    showGuide: boolean
    models: ModelInfo[]
    isLoadingModels: boolean
    selectedModel: string
    onApiKeyChange: (val: string) => void
    onToggleShow: () => void
    onSave: () => void
    onDelete: () => void
    onTest: () => void
    onToggleGuide: () => void
    onFetchModels: () => void
    onModelSelect: (modelId: string) => void
    onSetDefault: () => void
}) {
    const hasKey = !!existingKey
    const guide = providerGuides[provider.provider]
    const colorClass = providerColors[provider.provider] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    const textModels = models.filter(m => m.type === 'text')
    const hasModels = models.length > 0

    return (
        <Card className={`relative transition-all hover:shadow-md ${colorClass} border`}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                    </div>
                    <StatusBadge hasKey={hasKey} isDefault={existingKey?.isDefault || false} />
                </div>
                <CardDescription className="text-xs">
                    {guide?.description || `${provider.provider} integration`}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Setup Guide Link */}
                {guide && (
                    <div>
                        <button
                            type="button"
                            onClick={onToggleGuide}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                            <Info className="h-3.5 w-3.5" />
                            <span>{showGuide ? 'Hide guide' : 'How to get API Key'}</span>
                        </button>

                        <Dialog open={showGuide} onOpenChange={onToggleGuide}>
                            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-xl">{provider.name} API Key</DialogTitle>
                                    <p className="text-sm text-muted-foreground mt-1">{guide.description}</p>
                                </DialogHeader>

                                <div className="space-y-3 mt-4">
                                    {guide.guideSteps.map((step, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 pt-0.5">
                                                <p className="text-sm font-medium">{step.title}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {guide.tips && guide.tips.length > 0 && (
                                    <div className="mt-5 rounded-lg border border-dashed p-3 bg-muted/30">
                                        <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                                            💡 Pro Tips
                                        </p>
                                        <ul className="space-y-1.5">
                                            {guide.tips.map((tip, i) => (
                                                <li key={i} className="text-[11px] text-muted-foreground flex gap-2">
                                                    <span className="text-yellow-500 mt-0.5">•</span>
                                                    <span>{tip}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="mt-4 flex justify-between items-center">
                                    <a
                                        href={guide.guideUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        {guide.guideLabel}
                                    </a>
                                    <Button variant="outline" size="sm" onClick={onToggleGuide} className="cursor-pointer">
                                        Close
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                )}

                {/* API Key Input */}
                <div className="space-y-1">
                    <Label className="text-[11px]">API Key</Label>
                    <div className="relative">
                        <Input
                            type={showKey ? 'text' : 'password'}
                            value={apiKeyValue}
                            onChange={(e) => onApiKeyChange(e.target.value)}
                            placeholder={hasKey ? '••••••••••••••••' : (guide?.placeholder || 'Enter API key...')}
                            className="pr-8 h-8 text-xs"
                        />
                        <button
                            type="button"
                            onClick={onToggleShow}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                </div>

                {/* Save + Test + Delete buttons */}
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1.5 cursor-pointer"
                        onClick={onSave}
                        disabled={isSaving || !apiKeyValue.trim()}
                    >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>

                    {hasKey && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1 cursor-pointer"
                            onClick={onTest}
                            disabled={isTesting}
                        >
                            {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                            Test
                        </Button>
                    )}

                    {hasKey && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1 text-destructive hover:text-destructive cursor-pointer"
                            onClick={onDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                    )}
                </div>

                {/* Test Result */}
                {testResult && (
                    <div className={`rounded-md p-2 text-xs ${testResult.success ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
                        {testResult.success ? <CheckCircle className="h-3.5 w-3.5 inline mr-1" /> : '⚠️ '}
                        {testResult.message}
                    </div>
                )}

                {/* Model Selection (only when key exists) */}
                {hasKey && (
                    <div className="space-y-2 pt-2 border-t border-dashed">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px]">Default Model</Label>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] gap-1 px-2 cursor-pointer"
                                onClick={onFetchModels}
                                disabled={isLoadingModels}
                            >
                                {isLoadingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                {hasModels ? 'Refresh' : 'Load Models'}
                            </Button>
                        </div>

                        {hasModels ? (
                            <Select value={selectedModel} onValueChange={onModelSelect}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select a model..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {textModels.length > 0 && (
                                        <>
                                            <SelectItem value="__text_label" disabled className="text-[10px] font-semibold text-muted-foreground">
                                                Text Models
                                            </SelectItem>
                                            {textModels.map(m => (
                                                <SelectItem key={m.id} value={m.id} className="text-xs">
                                                    {m.name}
                                                </SelectItem>
                                            ))}
                                        </>
                                    )}
                                    {models.filter(m => m.type === 'image').length > 0 && (
                                        <>
                                            <SelectItem value="__image_label" disabled className="text-[10px] font-semibold text-muted-foreground">
                                                Image Models
                                            </SelectItem>
                                            {models.filter(m => m.type === 'image').map(m => (
                                                <SelectItem key={m.id} value={m.id} className="text-xs">
                                                    {m.name}
                                                </SelectItem>
                                            ))}
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        ) : (
                            <p className="text-[11px] text-muted-foreground">
                                {existingKey?.defaultModel ? `Current: ${existingKey.defaultModel}` : 'Click "Load Models" to select'}
                            </p>
                        )}

                        {/* Set as Default Provider */}
                        {!existingKey?.isDefault && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-7 text-[11px] gap-1.5 cursor-pointer"
                                onClick={onSetDefault}
                            >
                                <Star className="h-3 w-3" />
                                Set as Default Provider
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}


// ─── Main Page ─────────────────────────────────────────────
export default function UserApiKeysPage() {
    const t = useTranslation()
    const [providers, setProviders] = useState<AiProvider[]>([])
    const [keys, setKeys] = useState<UserApiKeyData[]>([])
    const [loading, setLoading] = useState(true)
    const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({})
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
    const [saving, setSaving] = useState<Record<string, boolean>>({})
    const [deleting, setDeleting] = useState<Record<string, boolean>>({})
    const [testing, setTesting] = useState<Record<string, boolean>>({})
    const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
    const [showGuide, setShowGuide] = useState<Record<string, boolean>>({})
    const [models, setModels] = useState<Record<string, ModelInfo[]>>({})
    const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({})
    const [selectedModels, setSelectedModels] = useState<Record<string, string>>({})



    const fetchProviders = useCallback(async () => {
        try {
            const res = await fetch('/api/user/ai-providers')
            if (res.ok) setProviders(await res.json())
        } catch { /* */ }
    }, [])

    const fetchKeys = useCallback(async () => {
        try {
            const res = await fetch('/api/user/api-keys')
            if (res.ok) {
                const data: UserApiKeyData[] = await res.json()
                setKeys(data)
                const modelMap: Record<string, string> = {}
                data.forEach(k => { if (k.defaultModel) modelMap[k.provider] = k.defaultModel })
                setSelectedModels(prev => ({ ...prev, ...modelMap }))
            }
        } catch { /* */ }
    }, [])

    useEffect(() => {
        Promise.all([fetchProviders(), fetchKeys()]).then(() => setLoading(false))
    }, [fetchProviders, fetchKeys])

    const handleSave = async (providerSlug: string) => {
        const apiKey = apiKeyValues[providerSlug]
        if (!apiKey?.trim()) return

        setSaving(s => ({ ...s, [providerSlug]: true }))
        try {
            const prov = providers.find(p => p.provider === providerSlug)
            const res = await fetch('/api/user/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: providerSlug,
                    name: prov?.name || providerSlug,
                    apiKey: apiKey.trim(),
                }),
            })
            if (res.ok) {
                toast.success(t('apiKeys.keySaved'))
                setApiKeyValues(v => ({ ...v, [providerSlug]: '' }))
                fetchKeys()
            } else {
                const data = await res.json()
                toast.error(data.error || t('apiKeys.saveFailed'))
            }
        } catch { toast.error(t('apiKeys.saveFailed')) }
        setSaving(s => ({ ...s, [providerSlug]: false }))
    }

    const handleTest = async (providerSlug: string) => {
        setTesting(s => ({ ...s, [providerSlug]: true }))
        setTestResults(r => { const copy = { ...r }; delete copy[providerSlug]; return copy })
        try {
            const res = await fetch('/api/user/api-keys/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerSlug }),
            })
            const result = await res.json()
            setTestResults(r => ({ ...r, [providerSlug]: result }))
            if (result.success) toast.success(result.message)
            else toast.error(result.message || t('apiKeys.testFailed'))
        } catch { toast.error(t('apiKeys.testFailed')) }
        setTesting(s => ({ ...s, [providerSlug]: false }))
    }

    const handleFetchModels = async (providerSlug: string) => {
        setLoadingModels(l => ({ ...l, [providerSlug]: true }))
        try {
            const res = await fetch('/api/user/api-keys/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerSlug }),
            })
            const data = await res.json()
            if (data.models) {
                setModels(m => ({ ...m, [providerSlug]: data.models }))
                toast.success(`Loaded ${data.models.length} models`)
            } else {
                toast.error(data.error || t('apiKeys.loadModelsFailed'))
            }
        } catch { toast.error(t('apiKeys.loadModelsFailed')) }
        setLoadingModels(l => ({ ...l, [providerSlug]: false }))
    }

    const handleModelSelect = async (providerSlug: string, modelId: string) => {
        setSelectedModels(s => ({ ...s, [providerSlug]: modelId }))
        // Save default model to server
        try {
            await fetch('/api/user/api-keys', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerSlug, defaultModel: modelId }),
            })
            toast.success(t('apiKeys.defaultModelSaved'))
            fetchKeys()
        } catch { toast.error('Failed to save model') }
    }

    const handleSetDefault = async (providerSlug: string) => {
        try {
            const res = await fetch('/api/user/api-keys', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerSlug, isDefault: true }),
            })
            if (res.ok) {
                toast.success(t('apiKeys.defaultProviderSet'))
                fetchKeys()
            }
        } catch { toast.error('Failed to set default') }
    }

    const handleDelete = async (providerSlug: string) => {
        setDeleting(s => ({ ...s, [providerSlug]: true }))
        try {
            const res = await fetch(`/api/user/api-keys?provider=${providerSlug}`, { method: 'DELETE' })
            if (res.ok) {
                const prov = providers.find(p => p.provider === providerSlug)
                toast.success(`${prov?.name || providerSlug} key removed`)
                setModels(m => { const copy = { ...m }; delete copy[providerSlug]; return copy })
                setTestResults(r => { const copy = { ...r }; delete copy[providerSlug]; return copy })
                fetchKeys()
            }
        } catch { toast.error('Failed to delete') }
        setDeleting(s => ({ ...s, [providerSlug]: false }))
    }

    const configuredCount = keys.length

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('apiKeys.title')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t('apiKeys.description')}
                    </p>
                </div>
                <Badge variant="outline" className="gap-1">
                    <Key className="h-3 w-3" />
                    {configuredCount}/{providers.length} configured
                </Badge>
            </div>





            {/* AI Providers Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5" />
                    <h2 className="text-xl font-semibold">AI Providers</h2>
                    <Badge variant="secondary" className="ml-2">
                        {configuredCount}/{providers.length}
                    </Badge>
                </div>

                {providers.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            <BrainCircuit className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No AI providers available</p>
                            <p className="text-sm">Contact your admin to set up AI providers in the API Hub.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {providers.map(prov => {
                            const existingKey = keys.find(k => k.provider === prov.provider)
                            return (
                                <ProviderCard
                                    key={prov.id}
                                    provider={prov}
                                    existingKey={existingKey}
                                    apiKeyValue={apiKeyValues[prov.provider] || ''}
                                    showKey={showKeys[prov.provider] || false}
                                    isSaving={saving[prov.provider] || false}
                                    isDeleting={deleting[prov.provider] || false}
                                    isTesting={testing[prov.provider] || false}
                                    testResult={testResults[prov.provider]}
                                    showGuide={showGuide[prov.provider] || false}
                                    models={models[prov.provider] || []}
                                    isLoadingModels={loadingModels[prov.provider] || false}
                                    selectedModel={selectedModels[prov.provider] || ''}
                                    onApiKeyChange={val => setApiKeyValues(v => ({ ...v, [prov.provider]: val }))}
                                    onToggleShow={() => setShowKeys(s => ({ ...s, [prov.provider]: !s[prov.provider] }))}
                                    onSave={() => handleSave(prov.provider)}
                                    onDelete={() => handleDelete(prov.provider)}
                                    onTest={() => handleTest(prov.provider)}
                                    onToggleGuide={() => setShowGuide(s => ({ ...s, [prov.provider]: !s[prov.provider] }))}
                                    onFetchModels={() => handleFetchModels(prov.provider)}
                                    onModelSelect={modelId => handleModelSelect(prov.provider, modelId)}
                                    onSetDefault={() => handleSetDefault(prov.provider)}
                                />
                            )
                        })}
                        {/* Fal.ai — hardcoded (image generation for Neeflow Studio) */}
                        {(() => {
                            const falProv = { id: 'fal_ai', provider: 'fal_ai', name: 'Fal.ai', status: 'active' }
                            const existingKey = keys.find(k => k.provider === 'fal_ai')
                            return (
                                <ProviderCard
                                    key="fal_ai"
                                    provider={falProv}
                                    existingKey={existingKey}
                                    apiKeyValue={apiKeyValues['fal_ai'] || ''}
                                    showKey={showKeys['fal_ai'] || false}
                                    isSaving={saving['fal_ai'] || false}
                                    isDeleting={deleting['fal_ai'] || false}
                                    isTesting={testing['fal_ai'] || false}
                                    testResult={testResults['fal_ai']}
                                    showGuide={showGuide['fal_ai'] || false}
                                    models={models['fal_ai'] || []}
                                    isLoadingModels={loadingModels['fal_ai'] || false}
                                    selectedModel={selectedModels['fal_ai'] || ''}
                                    onApiKeyChange={val => setApiKeyValues(v => ({ ...v, fal_ai: val }))}
                                    onToggleShow={() => setShowKeys(s => ({ ...s, fal_ai: !s['fal_ai'] }))}
                                    onSave={() => handleSave('fal_ai')}
                                    onDelete={() => handleDelete('fal_ai')}
                                    onTest={() => handleTest('fal_ai')}
                                    onToggleGuide={() => setShowGuide(s => ({ ...s, fal_ai: !s['fal_ai'] }))}
                                    onFetchModels={() => handleFetchModels('fal_ai')}
                                    onModelSelect={modelId => handleModelSelect('fal_ai', modelId)}
                                    onSetDefault={() => handleSetDefault('fal_ai')}
                                />
                            )
                        })()}
                    </div>
                )}
            </div>

        </div>
    )
}
