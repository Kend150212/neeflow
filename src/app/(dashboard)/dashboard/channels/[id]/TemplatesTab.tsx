'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import type { ContentTemplate } from './types'

interface TemplatesTabProps {
    channelId: string
    templates: ContentTemplate[]
    setTemplates: (v: ContentTemplate[]) => void
}

export default function TemplatesTab({
    channelId,
    templates,
    setTemplates,
}: TemplatesTabProps) {
    const t = useTranslation()
    const [newTplName, setNewTplName] = useState('')
    const [newTplContent, setNewTplContent] = useState('')
    const [addingTpl, setAddingTpl] = useState(false)

    const addTemplate = async () => {
        if (!newTplName || !newTplContent) return
        setAddingTpl(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/templates`, {
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
            await fetch(`/api/admin/channels/${channelId}/templates?templateId=${templateId}`, { method: 'DELETE' })
            setTemplates(templates.filter((t) => t.id !== templateId))
            toast.success(t('channels.templates.deleted'))
        } catch {
            toast.error(t('channels.templates.deleteFailed'))
        }
    }

    return (
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
    )
}
