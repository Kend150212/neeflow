import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * POST /api/admin/channels/[id]/bot-config/test-notify
 * Send a test notification message to Telegram or Discord to verify connectivity.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: channelId } = await params
    const body = await req.json()
    const { platform } = body

    const testMessage = `🤖 Neeflow Bot — Test Notification\n\nĐây là tin nhắn kiểm tra kết nối từ channel ${channelId}.\nNếu bạn thấy tin nhắn này, cấu hình thông báo đã hoạt động! ✅\n\nThời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`

    if (platform === 'telegram') {
        const { token, chatId } = body
        if (!token || !chatId) {
            return NextResponse.json({ error: 'Missing token or chatId' }, { status: 400 })
        }

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: testMessage,
                parse_mode: 'HTML',
            }),
        })

        const data = await res.json()
        if (!res.ok || !data.ok) {
            return NextResponse.json(
                { error: data.description || 'Telegram API error' },
                { status: 400 }
            )
        }

        return NextResponse.json({ ok: true, platform: 'telegram' })
    }

    if (platform === 'discord') {
        const { webhookUrl } = body
        if (!webhookUrl) {
            return NextResponse.json({ error: 'Missing webhookUrl' }, { status: 400 })
        }

        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Neeflow Bot',
                embeds: [
                    {
                        title: '🤖 Test Notification',
                        description: `Đây là tin nhắn kiểm tra kết nối từ **channel ${channelId}**.\nNếu bạn thấy tin nhắn này, cấu hình đã hoạt động! ✅`,
                        color: 0x5865f2,
                        footer: {
                            text: `Neeflow • ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
                        },
                    },
                ],
            }),
        })

        if (!res.ok) {
            const text = await res.text().catch(() => '')
            return NextResponse.json({ error: text || 'Discord Webhook error' }, { status: 400 })
        }

        return NextResponse.json({ ok: true, platform: 'discord' })
    }

    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
}
