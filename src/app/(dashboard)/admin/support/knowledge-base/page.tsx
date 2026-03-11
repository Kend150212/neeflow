'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    BookOpen, Plus, Search, Pencil, Trash2, Eye, Clock, MoreVertical,
    CheckCircle2, FileText, TrendingUp, Folder, ExternalLink,
    ArrowUpDown, Loader2, Tag, Globe
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface Article {
    id: string
    title: string
    slug: string
    status: string
    viewCount: number
    helpfulCount: number
    updatedAt: string
    tags: string[]
    category: { id: string; name: string; slug: string }
    author: { name: string | null; image: string | null }
}

interface Category {
    id: string
    name: string
    slug: string
    description: string
    iconSvg: string
    isActive: boolean
    sortOrder: number
    _count: { articles: number }
}

interface Stats {
    published: number
    drafts: number
    totalViews: number
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    published: { label: 'Published', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    archived: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminKbPage() {
    const t = useTranslation()
    const router = useRouter()

    const [articles, setArticles] = useState<Article[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [stats, setStats] = useState<Stats>({ published: 0, drafts: 0, totalViews: 0 })
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [tab, setTab] = useState<'articles' | 'categories'>('articles')

    // Category dialog
    const [showCatDialog, setShowCatDialog] = useState(false)
    const [editCat, setEditCat] = useState<Category | null>(null)
    const [catForm, setCatForm] = useState({ name: '', slug: '', description: '', iconSvg: '', sortOrder: 0 })
    const [savingCat, setSavingCat] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams({ limit: '50' })
        if (q) params.set('q', q)
        if (filterStatus) params.set('status', filterStatus)
        if (filterCategory) params.set('category', filterCategory)

        try {
            const [artRes, catRes] = await Promise.all([
                fetch(`/api/admin/support/articles?${params}`),
                fetch('/api/admin/support/categories'),
            ])

            if (artRes.ok) {
                const artData = await artRes.json()
                setArticles(artData.articles || [])
                setTotal(artData.total || 0)
                setStats(artData.stats || { published: 0, drafts: 0, totalViews: 0 })
            }
            if (catRes.ok) {
                const catData = await catRes.json()
                setCategories(catData || [])
            }
        } catch (err) {
            console.error('Failed to load KB data:', err)
        } finally {
            setLoading(false)
        }
    }, [q, filterStatus, filterCategory])

    useEffect(() => { fetchData() }, [fetchData])

    const deleteArticle = async (id: string) => {
        if (!confirm(t('support.admin.kb.confirmDelete'))) return
        await fetch(`/api/admin/support/articles/${id}`, { method: 'DELETE' })
        toast.success(t('support.admin.kb.deleteSuccess'))
        fetchData()
    }

    const togglePublish = async (article: Article) => {
        const newStatus = article.status === 'published' ? 'draft' : 'published'
        await fetch(`/api/admin/support/articles/${article.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        })
        toast.success(newStatus === 'published' ? t('support.admin.kb.publishSuccess') : 'Moved to draft')
        fetchData()
    }

    const openCatDialog = (cat?: Category) => {
        setEditCat(cat || null)
        setCatForm(cat
            ? { name: cat.name, slug: cat.slug, description: cat.description, iconSvg: cat.iconSvg, sortOrder: cat.sortOrder }
            : { name: '', slug: '', description: '', iconSvg: '', sortOrder: categories.length }
        )
        setShowCatDialog(true)
    }

    const saveCat = async () => {
        setSavingCat(true)
        try {
            if (editCat) {
                await fetch('/api/admin/support/categories', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editCat.id, ...catForm }),
                })
            } else {
                await fetch('/api/admin/support/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(catForm),
                })
            }
            setShowCatDialog(false)
            fetchData()
        } catch {
            toast.error('Failed to save category')
        } finally {
            setSavingCat(false)
        }
    }

    const deleteCategory = async (id: string) => {
        if (!confirm('Delete this category? Articles will become uncategorized.')) return
        await fetch(`/api/admin/support/categories?id=${id}`, { method: 'DELETE' })
        fetchData()
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BookOpen className="h-6 w-6 text-primary" />
                        {t('support.admin.kb.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Manage articles, categories, and knowledge content
                    </p>
                </div>
                <Button onClick={() => router.push('/admin/support/knowledge-base/new')}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('support.admin.kb.newArticle')}
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: t('support.admin.kb.totalArticles'), value: total, icon: <FileText className="h-4 w-4 text-primary" /> },
                    { label: t('support.admin.kb.publishedArticles'), value: stats.published, icon: <Globe className="h-4 w-4 text-green-500" /> },
                    { label: t('support.admin.kb.draftArticles'), value: stats.drafts, icon: <Clock className="h-4 w-4 text-yellow-500" /> },
                    { label: t('support.admin.kb.totalViews'), value: stats.totalViews.toLocaleString(), icon: <TrendingUp className="h-4 w-4 text-blue-500" /> },
                ].map((s, i) => (
                    <Card key={i} className="overflow-hidden">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</span>
                                {s.icon}
                            </div>
                            <p className="text-2xl font-bold">{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tabs: Articles | Categories */}
            <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="articles" className="gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" />
                            {t('support.admin.kb.articles')} ({total})
                        </TabsTrigger>
                        <TabsTrigger value="categories" className="gap-1.5">
                            <Folder className="h-3.5 w-3.5" />
                            {t('support.admin.kb.categories')} ({categories.length})
                        </TabsTrigger>
                    </TabsList>

                    {tab === 'articles' && (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    placeholder="Search articles..."
                                    className="pl-8 h-9 w-52 text-sm"
                                />
                            </div>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="h-9 w-36 text-sm">
                                    <SelectValue placeholder="All status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All status</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="h-9 w-40 text-sm">
                                    <SelectValue placeholder="All categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All categories</SelectItem>
                                    {categories.map(c => (
                                        <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {tab === 'categories' && (
                        <Button size="sm" onClick={() => openCatDialog()}>
                            <Plus className="h-4 w-4 mr-1.5" />
                            {t('support.admin.kb.newCategory')}
                        </Button>
                    )}
                </div>

                {/* Articles Tab */}
                <TabsContent value="articles" className="mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : articles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center border rounded-xl bg-card">
                            <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                            <p className="text-muted-foreground">No articles found</p>
                            <Button onClick={() => router.push('/admin/support/knowledge-base/new')}>
                                <Plus className="h-4 w-4 mr-1.5" />
                                Create first article
                            </Button>
                        </div>
                    ) : (
                        <div className="border rounded-xl bg-card divide-y overflow-hidden">
                            {articles.map(article => {
                                const statusStyle = STATUS_BADGE[article.status] || STATUS_BADGE.draft
                                return (
                                    <div key={article.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors group">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm truncate">{article.title}</span>
                                                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', statusStyle.className)}>
                                                    {statusStyle.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Folder className="h-3 w-3" />{article.category.name}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Eye className="h-3 w-3" />{article.viewCount}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />Updated {formatDate(article.updatedAt)}
                                                </span>
                                                {article.tags.length > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Tag className="h-3 w-3" />{article.tags.slice(0, 2).join(', ')}
                                                        {article.tags.length > 2 && ` +${article.tags.length - 2}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => window.open(`/dashboard/support/kb/${article.slug}`, '_blank')}
                                                className="h-8 px-2.5"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => router.push(`/admin/support/knowledge-base/${article.id}/edit`)}
                                                className="h-8 px-2.5"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="sm" variant="ghost" className="h-8 px-2.5">
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => togglePublish(article)}>
                                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                                        {article.status === 'published' ? 'Move to Draft' : 'Publish'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() => deleteArticle(article.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* Categories Tab */}
                <TabsContent value="categories" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map(cat => (
                            <Card key={cat.id} className="group overflow-hidden">
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-3 mb-3">
                                        {cat.iconSvg ? (
                                            <span dangerouslySetInnerHTML={{ __html: cat.iconSvg }} className="[&>svg]:h-6 [&>svg]:w-6 [&>svg]:text-primary shrink-0" />
                                        ) : (
                                            <Folder className="h-6 w-6 text-primary shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{cat.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{cat.description || cat.slug}</p>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openCatDialog(cat)}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteCategory(cat.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>{cat._count.articles} articles</span>
                                        <span className={cn('rounded-full px-1.5 py-0.5', cat.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted')}>
                                            {cat.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <ArrowUpDown className="h-2.5 w-2.5" />Order: {cat.sortOrder}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Category Dialog */}
            <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editCat ? 'Edit Category' : t('support.admin.kb.newCategory')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Name *</Label>
                                <Input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="Getting Started" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Slug *</Label>
                                <Input value={catForm.slug} onChange={e => setCatForm(p => ({ ...p, slug: e.target.value }))} placeholder="getting-started" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Input value={catForm.description} onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief category description..." />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Icon SVG (optional)</Label>
                            <Input value={catForm.iconSvg} onChange={e => setCatForm(p => ({ ...p, iconSvg: e.target.value }))} placeholder='<svg>...</svg>' />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Sort Order</Label>
                            <Input type="number" value={catForm.sortOrder} onChange={e => setCatForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setShowCatDialog(false)}>Cancel</Button>
                        <Button onClick={saveCat} disabled={savingCat}>
                            {savingCat ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                            {editCat ? 'Save Changes' : 'Create Category'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
