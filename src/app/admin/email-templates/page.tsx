'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'

type Template = {
    key: string
    name: string
    description: string | null
    subject: string
    variables: string[]
    isActive: boolean
    updatedAt: string
}

const TEMPLATE_ICONS: Record<string, { icon: ReactNode; color: string }> = {
    welcome: {
        color: '#6366f1',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    payment_confirmation: {
        color: '#10b981',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 11l3 3L22 4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
    },
    invitation: {
        color: '#f59e0b',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="#f59e0b" strokeWidth="2" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
    },
    password_reset: {
        color: '#ef4444',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#ef4444" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
        ),
    },
}

const DEFAULT_ICON: { color: string; icon: ReactNode } = {
    color: '#8b5cf6',
    icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#8b5cf6" strokeWidth="2" />
            <path d="M2 8l10 6 10-6" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
}

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([])
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/admin/email-templates')
            .then(r => r.json())
            .then(data => { setTemplates(Array.isArray(data) ? data : []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const toggleActive = async (key: string, isActive: boolean) => {
        setToggling(key)
        try {
            const res = await fetch(`/api/admin/email-templates/${key}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            })
            if (res.ok) {
                setTemplates(prev => prev.map(t => t.key === key ? { ...t, isActive: !isActive } : t))
            }
        } finally {
            setToggling(null)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#09090b', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: '10px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <rect x="2" y="4" width="20" height="16" rx="3" stroke="#fff" strokeWidth="2" />
                                    <path d="M2 8l10 6 10-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f9fafb', margin: 0 }}>Email Templates</h1>
                        </div>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                            Manage transactional email templates stored in your database.
                        </p>
                    </div>
                    <Link href="/admin/email-templates/new" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 18px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', borderRadius: '10px', textDecoration: 'none',
                        fontSize: '14px', fontWeight: 600,
                    }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                        New Template
                    </Link>
                </div>

                {/* Templates list */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                        <svg style={{ animation: 'spin 1s linear infinite' }} width="32" height="32" viewBox="0 0 24 24" fill="none">
                            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                            <circle cx="12" cy="12" r="10" stroke="#374151" strokeWidth="3" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>
                ) : templates.length === 0 ? (
                    <div style={{
                        border: '1px dashed #27272a', borderRadius: '16px', padding: '64px',
                        textAlign: 'center', color: '#4b5563',
                    }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px' }}>
                            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#374151" strokeWidth="2" />
                            <path d="M2 8l10 6 10-6" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <p style={{ fontSize: '16px', fontWeight: 500, color: '#6b7280', margin: '0 0 8px' }}>No templates yet</p>
                        <p style={{ fontSize: '14px' }}>Run <code style={{ background: '#18181b', padding: '2px 6px', borderRadius: '4px', color: '#a78bfa' }}>prisma db seed</code> to populate default templates.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {templates.map(template => {
                            const meta = TEMPLATE_ICONS[template.key] ?? DEFAULT_ICON
                            return (
                                <div key={template.key} style={{
                                    background: '#111827',
                                    border: `1px solid ${template.isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                    borderRadius: '14px',
                                    padding: '20px 24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    transition: 'border-color 0.2s',
                                }}>
                                    {/* Icon */}
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
                                        background: `${meta.color}18`,
                                        border: `1px solid ${meta.color}33`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {meta.icon}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                            <span style={{ fontSize: '15px', fontWeight: 600, color: '#f9fafb' }}>{template.name}</span>
                                            <code style={{
                                                fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                                                background: '#1f2937', color: '#9ca3af', fontFamily: 'monospace',
                                            }}>{template.key}</code>
                                            {!template.isActive && (
                                                <span style={{
                                                    fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                                                    background: '#27272a', color: '#6b7280', fontWeight: 500,
                                                }}>Inactive</span>
                                            )}
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {template.description || template.subject}
                                        </p>
                                        <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>
                                            {template.variables.length} variables · Updated {new Date(template.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        {/* Toggle */}
                                        <button
                                            onClick={() => toggleActive(template.key, template.isActive)}
                                            disabled={toggling === template.key}
                                            title={template.isActive ? 'Disable' : 'Enable'}
                                            style={{
                                                width: 36, height: 36, borderRadius: '8px',
                                                background: template.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                                                border: template.isActive ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}
                                        >
                                            {template.isActive ? (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                    <path d="M5 13l4 4L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                                                </svg>
                                            ) : (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2" />
                                                    <path d="M12 8v4M12 16h.01" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Edit */}
                                        <Link href={`/admin/email-templates/${template.key}`} style={{
                                            width: 36, height: 36, borderRadius: '8px',
                                            background: 'rgba(99,102,241,0.1)',
                                            border: '1px solid rgba(99,102,241,0.25)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            textDecoration: 'none',
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        </Link>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Info box */}
                <div style={{
                    marginTop: '32px', padding: '16px 20px', borderRadius: '12px',
                    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <circle cx="12" cy="12" r="10" stroke="#6366f1" strokeWidth="2" />
                        <path d="M12 8v4M12 15h.01" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div>
                        <p style={{ fontSize: '13px', color: '#a78bfa', fontWeight: 500, margin: '0 0 4px' }}>Variable syntax</p>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                            Use <code style={{ background: '#1f2937', padding: '1px 5px', borderRadius: '3px', color: '#c4b5fd' }}>{'{{variable}}'}</code> in subject or body.
                            Conditionals: <code style={{ background: '#1f2937', padding: '1px 5px', borderRadius: '3px', color: '#c4b5fd' }}>{'{{#if variable}}...{{/if}}'}</code>
                        </p>
                    </div>
                </div>

            </div>
        </div>
    )
}
