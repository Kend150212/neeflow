'use client'

import { useState, useEffect, use, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    Save, Eye, ArrowLeft, Loader2, Plus, X, Globe, Clock, BookOpen,
    Bold, Italic, Strikethrough, Underline, Heading1, Heading2, Heading3,
    List, ListOrdered, Quote, Code, Link, Image, Video, Upload, AlignLeft,
    RotateCcw, RotateCw, Minus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
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

// ── Toolbar button definition ────────────────────────────────────────────────
interface ToolbarItem {
    icon: React.ReactNode
    title: string
    action: () => void
    active?: boolean
    divider?: boolean
}

export default function ArticleEditorPage({
    params,
}: {
    params?: Promise<{ id: string }> // undefined when creating new
}) {
    const resolvedParams = params ? use(params) : undefined
    const articleId = resolvedParams?.id
    const isEdit = !!articleId

    const t = useTranslation()
    const router = useRouter()
    const editorRef = useRef<HTMLDivElement>(null)

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

    // Media insertion dialog
    const [mediaDialog, setMediaDialog] = useState<{ type: 'image' | 'video' } | null>(null)
    const [mediaUrl, setMediaUrl] = useState('')
    const [mediaUploading, setMediaUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Link dialog
    const [linkDialog, setLinkDialog] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')
    const savedRangeRef = useRef<Range | null>(null)

    // Load categories
    useEffect(() => {
        fetch('/api/admin/support/categories')
            .then(r => r.json())
            .then(cats => setCategories(cats || []))
            .catch(() => null)
    }, [])

    // Load article if editing — set content into editor after mount
    useEffect(() => {
        if (!isEdit) return
        fetch(`/api/admin/support/articles/${articleId}`)
            .then(r => r.json())
            .then(article => {
                const loaded: ArticleForm = {
                    title: article.title,
                    slug: article.slug,
                    excerpt: article.excerpt || '',
                    content: article.content || '',
                    seoMeta: article.seoMeta || '',
                    categoryId: article.categoryId || '',
                    status: article.status,
                    tags: article.tags || [],
                }
                setForm(loaded)
                setLoading(false)
                // Inject HTML into editor after it mounts
                setTimeout(() => {
                    if (editorRef.current) {
                        editorRef.current.innerHTML = article.content || ''
                    }
                }, 50)
            })
            .catch(() => {
                toast.error('Article not found')
                router.push('/admin/support/knowledge-base')
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit, articleId])

    // Sync editor HTML → form.content on input
    const handleEditorInput = useCallback(() => {
        if (editorRef.current) {
            setForm(prev => ({ ...prev, content: editorRef.current!.innerHTML }))
        }
    }, [])

    // Auto-generate slug from title
    const autoSlug = (title: string) =>
        title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()

    const handleTitleChange = (title: string) => {
        setForm(prev => ({
            ...prev,
            title,
            slug: prev.slug && prev.slug !== autoSlug(prev.title) ? prev.slug : autoSlug(title),
        }))
    }

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

    // ── Editor commands ──────────────────────────────────────────────────────
    const exec = (cmd: string, value?: string) => {
        editorRef.current?.focus()
        document.execCommand(cmd, false, value)
        handleEditorInput()
    }

    const insertHtml = (html: string) => {
        editorRef.current?.focus()
        document.execCommand('insertHTML', false, html)
        handleEditorInput()
    }

    const wrapBlock = (tag: string) => {
        editorRef.current?.focus()
        document.execCommand('formatBlock', false, tag)
        handleEditorInput()
    }

    // Save range before opening dialogs
    const saveRange = () => {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
            savedRangeRef.current = sel.getRangeAt(0).cloneRange()
        }
    }

    const restoreRange = () => {
        const sel = window.getSelection()
        if (sel && savedRangeRef.current) {
            sel.removeAllRanges()
            sel.addRange(savedRangeRef.current)
        }
    }

    // Insert link
    const handleInsertLink = () => {
        if (!linkUrl.trim()) return
        restoreRange()
        editorRef.current?.focus()
        document.execCommand('createLink', false, linkUrl.trim())
        setLinkDialog(false)
        setLinkUrl('')
        handleEditorInput()
    }

    // Insert image
    const handleInsertMedia = () => {
        if (!mediaUrl.trim() || !mediaDialog) return
        restoreRange()
        if (mediaDialog.type === 'image') {
            insertHtml(`<img src="${mediaUrl}" alt="" class="max-w-full rounded-lg my-4" />`)
        } else {
            // Try to detect embed-able video
            let embedHtml = ''
            if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
                const id = mediaUrl.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1]
                if (id) embedHtml = `<div class="aspect-video my-6"><iframe class="w-full h-full rounded-lg" src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe></div>`
            } else if (mediaUrl.includes('vimeo.com')) {
                const id = mediaUrl.match(/vimeo\.com\/(\d+)/)?.[1]
                if (id) embedHtml = `<div class="aspect-video my-6"><iframe class="w-full h-full rounded-lg" src="https://player.vimeo.com/video/${id}" allowfullscreen></iframe></div>`
            }
            if (!embedHtml) {
                embedHtml = `<video src="${mediaUrl}" controls class="max-w-full rounded-lg my-4"></video>`
            }
            insertHtml(embedHtml)
        }
        setMediaDialog(null)
        setMediaUrl('')
    }

    // Upload file → R2 via existing media upload endpoint
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = e.target.files?.[0]
        if (!file) return
        setMediaUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', type)
            const res = await fetch('/api/media/upload', { method: 'POST', body: fd })
            if (!res.ok) throw new Error('Upload failed')
            const { url } = await res.json()
            restoreRange()
            if (type === 'image') {
                insertHtml(`<img src="${url}" alt="" class="max-w-full rounded-lg my-4" />`)
            } else {
                insertHtml(`<video src="${url}" controls class="max-w-full rounded-lg my-4"></video>`)
            }
            setMediaDialog(null)
            toast.success('Media inserted')
        } catch {
            toast.error('Upload failed')
        } finally {
            setMediaUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const save = async (overrideStatus?: 'draft' | 'published') => {
        // Sync editor HTML first
        const content = editorRef.current?.innerHTML || form.content
        if (!form.title || !form.slug || !content || !form.categoryId) {
            toast.error('Fill in title, slug, category, and content')
            return
        }
        setSaving(true)
        const payload = { ...form, content, status: overrideStatus || form.status }
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

    // ── Toolbar items ────────────────────────────────────────────────────────
    const toolbar1: ToolbarItem[] = [
        { icon: <Bold className="h-4 w-4" />, title: 'Bold', action: () => exec('bold') },
        { icon: <Italic className="h-4 w-4" />, title: 'Italic', action: () => exec('italic') },
        { icon: <Underline className="h-4 w-4" />, title: 'Underline', action: () => exec('underline') },
        { icon: <Strikethrough className="h-4 w-4" />, title: 'Strikethrough', action: () => exec('strikeThrough') },
    ]
    const toolbar2: ToolbarItem[] = [
        { icon: <Heading1 className="h-4 w-4" />, title: 'Heading 1', action: () => wrapBlock('h1') },
        { icon: <Heading2 className="h-4 w-4" />, title: 'Heading 2', action: () => wrapBlock('h2') },
        { icon: <Heading3 className="h-4 w-4" />, title: 'Heading 3', action: () => wrapBlock('h3') },
    ]
    const toolbar3: ToolbarItem[] = [
        { icon: <List className="h-4 w-4" />, title: 'Bullet list', action: () => exec('insertUnorderedList') },
        { icon: <ListOrdered className="h-4 w-4" />, title: 'Numbered list', action: () => exec('insertOrderedList') },
        { icon: <Quote className="h-4 w-4" />, title: 'Blockquote', action: () => wrapBlock('blockquote') },
        { icon: <Minus className="h-4 w-4" />, title: 'Divider', action: () => insertHtml('<hr class="my-6 border-border" /><p></p>') },
    ]
    const toolbar4: ToolbarItem[] = [
        {
            icon: <Link className="h-4 w-4" />, title: 'Insert link', action: () => {
                saveRange()
                setLinkUrl('')
                setLinkDialog(true)
            }
        },
        {
            icon: <Image className="h-4 w-4" />, title: 'Insert image', action: () => {
                saveRange()
                setMediaUrl('')
                setMediaDialog({ type: 'image' })
            }
        },
        {
            icon: <Video className="h-4 w-4" />, title: 'Insert video', action: () => {
                saveRange()
                setMediaUrl('')
                setMediaDialog({ type: 'video' })
            }
        },
        { icon: <Code className="h-4 w-4" />, title: 'Code block', action: () => wrapBlock('pre') },
    ]
    const toolbar5: ToolbarItem[] = [
        { icon: <RotateCcw className="h-4 w-4" />, title: 'Undo', action: () => exec('undo') },
        { icon: <RotateCw className="h-4 w-4" />, title: 'Redo', action: () => exec('redo') },
    ]

    const ToolbarGroup = ({ items }: { items: ToolbarItem[] }) => (
        <div className="flex items-center gap-0.5">
            {items.map((item, i) => (
                <button
                    key={i}
                    onMouseDown={e => { e.preventDefault(); item.action() }}
                    title={item.title}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                    {item.icon}
                </button>
            ))}
        </div>
    )

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {/* ── Topbar ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-background shrink-0 gap-4 z-50">
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

            <div className="flex flex-1 overflow-hidden">

                {/* ── Left sidebar: Settings ───────────────────────────────── */}
                <aside className="w-72 shrink-0 border-r overflow-y-auto p-5 space-y-5 bg-muted/10">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Article Settings</p>
                        <div className="space-y-4">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('support.admin.kb.editor.titlePlaceholder')}</Label>
                                <Input
                                    value={form.title}
                                    onChange={e => handleTitleChange(e.target.value)}
                                    placeholder="Article title..."
                                    className="h-9 text-sm"
                                />
                            </div>

                            {/* Category */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('support.admin.kb.editor.category')}</Label>
                                <Select
                                    value={form.categoryId}
                                    onValueChange={v => setForm(prev => ({ ...prev, categoryId: v }))}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Select category..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Status */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('support.admin.kb.editor.status')}</Label>
                                <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
                                    {(['draft', 'published', 'archived'] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setForm(prev => ({ ...prev, status: s }))}
                                            className={cn(
                                                'py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                                                form.status === s
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('support.admin.kb.editor.tags')}</Label>
                                <div className="flex gap-1.5">
                                    <Input
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                                        placeholder="Add tag..."
                                        className="h-8 text-xs"
                                    />
                                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={addTag}>
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                                {form.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {form.tags.map(tag => (
                                            <Badge key={tag} variant="secondary" className="gap-1 text-[10px] cursor-pointer px-1.5 py-0.5" onClick={() => removeTag(tag)}>
                                                {tag}
                                                <X className="h-2 w-2" />
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">SEO</p>
                        <div className="space-y-4">
                            {/* Slug */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('support.admin.kb.editor.seoSlug')}</Label>
                                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                                    <span className="text-xs text-muted-foreground px-2 border-r bg-muted h-9 flex items-center">/kb/</span>
                                    <input
                                        value={form.slug}
                                        onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                                        placeholder="url-slug"
                                        className="flex-1 text-xs px-2 h-9 bg-transparent outline-none font-mono"
                                    />
                                </div>
                            </div>

                            {/* Meta description */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('support.admin.kb.editor.seoMeta')}</Label>
                                <Textarea
                                    value={form.seoMeta}
                                    onChange={e => setForm(prev => ({ ...prev, seoMeta: e.target.value }))}
                                    placeholder="Meta description..."
                                    rows={3}
                                    className="resize-none text-xs"
                                />
                                <p className="text-[10px] text-muted-foreground text-right">{form.seoMeta.length}/160</p>
                            </div>

                            {/* Excerpt */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Excerpt</Label>
                                <Textarea
                                    value={form.excerpt}
                                    onChange={e => setForm(prev => ({ ...prev, excerpt: e.target.value }))}
                                    placeholder="Short summary shown in article list..."
                                    rows={2}
                                    className="resize-none text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* View live */}
                    {isEdit && form.status === 'published' && (
                        <Button
                            variant="outline" size="sm" className="w-full"
                            onClick={() => window.open(`/dashboard/support/kb/${form.slug}`, '_blank')}
                        >
                            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                            View Live Article
                        </Button>
                    )}
                </aside>

                {/* ── Main editor area ─────────────────────────────────────── */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {preview ? (
                        /* Preview mode */
                        <div className="flex-1 overflow-y-auto p-10">
                            <div className="max-w-3xl mx-auto">
                                <h1 className="text-3xl font-bold mb-4">{form.title || 'Untitled'}</h1>
                                {form.excerpt && <p className="text-muted-foreground mb-6 text-lg">{form.excerpt}</p>}
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: form.content || '<p class="text-muted-foreground">Nothing to preview yet…</p>' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Sticky toolbar */}
                            <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-4 py-2 flex items-center gap-1 flex-wrap">
                                <ToolbarGroup items={toolbar1} />
                                <div className="w-px h-5 bg-border mx-1" />
                                <ToolbarGroup items={toolbar2} />
                                <div className="w-px h-5 bg-border mx-1" />
                                <ToolbarGroup items={toolbar3} />
                                <div className="w-px h-5 bg-border mx-1" />
                                <ToolbarGroup items={toolbar4} />
                                <div className="w-px h-5 bg-border mx-1" />
                                <ToolbarGroup items={toolbar5} />
                            </div>

                            {/* Editable canvas */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="max-w-3xl mx-auto px-10 py-8">
                                    {/* Article title input (not part of content) */}
                                    <input
                                        value={form.title}
                                        onChange={e => handleTitleChange(e.target.value)}
                                        placeholder="Article title…"
                                        className="w-full text-3xl font-bold bg-transparent outline-none border-b border-transparent focus:border-border pb-2 mb-4 placeholder:text-muted-foreground/30 transition-colors"
                                    />

                                    {/* Rich content editor */}
                                    <div
                                        ref={editorRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={handleEditorInput}
                                        data-placeholder="Start writing your article…"
                                        className={cn(
                                            'min-h-[60vh] outline-none text-sm leading-7 focus:outline-none',
                                            'prose prose-sm dark:prose-invert max-w-none',
                                            // Custom prose styles for editor
                                            '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4',
                                            '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3',
                                            '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2',
                                            '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
                                            '[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:text-xs [&_pre]:font-mono [&_pre]:overflow-x-auto',
                                            '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1',
                                            '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
                                            '[&_a]:text-primary [&_a]:underline',
                                            '[&_img]:rounded-lg [&_img]:max-w-full',
                                            '[&_hr]:border-border',
                                            // Placeholder via CSS data-attr
                                            'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:cursor-text',
                                        )}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* ── Link insertion dialog ────────────────────────────────────── */}
            <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Insert Link</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label className="text-xs">URL</Label>
                        <Input
                            value={linkUrl}
                            onChange={e => setLinkUrl(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleInsertLink() }}
                            placeholder="https://..."
                            className="h-9 text-sm"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setLinkDialog(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleInsertLink}>Insert</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Image / Video insertion dialog ──────────────────────────── */}
            <Dialog open={!!mediaDialog} onOpenChange={open => { if (!open) setMediaDialog(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Insert {mediaDialog?.type === 'image' ? 'Image' : 'Video'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* URL tab */}
                        <div className="space-y-2">
                            <Label className="text-xs">Paste URL</Label>
                            <Input
                                value={mediaUrl}
                                onChange={e => setMediaUrl(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleInsertMedia() }}
                                placeholder={mediaDialog?.type === 'image'
                                    ? 'https://example.com/image.jpg'
                                    : 'YouTube / Vimeo URL or direct mp4 link'}
                                className="h-9 text-sm"
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground">or</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        {/* File upload */}
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={mediaDialog?.type === 'image' ? 'image/*' : 'video/*'}
                                className="hidden"
                                onChange={e => handleFileUpload(e, mediaDialog!.type)}
                            />
                            <Button
                                variant="outline"
                                className="w-full gap-2"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={mediaUploading}
                            >
                                {mediaUploading
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Upload className="h-4 w-4" />
                                }
                                {mediaUploading ? 'Uploading…' : `Upload ${mediaDialog?.type === 'image' ? 'image' : 'video'} file`}
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setMediaDialog(null)}>Cancel</Button>
                        <Button size="sm" onClick={handleInsertMedia} disabled={!mediaUrl.trim()}>Insert</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
