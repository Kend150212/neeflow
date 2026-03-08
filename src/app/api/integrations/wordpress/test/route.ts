import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

function makeBasicAuth(username: string, appPassword: string): string {
    return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64')
}

// POST /api/integrations/wordpress/test — test per-channel WP connection
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { channelId } = await req.json()
    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma as any).wordPressConfig.findUnique({ where: { channelId } })
    if (!config || !config.appPassword) {
        return NextResponse.json({ ok: false, error: 'No WordPress config found for this channel' })
    }

    const password = decrypt(config.appPassword)
    const auth_header = makeBasicAuth(config.username, password)
    const baseUrl = config.siteUrl.replace(/\/$/, '')

    try {
        // 1) Test WP REST API auth + get site info
        const [meRes, siteRes] = await Promise.all([
            fetch(`${baseUrl}/wp-json/wp/v2/users/me`, {
                headers: { Authorization: auth_header },
                signal: AbortSignal.timeout(10000),
            }),
            fetch(`${baseUrl}/wp-json`, {
                signal: AbortSignal.timeout(10000),
            }),
        ])

        if (!meRes.ok) {
            const msg = meRes.status === 401 ? 'Authentication failed — check username and Application Password'
                : meRes.status === 404 ? 'WordPress REST API not found — ensure pretty permalinks are enabled'
                    : `WordPress returned ${meRes.status}`
            return NextResponse.json({ ok: false, error: msg })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const siteData: any = siteRes.ok ? await siteRes.json() : {}
        const siteName: string = siteData.name || baseUrl
        const wpVersion: string = siteData.namespaces?.includes('wp/v2') ? 'WP REST API ✓' : 'Unknown'

        // 2) Check WooCommerce
        let wooInstalled = false
        try {
            const wooRes = await fetch(`${baseUrl}/wp-json/wc/v3/system_status`, {
                headers: { Authorization: auth_header },
                signal: AbortSignal.timeout(8000),
            })
            wooInstalled = wooRes.ok
        } catch { /* WooCommerce not installed */ }

        return NextResponse.json({ ok: true, siteName, wpVersion, wooInstalled })
    } catch (e) {
        return NextResponse.json({ ok: false, error: (e as Error).message })
    }
}
