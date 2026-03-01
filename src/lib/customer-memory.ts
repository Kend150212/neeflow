/**
 * customer-memory.ts
 *
 * Smart Memory system for the chat bot.
 * Manages per-customer structured profile + session event log.
 *
 * Architecture:
 *   - Profile: lifetime JSON object {name, preferences, habits, budget, notes, ...}
 *   - EventLog: [{date, summary}, ...] — one entry per completed session
 *   - After `summariesBeforeMerge` entries, AI compresses them into 1 master entry
 */

import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai-caller'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerProfile {
    name?: string
    phone?: string
    email?: string
    preferences?: string[]        // e.g. ["massage 90 phút", "giờ chiều"]
    habits?: string[]             // e.g. ["đặt lịch hàng tuần", "hỏi KM trước"]
    budget?: string               // e.g. "300k-400k"
    vipNotes?: string             // Free-form notes about VIP/special handling
    avoidances?: string[]         // Things to avoid with this customer
    language?: string             // Preferred language
    lastIntent?: string           // Last known intent (buy, support, info...)
    [key: string]: unknown
}

export interface EventLogEntry {
    date: string                 // ISO date string
    summary: string              // 1-3 sentence session summary
}

// Helper: serialize typed object to Prisma-safe InputJsonValue (avoids type errors on Json fields)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(value: unknown): any {
    return JSON.parse(JSON.stringify(value))
}

// ─── Build Memory Context String ──────────────────────────────────────────────

/**
 * Builds a formatted context string for injection into the bot prompt.
 * Returns empty string if no memory exists or smart memory disabled.
 */
export async function buildMemoryContext(
    channelId: string,
    externalUserId: string,
    platform: string
): Promise<string> {
    const memory = await prisma.customerMemory.findUnique({
        where: {
            channelId_externalUserId_platform: {
                channelId,
                externalUserId,
                platform,
            },
        },
    })

    if (!memory) return ''

    const profile = (memory.profile as unknown) as CustomerProfile
    const eventLog = ((memory.eventLog as unknown) as EventLogEntry[]) || []

    const parts: string[] = []

    // Build profile section
    const profileLines: string[] = []
    if (profile.name) profileLines.push(`Name: ${profile.name}`)
    if (profile.phone) profileLines.push(`Phone: ${profile.phone}`)
    if (profile.email) profileLines.push(`Email: ${profile.email}`)
    if (profile.budget) profileLines.push(`Budget: ${profile.budget}`)
    if (profile.language) profileLines.push(`Preferred language: ${profile.language}`)
    if (profile.preferences?.length) profileLines.push(`Preferences: ${profile.preferences.join(', ')}`)
    if (profile.habits?.length) profileLines.push(`Habits: ${profile.habits.join(', ')}`)
    if (profile.avoidances?.length) profileLines.push(`Avoidances: ${profile.avoidances.join(', ')}`)
    if (profile.vipNotes) profileLines.push(`Notes: ${profile.vipNotes}`)

    if (profileLines.length > 0) {
        parts.push(`=== CUSTOMER PROFILE (remembered across all sessions) ===\n${profileLines.join('\n')}`)
    }

    // Build event log section — last 3 entries
    if (eventLog.length > 0) {
        const recent = eventLog.slice(-3)
        const logLines = recent.map(e => `[${e.date}] ${e.summary}`)
        parts.push(`=== HISTORY HIGHLIGHTS ===\n${logLines.join('\n')}`)
    }

    if (parts.length === 0) return ''

    return parts.join('\n\n') + '\n\n=== THIS SESSION (new) ==='
}

// ─── Session Summarization ────────────────────────────────────────────────────

/**
 * Summarizes the most recent session of a conversation and updates CustomerMemory.
 * Called when a session timeout is detected, or after the conversation ends.
 */
export async function summarizeSession(opts: {
    conversationId: string
    channelId: string
    externalUserId: string
    platform: string
    provider: string
    apiKey: string
    model: string
    summariesBeforeMerge: number
}): Promise<void> {
    const { conversationId, channelId, externalUserId, platform, provider, apiKey, model, summariesBeforeMerge } = opts

    // Load recent messages from the current session
    const messages = await prisma.inboxMessage.findMany({
        where: { conversationId },
        orderBy: { sentAt: 'asc' },
        take: 50,
        select: { direction: true, senderType: true, content: true, sentAt: true },
    })

    if (messages.length < 2) return  // Nothing meaningful to summarize

    const transcript = messages
        .map(m => `${m.direction === 'inbound' ? 'Customer' : (m.senderType === 'bot' ? 'Bot' : 'Agent')}: ${m.content}`)
        .join('\n')

    // Get existing memory (if any)
    const existing = await prisma.customerMemory.findUnique({
        where: { channelId_externalUserId_platform: { channelId, externalUserId, platform } },
    })
    const currentProfile: CustomerProfile = ((existing?.profile as unknown) as CustomerProfile) || {}

    // AI call: summarize session AND extract profile updates
    const systemPrompt = `You are a customer memory system. Analyze this customer service conversation and return a JSON object with two keys:
1. "summary": A concise 1-2 sentence summary of what happened in this session (what the customer wanted, outcome).
2. "profileUpdates": An object with any NEW information discovered about this customer. Only include fields that are newly discovered or updated. Possible fields:
   - name (string): customer's real name
   - phone (string): phone number
   - email (string): email
   - budget (string): price range they mentioned
   - preferences (array of strings): services/products/times they like
   - habits (array of strings): behavioral patterns noticed
   - avoidances (array of strings): things they don't like or want to avoid
   - language (string): language they prefer
   - vipNotes (string): any special notes for VIP handling
   - lastIntent (string): main intent (buy, support, complaint, info)
   
Return ONLY valid JSON. No extra text.`

    const userPrompt = `Existing customer profile: ${JSON.stringify(currentProfile)}

Conversation transcript:
${transcript}

Analyze and return JSON:`

    let sessionSummary = ''
    let profileUpdates: Partial<CustomerProfile> = {}

    try {
        const raw = await callAI(provider, apiKey, model, systemPrompt, userPrompt)
        const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        const parsed = JSON.parse(cleaned)
        sessionSummary = parsed.summary || ''
        profileUpdates = parsed.profileUpdates || {}
    } catch (err) {
        console.error('[CustomerMemory] ❌ Failed to parse AI summary:', err)
        // Fallback: basic summary without AI parsing
        sessionSummary = `Session on ${new Date().toLocaleDateString('vi-VN')}: ${messages.length} messages exchanged.`
    }

    if (!sessionSummary) return

    // Merge profile updates into existing profile
    const updatedProfile: CustomerProfile = { ...currentProfile }
    for (const [key, val] of Object.entries(profileUpdates)) {
        if (val === undefined || val === null) continue
        if (Array.isArray(val) && Array.isArray(updatedProfile[key])) {
            // Merge arrays, deduplicate
            const existArr = updatedProfile[key] as string[]
            const merged = [...new Set([...existArr, ...val as string[]])]
            updatedProfile[key] = merged
        } else if (val) {
            updatedProfile[key] = val
        }
    }

    // Append new event log entry
    const existingLog: EventLogEntry[] = ((existing?.eventLog as unknown) as EventLogEntry[]) || []
    const newEntry: EventLogEntry = {
        date: new Date().toLocaleDateString('vi-VN'),
        summary: sessionSummary,
    }
    const updatedLog = [...existingLog, newEntry]

    // Upsert CustomerMemory (serialize JSON for Prisma)
    await prisma.customerMemory.upsert({
        where: { channelId_externalUserId_platform: { channelId, externalUserId, platform } },
        create: {
            channelId,
            externalUserId,
            platform,
            profile: toJson(updatedProfile),
            eventLog: toJson(updatedLog),
            lastSummarizedAt: new Date(),
        },
        update: {
            profile: toJson(updatedProfile),
            eventLog: toJson(updatedLog),
            lastSummarizedAt: new Date(),
        },
    })

    console.log(`[CustomerMemory] ✅ Session summarized for ${externalUserId} (${platform}): "${sessionSummary.substring(0, 60)}..."`)

    // Check if we need to merge event log
    const memory = await prisma.customerMemory.findUnique({
        where: { channelId_externalUserId_platform: { channelId, externalUserId, platform } },
    })
    if (memory) {
        const log: EventLogEntry[] = ((memory.eventLog as unknown) as EventLogEntry[]) || []
        if (log.length >= summariesBeforeMerge) {
            await mergeEventLog({ memory: { id: memory.id, eventLog: log }, provider, apiKey, model })
        }
    }

    // Update conversation's lastSummarizedAt marker (use aiSummary to track)
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { aiSummary: `[Smart Memory: session summarized at ${new Date().toISOString()}]\n${sessionSummary}` },
    })
}

// ─── Event Log Merge ──────────────────────────────────────────────────────────

/**
 * Compresses all event log entries into one master summary.
 * Called automatically when log reaches summariesBeforeMerge entries.
 */
export async function mergeEventLog(opts: {
    memory: { id: string; eventLog: EventLogEntry[] }
    provider: string
    apiKey: string
    model: string
}): Promise<void> {
    const { memory, provider, apiKey, model } = opts
    const { id, eventLog } = memory

    if (eventLog.length < 2) return

    const logText = eventLog
        .map(e => `[${e.date}] ${e.summary}`)
        .join('\n')

    try {
        const merged = await callAI(
            provider, apiKey, model,
            'You are a customer history compressor. Merge these session summaries into ONE concise summary (2-4 sentences) that preserves all important business facts: what the customer bought/booked, their preferences, any complaints, and behavioral patterns. Focus on facts useful for future interactions. Plain text only.',
            `Merge these ${eventLog.length} session summaries into one:\n\n${logText}`
        )

        const mergedEntry: EventLogEntry = {
            date: `${eventLog[0].date} → ${eventLog[eventLog.length - 1].date}`,
            summary: `[Merged ${eventLog.length} sessions] ${merged.trim()}`,
        }

        await prisma.customerMemory.update({
            where: { id },
            data: { eventLog: toJson([mergedEntry]) },
        })

        console.log(`[CustomerMemory] 🗜️ Merged ${eventLog.length} event log entries into 1 master summary`)
    } catch (err) {
        console.error('[CustomerMemory] ❌ Event log merge failed:', err)
    }
}
