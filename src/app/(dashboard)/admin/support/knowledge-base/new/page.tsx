'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    Save, Eye, ArrowLeft, Loader2, Plus, X, Globe, Clock, BookOpen
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ArticleForm {
    title: string
    slug: string
    excerpt: string
    content: string
    seoMeta: string
    categoryId: string
    status: 'draft' | 'published' | 'archived'
    tags: string[]
}

interface Category {
    id: string
    name: string
    slug: string
}

export default function ArticleEditorPage({
    params,
}: {
    params?: Promise<{ id: string }> // undefined when creating new
}) {
    // For edit mode, params will have id
    const resolvedParams = params ? use(params) : undefined
    const articleId = resolvedParams?.id
    const isEdit = !!articleId

    const t = useTranslation()
    const router = useRouter()

    const [form, setForm] = useState<ArticleForm>({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        seoMeta: '',
        categoryId: '',
        status: 'draft',
        tags: [],
    })
    const [categories, setCategories] = useState<Category[]>([])
    const [tagInput, setTagInput] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(isEdit)
    const [preview, setPreview] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)

    // Load categories
    useEffect(() => {
        fetch('/api/admin/support/categories')
            .then(r => r.json())
            .then(cats => setCategories(cats || []))
            .catch(() => null)
    }, [])

    // Load article if editing
    useEffect(() => {
        if (!isEdit) return
        fetch(`/api/admin/support/articles/${articleId}`)
            .then(r => r.json())
            .then(article => {
                setForm({
                    title: article.title,
                    slug: article.slug,
                    excerpt: article.excerpt || '',
                    content: article.content || '',
                    seoMeta: article.seoMeta || '',
                    categoryId: article.categoryId || '',
                    status: article.status,
                    tags: article.tags || [],
                })
                setLoading(false)
            })
            .catch(() => { toast.error('Article not found'); router.push('/admin/support/knowledge-base') })
    }, [isEdit, articleId, router])

    // Auto-generate slug from title
    const handleTitleChange = (title: string) => {
        setForm(prev => ({
            ...prev,
            title,
            slug: prev.slug && prev.slug !== autoSlug(prev.title) ? prev.slug : autoSlug(title),
        }))
    }

    const autoSlug = (title: string) => title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()

    const addTag = () => {
        const tag = tagInput.trim().toLowerCase()
        if (tag && !form.tags.includes(tag)) {
            setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }))
        }
        setTagInput('')
    }

    const removeTag = (tag: string) => {
        setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
    }

    const save = async (overrideStatus?: 'draft' | 'published') => {
        if (!form.title || !form.slug || !form.content || !form.categoryId) {
            toast.error('Fill in title, slug, category, and content')
            return
        }
        setSaving(true)
        const payload = { ...form, status: overrideStatus || form.status }
        try {
            if (isEdit) {
                await fetch(`/api/admin/support/articles/${articleId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                setLastSaved(new Date())
                toast.success(t('support.admin.kb.saveSuccess'))
            } else {
                const res = await fetch('/api/admin/support/articles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                const article = await res.json()
                if (!res.ok) throw new Error(article.error || 'Failed')
                toast.success(overrideStatus === 'published' ? t('support.admin.kb.publishSuccess') : t('support.admin.kb.saveSuccess'))
                router.push(`/admin/support/knowledge-base/${article.id}/edit`)
            }
            if (overrideStatus) setForm(prev => ({ ...prev, status: overrideStatus }))
        } catch (e: unknown) {
            toast.error((e as Error).message || 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen">
            {/* Topbar */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b bg-background shrink-0 gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/admin/support/knowledge-base')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <p className="text-sm font-medium">{isEdit ? 'Edit Article' : t('support.admin.kb.newArticle')}</p>
                        {lastSaved && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
                        <Eye className="h-4 w-4 mr-1.5" />
                        {preview ? 'Edit' : t('support.admin.kb.editor.preview')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => save('draft')} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                        {t('support.admin.kb.editor.saveDraft')}
                    </Button>
                    <Button size="sm" onClick={() => save('published')} disabled={saving}>
                        <Globe className="h-4 w-4 mr-1.5" />
                        {t('support.admin.kb.editor.publish')}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main editor area */}
                <div className="flex-1 overflow-y-auto p-8">
                    {preview ? (
                        <div className="max-w-3xl mx-auto">
                            <h1 className="text-3xl font-bold mb-4">{form.title || 'Untitled'}</h1>
                            {form.excerpt && <p className="text-muted-foreground mb-6 text-lg">{form.excerpt}</p>}
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: form.content || '<p class="text-muted-foreground">Nothing to preview yet…</p>' }}
                            />
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-6">
                            {/* Title */}
                            <Input
                                value={form.title}
                                onChange={e => handleTitleChange(e.target.value)}
                                placeholder={t('support.admin.kb.editor.titlePlaceholder')}
                                className="text-3xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0 h-auto py-2"
                            />
                            {/* Excerpt */}
                            <Textarea
                                value={form.excerpt}
                                onChange={e => setForm(prev => ({ ...prev, excerpt: e.target.value }))}
                                placeholder={t('support.admin.kb.editor.excerptPlaceholder')}
                                rows={2}
                                className="resize-none border-0 border-b rounded-none px-0 focus-visible:ring-0"
                            />
                            {/* Content */}
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                                    {t('support.admin.kb.editor.content')}
                                </Label>
                                <Textarea
                                    value={form.content}
                                    onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                                    placeholder={t('support.admin.kb.editor.contentPlaceholder')}
                                    rows={24}
                                    className="font-mono text-sm resize-none"
                                />
                                <p className="text-xs text-muted-foreground mt-1">HTML is supported for rich content</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right sidebar */}
                <aside className="w-72 shrink-0 border-l overflow-y-auto p-5 space-y-6 bg-muted/20">
                    {/* Status */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('support.admin.kb.editor.status')}</Label>
                        <Select
                            value={form.status}
                            onValueChange={v => setForm(prev => ({ ...prev, status: v as ArticleForm['status'] }))}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">{t('support.admin.kb.status.draft')}</SelectItem>
                                <SelectItem value="published">{t('support.admin.kb.status.published')}</SelectItem>
                                <SelectItem value="archived">{t('support.admin.kb.status.archived')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('support.admin.kb.editor.category')}</Label>
                        <Select
                            value={form.categoryId}
                            onValueChange={v => setForm(prev => ({ ...prev, categoryId: v }))}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select category..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('support.admin.kb.editor.seoSlug')}</Label>
                        <Input
                            value={form.slug}
                            onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                            placeholder="url-slug"
                            className="h-9 font-mono text-sm"
                        />
                        {form.slug && (
                            <p className="text-xs text-muted-foreground truncate">/kb/{form.slug}</p>
                        )}
                    </div>

                    {/* SEO Meta */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('support.admin.kb.editor.seoMeta')}</Label>
                        <Textarea
                            value={form.seoMeta}
                            onChange={e => setForm(prev => ({ ...prev, seoMeta: e.target.value }))}
                            placeholder={t('support.admin.kb.editor.seoMetaPlaceholder')}
                            rows={3}
                            className="resize-none text-sm"
                        />
                        <p className="text-xs text-muted-foreground">{form.seoMeta.length}/160</p>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('support.admin.kb.editor.tags')}</Label>
                        <div className="flex gap-1.5">
                            <Input
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                                placeholder={t('support.admin.kb.editor.tagsPlaceholder')}
                                className="h-9 text-sm"
                            />
                            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={addTag}>
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        {form.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {form.tags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => removeTag(tag)}>
                                        {tag}
                                        <X className="h-2.5 w-2.5" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Preview link */}
                    {isEdit && form.status === 'published' && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => window.open(`/dashboard/support/kb/${form.slug}`, '_blank')}
                        >
                            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                            View Live Article
                        </Button>
                    )}
                </aside>
            </div>
        </div>
    )
}
