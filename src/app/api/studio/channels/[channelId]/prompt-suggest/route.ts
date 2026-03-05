import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verifyMembership(userId: string, channelId: string) {
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

// POST /api/studio/channels/[channelId]/prompt-suggest
// Body: { avatarName, avatarPrompt, productName, productDesc, platform }
// Returns: { suggestions: string[] } — 3 prompt variants
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ channelId: string }> },
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId } = await params

    if (!(await verifyMembership(session.user.id, channelId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { avatarName, avatarPrompt, productName, productDesc, platform } = body

    const systemPrompt = `You are a creative AI image prompt writer for social media content generation. 
Generate concise, vivid prompts for an AI image generator (like FLUX or Stable Diffusion).
Each prompt should describe a scene/composition suitable for ${platform || 'Instagram'} marketing.`

    const userMessage = `Generate 3 different image generation prompts for this scenario:
${avatarName ? `- Avatar/Model: ${avatarName} (${avatarPrompt || 'no description'})` : ''}
${productName ? `- Product: ${productName}${productDesc ? ` — ${productDesc}` : ''}` : ''}
- Platform: ${platform || 'Instagram'}

Requirements:
- Each prompt should be 1-2 sentences
- Include lighting, composition, and mood details
- Make it photorealistic and commercially appealing
- Return ONLY a JSON array of 3 strings, no explanation

Example format: ["prompt 1", "prompt 2", "prompt 3"]`

    try {
        // Try to use existing AI infrastructure (Gemini or OpenAI)
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
        const openaiKey = process.env.OPENAI_API_KEY

        let suggestions: string[] = []

        if (geminiKey) {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
                        generationConfig: { temperature: 0.9, maxOutputTokens: 512 },
                    }),
                }
            )
            const data = await res.json()
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
            const match = text.match(/\[[\s\S]*\]/)
            if (match) suggestions = JSON.parse(match[0])
        } else if (openaiKey) {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage },
                    ],
                    temperature: 0.9,
                }),
            })
            const data = await res.json()
            const text = data?.choices?.[0]?.message?.content || '[]'
            const match = text.match(/\[[\s\S]*\]/)
            if (match) suggestions = JSON.parse(match[0])
        }

        if (!suggestions.length) {
            suggestions = [
                `${avatarName || 'A model'} holding ${productName || 'a product'}, soft studio lighting, clean white background, professional commercial photography`,
                `${avatarName || 'Person'} using ${productName || 'the product'} outdoors, golden hour, lifestyle photography, shallow depth of field`,
                `Close-up of ${productName || 'the product'} with ${avatarName || 'a model'} in background, moody editorial style, dramatic lighting`,
            ]
        }

        return NextResponse.json({ suggestions: suggestions.slice(0, 3) })
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
