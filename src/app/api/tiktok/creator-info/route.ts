import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/tiktok/creator-info?platformId=<channelPlatformId>
 *
 * Fetches fresh creator_info from TikTok and returns:
 *  - privacy_level_options   (string[]) — what visibilities the user can choose
 *  - comment_disabled        (bool)
 *  - duet_disabled           (bool)
 *  - stitch_disabled         (bool)
 *  - max_video_post_duration_sec (number)
 *  - can_post                (bool)
 *
 * Required by TikTok UX Guidelines Points 1a, 1b, 1c, 2b, 2c.
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const platformId = req.nextUrl.searchParams.get('platformId')
    if (!platformId) return NextResponse.json({ error: 'platformId required' }, { status: 400 })

    // Fetch the ChannelPlatform — join through channel to verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const platform = await db.channelPlatform.findFirst({
        where: {
            id: platformId,
            platform: 'tiktok',
            channel: { userId: session.user.id },
        },
        select: { accessToken: true, accountName: true },
    })

    if (!platform?.accessToken) {
        return NextResponse.json({ error: 'TikTok account not found or not connected' }, { status: 404 })
    }

    try {
        const creatorRes = await fetch(
            'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${platform.accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({}),
            }
        )

        if (!creatorRes.ok) {
            const err = await creatorRes.text()
            console.error('[TikTok creator-info] API error:', err)
            return NextResponse.json({ error: 'Failed to fetch creator info from TikTok' }, { status: 502 })
        }

        const creatorData = await creatorRes.json()
        const data = creatorData?.data || {}

        return NextResponse.json({
            can_post: data.can_post !== false,
            privacy_level_options: data.privacy_level_options || ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
            comment_disabled: data.comment_disabled === true,
            duet_disabled: data.duet_disabled === true,
            stitch_disabled: data.stitch_disabled === true,
            max_video_post_duration_sec: data.max_video_post_duration_sec || 600,
        })
    } catch (err) {
        console.error('[TikTok creator-info] Fetch error:', err)
        return NextResponse.json({ error: 'Server error fetching TikTok creator info' }, { status: 500 })
    }
}
