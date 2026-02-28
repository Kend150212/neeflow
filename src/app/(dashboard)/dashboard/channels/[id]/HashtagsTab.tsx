'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Hash, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { HashtagGroup } from './types'

interface HashtagsTabProps {
    channelId: string
    hashtags: HashtagGroup[]
    setHashtags: (v: HashtagGroup[]) => void
}

export default function HashtagsTab({
    channelId,
    hashtags,
    setHashtags,
}: HashtagsTabProps) {
    const t = useTranslation()
    const [newHashName, setNewHashName] = useState('')
    const [newHashTags, setNewHashTags] = useState('')
    const [addingHash, setAddingHash] = useState(false)

    const addHashtagGroup = async () => {
        if (!newHashName) return
        setAddingHash(true)
        try {
            const tags = newHashTags.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)
            const res = await fetch(`/api/admin/channels/${channelId}/hashtags`, {
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
            await fetch(`/api/admin/channels/${channelId}/hashtags?groupId=${groupId}`, { method: 'DELETE' })
            setHashtags(hashtags.filter((h) => h.id !== groupId))
            toast.success(t('channels.hashtags.deleted'))
        } catch {
            toast.error(t('channels.hashtags.deleteFailed'))
        }
    }

    return (
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
    )
}
