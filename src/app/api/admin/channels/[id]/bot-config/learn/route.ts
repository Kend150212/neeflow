import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'

/**
 * GET /api/admin/channels/[id]/bot-config/learn
 * Get current agent learning data
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params

    const config = await prisma.botConfig.findUnique({
        where: { channelId },
        select: { agentLearning: true, lastLearnedAt: true },
    })

    return NextResponse.json({
        agentLearning: config?.agentLearning || {},
        lastLearnedAt: config?.lastLearnedAt || null,
    })
}

/**
 * POST /api/admin/channels/[id]/bot-config/learn
 * Analyze agent conversations and extract learning data
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params

    try {
        // Load channel
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { id: true, name: true, defaultAiProvider: true, defaultAiModel: true, language: true },
        })
        if (!channel) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
        }

        // Resolve AI key
        const ownerKey = await getChannelOwnerKey(channel.id, channel.defaultAiProvider)
        if (!ownerKey.apiKey) {
            return NextResponse.json({ error: 'No AI API key configured' }, { status: 400 })
        }

        const provider = ownerKey.provider!
        const apiKey = ownerKey.apiKey
        const model = channel.defaultAiModel || ownerKey.model || getDefaultModel(provider, {})

        // Load conversations where agents replied (not bot)
        const agentMessages = await prisma.inboxMessage.findMany({
            where: {
                conversation: { channelId },
                direction: 'outbound',
                senderType: 'agent',
            },
            select: {
                content: true,
                sentAt: true,
                conversationId: true,
            },
            orderBy: { sentAt: 'desc' },
            take: 200,
        })

        if (agentMessages.length === 0) {
            return NextResponse.json({
                agentLearning: { totalConversationsAnalyzed: 0 },
                message: 'No agent messages found to learn from',
            })
        }

        // Collect agent-customer pairs for analysis
        const conversationIds = [...new Set(agentMessages.map(m => m.conversationId))]
        const pairs: { customer: string; agent: string }[] = []

        for (const convId of conversationIds.slice(0, 50)) {
            const messages = await prisma.inboxMessage.findMany({
                where: { conversationId: convId },
                orderBy: { sentAt: 'asc' },
                select: { content: true, direction: true, senderType: true },
                take: 20,
            })

            for (let i = 0; i < messages.length - 1; i++) {
                const msg = messages[i]
                const next = messages[i + 1]
                if (msg.direction === 'inbound' && next.direction === 'outbound' && next.senderType === 'agent') {
                    pairs.push({
                        customer: msg.content.substring(0, 300),
                        agent: next.content.substring(0, 500),
                    })
                }
            }
        }

        // Use AI to analyze agent patterns
        const agentReplies = agentMessages.map(m => m.content).slice(0, 100)
        const samplePairs = pairs.slice(0, 30)

        const analysisPrompt = `You are an expert linguist and communication analyst. Analyze the following real agent messages from a customer service team. Extract the following data in JSON format:

## Agent Messages (sample):
${agentReplies.slice(0, 50).map((r, i) => `${i + 1}. "${r}"`).join('\n')}

## Customer → Agent pairs (showing how agents respond to customers):
${samplePairs.map((p, i) => `${i + 1}. Customer: "${p.customer}" → Agent: "${p.agent}"`).join('\n')}

## Analysis Required (respond in JSON only):
{
  "totalConversationsAnalyzed": ${conversationIds.length},
  "vocabulary": ["top 20 most frequently used words/phrases by agents"],
  "slangAndAbbreviations": ["list ALL slang terms, abbreviations, genZ language, regional/dialect words, informal shortcuts used by agents. Include the original form and what it means. Examples: 'nha' (nhá), 'ạ' (polite particle), 'ok' (okay), 'ad' (admin), 'rep' (reply), 'dt' (điện thoại). Detect across ALL languages."],
  "greetingStyles": ["exact greeting phrases used by agents, up to 10"],
  "closingStyles": ["exact closing/goodbye phrases used, up to 10"],
  "dealingPatterns": [
    {"scenario": "describe the customer situation", "approach": "how the agent handled it"}
  ],
  "toneAnalysis": {
    "formality": "formal|casual|mixed",
    "emojiUsage": "none|rare|moderate|heavy",
    "avgMessageLength": estimated_character_count,
    "languages": ["list all languages detected in agent messages"],
    "writingStyle": "brief description of the overall writing style"
  },
  "keyPhrases": ["signature phrases or expressions the team uses repeatedly"],
  "customerHandlingTechniques": ["specific techniques agents use: upselling, empathy, redirecting, etc."]
}

IMPORTANT:
- Detect slang, abbreviations, and informal language across ALL languages (Vietnamese, English, etc.)
- Include GenZ language, internet slang, regional dialect words
- Be thorough in listing every abbreviated/informal term you find
- Return ONLY valid JSON, nothing else`

        const rawResult = await callAI(provider, apiKey, model, 'You are a language analysis expert. Return only valid JSON.', analysisPrompt)

        // Parse the AI result
        let learningData: any = {}
        try {
            let jsonStr = rawResult.trim()
            // Strip markdown code fences if present
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
            learningData = JSON.parse(jsonStr)
        } catch {
            // Try extracting JSON from response
            const jsonMatch = rawResult.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                try {
                    learningData = JSON.parse(jsonMatch[0])
                } catch {
                    return NextResponse.json({ error: 'Failed to parse AI analysis' }, { status: 500 })
                }
            }
        }

        // Add metadata
        learningData.totalConversationsAnalyzed = conversationIds.length
        learningData.totalAgentMessages = agentMessages.length
        learningData.totalPairsAnalyzed = pairs.length
        learningData.lastAnalyzedAt = new Date().toISOString()

        // Save to database
        await prisma.botConfig.upsert({
            where: { channelId },
            update: {
                agentLearning: learningData,
                lastLearnedAt: new Date(),
            },
            create: {
                channelId,
                agentLearning: learningData,
                lastLearnedAt: new Date(),
            },
        })

        return NextResponse.json({
            agentLearning: learningData,
            lastLearnedAt: new Date().toISOString(),
            message: `Analyzed ${conversationIds.length} conversations with ${agentMessages.length} agent messages`,
        })
    } catch (err: any) {
        console.error('[Agent Learning] Error:', err)
        return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 })
    }
}
