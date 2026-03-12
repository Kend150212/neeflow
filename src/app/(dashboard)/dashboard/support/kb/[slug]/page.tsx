'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    ArrowLeft, Eye, Clock, Tag, ThumbsUp, ThumbsDown, BookOpen,
    ChevronRight, Loader2, MessageSquare, Share2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Article {
    id: string
    title: string
    slug: string
    content: string
    excerpt: string
    tags: string[]
    viewCount: number
    helpfulCount: number
    notHelpfulCount: number
    publishedAt: string | null
    updatedAt: string
    seoMeta: string
    category: { id: string; name: string; slug: string; iconSvg: string }
    author: { id: string; name: string | null; image: string | null }
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
    })
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params)
    const t = useTranslation()
    const router = useRouter()

    const [article, setArticle] = useState<Article | null>(null)
    const [loading, setLoading] = useState(true)
    const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null)
    const [submittingFeedback, setSubmittingFeedback] = useState(false)

    useEffect(() => {
        fetch(`/api/support/articles/${slug}`)
            .then(r => {
                if (!r.ok) throw new Error()
                return r.json()
            })
            .then(setArticle)
            .catch(() => {
                toast.error('Article not found')
                router.push('/dashboard/support/kb')
            })
            .finally(() => setLoading(false))
    }, [slug, router])

    const sendFeedback = async (helpful: boolean) => {
        if (feedbackGiven || !article) return
        setSubmittingFeedback(true)
        try {
            await fetch(`/api/support/articles/${slug}/helpful`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ helpful }),
            })
            setFeedbackGiven(helpful ? 'yes' : 'no')
            toast.success(t('support.thanksFeedback'))
        } catch {
            toast.error('Failed to submit feedback')
        } finally {
            setSubmittingFeedback(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!article) return null

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
                <button
                    onClick={() => router.push('/dashboard/support')}
                    className="hover:text-foreground transition-colors"
                >
                    {t('support.helpCenter')}
                </button>
                <ChevronRight className="h-3.5 w-3.5" />
                <button
                    onClick={() => router.push(`/dashboard/support/kb?category=${article.category.slug}`)}
                    className="hover:text-foreground transition-colors"
                >
                    {article.category.name}
                </button>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-foreground font-medium truncate max-w-48">{article.title}</span>
            </nav>

            <div className="flex gap-8">
                {/* Article */}
                <article className="flex-1 min-w-0">
                    {/* Header */}
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold tracking-tight mb-4">{article.title}</h1>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {article.author.name && (
                                <span className="flex items-center gap-1.5">
                                    {article.author.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={article.author.image} alt={article.author.name} className="h-5 w-5 rounded-full" />
                                    ) : (
                                        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                            {article.author.name[0]}
                                        </div>
                                    )}
                                    {article.author.name}
                                </span>
                            )}
                            {article.updatedAt && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {t('support.lastUpdated')} {formatDate(article.updatedAt)}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Eye className="h-3.5 w-3.5" />
                                {article.viewCount} views
                            </span>
                        </div>
                        {article.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {article.tags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                                        <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </header>

                    {/* Content — render markdown/HTML content */}
                    <div
                        className={cn(
                            'kb-article-content',
                            'prose prose-sm dark:prose-invert max-w-none',
                            'prose-headings:font-semibold prose-headings:tracking-tight',
                            'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
                            'prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-sm',
                            'prose-pre:bg-muted prose-pre:rounded-lg prose-pre:border',
                            'prose-blockquote:border-l-primary/50 prose-blockquote:bg-muted/50 prose-blockquote:rounded-r',
                            'prose-img:rounded-lg prose-img:shadow-sm prose-img:border',
                        )}
                        dangerouslySetInnerHTML={{ __html: article.content }}
                    />

                    {/* Helpful feedback */}
                    <div className="mt-12 p-6 rounded-2xl border bg-muted/30 text-center">
                        <p className="text-sm font-medium mb-3">{t('support.helpful')}</p>
                        {feedbackGiven ? (
                            <p className="text-sm text-muted-foreground">{t('support.thanksFeedback')}</p>
                        ) : (
                            <div className="flex items-center justify-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => sendFeedback(true)}
                                    disabled={submittingFeedback}
                                    className="gap-1.5"
                                >
                                    <ThumbsUp className="h-4 w-4" />
                                    {t('support.yes')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => sendFeedback(false)}
                                    disabled={submittingFeedback}
                                    className="gap-1.5"
                                >
                                    <ThumbsDown className="h-4 w-4" />
                                    {t('support.no')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Footer nav */}
                    <div className="mt-8 flex items-center justify-between">
                        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/support/kb')}>
                            <ArrowLeft className="h-4 w-4 mr-1.5" />
                            {t('support.backToKb')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href)
                                toast.success('Link copied!')
                            }}
                        >
                            <Share2 className="h-4 w-4 mr-1.5" />
                            Share
                        </Button>
                    </div>
                </article>

                {/* Right aside — Related / Contact */}
                <aside className="hidden lg:flex flex-col gap-4 w-56 shrink-0">
                    <div className="rounded-xl border p-4 text-sm">
                        <p className="font-medium mb-2">Still need help?</p>
                        <p className="text-muted-foreground text-xs mb-3">{t('support.stillNeedHelpDesc')}</p>
                        <Button size="sm" className="w-full" onClick={() => router.push('/dashboard/support')}>
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                            {t('support.contactSupport')}
                        </Button>
                    </div>
                </aside>
            </div>
        </div>
    )
}
