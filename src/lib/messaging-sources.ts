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
    type: 'text' | 'password'
    required: boolean
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
    /** Icon emoji */
    icon: string
    /** Tailwind color classes */
    color: { border: string; bg: string; text: string }
    /** Config fields required for connection */
    fields: SourceField[]
    /** Step-by-step setup instructions (i18n keys) */
    setupSteps: string[]
    /** Validate config and return display name on success */
    validateConfig(config: Record<string, string>): Promise<{ valid: boolean; name?: string; error?: string }>
    /** Parse incoming webhook and extract media items */
    parseWebhook(body: unknown, config: Record<string, string>): Promise<{
        media: IncomingMedia[]
        replyPayload?: unknown  // Platform-specific reply to sender
        senderId?: string
    }>
    /** Build reply payload to confirm receipt */
    buildReplyPayload?(config: Record<string, string>, message: string): { url: string; body: unknown }
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
    icon: '✈️',
    color: { border: 'border-sky-500/30', bg: 'bg-sky-500/10', text: 'text-sky-400' },
    fields: [
        { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...', type: 'password', required: true },
        { key: 'chatId', label: 'Chat ID', placeholder: '-1001234567890', type: 'text', required: true },
    ],
    setupSteps: [
        'smartflow.sources.telegram.step1', // Open @BotFather on Telegram
        'smartflow.sources.telegram.step2', // Send /newbot, follow instructions
        'smartflow.sources.telegram.step3', // Copy the Bot Token
        'smartflow.sources.telegram.step4', // Add bot to your channel/group as admin
        'smartflow.sources.telegram.step5', // Get Chat ID (forward a message to @userinfobot)
    ],

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

// ─── Discord Adapter ──────────────────────────────────────

const discordSource: MessagingSource = {
    key: 'discord',
    label: 'Discord',
    icon: '🎮',
    color: { border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
    fields: [
        { key: 'botToken', label: 'Bot Token', placeholder: 'MTIz...', type: 'password', required: true },
        { key: 'channelId', label: 'Channel ID', placeholder: '1234567890', type: 'text', required: true },
    ],
    setupSteps: [
        'smartflow.sources.discord.step1', // Go to discord.com/developers
        'smartflow.sources.discord.step2', // Create application + bot
        'smartflow.sources.discord.step3', // Copy Bot Token
        'smartflow.sources.discord.step4', // Invite bot to server with permissions
        'smartflow.sources.discord.step5', // Right-click channel → Copy Channel ID
    ],

    async validateConfig(config) {
        const { botToken } = config
        if (!botToken) return { valid: false, error: 'Bot Token is required' }

        try {
            const res = await fetch('https://discord.com/api/v10/users/@me', {
                headers: { Authorization: `Bot ${botToken}` },
            })
            const data = await res.json()
            if (!res.ok) return { valid: false, error: data.message || 'Invalid bot token' }
            return { valid: true, name: `${data.username}#${data.discriminator}` }
        } catch {
            return { valid: false, error: 'Failed to connect to Discord API' }
        }
    },

    async parseWebhook(body: unknown) {
        const event = body as Record<string, unknown>
        const media: IncomingMedia[] = []

        // Discord Gateway MESSAGE_CREATE event
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

        const senderId = event.author
            ? String((event.author as Record<string, unknown>).id)
            : undefined

        return { media, senderId }
    },

    buildReplyPayload(config, message) {
        return {
            url: `https://discord.com/api/v10/channels/${config.channelId}/messages`,
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
