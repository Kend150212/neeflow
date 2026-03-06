import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { uploadToR2, generateR2Key } from '@/lib/r2'

async function verifyAccess(userId: string, channelId: string, role?: string) {
    if (role === 'ADMIN') return true
    return !!(await prisma.channelMember.findFirst({ where: { userId, channelId } }))
}

async function resolveKey(userId: string, provider: string): Promise<string | null> {
    const userKey = await prisma.userApiKey.findFirst({
        where: { userId, provider }, select: { apiKeyEncrypted: true },
    })
    if (userKey?.apiKeyEncrypted) {
        try { return decrypt(userKey.apiKeyEncrypted) } catch { /* fall through */ }
    }
    const envMap: Record<string, string | undefined> = {
        fal_ai: process.env.FAL_AI_KEY,
        runware: process.env.RUNWARE_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
    }
    return envMap[provider] ?? null
}

type Ctx = { params: Promise<{ channelId: string; id: string; assetId: string }> }

// POST /api/studio/channels/[channelId]/avatars/[id]/assets/[assetId]/generate
export async function POST(req: NextRequest, { params }: Ctx) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { channelId, id, assetId } = await params

    if (!(await verifyAccess(session.user.id, channelId, session.user.role as string)))
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const asset = await prisma.studioAvatarAsset.findFirst({ where: { id: assetId, avatarId: id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const provider: string = body.provider || 'gemini'
    const model: string = body.model || 'gemini-3.1-flash-image-preview'

    const apiKey = await resolveKey(session.user.id, provider)
    if (!apiKey) return NextResponse.json({ error: `No API key for "${provider}"` }, { status: 400 })

    // Build asset-specific prompt
    const assetTypeLabel = asset.type === 'outfit' ? 'clothing outfit' : asset.type === 'accessory' ? 'accessory item' : 'prop item'
    const assetPrompt = [
        `Professional product photo of a ${assetTypeLabel}: ${asset.name}.`,
        asset.prompt ? `Details: ${asset.prompt}.` : '',
        `MANDATORY: pure white studio background, soft gradient, professional product photography lighting, front view, item displayed flat or on invisible mannequin, no model, no shadow harsh, high detail.`,
    ].filter(Boolean).join(' ')

    try {
        let imageUrl = ''

        if (provider === 'gemini') {
            const isFlash = model.startsWith('gemini-')
            const apiBase = `https://generativelanguage.googleapis.com/v1beta/models/${model}`

            if (isFlash) {
                const res = await fetch(`${apiBase}:generateContent?key=${apiKey}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: assetPrompt.slice(0, 2000) }] }],
                        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
                    }),
                })
                const data = await res.json()
                const parts = data.candidates?.[0]?.content?.parts || []
                for (const part of parts) {
                    if (part.inlineData?.data) {
                        const mime = part.inlineData.mimeType || 'image/png'
                        const ext = mime.split('/')[1] || 'png'
                        const buf = Buffer.from(part.inlineData.data, 'base64')
                        const key = generateR2Key(channelId, `asset-${assetId}-${Date.now()}.${ext}`)
                        imageUrl = await uploadToR2(buf, key, mime)
                        break
                    }
                }
            } else {
                const res = await fetch(`${apiBase}:predict?key=${apiKey}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instances: [{ prompt: assetPrompt.slice(0, 2000) }], parameters: { sampleCount: 1, aspectRatio: '1:1' } }),
                })
                const data = await res.json()
                const pred = data.predictions?.[0]
                if (pred?.bytesBase64Encoded) {
                    const mime = pred.mimeType || 'image/png'
                    const ext = mime.split('/')[1] || 'png'
                    const buf = Buffer.from(pred.bytesBase64Encoded, 'base64')
                    const key = generateR2Key(channelId, `asset-${assetId}-${Date.now()}.${ext}`)
                    imageUrl = await uploadToR2(buf, key, mime)
                }
            }
        } else if (provider === 'openai') {
            const oaiRes = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model || 'gpt-image-1', prompt: assetPrompt.slice(0, 4000), n: 1, quality: 'standard' }),
            })
            const oaiData = await oaiRes.json()
            const item = oaiData.data?.[0]
            imageUrl = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '')
        } else if (provider === 'fal_ai') {
            const falRes = await fetch(`https://queue.fal.run/${model || 'fal-ai/flux/schnell'}`, {
                method: 'POST', headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: assetPrompt, image_size: 'square_hd', num_images: 1, num_inference_steps: 4 }),
            })
            // Fal is async — return pending for polling
            if (falRes.ok) return NextResponse.json({ status: 'generating', message: 'Queued — check back shortly' })
        }

        if (!imageUrl) return NextResponse.json({ error: 'No image generated' }, { status: 500 })

        // Append to asset images
        const existing = (asset.images as Array<{ url: string; label?: string; createdAt?: string }>) || []
        const updated = await prisma.studioAvatarAsset.update({
            where: { id: assetId },
            data: { images: [...existing, { url: imageUrl, label: 'AI Generated', createdAt: new Date().toISOString() }] },
        })
        return NextResponse.json({ status: 'done', asset: updated })
    } catch (err) {
        return NextResponse.json({ error: `Error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }
}
