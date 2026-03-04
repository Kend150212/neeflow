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

    return NextResponse.json(config)
}
