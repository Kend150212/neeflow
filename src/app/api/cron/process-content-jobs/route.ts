import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai-caller'
import { decrypt } from '@/lib/encryption'
import sharp from 'sharp'
import { uploadToR2, generateR2Key } from '@/lib/r2'

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

                console.log(`[Pipeline] Job ${job.id}: channelProvider=${channel.defaultAiProvider}, uploadedBy=${job.uploadedBy}, hasChannelKey=${!!channel.aiApiKeyEncrypted}`)

                if (channel.aiApiKeyEncrypted) {
                    // 1) Channel has its own AI key
                    apiKey = decrypt(channel.aiApiKeyEncrypted)
                    provider = channel.defaultAiProvider || 'gemini'
                    model = channel.defaultAiModel || 'gemini-2.0-flash'
                    console.log(`[Pipeline] Using channel's own AI key, provider=${provider}`)
                } else {
                    // 2) Try uploader's personal API key
                    let userApiKey = null
                    if (job.uploadedBy) {
                        const uploader = await prisma.user.findUnique({
                            where: { email: job.uploadedBy },
                            select: { id: true },
                        })
                        console.log(`[Pipeline] Uploader lookup: email=${job.uploadedBy}, found=${!!uploader}, userId=${uploader?.id}`)
                        if (uploader) {
                            // List all their keys for debugging
                            const allKeys = await prisma.userApiKey.findMany({
                                where: { userId: uploader.id },
                                select: { provider: true, isActive: true, isDefault: true },
                            })
                            console.log(`[Pipeline] Uploader's API keys:`, JSON.stringify(allKeys))

                            if (channel.defaultAiProvider) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: uploader.id, provider: channel.defaultAiProvider, isActive: true },
                                })
                                console.log(`[Pipeline] Provider match (${channel.defaultAiProvider}): found=${!!userApiKey}`)
                            }
                            if (!userApiKey) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: uploader.id, isDefault: true, isActive: true },
                                })
                                console.log(`[Pipeline] Default key: found=${!!userApiKey}`)
                            }
                            if (!userApiKey) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: uploader.id, isActive: true },
                                    orderBy: { provider: 'asc' },
                                })
                                console.log(`[Pipeline] Any active key: found=${!!userApiKey}`)
                            }
                        }
                    } else {
                        console.log(`[Pipeline] No uploadedBy on job`)
                    }

                    // 3) Try channel owner/admin's API key
                    if (!userApiKey) {
                        const owner = await prisma.channelMember.findFirst({
                            where: { channelId: channel.id, role: { in: ['OWNER', 'ADMIN'] } },
                            select: { userId: true, role: true },
                        })
                        console.log(`[Pipeline] Owner/Admin lookup: channelId=${channel.id}, found=${!!owner}, userId=${owner?.userId}, role=${owner?.role}`)
                        if (owner) {
                            const ownerKeys = await prisma.userApiKey.findMany({
                                where: { userId: owner.userId },
                                select: { provider: true, isActive: true, isDefault: true },
                            })
                            console.log(`[Pipeline] Owner's API keys:`, JSON.stringify(ownerKeys))

                            if (channel.defaultAiProvider) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: owner.userId, provider: channel.defaultAiProvider, isActive: true },
                                })
                            }
                            if (!userApiKey) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: owner.userId, isDefault: true, isActive: true },
                                })
                            }
                            if (!userApiKey) {
                                userApiKey = await prisma.userApiKey.findFirst({
                                    where: { userId: owner.userId, isActive: true },
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
                    console.log(`[Pipeline] ✅ Using key: provider=${provider}, model=${model}`)
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
                if (channel.pipelineApprovalMode === 'admin' || channel.pipelineApprovalMode === 'client' || channel.pipelineApprovalMode === 'smartflow') {
                    postStatus = 'PENDING_APPROVAL'
                }

                // ─── Step 4b: Detect media dimensions for platform matching ──
                let mediaDimensions: { width: number; height: number; aspectRatio: string } | null = null
                try {
                    if (mediaItem.type === 'image' || mediaItem.type === 'photo') {
                        const headRes = await fetch(mediaItem.url, { method: 'GET', headers: { Range: 'bytes=0-65535' } })
                        if (headRes.ok) {
                            const buf = Buffer.from(await headRes.arrayBuffer())
                            const dims = parseImageDimensions(buf)
                            if (dims) {
                                const ratio = dims.width / dims.height
                                let aspectRatio = 'other'
                                if (ratio >= 0.95 && ratio <= 1.05) aspectRatio = '1:1'
                                else if (ratio >= 0.75 && ratio <= 0.85) aspectRatio = '4:5'
                                else if (ratio >= 0.55 && ratio <= 0.58) aspectRatio = '9:16'
                                else if (ratio >= 1.7 && ratio <= 1.8) aspectRatio = '16:9'
                                else if (ratio > 1.05) aspectRatio = 'landscape'
                                else aspectRatio = 'portrait'
                                mediaDimensions = { width: dims.width, height: dims.height, aspectRatio }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[Pipeline] Could not detect media dimensions:', e)
                }

                // Auto-recommend platforms based on aspect ratio
                const recommendedPlatforms = getRecommendedPlatforms(mediaDimensions?.aspectRatio || 'other')

                // ─── Step 5: Get channel owner as author ─────────────
                const authorMember = await prisma.channelMember.findFirst({
                    where: { channelId: channel.id, role: { in: ['OWNER', 'ADMIN'] } },
                    select: { userId: true },
                })
                if (!authorMember) throw new Error('No owner/admin found for channel')

                // ─── Step 6: Get active platforms ────────────────────
                const platforms = await prisma.channelPlatform.findMany({
                    where: { channelId: channel.id, isActive: true },
                    select: { platform: true, accountId: true },
                })

                // Filter platforms by recommendation (if dimensions detected)
                const filteredPlatforms = mediaDimensions
                    ? platforms.filter(p => recommendedPlatforms.includes(p.platform.toLowerCase()))
                    : platforms

                // ─── Step 6b: Server-side auto-crop per platform ─────
                const croppedUrls: Record<string, string> = {} // platform → cropped URL
                if (mediaDimensions && (mediaItem.type === 'image' || mediaItem.type === 'photo')) {
                    try {
                        const imgRes = await fetch(mediaItem.url)
                        if (imgRes.ok) {
                            const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
                            const { width, height } = mediaDimensions

                            for (const p of filteredPlatforms) {
                                const pName = p.platform.toLowerCase()
                                // Skip TikTok for images
                                if (pName === 'tiktok') continue

                                const targetRatio = getPlatformOptimalRatio(pName)
                                if (!targetRatio) continue

                                const currentRatio = width / height
                                // Skip if already within 5% of target
                                if (Math.abs(currentRatio - targetRatio) / targetRatio < 0.05) continue

                                try {
                                    // Calculate crop dimensions (center crop)
                                    let cropW = width
                                    let cropH = height
                                    if (currentRatio > targetRatio) {
                                        // Too wide → crop width
                                        cropW = Math.round(height * targetRatio)
                                    } else {
                                        // Too tall → crop height
                                        cropH = Math.round(width / targetRatio)
                                    }
                                    const left = Math.round((width - cropW) / 2)
                                    const top = Math.round((height - cropH) / 2)

                                    const cropped = await sharp(imgBuffer)
                                        .extract({ left, top, width: cropW, height: cropH })
                                        .jpeg({ quality: 90 })
                                        .toBuffer()

                                    // Upload to R2
                                    const r2Key = generateR2Key(channel.id, `${pName}-crop.jpg`)
                                    const croppedUrl = await uploadToR2(cropped, r2Key, 'image/jpeg')
                                    croppedUrls[pName] = croppedUrl
                                    console.log(`[Pipeline] Auto-cropped for ${pName}: ${width}x${height} → ${cropW}x${cropH} (ratio ${targetRatio})`)
                                } catch (cropErr) {
                                    console.warn(`[Pipeline] Auto-crop failed for ${pName}:`, cropErr)
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[Pipeline] Auto-crop download failed:', e)
                    }
                }

                // ─── Step 7: Create post ─────────────────────────────
                const post = await prisma.post.create({
                    data: {
                        channelId: channel.id,
                        authorId: authorMember.userId,
                        content: aiCaption,
                        status: postStatus,
                        scheduledAt,
                        metadata: mediaDimensions ? {
                            mediaDimensions,
                            recommendedPlatforms,
                            allConnectedPlatforms: platforms.map(p => p.platform),
                            croppedUrls: Object.keys(croppedUrls).length > 0 ? croppedUrls : undefined,
                        } : undefined,
                        media: {
                            create: {
                                mediaItemId: mediaItem.id,
                                sortOrder: 0,
                            },
                        },
                        platformStatuses: filteredPlatforms.length > 0 ? {
                            create: filteredPlatforms.map(p => {
                                const pName = p.platform.toLowerCase()
                                const isSkipped = pName === 'tiktok' && (mediaItem.type === 'image' || mediaItem.type === 'photo')
                                return {
                                    platform: p.platform,
                                    accountId: p.accountId,
                                    status: isSkipped ? 'skipped' : 'pending',
                                    // Store cropped image URL in config
                                    ...(croppedUrls[pName] ? { config: { croppedUrl: croppedUrls[pName] } } : {}),
                                }
                            }),
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

// ─── Helper: Parse image dimensions from buffer header ────────────
function parseImageDimensions(buf: Buffer): { width: number; height: number } | null {
    try {
        // PNG: width at offset 16, height at offset 20 (big-endian uint32)
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
            const width = buf.readUInt32BE(16)
            const height = buf.readUInt32BE(20)
            return { width, height }
        }
        // JPEG: scan for SOF markers
        if (buf[0] === 0xFF && buf[1] === 0xD8) {
            let offset = 2
            while (offset < buf.length - 10) {
                if (buf[offset] !== 0xFF) { offset++; continue }
                const marker = buf[offset + 1]
                // SOF0, SOF1, SOF2
                if (marker >= 0xC0 && marker <= 0xC2) {
                    const height = buf.readUInt16BE(offset + 5)
                    const width = buf.readUInt16BE(offset + 7)
                    return { width, height }
                }
                const segLen = buf.readUInt16BE(offset + 2)
                offset += 2 + segLen
            }
        }
        // WebP
        if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
            if (buf.toString('ascii', 12, 16) === 'VP8 ') {
                const width = buf.readUInt16LE(26) & 0x3FFF
                const height = buf.readUInt16LE(28) & 0x3FFF
                return { width, height }
            }
        }
    } catch {
        // Ignore parse errors
    }
    return null
}

// ─── Helper: Recommend platforms based on aspect ratio ────────────
function getRecommendedPlatforms(aspectRatio: string): string[] {
    const map: Record<string, string[]> = {
        '1:1': ['facebook', 'instagram', 'twitter', 'threads', 'linkedin'],
        '4:5': ['facebook', 'instagram', 'twitter', 'threads', 'linkedin'],
        '9:16': ['facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'threads'],
        '16:9': ['facebook', 'youtube', 'twitter', 'linkedin', 'threads'],
        'portrait': ['facebook', 'instagram', 'twitter', 'threads', 'tiktok'],
        'landscape': ['facebook', 'youtube', 'twitter', 'linkedin', 'threads'],
        'other': ['facebook', 'instagram', 'twitter', 'threads', 'youtube', 'tiktok', 'linkedin'],
    }
    return map[aspectRatio] || map['other']
}

// ─── Helper: Optimal aspect ratio per platform (width/height) ─────
function getPlatformOptimalRatio(platform: string): number | null {
    const ratios: Record<string, number> = {
        instagram: 4 / 5,       // 0.8  — portrait feed
        facebook: 1,             // 1.0  — square
        youtube: 16 / 9,         // 1.78 — landscape
        twitter: 16 / 9,         // 1.78 — landscape
        threads: 1,              // 1.0  — square
        linkedin: 16 / 9,        // 1.78 — landscape
    }
    return ratios[platform] ?? null
}
