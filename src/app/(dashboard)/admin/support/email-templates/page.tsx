'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    ArrowLeft, Save, Mail, Loader2, Eye, RotateCcw, Check,
    Ticket, Reply, UserCheck, CheckCircle2, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type TemplateKey =
    | 'ticket_created'
    | 'ticket_replied_to_user'
    | 'ticket_replied_to_agent'
    | 'ticket_assigned'
    | 'ticket_resolved'

interface EmailTemplate {
    key: TemplateKey
    subject: string
    html: string
}

const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
    ticket_created: {
        key: 'ticket_created',
        subject: '[Ticket #{{ticketId}}] {{subject}} - We received your request',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fafafa">
  <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px">Support Ticket Created</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">We've received your support request and will respond shortly.</p>

    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:13px;color:#374151"><strong>Ticket ID:</strong> #{{ticketId}}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#374151"><strong>Subject:</strong> {{subject}}</p>
      <p style="margin:0;font-size:13px;color:#374151"><strong>Priority:</strong> {{priority}}</p>
    </div>

    <a href="{{ticketUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
      View Ticket →
    </a>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="margin:0;font-size:12px;color:#9ca3af">This is an automated message. Please do not reply directly to this email.</p>
  </div>
</div>`,
    },
    ticket_replied_to_user: {
        key: 'ticket_replied_to_user',
        subject: '[Ticket #{{ticketId}}] New reply from support team',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fafafa">
  <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px">You have a new reply</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">Our support team has responded to your ticket.</p>

    <div style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:4px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Reply from {{agentName}}</p>
      <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.6">{{replyMessage}}</p>
    </div>

    <a href="{{ticketUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
      View Full Conversation →
    </a>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="margin:0;font-size:12px;color:#9ca3af">Ticket #{{ticketId}} · {{subject}}</p>
  </div>
</div>`,
    },
    ticket_replied_to_agent: {
        key: 'ticket_replied_to_agent',
        subject: '[Ticket #{{ticketId}}] User replied: {{subject}}',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fafafa">
  <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px">Customer replied to ticket</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px"><strong>{{userName}}</strong> has added a new reply.</p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.6">{{replyMessage}}</p>
    </div>

    <a href="{{adminTicketUrl}}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
      Go to Admin &rarr;
    </a>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
    <p style="margin:0;font-size:12px;color:#9ca3af">Ticket #{{ticketId}} · {{subject}}</p>
  </div>
</div>`,
    },
    ticket_assigned: {
        key: 'ticket_assigned',
        subject: '[Ticket #{{ticketId}}] Assigned to you: {{subject}}',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fafafa">
  <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px">Ticket assigned to you</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">A support ticket has been assigned to you.</p>

    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:13px;color:#374151"><strong>Ticket:</strong> #{{ticketId}} — {{subject}}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#374151"><strong>From:</strong> {{userName}}</p>
      <p style="margin:0;font-size:13px;color:#374151"><strong>Priority:</strong> {{priority}}</p>
    </div>

    <a href="{{adminTicketUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
      Open Ticket →
    </a>
  </div>
</div>`,
    },
    ticket_resolved: {
        key: 'ticket_resolved',
        subject: '[Ticket #{{ticketId}}] Your ticket has been resolved',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fafafa">
  <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <div style="text-align:center;margin-bottom:24px">
      <div style="width:48px;height:48px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
        <span style="font-size:24px">✅</span>
      </div>
      <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px">Ticket Resolved</h2>
      <p style="margin:0;color:#6b7280;font-size:14px">Your support ticket has been marked as resolved.</p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center">
      <p style="margin:0;font-size:13px;color:#166534">Ticket #{{ticketId}} · {{subject}}</p>
    </div>

    <p style="font-size:14px;color:#374151;text-align:center;margin:0 0 16px">
      Was this issue fully resolved? If not, you can re-open your ticket.
    </p>

    <div style="text-align:center">
      <a href="{{ticketUrl}}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
        View Ticket →
      </a>
    </div>
  </div>
</div>`,
    },
}

const TEMPLATE_META: Record<TemplateKey, { icon: React.ReactNode; label: string; descKey: string; variables: string[] }> = {
    ticket_created: {
        icon: <Ticket className="h-4 w-4" />,
        label: 'Ticket Created',
        descKey: 'support.email.templates.ticketCreatedDesc',
        variables: ['{{ticketId}}', '{{subject}}', '{{priority}}', '{{ticketUrl}}'],
    },
    ticket_replied_to_user: {
        icon: <Reply className="h-4 w-4" />,
        label: 'Reply to User',
        descKey: 'support.email.templates.repliedToUserDesc',
        variables: ['{{ticketId}}', '{{subject}}', '{{agentName}}', '{{replyMessage}}', '{{ticketUrl}}'],
    },
    ticket_replied_to_agent: {
        icon: <Reply className="h-4 w-4" />,
        label: 'Reply Notify Agent',
        descKey: 'support.email.templates.repliedToAgentDesc',
        variables: ['{{ticketId}}', '{{subject}}', '{{userName}}', '{{replyMessage}}', '{{adminTicketUrl}}'],
    },
    ticket_assigned: {
        icon: <UserCheck className="h-4 w-4" />,
        label: 'Ticket Assigned',
        descKey: 'support.email.templates.assignedDesc',
        variables: ['{{ticketId}}', '{{subject}}', '{{userName}}', '{{priority}}', '{{adminTicketUrl}}'],
    },
    ticket_resolved: {
        icon: <CheckCircle2 className="h-4 w-4" />,
        label: 'Ticket Resolved',
        descKey: 'support.email.templates.resolvedDesc',
        variables: ['{{ticketId}}', '{{subject}}', '{{ticketUrl}}'],
    },
}

const ALL_KEYS: TemplateKey[] = [
    'ticket_created',
    'ticket_replied_to_user',
    'ticket_replied_to_agent',
    'ticket_assigned',
    'ticket_resolved',
]

export default function EmailTemplatesPage() {
    const t = useTranslation()
    const router = useRouter()
    const [templates, setTemplates] = useState<Record<TemplateKey, EmailTemplate>>({ ...DEFAULT_TEMPLATES })
    const [activeKey, setActiveKey] = useState<TemplateKey>('ticket_created')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [previewMode, setPreviewMode] = useState(false)
    const [saved, setSaved] = useState<TemplateKey | null>(null)

    useEffect(() => {
        fetch('/api/admin/support/email-templates')
            .then(r => r.json())
            .then(data => {
                if (data && typeof data === 'object') {
                    setTemplates(prev => ({ ...prev, ...data }))
                }
            })
            .catch(() => null)
            .finally(() => setLoading(false))
    }, [])

    const active = templates[activeKey]
    const meta = TEMPLATE_META[activeKey]

    const update = (field: 'subject' | 'html', value: string) => {
        setTemplates(prev => ({
            ...prev,
            [activeKey]: { ...prev[activeKey], [field]: value },
        }))
    }

    const reset = () => {
        setTemplates(prev => ({
            ...prev,
            [activeKey]: { ...DEFAULT_TEMPLATES[activeKey] },
        }))
    }

    const save = async () => {
        setSaving(true)
        try {
            await fetch('/api/admin/support/email-templates', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: activeKey, subject: active.subject, html: active.html }),
            })
            toast.success(t('support.email.templates.saved'))
            setSaved(activeKey)
            setTimeout(() => setSaved(null), 2000)
        } catch {
            toast.error(t('support.email.templates.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar: template list */}
            <aside className="w-60 shrink-0 border-r bg-muted/10 flex flex-col">
                <div className="px-4 py-4 border-b flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push('/admin/support/email-settings')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <p className="text-sm font-semibold">{t('support.email.templates.title')}</p>
                        <p className="text-[10px] text-muted-foreground">{ALL_KEYS.length} {t('support.email.templates.count')}</p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {ALL_KEYS.map(key => {
                        const m = TEMPLATE_META[key]
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveKey(key)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${activeKey === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
                            >
                                {m.icon}
                                <span className="flex-1 text-xs font-medium">{m.label}</span>
                                {saved === key && <Check className="h-3 w-3 text-green-400" />}
                            </button>
                        )
                    })}
                </div>
                <div className="p-3 border-t">
                    <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-1.5">
                            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                            {t('support.email.templates.variablesHint')}
                        </p>
                    </div>
                </div>
            </aside>

            {/* Main editor */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 py-3 border-b bg-background shrink-0">
                    <div className="flex items-center gap-2">
                        {meta.icon}
                        <div>
                            <p className="text-sm font-semibold">{meta.label}</p>
                            <p className="text-xs text-muted-foreground">{t(meta.descKey as Parameters<typeof t>[0])}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setPreviewMode(p => !p)}>
                            <Eye className="h-4 w-4 mr-1.5" />
                            {previewMode ? t('support.email.templates.editMode') : t('support.email.templates.preview')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={reset}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            {t('support.email.templates.reset')}
                        </Button>
                        <Button size="sm" onClick={save} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                            {t('support.email.templates.save')}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <Tabs value={previewMode ? 'preview' : 'edit'} onValueChange={v => setPreviewMode(v === 'preview')}>
                        <TabsContent value="edit" className="space-y-4 mt-0">
                            {/* Variables reference */}
                            <div className="flex flex-wrap gap-1.5">
                                {meta.variables.map(v => (
                                    <Badge key={v} variant="outline" className="font-mono text-[10px]">{v}</Badge>
                                ))}
                            </div>

                            {/* Subject */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('support.email.templates.subject')}</Label>
                                <Input
                                    value={active.subject}
                                    onChange={e => update('subject', e.target.value)}
                                    className="h-9 text-sm font-mono"
                                />
                            </div>

                            {/* HTML body */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">{t('support.email.templates.htmlBody')}</Label>
                                <Textarea
                                    value={active.html}
                                    onChange={e => update('html', e.target.value)}
                                    rows={22}
                                    className="font-mono text-xs resize-none"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="preview" className="mt-0">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        {t('support.email.templates.previewSubject')}:
                                        <span className="font-normal text-muted-foreground">{active.subject}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        className="border rounded-lg overflow-hidden min-h-64 bg-[#fafafa]"
                                        dangerouslySetInnerHTML={{ __html: active.html }}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    )
}
