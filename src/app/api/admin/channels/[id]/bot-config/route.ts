import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/channels/[id]/bot-config
 * Fetch bot configuration for a channel
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params

    const config = await prisma.botConfig.findUnique({
        where: { channelId },
    })

    if (!config) {
        // Return defaults
        return NextResponse.json({
            isEnabled: true,
            botName: 'AI Assistant',
            greeting: '',
            greetingMode: 'template',
            greetingImages: [],
            personality: '',
            language: 'vi',
            imageFolderId: null,
            consultVideos: [],
            confidenceThreshold: 0.7,
            maxBotReplies: 10,
            autoTagEnabled: true,
            sentimentEnabled: true,
            spamFilterEnabled: true,
            autoTranslate: false,
            smartAssignEnabled: false,
            autoEscalateKeywords: [],
            forbiddenTopics: [],
            workingHoursOnly: false,
            workingHoursStart: null,
            workingHoursEnd: null,
            offHoursMessage: null,
            trainingPairs: [],
            exampleConvos: [],
            enabledPlatforms: ['all'],
            applyToComments: true,
            applyToMessages: true,
            commentReplyMinDelay: 30,
            commentReplyMaxDelay: 600,
            agentLearning: {},
            lastLearnedAt: null,
        })
    }

    return NextResponse.json(config)
}

/**
 * PUT /api/admin/channels/[id]/bot-config
 * Create or update bot configuration for a channel
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params
    const body = await req.json()

    // Allowed fields
    const allowedFields = [
        'isEnabled', 'botName', 'botAvatarUrl', 'greeting', 'greetingMode', 'greetingImages', 'personality', 'language',
        'imageFolderId', 'consultVideos',
        'confidenceThreshold', 'maxBotReplies', 'botModel',
        'autoTagEnabled', 'sentimentEnabled', 'spamFilterEnabled', 'autoTranslate', 'smartAssignEnabled',
        'autoEscalateKeywords', 'forbiddenTopics',
        'workingHoursOnly', 'workingHoursStart', 'workingHoursEnd', 'offHoursMessage',
        'trainingPairs', 'exampleConvos',
        'enabledPlatforms', 'applyToComments', 'applyToMessages',
        'commentReplyMinDelay', 'commentReplyMaxDelay',
        'agentLearning', 'lastLearnedAt',
        'enableSmartMemory', 'sessionTimeoutHours', 'summariesBeforeMerge',
        // Notification integrations
        'telegramEnabled', 'telegramBotToken', 'telegramChatId', 'telegramEvents',
        'discordEnabled', 'discordWebhookUrl', 'discordEvents',
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    for (const key of allowedFields) {
        if (body[key] !== undefined) {
            data[key] = body[key]
        }
    }

    const config = await prisma.botConfig.upsert({
        where: { channelId },
        update: data,
        create: {
            channelId,
            ...data,
        },
    })

    // ── Pre-create Telegram virtual ChannelPlatform ──
    // Telegram ChannelPlatform is needed for the Inbox sidebar to show "Telegram".
    // Without this, it only gets created on first webhook message (too late).
    const savedToken = data.telegramBotToken ?? config.telegramBotToken
    if (savedToken) {
        const botTokenPrefix = savedToken.split(':')[0]
        const virtualAccountId = `telegram_bot_${botTokenPrefix}`
        await prisma.channelPlatform.upsert({
            where: {
                channelId_platform_accountId: {
                    channelId,
                    platform: 'telegram',
                    accountId: virtualAccountId,
                },
            },
            update: {
                accessToken: savedToken,
                isActive: true,
            },
            create: {
                channelId,
                platform: 'telegram',
                accountId: virtualAccountId,
                accountName: 'Telegram Bot',
                accessToken: savedToken,
                isActive: true,
                config: { botEnabled: true },
            },
        })
        console.log(`[BotConfig] ✅ Telegram ChannelPlatform upserted for channel ${channelId}`)
    } else if (body.telegramBotToken === '' || body.telegramBotToken === null) {
        // Token was cleared — deactivate Telegram platform
        await prisma.channelPlatform.updateMany({
            where: { channelId, platform: 'telegram' },
            data: { isActive: false },
        })
    }

    return NextResponse.json(config)
}
