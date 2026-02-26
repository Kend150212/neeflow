/**
 * Telegram notification utility for the Auto Content Pipeline.
 * Sends post previews and approval buttons to clients via Telegram.
 */

interface SendNotificationOptions {
    botToken: string
    chatId: string
    caption: string
    imageUrl?: string
    postId: string
    approvalMode: string
    channelDisplayName: string
    scheduledAt: Date | string
}

/**
 * Send a content pipeline notification to a Telegram chat.
 * - If the approval mode is 'client', includes inline keyboard buttons for Approve/Reject.
 * - Otherwise, sends an informational preview.
 */
export async function sendTelegramNotification(opts: SendNotificationOptions): Promise<boolean> {
    const { botToken, chatId, caption, imageUrl, postId, approvalMode, channelDisplayName, scheduledAt } = opts

    if (!botToken || !chatId) {
        console.warn('[Telegram] Missing botToken or chatId, skipping notification')
        return false
    }

    const scheduleDate = new Date(scheduledAt)
    const scheduledStr = scheduleDate.toLocaleDateString('vi-VN', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })

    // Build message text
    const messageLines = [
        `📸 *Bài viết mới từ ${escapeMarkdown(channelDisplayName)}*`,
        '',
        escapeMarkdown(caption.slice(0, 500)),
        '',
        `📅 Lên lịch: ${scheduledStr}`,
    ]

    if (approvalMode === 'auto') {
        messageLines.push('✅ Sẽ tự động đăng theo lịch')
    } else if (approvalMode === 'admin') {
        messageLines.push('⏳ Đang chờ admin duyệt')
    } else if (approvalMode === 'client') {
        messageLines.push('👇 Xác nhận duyệt bài viết')
    }

    const text = messageLines.join('\n')

    // Build inline keyboard for client approval
    const inlineKeyboard = approvalMode === 'client' ? {
        inline_keyboard: [
            [
                { text: '✅ Duyệt', callback_data: `approve_${postId}` },
                { text: '❌ Từ chối', callback_data: `reject_${postId}` },
            ],
        ],
    } : undefined

    try {
        // Try sending with photo if imageUrl is available
        if (imageUrl) {
            const photoRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    photo: imageUrl,
                    caption: text,
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard,
                }),
            })

            if (photoRes.ok) {
                console.log(`[Telegram] Sent photo notification for post ${postId}`)
                return true
            }
            // If photo fails, fall through to text-only
        }

        // Text-only fallback
        const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'Markdown',
                reply_markup: inlineKeyboard,
            }),
        })

        if (textRes.ok) {
            console.log(`[Telegram] Sent text notification for post ${postId}`)
            return true
        }

        const error = await textRes.json().catch(() => ({}))
        console.error(`[Telegram] Failed to send notification:`, error)
        return false

    } catch (error) {
        console.error(`[Telegram] Error sending notification:`, error)
        return false
    }
}

/**
 * Escape special characters for Telegram MarkdownV1.
 */
function escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}
