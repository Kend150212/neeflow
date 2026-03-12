import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Facebook Graph API ──────────────────────────────────────────────
async function fetchFacebookInsights(channelPlatform: {
    accountId: string
    accountName: string
    accessToken: string | null
}) {
    if (!channelPlatform.accessToken) return null
    const token = channelPlatform.accessToken
    const pageId = channelPlatform.accountId

    try {
        // Page-level info (followers)
        const pageRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count,name&access_token=${token}`
        )
        const pageData = await pageRes.json()
        if (pageData.error) return null

        // Page insights — v21 valid metrics
        // page_post_engagements was deprecated in v18, use page_total_actions
        const since = Math.floor((Date.now() - 30 * 86400000) / 1000)
        const until = Math.floor(Date.now() / 1000)
        const insightsRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_total_actions,page_impressions,page_reach,page_fan_adds_unique&period=day&since=${since}&until=${until}&access_token=${token}`
        )
        const insightsData = await insightsRes.json()

        let totalEngagement = 0, totalImpressions = 0, totalReach = 0, newFollowers = 0
        if (insightsData.data) {
            for (const metric of insightsData.data) {
                const sum = metric.values?.reduce((acc: number, v: { value: number }) => acc + (v.value || 0), 0) || 0
                if (metric.name === 'page_total_actions') totalEngagement = sum
                if (metric.name === 'page_impressions') totalImpressions = sum
                if (metric.name === 'page_reach') totalReach = sum
                if (metric.name === 'page_fan_adds_unique') newFollowers = sum
            }
        }

        return {
            platform: 'facebook',
            accountName: pageData.name || channelPlatform.accountName,
            followers: pageData.followers_count ?? pageData.fan_count ?? 0,
            newFollowers,
            engagement: totalEngagement,
            impressions: totalImpressions,
            reach: totalReach,
        }
    } catch {
        return null
    }
}

// ─── Instagram Graph API ─────────────────────────────────────────────
async function fetchInstagramInsights(channelPlatform: {
    accountId: string
    accountName: string
    accessToken: string | null
    config: unknown
}) {
    if (!channelPlatform.accessToken) return null
    const token = channelPlatform.accessToken
    const cfg = (channelPlatform.config as Record<string, string>) || {}
    const igAccountId = cfg.instagramAccountId || channelPlatform.accountId

    try {
        // Account info
        const accountRes = await fetch(
            `https://graph.facebook.com/v21.0/${igAccountId}?fields=followers_count,media_count,username&access_token=${token}`
        )
        const accountData = await accountRes.json()
        if (accountData.error) return null

        // Account-level insights
        const since = Math.floor((Date.now() - 30 * 86400000) / 1000)
        const until = Math.floor(Date.now() / 1000)
        const insightRes = await fetch(
            `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=impressions,reach&period=day&since=${since}&until=${until}&access_token=${token}`
        )
        const insightData = await insightRes.json()

        let totalImpressions = 0, totalReach = 0
        if (insightData.data) {
            for (const metric of insightData.data) {
                const sum = metric.values?.reduce((acc: number, v: { value: number }) => acc + (v.value || 0), 0) || 0
                if (metric.name === 'impressions') totalImpressions = sum
                if (metric.name === 'reach') totalReach = sum
            }
        }

        // Engagement from recent media (likes + comments on last 20 posts)
        const mediaRes = await fetch(
            `https://graph.facebook.com/v21.0/${igAccountId}/media?fields=id,like_count,comments_count&limit=20&access_token=${token}`
        )
        const mediaData = await mediaRes.json()
        let totalEngagement = 0
        for (const media of mediaData.data || []) {
            totalEngagement += (media.like_count || 0) + (media.comments_count || 0)
        }

        return {
            platform: 'instagram',
            accountName: accountData.username || channelPlatform.accountName,
            followers: accountData.followers_count ?? 0,
            mediaCount: accountData.media_count ?? 0,
            impressions: totalImpressions,
            reach: totalReach,
            engagement: totalEngagement,
        }
    } catch {
        return null
    }
}

// ─── YouTube Data API v3 ─────────────────────────────────────────────
async function fetchYouTubeInsights(channelPlatform: {
    accountId: string
    accountName: string
    accessToken: string | null
}) {
    if (!channelPlatform.accessToken) return null
    const token = channelPlatform.accessToken
    // Use Authorization header (not query-string) per Google best practices
    const headers = { Authorization: `Bearer ${token}` }

    try {
        const channelRes = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true',
            { headers }
        )
        const channelData = await channelRes.json()
        if (channelData.error || !channelData.items?.length) return null

        const stats = channelData.items[0].statistics
        const snippet = channelData.items[0].snippet
        const ytChannelId = channelData.items[0].id

        // Recent videos (last 10)
        const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${ytChannelId}&maxResults=10&order=date&type=video`,
            { headers }
        )
        const searchData = await searchRes.json()
        let totalViews = 0, totalLikes = 0, totalComments = 0
        if (searchData.items?.length) {
            const videoIds = searchData.items.map((i: { id: { videoId: string } }) => i.id.videoId).join(',')
            const videoRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}`,
                { headers }
            )
            const videoData = await videoRes.json()
            for (const v of videoData.items || []) {
                totalViews += parseInt(v.statistics?.viewCount || '0')
                totalLikes += parseInt(v.statistics?.likeCount || '0')
                totalComments += parseInt(v.statistics?.commentCount || '0')
            }
        }

        return {
            platform: 'youtube',
            accountName: snippet?.title || channelPlatform.accountName,
            followers: parseInt(stats?.subscriberCount || '0'),
            totalViews: parseInt(stats?.viewCount || '0'),
            videoCount: parseInt(stats?.videoCount || '0'),
            recentViews: totalViews,
            recentLikes: totalLikes,
            recentComments: totalComments,
            engagement: totalLikes + totalComments,
            impressions: totalViews,
            reach: totalViews,
        }
    } catch {
        return null
    }
}

// ─── TikTok API v2 ───────────────────────────────────────────────────
async function fetchTikTokInsights(channelPlatform: {
    accountId: string
    accountName: string
    accessToken: string | null
}) {
    if (!channelPlatform.accessToken) return null
    const token = channelPlatform.accessToken
    const headers = { Authorization: `Bearer ${token}` }

    try {
        // User info with stats (requires user.info.stats scope)
        const userRes = await fetch(
            'https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,following_count,likes_count,video_count',
            { headers }
        )
        const userData = await userRes.json()
        // TikTok uses error.code === 'ok' for success
        if (userData.error?.code && userData.error.code !== 'ok') return null
        const user = userData.data?.user

        // Recent video list — POST request required
        const videoListRes = await fetch(
            'https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,view_count,like_count,comment_count,share_count',
            {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
                body: JSON.stringify({ max_count: 20 }),
            }
        )
        const videoListData = await videoListRes.json()
        let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0
        for (const video of videoListData.data?.videos || []) {
            totalViews += video.view_count || 0
            totalLikes += video.like_count || 0
            totalComments += video.comment_count || 0
            totalShares += video.share_count || 0
        }

        return {
            platform: 'tiktok',
            accountName: user?.display_name || channelPlatform.accountName,
            followers: user?.follower_count ?? 0,
            videoCount: user?.video_count ?? 0,
            engagement: totalLikes + totalComments + totalShares,
            impressions: totalViews,
            reach: totalViews,
            recentViews: totalViews,
            recentLikes: totalLikes,
            recentComments: totalComments,
        }
    } catch {
        return null
    }
}

// ─── Pinterest API v5 ─────────────────────────────────────────────────
async function fetchPinterestInsights(channelPlatform: {
    accountId: string
    accountName: string
    accessToken: string | null
}) {
    if (!channelPlatform.accessToken) return null
    const token = channelPlatform.accessToken
    const base = 'https://api.pinterest.com'
    const headers = { Authorization: `Bearer ${token}` }

    // Date range: last 30 days (Pinterest requires YYYY-MM-DD, max 90 days)
    const now = new Date()
    const endDate = now.toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    try {
        // 1. Account info (followers)
        const userRes = await fetch(`${base}/v5/user_account`, { headers })
        if (!userRes.ok) return null
        const userData = await userRes.json()
        if (userData.code) return null // API error code present

        const followers = userData.follower_count ?? 0
        const accountName = userData.username || userData.business_name || channelPlatform.accountName

        // 2. Account-level analytics (impressions, engagement, saves)
        const analyticsRes = await fetch(
            `${base}/v5/user_account/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=IMPRESSION,OUTBOUND_CLICK,PIN_CLICK,SAVE`,
            { headers }
        )
        let impressions = 0, engagement = 0, saves = 0
        if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json()
            // Pinterest returns { all: { daily_metrics: [...], summary_metrics: { IMPRESSION: n, ... } } }
            const summary = analyticsData.all?.summary_metrics || {}
            impressions = summary.IMPRESSION || 0
            engagement = (summary.PIN_CLICK || 0) + (summary.OUTBOUND_CLICK || 0)
            saves = summary.SAVE || 0
        }

        // 3. Top 10 Pins analytics for "top posts" section
        const topPinsRes = await fetch(
            `${base}/v5/user_account/top_pins_analytics?start_date=${startDate}&end_date=${endDate}&metric_types=IMPRESSION&num_of_pins=10&sort_by=IMPRESSION`,
            { headers }
        )
        let topPins: {
            pinId: string
            title: string
            imageUrl: string | null
            impressions: number
            saves: number
            clicks: number
            pinUrl: string
        }[] = []
        if (topPinsRes.ok) {
            const topPinsData = await topPinsRes.json()
            topPins = (topPinsData.pins_results || []).map((p: Record<string, unknown>) => {
                const metrics = (p.metrics as Record<string, number>) || {}
                const pinData = (p.data_status as Record<string, unknown>) || {}
                return {
                    pinId: String(p.pin_id || ''),
                    title: String(p.description || p.title || ''),
                    imageUrl: (p.media as Record<string, string>)?.images?.['150x150']?.url || null,
                    impressions: metrics.IMPRESSION || 0,
                    saves: metrics.SAVE || 0,
                    clicks: (metrics.PIN_CLICK || 0) + (metrics.OUTBOUND_CLICK || 0),
                    pinUrl: `https://www.pinterest.com/pin/${p.pin_id || ''}`,
                    ...(pinData && {}),
                }
            })
        }

        return {
            platform: 'pinterest',
            accountName,
            followers,
            engagement,
            impressions,
            reach: impressions, // Pinterest doesn't have separate "reach" — use impressions as proxy
            saves,
            topPins,
        }
    } catch (err) {
        console.error('[Pinterest Insights]', err)
        return null
    }
}


// ─── Post-level insights ─────────────────────────────────────────────
// Fetches live stats for recently published posts from each platform API
async function fetchPostInsights(
    channelId: string | null,
    userChannelIds: string[] | null,
    platformCredentials: { platform: string; accountId: string; accessToken: string | null; config: unknown }[]
) {
    const buildWhere = () => {
        if (channelId) return { post: { channelId }, status: 'published' as const }
        if (userChannelIds !== null) return { post: { channelId: { in: userChannelIds } }, status: 'published' as const }
        return { status: 'published' as const }
    }

    const publishedStatuses = await prisma.postPlatformStatus.findMany({
        where: buildWhere(),
        select: {
            id: true,
            platform: true,
            externalId: true,
            publishedAt: true,
            config: true,
            post: {
                select: {
                    id: true,
                    content: true,
                    media: {
                        take: 1,
                        select: { mediaItem: { select: { url: true, thumbnailUrl: true } } },
                    },
                },
            },
        },
        orderBy: { publishedAt: 'desc' },
        take: 30,
    })

    // Build credential lookup by platform
    const credMap: Record<string, typeof platformCredentials[0]> = {}
    for (const cred of platformCredentials) {
        credMap[cred.platform] = cred
    }

    // Fetch fresh stats for FB/IG/TikTok
    const facebookToken = credMap['facebook']?.accessToken
    const instagramToken = credMap['instagram']?.accessToken
    const instagramCfg = (credMap['instagram']?.config as Record<string, string>) || {}
    const igAccountId = instagramCfg.instagramAccountId || credMap['instagram']?.accountId
    const tiktokToken = credMap['tiktok']?.accessToken

    // Prefetch TikTok video list (batch, not per-post)
    const tiktokVideoMap: Record<string, { likes: number; comments: number; shares: number; views: number }> = {}
    if (tiktokToken) {
        try {
            const res = await fetch(
                'https://open.tiktokapis.com/v2/video/list/?fields=id,view_count,like_count,comment_count,share_count',
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${tiktokToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
                    body: JSON.stringify({ max_count: 20 }),
                }
            )
            const data = await res.json()
            for (const v of data.data?.videos || []) {
                tiktokVideoMap[v.id] = {
                    likes: v.like_count || 0,
                    comments: v.comment_count || 0,
                    shares: v.share_count || 0,
                    views: v.view_count || 0,
                }
            }
        } catch { /* ignore */ }
    }

    const results = await Promise.all(
        publishedStatuses.map(async (ps) => {
            const cfg = (ps.config as Record<string, unknown>) || {}
            let likes = (cfg.likes as number) ?? 0
            let comments = (cfg.comments as number) ?? 0
            let shares = (cfg.shares as number) ?? 0
            let reach = (cfg.reach as number) ?? 0
            let impressions = (cfg.impressions as number) ?? 0

            try {
                if (ps.platform === 'facebook' && facebookToken && ps.externalId) {
                    // Per-post Facebook insights
                    const res = await fetch(
                        `https://graph.facebook.com/v21.0/${ps.externalId}/insights?metric=post_impressions_unique,post_impressions,post_reactions_by_type_total,post_clicks&access_token=${facebookToken}`
                    )
                    const data = await res.json()
                    if (data.data) {
                        for (const m of data.data) {
                            if (m.name === 'post_reactions_by_type_total') {
                                const vals = m.values?.[0]?.value || {}
                                likes = Object.values(vals).reduce((a: number, v) => a + (v as number), 0)
                            }
                            if (m.name === 'post_impressions_unique') reach = m.values?.[0]?.value || 0
                            if (m.name === 'post_impressions') impressions = m.values?.[0]?.value || 0
                        }
                        // Fetch comments count separately
                        const commRes = await fetch(
                            `https://graph.facebook.com/v21.0/${ps.externalId}?fields=comments.summary(true)&access_token=${facebookToken}`
                        )
                        const commData = await commRes.json()
                        comments = commData.comments?.summary?.total_count || comments
                    }
                } else if (ps.platform === 'instagram' && instagramToken && ps.externalId && igAccountId) {
                    // Instagram media fields (no insights endpoint needed for basic counts)
                    const res = await fetch(
                        `https://graph.facebook.com/v21.0/${ps.externalId}?fields=like_count,comments_count,media_product_type&access_token=${instagramToken}`
                    )
                    const data = await res.json()
                    if (!data.error) {
                        likes = data.like_count || 0
                        comments = data.comments_count || 0
                        // Try media insights for reach/impressions
                        const insRes = await fetch(
                            `https://graph.facebook.com/v21.0/${ps.externalId}/insights?metric=impressions,reach&access_token=${instagramToken}`
                        )
                        const insData = await insRes.json()
                        for (const m of insData.data || []) {
                            if (m.name === 'impressions') impressions = m.values?.[0]?.value || 0
                            if (m.name === 'reach') reach = m.values?.[0]?.value || 0
                        }
                    }
                } else if (ps.platform === 'tiktok' && ps.externalId && tiktokVideoMap[ps.externalId]) {
                    const v = tiktokVideoMap[ps.externalId]
                    likes = v.likes
                    comments = v.comments
                    shares = v.shares
                    reach = v.views
                    impressions = v.views
                } else if (ps.platform === 'pinterest' && credMap['pinterest']?.accessToken && ps.externalId) {
                    // Pinterest pin analytics — GET /v5/pins/{pin_id}/analytics
                    const pinToken = credMap['pinterest'].accessToken
                    const endDate = new Date().toISOString().split('T')[0]
                    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
                    const pinRes = await fetch(
                        `https://api.pinterest.com/v5/pins/${ps.externalId}/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE`,
                        { headers: { Authorization: `Bearer ${pinToken}` } }
                    )
                    if (pinRes.ok) {
                        const pinData = await pinRes.json()
                        const summary = pinData.all?.summary_metrics || {}
                        impressions = summary.IMPRESSION || 0
                        likes = summary.PIN_CLICK || 0
                        shares = summary.SAVE || 0
                        reach = impressions
                    }
                }
            } catch { /* fall back to cfg values */ }

            // Persist fresh stats back to config (fire-and-forget)
            if (likes || comments || shares || reach || impressions) {
                void prisma.postPlatformStatus.update({
                    where: { id: ps.id },
                    data: { config: { ...cfg, likes, comments, shares, reach, impressions } },
                }).catch(() => { /* non-blocking */ })
            }

            return {
                postId: ps.post.id,
                platform: ps.platform,
                externalId: ps.externalId,
                publishedAt: ps.publishedAt,
                content: ps.post.content?.slice(0, 100),
                thumbnail: ps.post.media[0]?.mediaItem?.thumbnailUrl || ps.post.media[0]?.mediaItem?.url || null,
                likes,
                comments,
                shares,
                reach,
                impressions,
            }
        })
    )

    return results
}

// ─── Main Handler ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId')

    const isAdmin = session.user.role === 'ADMIN'
    const userId = session.user.id

    let userChannelIds: string[] | null = null
    if (!isAdmin) {
        const memberships = await prisma.channelMember.findMany({
            where: { userId, role: { notIn: ['CUSTOMER'] } },
            select: { channelId: true },
        })
        userChannelIds = memberships.map(m => m.channelId)
    }

    if (channelId && userChannelIds !== null && !userChannelIds.includes(channelId)) {
        return NextResponse.json({ platformInsights: [], postInsights: [] })
    }

    // Fetch connected active platforms
    const platforms = await prisma.channelPlatform.findMany({
        where: channelId
            ? { channelId, isActive: true }
            : userChannelIds !== null
                ? { channelId: { in: userChannelIds }, isActive: true }
                : { isActive: true },
        select: {
            platform: true,
            accountId: true,
            accountName: true,
            accessToken: true,
            config: true,
        },
    })

    // Fetch platform-level insights in parallel
    const insights = await Promise.all(
        platforms.map(async (cp) => {
            if (cp.platform === 'facebook') return fetchFacebookInsights(cp)
            if (cp.platform === 'instagram') return fetchInstagramInsights(cp)
            if (cp.platform === 'youtube') return fetchYouTubeInsights(cp)
            if (cp.platform === 'tiktok') return fetchTikTokInsights(cp)
            if (cp.platform === 'pinterest') return fetchPinterestInsights(cp)
            // LinkedIn — API not yet active
            return {
                platform: cp.platform,
                accountName: cp.accountName,
                followers: null,
                engagement: null,
                impressions: null,
                reach: null,
                pendingApproval: true,
            }
        })
    )

    const postInsights = await fetchPostInsights(channelId, userChannelIds, platforms)

    return NextResponse.json({
        platformInsights: insights.filter(Boolean),
        postInsights,
    })
}
