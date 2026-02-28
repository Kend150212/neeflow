'use client'

import { useTranslation } from '@/lib/i18n'
import { Bell, Loader2, Send, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

interface WebhooksTabProps {
    webhookDiscordUrl: string
    setWebhookDiscordUrl: (v: string) => void
    webhookTelegramToken: string
    setWebhookTelegramToken: (v: string) => void
    webhookTelegramChatId: string
    setWebhookTelegramChatId: (v: string) => void
    webhookSlackUrl: string
    setWebhookSlackUrl: (v: string) => void
    webhookZaloAppId: string
    setWebhookZaloAppId: (v: string) => void
    webhookZaloSecretKey: string
    setWebhookZaloSecretKey: (v: string) => void
    webhookZaloRefreshToken: string
    setWebhookZaloRefreshToken: (v: string) => void
    webhookZaloUserId: string
    setWebhookZaloUserId: (v: string) => void
    webhookCustomUrl: string
    setWebhookCustomUrl: (v: string) => void
    testingWebhook: string | null
    handleWebhookTest: (platform: string) => void
}

export default function WebhooksTab({
    webhookDiscordUrl,
    setWebhookDiscordUrl,
    webhookTelegramToken,
    setWebhookTelegramToken,
    webhookTelegramChatId,
    setWebhookTelegramChatId,
    webhookSlackUrl,
    setWebhookSlackUrl,
    webhookZaloAppId,
    setWebhookZaloAppId,
    webhookZaloSecretKey,
    setWebhookZaloSecretKey,
    webhookZaloRefreshToken,
    setWebhookZaloRefreshToken,
    webhookZaloUserId,
    setWebhookZaloUserId,
    webhookCustomUrl,
    setWebhookCustomUrl,
    testingWebhook,
    handleWebhookTest,
}: WebhooksTabProps) {
    const t = useTranslation()

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    {t('channels.webhooks.title')}
                </CardTitle>
                <CardDescription>
                    {t('channels.webhooks.desc')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Discord */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full bg-[#5865F2] inline-block" />
                        Discord {t('channels.webhooks.webhookUrl')}
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="https://discord.com/api/webhooks/..."
                            value={webhookDiscordUrl}
                            onChange={(e) => setWebhookDiscordUrl(e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleWebhookTest('discord')}
                            disabled={!webhookDiscordUrl || testingWebhook === 'discord'}
                            className="gap-1.5 shrink-0"
                        >
                            {testingWebhook === 'discord' ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                            ) : (
                                <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                            )}
                        </Button>
                    </div>
                </div>

                <Separator />

                {/* Telegram */}
                <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full bg-[#0088cc] inline-block" />
                        Telegram
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t('channels.webhooks.botToken')}</Label>
                            <Input
                                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v..."
                                value={webhookTelegramToken}
                                onChange={(e) => setWebhookTelegramToken(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t('channels.webhooks.chatId')}</Label>
                            <Input
                                placeholder="-1001234567890"
                                value={webhookTelegramChatId}
                                onChange={(e) => setWebhookTelegramChatId(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWebhookTest('telegram')}
                        disabled={!webhookTelegramToken || !webhookTelegramChatId || testingWebhook === 'telegram'}
                        className="gap-1.5"
                    >
                        {testingWebhook === 'telegram' ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                        ) : (
                            <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                        )}
                    </Button>
                </div>

                <Separator />

                {/* Slack */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full bg-[#4A154B] inline-block" />
                        Slack {t('channels.webhooks.webhookUrl')}
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="https://hooks.slack.com/services/..."
                            value={webhookSlackUrl}
                            onChange={(e) => setWebhookSlackUrl(e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleWebhookTest('slack')}
                            disabled={!webhookSlackUrl || testingWebhook === 'slack'}
                            className="gap-1.5 shrink-0"
                        >
                            {testingWebhook === 'slack' ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                            ) : (
                                <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                            )}
                        </Button>
                    </div>
                </div>

                <Separator />

                {/* Zalo OA */}
                <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full bg-[#0068FF] inline-block" />
                        Zalo OA
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">App ID</Label>
                            <Input
                                placeholder="Your Zalo App ID"
                                value={webhookZaloAppId}
                                onChange={(e) => setWebhookZaloAppId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Secret Key</Label>
                            <Input
                                type="password"
                                placeholder="Your Zalo app secret key"
                                value={webhookZaloSecretKey}
                                onChange={(e) => setWebhookZaloSecretKey(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Refresh Token</Label>
                            <Input
                                type="password"
                                placeholder="OA refresh token (valid 3 months)"
                                value={webhookZaloRefreshToken}
                                onChange={(e) => setWebhookZaloRefreshToken(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">User ID</Label>
                            <Input
                                placeholder="Recipient user ID on Zalo"
                                value={webhookZaloUserId}
                                onChange={(e) => setWebhookZaloUserId(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWebhookTest('zalo')}
                        disabled={!webhookZaloRefreshToken || !webhookZaloAppId || !webhookZaloSecretKey || !webhookZaloUserId || testingWebhook === 'zalo'}
                        className="gap-1.5"
                    >
                        {testingWebhook === 'zalo' ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                        ) : (
                            <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                        )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Lấy thông tin từ <a href="https://developers.zalo.me" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">developers.zalo.me</a>. Access token sẽ tự động refresh.
                    </p>
                </div>

                <Separator />

                {/* Custom */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-orange-400" />
                        {t('channels.webhooks.customWebhook')}
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="https://your-server.com/webhook"
                            value={webhookCustomUrl}
                            onChange={(e) => setWebhookCustomUrl(e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleWebhookTest('custom')}
                            disabled={!webhookCustomUrl || testingWebhook === 'custom'}
                            className="gap-1.5 shrink-0"
                        >
                            {testingWebhook === 'custom' ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('channels.webhooks.testing')}</>
                            ) : (
                                <><Send className="h-3.5 w-3.5" /> {t('channels.webhooks.test')}</>
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('channels.webhooks.customWebhookDesc')}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
