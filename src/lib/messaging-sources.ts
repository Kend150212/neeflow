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
    /** Unique key: 'telegram' | 'whatsapp' | 'slack' */
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

// ─── WhatsApp Business API Adapter ─────────────────────────

const WHATSAPP_GRAPH_API = 'https://graph.facebook.com/v21.0'

const whatsappSource: MessagingSource = {
    key: 'whatsapp',
    label: 'WhatsApp',
    svgIcon: {
        viewBox: '0 0 24 24',
        paths: [
            'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
        ],
    },
    brandColor: '#25D366',
    color: { border: 'border-[#25D366]/30', bg: 'bg-[#25D366]/10', text: 'text-[#25D366]', gradient: 'from-[#25D366] to-[#128C7E]' },
    fields: [
        {
            key: 'accessToken',
            label: 'Access Token',
            placeholder: 'EAABsbCS1iHgBO...',
            type: 'password',
            required: true,
            helpText: 'Permanent token from Meta Business Settings → System Users',
        },
        {
            key: 'phoneNumberId',
            label: 'Phone Number ID',
            placeholder: '123456789012345',
            type: 'text',
            required: true,
            helpText: 'Found in WhatsApp → API Setup → Phone Number ID',
        },
        {
            key: 'verifyToken',
            label: 'Verify Token',
            placeholder: 'my-secret-verify-token',
            type: 'text',
            required: true,
            helpText: 'Any secret string — use this same value when setting up webhook in Meta',
        },
    ],
    setupStepsCount: 7,

    async validateConfig(config) {
        const { accessToken, phoneNumberId } = config
        if (!accessToken) return { valid: false, error: 'Access Token is required' }
        if (!phoneNumberId) return { valid: false, error: 'Phone Number ID is required' }

        try {
            const res = await fetch(`${WHATSAPP_GRAPH_API}/${phoneNumberId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            const data = await res.json()
            if (data.error) return { valid: false, error: data.error.message || 'Invalid credentials' }
            return { valid: true, name: data.display_phone_number || data.verified_name || 'WhatsApp Business' }
        } catch {
            return { valid: false, error: 'Failed to connect to WhatsApp API' }
        }
    },

    async parseWebhook(body: unknown) {
        const payload = body as Record<string, unknown>
        const media: IncomingMedia[] = []

        // WhatsApp Cloud API webhook structure
        const entry = (payload.entry as Array<Record<string, unknown>>)?.[0]
        const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0]
        const value = changes?.value as Record<string, unknown> | undefined
        const messages = (value?.messages as Array<Record<string, unknown>>) || []

        for (const msg of messages) {
            const msgType = msg.type as string

            // Image message
            if (msgType === 'image') {
                const image = msg.image as Record<string, unknown>
                media.push({
                    fileUrl: `__whatsapp_media_id__:${image.id}`,
                    fileName: `whatsapp_photo_${Date.now()}.jpg`,
                    mimeType: (image.mime_type as string) || 'image/jpeg',
                    caption: (image.caption as string) || '',
                })
            }

            // Video message
            if (msgType === 'video') {
                const video = msg.video as Record<string, unknown>
                media.push({
                    fileUrl: `__whatsapp_media_id__:${video.id}`,
                    fileName: `whatsapp_video_${Date.now()}.mp4`,
                    mimeType: (video.mime_type as string) || 'video/mp4',
                    caption: (video.caption as string) || '',
                })
            }

            // Document (images/videos sent as files)
            if (msgType === 'document') {
                const doc = msg.document as Record<string, unknown>
                const mime = (doc.mime_type as string) || ''
                if (mime.startsWith('image/') || mime.startsWith('video/')) {
                    media.push({
                        fileUrl: `__whatsapp_media_id__:${doc.id}`,
                        fileName: (doc.filename as string) || `whatsapp_file_${Date.now()}`,
                        mimeType: mime,
                        caption: (doc.caption as string) || '',
                    })
                }
            }
        }

        const senderId = messages[0]?.from ? String(messages[0].from) : undefined

        return { media, senderId }
    },

    buildReplyPayload(config, message) {
        return {
            url: `${WHATSAPP_GRAPH_API}/${config.phoneNumberId}/messages`,
            body: {
                messaging_product: 'whatsapp',
                to: '', // Will be filled with sender's number
                type: 'text',
                text: { body: message },
            },
            headers: { Authorization: `Bearer ${config.accessToken}` },
        }
    },
}

// ─── Registry ─────────────────────────────────────────────

export const MESSAGING_SOURCES: MessagingSource[] = [
    telegramSource,
    whatsappSource,
    // Future: slackSource, zaloSource
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

/** Get the download URL for a WhatsApp media ID */
export async function resolveWhatsAppMediaUrl(accessToken: string, mediaId: string): Promise<string> {
    const res = await fetch(`${WHATSAPP_GRAPH_API}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    if (data.error) throw new Error(`WhatsApp getMedia failed: ${data.error.message}`)
    return data.url
}
