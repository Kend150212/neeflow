'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Sparkles, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

interface VibeTabProps {
    vibeTone: Record<string, string>
    setVibeTone: (v: Record<string, string>) => void
    generatingVibe: boolean
    handleGenerateVibe: () => void
    description: string
}

export default function VibeTab({
    vibeTone,
    setVibeTone,
    generatingVibe,
    handleGenerateVibe,
    description,
}: VibeTabProps) {
    const t = useTranslation()
    const [addingVibeField, setAddingVibeField] = useState(false)
    const [newVibeFieldName, setNewVibeFieldName] = useState('')

    return (
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
    )
}
