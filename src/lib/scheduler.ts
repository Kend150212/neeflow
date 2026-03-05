/**
 * Scheduler — polls DB every minute for SCHEDULED posts that are due.
 * Enqueues them into BullMQ auto-post queue and marks them as PUBLISHING
 * to prevent double-enqueue.
 */

import { prisma } from '@/lib/prisma'
import { getAutoPostQueue, DEFAULT_JOB_OPTIONS } from '@/lib/queue'
import type { AutoPostJobData } from '@/lib/queue'
import { checkStaleEscalations } from '@/lib/bot-followup'

const POLL_INTERVAL_MS = 60_000 // 1 minute

let _timer: ReturnType<typeof setTimeout> | null = null
let _running = false

/**
 * Poll the database once and enqueue any due SCHEDULED posts.
 */
export async function pollScheduledPosts(): Promise<{ enqueued: number }> {
    const now = new Date()
    console.log(`[Scheduler] Poll at ${now.toISOString()} — checking for due posts...`)

    // Find posts due for publishing (scheduledAt <= now, still SCHEDULED)
    const duePosts = await prisma.post.findMany({
        where: {
            status: 'SCHEDULED',
            scheduledAt: { lte: now },
        },
        select: { id: true, scheduledAt: true },
        take: 100,
    })

    console.log(`[Scheduler] Found ${duePosts.length} due post(s)${duePosts.length > 0 ? ':' : '.'}`)
    duePosts.forEach(p => console.log(`  → Post ${p.id} scheduled at ${p.scheduledAt?.toISOString()}`))

    if (duePosts.length === 0) return { enqueued: 0 }

    const queue = getAutoPostQueue()
    let enqueued = 0

    for (const post of duePosts) {
        try {
            // Mark as PUBLISHING first to prevent re-enqueue on next poll
            await prisma.post.update({
                where: { id: post.id },
                data: { status: 'PUBLISHING' },
            })

            const jobData: AutoPostJobData = {
                postId: post.id,
                triggeredBy: 'scheduler',
            }

            await queue.add(`publish:${post.id}`, jobData, {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `auto-post-${post.id}`, // deduplicate
            })

            enqueued++
            console.log(`[Scheduler] Enqueued post ${post.id} (scheduled: ${post.scheduledAt?.toISOString()})`)
        } catch (err) {
            console.error(`[Scheduler] Failed to enqueue post ${post.id}:`, err)
        }
    }

    return { enqueued }
}

/**
 * Start a recurring scheduler that polls every minute.
 * Call once from the worker process.
 */
export function startScheduler(): void {
    if (_running) return
    _running = true

    console.log('[Scheduler] Starting — polling every 60s')

    const tick = async () => {
        try {
            const result = await pollScheduledPosts()
            if (result.enqueued > 0) {
                console.log(`[Scheduler] ✅ Enqueued ${result.enqueued} post(s)`)
            }

            // Every 5 minutes: check for escalations with no agent reply
            if (Date.now() % (5 * 60_000) < POLL_INTERVAL_MS) {
                await checkStaleEscalations()
            }
        } catch (err) {
            console.error('[Scheduler] Poll error:', err)
        } finally {
            if (_running) {
                _timer = setTimeout(tick, POLL_INTERVAL_MS)
            }
        }
    }

    // First tick immediately, then every minute
    tick()
}

/**
 * Stop the scheduler (for graceful shutdown).
 */
export function stopScheduler(): void {
    _running = false
    if (_timer) {
        clearTimeout(_timer)
        _timer = null
    }
    console.log('[Scheduler] Stopped')
}
