import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI, getDefaultModel } from '@/lib/ai-caller'
import { getChannelOwnerKey } from '@/lib/channel-owner-key'

/**
 * POST /api/admin/channels/[id]/bot-config/test-chat
 * Test-chat with the bot — same prompt logic as bot-auto-reply
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
    const { message, history } = await req.json() as {
        message: string
        history: { role: 'user' | 'bot'; content: string }[]
    }

    if (!message?.trim()) {
        return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    try {
        // Load channel
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: {
                id: true, name: true, displayName: true, description: true,
                language: true, vibeTone: true, businessInfo: true, brandProfile: true,
                defaultAiProvider: true, defaultAiModel: true,
            },
        })
        if (!channel) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
        }

        // Load bot config
        const botConfig = await prisma.botConfig.findUnique({
            where: { channelId },
        })

        // Resolve AI key
        const ownerKey = await getChannelOwnerKey(channel.id, channel.defaultAiProvider)
        if (!ownerKey.apiKey) {
            return NextResponse.json({ error: 'No AI API key configured' }, { status: 400 })
        }

        const provider = ownerKey.provider!
        const apiKey = ownerKey.apiKey
        const model = channel.defaultAiModel || ownerKey.model || getDefaultModel(provider, {})

        // Load knowledge base
        const knowledgeEntries = await prisma.knowledgeBase.findMany({
            where: { channelId },
            select: { title: true, content: true },
            take: 20,
        })

        // Build system prompt (same as bot-auto-reply)
        const vibeTone = (channel.vibeTone as Record<string, string>) || {}
        const businessInfo = (channel.businessInfo as Record<string, any>) || {}
        const brandProfile = (channel.brandProfile as Record<string, string>) || {}
        const trainingPairs = (botConfig?.trainingPairs as Array<{ q: string; a: string }>) || []
        const agentLearning = (botConfig?.agentLearning as any) || {}

        let systemPrompt = `You are ${botConfig?.botName || 'AI Assistant'}, an auto-reply customer service bot for "${channel.displayName || channel.name}".`

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

        if (trainingPairs.length > 0) {
            systemPrompt += `\n\n--- TRAINING Q&A ---`
            for (const pair of trainingPairs.slice(0, 15)) {
                systemPrompt += `\nQ: ${pair.q}\nA: ${pair.a}`
            }
            systemPrompt += `\n--- END TRAINING Q&A ---`
        }

        // Inject agent learning data
        if (agentLearning && Object.keys(agentLearning).length > 0) {
            systemPrompt += `\n\n--- AGENT LEARNING (auto-discovered from real agent chats) ---`
            if (agentLearning.vocabulary?.length) {
                systemPrompt += `\n## Vocabulary commonly used by our team: ${agentLearning.vocabulary.join(', ')}`
            }
            if (agentLearning.slangAndAbbreviations?.length) {
                systemPrompt += `\n## Slang, abbreviations & informal language: ${agentLearning.slangAndAbbreviations.join(', ')}`
            }
            if (agentLearning.greetingStyles?.length) {
                systemPrompt += `\n## How agents typically greet: ${agentLearning.greetingStyles.join(' | ')}`
            }
            if (agentLearning.closingStyles?.length) {
                systemPrompt += `\n## How agents close conversations: ${agentLearning.closingStyles.join(' | ')}`
            }
            if (agentLearning.dealingPatterns?.length) {
                systemPrompt += `\n## Common dealing patterns:`
                for (const p of agentLearning.dealingPatterns) {
                    systemPrompt += `\n- ${p.scenario}: ${p.approach}`
                }
            }
            if (agentLearning.toneAnalysis) {
                const t = agentLearning.toneAnalysis
                systemPrompt += `\n## Tone: formality=${t.formality}, emoji=${t.emojiUsage}, avg length=${t.avgMessageLength} chars`
            }
            systemPrompt += `\n--- END AGENT LEARNING ---`
        }

        const langLabel = channel.language === 'vi' ? 'Vietnamese' : channel.language === 'en' ? 'English' : channel.language || 'auto-detect'
        systemPrompt += `\n\n## Communication Style:\n- You are a REAL person on the team, not a bot. Chat naturally.\n- Keep messages SHORT (1-3 sentences max).\n- Use casual, warm language. Emoji sparingly 😊\n- ONE clear, direct response per message.`
        systemPrompt += `\n\n## Language:\n- Default: ${langLabel}\n- Reply in the SAME language as the customer.`
        systemPrompt += `\n\n## Rules:\n- NEVER say you are an AI, bot, or automated system\n- PLAIN TEXT ONLY, no JSON, no brackets\n- If you don't know something, say you'll check with the team`

        // Build conversation history
        let conversationContext = ''
        if (history?.length) {
            for (const msg of history) {
                conversationContext += `${msg.role === 'user' ? 'Customer' : 'Agent'}: ${msg.content}\n`
            }
        }
        conversationContext += `Customer: ${message}`

        const userPrompt = `${conversationContext}\n\nReply naturally in 1-3 sentences (plain text, no JSON):`

        const rawReply = await callAI(provider, apiKey, model, systemPrompt, userPrompt)
        let reply = rawReply.trim()

        // Clean AI artifacts
        if (reply.startsWith('{') || reply.startsWith('[') || reply.startsWith('```')) {
            try {
                const jsonStr = reply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
                const parsed = JSON.parse(jsonStr)
                if (Array.isArray(parsed)) {
                    reply = parsed.filter((i: any) => typeof i === 'string').join('\n')
                } else {
                    reply = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.content || reply
                }
            } catch { /* use as-is */ }
        }

        return NextResponse.json({ reply: reply.trim() })
    } catch (err: any) {
        console.error('[Test Chat] Error:', err)
        return NextResponse.json({ error: err.message || 'AI call failed' }, { status: 500 })
    }
}
