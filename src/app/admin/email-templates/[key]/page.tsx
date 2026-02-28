'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Template = {
    key: string
    name: string
    description: string | null
    subject: string
    htmlBody: string
    variables: string[]
    isActive: boolean
}

export default function EmailTemplateEditorPage() {
    const params = useParams()
    const router = useRouter()
    const templateKey = params.key as string
    const isNew = templateKey === 'new'

    const [template, setTemplate] = useState<Template>({
        key: '',
        name: '',
        description: '',
        subject: '',
        htmlBody: '',
        variables: [],
        isActive: true,
    })
    const [previewHtml, setPreviewHtml] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [loading, setLoading] = useState(!isNew)
    const [error, setError] = useState('')
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [varInput, setVarInput] = useState('')

    useEffect(() => {
        if (isNew) return
        fetch(`/api/admin/email-templates/${templateKey}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { setError(data.error); setLoading(false); return }
                setTemplate(data)
                setLoading(false)
            })
            .catch(() => { setError('Failed to load template'); setLoading(false) })
    }, [templateKey, isNew])

    const handlePreview = () => {
        // Replace vars with demo values
        let html = template.htmlBody
        template.variables.forEach(v => {
            const demoValues: Record<string, string> = {
                appName: 'Neeflow', logoUrl: '/logo.png', appUrl: 'https://neeflow.com',
                userName: 'John Doe', userEmail: 'john@example.com',
                planName: 'Pro', planPrice: '29', billingInterval: 'month',
                trialDays: '14', setupUrl: 'https://neeflow.com/setup-password?token=demo',
                nextBillingDate: 'March 1, 2025', dashboardUrl: 'https://neeflow.com/dashboard',
                resetUrl: 'https://neeflow.com/reset-password?token=demo',
                toName: 'Jane Smith', toEmail: 'jane@example.com', role: 'Editor',
                year: new Date().getFullYear().toString(),
            }
            html = html.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), demoValues[v] ?? `[${v}]`)
        })
        // Handle simple {{#if}} blocks for preview
        html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, '$2')
        html = html.replace(/\{\{#if \w+\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1')
        setPreviewHtml(html)
        setShowPreview(true)
    }

    const handleSave = async () => {
        setSaving(true)
        setError('')
        try {
            const url = isNew ? '/api/admin/email-templates' : `/api/admin/email-templates/${templateKey}`
            const method = isNew ? 'POST' : 'PATCH'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Save failed')
            } else {
                setSaveSuccess(true)
                setTimeout(() => setSaveSuccess(false), 3000)
                if (isNew) router.push(`/admin/email-templates/${data.key}`)
            }
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return
        setDeleting(true)
        try {
            await fetch(`/api/admin/email-templates/${templateKey}`, { method: 'DELETE' })
            router.push('/admin/email-templates')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ animation: 'spin 1s linear infinite' }} width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    <circle cx="12" cy="12" r="10" stroke="#374151" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
                </svg>
            </div>
        )
    }

    const fieldStyle = {
        width: '100%', boxSizing: 'border-box' as const,
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        color: '#f9fafb',
        fontSize: '14px',
        padding: '12px 14px',
        outline: 'none',
        fontFamily: 'inherit',
    }

    return (
        <div style={{ minHeight: '100vh', background: '#09090b', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <button onClick={() => router.push('/admin/email-templates')} style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex',
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f9fafb', margin: 0 }}>
                            {isNew ? 'New Email Template' : (template.name || templateKey)}
                        </h1>
                        {!isNew && (
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>
                                Key: <code style={{ color: '#a78bfa' }}>{templateKey}</code>
                            </p>
                        )}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button onClick={handlePreview} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '10px 16px', background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                            color: '#d1d5db', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                        }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            Preview
                        </button>
                        {!isNew && (
                            <button onClick={handleDelete} disabled={deleting} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '10px 16px', background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px',
                                color: '#f87171', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                            }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        )}
                        <button onClick={handleSave} disabled={saving} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '10px 18px',
                            background: saveSuccess
                                ? 'rgba(16,185,129,0.1)'
                                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: saveSuccess ? '1px solid rgba(16,185,129,0.3)' : 'none',
                            borderRadius: '10px',
                            color: saveSuccess ? '#10b981' : '#fff',
                            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        }}>
                            {saveSuccess ? (
                                <>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                    </svg>
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    {saving ? 'Saving...' : 'Save'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{
                        marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171', fontSize: '14px',
                    }}>{error}</div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {/* Metadata row */}
                    {isNew && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                                    Template Key *
                                </label>
                                <input
                                    value={template.key}
                                    onChange={e => setTemplate(t => ({ ...t, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                                    placeholder="e.g. welcome"
                                    style={fieldStyle}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                                    Name *
                                </label>
                                <input
                                    value={template.name}
                                    onChange={e => setTemplate(t => ({ ...t, name: e.target.value }))}
                                    placeholder="Welcome Email"
                                    style={fieldStyle}
                                />
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                            Description
                        </label>
                        <input
                            value={template.description ?? ''}
                            onChange={e => setTemplate(t => ({ ...t, description: e.target.value }))}
                            placeholder="When is this email sent?"
                            style={fieldStyle}
                        />
                    </div>

                    {/* Subject */}
                    <div>
                        <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                            Subject Line *
                        </label>
                        <input
                            value={template.subject}
                            onChange={e => setTemplate(t => ({ ...t, subject: e.target.value }))}
                            placeholder="Welcome to {{appName}}!"
                            style={fieldStyle}
                        />
                    </div>

                    {/* Variables */}
                    <div>
                        <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                            Variables
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            {template.variables.map(v => (
                                <span key={v} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 10px', borderRadius: '20px',
                                    background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                                    fontSize: '13px', color: '#c4b5fd',
                                }}>
                                    {`{{${v}}}`}
                                    <button
                                        onClick={() => setTemplate(t => ({ ...t, variables: t.variables.filter(x => x !== v) }))}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280', display: 'flex' }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                        </svg>
                                    </button>
                                </span>
                            ))}
                            <form onSubmit={e => {
                                e.preventDefault()
                                const trimmed = varInput.trim().replace(/[^a-zA-Z0-9_]/g, '')
                                if (trimmed && !template.variables.includes(trimmed)) {
                                    setTemplate(t => ({ ...t, variables: [...t.variables, trimmed] }))
                                }
                                setVarInput('')
                            }} style={{ display: 'flex', gap: '6px' }}>
                                <input
                                    value={varInput}
                                    onChange={e => setVarInput(e.target.value)}
                                    placeholder="Add variable..."
                                    style={{ ...fieldStyle, width: '150px', padding: '4px 10px', fontSize: '13px' }}
                                />
                                <button type="submit" style={{
                                    padding: '4px 10px', background: 'rgba(99,102,241,0.15)',
                                    border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px',
                                    color: '#818cf8', cursor: 'pointer', fontSize: '13px',
                                }}>+ Add</button>
                            </form>
                        </div>
                    </div>

                    {/* HTML Body */}
                    <div>
                        <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                            HTML Body *
                        </label>
                        <textarea
                            value={template.htmlBody}
                            onChange={e => setTemplate(t => ({ ...t, htmlBody: e.target.value }))}
                            rows={24}
                            placeholder="<!DOCTYPE html>..."
                            style={{
                                ...fieldStyle,
                                fontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
                                fontSize: '13px',
                                lineHeight: 1.6,
                                resize: 'vertical',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
                    display: 'flex', flexDirection: 'column',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 24px', background: '#111827',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#8b5cf6" strokeWidth="2" />
                                <circle cx="12" cy="12" r="3" stroke="#8b5cf6" strokeWidth="2" />
                            </svg>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f9fafb' }}>Email Preview</span>
                            <code style={{ fontSize: '12px', background: '#1f2937', padding: '2px 8px', borderRadius: '4px', color: '#9ca3af' }}>
                                {template.subject}
                            </code>
                        </div>
                        <button onClick={() => setShowPreview(false)} style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex',
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6l12 12" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#f4f4f5' }}>
                        <div style={{ maxWidth: '600px', margin: '0 auto' }}
                            dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                </div>
            )}
        </div>
    )
}
