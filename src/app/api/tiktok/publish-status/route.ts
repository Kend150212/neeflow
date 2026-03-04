/**
 * GET /api/tiktok/publish-status?postPlatformStatusId=...
 *
 * Polls TikTok's publish/status/fetch endpoint using the publish_id (externalId)
 * stored in PostPlatformStatus after a successful Direct Post.
 *
 * TikTok guideline 5e: API Clients should poll publish/status/fetch so users
 * can understand the status of their posts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const postPlatformStatusId = searchParams.get('postPlatformStatusId')

        if (!postPlatformStatusId) {
            return NextResponse.json({ error: 'postPlatformStatusId required' }, { status: 400 })
        }

        // Load the platform status record (checks authorization via channel membership)
        const pps = await (prisma as any).postPlatformStatus.findFirst({
            where: {
                id: postPlatformStatusId,
                platform: 'tiktok',
                post: {
                    channel: {
                        members: { some: { userId: session.user.id } },
                    },
                },
            },
            include: {
                post: {
                    include: {
                        channel: {
                            include: {
                                platforms: {
                                    where: { platform: 'tiktok' },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!pps) {
            return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 })
        }

        const publishId = pps.externalId
        if (!publishId) {
            return NextResponse.json({ tiktokStatus: null, message: 'No publish_id stored' })
        }

        // Find the TikTok platform account for this post
        const tikTokPlatform = pps.post?.channel?.platforms?.find(
            (p: any) => p.platform === 'tiktok' && p.accountId === pps.accountId
        )
        if (!tikTokPlatform?.accessToken) {
            return NextResponse.json({ error: 'TikTok access token not found' }, { status: 400 })
        }

        // Call TikTok status API
        const tikTokRes = await fetch(
            'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tikTokPlatform.accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({ publish_id: publishId }),
            }
        )

        const tikTokData = await tikTokRes.json()

        if (!tikTokRes.ok || tikTokData.error?.code !== 'ok') {
            return NextResponse.json({
                tiktokStatus: 'error',
                error: tikTokData.error?.message || 'TikTok status check failed',
                raw: tikTokData,
            })
        }

        const statusData = tikTokData.data
        // status: PROCESSING_UPLOAD | SEND_TO_USER_INBOX | PUBLISH_COMPLETE | FAILED
        const status: string = statusData?.status || 'UNKNOWN'

        // Update our local DB status if publish is confirmed
        if (status === 'PUBLISH_COMPLETE' && pps.status !== 'published') {
            await (prisma as any).postPlatformStatus.update({
                where: { id: postPlatformStatusId },
                data: { status: 'published', publishedAt: new Date() },
            })
        } else if (status === 'FAILED' && pps.status !== 'failed') {
            const failReason = statusData?.fail_reason || 'Unknown error'
            await (prisma as any).postPlatformStatus.update({
                where: { id: postPlatformStatusId },
                data: { status: 'failed', errorMsg: failReason },
            })
        }

        return NextResponse.json({
            tiktokStatus: status,
            failReason: statusData?.fail_reason || null,
            publishedPostId: statusData?.published_element_id || null,
        })
    } catch (err: any) {
        console.error('[TikTok Publish Status]', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}
