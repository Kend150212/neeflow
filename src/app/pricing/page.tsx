'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// ─── SVG Icons ─────────────────────────────────────────────────────────────
// Rule: NEVER use Lucide or any icon library — always use inline SVG

const SvgCheck = ({ color = '#34d399', className = 'h-3.5 w-3.5' }: { color?: string; className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
)
const SvgArrow = () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
)
const SvgZap = ({ className = 'h-3.5 w-3.5' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
)
const SvgStar = () => (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
)
const SvgShield = () => (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
)
const SvgLock = () => (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
)
const SvgHeadphones = () => (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
)
const SvgCard = () => (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
)
const SvgBuilding = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <path d="M6 1h12" />
    </svg>
)
const SvgChevronDown = () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
    </svg>
)
const SvgChevronUp = () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
    </svg>
)
const SvgSpinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
)
const SvgInfinity = () => (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round">
        <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4zm0 0c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z" />
    </svg>
)

// ─── Payment Method SVG Logos ──────────────────────────────────────────────
// Add new gateways here — they auto-render in the UI
const PaymentLogos: Record<string, React.FC> = {
    visa: () => (
        <svg viewBox="0 0 60 20" className="h-5 w-auto" aria-label="Visa">
            <text x="0" y="17" fontSize="18" fontWeight="900" fontFamily="Arial" fill="#1A1F71">VISA</text>
        </svg>
    ),
    mastercard: () => (
        <svg viewBox="0 0 38 24" className="h-6 w-auto" aria-label="Mastercard">
            <circle cx="13" cy="12" r="11" fill="#EB001B" />
            <circle cx="25" cy="12" r="11" fill="#F79E1B" />
            <path d="M19 4.8a11 11 0 0 1 0 14.4A11 11 0 0 1 19 4.8z" fill="#FF5F00" />
        </svg>
    ),
    amex: () => (
        <svg viewBox="0 0 60 20" className="h-5 w-auto" aria-label="American Express">
            <text x="0" y="16" fontSize="11" fontWeight="800" fontFamily="Arial" fill="#2E77BC" letterSpacing="0.5">AMEX</text>
        </svg>
    ),
    paypal: () => (
        <svg viewBox="0 0 80 22" className="h-5 w-auto" aria-label="PayPal">
            <text x="0" y="17" fontSize="16" fontWeight="800" fontFamily="Arial" fill="#003087">Pay</text>
            <text x="30" y="17" fontSize="16" fontWeight="800" fontFamily="Arial" fill="#009cde">Pal</text>
        </svg>
    ),
    'apple-pay': () => (
        <svg viewBox="0 0 60 24" className="h-5 w-auto" aria-label="Apple Pay">
            <text x="0" y="18" fontSize="13" fontWeight="600" fontFamily="-apple-system, sans-serif" fill="currentColor"></text>
            <text x="16" y="18" fontSize="13" fontWeight="500" fontFamily="-apple-system, sans-serif" fill="currentColor">Pay</text>
            <text x="0" y="18" fontSize="14" fontFamily="-apple-system" fill="currentColor">⌘</text>
        </svg>
    ),
    'google-pay': () => (
        <svg viewBox="0 0 60 22" className="h-5 w-auto" aria-label="Google Pay">
            <text x="0" y="17" fontSize="13" fontWeight="500" fontFamily="'Google Sans', Arial, sans-serif">
                <tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC04">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan>
            </text>
            <text x="42" y="17" fontSize="13" fontWeight="600" fontFamily="Arial" fill="#5F6368"> Pay</text>
        </svg>
    ),
    link: () => (
        <svg viewBox="0 0 44 22" className="h-5 w-auto" aria-label="Stripe Link">
            <rect width="44" height="22" rx="4" fill="#00D66E" />
            <text x="8" y="15" fontSize="11" fontWeight="700" fontFamily="Arial" fill="#fff">Link</text>
        </svg>
    ),
}

// ─── Config — add new gateways here to auto-show in UI ──────────────────────
const PAYMENT_METHODS = [
    'visa', 'mastercard', 'amex', 'paypal', 'apple-pay', 'google-pay', 'link',
] as const

// ─── Types ──────────────────────────────────────────────────────────────────
type Plan = {
    id: string; name: string; nameVi: string
    description: string | null; descriptionVi: string | null
    priceMonthly: number; priceAnnual: number
    maxChannels: number; maxPostsPerMonth: number; maxMembersPerChannel: number
    maxAiImagesPerMonth: number; maxAiTextPerMonth: number
    maxStorageMB: number; maxApiCallsPerMonth: number
    hasAutoSchedule: boolean; hasWebhooks: boolean; hasAdvancedReports: boolean
    hasPrioritySupport: boolean; hasWhiteLabel: boolean
    stripePriceIdMonthly: string | null; stripePriceIdAnnual: string | null
}

const POPULAR_PLAN = 'Pro'

const PLAN_GLOW: Record<string, string> = {
    Start: 'rgba(99,102,241,0.15)',
    Pro: 'rgba(139,92,246,0.18)',
    Business: 'rgba(6,182,212,0.15)',
    Enterprise: 'rgba(245,158,11,0.15)',
}

const FAQ_ITEMS = [
    {
        q: 'Can I change my plan later?',
        qVi: 'Tôi có thể thay đổi gói sau này không?',
        a: 'Yes — upgrade or downgrade anytime. Changes take effect immediately and are prorated.',
        aVi: 'Có, bạn có thể nâng cấp hoặc hạ cấp bất kỳ lúc nào. Thay đổi có hiệu lực ngay.',
    },
    {
        q: "What payment methods do you accept?",
        qVi: 'Bạn chấp nhận những phương thức thanh toán nào?',
        a: "All major credit/debit cards, PayPal, Apple Pay, Google Pay, and Stripe Link.",
        aVi: 'Thẻ tín dụng/thẻ ghi nợ, PayPal, Apple Pay, Google Pay và Stripe Link.',
    },
    {
        q: 'Do you offer a free trial?',
        qVi: 'Có dùng thử miễn phí không?',
        a: 'Yes! New accounts get a free trial — no credit card required during the trial period.',
        aVi: 'Có! Tài khoản mới được dùng thử miễn phí — không cần thẻ trong thời gian dùng thử.',
    },
    {
        q: 'Are there any extra AI fees?',
        qVi: 'Có phí AI phụ trội không?',
        a: 'No. All plans use your own API keys (OpenAI, Gemini, Runware…). Zero AI markup.',
        aVi: 'Không. Tất cả gói sử dụng API key của bạn. Chúng tôi không tính thêm phí AI.',
    },
    {
        q: 'Where is my media stored?',
        qVi: 'Media của tôi được lưu ở đâu?',
        a: 'Media lives on your own Google Drive — you keep full ownership and get unlimited storage.',
        aVi: 'Media được lưu trên Google Drive của bạn — bạn toàn quyền sở hữu, lưu trữ không giới hạn.',
    },
]

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PricingPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
    const [loading, setLoading] = useState<string | null>(null)
    const [coupon, setCoupon] = useState('')
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [trialEnabled, setTrialEnabled] = useState(true)

    const locale = typeof navigator !== 'undefined' && navigator.language.startsWith('vi') ? 'vi' : 'en'

    useEffect(() => {
        fetch('/api/billing/plans').then(r => r.json()).then(setPlans).catch(console.error)
        fetch('/api/admin/branding').then(r => r.json()).then(d => setTrialEnabled(d.trialEnabled ?? true)).catch(() => { })
    }, [])

    const handleCheckout = async (planId: string) => {
        setLoading(planId)
        const res = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, interval, couponCode: coupon || undefined }),
        })
        const data = await res.json()
        if (data.url) window.location.href = data.url
        else alert(data.error || 'Something went wrong')
        setLoading(null)
    }

    const fmt = (n: number) => n === -1 ? '∞' : n.toLocaleString()
    const fmtStorage = (mb: number) => mb === -1 ? '∞' : mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`
    const annualSaving = (p: Plan) => {
        if (p.priceMonthly === 0) return null
        const s = p.priceMonthly * 12 - p.priceAnnual
        return s > 0 ? s : null
    }

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #07071a 0%, #0d0d2b 50%, #080f1c 100%)' }}>

            {/* ── Purple ambient glow ── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-15"
                    style={{ background: 'radial-gradient(ellipse, #7c3aed 0%, transparent 70%)' }} />
                <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full opacity-8"
                    style={{ background: 'radial-gradient(ellipse, #0ea5e9 0%, transparent 70%)' }} />
            </div>

            {/* ── HERO HEADER ── */}
            <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-4 text-center">

                {trialEnabled && (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-sm font-medium"
                        style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa' }}>
                        <SvgZap />
                        {locale === 'vi' ? 'Dùng thử miễn phí — không cần thẻ' : 'Free trial — no credit card required'}
                    </div>
                )}

                <h1 className="text-5xl lg:text-6xl font-black tracking-tight mb-5 text-white">
                    {locale === 'vi'
                        ? <>Chọn <span style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>gói phù hợp</span></>
                        : <>The plan that <span style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>fits your growth</span></>
                    }
                </h1>
                <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8">
                    {locale === 'vi'
                        ? 'Quản lý toàn bộ mạng xã hội với AI — bắt đầu miễn phí, nâng cấp khi cần.'
                        : 'Manage all your social media with AI — start free, scale when ready.'}
                </p>

                {/* Billing toggle */}
                <div className="inline-flex items-center p-1 rounded-full mb-10"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {(['monthly', 'annual'] as const).map(t => (
                        <button key={t} onClick={() => setInterval(t)}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${interval === t ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            style={interval === t ? { background: 'rgba(139,92,246,0.3)' } : {}}>
                            {t === 'monthly' ? (locale === 'vi' ? 'Hàng tháng' : 'Monthly') : (locale === 'vi' ? 'Hàng năm' : 'Annual')}
                            {t === 'annual' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
                                    {locale === 'vi' ? '-17%' : 'Save 17%'}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── PLAN CARDS ── */}
            <div className={`relative max-w-7xl mx-auto px-4 pb-12 grid gap-5 ${plans.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
                {plans.map(plan => {
                    const price = interval === 'annual' ? plan.priceAnnual : plan.priceMonthly
                    const isContact = price === 0 && (plan.maxChannels === -1 || plan.name === 'Enterprise')
                    const isFree = price === 0 && !isContact
                    const isPopular = plan.name === POPULAR_PLAN
                    const saving = annualSaving(plan)
                    const hasPriceId = interval === 'annual' ? !!plan.stripePriceIdAnnual : !!plan.stripePriceIdMonthly
                    const glow = PLAN_GLOW[plan.name] ?? 'rgba(139,92,246,0.1)'

                    return (
                        <div key={plan.id}
                            className="relative rounded-2xl flex flex-col transition-all duration-300 hover:translate-y-[-4px]"
                            style={{
                                background: isPopular
                                    ? `radial-gradient(ellipse at top, ${glow} 0%, rgba(255,255,255,0.02) 70%)`
                                    : 'rgba(255,255,255,0.025)',
                                border: `1px solid ${isPopular ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.08)'}`,
                                boxShadow: isPopular ? `0 0 50px ${glow}` : 'none',
                            }}>

                            {isPopular && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', boxShadow: '0 2px 12px rgba(139,92,246,0.5)' }}>
                                    <SvgStar />
                                    {locale === 'vi' ? 'Phổ biến nhất' : 'Most Popular'}
                                </div>
                            )}

                            <div className="p-6 flex flex-col gap-5 flex-1">
                                {/* Name */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg text-white">{locale === 'vi' ? plan.nameVi || plan.name : plan.name}</h3>
                                        {(plan.description || plan.descriptionVi) && (
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {locale === 'vi' ? plan.descriptionVi || plan.description : plan.description}
                                            </p>
                                        )}
                                    </div>
                                    {isContact && <SvgBuilding />}
                                </div>

                                {/* Price */}
                                <div>
                                    {isContact ? (
                                        <div className="text-2xl font-bold text-white">{locale === 'vi' ? 'Liên hệ' : 'Contact us'}</div>
                                    ) : isFree ? (
                                        <>
                                            <div className="flex items-end gap-1">
                                                <span className="text-4xl font-black text-white">$0</span>
                                                <span className="text-slate-400 text-sm mb-1">{locale === 'vi' ? '/tháng' : '/mo'}</span>
                                            </div>
                                            <p className="text-xs font-medium mt-1" style={{ color: '#34d399' }}>{locale === 'vi' ? 'Miễn phí mãi mãi' : 'Free forever'}</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-end gap-1">
                                                <span className="text-4xl font-black text-white">${price}</span>
                                                <span className="text-slate-400 text-sm mb-1">
                                                    {interval === 'annual' ? (locale === 'vi' ? '/năm' : '/yr') : (locale === 'vi' ? '/tháng' : '/mo')}
                                                </span>
                                            </div>
                                            {interval === 'annual' && saving && (
                                                <p className="text-xs font-medium mt-0.5" style={{ color: '#34d399' }}>
                                                    {locale === 'vi' ? `Tiết kiệm $${saving}/năm` : `Save $${saving}/year`}
                                                </p>
                                            )}
                                            {trialEnabled && (
                                                <p className="text-[11px] mt-1" style={{ color: '#a78bfa' }}>
                                                    ✨ {locale === 'vi' ? 'Bắt đầu dùng thử miễn phí' : 'Start with free trial'}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                                {/* Features */}
                                <ul className="space-y-2.5 flex-1">
                                    <FRow value={plan.maxChannels === -1 ? (locale === 'vi' ? 'Kênh không giới hạn' : 'Unlimited channels') : (locale === 'vi' ? `${plan.maxChannels} kênh` : `${plan.maxChannels} channel${plan.maxChannels > 1 ? 's' : ''}`)} icon={plan.maxChannels === -1 ? <SvgInfinity /> : undefined} />
                                    <FRow value={plan.maxPostsPerMonth === -1 ? (locale === 'vi' ? 'Bài đăng không giới hạn' : 'Unlimited posts') : (locale === 'vi' ? `${fmt(plan.maxPostsPerMonth)} bài/tháng` : `${fmt(plan.maxPostsPerMonth)} posts/month`)} />
                                    <FRow value={locale === 'vi' ? `${fmt(plan.maxMembersPerChannel)} thành viên/kênh` : `${fmt(plan.maxMembersPerChannel)} members/channel`} />
                                    {plan.maxAiTextPerMonth !== 0 && <FRow value={plan.maxAiTextPerMonth === -1 ? (locale === 'vi' ? 'AI Content không giới hạn' : 'Unlimited AI content') : (locale === 'vi' ? `${fmt(plan.maxAiTextPerMonth)} AI content/tháng` : `${fmt(plan.maxAiTextPerMonth)} AI content/mo`)} highlight />}
                                    {plan.maxAiImagesPerMonth !== 0 && <FRow value={plan.maxAiImagesPerMonth === -1 ? (locale === 'vi' ? 'AI Images không giới hạn' : 'Unlimited AI images') : (locale === 'vi' ? `${fmt(plan.maxAiImagesPerMonth)} AI images/tháng` : `${fmt(plan.maxAiImagesPerMonth)} AI images/mo`)} highlight />}
                                    <FRow value={`${fmtStorage(plan.maxStorageMB)} storage`} />
                                    {plan.maxApiCallsPerMonth !== 0 && <FRow value={plan.maxApiCallsPerMonth === -1 ? 'Unlimited API calls' : `${fmt(plan.maxApiCallsPerMonth)} API calls/mo`} />}
                                    {plan.hasAutoSchedule && <FRow value={locale === 'vi' ? 'Lên lịch tự động' : 'Auto scheduling'} highlight />}
                                    {plan.hasWebhooks && <FRow value="Webhooks" />}
                                    {plan.hasAdvancedReports && <FRow value={locale === 'vi' ? 'Báo cáo nâng cao' : 'Advanced reports'} highlight />}
                                    {plan.hasPrioritySupport && <FRow value={locale === 'vi' ? 'Hỗ trợ ưu tiên' : 'Priority support'} highlight />}
                                    {plan.hasWhiteLabel && <FRow value="White label" highlight />}
                                </ul>

                                {/* CTA */}
                                {isContact ? (
                                    <a href="mailto:hello@neeflow.com"
                                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000' }}>
                                        {locale === 'vi' ? 'Liên hệ sales' : 'Contact Sales'} <SvgArrow />
                                    </a>
                                ) : isFree ? (
                                    <Link href="/login"
                                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                                        {locale === 'vi' ? 'Bắt đầu miễn phí' : 'Get Started Free'} <SvgArrow />
                                    </Link>
                                ) : (
                                    <button onClick={() => handleCheckout(plan.id)}
                                        disabled={!!loading || !hasPriceId}
                                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                                        style={isPopular
                                            ? { background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', boxShadow: '0 4px 20px rgba(139,92,246,0.4)' }
                                            : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                                        {loading === plan.id ? <><SvgSpinner />{locale === 'vi' ? 'Đang xử lý...' : 'Processing...'}</> : <>
                                            {trialEnabled
                                                ? (locale === 'vi' ? 'Bắt đầu dùng thử' : 'Start Free Trial')
                                                : (locale === 'vi' ? 'Bắt đầu ngay' : 'Get Started')}
                                            <SvgArrow />
                                        </>}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Coupon */}
            <div className="flex justify-center pb-8">
                <div className="flex items-center gap-3 px-4 py-2 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-xs text-slate-500">{locale === 'vi' ? 'Mã giảm giá:' : 'Coupon:'}</span>
                    <input type="text" value={coupon} onChange={e => setCoupon(e.target.value)}
                        placeholder={locale === 'vi' ? 'Nhập mã...' : 'Enter code...'}
                        className="bg-transparent text-sm text-white outline-none placeholder:text-slate-600 w-28" />
                </div>
            </div>

            {/* ── HERO IMAGE SPLIT SECTION ── */}
            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="relative rounded-3xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full"
                            style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)' }} />
                    </div>
                    <div className="relative grid lg:grid-cols-2 items-center">
                        {/* Copy */}
                        <div className="px-10 py-12 lg:py-16">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
                                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                                <SvgZap className="h-3 w-3" />
                                {locale === 'vi' ? 'Nền tảng AI Social Media #1' : '#1 AI Social Media Platform'}
                            </div>
                            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
                                {locale === 'vi'
                                    ? <><span style={{ color: '#a78bfa' }}>Một nền tảng.</span><br />Toàn bộ mạng xã hội.</>
                                    : <><span style={{ color: '#a78bfa' }}>One platform.</span><br />All your social media.</>
                                }
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm">
                                {locale === 'vi'
                                    ? 'Lên lịch, tạo nội dung AI, quản lý inbox và phân tích hiệu suất — tất cả trong một giao diện thống nhất.'
                                    : 'Schedule, generate AI content, manage inbox and analytics — all in one unified dashboard.'}
                            </p>

                            {/* Trust badges with SVG icons */}
                            <div className="flex flex-wrap gap-3 mb-8">
                                {[
                                    { icon: <SvgShield />, label: locale === 'vi' ? 'Bảo mật SSL' : 'SSL Secured' },
                                    { icon: <SvgLock />, label: locale === 'vi' ? 'Không ràng buộc' : 'Cancel anytime' },
                                    { icon: <SvgHeadphones />, label: '24/7 Support' },
                                ].map(b => (
                                    <div key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        {b.icon} {b.label}
                                    </div>
                                ))}
                            </div>

                            {/* Payment method SVG logos — auto from PAYMENT_METHODS array */}
                            <div>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <SvgCard />
                                    <span className="text-[11px] text-slate-500">
                                        {locale === 'vi' ? 'Phương thức thanh toán được chấp nhận' : 'Accepted payment methods'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    {PAYMENT_METHODS.map(id => {
                                        const Logo = PaymentLogos[id]
                                        return Logo ? (
                                            <div key={id} className="px-3 py-1.5 rounded-lg flex items-center"
                                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <Logo />
                                            </div>
                                        ) : null
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Hero image */}
                        <div className="relative h-72 lg:h-full min-h-[350px]">
                            <Image src="/images/hero-dashboard.webp" alt="NeeFlow Dashboard"
                                fill className="object-cover object-center"
                                sizes="(max-width: 1024px) 100vw, 50vw" priority />
                            <div className="absolute inset-y-0 left-0 w-24 hidden lg:block"
                                style={{ background: 'linear-gradient(to right, #07071a, transparent)' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── STATS ── */}
            <div className="max-w-5xl mx-auto px-4 pb-16">
                <div className="grid grid-cols-3 gap-5 text-center">
                    {[
                        { n: '10+', label: locale === 'vi' ? 'Nền tảng xã hội' : 'Social platforms' },
                        { n: '$0', label: locale === 'vi' ? 'Phí AI ẩn' : 'Hidden AI fees' },
                        { n: '∞', label: locale === 'vi' ? 'Lưu trữ Drive' : 'Drive storage' },
                    ].map(s => (
                        <div key={s.n} className="rounded-2xl p-6"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="text-4xl font-black mb-1"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {s.n}
                            </div>
                            <div className="text-xs text-slate-400">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── FAQ ── */}
            <div className="max-w-3xl mx-auto px-4 pb-24">
                <h2 className="text-2xl font-bold text-white text-center mb-8">
                    {locale === 'vi' ? 'Câu hỏi thường gặp' : 'Frequently Asked Questions'}
                </h2>
                <div className="space-y-3">
                    {FAQ_ITEMS.map((item, i) => (
                        <div key={i} className="rounded-2xl overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <button className="w-full flex items-center justify-between px-5 py-4 text-left"
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                <span className="font-medium text-sm text-white">{locale === 'vi' ? item.qVi : item.q}</span>
                                {openFaq === i ? <SvgChevronUp /> : <SvgChevronDown />}
                            </button>
                            {openFaq === i && (
                                <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">
                                    {locale === 'vi' ? item.aVi : item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-10 text-center text-xs text-slate-600 space-y-1">
                    <p>{locale === 'vi' ? 'Tất cả gói sử dụng API key của bạn — không phí AI.' : 'All plans use your own API keys — no extra AI fees.'}</p>
                    <p>{locale === 'vi' ? 'Hủy bất cứ lúc nào. Không ràng buộc.' : 'Cancel anytime. No lock-in.'}</p>
                </div>
            </div>
        </div>
    )
}

// ─── Feature row component ──────────────────────────────────────────────────
function FRow({ value, icon, highlight }: { value: string; icon?: React.ReactNode; highlight?: boolean }) {
    return (
        <li className="flex items-center gap-2 text-sm">
            {icon ?? <SvgCheck color={highlight ? '#a78bfa' : '#34d399'} />}
            <span style={{ color: highlight ? '#c4b5fd' : '#94a3b8' }}>{value}</span>
        </li>
    )
}
