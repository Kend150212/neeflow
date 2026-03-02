import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkIntegrationAccess } from '@/lib/integration-access'

function encryptPassword(password: string): string {
    return Buffer.from(password).toString('base64')
}

// GET — load config for the current user
export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id as string
    if (!await checkIntegrationAccess(userId, 'external_db'))
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma as any).externalDbConfig.findFirst({
        where: { userId },
        include: {
            channelLinks: { select: { channelId: true, schemaHint: true } },
        },
    })

    if (!config) return NextResponse.json({ config: null })

    return NextResponse.json({
        config: { ...config, password: config.password ? '••••••••' : null },
    })
}

// POST — save / update config
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id as string
    if (!await checkIntegrationAccess(userId, 'external_db'))
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.' }, { status: 403 })
    const body = await req.json()
    const { dbType, host, port, database, username, password, ssl, queryTimeout, schemaHint, channelIds, testStatus, botQueryEnabled, botQueryTables, botMaxRows } = body

    if (!dbType || !database) {
        return NextResponse.json({ error: 'dbType and database are required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).externalDbConfig.findFirst({ where: { userId } })

    const encryptedPassword = password && password !== '••••••••'
        ? encryptPassword(password)
        : existing?.password ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma as any).externalDbConfig.upsert({
        where: { id: existing?.id ?? '__new__' },
        create: {
            userId,
            dbType,
            host: host || null,
            port: port ? parseInt(port) : null,
            database,
            username: username || null,
            password: encryptedPassword,
            ssl: !!ssl,
            queryTimeout: queryTimeout ?? 5000,
            schemaHint: schemaHint || null,
            testStatus: testStatus ?? null,
            botQueryEnabled: botQueryEnabled ?? false,
            botQueryTables: botQueryTables ?? [],
            botMaxRows: botMaxRows ?? 10,
        },
        update: {
            dbType,
            host: host || null,
            port: port ? parseInt(port) : null,
            database,
            username: username || null,
            password: encryptedPassword,
            ssl: !!ssl,
            queryTimeout: queryTimeout ?? 5000,
            schemaHint: schemaHint || null,
            ...(testStatus !== undefined ? { testStatus } : {}),
            ...(botQueryEnabled !== undefined ? { botQueryEnabled } : {}),
            ...(botQueryTables !== undefined ? { botQueryTables } : {}),
            ...(botMaxRows !== undefined ? { botMaxRows } : {}),
        },
    })

    if (channelIds && Array.isArray(channelIds)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).externalDbChannelLink.deleteMany({ where: { configId: config.id } })
        if (channelIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).externalDbChannelLink.createMany({
                data: channelIds.map((channelId: string) => ({ configId: config.id, channelId })),
                skipDuplicates: true,
            })
        }
    }

    return NextResponse.json({ success: true, configId: config.id })
}
