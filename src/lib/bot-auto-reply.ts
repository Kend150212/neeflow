/**
 * Bot Auto-Reply Engine
 *
 * Triggered when an inbound message arrives and conversation.mode === 'BOT'.
 * Uses ALL channel context: vibeTone, businessInfo, brandProfile, knowledgeBase,
 * BotConfig (personality, training pairs, escalation, images, videos).
 */

import { prisma } from '@/lib/prisma'
import { callAI, callAIWithUsage, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { OAUTH_PLATFORMS, CREDENTIAL_PLATFORMS } from '@/lib/platform-registry'
import { buildPromotionContext } from '@/lib/product-context'
import { buildMemoryContext, summarizeSession } from '@/lib/customer-memory'
import { semanticSearchKnowledge, semanticSearchProducts } from '@/lib/rag-search'
import { scheduleWarmFollowup } from '@/lib/bot-followup'
import { createNotification, notifyChannelAdmins } from '@/lib/notify'

/**
 * Infer AI provider from a model ID string.
 * Returns provider name or null (caller falls back to channel default).
 */
function inferProviderFromModel(model: string): string | null {
    if (!model) return null
    const m = model.toLowerCase()
    // Synthetic uses hf: prefix
    if (m.startsWith('hf:')) return 'synthetic'
    if (m.startsWith('gemini-')) return 'gemini'
    if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4') || m.startsWith('chatgpt')) return 'openai'
    if (m.startsWith('claude-')) return 'anthropic'
    // OpenRouter style: "provider/model"
    if (m.startsWith('google/') || m.startsWith('anthropic/') || m.startsWith('openai/') ||
        m.startsWith('meta-llama/') || m.startsWith('mistralai/') || m.startsWith('qwen/')) {
        return 'openrouter'
    }
    return null
}

// ─── Dedup cache: prevent duplicate Messenger sends ─────────
// Key: "recipientId" → timestamp of last bot send
// When same page is in multiple channels, only the first channel's
// bot actually sends to Messenger; others are saved to DB only.
const recentBotReplies = new Map<string, number>()
const DEDUP_TTL_MS = 5_000 // 5 seconds — reduced from 30s to avoid silently dropping rapid customer messages

/**
 * Detect if the customer is asking to see images/photos/media.
 * Only when true will we inject image library and product photos.
 */
function isVisualRequest(text: string): boolean {
    return /ảnh|hình|xem|photo|image|picture|hình\s*ảnh|gallery|media|show|cho\s*xem|có\s*ảnh|ảnh\s*không/i.test(text)
}

interface BotReplyResult {
    replied: boolean
    reason?: string
}

export async function botAutoReply(
    conversationId: string,
    inboundContent: string,
    platform: string
): Promise<BotReplyResult> {
    try {
        // ─── 1. Load conversation + channel ───────────────────────
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                channel: {
                    select: {
                        id: true,
                        name: true,
                        displayName: true,
                        description: true,
                        language: true,
                        defaultAiProvider: true,
                        defaultAiModel: true,
                        vibeTone: true,
                        businessInfo: true,
                        brandProfile: true,
                    },
                },
            },
        })

        if (!conversation || !conversation.channel) {
            return { replied: false, reason: 'No conversation/channel' }
        }

        if (conversation.mode !== 'BOT') {
            return { replied: false, reason: 'Not in BOT mode' }
        }

        const channel = conversation.channel

        // ─── 2. Load BotConfig ────────────────────────────────────
        const botConfig = await prisma.botConfig.findUnique({
            where: { channelId: channel.id },
        })

        if (botConfig && !botConfig.isEnabled) {
            return { replied: false, reason: 'Bot disabled' }
        }

        // Per-page toggle is checked only when creating NEW conversations
        // (in upsertConversation). Here we trust conversation.mode — agents
        // can manually transfer any conversation to BOT mode.

        // NOTE: mark_seen + typing_on moved to AFTER validation checks
        // to avoid showing "seen" when the bot won't actually reply

        // ─── 3. Working Hours Check ───────────────────────────────
        if (botConfig?.workingHoursOnly && botConfig.workingHoursStart && botConfig.workingHoursEnd) {
            const now = new Date()
            const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            if (hhmm < botConfig.workingHoursStart || hhmm > botConfig.workingHoursEnd) {
                // Off-hours: send off-hours message
                if (botConfig.offHoursMessage) {
                    await sendAndSaveReply(
                        conversation,
                        botConfig.offHoursMessage,
                        platform
                    )
                    return { replied: true, reason: 'Off-hours message sent' }
                }
                return { replied: false, reason: 'Outside working hours, no off-hours message' }
            }
        }

        // ─── 4. Platform scope check ──────────────────────────────
        if (botConfig) {
            const enabledPlatforms = (botConfig.enabledPlatforms as string[]) || ['all']
            if (!enabledPlatforms.includes('all') && !enabledPlatforms.includes(platform)) {
                return { replied: false, reason: `Bot not enabled for ${platform}` }
            }

            const type = conversation.type || 'message'
            if (type === 'comment' && !botConfig.applyToComments) {
                return { replied: false, reason: 'Bot not enabled for comments' }
            }
            if (type === 'message' && !botConfig.applyToMessages) {
                return { replied: false, reason: 'Bot not enabled for messages' }
            }
        }

        // ─── 5. Escalation keyword check ──────────────────────────
        if (botConfig?.autoEscalateKeywords) {
            const keywords = (botConfig.autoEscalateKeywords as string[]) || []
            const lowerContent = inboundContent.toLowerCase()
            const triggered = keywords.some(kw => lowerContent.includes(kw.toLowerCase()))
            if (triggered) {
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { mode: 'AGENT' },
                })
                return { replied: false, reason: 'Escalation keyword detected' }
            }
        }

        // ─── 7. Resolve AI key ────────────────────────────────────
        // If botConfig overrides the model, infer the provider from the model name
        // so we fetch the matching API key (not always the channel's default provider)
        const botOverrideModel = (botConfig as any)?.botModel as string | null | undefined
        const preferredProvider = botOverrideModel
            ? inferProviderFromModel(botOverrideModel) ?? channel.defaultAiProvider
            : channel.defaultAiProvider

        const ownerKey = await getChannelOwnerKey(channel.id, preferredProvider)
        if (!ownerKey.apiKey) {
            return { replied: false, reason: 'No AI API key available' }
        }

        const provider = ownerKey.provider!
        const apiKey = ownerKey.apiKey
        const model = botOverrideModel || channel.defaultAiModel || ownerKey.model || getDefaultModel(provider, {})

        // ─── 7b. Smart Memory: detect session timeout ─────────────
        // If enabled and the conversation was dormant for > sessionTimeoutHours,
        // summarize the previous session before continuing.
        if (botConfig?.enableSmartMemory && conversation.lastMessageAt) {
            const timeoutHours = botConfig.sessionTimeoutHours ?? 8
            const hoursSinceLastMsg = (Date.now() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60)
            if (hoursSinceLastMsg >= timeoutHours) {
                // Fire session summarization in setImmediate — don't block the reply
                const _convId = conversationId
                const _channelId = channel.id
                const _extUserId = conversation.externalUserId
                const _platform = platform
                const _provider = provider
                const _apiKey = apiKey
                const _model = model
                const _smBefore = botConfig.summariesBeforeMerge ?? 5
                setImmediate(async () => {
                    try {
                        await summarizeSession({
                            conversationId: _convId,
                            channelId: _channelId,
                            externalUserId: _extUserId,
                            platform: _platform,
                            provider: _provider,
                            apiKey: _apiKey,
                            model: _model,
                            summariesBeforeMerge: _smBefore,
                        })
                    } catch (err) {
                        console.error('[Smart Memory] ❌ Session summarization failed:', err)
                    }
                })
            }
        }

        // ─── 8. Load context ──────────────────────────────────────
        // Semantic RAG search: only load the top-5 most relevant entries
        // instead of dumping all 50 into the prompt.
        // Falls back to latest entries if no embeddings exist yet.
        const [knowledgeEntries, productResults] = await Promise.all([
            semanticSearchKnowledge(channel.id, inboundContent, provider, apiKey, 5),
            semanticSearchProducts(channel.id, inboundContent, provider, apiKey, 3),
        ])

        // Load recent conversation history
        const totalMsgCount = await prisma.inboxMessage.count({ where: { conversationId } })
        const recentMessages = await prisma.inboxMessage.findMany({
            where: { conversationId },
            orderBy: { sentAt: 'desc' },
            take: conversation.aiSummary ? 5 : 15, // fewer messages if we have summary
        })

        const messageHistory = recentMessages
            .reverse()
            .map(m => `${m.direction === 'inbound' ? 'Customer' : 'Bot'}: ${m.content}`)
            .join('\n')

        // Load similar agent conversations as few-shot examples
        // Find conversations where agents replied, with similar keywords
        const inboundLower = inboundContent.toLowerCase()
        const keywords = inboundLower.split(/\s+/).filter(w => w.length > 3).slice(0, 5)
        let agentExamples: Array<{ customerMsg: string; agentReply: string }> = []

        if (keywords.length > 0) {
            // Find recent agent-handled conversations in same channel
            const agentConversations = await prisma.conversation.findMany({
                where: {
                    channelId: channel.id,
                    id: { not: conversationId }, // exclude current
                },
                select: { id: true },
                orderBy: { updatedAt: 'desc' },
                take: 50,
            })

            if (agentConversations.length > 0) {
                const convIds = agentConversations.map(c => c.id)

                // FIX: Batch load BOTH agent messages AND all inbound messages in 2 queries
                // instead of N+1 individual findFirst calls
                const [agentMessages, allInboundMessages] = await Promise.all([
                    prisma.inboxMessage.findMany({
                        where: {
                            conversationId: { in: convIds },
                            direction: 'outbound',
                            senderType: 'agent',
                        },
                        select: { conversationId: true, content: true, sentAt: true },
                        orderBy: { sentAt: 'desc' },
                        take: 50,
                    }),
                    prisma.inboxMessage.findMany({
                        where: {
                            conversationId: { in: convIds },
                            direction: 'inbound',
                        },
                        select: { conversationId: true, content: true, sentAt: true },
                        orderBy: { sentAt: 'desc' },
                    }),
                ])

                // Build map: conversationId → inbound messages (sorted desc)
                const inboundByConv = new Map<string, Array<{ content: string; sentAt: Date }>>()
                for (const msg of allInboundMessages) {
                    if (!inboundByConv.has(msg.conversationId)) inboundByConv.set(msg.conversationId, [])
                    inboundByConv.get(msg.conversationId)!.push({ content: msg.content, sentAt: msg.sentAt })
                }

                for (const agentMsg of agentMessages.slice(0, 20)) {
                    // Find the most recent inbound msg BEFORE this agent reply (in-memory, zero extra queries)
                    const inbounds = inboundByConv.get(agentMsg.conversationId) || []
                    const customerMsg = inbounds
                        .filter(m => m.sentAt < agentMsg.sentAt)
                        .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0]

                    if (customerMsg?.content) {
                        const custLower = customerMsg.content.toLowerCase()
                        const score = keywords.filter(kw => custLower.includes(kw)).length
                        if (score > 0) {
                            agentExamples.push({
                                customerMsg: customerMsg.content.substring(0, 300),
                                agentReply: agentMsg.content.substring(0, 500),
                            })
                        }
                    }
                    if (agentExamples.length >= 5) break
                }
            }
        }

        // Load channel's connected platforms (auto-updated when new platforms are connected)
        const connectedPlatforms = await prisma.channelPlatform.findMany({
            where: { channelId: channel.id, isActive: true },
            select: { platform: true, accountName: true },
        })

        // Load image library metadata — ONLY when customer is explicitly asking for images/photos
        const wantsImages = isVisualRequest(inboundContent)
        let imageLibrary: { originalName: string | null; url: string }[] = []
        if (wantsImages && botConfig?.imageFolderId) {
            imageLibrary = await prisma.mediaItem.findMany({
                where: {
                    channelId: channel.id,
                    folderId: botConfig.imageFolderId,
                    type: 'image',
                },
                select: { originalName: true, url: true },
                take: 50, // reduced from 100 — 50 images is already ~2500 tokens
            })
        }

        // ─── 9. Build system prompt ───────────────────────────────
        const vibeTone = (channel.vibeTone as Record<string, string>) || {}
        const businessInfo = (channel.businessInfo as Record<string, any>) || {}
        const brandProfile = (channel.brandProfile as Record<string, string>) || {}
        const trainingPairs = (botConfig?.trainingPairs as Array<{ q: string; a: string }>) || []
        const consultVideos = (botConfig?.consultVideos as Array<{ title: string; url: string; description: string }>) || []
        const forbiddenTopics = (botConfig?.forbiddenTopics as string[]) || []

        let systemPrompt = `You are ${botConfig?.botName || 'AI Assistant'}, an auto-reply customer service bot for "${channel.displayName || channel.name}".`

        // ─── Real-time date injection ────────────────────────────────
        const nowDate = new Date()
        const dateStr = nowDate.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        const timeStr = nowDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
        systemPrompt += `\n\n## Current Date & Time:\nToday is ${dateStr}, ${timeStr} (server time). Use this as the authoritative date — do NOT rely on your training data for what today's date is.`


        const allSupportedPlatforms = [
            ...OAUTH_PLATFORMS.map(p => `${p.label} (${p.description})`),
            ...CREDENTIAL_PLATFORMS.map(p => `${p.label} (${p.description})`),
        ]
        const connectedList = connectedPlatforms.length > 0
            ? connectedPlatforms.map(p => `${p.platform}: ${p.accountName}`).join(', ')
            : 'No platforms connected yet'

        // Only inject full platform list when customer asks about platforms/features — saves ~500 tokens
        const asksPlatform = /neeflow|platform|tính\s*năng|feature|kết\s*nối|connect|hỗ\s*trợ|support|dùng\s*được|đăng\s*lên|app/i.test(inboundContent)
        if (asksPlatform) {
            systemPrompt += `\n\n## About NeeFlow (the platform you are part of):
- NeeFlow is an AI-powered social media management platform
- Website: https://neeflow.com
- NeeFlow supports ${allSupportedPlatforms.length} platforms: ${allSupportedPlatforms.join(', ')}
- Key features: Schedule posts, generate content with AI, manage Facebook/Instagram/YouTube/TikTok/LinkedIn/Pinterest/Threads/Google Business/X/Bluesky, unified inbox, AI auto-reply bot, media library, analytics
- This channel currently has these platforms connected: ${connectedList}
- When customers ask about platforms or features, use this information to answer accurately`
        } else if (connectedPlatforms.length > 0) {
            // Brief mention — does not waste tokens
            systemPrompt += `\n\n## Connected platforms: ${connectedList}`
        }

        if (botConfig?.personality) {
            systemPrompt += `\n\n## Your personality and instructions:\n${botConfig.personality}`
        }

        if (channel.description) {
            systemPrompt += `\n\n## About this business:\n${channel.description}`
        }

        if (vibeTone.personality || vibeTone.writingStyle) {
            systemPrompt += `\n\n## Brand voice:`
            if (vibeTone.personality) systemPrompt += `\n- Personality: ${vibeTone.personality}`
            if (vibeTone.writingStyle) systemPrompt += `\n- Writing style: ${vibeTone.writingStyle}`
            if (vibeTone.vocabulary) systemPrompt += `\n- Vocabulary: ${vibeTone.vocabulary}`
        }

        if (businessInfo.phone || businessInfo.address || businessInfo.website) {
            systemPrompt += `\n\n## Business contact:`
            if (businessInfo.phone) systemPrompt += `\n- Phone: ${businessInfo.phone}`
            if (businessInfo.address) systemPrompt += `\n- Address: ${businessInfo.address}`
            if (businessInfo.website) systemPrompt += `\n- Website: ${businessInfo.website}`
        }

        // ─── Social links from channel General settings ────────────────
        const bizSocials = (businessInfo.socials as Record<string, string>) || {}
        const bizCustomLinks = (businessInfo.custom as Array<{ label: string; url: string }>) || []
        const SOCIAL_KEYS: Array<{ key: string; label: string }> = [
            { key: 'facebook', label: 'Facebook' },
            { key: 'instagram', label: 'Instagram' },
            { key: 'tiktok', label: 'TikTok' },
            { key: 'youtube', label: 'YouTube' },
            { key: 'linkedin', label: 'LinkedIn' },
            { key: 'x', label: 'X (Twitter)' },
            { key: 'threads', label: 'Threads' },
            { key: 'pinterest', label: 'Pinterest' },
        ]
        const socialEntries = SOCIAL_KEYS.filter(s => bizSocials[s.key]).map(s => `${s.label}: ${bizSocials[s.key]}`)
        if (socialEntries.length > 0 || bizCustomLinks.length > 0) {
            systemPrompt += `\n\n## Official social media & links (dùng ĐÚNG những link này — TUYỆT ĐỐI KHÔNG bịa đặt hay đoán handle/tên khác):`
            for (const s of socialEntries) systemPrompt += `\n- ${s}`
            for (const cl of bizCustomLinks) systemPrompt += `\n- ${cl.label}: ${cl.url}`
            systemPrompt += `\nCRITICAL: Khi khách hỏi về social media (TikTok, Facebook, Instagram...) → luôn trả lời kèm tên NÀ URL đầy đủ (ví dụ: "TikTok của tụi tui là https://tiktok.com/@luxhome.homestay nha!"). KHÔNG chỉ nói tên mà không có link. KHÔNG được tự bịa link hay đoán handle.`
        }


        if (brandProfile.targetAudience) {
            systemPrompt += `\n\n## Target audience: ${brandProfile.targetAudience}`
        }


        if (knowledgeEntries.length > 0) {
            systemPrompt += `\n\n--- KNOWLEDGE BASE ---`
            for (const entry of knowledgeEntries) {
                systemPrompt += `\n\n### ${entry.title}\n${entry.content.substring(0, 2000)}`
            }
            systemPrompt += `\n--- END KNOWLEDGE BASE ---`
        }

        // ─── Inject matched products (with images) ────────────────────
        if (productResults.length > 0) {
            systemPrompt += `\n\n--- MATCHED PRODUCTS ---`
            systemPrompt += `\nThese products from the store catalog match the customer's inquiry. Use their details to answer accurately.\n⚠️ IMPORTANT: When the customer asks about buying, ordering, pricing, or where to get a product (in ANY language — English, Vietnamese, or other), you MUST share the exact Product URL from the data below. Do NOT make up or substitute any other URL. Do NOT send the shop's homepage URL as a product link — send the specific Product URL listed for each item.`
            for (const p of productResults) {
                const price = p.salePrice
                    ? `${p.salePrice.toLocaleString()}đ (Sale price, was ${p.price?.toLocaleString()}đ)`
                    : p.price ? `${p.price.toLocaleString()}đ` : 'Contact for price'
                systemPrompt += `\n\n**${p.name}**${p.category ? ` [${p.category}]` : ''}`
                systemPrompt += `\nPrice: ${price}`
                if ((p as any).productUrl) systemPrompt += `\nProduct URL: ${(p as any).productUrl}`
                if (p.description) systemPrompt += `\nDescription: ${p.description}`
                if (p.features?.length) systemPrompt += `\nFeatures: ${p.features.join(', ')}`
                const imgs = (p.images || []).slice(0, 3)
                if (imgs.length > 0) {
                    if (wantsImages) {
                        // Customer explicitly asked to see images — inject and instruct bot to include them
                        systemPrompt += `\nImages (INCLUDE in reply using [IMAGE: url] at the END after your text):`
                        for (const img of imgs) systemPrompt += `\n[IMAGE: ${img}]`
                    } else {
                        // Images available but customer didn't ask — do NOT send, just note for bot awareness
                        systemPrompt += `\nImages available (DO NOT include unless customer specifically asks to see them):`
                        for (const img of imgs) systemPrompt += `\n[IMAGE: ${img}]`
                    }
                }
            }
            systemPrompt += `\n--- END MATCHED PRODUCTS ---`
        }

        if (trainingPairs.length > 0) {
            // Smart match: pick training pairs most relevant to current message
            const scoredPairs = trainingPairs.map(pair => {
                const qLower = pair.q.toLowerCase()
                const score = keywords.filter(kw => qLower.includes(kw)).length
                return { ...pair, score }
            })
            // Sort by relevance, take top matches first, then fill with recent
            scoredPairs.sort((a, b) => b.score - a.score)
            const topPairs = scoredPairs.slice(0, 15)

            systemPrompt += `\n\n--- TRAINING Q&A (learned from real agent responses) ---`
            for (const pair of topPairs) {
                systemPrompt += `\nQ: ${pair.q}\nA: ${pair.a}`
            }
            systemPrompt += `\n--- END TRAINING Q&A ---`
        }

        // Inject few-shot agent examples (from similar past conversations)
        if (agentExamples.length > 0) {
            systemPrompt += `\n\n--- REAL AGENT EXAMPLES (how our team actually replied to similar questions) ---`
            systemPrompt += `\nMIMIC these response styles. These are from real agents on the team:`
            for (const ex of agentExamples) {
                systemPrompt += `\nCustomer: ${ex.customerMsg}\nAgent: ${ex.agentReply}`
            }
            systemPrompt += `\n--- END REAL AGENT EXAMPLES ---`
        }

        // Inject agent learning data (auto-discovered patterns from real agent chats)
        const agentLearning = (botConfig?.agentLearning as any) || {}
        if (agentLearning && Object.keys(agentLearning).length > 0 && agentLearning.totalConversationsAnalyzed) {
            systemPrompt += `\n\n--- AGENT LEARNING (auto-discovered from ${agentLearning.totalConversationsAnalyzed} real conversations) ---`
            if (agentLearning.vocabulary?.length) {
                systemPrompt += `\n## Vocabulary commonly used by our team: ${agentLearning.vocabulary.join(', ')}`
            }
            if (agentLearning.slangAndAbbreviations?.length) {
                systemPrompt += `\n## Slang, abbreviations & informal language our team uses: ${agentLearning.slangAndAbbreviations.join(', ')}`
                systemPrompt += `\nIMPORTANT: Use these slang terms and abbreviations naturally when appropriate.`
            }
            if (agentLearning.greetingStyles?.length) {
                systemPrompt += `\n## How our agents typically greet customers: ${agentLearning.greetingStyles.join(' | ')}`
            }
            if (agentLearning.closingStyles?.length) {
                systemPrompt += `\n## How our agents close conversations: ${agentLearning.closingStyles.join(' | ')}`
            }
            if (agentLearning.dealingPatterns?.length) {
                systemPrompt += `\n## How our agents handle different customer scenarios:`
                for (const p of agentLearning.dealingPatterns) {
                    systemPrompt += `\n- When "${p.scenario}": ${p.approach}`
                }
            }
            if (agentLearning.keyPhrases?.length) {
                systemPrompt += `\n## Signature phrases our team uses: ${agentLearning.keyPhrases.join(', ')}`
            }
            if (agentLearning.toneAnalysis) {
                const t = agentLearning.toneAnalysis
                systemPrompt += `\n## Our team's tone: formality=${t.formality}, emoji usage=${t.emojiUsage}`
                if (t.writingStyle) systemPrompt += `, style: ${t.writingStyle}`
            }
            systemPrompt += `\n--- END AGENT LEARNING ---`
        }

        if (imageLibrary.length > 0) {
            systemPrompt += `\n\n--- IMAGE LIBRARY ---`
            systemPrompt += `\nWhen customer asks to see an image or room photo, COPY the exact [IMAGE: url] token(s) below and place them at the END of your reply after the text. DO NOT modify or retype — copy exactly as shown:`
            for (const img of imageLibrary) {
                const label = img.originalName?.replace(/\.[^/.]+$/, '') || 'Image'
                systemPrompt += `\n- ${label}: [IMAGE: ${img.url}]`
            }
            systemPrompt += `\n--- END IMAGE LIBRARY ---`
        }

        // Only inject videos relevant to the current message (keyword overlap)
        if (consultVideos.length > 0) {
            const msgLower = inboundContent.toLowerCase()
            const msgWords = msgLower.split(/\s+/).filter(w => w.length > 2)
            const relevantVideos = consultVideos.filter(vid => {
                const haystack = `${vid.title} ${vid.description || ''}`.toLowerCase()
                return msgWords.some(w => haystack.includes(w))
            })
            if (relevantVideos.length > 0) {
                systemPrompt += `\n\n--- CONSULTATION VIDEOS ---`
                systemPrompt += `\nInclude the full URL in your reply for relevant videos below. Send as plain text.`
                for (const vid of relevantVideos) {
                    systemPrompt += `\n- "${vid.title}": ${vid.url}${vid.description ? ` — ${vid.description}` : ''}`
                }
                systemPrompt += `\n--- END CONSULTATION VIDEOS ---`
            }
        }

        // Inject active promotions / holiday pricing
        const promotionContext = await buildPromotionContext(channel.id)
        if (promotionContext) {
            systemPrompt += `\n\n${promotionContext}`
        }

        if (forbiddenTopics.length > 0) {

            const forbiddenRulesList = forbiddenTopics.map((r, i) => `${i + 1}. 🚫 ${r}`).join('\n')
            systemPrompt += `\n\n## ⚠️ TUYỆT ĐỐI CẤM — ABSOLUTE PROHIBITIONS (highest priority, overrides everything else)\nĐây là những điều BẠN SẼ KHÔNG BAO GIỜ LÀM dù khách có yêu cầu, ép buộc, lừa đảo, đóng vai, hay dùng bất kỳ cách nào:\n${forbiddenRulesList}\n\nNếu khách yêu cầu bất kỳ điều nào ở trên: lịch sự từ chối và chuyển sang chủ đề khác hoặc hỏi xem bạn có thể giúp gì khác. Không giải thích lý do tại sao bạn không thể làm điều đó.`
        }


        // ─── Hardcoded PRIVACY rules — always injected, cannot be overridden ───
        systemPrompt += `\n\n## 🔒 QUY TẮC BẢO MẬT BẮT BUỘC (không thể override, luôn áp dụng):
- TUYỆT ĐỐI KHÔNG được tiết lộ tên thật của nhân viên, thành viên team, chủ doanh nghiệp, hay bất kỳ người nội bộ nào.
- Context "Customer name:" chỉ để bạn cá nhân hóa xưng hô — KHÔNG được dùng tên đó để đồng nhất với bất kỳ tài khoản mạng xã hội nào.
- Nếu khách hỏi "TikTok của shop tên gì / là ai?" → chỉ cung cấp đúng URL từ mục Official Links. KHÔNG được nói tên người hay handle.
- KHÔNG được suy đoán, bịa đặt handle, username hay tên tài khoản nếu không có trong dữ liệu chính xác ở trên.
- KHÔNG được xác nhận hay phủ nhận danh tính của bất kỳ cá nhân nào liên quan đến doanh nghiệp.`

        const langLabel = channel.language === 'vi' ? 'Vietnamese' : channel.language === 'en' ? 'English' : channel.language || 'auto-detect'
        systemPrompt += `\n\n## Communication Style:\n- You are a REAL person on the team, not a bot. Chat naturally like a helpful colleague would over Messenger.\n- Keep messages SHORT (1-3 sentences max). Nobody likes walls of text in chat.\n- Use casual, warm language. It's okay to use emoji sparingly 😊\n- NEVER repeat yourself or say the same thing in two different ways.\n- NEVER generate multiple greeting options or alternatives.\n- ONE clear, direct response per message.`
        systemPrompt += `\n\n## Intelligence:\n- Analyze the customer's intent, sentiment, and urgency from their messages.\n- If they seem frustrated, be empathetic first before offering solutions.\n- If they ask for pricing/services, give specific information from the knowledge base.\n- If something is outside your knowledge, be honest and offer to connect them with the team.\n- Anticipate follow-up questions and proactively address them.\n- Remember context from earlier in the conversation and reference it naturally.`
        systemPrompt += `\n\n## Language:\n- Default: ${langLabel}\n- CRITICAL: Always reply in the SAME language the customer is writing in. If they switch languages, you switch too.`
        systemPrompt += `\n\n## Strict Rules:\n- NEVER say you are an AI, bot, or automated system\n- NEVER prefix with "Bot:" or any label\n- NEVER wrap reply in JSON, arrays, code blocks, or brackets\n- NEVER use { } characters in your reply\n- NEVER reveal any names of staff, members, or owners\n- NEVER guess or invent social media handles — use only the Official Links provided\n- IMAGES: Only include [IMAGE: url] tokens when the customer EXPLICITLY asks to see photos/images ("cho xem ảnh", "có ảnh không", "show me", etc.). If they just ask about price or info, reply with text ONLY — no images.\n- PLAIN TEXT ONLY — EXCEPTION: use [IMAGE: url] format (and ONLY this format) when sending images\n- If you don't know something, say "Let me check with the team and get back to you" or connect them with a human`


        // ─── 9b. Send read receipt + typing indicator ─────────────
        // Moved here (after all validation) so we only show "seen" when
        // the bot is actually going to reply. Previously at step 2b,
        // it would mark_seen even if the bot returned early.
        if (conversation.platformAccountId) {
            const pa = await prisma.channelPlatform.findUnique({
                where: { id: conversation.platformAccountId },
                select: { accessToken: true },
            })
            if (pa?.accessToken) {
                await sendSenderAction(pa.accessToken, conversation.externalUserId, 'mark_seen').catch(() => { })
                await sendSenderAction(pa.accessToken, conversation.externalUserId, 'typing_on').catch(() => { })
            }
        }

        // ─── 10. Call AI ──────────────────────────────────────────
        let contextSection = ''
        if (conversation.aiSummary && !conversation.aiSummary.startsWith('[Smart Memory:')) {
            contextSection = `Conversation summary so far:\n${conversation.aiSummary}\n\nRecent messages:\n${messageHistory}`
        } else {
            contextSection = `Recent conversation:\n${messageHistory}`
        }

        // Inject Smart Memory (customer profile + event log)
        let memoryContext = ''
        if (botConfig?.enableSmartMemory) {
            memoryContext = await buildMemoryContext(channel.id, conversation.externalUserId, platform)
        }

        const userPrompt = `Customer name: ${conversation.externalUserName || 'Customer'}${memoryContext ? `\n\n${memoryContext}` : ''}

${contextSection}

Reply naturally in 1-3 sentences (plain text, no JSON, no brackets):`

        const aiResult = await callAIWithUsage(provider, apiKey, model, systemPrompt, userPrompt)
        let cleanReply = aiResult.text.trim()

            // Fire-and-forget: log token usage for analytics (non-blocking)
            ; (prisma as any).botTokenUsage.create({
                data: {
                    channelId: channel.id,
                    provider,
                    model: aiResult.model || model,
                    promptTokens: aiResult.promptTokens,
                    completionTokens: aiResult.completionTokens,
                    totalTokens: aiResult.totalTokens,
                    conversationId,
                },
            }).catch(() => { /* non-blocking — ignore errors */ })

        // AI sometimes wraps reply in JSON — extract text if so
        if (cleanReply.startsWith('{') || cleanReply.startsWith('[') || cleanReply.startsWith('```')) {
            try {
                // Strip markdown code fences if present
                let jsonStr = cleanReply
                    .replace(/^```(?:json)?\s*/i, '')
                    .replace(/\s*```$/i, '')
                    .trim()
                // Fix malformed JSON: replace *key* or **key** with "key"
                jsonStr = jsonStr.replace(/\*{1,2}(\w+)\*{1,2}\s*:/g, '"$1":')
                // Fix unquoted string keys
                jsonStr = jsonStr.replace(/(?<=\{|,)\s*(\w+)\s*:/g, '"$1":')
                const parsed = JSON.parse(jsonStr)
                // Handle JSON array
                if (Array.isArray(parsed)) {
                    // Array of objects: [{"reply": "..."}]
                    if (parsed.length > 0 && typeof parsed[0] === 'object') {
                        const obj = parsed[0]
                        cleanReply = obj.reply || obj.response || obj.message || obj.text || obj.content || obj.answer || JSON.stringify(obj)
                    } else {
                        // Array of strings: ["text"]
                        const textItems = parsed.filter((item: any) => typeof item === 'string')
                        if (textItems.length > 0) {
                            cleanReply = textItems.join('\n')
                        }
                    }
                } else {
                    // Single object: {"reply": "..."}
                    cleanReply = parsed.reply || parsed.response || parsed.message
                        || parsed.text || parsed.content || parsed.answer
                        || cleanReply // fallback to original if no known key
                }
            } catch {
                // JSON.parse failed — try regex extraction as last resort
                const valueMatch = cleanReply.match(/(?:reply|response|message|text|content|answer)["*]*\s*:\s*"([^"]+)"/i)
                    || cleanReply.match(/(?:reply|response|message|text|content|answer)["*]*\s*:\s*"([\s\S]+?)"\s*[\}\]]?$/i)
                if (valueMatch?.[1]) {
                    cleanReply = valueMatch[1]
                }
                // Also try extracting from array-like pattern: ["text"] or [{"reply":"text"}]
                if (!valueMatch) {
                    const arrayMatch = cleanReply.match(/^\[\s*"([\s\S]+?)"\s*\]$/)
                        || cleanReply.match(/"(?:reply|response|message|text|content)"\s*:\s*"([\s\S]+?)"/i)
                    if (arrayMatch?.[1]) {
                        cleanReply = arrayMatch[1]
                    }
                }
            }
        }
        cleanReply = cleanReply.trim()

        if (!cleanReply) {
            return { replied: false, reason: 'Empty AI response' }
        }

        // ─── 11. Extract images from reply and send ───────────────
        // Extract [IMAGE: url] patterns
        const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/g
        const imageUrls: string[] = []
        let textReply = cleanReply
        let match
        while ((match = imageRegex.exec(cleanReply)) !== null) {
            imageUrls.push(match[1])
        }
        textReply = textReply.replace(/\[IMAGE:\s*https?:\/\/[^\]]+\]/g, '').trim()

        // ─── 12. Send reply via platform ──────────────────────────
        await sendAndSaveReply(conversation, textReply, platform, imageUrls, {
            commentMinDelay: botConfig?.commentReplyMinDelay ?? 30,
            commentMaxDelay: botConfig?.commentReplyMaxDelay ?? 600,
        })

        // ─── 13. Detect AI-decided escalation ─────────────────────
        // If the AI reply contains phrases indicating it's transferring
        // to a human agent, switch conversation mode to AGENT
        const escalationPatterns = [
            /connect(ing)?\s+(you\s+)?(with|to)\s+(a\s+)?(human|agent|team|staff|representative|member)/i,
            /transfer(ring)?\s+(you\s+)?(to|over)\s+(a\s+)?(human|agent|team|staff|representative|member)/i,
            /forward(ing)?\s+(you\s+)?to\s+(a\s+)?(human|agent|team|staff|representative|member)/i,
            /human\s+agent\s+(will|can|is\s+going\s+to)\s+(help|assist|take\s+over)/i,
            /let\s+me\s+(get|find|connect|transfer)/i,
            /i'?ll\s+(get|find|connect|grab|have)\s+(a\s+)?team/i,
            /get\s+(a\s+)?team\s+(member|mate)/i,
            /(just\s+)?a\s+moment\s+(while|as)\s+(i|we)\s+(connect|transfer|get)/i,
            /team\s+member\s+(for|to\s+help)\s+you/i,
            /passing\s+(this|you)\s+(to|along|over)/i,
            /someone\s+(from|on)\s+(the|our)\s+team/i,
            /kết\s*nối\s*(bạn\s*)?(với|đến)\s*(nhân\s*viên|agent|người)/i,
            /chuyển\s*(bạn\s*)?(cho|đến|qua)\s*(nhân\s*viên|agent|người|tư\s*vấn)/i,
            /nhân\s*viên\s*(sẽ|sẽ\s+sớm|đang)\s*(hỗ\s*trợ|liên\s*hệ|phục\s*vụ)/i,
        ]

        const lowerReply = textReply.toLowerCase()
        const isEscalation = escalationPatterns.some(p => p.test(textReply))

        if (isEscalation) {
            // Fetch current metadata to merge (avoid clobbering existing fields)
            const existingConv = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { metadata: true },
            })
            const existingMeta = (existingConv?.metadata as Record<string, unknown>) || {}

            // Extract a short topic hint from bot's reply for the notification message
            const topicMatch = textReply.match(/(?:check|look into|find out about|verify|confirm|về|kiểm tra|xem)\s+(.{10,50})/i)
            const escalatedTopic = topicMatch ? topicMatch[1].trim() : textReply.substring(0, 60)

            await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    mode: 'AGENT',
                    status: 'new',
                    metadata: {
                        ...existingMeta,
                        pendingFollowup: true,
                        escalatedAt: new Date().toISOString(),
                        escalatedTopic,
                        followupWarm1SentAt: null,
                        followupWarm2SentAt: null,
                    },
                },
            })

            console.log(`[Bot Auto-Reply] 🔄 AI escalated → AGENT mode + scheduling follow-up`)

            const isVi = channel.language === 'vi'
            const notifyTitle = isVi ? '⚠️ Khách đang chờ tư vấn' : '⚠️ Customer waiting for follow-up'
            const notifyMsg = `${conversation.externalUserName || (isVi ? 'Khách' : 'Customer')} — "${escalatedTopic}${escalatedTopic.length > 55 ? '…' : ''}"`
            const inboxLink = `/dashboard/inbox?conversationId=${conversationId}`

            // Notify all channel OWNER/ADMIN/MANAGER immediately (SSE badge + DB)
            await notifyChannelAdmins({
                channelId: channel.id,
                type: 'new_message',
                title: notifyTitle,
                message: notifyMsg,
                link: inboxLink,
                data: { conversationId, pendingFollowup: true },
            })

            // Notify the specifically assigned agent if different from admins
            if (conversation.assignedTo) {
                await createNotification({
                    userId: conversation.assignedTo,
                    type: 'new_message',
                    title: notifyTitle,
                    message: notifyMsg,
                    link: inboxLink,
                    data: { conversationId, pendingFollowup: true },
                })
            }

            // Extract phone from businessInfo for warm2 fallback message
            const bizInfo = channel.businessInfo as Record<string, string> | null
            const channelPhone = bizInfo?.phone || bizInfo?.phoneNumber || null

            // Schedule warm messages (non-blocking)
            scheduleWarmFollowup({
                conversationId,
                channelId: channel.id,
                channelLanguage: channel.language,
                channelPhone,
                platform,
                externalUserId: conversation.externalUserId,
                platformAccountId: conversation.platformAccountId ?? null,
                conversationType: conversation.type ?? null,
                assignedTo: conversation.assignedTo ?? null,
                customerName: conversation.externalUserName ?? null,
                escalatedTopic,
                botConfig: botConfig as Record<string, any> | null,
            })

            return { replied: true, reason: 'Escalated to agent' }
        }

        // ─── 13b. Auto-summarize long conversations ───────────────
        if (totalMsgCount >= 10) {
            setImmediate(async () => {
                try {
                    // Only re-summarize if no summary yet or 10+ messages since last
                    const conv = await prisma.conversation.findUnique({
                        where: { id: conversationId },
                        select: { aiSummary: true },
                    })

                    const shouldSummarize = !conv?.aiSummary || totalMsgCount % 10 === 0
                    if (!shouldSummarize) return

                    const allMsgs = await prisma.inboxMessage.findMany({
                        where: { conversationId },
                        orderBy: { sentAt: 'asc' },
                        take: 50,
                        select: { direction: true, senderType: true, content: true },
                    })

                    const transcript = allMsgs
                        .map(m => `${m.direction === 'inbound' ? 'Customer' : (m.senderType === 'bot' ? 'Bot' : 'Agent')}: ${m.content}`)
                        .join('\n')

                    const summary = await callAI(
                        provider, apiKey, model,
                        'You are a conversation summarizer. Create a concise summary of this customer service conversation. Include: customer\'s main issue/question, key information exchanged, current status. Write in 2-4 sentences. Plain text only.',
                        `Summarize this conversation:\n${transcript}`
                    )

                    if (summary?.trim()) {
                        await prisma.conversation.update({
                            where: { id: conversationId },
                            data: { aiSummary: summary.trim() },
                        })
                        console.log(`[Bot Summary] ✅ Generated summary for conversation ${conversationId}`)
                    }
                } catch (err) {
                    console.error('[Bot Summary] ❌ Error:', err)
                }
            })
        }

        return { replied: true }
    } catch (err) {
        console.error('[Bot Auto-Reply] ❌ Error:', err)
        return { replied: false, reason: `Error: ${(err as Error).message}` }
    }
}

/**
 * Send reply via Facebook Graph API and save to DB
 */
async function sendAndSaveReply(
    conversation: any,
    text: string,
    platform: string,
    imageUrls?: string[],
    delayConfig?: { commentMinDelay: number; commentMaxDelay: number }
) {
    // Get platform account for access token
    const platformAccount = conversation.platformAccountId
        ? await prisma.channelPlatform.findUnique({
            where: { id: conversation.platformAccountId },
            select: { accessToken: true, accountId: true, config: true },
        })
        : null

    let botSentMessageId: string | undefined

    if (platform === 'facebook' && platformAccount?.accessToken) {
        const conversationType = conversation.type || 'message'

        if (conversationType === 'message') {
            // Dedup: prevent sending duplicate Messenger messages when same page is in multiple channels
            const dedupKey = conversation.externalUserId
            const lastSent = recentBotReplies.get(dedupKey)
            const now = Date.now()

            if (lastSent && (now - lastSent) < DEDUP_TTL_MS) {
                console.log(`[Bot] ⏭️ Skipping Messenger send (dedup) for ${dedupKey} - saving to DB only`)
            } else {
                recentBotReplies.set(dedupKey, now)
                if (recentBotReplies.size > 100) {
                    for (const [key, ts] of recentBotReplies) {
                        if (now - ts > DEDUP_TTL_MS) recentBotReplies.delete(key)
                    }
                }
                const result = await sendFacebookMessage(
                    platformAccount.accessToken,
                    conversation.externalUserId,
                    text,
                    imageUrls
                )
                // Capture message_id so we can save it as externalId (prevents echo duplicate in inbox)
                botSentMessageId = result.messageId

                // Auto-mark broken token for dashboard notification
                if (result.permissionError && conversation.platformAccountId) {
                    console.error(`[Bot] 🔴 Token permission error detected for platformAccount ${conversation.platformAccountId} — marking as needsReconnect`)
                    try {
                        await prisma.channelPlatform.update({
                            where: { id: conversation.platformAccountId },
                            data: { config: { ...(platformAccount.config as any || {}), needsReconnect: true, lastError: 'Permission denied', lastErrorAt: new Date().toISOString() } },
                        })
                    } catch (e) {
                        console.error(`[Bot] Failed to mark token as needsReconnect:`, e)
                    }
                }
            }
        }
    }

    // Instagram DM reply — sent via the backing Facebook Page's messaging endpoint
    if (platform === 'instagram' && platformAccount?.accessToken) {
        const conversationType = conversation.type || 'message'
        const pageId = (platformAccount.config as any)?.pageId

        if (conversationType === 'message' && pageId) {
            const dedupKey = `ig_${conversation.externalUserId}`
            const lastSent = recentBotReplies.get(dedupKey)
            const now = Date.now()

            if (lastSent && (now - lastSent) < DEDUP_TTL_MS) {
                console.log(`[Bot] ⏭️ Skipping IG DM send (dedup) for ${dedupKey} - saving to DB only`)
            } else {
                recentBotReplies.set(dedupKey, now)
                const result = await sendInstagramMessage(
                    platformAccount.accessToken,
                    pageId,
                    conversation.externalUserId,
                    text,
                    imageUrls
                )

                // Auto-mark broken token for dashboard notification
                if (result.permissionError && conversation.platformAccountId) {
                    console.error(`[Bot] 🔴 IG Token permission error for platformAccount ${conversation.platformAccountId} — marking as needsReconnect`)
                    try {
                        await prisma.channelPlatform.update({
                            where: { id: conversation.platformAccountId },
                            data: { config: { ...(platformAccount.config as any || {}), needsReconnect: true, lastError: 'Permission denied', lastErrorAt: new Date().toISOString() } },
                        })
                    } catch (e) {
                        console.error(`[Bot] Failed to mark IG token as needsReconnect:`, e)
                    }
                }
            }
        } else if (!pageId) {
            console.warn(`[Bot] ⚠️ No backing pageId found in config for IG account ${platformAccount.accountId}`)
        }
    }

    // ── COMMENT REPLIES (with human-like random delay) ──
    // For comments, we schedule the API call with a random delay (30s - 10min)
    // to appear more natural. The DB message is saved immediately below.
    const isComment = conversation.type === 'comment'

    if (isComment && platformAccount?.accessToken) {
        // Random delay between configured min and max (in seconds → ms)
        const minDelaySec = delayConfig?.commentMinDelay ?? 30
        const maxDelaySec = delayConfig?.commentMaxDelay ?? 600
        const minDelay = minDelaySec * 1000
        const maxDelay = maxDelaySec * 1000
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay
        const delaySec = Math.round(delay / 1000)

        // Find the most recent inbound comment to reply to
        const lastComment = await prisma.inboxMessage.findFirst({
            where: { conversationId: conversation.id, direction: 'inbound' },
            orderBy: { sentAt: 'desc' },
            select: { externalId: true },
        })

        if (lastComment?.externalId) {
            const token = platformAccount.accessToken
            const commentExternalId = lastComment.externalId

            if (platform === 'facebook') {
                console.log(`[Bot] ⏱️ FB comment reply scheduled in ${delaySec}s`)
                setTimeout(async () => {
                    try {
                        const res = await fetch(
                            `https://graph.facebook.com/v19.0/${commentExternalId}/comments?access_token=${token}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ message: text }),
                            }
                        )
                        const data = await res.json()
                        if (data.error) {
                            console.error(`[Bot] ❌ FB comment reply failed:`, JSON.stringify(data.error))
                        } else {
                            console.log(`[Bot] ✅ FB comment reply posted (after ${delaySec}s delay)`)
                        }
                    } catch (err) {
                        console.error('[Bot] ❌ FB comment reply error:', err)
                    }
                }, delay)
            }

            if (platform === 'instagram') {
                const pageId = (platformAccount.config as any)?.pageId
                if (pageId) {
                    console.log(`[Bot] ⏱️ IG comment reply scheduled in ${delaySec}s`)
                    setTimeout(async () => {
                        try {
                            const res = await fetch(
                                `https://graph.facebook.com/v19.0/${commentExternalId}/replies?access_token=${token}`,
                                {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ message: text }),
                                }
                            )
                            const data = await res.json()
                            if (data.error) {
                                console.error(`[Bot] ❌ IG comment reply failed:`, JSON.stringify(data.error))
                            } else {
                                console.log(`[Bot] ✅ IG comment reply posted (after ${delaySec}s delay)`)
                            }
                        } catch (err) {
                            console.error('[Bot] ❌ IG comment reply error:', err)
                        }
                    }, delay)
                }
            }

            if (platform === 'youtube') {
                console.log(`[Bot] ⏱️ YT comment reply scheduled in ${delaySec}s`)
                setTimeout(async () => {
                    try {
                        await replyToYouTubeComment(token, commentExternalId, text)
                    } catch (err) {
                        console.error('[Bot] ❌ YouTube comment reply error:', err)
                    }
                }, delay)
            }

            if (platform === 'tiktok') {
                const metadata = conversation.metadata as any
                const videoId = metadata?.videoId
                const commentId = commentExternalId.replace(/^tt_/, '')
                if (videoId && commentId) {
                    console.log(`[Bot] ⏱️ TT comment reply scheduled in ${delaySec}s`)
                    setTimeout(async () => {
                        try {
                            await replyToTikTokComment(token, videoId, commentId, text)
                        } catch (err) {
                            console.error('[Bot] ❌ TikTok comment reply error:', err)
                        }
                    }, delay)
                }
            }
        }
    }

    // Save outbound message to DB (with FB message_id as externalId to prevent echo duplicates)
    const fbMessageId = platform === 'facebook' || platform === 'instagram' ? (botSentMessageId || null) : null
    await prisma.inboxMessage.create({
        data: {
            conversationId: conversation.id,
            direction: 'outbound',
            senderType: 'bot',
            content: text,
            senderName: 'Bot',
            mediaUrl: imageUrls?.[0] || null,
            mediaType: imageUrls?.[0] ? 'image' : null,
            externalId: fbMessageId,
            sentAt: new Date(),
        },
    })
}

/**
 * Send a message via Facebook Messenger Send API
 */
async function sendFacebookMessage(
    accessToken: string,
    recipientId: string,
    text: string,
    imageUrls?: string[]
): Promise<{ sent: boolean; permissionError: boolean; messageId?: string }> {
    const apiUrl = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`
    let sent = false
    let permissionError = false

    let messageId: string | undefined

    // Send text message
    if (text) {
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text },
                }),
            })
            const data = await res.json()
            if (data.error) {
                console.error(`[FB Send] ❌ Text send failed for ${recipientId}:`, JSON.stringify(data.error))
                if (data.error.code === 190 || data.error.code === 10 || data.error.type === 'OAuthException') {
                    permissionError = true
                }
            } else {
                console.log(`[FB Send] ✅ Message sent to ${recipientId} (msg_id: ${data.message_id || 'unknown'})`)
                sent = true
                messageId = data.message_id || undefined
            }
        } catch (err) {
            console.error(`[FB Send] ❌ Network error sending to ${recipientId}:`, err)
        }
    }

    // Send images — each as individual attachment (shows full image, no crop)
    // Sent in parallel via Promise.all to minimize total send time
    if (imageUrls?.length) {
        await Promise.all(imageUrls.map(async (url, i) => {
            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: { id: recipientId },
                        message: {
                            attachment: {
                                type: 'image',
                                payload: { url, is_reusable: true },
                            },
                        },
                    }),
                })
                const data = await res.json()
                if (data.error) {
                    console.error(`[FB Send] ❌ Image ${i + 1} send failed:`, JSON.stringify(data.error))
                    if (data.error.code === 190 || data.error.code === 10 || data.error.type === 'OAuthException') {
                        permissionError = true
                    }
                } else {
                    console.log(`[FB Send] ✅ Image ${i + 1}/${imageUrls.length} sent to ${recipientId}`)
                }
            } catch (err) {
                console.error(`[FB Send] ❌ Image ${i + 1} network error:`, err)
            }
        }))
    }

    return { sent, permissionError, messageId }
}

/**
 * Send a message via Instagram through the backing Facebook Page's messaging endpoint
 * Uses graph.facebook.com/{pageId}/messages with the Page Access Token
 */
async function sendInstagramMessage(
    accessToken: string,
    pageId: string,
    recipientId: string,
    text: string,
    imageUrls?: string[]
): Promise<{ sent: boolean; permissionError: boolean }> {
    const apiUrl = `https://graph.facebook.com/v21.0/${pageId}/messages?access_token=${accessToken}`
    let sent = false
    let permissionError = false

    // Send text message
    if (text) {
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text },
                }),
            })
            const data = await res.json()
            if (data.error) {
                console.error(`[IG Send] ❌ Text send failed:`, JSON.stringify(data.error))
                if (data.error.code === 190 || data.error.code === 10 || data.error.type === 'OAuthException') {
                    permissionError = true
                }
            } else {
                console.log(`[IG Send] ✅ DM sent to ${recipientId}`)
                sent = true
            }
        } catch (err) {
            console.error(`[IG Send] ❌ Network error sending to ${recipientId}:`, err)
        }
    }

    // Send images
    if (imageUrls?.length) {
        for (const url of imageUrls) {
            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: { id: recipientId },
                        message: {
                            attachment: {
                                type: 'image',
                                payload: { url },
                            },
                        },
                    }),
                })
                const data = await res.json()
                if (data.error) {
                    console.error(`[IG Send] ❌ Image send failed:`, JSON.stringify(data.error))
                    if (data.error.code === 190 || data.error.code === 10 || data.error.type === 'OAuthException') {
                        permissionError = true
                    }
                }
            } catch (err) {
                console.error(`[IG Send] ❌ Image network error:`, err)
            }
        }
    }

    return { sent, permissionError }
}


/**
 * Send sender action (typing indicator, read receipt)
 */
async function sendSenderAction(
    accessToken: string,
    recipientId: string,
    action: 'typing_on' | 'typing_off' | 'mark_seen'
) {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            sender_action: action,
        }),
    })
}

/**
 * Reply to a YouTube comment via YouTube Data API v3
 */
async function replyToYouTubeComment(
    accessToken: string,
    parentCommentId: string,
    text: string
) {
    const res = await fetch(
        `https://www.googleapis.com/youtube/v3/comments?part=snippet`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                snippet: {
                    parentId: parentCommentId,
                    textOriginal: text,
                },
            }),
        }
    )

    if (!res.ok) {
        const errText = await res.text()
        console.error('[YT] Comment reply failed:', errText)
    } else {
        console.log(`[YT] ✅ Replied to comment ${parentCommentId}`)
    }
}

/**
 * Reply to a TikTok comment via TikTok API v2
 */
async function replyToTikTokComment(
    accessToken: string,
    videoId: string,
    commentId: string,
    text: string
) {
    const res = await fetch(
        'https://open.tiktokapis.com/v2/video/comment/reply/create/',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                video_id: videoId,
                comment_id: commentId,
                text,
            }),
        }
    )

    if (!res.ok) {
        const errText = await res.text()
        console.error('[TT] Comment reply failed:', errText)
    } else {
        console.log(`[TT] ✅ Replied to comment ${commentId}`)
    }
}

/**
 * Send greeting message when a new conversation starts in BOT mode
 */
export async function sendBotGreeting(
    conversationId: string,
    platform: string
) {
    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                channel: { select: { id: true, vibeTone: true, businessInfo: true } },
            },
        })

        if (!conversation?.channel) return

        const botConfig = await prisma.botConfig.findUnique({
            where: { channelId: conversation.channel.id },
        })

        if (!botConfig?.isEnabled) return

        // Per-page toggle only controls default mode for NEW conversations.
        // Greeting is only sent for NEW conversations, so per-page check is
        // already handled by upsertConversation setting mode=AGENT.

        const greetingMode = (botConfig as any).greetingMode || 'template'
        const greetingImages = (botConfig.greetingImages as string[]) || []
        let greetingText = botConfig.greeting || ''

        // Auto mode: generate greeting via AI
        if (greetingMode === 'auto') {
            try {
                const ownerKey = await getChannelOwnerKey(conversation.channel.id)
                if (ownerKey.apiKey) {
                    const vibeTone = (conversation.channel as any).vibeTone || ''
                    const businessInfo = (conversation.channel as any).businessInfo || ''
                    const prompt = `Generate a brief, friendly greeting message for a customer who just started a chat. 
Bot name: ${botConfig.botName || 'AI Assistant'}
${vibeTone ? `Brand voice/tone: ${vibeTone}` : ''}
${businessInfo ? `Business: ${businessInfo}` : ''}
${botConfig.personality ? `Personality: ${botConfig.personality}` : ''}
Language: ${botConfig.language || 'vi'}
Keep it short (1-2 sentences), warm, and professional. Reply with ONLY the greeting text.`
                    greetingText = await callAI(
                        ownerKey.provider!, ownerKey.apiKey!, ownerKey.model || getDefaultModel(ownerKey.provider || 'openai', {}),
                        'You are a greeting message generator. Reply with ONLY the greeting text, no JSON, no quotes, no formatting.', prompt
                    )
                    greetingText = greetingText.trim()
                    // Strip markdown code fences
                    greetingText = greetingText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
                    // Strip JSON wrapper: {"greeting": "..."}, ["text1", "text2"], etc.
                    if ((greetingText.startsWith('{') && greetingText.endsWith('}')) ||
                        (greetingText.startsWith('[') && greetingText.endsWith(']'))) {
                        try {
                            const parsed = JSON.parse(greetingText)
                            if (Array.isArray(parsed)) {
                                // Take first string from array
                                const first = parsed.find((item: any) => typeof item === 'string')
                                if (first) greetingText = first
                            } else if (typeof parsed === 'object') {
                                greetingText = parsed.greeting || parsed.message || parsed.text || parsed.content || Object.values(parsed)[0] as string || greetingText
                            }
                        } catch { /* not valid JSON, use as-is */ }
                    }
                    // Strip surrounding quotes
                    if ((greetingText.startsWith('"') && greetingText.endsWith('"')) ||
                        (greetingText.startsWith("'") && greetingText.endsWith("'"))) {
                        greetingText = greetingText.slice(1, -1)
                    }
                }
            } catch (err) {
                console.error('[Bot Greeting] AI greeting failed, using fallback:', err)
            }
            if (!greetingText) greetingText = `Xin chào! Tôi là ${botConfig.botName || 'AI Assistant'}. Tôi có thể giúp gì cho bạn?`
        }

        if (!greetingText) return

        await sendAndSaveReply(
            conversation,
            greetingText,
            platform,
            greetingImages.length > 0 ? greetingImages : undefined
        )

        console.log(`[Bot Greeting] ✅ Sent ${greetingMode} greeting for conversation ${conversationId}`)
    } catch (err) {
        console.error('[Bot Greeting] ❌ Error:', err)
    }
}
