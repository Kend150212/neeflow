'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    Search, BookOpen, ChevronRight, Eye, Loader2, ArrowLeft, ThumbsUp, ThumbsDown, ChevronDown, Clock
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Category {
    id: string
    name: string
    slug: string
    iconSvg: string
    _count: { articles: number }
}

interface Article {
    id: string
    title: string
    slug: string
    excerpt: string
    viewCount: number
    updatedAt: string
    category: { name: string; slug: string }
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function KbPage() {
    const t = useTranslation()
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeCategorySlug = searchParams.get('category') || ''

    const [categories, setCategories] = useState<Category[]>([])
    const [articles, setArticles] = useState<Article[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')

    useEffect(() => {
        fetch('/api/support/categories').then(r => r.json()).then(setCategories).catch(() => null)
    }, [])

    useEffect(() => {
        setLoading(true)
        setPage(1)
        const params = new URLSearchParams({ limit: '20', page: '1' })
        if (activeCategorySlug) params.set('category', activeCategorySlug)
        if (q) params.set('q', q)
        fetch(`/api/support/articles?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                setArticles(data.articles || [])
                setTotal(data.total || 0)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [activeCategorySlug, q])

    const loadMore = () => {
        const nextPage = page + 1
        const params = new URLSearchParams({ limit: '20', page: String(nextPage) })
        if (activeCategorySlug) params.set('category', activeCategorySlug)
        if (q) params.set('q', q)
        fetch(`/api/support/articles?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                setArticles(prev => [...prev, ...(data.articles || [])])
                setPage(nextPage)
            }).catch(() => null)
    }

    const activeCategory = categories.find(c => c.slug === activeCategorySlug)

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="hidden md:flex flex-col w-60 shrink-0 border-r">
                <div className="p-4 border-b">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 text-muted-foreground"
                        onClick={() => router.push('/dashboard/support')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t('support.helpCenter')}
                    </Button>
                </div>
                <div className="p-3 flex-1 overflow-y-auto">
                    <button
                        onClick={() => router.push('/dashboard/support/kb')}
                        className={cn(
                            'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            !activeCategorySlug
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted text-muted-foreground'
                        )}
                    >
                        <BookOpen className="h-4 w-4" />
                        All Articles
                    </button>
                    <div className="my-2 h-px bg-border" />
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => router.push(`/dashboard/support/kb?category=${cat.slug}`)}
                            className={cn(
                                'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                                activeCategorySlug === cat.slug
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-muted text-muted-foreground'
                            )}
                        >
                            <span className="flex items-center gap-2 truncate">
                                {cat.iconSvg ? (
                                    <span dangerouslySetInnerHTML={{ __html: cat.iconSvg }} className="[&>svg]:h-4 [&>svg]:w-4 shrink-0" />
                                ) : (
                                    <BookOpen className="h-4 w-4 shrink-0" />
                                )}
                                <span className="truncate">{cat.name}</span>
                            </span>
                            <span className="text-xs shrink-0">{cat._count.articles}</span>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 p-6 max-w-3xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1">
                        <h1 className="text-xl font-semibold">
                            {activeCategory ? activeCategory.name : t('support.knowledgeBase')}
                        </h1>
                        <p className="text-sm text-muted-foreground">{total} articles</p>
                    </div>
                    {/* Search */}
                    <div className="relative w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder={t('support.searchPlaceholder')}
                            className="pl-8 h-9 text-sm"
                        />
                    </div>
                </div>

                {/* Articles list */}
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : articles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No articles found</p>
                    </div>
                ) : (
                    <div className="divide-y border rounded-xl bg-card overflow-hidden">
                        {articles.map(article => (
                            <button
                                key={article.id}
                                onClick={() => router.push(`/dashboard/support/kb/${article.slug}`)}
                                className="w-full flex items-start gap-4 px-5 py-4 hover:bg-muted text-sm group transition-colors text-left"
                            >
                                <BookOpen className="h-4 w-4 text-primary mt-1 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium group-hover:text-primary transition-colors">{article.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{article.excerpt}</p>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.viewCount}</span>
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(article.updatedAt)}</span>
                                        {!activeCategorySlug && (
                                            <Badge variant="outline" className="text-xs py-0">{article.category.name}</Badge>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Load more */}
                {!loading && articles.length < total && (
                    <div className="mt-4 text-center">
                        <Button variant="outline" size="sm" onClick={loadMore}>
                            <ChevronDown className="h-4 w-4 mr-1.5" />
                            Load more
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
