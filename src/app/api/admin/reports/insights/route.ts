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
        // 1. Page-level info (followers + basic fields)
        const pageRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}?fields=followers_count,fan_count,name,about,picture{url}&access_token=${token}`
        )
        const pageData = await pageRes.json()
        if (pageData.error) {
            console.error('[Facebook] Page info error:', pageData.error)
            return null
        }
        // fan_count is more reliable than followers_count for new Pages experience
        const followerCount = pageData.fan_count ?? pageData.followers_count ?? 0
        console.log(`[Facebook] Page ${pageId}: fan_count=${pageData.fan_count}, followers_count=${pageData.followers_count}`)


        // 2. Page insights — use metrics that are NOT deprecated as of 2025
        //    - page_views_total: total profile views (period=days_28)
        //    - page_fan_adds_unique: unique new followers (period=days_28)
        //    - page_media_view: views (replaces page_impressions, Nov 2025)
        // We request period=days_28 for cumulative totals
        const insightsRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_views_total,page_fan_adds_unique,page_media_view&period=days_28&access_token=${token}`
        )
        const insightsData = await insightsRes.json()

        let totalViews = 0, totalReach = 0, newFollowers = 0
        if (insightsData.data) {
            for (const metric of insightsData.data) {
                // period=days_28 returns single value array
                const val = metric.values?.[metric.values.length - 1]?.value || 0
                if (metric.name === 'page_views_total') totalViews = val
                if (metric.name === 'page_fan_adds_unique') newFollowers = val
                if (metric.name === 'page_media_view') totalReach = val
            }
        }

        // 3. Engagement from recent posts (reactions + comments + shares)
        //    This is the most reliable way — avoids deprecated engagement metrics
        const postsRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}/posts?fields=reactions.summary(true),comments.summary(true),shares,message,created_time,full_picture,attachments{media_type}&limit=50&access_token=${token}`
        )
        const postsData = await postsRes.json()
        let totalEngagement = 0
        let totalComments = 0
        let totalReactions = 0
        let totalShares = 0
        const recentPosts: {
            id: string
            message: string
            createdTime: string
            thumbnail: string | null
            reactions: number
            comments: number
            shares: number
        }[] = []

        for (const post of postsData.data || []) {
            const reactions = post.reactions?.summary?.total_count || 0
            const comments = post.comments?.summary?.total_count || 0
            const shares = post.shares?.count || 0
            totalReactions += reactions
            totalComments += comments
            totalShares += shares
            totalEngagement += reactions + comments + shares
            recentPosts.push({
                id: post.id,
                message: (post.message || '').slice(0, 120),
                createdTime: post.created_time,
                thumbnail: post.full_picture || post.attachments?.data?.[0]?.media?.image?.src || null,
                reactions,
                comments,
                shares,
            })
        }

        // 4. Daily time-series for Views chart (last 28 days)
        const since28 = Math.floor(Date.now() / 1000) - 28 * 24 * 3600
        const until28 = Math.floor(Date.now() / 1000)
        let viewsTimeSeries: { date: string; value: number }[] = []
        let interactionsTimeSeries: { date: string; value: number }[] = []
        try {
            const dailyRes = await fetch(
                `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_views_total&period=day&since=${since28}&until=${until28}&access_token=${token}`
            )
            const dailyData = await dailyRes.json()
            if (dailyData.data?.[0]?.values) {
                viewsTimeSeries = dailyData.data[0].values.map((v: { end_time: string; value: number }) => ({
                    date: v.end_time.split('T')[0],
                    value: v.value || 0,
                }))
            }
        } catch { /* non-critical */ }

        // Build interaction time-series from posts (approximate per-day grouping)
        const interactionsByDay: Record<string, number> = {}
        for (const post of recentPosts) {
            const day = post.createdTime.split('T')[0]
            interactionsByDay[day] = (interactionsByDay[day] || 0) + post.reactions + post.comments + post.shares
        }
        interactionsTimeSeries = Object.entries(interactionsByDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, value]) => ({ date, value }))

        // 5. Content type breakdown from posts attachments
        const contentTypeCount: Record<string, number> = { photo: 0, video: 0, reel: 0, multi_photo: 0, text: 0, other: 0 }
        for (const post of (postsData.data || [])) {
            const mediaType = post.attachments?.data?.[0]?.media_type || 'text'
            if (mediaType === 'photo') contentTypeCount.photo++
            else if (mediaType === 'video_inline') contentTypeCount.video++
            else if (mediaType === 'video') contentTypeCount.video++
            else if (mediaType === 'multi_share') contentTypeCount.multi_photo++
            else if (mediaType === 'share') contentTypeCount.other++
            else contentTypeCount.text++
        }
        const totalPosts28 = Object.values(contentTypeCount).reduce((a, b) => a + b, 0)
        const contentTypeBreakdown = Object.entries(contentTypeCount)
            .filter(([, c]) => c > 0)
            .map(([type, count]) => ({ type, count, pct: totalPosts28 ? Math.round(count / totalPosts28 * 1000) / 10 : 0 }))
            .sort((a, b) => b.count - a.count)

        // 6. Unfollows from page_fan_removes_unique 
        let unfollows = 0
        try {
            const unfollowsRes = await fetch(
                `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_fan_removes_unique&period=days_28&access_token=${token}`
            )
            const unfollowsData = await unfollowsRes.json()
            if (unfollowsData.data?.[0]?.values) {
                const vals = unfollowsData.data[0].values
                unfollows = vals[vals.length - 1]?.value || 0
            }
        } catch { /* non-critical */ }

        return {
            platform: 'facebook',
            accountName: pageData.name || channelPlatform.accountName,
            followers: followerCount,
            newFollowers,
            unfollows,
            engagement: totalEngagement,
            reactions: totalReactions,
            comments: totalComments,
            shares: totalShares,
            views: totalViews,
            impressions: totalViews,
            reach: totalReach,
            viewsTimeSeries,
            interactionsTimeSeries,
            contentTypeBreakdown,
            recentPosts,
        }
    } catch (err) {
        console.error('[Facebook] fetchFacebookInsights error:', err)
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
        // 1. Account info + profile summary
        const accountRes = await fetch(
            `https://graph.facebook.com/v21.0/${igAccountId}?fields=followers_count,media_count,username,profile_picture_url&access_token=${token}`
        )
        const accountData = await accountRes.json()
        if (accountData.error) {
            console.error('[Instagram] Account info error:', accountData.error)
            return null
        }

        // 2. Account-level insights — period=days_28
        //    - views: replaces impressions for new content (v21+)
        //    - reach: unique accounts that saw content
        //    NOTE: impressions deprecated for v22+ and new media after July 2024
        const insightRes = await fetch(
            `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=views,reach&period=days_28&access_token=${token}`
        )
        const insightData = await insightRes.json()

        let totalViews = 0, totalReach = 0
        if (insightData.data && !insightData.error) {
            for (const metric of insightData.data) {
                const val = metric.values?.[metric.values.length - 1]?.value || 0
                if (metric.name === 'views') totalViews = val
                if (metric.name === 'reach') totalReach = val
            }
        } else if (insightData.error) {
            // Fallback to impressions for older accounts
            console.warn('[Instagram] views metric failed, trying impressions fallback')
            const fallbackRes = await fetch(
                `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=impressions,reach&period=days_28&access_token=${token}`
            )
            const fallbackData = await fallbackRes.json()
            if (fallbackData.data) {
                for (const metric of fallbackData.data) {
                    const val = metric.values?.[metric.values.length - 1]?.value || 0
                    if (metric.name === 'impressions') totalViews = val
                    if (metric.name === 'reach') totalReach = val
                }
            }
        }

        // 3. Recent media — likes, comments, views/impressions per post
        const mediaRes = await fetch(
            `https://graph.facebook.com/v21.0/${igAccountId}/media?fields=id,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,caption&limit=50&access_token=${token}`
        )
        const mediaData = await mediaRes.json()
        let totalEngagement = 0
        let totalLikes = 0
        let totalComments = 0
        const recentMedia: {
            id: string
            mediaType: string
            thumbnail: string | null
            timestamp: string
            likes: number
            comments: number
            caption: string
        }[] = []

        for (const media of mediaData.data || []) {
            const likes = media.like_count || 0
            const comments = media.comments_count || 0
            totalLikes += likes
            totalComments += comments
            totalEngagement += likes + comments
            recentMedia.push({
                id: media.id,
                mediaType: media.media_type || 'IMAGE',
                thumbnail: media.thumbnail_url || media.media_url || null,
                timestamp: media.timestamp,
                likes,
                comments,
                caption: (media.caption || '').slice(0, 120),
            })
        }

        // 4. Daily views time-series (last 28 days)
        const since28 = Math.floor(Date.now() / 1000) - 28 * 24 * 3600
        const until28 = Math.floor(Date.now() / 1000)
        let viewsTimeSeries: { date: string; value: number }[] = []
        try {
            const dailyRes = await fetch(
                `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=views&period=day&since=${since28}&until=${until28}&access_token=${token}`
            )
            const dailyData = await dailyRes.json()
            if (dailyData.data?.[0]?.values) {
                viewsTimeSeries = dailyData.data[0].values.map((v: { end_time: string; value: number }) => ({
                    date: v.end_time.split('T')[0],
                    value: v.value || 0,
                }))
            } else {
                // Fallback: try impressions for older accounts
                const dailyFb = await fetch(
                    `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=impressions&period=day&since=${since28}&until=${until28}&access_token=${token}`
                )
                const dailyFbData = await dailyFb.json()
                if (dailyFbData.data?.[0]?.values) {
                    viewsTimeSeries = dailyFbData.data[0].values.map((v: { end_time: string; value: number }) => ({
                        date: v.end_time.split('T')[0],
                        value: v.value || 0,
                    }))
                }
            }
        } catch { /* non-critical */ }

        // 5. Interactions time-series — group recentMedia by day
        const interactionsByDay: Record<string, number> = {}
        for (const m of recentMedia) {
            const day = m.timestamp.split('T')[0]
            interactionsByDay[day] = (interactionsByDay[day] || 0) + m.likes + m.comments
        }
        const interactionsTimeSeries = Object.entries(interactionsByDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, value]) => ({ date, value }))

        // 6. Content type breakdown from recentMedia (IMAGE / VIDEO / REEL / CAROUSEL_ALBUM)
        const ctCount: Record<string, number> = { photo: 0, video: 0, reel: 0, multi_photo: 0, other: 0 }
        for (const m of recentMedia) {
            const mt = (m.mediaType || '').toUpperCase()
            if (mt === 'IMAGE') ctCount.photo++
            else if (mt === 'VIDEO') ctCount.video++
            else if (mt === 'REELS' || mt === 'REEL') ctCount.reel++
            else if (mt === 'CAROUSEL_ALBUM') ctCount.multi_photo++
            else ctCount.other++
        }
        const totalIgPosts = Object.values(ctCount).reduce((a, b) => a + b, 0)
        const contentTypeBreakdown = Object.entries(ctCount)
            .filter(([, c]) => c > 0)
            .map(([type, count]) => ({ type, count, pct: totalIgPosts ? Math.round(count / totalIgPosts * 1000) / 10 : 0 }))
            .sort((a, b) => b.count - a.count)

        // 7. Unfollows — IG Professional Dashboard exposes `unfollows` via insights
        let unfollows = 0
        try {
            const ufRes = await fetch(
                `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=unfollows&period=days_28&access_token=${token}`
            )
            const ufData = await ufRes.json()
            if (ufData.data?.[0]?.values) {
                const vals = ufData.data[0].values
                unfollows = vals[vals.length - 1]?.value || 0
            }
        } catch { /* non-critical */ }

        // 8. New followers from insights
        let newFollowers = 0
        try {
            const nfRes = await fetch(
                `https://graph.facebook.com/v21.0/${igAccountId}/insights?metric=follower_count&period=days_28&access_token=${token}`
            )
            const nfData = await nfRes.json()
            if (nfData.data?.[0]?.values) {
                const vals = nfData.data[0].values
                newFollowers = vals[vals.length - 1]?.value || 0
            }
        } catch { /* non-critical */ }

        return {
            platform: 'instagram',
            accountName: accountData.username || channelPlatform.accountName,
            followers: accountData.followers_count ?? 0,
            mediaCount: accountData.media_count ?? 0,
            impressions: totalViews,
            reach: totalReach,
            views: totalViews,
            engagement: totalEngagement,
            likes: totalLikes,
            comments: totalComments,
            newFollowers,
            unfollows,
            viewsTimeSeries,
            interactionsTimeSeries,
            contentTypeBreakdown,
            recentMedia,
        }
    } catch (err) {
        console.error('[Instagram] fetchInstagramInsights error:', err)
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

// ─── LinkedIn Community Management API ───────────────────────────────
/** Auto-generate LinkedIn API version (YYYYMM) — 1 month behind current date */
function getLinkedInVersion(): string {
    const now = new Date()
    now.setMonth(now.getMonth() - 1)
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}${m}`
}

async function fetchLinkedInInsights(channelPlatform: {
    accountId: string
    accountName: string
    accessToken: string | null
    config: unknown
}) {
    if (!channelPlatform.accessToken) return null
    const token = channelPlatform.accessToken
    const cfg = (channelPlatform.config as Record<string, string | boolean>) || {}
    const isOrg = cfg.type === 'organization'
    const orgId = isOrg ? String(cfg.orgId || channelPlatform.accountId.replace('org_', '')) : null
    const liVersion = getLinkedInVersion()
    const headers = {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': liVersion,
        'X-Restli-Protocol-Version': '2.0.0',
    }

    try {
        let followers = 0
        let engagement = 0
        let impressions = 0
        let reach = 0
        let accountName = channelPlatform.accountName

        if (isOrg && orgId) {
            // ── Organization analytics ──────────────────────────────
            const orgUrn = encodeURIComponent(`urn:li:organization:${orgId}`)

            // 1. Follower count via networkSizes
            const netRes = await fetch(
                `https://api.linkedin.com/rest/networkSizes/urn:li:organization:${orgId}?edgeType=CompanyFollowedByMember`,
                { headers }
            )
            if (netRes.ok) {
                const netData = await netRes.json()
                followers = netData.firstDegreeSize ?? 0
            }

            // 2. Follower gain stats (last 30 days)
            const endDate = new Date()
            const startDate = new Date(Date.now() - 30 * 86400000)
            const followerStatsRes = await fetch(
                `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${orgUrn}`,
                { headers }
            )
            if (followerStatsRes.ok) {
                try {
                    const fStats = await followerStatsRes.json()
                    const paginated = fStats.paginatedElements || fStats.elements || []
                    if (paginated.length > 0) {
                        const el = paginated[0]
                        const totalCounts = el.totalFollowerCounts || el.followerCounts || {}
                        if (!followers) followers = (totalCounts.organicFollowerCount || 0) + (totalCounts.paidFollowerCount || 0)
                    }
                } catch { /* best effort */ }
            }

            // 3. Share statistics (impressions, engagement) — requires r_organization_social
            const shareStatsRes = await fetch(
                `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${orgUrn}&timeIntervals.timeRange.start=${startDate.getTime()}&timeIntervals.timeRange.end=${endDate.getTime()}`,
                { headers }
            )
            if (shareStatsRes.ok) {
                try {
                    const ssData = await shareStatsRes.json()
                    const elements = ssData.elements || []
                    for (const el of elements) {
                        const stats = el.totalShareStatistics || {}
                        impressions += stats.impressionCount || 0
                        reach += stats.uniqueImpressionsCount || 0
                        engagement += (stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0)
                    }
                } catch { /* best effort */ }
            }

            // 4. Org name
            const orgRes = await fetch(`https://api.linkedin.com/rest/organizations/${orgId}?fields=localizedName`, { headers })
            if (orgRes.ok) {
                const orgData = await orgRes.json()
                if (orgData.localizedName) accountName = `🏢 ${orgData.localizedName}`
            }
        } else {
            // ── Personal profile analytics ──────────────────────────
            // Profile info via OpenID userinfo (already in openid+profile scope)
            const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (profileRes.ok) {
                const profile = await profileRes.json()
                accountName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || accountName
            }

            // Person follower count (memberFollowersCount — Community Management API)
            const memberUrn = encodeURIComponent(`urn:li:member:${channelPlatform.accountId}`)
            const followerRes = await fetch(
                `https://api.linkedin.com/rest/networkSizes/urn:li:member:${channelPlatform.accountId}?edgeType=FirstDegreeConnectionCount`,
                { headers }
            )
            if (followerRes.ok) {
                const fData = await followerRes.json()
                followers = fData.firstDegreeSize ?? 0
            }

            // Person share stats (if r_member_profileAnalytics in scope — best effort)
            const endTs = Date.now()
            const startTs = endTs - 30 * 86400000
            const personStatsRes = await fetch(
                `https://api.linkedin.com/rest/memberShareStatistics?q=memberAndTimeRange&timeRange=(start:${startTs},end:${endTs})`,
                { headers }
            )
            if (personStatsRes.ok) {
                try {
                    const psData = await personStatsRes.json()
                    for (const el of psData.elements || []) {
                        const stats = el.totalShareStatistics || {}
                        impressions += stats.impressionCount || 0
                        reach += stats.uniqueImpressionsCount || 0
                        engagement += (stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0)
                    }
                } catch { /* best effort */ }
            }

            void memberUrn // suppress unused warning
        }

        // 4. Daily impressions time-series (org only — requires r_organization_social)
        let viewsTimeSeries: { date: string; value: number }[] = []
        let interactionsTimeSeries: { date: string; value: number }[] = []
        let clicks = 0
        let newFollowers = 0

        if (isOrg && orgId) {
            const orgUrn = encodeURIComponent(`urn:li:organization:${orgId}`)
            const startDate = new Date(Date.now() - 28 * 86400000)
            const endDate = new Date()

            // Daily share stats time-series
            try {
                const dailyStatsRes = await fetch(
                    `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${orgUrn}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${startDate.getTime()}&timeIntervals.timeRange.end=${endDate.getTime()}`,
                    { headers }
                )
                if (dailyStatsRes.ok) {
                    const dData = await dailyStatsRes.json()
                    for (const el of dData.elements || []) {
                        const s = el.totalShareStatistics || {}
                        const d = el.timeRange?.start
                        if (d) {
                            const dateStr = new Date(d).toISOString().split('T')[0]
                            viewsTimeSeries.push({ date: dateStr, value: s.impressionCount || 0 })
                            interactionsTimeSeries.push({ date: dateStr, value: (s.likeCount || 0) + (s.commentCount || 0) + (s.shareCount || 0) })
                            clicks += s.clickCount || 0
                        }
                    }
                    viewsTimeSeries.sort((a, b) => a.date.localeCompare(b.date))
                    interactionsTimeSeries.sort((a, b) => a.date.localeCompare(b.date))
                }
            } catch { /* non-critical */ }

            // New followers (lifetimeFollowerGain from time-granular follower stats)
            try {
                const dailyFollRes = await fetch(
                    `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${orgUrn}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${startDate.getTime()}&timeIntervals.timeRange.end=${endDate.getTime()}`,
                    { headers }
                )
                if (dailyFollRes.ok) {
                    const dfData = await dailyFollRes.json()
                    for (const el of dfData.elements || []) {
                        newFollowers += (el.followerGains?.organicFollowerGain || 0) + (el.followerGains?.paidFollowerGain || 0)
                    }
                }
            } catch { /* non-critical */ }
        }

        // 5. Recent UGC posts (last 20) with per-post stats
        const recentPosts: {
            id: string
            text: string | null
            thumbnail: string | null
            publishedAt: string | null
            likes: number
            comments: number
            shares: number
            clicks: number
            impressions: number
            mediaType: string
        }[] = []

        try {
            const authorUrn = isOrg && orgId
                ? encodeURIComponent(`urn:li:organization:${orgId}`)
                : encodeURIComponent(`urn:li:person:${channelPlatform.accountId}`)

            const ugcRes = await fetch(
                `https://api.linkedin.com/rest/ugcPosts?q=authors&authors=List(${authorUrn})&count=20`,
                { headers }
            )
            if (ugcRes.ok) {
                const ugcData = await ugcRes.json()
                for (const post of ugcData.elements || []) {
                    const postUrn = encodeURIComponent(post.id || '')
                    const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text
                        || post.specificContent?.['com.linkedin.ugc.MemberNetworkVisibility']
                        || null
                    const media = post.specificContent?.['com.linkedin.ugc.ShareContent']?.media?.[0]
                    const thumbnail = media?.originalUrl || media?.thumbnails?.[0]?.url || null
                    const mediaType = media?.mediaCategory || 'TEXT'
                    const publishedAt = post.firstPublishedAt ? new Date(post.firstPublishedAt).toISOString() : null

                    // Per-post social actions (best-effort — requires r_organization_social or r_1st_connections_size)
                    let likes = 0, comments = 0, shares = 0, postClicks = 0, postImpressions = 0
                    try {
                        const saRes = await fetch(
                            `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${authorUrn}&shares=List(${postUrn})`,
                            { headers }
                        )
                        if (saRes.ok) {
                            const saData = await saRes.json()
                            const s = saData.elements?.[0]?.totalShareStatistics || {}
                            likes = s.likeCount || 0
                            comments = s.commentCount || 0
                            shares = s.shareCount || 0
                            postClicks = s.clickCount || 0
                            postImpressions = s.impressionCount || 0
                        }
                    } catch { /* non-critical */ }

                    recentPosts.push({ id: post.id, text, thumbnail, publishedAt, likes, comments, shares, clicks: postClicks, impressions: postImpressions, mediaType })
                }
            }
        } catch { /* non-critical */ }

        // 6. Content type breakdown from recent posts
        const ctCount: Record<string, number> = { article: 0, image: 0, video: 0, document: 0, text: 0, other: 0 }
        for (const p of recentPosts) {
            const mt = (p.mediaType || '').toUpperCase()
            if (mt === 'ARTICLE') ctCount.article++
            else if (mt === 'IMAGE') ctCount.image++
            else if (mt === 'VIDEO' || mt === 'NATIVE_VIDEO') ctCount.video++
            else if (mt === 'DOCUMENT') ctCount.document++
            else if (mt === 'NONE' || mt === 'TEXT' || !mt) ctCount.text++
            else ctCount.other++
        }
        const totalLiPosts = Object.values(ctCount).reduce((a, b) => a + b, 0)
        const contentTypeBreakdown = Object.entries(ctCount)
            .filter(([, c]) => c > 0)
            .map(([type, count]) => ({ type, count, pct: totalLiPosts ? Math.round(count / totalLiPosts * 1000) / 10 : 0 }))
            .sort((a, b) => b.count - a.count)

        const totalLikes = recentPosts.reduce((a, p) => a + p.likes, 0)
        const totalComments = recentPosts.reduce((a, p) => a + p.comments, 0)
        const totalShares = recentPosts.reduce((a, p) => a + p.shares, 0)

        return {
            platform: 'linkedin',
            accountName,
            followers,
            newFollowers,
            engagement,
            impressions,
            reach,
            clicks,
            likes: totalLikes,
            comments: totalComments,
            shares: totalShares,
            viewsTimeSeries,
            interactionsTimeSeries,
            contentTypeBreakdown,
            recentPosts,
        }
    } catch (err) {
        console.error('[LinkedIn] fetchLinkedInInsights error:', err)
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
                    imageUrl: ((p.media as Record<string, unknown>)?.images as Record<string, { url: string }>)?.[
                        '150x150'
                    ]?.url || null,
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
                    // Per-post Facebook metrics via post object fields (more reliable than insights endpoint)
                    // reactions.summary(true) = count of all reaction types
                    // comments.summary(true) = total comment count
                    // shares = share count
                    const res = await fetch(
                        `https://graph.facebook.com/v21.0/${ps.externalId}?fields=reactions.summary(true),comments.summary(true),shares,full_picture&access_token=${facebookToken}`
                    )
                    const data = await res.json()
                    if (!data.error) {
                        likes = data.reactions?.summary?.total_count || 0
                        comments = data.comments?.summary?.total_count || 0
                        shares = data.shares?.count || 0
                        // post_impressions_unique is still valid (deprecated Nov 2025) — attempt as reach
                        const insRes = await fetch(
                            `https://graph.facebook.com/v21.0/${ps.externalId}/insights?metric=post_impressions_unique,post_clicks&access_token=${facebookToken}`
                        )
                        const insData = await insRes.json()
                        if (insData.data && !insData.error) {
                            for (const m of insData.data) {
                                if (m.name === 'post_impressions_unique') reach = m.values?.[0]?.value || 0
                                if (m.name === 'post_clicks') impressions = m.values?.[0]?.value || 0
                            }
                        }
                        // Thumbnail from post if not already in db
                        if (data.full_picture && !ps.post.media[0]?.mediaItem?.thumbnailUrl) {
                            // Will be returned in the result even if not persisted
                        }
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
                    const pinUrl = `https://api.pinterest.com/v5/pins/${ps.externalId}/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE`
                    console.log(`[Pinterest] Fetching pin analytics: ${pinUrl}`)
                    const pinRes = await fetch(pinUrl, { headers: { Authorization: `Bearer ${pinToken}` } })
                    const pinData = await pinRes.json()
                    console.log(`[Pinterest] Pin ${ps.externalId} analytics status=${pinRes.status}:`, JSON.stringify(pinData).slice(0, 500))
                    if (pinRes.ok) {
                        // Pinterest API v5 returns: { "all": { "daily_metrics": [...], "summary_metrics": { "IMPRESSION": N, ... } } }
                        const summary = pinData.all?.summary_metrics
                            || pinData['ALL']?.summary_metrics
                            || pinData.summary_metrics
                            || {}
                        console.log(`[Pinterest] summary_metrics for pin ${ps.externalId}:`, JSON.stringify(summary))
                        impressions = summary.IMPRESSION ?? summary.impression ?? 0
                        likes = (summary.PIN_CLICK ?? summary.pin_click ?? 0) + (summary.OUTBOUND_CLICK ?? summary.outbound_click ?? 0)
                        shares = summary.SAVE ?? summary.save ?? 0
                        reach = impressions
                    }
                } else if (ps.platform === 'linkedin' && credMap['linkedin']?.accessToken && ps.externalId) {
                    // LinkedIn post social actions — uses the post URN stored as externalId
                    const liToken = credMap['linkedin'].accessToken
                    const liVersion = getLinkedInVersion()
                    const postUrn = ps.externalId // e.g. "urn:li:share:XXX" or "urn:li:ugcPost:XXX"
                    const liHeaders = {
                        Authorization: `Bearer ${liToken}`,
                        'LinkedIn-Version': liVersion,
                        'X-Restli-Protocol-Version': '2.0.0',
                    }
                    // socialActions returns likesSummary and commentsSummary
                    const socialRes = await fetch(
                        `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}`,
                        { headers: liHeaders }
                    )
                    if (socialRes.ok) {
                        const social = await socialRes.json()
                        likes = social.likesSummary?.totalLikes ?? social.likesSummary?.count ?? 0
                        comments = social.commentsSummary?.totalFirstLevelComments ?? social.commentsSummary?.count ?? 0
                        shares = social.sharesSummary?.count ?? 0
                        // Re-shares as reach proxy
                        reach = shares || 0
                    }
                    // Impressions for post — requires Marketing API, skip gracefully
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
            if (cp.platform === 'linkedin') return fetchLinkedInInsights(cp)
        })
    )

    const postInsights = await fetchPostInsights(channelId, userChannelIds, platforms)

    return NextResponse.json({
        platformInsights: insights.filter(Boolean),
        postInsights,
    })
}
