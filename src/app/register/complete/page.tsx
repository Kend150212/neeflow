'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function RegisterCompletePage() {
    const searchParams = useSearchParams()
    const sessionId = searchParams.get('session_id')

    const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
    const [email, setEmail] = useState('')
    const [planName, setPlanName] = useState('')
    const [trialDays, setTrialDays] = useState<number>(0)
    const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

    useEffect(() => {
        if (!sessionId) {
            setState('error')
            return
        }

        fetch(`/api/billing/register-complete?session_id=${sessionId}`)
            .then(res => res.json())
            .then(data => {
                if (data.email) {
                    setEmail(data.email)
                    setPlanName(data.planName || 'Your Plan')
                    setTrialDays(data.trialDays || 0)
                    setState('success')
                } else {
                    setState('error')
                }
            })
            .catch(() => setState('error'))
    }, [sessionId])

    const handleResend = async () => {
        setResendState('sending')
        try {
            const res = await fetch(`/api/billing/register-complete?session_id=${sessionId}&resend=true`, { method: 'POST' })
            if (res.ok) setResendState('sent')
            else setResendState('error')
        } catch {
            setResendState('error')
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #fff0f9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
            <div style={{
                maxWidth: '480px',
                width: '100%',
                background: '#ffffff',
                borderRadius: '20px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                overflow: 'hidden',
            }}>
                {/* Gradient top bar */}
                <div style={{ height: '4px', background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7, #ec4899)' }} />

                <div style={{ padding: '48px 40px' }}>
                    {state === 'loading' && (
                        <div style={{ textAlign: 'center' }}>
                            {/* Spinner SVG */}
                            <svg style={{ width: 48, height: 48, animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}
                                viewBox="0 0 24 24" fill="none">
                                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                                <circle cx="12" cy="12" r="10" stroke="#e4e4e7" strokeWidth="3" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            <p style={{ color: '#71717a', fontSize: '15px', margin: 0 }}>Verifying your payment...</p>
                        </div>
                    )}

                    {state === 'success' && (
                        <div style={{ textAlign: 'center' }}>
                            {/* Success checkmark SVG */}
                            <div style={{
                                width: 72, height: 72, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 24px',
                            }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                                    <path d="M5 13l4 4L19 7" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>

                            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#18181b', margin: '0 0 8px' }}>
                                Payment Successful! 🎉
                            </h1>
                            <p style={{ fontSize: '15px', color: '#71717a', lineHeight: 1.6, margin: '0 0 24px' }}>
                                Your <strong style={{ color: '#18181b' }}>{planName}</strong> plan is now active.
                                {trialDays > 0 && (
                                    <> You have a <strong style={{ color: '#7c3aed' }}>{trialDays}-day free trial</strong> — no charge until it ends.</>
                                )}
                            </p>

                            {/* Email info box */}
                            <div style={{
                                background: '#fafafa',
                                border: '1px solid #e4e4e7',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                marginBottom: '24px',
                                textAlign: 'left',
                            }}>
                                {/* Email icon */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '8px',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#fff" strokeWidth="2" />
                                            <path d="M2 8l10 6 10-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                                            Check your email
                                        </p>
                                        <p style={{ margin: 0, fontSize: '14px', color: '#18181b', fontWeight: 500 }}>
                                            {email}
                                        </p>
                                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#71717a' }}>
                                            We sent a link to set up your password. Check your inbox (and spam folder).
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Steps */}
                            <div style={{ textAlign: 'left', marginBottom: '28px' }}>
                                {[
                                    { num: '1', text: 'Open the email we just sent you' },
                                    { num: '2', text: 'Click "Set Up Your Password"' },
                                    { num: '3', text: 'Log in and access your dashboard' },
                                ].map(step => (
                                    <div key={step.num} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div style={{
                                            width: 24, height: 24, borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            color: '#fff', fontSize: '12px', fontWeight: 700,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>{step.num}</div>
                                        <p style={{ margin: '2px 0 0', fontSize: '14px', color: '#52525b' }}>{step.text}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Resend button */}
                            <button
                                onClick={handleResend}
                                disabled={resendState === 'sending' || resendState === 'sent'}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: '1px solid #e4e4e7',
                                    background: resendState === 'sent' ? '#f0fdf4' : '#fff',
                                    color: resendState === 'sent' ? '#15803d' : '#52525b',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: resendState === 'sending' || resendState === 'sent' ? 'default' : 'pointer',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                }}
                            >
                                {resendState === 'sent' ? (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path d="M5 13l4 4L19 7" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />
                                        </svg>
                                        Email sent!
                                    </>
                                ) : resendState === 'sending' ? 'Sending...' : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#52525b" strokeWidth="2" />
                                            <circle cx="12" cy="12" r="3" stroke="#52525b" strokeWidth="2" />
                                        </svg>
                                        Resend setup email
                                    </>
                                )}
                            </button>

                            <Link href="/login" style={{
                                display: 'block',
                                textAlign: 'center',
                                padding: '12px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff',
                                borderRadius: '10px',
                                textDecoration: 'none',
                                fontSize: '14px',
                                fontWeight: 600,
                            }}>
                                Already set up? Sign In →
                            </Link>
                        </div>
                    )}

                    {state === 'error' && (
                        <div style={{ textAlign: 'center' }}>
                            {/* Error icon */}
                            <div style={{
                                width: 72, height: 72, borderRadius: '50%',
                                background: '#fef2f2',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 24px',
                            }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2" />
                                    <path d="M12 8v4M12 16h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 8px' }}>
                                Something went wrong
                            </h1>
                            <p style={{ fontSize: '14px', color: '#71717a', margin: '0 0 24px' }}>
                                We couldn`&apos;`t verify your payment session. If you completed payment,{' '}
                                please check your email or contact support.
                            </p>
                            <Link href="/pricing" style={{
                                display: 'inline-block', padding: '12px 24px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', borderRadius: '10px', textDecoration: 'none',
                                fontSize: '14px', fontWeight: 600,
                            }}>
                                ← Back to Pricing
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
