import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai-caller'
import { decrypt } from '@/lib/encryption'

const BATCH_SIZE = 5 // process up to 5 jobs per cron invocation

/**
 * POST /api/cron/process-content-jobs
 * Called by cron (e.g. Vercel Cron or external service) every 1-2 minutes.
 * Picks up QUEUED ContentJobs and processes them:
 *   1. Analyse media via AI Vision
 *   2. Generate caption based on brand guidelines
 *   3. Schedule post at preferred time
 */
export async function POST() {
    try {
        // Pick up QUEUED jobs
        const jobs = await prisma.contentJob.findMany({
            where: { status: 'QUEUED' },
            include: {
                channel: {
                    select: {
                        id: true,
                        displayName: true,
                        language: true,
                        timezone: true,
                        defaultAiProvider: true,
                        defaultAiModel: true,
                        aiApiKeyEncrypted: true,
                        brandProfile: true,
                        businessInfo: true,
                        pipelineFrequency: true,
                        pipelineApprovalMode: true,
                        pipelinePostingTimes: true,
                    },
                },
                mediaItem: {
                    select: {
                        id: true,
                        url: true,
                        type: true,
                        originalName: true,
                        mimeType: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
            take: BATCH_SIZE,
        })

        if (jobs.length === 0) {
            return NextResponse.json({ processed: 0, message: 'No queued jobs' })
        }

        // Mark picked jobs as PROCESSING
        await prisma.contentJob.updateMany({
            where: { id: { in: jobs.map(j => j.id) } },
            data: { status: 'PROCESSING' },
        })

        const results: Array<{ jobId: string; status: string; postId?: string; error?: string }> = []

        for (const job of jobs) {
            try {
                const { channel, mediaItem } = job

                // Resolve AI API key: channel key → uploader's key → channel admin's key
                // NEVER use global API integration — only admin's own keys
                let apiKey: string
                let provider: string
                let model: string

                if (channel.aiApiKeyEncrypted) {
                    // 1) Channel has its own AI key
                    apiKey = decrypt(channel.aiApiKeyEncrypted)
                    provider = channel.defaultAiProvider || 'gemini'
                    model = channel.defaultAiModel || 'gemini-2.0-flash'
                } else {
                    // 2) Try uploader's personal API key
                    let userApiKey = null
                    if (job.uploadedBy) {
                        const uploader = await prisma.user.findUnique({
                            where: { email: job.uploadedBy },
                            select: { id: true },
                        })
                        if (uploader) {
                            if (channel.defaultAiProvider) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: uploader.id, provider: channel.defaultAiProvider, isActive: true },
                                })
                            }
                            if (!userApiKey) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: uploader.id, isDefault: true, isActive: true },
                                })
                            }
                            if (!userApiKey) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: uploader.id, isActive: true },
                                    orderBy: { provider: 'asc' },
                                })
                            }
                        }
                    }

                    // 3) Try channel admin's API key
                    if (!userApiKey) {
                        const admin = await prisma.channelMember.findFirst({
                            where: { channelId: channel.id, role: 'ADMIN' },
                            select: { userId: true },
                        })
                        if (admin) {
                            if (channel.defaultAiProvider) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: admin.userId, provider: channel.defaultAiProvider, isActive: true },
                                })
                            }
                            if (!userApiKey) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: admin.userId, isDefault: true, isActive: true },
                                })
                            }
                            if (!userApiKey) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: admin.userId, isActive: true },
                                    orderBy: { provider: 'asc' },
                                })
                            }
                        }
                    }

                    if (!userApiKey) {
                        throw new Error('No AI API key found — channel admin cần setup AI key trong AI Providers')
                    }

                    apiKey = decrypt(userApiKey.apiKeyEncrypted)
                    provider = userApiKey.provider
                    model = channel.defaultAiModel || userApiKey.defaultModel || 'gemini-2.0-flash'
                }

                const lang = channel.language || 'vi'
                const brandProfile = (channel.brandProfile as Record<string, string>) || {}
                const businessInfo = (channel.businessInfo as Record<string, string>) || {}

                // ─── Step 1: Analyze image via AI Vision ─────────────
                const analysisPrompt = buildAnalysisPrompt(mediaItem.url, mediaItem.type)
                let aiAnalysis = ''
                try {
                    aiAnalysis = await callAIWithVision(
                        provider, apiKey, model,
                        'You are an expert image/video analyst for social media. Describe what you see in detail, noting the mood, colors, subjects, setting, and any text visible.',
                        analysisPrompt,
                        mediaItem.url,
                    )
                } catch (analysisErr) {
                    console.warn(`[Pipeline] Vision analysis failed, using fallback:`, analysisErr)
                    aiAnalysis = `Image: ${mediaItem.originalName || 'Uploaded media'}. Type: ${mediaItem.type}.`
                }

                // ─── Step 2: Generate caption ────────────────────────
                const captionSystemPrompt = buildCaptionSystemPrompt(lang, brandProfile, businessInfo)
                const captionUserPrompt = buildCaptionUserPrompt(aiAnalysis, lang)

                const aiCaption = await callAI(
                    provider, apiKey, model,
                    captionSystemPrompt,
                    captionUserPrompt,
                )

                // ─── Step 3: Smart scheduling ────────────────────────
                const scheduledAt = await findNextAvailableSlot(
                    channel.id,
                    channel.pipelineFrequency,
                    (channel.pipelinePostingTimes as string[]) || ['19:00'],
                    channel.timezone || 'Asia/Ho_Chi_Minh',
                )

                // ─── Step 4: Determine post status based on approval mode ──
                let postStatus: 'SCHEDULED' | 'PENDING_APPROVAL' = 'SCHEDULED'
                if (channel.pipelineApprovalMode === 'admin' || channel.pipelineApprovalMode === 'client') {
                    postStatus = 'PENDING_APPROVAL'
                }

                // ─── Step 5: Get admin author ────────────────────────
                const admin = await prisma.channelMember.findFirst({
                    where: { channelId: channel.id, role: 'ADMIN' },
                    select: { userId: true },
                })
                if (!admin) throw new Error('No admin found for channel')

                // ─── Step 6: Get active platforms ────────────────────
                const platforms = await prisma.channelPlatform.findMany({
                    where: { channelId: channel.id, isActive: true },
                    select: { platform: true, accountId: true },
                })

                // ─── Step 7: Create post ─────────────────────────────
                const post = await prisma.post.create({
                    data: {
                        channelId: channel.id,
                        authorId: admin.userId,
                        content: aiCaption,
                        status: postStatus,
                        scheduledAt,
                        media: {
                            create: {
                                mediaItemId: mediaItem.id,
                                sortOrder: 0,
                            },
                        },
                        platformStatuses: platforms.length > 0 ? {
                            create: platforms.map(p => ({
                                platform: p.platform,
                                accountId: p.accountId,
                                status: 'pending',
                            })),
                        } : undefined,
                    },
                })

                // ─── Step 8: Update ContentJob as COMPLETED ──────────
                await prisma.contentJob.update({
                    where: { id: job.id },
                    data: {
                        status: 'COMPLETED',
                        aiCaption,
                        aiAnalysis: { analysis: aiAnalysis },
                        postId: post.id,
                        processedAt: new Date(),
                    },
                })

                results.push({ jobId: job.id, status: 'COMPLETED', postId: post.id })
                console.log(`[Pipeline] ✅ Job ${job.id} → Post ${post.id} (${postStatus})`)

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error)
                console.error(`[Pipeline] ❌ Job ${job.id} failed:`, errorMsg)

                await prisma.contentJob.update({
                    where: { id: job.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: errorMsg,
                        processedAt: new Date(),
                    },
                })
                results.push({ jobId: job.id, status: 'FAILED', error: errorMsg })
            }
        }

        return NextResponse.json({
            processed: results.length,
            results,
        })
    } catch (error) {
        console.error('[Pipeline] Fatal error:', error)
        return NextResponse.json({ error: 'Pipeline processing failed' }, { status: 500 })
    }
}

// ─── Helper: Build analysis prompt ──────────────────────────────────
function buildAnalysisPrompt(url: string, type: string): string {
    return `Analyze this ${type} and describe:
1. What is shown (subjects, objects, people)
2. The mood/atmosphere
3. Colors and visual style
4. Any text visible in the image
5. Suggested social media angles

Media URL: ${url}`
}

// ─── Helper: AI Vision call (with image URL) ────────────────────────
async function callAIWithVision(
    provider: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    imageUrl: string,
): Promise<string> {
    // Download the image and convert to base64
    let imageBase64 = ''
    let imageMimeType = 'image/jpeg'
    try {
        const imgRes = await fetch(imageUrl)
        if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer()
            imageBase64 = Buffer.from(buffer).toString('base64')
            imageMimeType = imgRes.headers.get('content-type') || 'image/jpeg'
        }
    } catch (e) {
        console.warn('[Pipeline] Could not download image for vision:', e)
    }

    if (provider === 'gemini') {
        const visionModel = model.includes('flash') ? model : 'gemini-2.0-flash'
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent?key=${apiKey}`

        // Build parts: text + image (base64 inlineData)
        const parts: Array<Record<string, unknown>> = [
            { text: userPrompt },
        ]
        if (imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: imageMimeType,
                    data: imageBase64,
                },
            })
        } else {
            // Fallback: just mention URL in text
            parts[0] = { text: `${userPrompt}\n\nImage URL: ${imageUrl}` }
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts }],
                generationConfig: { temperature: 0.7 },
            }),
        })

        if (!res.ok) {
            const errBody = await res.text().catch(() => '')
            throw new Error(`Gemini Vision failed (${res.status}): ${errBody.slice(0, 200)}`)
        }

        const data = await res.json()
        return data.candidates[0].content.parts[0].text
    }

    // OpenAI-compatible vision (OpenAI, OpenRouter)
    const baseUrls: Record<string, string> = {
        openai: 'https://api.openai.com/v1',
        openrouter: 'https://openrouter.ai/api/v1',
    }
    const baseUrl = baseUrls[provider] || 'https://api.openai.com/v1'

    // Prefer base64 data URL for reliability, fallback to HTTP URL
    const imageContent = imageBase64
        ? { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } }
        : { type: 'image_url', image_url: { url: imageUrl } }

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        imageContent,
                    ],
                },
            ],
            temperature: 0.7,
        }),
    })

    if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(`Vision API error (${res.status}): ${errBody.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.choices[0].message.content
}

// ─── Helper: Caption system prompt ──────────────────────────────────
function buildCaptionSystemPrompt(
    lang: string,
    brandProfile: Record<string, string>,
    businessInfo: Record<string, string>,
): string {
    const langLabel = lang === 'vi' ? 'Vietnamese' : lang === 'en' ? 'English' : lang
    const parts = [
        `You are a professional social media copywriter. Write captivating posts in ${langLabel}.`,
        `Always write the caption in ${langLabel} language.`,
    ]

    if (brandProfile.communicationStyle) {
        parts.push(`Communication style: ${brandProfile.communicationStyle}`)
    }
    if (brandProfile.targetAudience) {
        parts.push(`Target audience: ${brandProfile.targetAudience}`)
    }
    if (brandProfile.brandValues) {
        parts.push(`Brand values: ${brandProfile.brandValues}`)
    }
    if (businessInfo.name) {
        parts.push(`Business name: ${businessInfo.name}`)
    }

    parts.push(
        'Rules:',
        '- Write a compelling caption (100-300 characters)',
        '- Include relevant emojis naturally',
        '- Add a call-to-action when appropriate',
        '- Include 3-5 relevant hashtags at the end',
        '- Do NOT include pricing or specific product details unless visible in the image',
        '- Return ONLY the caption text, no explanations',
    )

    return parts.join('\n')
}

// ─── Helper: Caption user prompt ─────────────────────────────────
function buildCaptionUserPrompt(aiAnalysis: string, lang: string): string {
    const langLabel = lang === 'vi' ? 'tiếng Việt' : lang === 'en' ? 'English' : lang
    return `Based on this image analysis, write a social media caption in ${langLabel}:

${aiAnalysis}

Write an engaging caption that would make people stop scrolling. Return ONLY the caption text.`
}

// ─── Helper: Smart scheduling ─────────────────────────────────────
async function findNextAvailableSlot(
    channelId: string,
    frequency: string,
    preferredTimes: string[],
    timezone: string,
): Promise<Date> {
    // Get the most recent scheduled/published post for this channel
    const lastPost = await prisma.post.findFirst({
        where: {
            channelId,
            status: { in: ['SCHEDULED', 'PUBLISHED', 'PENDING_APPROVAL'] },
        },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
    })

    // Parse frequency to determine minimum gap between posts
    const frequencyGaps: Record<string, number> = {
        '1_per_day': 24,
        '2_per_day': 12,
        '3_per_week': 56, // ~2.3 days
        '5_per_week': 34, // ~1.4 days
        '1_per_week': 168, // 7 days
    }
    const gapHours = frequencyGaps[frequency] || 24

    const now = new Date()
    let candidateDate = new Date(now)

    // If there's a recent post, start from gap hours after it
    if (lastPost?.scheduledAt && lastPost.scheduledAt > now) {
        candidateDate = new Date(lastPost.scheduledAt.getTime() + gapHours * 60 * 60 * 1000)
    } else {
        // Start from tomorrow if we're past all preferred times today
        candidateDate = new Date(now.getTime() + 2 * 60 * 60 * 1000) // at least 2h from now
    }

    // Find the next preferred time slot
    if (preferredTimes.length > 0) {
        for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
            const checkDate = new Date(candidateDate)
            checkDate.setDate(checkDate.getDate() + dayOffset)

            for (const timeStr of preferredTimes.sort()) {
                const [hours, minutes] = timeStr.split(':').map(Number)
                const slotDate = new Date(checkDate)
                slotDate.setHours(hours, minutes, 0, 0)

                // Must be in the future and respect the gap
                if (slotDate > now && slotDate >= candidateDate) {
                    // Check no existing post at this exact time
                    const existing = await prisma.post.count({
                        where: {
                            channelId,
                            scheduledAt: {
                                gte: new Date(slotDate.getTime() - 30 * 60 * 1000), // 30 min window
                                lte: new Date(slotDate.getTime() + 30 * 60 * 1000),
                            },
                            status: { in: ['SCHEDULED', 'PUBLISHED', 'PENDING_APPROVAL'] },
                        },
                    })
                    if (existing === 0) return slotDate
                }
            }
        }
    }

    // Fallback: schedule 24h from now at 19:00
    const fallback = new Date(now)
    fallback.setDate(fallback.getDate() + 1)
    fallback.setHours(19, 0, 0, 0)
    return fallback
}
