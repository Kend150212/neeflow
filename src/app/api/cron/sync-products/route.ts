/**
 * Daily Product Catalog Sync — /api/cron/sync-products
 *
 * Syncs all Shopify / Etsy / WordPress integrations to ProductCatalog.
 * Called by system cron (recommended: once daily at off-peak hours).
 *
 * Example cron entry (server):
 *   0 2 * * * curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/sync-products
 *
 * Protected by x-cron-secret header (same as /api/cron).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncShopifyProducts, syncEtsyProducts, syncWordPressProducts } from '@/lib/integration-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Allow up to 5 minutes for bulk syncing many channels
export const maxDuration = 300

export async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET || ''
    if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: Record<string, { shopify?: object; etsy?: object; wordpress?: object }> = {}
    const errors: string[] = []

    // ── Shopify ─────────────────────────────────────────────────────────────
    const shopifyConfigs = await prisma.shopifyConfig.findMany({
        select: { channelId: true, shopDomain: true },
    })

    for (const cfg of shopifyConfigs) {
        try {
            const r = await syncShopifyProducts(cfg.channelId)
            if (!results[cfg.channelId]) results[cfg.channelId] = {}
            results[cfg.channelId].shopify = r
            console.log(`[CronSync] Shopify ${cfg.shopDomain}: synced=${r.synced} failed=${r.failed}`)
        } catch (err) {
            const msg = `Shopify ${cfg.shopDomain}: ${String(err)}`
            errors.push(msg)
            console.error('[CronSync]', msg)
        }
    }

    // ── Etsy ─────────────────────────────────────────────────────────────────
    const etsyConfigs = await (prisma as any).etsyConfig.findMany({
        select: { channelId: true, shopId: true },
    })

    for (const cfg of etsyConfigs) {
        try {
            const r = await syncEtsyProducts(cfg.channelId)
            if (!results[cfg.channelId]) results[cfg.channelId] = {}
            results[cfg.channelId].etsy = r
            console.log(`[CronSync] Etsy shop=${cfg.shopId}: synced=${r.synced} failed=${r.failed}`)
        } catch (err) {
            const msg = `Etsy shop=${cfg.shopId}: ${String(err)}`
            errors.push(msg)
            console.error('[CronSync]', msg)
        }
    }

    // ── WordPress ─────────────────────────────────────────────────────────────
    const wpConfigs = await (prisma as any).wordPressConfig.findMany({
        select: { channelId: true, siteUrl: true },
    })

    for (const cfg of wpConfigs) {
        try {
            const r = await syncWordPressProducts(cfg.channelId)
            if (!results[cfg.channelId]) results[cfg.channelId] = {}
            results[cfg.channelId].wordpress = r
            console.log(`[CronSync] WordPress ${cfg.siteUrl}: synced=${r.synced} failed=${r.failed}`)
        } catch (err) {
            const msg = `WordPress ${cfg.siteUrl}: ${String(err)}`
            errors.push(msg)
            console.error('[CronSync]', msg)
        }
    }

    return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        channelsProcessed: Object.keys(results).length,
        results,
        errors: errors.length > 0 ? errors : undefined,
    })
}
