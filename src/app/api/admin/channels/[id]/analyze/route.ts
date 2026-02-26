import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callAI } from '@/lib/ai-caller'
import { resolveTextAIKey } from '@/lib/resolve-ai-key'
import { incrementTextUsage } from '@/lib/ai-quota'

// POST /api/admin/channels/[id]/analyze — AI analysis of channel
// API key priority:
//   1. Channel owner's UserApiKey (preferred provider → default → any)
//   2. Admin's shared ApiIntegration (fallback, subject to quota)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params
    const body = await req.json()
    const {
        channelName, description, language,
        targetAudience, contentTypes, brandValues, communicationStyle,
        provider: requestedProvider, model: requestedModel,
    } = body

    if (!channelName || !description) {
        return NextResponse.json({ error: 'Channel name and description are required' }, { status: 400 })
    }

    // ─── Quota-aware key resolution ───
    const keyResult = await resolveTextAIKey(channelId, requestedProvider, requestedModel)
    if (!keyResult.ok) {
        return NextResponse.json({ error: keyResult.data.error, errorType: keyResult.data.errorType }, { status: keyResult.status })
    }
    const { apiKey, provider, model, usingPlatformKey, ownerId, integrationId } = keyResult.data

    const langLabel = language === 'vi' ? 'Vietnamese' : language === 'fr' ? 'French' : language === 'de' ? 'German' : language === 'ja' ? 'Japanese' : language === 'ko' ? 'Korean' : language === 'zh' ? 'Chinese' : language === 'es' ? 'Spanish' : 'English'

    const systemPrompt = `You are a seasoned Content Strategy Expert specializing in brand voice development and social media strategy. Your task is to develop a comprehensive and actionable Brand Voice Guide for a specific brand. This guide will ensure consistent tone and style across all written communication channels. Respond ONLY with valid JSON, no markdown, no explanation.`

    const userPrompt = `Analyze this social media channel/brand and generate a comprehensive Brand Voice Guide with actionable content settings.

**Brand Information:**
- Brand Name: ${channelName}
- Description: ${description}
- Language: ${langLabel}
${targetAudience ? `- Target Audience: ${targetAudience}` : '- Target Audience: (not provided, infer from brand description)'}
${contentTypes ? `- Primary Content Types: ${contentTypes}` : '- Primary Content Types: (not provided, suggest based on brand)'}
${brandValues ? `- Core Brand Values: ${brandValues}` : '- Core Brand Values: (not provided, infer from brand description)'}
${communicationStyle ? `- Current Communication Style: ${communicationStyle}` : '- Current Communication Style: (not provided, suggest based on brand description)'}

**Your Analysis Must Cover:**

1. **Brand Overview:** Analyze core values, primary target audience, current communication style. Define the brand's personality traits.

2. **Core Brand Voice Elements:**
   - **Tone:** Emotional states and attitudes to convey (optimistic, formal, humorous, trustworthy, etc.)
   - **Vocabulary & Grammar:** Preferred/avoided keywords, sentence structures, grammatical style
   - **Message Delivery:** How ideas should be structured, use of metaphors, analogies, storytelling

3. **Practical Application:** How to apply the voice across different content types (blog posts, email, social media captions, product descriptions). Clear "Do's" and "Don'ts" with examples.

4. **Voice Adaptation:** How to maintain brand consistency while adjusting tone for different contexts, audiences, or purposes (crisis communication vs product promotion vs engagement).

Generate a JSON response with this exact structure:
{
  "vibeTone": {
    "personality": "3-4 sentences describing the brand personality traits (e.g., friendly, professional, innovative, authoritative). Be specific and vivid.",
    "toneAttributes": "List the primary emotional tones to convey: e.g., 'Optimistic, Trustworthy, Energetic, Approachable.' Explain each briefly.",
    "writingStyle": "3-4 sentences about writing style — formal vs casual, humor level, sentence length preference, use of questions/exclamations, storytelling approach.",
    "vocabulary": "Preferred keywords, power words, and phrases the brand should use. Also list 5-10 words/phrases to AVOID. Include vocabulary level (simple/technical/mixed).",
    "messageDelivery": "How ideas should be structured: use of metaphors, analogies, data points, personal stories. Opening/closing patterns. Call-to-action style.",
    "targetAudience": "Detailed audience profile: demographics, psychographics, pain points, desires, where they hang out online, what content they engage with.",
    "brandValues": "3-5 core values with brief explanation of each and how they manifest in content.",
    "dosAndDonts": "5 DO's and 5 DON'Ts for content creation, each with a brief example. Format as: DO: [action] — Example: [example sentence]. DON'T: [action] — Example: [bad example].",
    "platformAdaptation": "How to adapt the voice for different platforms: Facebook (community/storytelling), Instagram (visual/aspirational), TikTok (trendy/authentic), LinkedIn (professional/thought-leadership), X/Twitter (concise/witty).",
    "crisisVoice": "How the brand voice should shift during sensitive situations, complaints, or negative feedback. Tone adjustments and key phrases to use."
  },
  "knowledgeBase": [
    {
      "title": "entry title",
      "content": "detailed content, 3-5 sentences covering key facts, unique selling points, or industry context"
    }
  ],
  "contentTemplates": [
    {
      "name": "template name (e.g., Product Launch, Educational Post, Customer Story)",
      "templateContent": "Full template with {{variable}} placeholders. Include hook/opening, body structure, call-to-action, and suggested hashtag placement."
    }
  ],
  "hashtagGroups": [
    {
      "name": "group name",
      "hashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ]
}

Requirements:
- Generate 5-8 knowledge base entries covering: brand story, products/services, industry insights, competitive advantages, FAQ, target audience insights
- Generate 5-6 content templates for different post types: promotional, educational, engagement/question, announcement, behind-the-scenes, user testimonial/social proof
- Generate 3-4 hashtag groups (brand-specific, industry, trending/seasonal, engagement) with 6-10 hashtags each
- All content MUST be in ${langLabel}
- Templates should use {{variable}} syntax for dynamic parts (e.g., {{product_name}}, {{benefit}}, {{customer_name}})
- Make the vibeTone fields detailed and actionable — a content writer should be able to read these and immediately write on-brand content
- Hashtags should be relevant, commonly used, and mix of broad reach and niche targeting`

    try {
        const result = await callAI(provider, apiKey, model, systemPrompt, userPrompt)

        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const analysis = JSON.parse(cleaned)

        // Track usage when using platform key
        if (usingPlatformKey && ownerId) {
            await Promise.all([
                incrementTextUsage(ownerId, false),
                integrationId ? prisma.apiIntegration.update({ where: { id: integrationId }, data: { usageCount: { increment: 1 } } }) : Promise.resolve(),
            ])
        }

        return NextResponse.json(analysis)
    } catch (error) {
        console.error('AI Analysis error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'AI analysis failed' },
            { status: 500 }
        )
    }
}
