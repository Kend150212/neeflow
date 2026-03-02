import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'
import { buildExternalDbContext } from '@/lib/external-db-context'

/**
 * POST /api/inbox/conversations/[id]/suggest
 * Generate an AI-suggested reply based on conversation history,
 * using the channel owner's API key and injecting channel context.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get conversation with channel info
    const conversation = await prisma.conversation.findUnique({
        where: { id },
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

    if (!conversation) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const channel = conversation.channel
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 400 })
    }

    // ─── Resolve AI key from channel owner's UserApiKey ───────────────
    const preferredProvider = channel.defaultAiProvider || null
    const ownerKey = await getChannelOwnerKey(channel.id, preferredProvider)

    if (!ownerKey.apiKey) {
        return NextResponse.json(
            { error: ownerKey.error || 'No AI API key configured. Please set up your API keys at /dashboard/api-keys.' },
            { status: 400 }
        )
    }

    const provider = ownerKey.provider!
    const apiKey = ownerKey.apiKey
    const model = channel.defaultAiModel || ownerKey.model || getDefaultModel(provider, {})

    // ─── Load knowledge base ──────────────────────────────────────────
    const knowledgeEntries = await prisma.knowledgeBase.findMany({
        where: { channelId: channel.id },
        select: { title: true, content: true },
        take: 20,
    })

    // ─── Load bot config ──────────────────────────────────────────────
    const botConfig = await prisma.botConfig.findUnique({
        where: { channelId: channel.id },
        select: { personality: true, botName: true, trainingPairs: true },
    })

    // ─── Get recent messages for context ──────────────────────────────
    const messages = await prisma.inboxMessage.findMany({
        where: { conversationId: id },
        orderBy: { sentAt: 'desc' },
        take: 15,
    })

    const messageContext = messages
        .reverse()
        .map(m => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content}`)
        .join('\n')

    // ─── Build rich system prompt with channel context ────────────────
    const vibeTone = (channel.vibeTone as Record<string, string>) || {}
    const businessInfo = (channel.businessInfo as Record<string, any>) || {}
    const brandProfile = (channel.brandProfile as Record<string, string>) || {}
    const trainingPairs = (botConfig?.trainingPairs as Array<{ q: string; a: string }>) || []

    let systemPrompt = `You are ${botConfig?.botName || 'a helpful customer service agent'} for "${channel.displayName || channel.name}".`

    if (botConfig?.personality) {
        systemPrompt += `\n\nYour personality and instructions:\n${botConfig.personality}`
    }

    if (channel.description) {
        systemPrompt += `\n\nAbout this business:\n${channel.description}`
    }

    if (vibeTone.personality || vibeTone.writingStyle) {
        systemPrompt += `\n\nBrand voice:`
        if (vibeTone.personality) systemPrompt += `\n- Personality: ${vibeTone.personality}`
        if (vibeTone.writingStyle) systemPrompt += `\n- Writing style: ${vibeTone.writingStyle}`
        if (vibeTone.vocabulary) systemPrompt += `\n- Vocabulary: ${vibeTone.vocabulary}`
    }

    if (businessInfo.phone || businessInfo.address || businessInfo.website) {
        systemPrompt += `\n\nBusiness contact:`
        if (businessInfo.phone) systemPrompt += `\n- Phone: ${businessInfo.phone}`
        if (businessInfo.address) systemPrompt += `\n- Address: ${businessInfo.address}`
        if (businessInfo.website) systemPrompt += `\n- Website: ${businessInfo.website}`
    }

    if (brandProfile.targetAudience) {
        systemPrompt += `\n\nTarget audience: ${brandProfile.targetAudience}`
    }

    if (knowledgeEntries.length > 0) {
        systemPrompt += `\n\n--- KNOWLEDGE BASE ---`
        for (const entry of knowledgeEntries) {
            systemPrompt += `\n\n### ${entry.title}\n${entry.content.substring(0, 2000)}`
        }
        systemPrompt += `\n--- END KNOWLEDGE BASE ---`
    }

    if (trainingPairs.length > 0) {
        systemPrompt += `\n\n--- TRAINING Q&A ---`
        for (const pair of trainingPairs.slice(0, 30)) {
            systemPrompt += `\nQ: ${pair.q}\nA: ${pair.a}`
        }
        systemPrompt += `\n--- END TRAINING Q&A ---`
    }

    systemPrompt += `\n\nBased on the conversation history, suggest a professional and friendly reply. Keep it concise and natural. Reply in ${channel.language === 'vi' ? 'Vietnamese' : channel.language === 'en' ? 'English' : channel.language || 'the same language the customer is using'}. Do NOT include any prefix like "Agent:" — just the reply text.`

    // Inject live External DB context using the last customer message as search query
    const lastCustomerMsg = messages.find(m => m.direction === 'inbound')?.content || conversation.externalUserName || ''
    if (lastCustomerMsg) {
        const externalDbContext = await buildExternalDbContext(channel.id, lastCustomerMsg)
        if (externalDbContext) {
            systemPrompt += `\n\n--- EXTERNAL DATABASE (Live) ---\n${externalDbContext}\n--- END EXTERNAL DATABASE ---`
        }
    }

    const userPrompt = `Customer name: ${conversation.externalUserName || 'Customer'}

Recent messages:
${messageContext}

Suggest a professional reply:`

    try {
        const suggestion = await callAI(provider, apiKey, model, systemPrompt, userPrompt)
        return NextResponse.json({ suggestion: suggestion.trim() })
    } catch (err: any) {
        console.error('[AI Suggest] Error:', err)
        return NextResponse.json({ error: err.message || 'AI error' }, { status: 500 })
    }
}
