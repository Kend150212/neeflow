import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/cron/check-token-health
 * 
 * Periodically check that all Facebook/Instagram tokens are still valid.
 * If a token is invalid, mark the channelPlatform as needsReconnect.
 * Should be called via cron (e.g. every 6 hours).
 * 
 * Protections: CRON_SECRET header or query param required.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    // Auth: check cron secret
    const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
    const CRON_SECRET = process.env.CRON_SECRET || 'asocial_cron_2024'
    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active platform accounts with tokens (FB + IG)
    const platforms = await prisma.channelPlatform.findMany({
        where: {
            platform: { in: ['facebook', 'instagram'] },
            isActive: true,
            accessToken: { not: null },
        },
        select: {
            id: true,
            platform: true,
            accountId: true,
            accountName: true,
            accessToken: true,
            config: true,
            channel: { select: { id: true, name: true } },
        },
    })

    if (platforms.length === 0) {
        return NextResponse.json({ message: 'No active platform accounts found', results: [] })
    }

    const results: Array<{
        id: string
        platform: string
        name: string
        channelName: string
        healthy: boolean
        error?: string
    }> = []

    for (const p of platforms) {
        try {
            // For Facebook: check if page token works
            // For Instagram: check the backing page token
            const checkUrl = p.platform === 'facebook'
                ? `https://graph.facebook.com/v19.0/${p.accountId}?fields=id,name&access_token=${p.accessToken}`
                : `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${p.accessToken}`

            const res = await fetch(checkUrl)
            const data = await res.json()

            if (data.error) {
                // Token is broken — mark as needsReconnect
                const config = (p.config as any) || {}
                await prisma.channelPlatform.update({
                    where: { id: p.id },
                    data: {
                        config: {
                            ...config,
                            needsReconnect: true,
                            lastError: data.error.message,
                            lastErrorAt: new Date().toISOString(),
                            lastHealthCheck: new Date().toISOString(),
                        },
                    },
                })

                results.push({
                    id: p.id,
                    platform: p.platform,
                    name: p.accountName,
                    channelName: p.channel?.name || 'unknown',
                    healthy: false,
                    error: data.error.message,
                })
                console.warn(`[Token Health] ❌ ${p.platform}/${p.accountName} (channel: ${p.channel?.name}): ${data.error.message}`)
            } else {
                // Token is healthy — clear needsReconnect if was set
                const config = (p.config as any) || {}
                if (config.needsReconnect) {
                    await prisma.channelPlatform.update({
                        where: { id: p.id },
                        data: {
                            config: {
                                ...config,
                                needsReconnect: false,
                                lastHealthCheck: new Date().toISOString(),
                            },
                        },
                    })
                }

                results.push({
                    id: p.id,
                    platform: p.platform,
                    name: p.accountName,
                    channelName: p.channel?.name || 'unknown',
                    healthy: true,
                })
                console.log(`[Token Health] ✅ ${p.platform}/${p.accountName} (channel: ${p.channel?.name})`)
            }
        } catch (err: any) {
            results.push({
                id: p.id,
                platform: p.platform,
                name: p.accountName,
                channelName: p.channel?.name || 'unknown',
                healthy: false,
                error: `Network error: ${err.message}`,
            })
            console.error(`[Token Health] ❌ ${p.platform}/${p.accountName}:`, err.message)
        }
    }

    const healthy = results.filter(r => r.healthy).length
    const broken = results.filter(r => !r.healthy).length

    console.log(`[Token Health] Done: ${healthy} healthy, ${broken} broken out of ${results.length} total`)

    return NextResponse.json({
        message: `Token health check: ${healthy} healthy, ${broken} broken`,
        results,
    })
}
