'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import {
    BookOpen,
    Plus,
    Trash2,
    ExternalLink,
    Link as LinkIcon,
    FileSpreadsheet,
    Type,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { KnowledgeEntry } from './types'
import { sourceTypeIcons, sourceTypeLabels } from './constants'

interface KnowledgeTabProps {
    channelId: string
    knowledgeEntries: KnowledgeEntry[]
    setKnowledgeEntries: (v: KnowledgeEntry[]) => void
}

export default function KnowledgeTab({
    channelId,
    knowledgeEntries,
    setKnowledgeEntries,
}: KnowledgeTabProps) {
    const t = useTranslation()
    const [newKbTitle, setNewKbTitle] = useState('')
    const [newKbType, setNewKbType] = useState('text')
    const [newKbUrl, setNewKbUrl] = useState('')
    const [newKbContent, setNewKbContent] = useState('')
    const [addingKb, setAddingKb] = useState(false)

    const addKbEntry = async () => {
        if (!newKbTitle) return
        setAddingKb(true)
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/knowledge`, {
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
            await fetch(`/api/admin/channels/${channelId}/knowledge?entryId=${entryId}`, { method: 'DELETE' })
            setKnowledgeEntries(knowledgeEntries.filter((e) => e.id !== entryId))
            toast.success(t('channels.knowledge.deleted'))
        } catch {
            toast.error(t('channels.knowledge.deleteFailed'))
        }
    }

    return (
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
    )
}
