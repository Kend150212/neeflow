'use client'

import { useTranslation } from '@/lib/i18n'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { AiProviderInfo, AiModelInfo } from './types'

interface AiSetupTabProps {
    aiProvider: string
    setAiProvider: (v: string) => void
    aiModel: string
    setAiModel: (v: string) => void
    imageProvider: string
    setImageProvider: (v: string) => void
    imageModel: string
    setImageModel: (v: string) => void
    availableProviders: AiProviderInfo[]
    availableModels: AiModelInfo[]
    availableImageModels: AiModelInfo[]
    loadingModels: boolean
    loadingImageModels: boolean
    userConfiguredProviders: string[]
}

export default function AiSetupTab({
    aiProvider,
    setAiProvider,
    aiModel,
    setAiModel,
    imageProvider,
    setImageProvider,
    imageModel,
    setImageModel,
    availableProviders,
    availableModels,
    availableImageModels,
    loadingModels,
    loadingImageModels,
    userConfiguredProviders,
}: AiSetupTabProps) {
    const t = useTranslation()

    const textProviders = availableProviders.filter(p =>
        p.status === 'active' && userConfiguredProviders.includes(p.provider)
    )
    const imageProviders = availableProviders.filter(p =>
        p.status === 'active' && userConfiguredProviders.includes(p.provider)
    )

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{t('channels.ai.setupTitle')}</CardTitle>
                <CardDescription>{t('channels.ai.setupDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Text AI */}
                <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('channels.ai.textAi')}</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('channels.ai.provider')}</Label>
                            <Select value={aiProvider} onValueChange={(v) => { setAiProvider(v); setAiModel('') }}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('channels.ai.selectProvider')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">— {t('channels.ai.useDefault')} —</SelectItem>
                                    {textProviders.map(p => (
                                        <SelectItem key={p.provider} value={p.provider}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('channels.ai.model')}</Label>
                            {loadingModels ? (
                                <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" /> {t('channels.ai.loadingModels')}
                                </div>
                            ) : (
                                <Select value={aiModel} onValueChange={setAiModel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('channels.ai.selectModel')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">— {t('channels.ai.useDefault')} —</SelectItem>
                                        {availableModels.map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                </div>

                {/* Image AI */}
                <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('channels.ai.imageAi')}</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('channels.ai.provider')}</Label>
                            <Select value={imageProvider} onValueChange={(v) => { setImageProvider(v); setImageModel('') }}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('channels.ai.selectProvider')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">— {t('channels.ai.useDefault')} —</SelectItem>
                                    {imageProviders.map(p => (
                                        <SelectItem key={p.provider} value={p.provider}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('channels.ai.model')}</Label>
                            {loadingImageModels ? (
                                <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" /> {t('channels.ai.loadingModels')}
                                </div>
                            ) : (
                                <Select value={imageModel} onValueChange={setImageModel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('channels.ai.selectModel')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">— {t('channels.ai.useDefault')} —</SelectItem>
                                        {availableImageModels.map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
