/**
 * Next.js Instrumentation Hook — runs once at server startup (Node.js runtime only).
 * Loads dynamic credentials from the database into process.env so that
 * next-auth providers (Google OAuth) pick them up on the next request.
 *
 * Also starts the in-process product sync scheduler (node-cron).
 *
 * Docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    try {
        // Dynamic imports to avoid edge-runtime bundling
        const { PrismaClient } = await import('@prisma/client')
        const { PrismaPg } = await import('@prisma/adapter-pg')
        const pg = await import('pg')
        const CryptoJS = await import('crypto-js')

        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars-min!!'

        function decrypt(encryptedValue: string): string {
            try {
                const bytes = CryptoJS.AES.decrypt(encryptedValue, ENCRYPTION_KEY)
                return bytes.toString(CryptoJS.enc.Utf8)
            } catch {
                return ''
            }
        }

        const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL })
        const adapter = new PrismaPg(pool)
        const prisma = new PrismaClient({ adapter })

        // Load Google OAuth credentials
        const googleOAuth = await prisma.apiIntegration.findFirst({
            where: { provider: 'google_oauth', status: 'ACTIVE' },
        })

        if (googleOAuth) {
            const config = googleOAuth.config as Record<string, string> | null
            const clientId = config?.clientId
            const clientSecret = googleOAuth.apiKeyEncrypted
                ? decrypt(googleOAuth.apiKeyEncrypted)
                : null

            if (clientId && clientSecret) {
                process.env.GOOGLE_CLIENT_ID = clientId
                process.env.GOOGLE_CLIENT_SECRET = clientSecret
                console.log('[instrumentation] ✅ Google OAuth credentials loaded')
            } else {
                console.log('[instrumentation] ⚠️  Google OAuth integration found but missing clientId or clientSecret')
            }
        } else {
            console.log('[instrumentation] ℹ️  Google OAuth integration not active, skipping')
        }

        await prisma.$disconnect()
        await pool.end()
    } catch (err) {
        console.error('[instrumentation] Failed to load credentials:', err)
    }

    // ── Start in-process product sync scheduler ──────────────────────────────
    // Reads hour from .sync-schedule.json (created when user sets schedule in UI)
    // Defaults to 2:00 AM UTC daily if no config file exists.
    try {
        const { startSyncScheduler } = await import('@/lib/sync-scheduler')
        startSyncScheduler()
    } catch (err) {
        console.error('[instrumentation] Failed to start sync scheduler:', err)
    }
}
