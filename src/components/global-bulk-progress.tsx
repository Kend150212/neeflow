'use client'

import { useBulkGen } from '@/lib/bulk-gen-context'
import { useI18n } from '@/lib/i18n'
import { StopCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GlobalBulkProgress — thin animated bar that appears at the
 * very top of the viewport whenever a bulk DB generation is running.
 * Reads from BulkGenContext (write from CreatePostsFromDbModal).
 */
export function GlobalBulkProgress() {
    const { state, stop } = useBulkGen()
    const { t } = useI18n()

    if (!state.running && state.done === 0) return null

    const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0
    const isFinishing = !state.running && state.done > 0  // fade-out grace period

    return (
        <div className={cn(
            'fixed top-0 left-0 right-0 z-[200] transition-opacity duration-500',
            isFinishing ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}>
            {/* Thin progress bar line */}
            <div className="h-[3px] w-full bg-muted/60">
                <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Info chip — top-right */}
            <div className="absolute top-2 right-4 flex items-center gap-2 bg-background/90 backdrop-blur border border-border/60 rounded-full px-3 py-1.5 shadow-lg text-xs">
                <Sparkles className="h-3 w-3 text-primary animate-pulse shrink-0" />
                <span className="font-medium text-foreground/80 max-w-[180px] truncate">
                    {state.label}
                </span>
                <span className="tabular-nums font-bold text-primary shrink-0">
                    {t('bulkGen.progressLabel').replace('{done}', String(state.done)).replace('{total}', String(state.total))}
                </span>
                <span className="text-muted-foreground shrink-0">{pct}%</span>
                <button
                    onClick={stop}
                    className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-medium transition-colors"
                    title={t('bulkGen.stop')}
                >
                    <StopCircle className="h-2.5 w-2.5" /> {t('bulkGen.stop')}
                </button>
            </div>
        </div>
    )
}
