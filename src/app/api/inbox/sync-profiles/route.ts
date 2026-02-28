import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/inbox/sync-profiles
 * Backfill missing names/avatars for Facebook Messenger conversations
 * that only have a numeric PSID as their name.
 *
 * Uses the Page Access Token for each platform account to call
 * GET /{psid}?fields=name,profile_pic from the Graph API.
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const channelId: string | undefined = body.channelId // optional filter by channel

    // Find all facebook conversations with null or numeric-only externalUserName
    const where: any = {
        platform: 'facebook',
        OR: [
            { externalUserName: null },
            { externalUserName: '' },
            // Match pure numeric strings (PSIDs like "9487671127949640")
            { externalUserName: { regex: '^[0-9]+$' } }
        ]
    }
    if (channelId) where.channelId = channelId

    // Prisma doesn't support regex on MySQL easily — use a raw approach:
    // Find conversations where externalUserName is null OR equals externalUserId (numeric)
    const conversations = await prisma.conversation.findMany({
        where: {
            platform: 'facebook',
            ...(channelId ? { channelId } : {}),
        },
        select: {
            id: true,
            externalUserId: true,
            externalUserName: true,
            externalUserAvatar: true,
            platformAccountId: true,
            channelId: true,
        },
    })

    // Filter: only those where name is null, empty, equals numeric userId, or is 'Facebook User' placeholder
    const needsUpdate = conversations.filter(c => {
        if (!c.externalUserName) return true
        if (c.externalUserName === c.externalUserId) return true
        // Pure numeric string (PSID)
        if (/^\d{10,}$/.test(c.externalUserName)) return true
        // Previous 'Facebook User' placeholder - try again for real name
        if (c.externalUserName === 'Facebook User') return true
        return false
    })

    if (needsUpdate.length === 0) {
        return NextResponse.json({ synced: 0, message: 'All conversations already have names' })
    }

    // Group by platformAccountId to avoid redundant token fetches
    const platformAccountCache = new Map<string, { accessToken: string | null } | null>()
    const getPlatformAccount = async (id: string) => {
        if (platformAccountCache.has(id)) return platformAccountCache.get(id)!
        const pa = await prisma.channelPlatform.findUnique({
            where: { id },
            select: { accessToken: true },
        })
        platformAccountCache.set(id, pa)
        return pa
    }

    let synced = 0
    let failed = 0
    const errors: string[] = []

    for (const conv of needsUpdate) {
        if (!conv.platformAccountId) continue
        const pa = await getPlatformAccount(conv.platformAccountId)
        if (!pa?.accessToken) {
            failed++
            continue
        }

        try {
            const res = await fetch(
                `https://graph.facebook.com/v19.0/${conv.externalUserId}?fields=name,profile_pic&access_token=${pa.accessToken}`
            )
            if (!res.ok) {
                const errText = await res.text()
                errors.push(`${conv.externalUserId}: HTTP ${res.status} - ${errText.substring(0, 100)}`)
                failed++
                continue
            }

            const data = await res.json()
            if (data.error) {
                errors.push(`${conv.externalUserId}: ${data.error.message} (code ${data.error.code})`)
                failed++
                continue
            }

            const newName: string | null = data.name || null
            const newAvatar: string | null = data.profile_pic || null
            const fallbackAvatar = `https://graph.facebook.com/${conv.externalUserId}/picture?type=small&access_token=${pa.accessToken}`

            await prisma.conversation.update({
                where: { id: conv.id },
                data: {
                    externalUserName: newName || undefined, // only update if we got a real name
                    externalUserAvatar: newAvatar || conv.externalUserAvatar || fallbackAvatar,
                },
            })
            if (newName) {
                synced++
            } else {
                // No name from API (permission issue) - already has 'Facebook User' from webhook
                if (/^\d{10,}$/.test(conv.externalUserName || '')) {
                    // Still has raw PSID - set friendly name
                    await prisma.conversation.update({
                        where: { id: conv.id },
                        data: { externalUserName: 'Facebook User', externalUserAvatar: fallbackAvatar },
                    })
                }
                failed++
                errors.push(`${conv.externalUserId}: No name (permission restricted by Facebook)`)
            }
        } catch (e: any) {
            errors.push(`${conv.externalUserId}: ${e?.message || 'Unknown error'}`)
            failed++
        }
    }

    return NextResponse.json({
        total: needsUpdate.length,
        synced,
        failed,
        errors: errors.slice(0, 20), // Return first 20 errors for debugging
    })
}
