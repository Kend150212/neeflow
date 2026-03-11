'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    ArrowLeft, Mail, Save, Send, Loader2, Eye, EyeOff,
    ToggleLeft, ToggleRight, LayoutTemplate, ExternalLink,
    CheckCircle, XCircle, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SupportSmtpConfig {
    id?: string
    isActive: boolean
    status: string
    hasPassword: boolean
    apiKeyMasked?: string
    host: string
    port: string
    secure: string
    username: string
    fromName: string
    fromEmail: string
}

const DEFAULT_CONFIG: SupportSmtpConfig = {
    isActive: false,
    status: 'INACTIVE',
    hasPassword: false,
    host: 'smtp.gmail.com',
    port: '465',
    secure: 'ssl',
    username: '',
    fromName: 'Support',
    fromEmail: '',
}

export default function SupportEmailSettingsPage() {
    const t = useTranslation()
    const router = useRouter()

    const [config, setConfig] = useState<SupportSmtpConfig>(DEFAULT_CONFIG)
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [testing, setTesting] = useState(false)
    const [testEmail, setTestEmail] = useState('')
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

    const set = (field: keyof SupportSmtpConfig, value: string | boolean) =>
        setConfig(prev => ({ ...prev, [field]: value }))

    useEffect(() => {
        fetch('/api/admin/support/email-settings')
            .then(r => r.json())
            .then(data => setConfig(data))
            .catch(() => null)
            .finally(() => setLoading(false))
    }, [])

    const save = async () => {
        setSaving(true)
        try {
            const body: Record<string, unknown> = { ...config }
            if (password) body.password = password
            const res = await fetch('/api/admin/support/email-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error('Save failed')
            toast.success(t('support.email.saved'))
            setPassword('')
        } catch {
            toast.error(t('support.email.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    const sendTest = async () => {
        if (!testEmail) { toast.error(t('support.email.testEmailRequired')); return }
        setTesting(true)
        setTestResult(null)
        try {
            const res = await fetch('/api/admin/support/email-settings/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: testEmail }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Test failed')
            setTestResult({ ok: true, msg: t('support.email.testSuccess') })
            toast.success(t('support.email.testSuccess'))
        } catch (e: unknown) {
            const msg = (e as Error).message || t('support.email.testFailed')
            setTestResult({ ok: false, msg })
            toast.error(msg)
        } finally {
            setTesting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const isConfigured = config.hasPassword && config.username

    return (
        <div className="p-6 max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.push('/admin/integrations')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Mail className="h-5 w-5 text-rose-500" />
                        {t('support.email.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t('support.email.description')}</p>
                </div>
                <Badge variant={config.isActive ? 'default' : 'outline'} className={cn(
                    'text-xs',
                    config.isActive ? 'bg-green-500/10 text-green-600 border-green-500/30' : ''
                )}>
                    {config.isActive ? t('support.email.active') : t('support.email.inactive')}
                </Badge>
            </div>

            {/* SMTP Config Card */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center justify-between">
                        {t('support.email.smtpConfig')}
                        <button
                            onClick={() => set('isActive', !config.isActive)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {config.isActive
                                ? <ToggleRight className="h-5 w-5 text-green-500" />
                                : <ToggleLeft className="h-5 w-5" />
                            }
                            {config.isActive ? t('support.email.enabled') : t('support.email.disabled')}
                        </button>
                    </CardTitle>
                    <CardDescription className="text-xs">
                        {t('support.email.smtpDesc')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Host + Port */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t('integrations.smtpHost')}</Label>
                            <Input
                                value={config.host}
                                onChange={e => set('host', e.target.value)}
                                placeholder="smtp.gmail.com"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t('integrations.smtpPort')}</Label>
                            <Input
                                value={config.port}
                                onChange={e => set('port', e.target.value)}
                                placeholder="465"
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* Security */}
                    <div className="space-y-1.5">
                        <Label className="text-xs">{t('integrations.smtpSecurity')}</Label>
                        <Select value={config.secure} onValueChange={v => set('secure', v)}>
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ssl">{t('integrations.sslPort465')}</SelectItem>
                                <SelectItem value="tls">{t('integrations.tlsPort587')}</SelectItem>
                                <SelectItem value="none">{t('integrations.nonePort25')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Username */}
                    <div className="space-y-1.5">
                        <Label className="text-xs">{t('integrations.smtpUsername')}</Label>
                        <Input
                            value={config.username}
                            onChange={e => set('username', e.target.value)}
                            placeholder="support@gmail.com"
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <Label className="text-xs">
                            {t('integrations.smtpPassword')}
                            {config.hasPassword && (
                                <span className="ml-2 text-[10px] text-muted-foreground">
                                    ({t('support.email.passwordSaved')}: {config.apiKeyMasked})
                                </span>
                            )}
                        </Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={config.hasPassword ? t('support.email.passwordKeep') : t('integrations.smtpAppPasswordPlaceholder')}
                                className="h-9 text-sm pr-9 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(s => !s)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {/* Gmail tip */}
                        <div className="flex items-start gap-1.5 rounded-md bg-blue-500/5 border border-blue-500/20 px-3 py-2">
                            <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
                                {t('support.email.gmailTip')}
                                {' '}
                                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">
                                    myaccount.google.com/apppasswords
                                </a>
                            </p>
                        </div>
                    </div>

                    {/* Sender info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t('support.email.fromName')}</Label>
                            <Input
                                value={config.fromName}
                                onChange={e => set('fromName', e.target.value)}
                                placeholder="Neeflow Support"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">{t('support.email.fromEmail')}</Label>
                            <Input
                                value={config.fromEmail}
                                onChange={e => set('fromEmail', e.target.value)}
                                placeholder="support@yourapp.com"
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* Save */}
                    <Button onClick={save} disabled={saving} className="w-full">
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        {t('support.email.save')}
                    </Button>
                </CardContent>
            </Card>

            {/* Test Send Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('support.email.testSend')}</CardTitle>
                    <CardDescription className="text-xs">{t('support.email.testDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2">
                        <Input
                            value={testEmail}
                            onChange={e => setTestEmail(e.target.value)}
                            placeholder={t('integrations.testEmailPlaceholder')}
                            className="h-9 text-sm flex-1"
                            onKeyDown={e => { if (e.key === 'Enter') sendTest() }}
                        />
                        <Button variant="outline" onClick={sendTest} disabled={testing || !isConfigured} className="shrink-0">
                            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            <span className="ml-2">{t('integrations.sendTest')}</span>
                        </Button>
                    </div>
                    {!isConfigured && (
                        <p className="text-[11px] text-muted-foreground">{t('support.email.configureFirst')}</p>
                    )}
                    {testResult && (
                        <div className={cn(
                            'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                            testResult.ok ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                        )}>
                            {testResult.ok
                                ? <CheckCircle className="h-4 w-4 shrink-0" />
                                : <XCircle className="h-4 w-4 shrink-0" />
                            }
                            {testResult.msg}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Email Templates Link */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('support.email.templatesLabel')}</CardTitle>
                    <CardDescription className="text-xs">{t('support.email.templatesDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => router.push('/admin/support/email-templates')}
                    >
                        <LayoutTemplate className="h-4 w-4" />
                        {t('support.email.manageTemplates')}
                        <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
