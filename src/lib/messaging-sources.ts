/**
 * Messaging Source Registry — Extensible adapter pattern for SmartFlow content ingestion.
 * 
 * To add a new messaging source (e.g. Slack):
 * 1. Create an adapter implementing MessagingSource interface
 * 2. Add to MESSAGING_SOURCES array
 * 3. Create /api/webhook/{source}/route.ts calling ingestMedia()
 * Done — UI auto-renders, pipeline auto-processes.
 */

// ─── Types ────────────────────────────────────────────────

export interface SourceField {
    key: string
    label: string
    placeholder: string
    type: 'text' | 'password' | 'url'
    required: boolean
    helpText?: string
}

export interface IncomingMedia {
    fileUrl: string
    fileName: string
    mimeType: string
    fileSize?: number
    caption?: string
}

export interface MessagingSource {
    /** Unique key: 'telegram' | 'discord' | 'slack' */
    key: string
    /** Display name */
    label: string
    /** SVG path data for the platform logo */
    svgIcon: {
        viewBox: string
        paths: string[]
        fill?: string
    }
    /** Brand color hex */
    brandColor: string
    /** Tailwind color classes */
    color: { border: string; bg: string; text: string; gradient: string }
    /** Config fields required for connection */
    fields: SourceField[]
    /** Number of setup steps */
    setupStepsCount: number
    /** Validate config and return display name on success */
    validateConfig(config: Record<string, string>): Promise<{ valid: boolean; name?: string; error?: string }>
    /** Parse incoming webhook and extract media items */
    parseWebhook(body: unknown, config: Record<string, string>): Promise<{
        media: IncomingMedia[]
        replyPayload?: unknown
        senderId?: string
    }>
    /** Build reply payload to confirm receipt */
    buildReplyPayload?(config: Record<string, string>, message: string): { url: string; body: unknown; headers?: Record<string, string> }
    /** Register webhook URL with the platform (e.g. Telegram setWebhook) */
    registerWebhook?(config: Record<string, string>, webhookUrl: string): Promise<boolean>
    /** Unregister webhook when disconnecting */
    unregisterWebhook?(config: Record<string, string>): Promise<void>
}

// ─── Telegram Adapter ─────────────────────────────────────

const TELEGRAM_API = 'https://api.telegram.org/bot'

const telegramSource: MessagingSource = {
    key: 'telegram',
    label: 'Telegram',
    svgIcon: {
        viewBox: '0 0 24 24',
        paths: [
            'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
        ],
    },
    brandColor: '#26A5E4',
    color: { border: 'border-[#26A5E4]/30', bg: 'bg-[#26A5E4]/10', text: 'text-[#26A5E4]', gradient: 'from-[#26A5E4] to-[#0088cc]' },
    fields: [
        {
            key: 'botToken',
            label: 'Bot Token',
            placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
            type: 'password',
            required: true,
            helpText: 'Get from @BotFather after creating your bot',
        },
        {
            key: 'chatId',
            label: 'Chat ID',
            placeholder: '-1001234567890',
            type: 'text',
            required: true,
            helpText: 'Group/Channel ID where bot receives media',
        },
    ],
    setupStepsCount: 6,

    async validateConfig(config) {
        const { botToken } = config
        if (!botToken) return { valid: false, error: 'Bot Token is required' }

        try {
            const res = await fetch(`${TELEGRAM_API}${botToken}/getMe`)
            const data = await res.json()
            if (!data.ok) return { valid: false, error: data.description || 'Invalid bot token' }
            return { valid: true, name: `@${data.result.username}` }
        } catch {
            return { valid: false, error: 'Failed to connect to Telegram API' }
        }
    },

    async parseWebhook(body: unknown) {
        const update = body as Record<string, unknown>
        const message = (update.message || update.channel_post) as Record<string, unknown> | undefined
        if (!message) return { media: [] }

        const media: IncomingMedia[] = []
        const caption = (message.caption as string) || ''

        // Photo — take highest resolution
        const photos = message.photo as Array<Record<string, unknown>> | undefined
        if (photos?.length) {
            const largest = photos[photos.length - 1]
            media.push({
                fileUrl: `__telegram_file_id__:${largest.file_id}`,
                fileName: `photo_${Date.now()}.jpg`,
                mimeType: 'image/jpeg',
                fileSize: (largest.file_size as number) || 0,
                caption,
            })
        }

        // Video
        const video = message.video as Record<string, unknown> | undefined
        if (video) {
            media.push({
                fileUrl: `__telegram_file_id__:${video.file_id}`,
                fileName: (video.file_name as string) || `video_${Date.now()}.mp4`,
                mimeType: (video.mime_type as string) || 'video/mp4',
                fileSize: (video.file_size as number) || 0,
                caption,
            })
        }

        // Document (images/videos sent as files)
        const doc = message.document as Record<string, unknown> | undefined
        if (doc) {
            const mime = (doc.mime_type as string) || ''
            if (mime.startsWith('image/') || mime.startsWith('video/')) {
                media.push({
                    fileUrl: `__telegram_file_id__:${doc.file_id}`,
                    fileName: (doc.file_name as string) || `file_${Date.now()}`,
                    mimeType: mime,
                    fileSize: (doc.file_size as number) || 0,
                    caption,
                })
            }
        }

        const chat = message.chat as Record<string, unknown> | undefined
        const senderId = chat?.id ? String(chat.id) : undefined

        return { media, senderId }
    },

    buildReplyPayload(config, message) {
        return {
            url: `${TELEGRAM_API}${config.botToken}/sendMessage`,
            body: { chat_id: config.chatId, text: message, parse_mode: 'Markdown' },
        }
    },

    async registerWebhook(config, webhookUrl) {
        const res = await fetch(`${TELEGRAM_API}${config.botToken}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
        })
        const data = await res.json()
        return data.ok === true
    },

    async unregisterWebhook(config) {
        await fetch(`${TELEGRAM_API}${config.botToken}/deleteWebhook`, { method: 'POST' })
    },
}

// ─── Discord Adapter (Webhook URL) ────────────────────────

const discordSource: MessagingSource = {
    key: 'discord',
    label: 'Discord',
    svgIcon: {
        viewBox: '0 0 24 24',
        paths: [
            'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z',
        ],
    },
    brandColor: '#5865F2',
    color: { border: 'border-[#5865F2]/30', bg: 'bg-[#5865F2]/10', text: 'text-[#5865F2]', gradient: 'from-[#5865F2] to-[#4752C4]' },
    fields: [
        {
            key: 'webhookUrl',
            label: 'Webhook URL',
            placeholder: 'https://discord.com/api/webhooks/1234567890/abcdefg...',
            type: 'url',
            required: true,
            helpText: 'Create in Channel Settings → Integrations → Webhooks',
        },
    ],
    setupStepsCount: 5,

    async validateConfig(config) {
        const { webhookUrl } = config
        if (!webhookUrl) return { valid: false, error: 'Webhook URL is required' }

        // Validate Discord webhook URL format
        const webhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/.+$/
        if (!webhookRegex.test(webhookUrl)) {
            return { valid: false, error: 'Invalid Discord Webhook URL format' }
        }

        try {
            const res = await fetch(webhookUrl)
            const data = await res.json()
            if (!res.ok) return { valid: false, error: data.message || 'Invalid webhook URL' }
            return { valid: true, name: data.name || 'Discord Webhook' }
        } catch {
            return { valid: false, error: 'Failed to connect to Discord' }
        }
    },

    async parseWebhook(body: unknown) {
        const event = body as Record<string, unknown>
        const media: IncomingMedia[] = []

        // Discord webhook payload with attachments
        const attachments = event.attachments as Array<Record<string, unknown>> | undefined
        if (attachments) {
            for (const att of attachments) {
                const contentType = (att.content_type as string) || ''
                if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
                    media.push({
                        fileUrl: att.url as string,
                        fileName: (att.filename as string) || `file_${Date.now()}`,
                        mimeType: contentType,
                        fileSize: (att.size as number) || 0,
                        caption: (event.content as string) || '',
                    })
                }
            }
        }

        // Also check embeds for images
        const embeds = event.embeds as Array<Record<string, unknown>> | undefined
        if (embeds) {
            for (const embed of embeds) {
                const image = embed.image as Record<string, unknown> | undefined
                if (image?.url) {
                    media.push({
                        fileUrl: image.url as string,
                        fileName: `embed_${Date.now()}.jpg`,
                        mimeType: 'image/jpeg',
                        caption: (embed.description as string) || '',
                    })
                }
            }
        }

        const senderId = event.author
            ? String((event.author as Record<string, unknown>).id)
            : undefined

        return { media, senderId }
    },

    buildReplyPayload(config, message) {
        return {
            url: config.webhookUrl,
            body: { content: message },
        }
    },
}

// ─── Registry ─────────────────────────────────────────────

export const MESSAGING_SOURCES: MessagingSource[] = [
    telegramSource,
    discordSource,
    // Future: slackSource, zaloSource, whatsappSource
]

/** Get a messaging source by key */
export function getMessagingSource(key: string): MessagingSource | undefined {
    return MESSAGING_SOURCES.find(s => s.key === key)
}

/** Get the file download URL for Telegram (resolves file_id → download URL) */
export async function resolveTelegramFileUrl(botToken: string, fileId: string): Promise<string> {
    const res = await fetch(`${TELEGRAM_API}${botToken}/getFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(`Telegram getFile failed: ${data.description}`)
    return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`
}
