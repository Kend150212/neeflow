'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Rule: NEVER use Lucide or any icon lib — always inline SVG ──────────────
const SvgCheck = ({ color = '#10b981' }: { color?: string }) => (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
)
const SvgArrow = ({ cls = 'h-4 w-4' }: { cls?: string }) => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
)
const SvgSparkles = ({ cls = 'h-3.5 w-3.5' }: { cls?: string }) => (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
)
const SvgCrown = () => (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 17l2-8 5 5 2-9 2 9 5-5 2 8H3zm2 3h14v1H5z" />
    </svg>
)
const SvgLoader = () => (
    <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
)
const SvgSpinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
)
const SvgZap = () => (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
)

// ─── Types ───────────────────────────────────────────────────────────────────
type Plan = {
    id: string
    name: string
    nameVi: string
    description: string | null
    descriptionVi: string | null
    priceMonthly: number
    priceAnnual: number
    maxChannels: number
    maxPostsPerMonth: number
    maxMembersPerChannel: number
    maxAiImagesPerMonth: number
    maxAiTextPerMonth: number
    maxStorageMB: number
    maxApiCallsPerMonth: number
    hasAutoSchedule: boolean
    hasWebhooks: boolean
    hasAdvancedReports: boolean
    hasPrioritySupport: boolean
    hasWhiteLabel: boolean
    stripePriceIdMonthly: string | null
    stripePriceIdAnnual: string | null
}

// ─── Plan color themes ────────────────────────────────────────────────────────
const PLAN_THEMES = [
    { accent: '#6b7280', gradient: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', check: '#9ca3af', btn: 'outline' },
    { accent: '#10b981', gradient: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)', check: '#10b981', btn: 'emerald' },
    { accent: '#8b5cf6', gradient: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.30)', check: '#8b5cf6', btn: 'violet' },
    { accent: '#f59e0b', gradient: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', check: '#f59e0b', btn: 'amber' },
    { accent: '#06b6d4', gradient: 'rgba(6,182,212,0.10)', border: 'rgba(6,182,212,0.30)', check: '#06b6d4', btn: 'cyan' },
]
const POPULAR_THEME = { accent: '#10b981', gradient: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.5)', check: '#34d399', btn: 'emerald' }

const BTN_STYLES: Record<string, string> = {
    outline: 'border border-white/20 text-white hover:bg-white/10',
    emerald: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white shadow-lg shadow-emerald-500/25',
    violet: 'bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 text-white shadow-lg shadow-violet-500/25',
    amber: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 text-white shadow-lg shadow-amber-500/25',
    cyan: 'bg-gradient-to-r from-cyan-600 to-sky-600 hover:opacity-90 text-white shadow-lg shadow-cyan-500/25',
}

function getTheme(index: number, isPopular: boolean) {
    if (isPopular) return POPULAR_THEME
    return PLAN_THEMES[index % PLAN_THEMES.length]
}

function FeatureItem({ label, checkColor }: { label: string; checkColor: string }) {
    return (
        <li className="flex items-start gap-2.5 text-sm">
            <SvgCheck color={checkColor} />
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        </li>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PricingSection() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
    const [loading, setLoading] = useState(true)
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
    const [trialEnabled, setTrialEnabled] = useState(false)
    const [coupon, setCoupon] = useState('')

    useEffect(() => {
        fetch('/api/billing/plans')
            .then(r => r.json())
            .then(data => { setPlans(data); setLoading(false) })
            .catch(() => setLoading(false))

        fetch('/api/admin/branding')
            .then(r => r.json())
            .then(d => setTrialEnabled(d.trialEnabled ?? false))
            .catch(() => { })
    }, [])

    const handleCheckout = async (planId: string) => {
        setCheckoutLoading(planId)
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, interval, couponCode: coupon || undefined }),
            })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            } else if (res.status === 401) {
                // Not logged in — redirect to register with plan context
                window.location.href = `/register?planId=${planId}&interval=${interval}`
            } else {
                alert(data.error || 'Something went wrong')
            }
        } catch {
            alert('Network error. Please try again.')
        } finally {
            setCheckoutLoading(null)
        }
    }

    const annualSaving = (plan: Plan) => {
        if (plan.priceMonthly === 0) return null
        const s = plan.priceMonthly * 12 - plan.priceAnnual
        return s > 0 ? s : null
    }

    const gridCols = plans.length <= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'

    const fmtStorage = (mb: number) =>
        mb === -1 ? 'Unlimited storage' : mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB storage` : `${mb} MB storage`

    return (
        <section id="pricing" className="py-24 scroll-mt-24 relative"
            style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(139,92,246,0.04) 50%, transparent 100%)' }}>

            <div className="mx-auto max-w-7xl px-6">

                {/* Header */}
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-5"
                        style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                        <SvgSparkles />
                        Pricing
                    </div>
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                        Simple, transparent pricing
                    </h2>
                    <p className="text-gray-400 max-w-xl mx-auto">
                        Start free. Scale when you need more. No hidden fees, no AI markup.
                    </p>

                    {trialEnabled && (
                        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                            <SvgZap />
                            Free trial available — no credit card required
                        </div>
                    )}

                    {/* Interval toggle */}
                    <div className="mt-8 inline-flex items-center p-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {(['monthly', 'annual'] as const).map(t => (
                            <button key={t} onClick={() => setInterval(t)}
                                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${interval === t ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                style={interval === t ? { background: 'rgba(255,255,255,0.1)' } : {}}>
                                {t === 'monthly' ? 'Monthly' : 'Annual'}
                                {t === 'annual' && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
                                        SAVE 17%
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Plans */}
                {loading ? (
                    <div className="flex justify-center py-20"><SvgLoader /></div>
                ) : plans.length === 0 ? (
                    <p className="text-center text-gray-400">No plans available yet.</p>
                ) : (
                    <div className={`grid gap-5 md:grid-cols-2 ${gridCols}`}>
                        {plans.map((plan, idx) => {
                            const price = interval === 'annual' ? plan.priceAnnual : plan.priceMonthly
                            const monthlyEquiv = interval === 'annual' && plan.priceAnnual > 0
                                ? (plan.priceAnnual / 12).toFixed(0) : null
                            const isContact = price === 0 && (plan.maxChannels === -1 || plan.name.toLowerCase() === 'enterprise')
                            const isPopular = plan.name === 'Pro'
                            const isFree = price === 0 && !isContact
                            const saving = annualSaving(plan)
                            const theme = getTheme(idx, isPopular)
                            const hasPriceId = interval === 'annual' ? !!plan.stripePriceIdAnnual : !!plan.stripePriceIdMonthly
                            const btnStyle = BTN_STYLES[theme.btn] ?? BTN_STYLES.outline

                            return (
                                <div key={plan.id}
                                    className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:translate-y-[-3px] ${isPopular ? 'scale-[1.02] z-10' : ''}`}
                                    style={{
                                        background: `radial-gradient(ellipse at top, ${theme.gradient} 0%, rgba(255,255,255,0.02) 60%)`,
                                        border: `1px solid ${theme.border}`,
                                        boxShadow: isPopular ? `0 0 50px ${theme.gradient}` : 'none',
                                    }}>

                                    {/* Popular badge */}
                                    {isPopular && (
                                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 2px 12px rgba(16,185,129,0.5)' }}>
                                            <SvgCrown /> Most Popular
                                        </div>
                                    )}

                                    <div className="p-6 flex flex-col gap-5 flex-1">
                                        {/* Name + description */}
                                        <div>
                                            <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                                            {plan.description && (
                                                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{plan.description}</p>
                                            )}
                                        </div>

                                        {/* Price */}
                                        <div>
                                            {isContact ? (
                                                <div className="text-2xl font-bold text-white">Contact us</div>
                                            ) : isFree ? (
                                                <>
                                                    <div className="flex items-end gap-1">
                                                        <span className="text-4xl font-black text-white">$0</span>
                                                        <span className="text-gray-400 text-sm mb-1">/mo</span>
                                                    </div>
                                                    <p className="text-xs mt-0.5 font-medium" style={{ color: '#34d399' }}>Free forever · No credit card</p>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-end gap-1">
                                                        <span className="text-4xl font-black text-white">
                                                            ${monthlyEquiv ?? price}
                                                        </span>
                                                        <span className="text-gray-400 text-sm mb-1">/mo</span>
                                                    </div>
                                                    {interval === 'annual' && (
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            Billed ${plan.priceAnnual}/year
                                                            {saving && <span className="font-medium ml-1.5" style={{ color: '#34d399' }}>Save ${saving}</span>}
                                                        </p>
                                                    )}
                                                    {trialEnabled && (
                                                        <p className="text-[11px] mt-1" style={{ color: '#a78bfa' }}>
                                                            ✨ Start with free trial
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                                        {/* Features */}
                                        <ul className="space-y-2.5 flex-1">
                                            <FeatureItem checkColor={theme.check}
                                                label={plan.maxChannels === -1 ? 'Unlimited channels' : `${plan.maxChannels} channel${plan.maxChannels > 1 ? 's' : ''}`} />
                                            <FeatureItem checkColor={theme.check}
                                                label={plan.maxPostsPerMonth === -1 ? 'Unlimited posts' : `${plan.maxPostsPerMonth} posts/month`} />
                                            <FeatureItem checkColor={theme.check}
                                                label={plan.maxMembersPerChannel === -1 ? 'Unlimited members' : `${plan.maxMembersPerChannel} members/channel`} />
                                            {plan.maxAiTextPerMonth !== 0 && (
                                                <FeatureItem checkColor={theme.check}
                                                    label={plan.maxAiTextPerMonth === -1 ? 'Unlimited AI content' : `${plan.maxAiTextPerMonth} AI content/mo`} />
                                            )}
                                            {plan.maxAiImagesPerMonth !== 0 && (
                                                <FeatureItem checkColor={theme.check}
                                                    label={plan.maxAiImagesPerMonth === -1 ? 'Unlimited AI images' : `${plan.maxAiImagesPerMonth} AI images/mo`} />
                                            )}
                                            {plan.maxStorageMB > 0 && <FeatureItem checkColor={theme.check} label={fmtStorage(plan.maxStorageMB)} />}
                                            {plan.maxApiCallsPerMonth !== 0 && (
                                                <FeatureItem checkColor={theme.check}
                                                    label={plan.maxApiCallsPerMonth === -1 ? 'Unlimited API calls' : `${plan.maxApiCallsPerMonth.toLocaleString()} API calls/mo`} />
                                            )}
                                            {plan.hasAutoSchedule && <FeatureItem checkColor={theme.check} label="Auto scheduling" />}
                                            {plan.hasWebhooks && <FeatureItem checkColor={theme.check} label="Webhooks" />}
                                            {plan.hasAdvancedReports && <FeatureItem checkColor={theme.check} label="Advanced reports" />}
                                            {plan.hasPrioritySupport && <FeatureItem checkColor={theme.check} label="Priority support" />}
                                            {plan.hasWhiteLabel && <FeatureItem checkColor={theme.check} label="White label" />}
                                        </ul>

                                        {/* CTA */}
                                        {isContact ? (
                                            <a href="mailto:hello@neeflow.com"
                                                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all ${btnStyle}`}>
                                                Contact Sales <SvgArrow />
                                            </a>
                                        ) : isFree ? (
                                            <Link href="/register"
                                                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all"
                                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                                                Start for Free <SvgArrow />
                                            </Link>
                                        ) : (
                                            <button
                                                onClick={() => handleCheckout(plan.id)}
                                                disabled={!!checkoutLoading || !hasPriceId}
                                                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${btnStyle}`}>
                                                {checkoutLoading === plan.id
                                                    ? <><SvgSpinner />Processing...</>
                                                    : <>{trialEnabled ? 'Start Free Trial' : 'Get Started'} <SvgArrow /></>
                                                }
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Trust notes */}
                <div className="mt-14 text-center space-y-1.5 text-sm text-gray-500">
                    <p>All plans use your own API keys — zero AI markup.</p>
                    <p>Media stored on your Google Drive — unlimited storage.</p>
                    <p>Cancel anytime. No lock-in.</p>
                </div>
            </div>
        </section>
    )
}
