import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkIntegrationAccess } from '@/lib/integration-access'
import { encrypt } from '@/lib/encryption'

// GET — load config for the current user + channel
export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id as string
    if (!await checkIntegrationAccess(userId, 'external_db'))
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.', messageVi: 'Nâng cấp gói để sử dụng tính năng External DB.' }, { status: 403 })

    const channelId = req.nextUrl.searchParams.get('channelId')
    if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma as any).externalDbConfig.findUnique({
        where: { userId_channelId: { userId, channelId } },
        include: {
            channelLinks: { select: { channelId: true, schemaHint: true } },
        },
    })

    if (!config) return NextResponse.json({ config: null })

    return NextResponse.json({
        config: { ...config, password: config.password ? '••••••••' : null },
    })
}

// POST — save / update config for this user + channel
export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id as string
    if (!await checkIntegrationAccess(userId, 'external_db'))
        return NextResponse.json({ error: 'Upgrade your plan to use External DB integration.', messageVi: 'Nâng cấp gói để sử dụng tính năng External DB.' }, { status: 403 })
    const body = await req.json()
    const { channelId, dbType, host, port, database, username, password, ssl, queryTimeout, schemaHint, testStatus, botQueryEnabled, botQueryTables, botMaxRows } = body

    if (!channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
    if (!dbType || !database) {
        return NextResponse.json({ error: 'dbType and database are required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).externalDbConfig.findUnique({
        where: { userId_channelId: { userId, channelId } },
    })

    const encryptedPassword = password && password !== '••••••••'
        ? encrypt(password)
        : existing?.password ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma as any).externalDbConfig.upsert({
        where: { userId_channelId: { userId, channelId } },
        create: {
            userId,
            channelId,
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

    return NextResponse.json({ success: true, configId: config.id })
}
