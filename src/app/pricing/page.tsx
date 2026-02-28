'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Check, Zap, ArrowRight, Star, Shield, Headphones,
    CreditCard, Lock, ChevronDown, ChevronUp, Building2, Infinity
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

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

// Payment gateways — auto-renders any configured gateway from the BILLING integrations
// To add a new gateway: add to this list, ensure checkout API supports it.
const PAYMENT_METHODS = [
    { id: 'visa', label: 'Visa', color: '#1A1F71' },
    { id: 'mastercard', label: 'MC', color: '#EB001B' },
    { id: 'amex', label: 'AMEX', color: '#2E77BC' },
    { id: 'paypal', label: 'PayPal', color: '#003087' },
    { id: 'apple-pay', label: '⌘Pay', color: '#000' },
    { id: 'google-pay', label: 'GPay', color: '#4285F4' },
    { id: 'link', label: 'Link', color: '#00D66E' },
]

const FAQ = [
    {
        q: 'Can I change my plan later?',
        qVi: 'Tôi có thể thay đổi gói sau này không?',
        a: 'Yes, you can upgrade or downgrade at any time. Changes take effect immediately and are prorated.',
        aVi: 'Có, bạn có thể nâng cấp hoặc hạ cấp bất kỳ lúc nào. Thay đổi có hiệu lực ngay và được tính theo tỷ lệ.',
    },
    {
        q: 'What payment methods do you accept?',
        qVi: 'Bạn chấp nhận những phương thức thanh toán nào?',
        a: "We accept all major credit/debit cards, PayPal, Apple Pay, and Google Pay via Stripe's secure checkout.",
        aVi: 'Chúng tôi chấp nhận thẻ tín dụng/thẻ ghi nợ, PayPal, Apple Pay và Google Pay qua Stripe.',
    },
    {
        q: 'Do you offer a free trial?',
        qVi: 'Có dùng thử miễn phí không?',
        a: 'Yes! New accounts get a free trial to experience all Pro features before committing.',
        aVi: 'Có! Tài khoản mới được dùng thử miễn phí để trải nghiệm tất cả tính năng Pro.',
    },
    {
        q: 'Are there any extra AI fees?',
        qVi: 'Có phí AI phụ trội không?',
        a: 'No. All plans use your own API keys (OpenAI, Gemini, Runware…). We charge zero markup on AI usage.',
        aVi: 'Không. Tất cả gói sử dụng API key của bạn. Chúng tôi không tính thêm phí AI.',
    },
    {
        q: 'Where is my media stored?',
        qVi: 'Media của tôi được lưu ở đâu?',
        a: 'Media is stored on your own Google Drive, giving you full ownership and effectively unlimited storage.',
        aVi: 'Media được lưu trên Google Drive của bạn, bạn toàn quyền sở hữu và lưu trữ thực tế không giới hạn.',
    },
]

const POPULAR_PLAN = 'Pro'

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
        fetch('/api/admin/branding').then(r => r.json()).then(d => {
            setTrialEnabled(d.trialEnabled ?? true)
        }).catch(() => { })
    }, [])

    const handleCheckout = async (planId: string) => {
        setLoading(planId)
        const res = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, interval, couponCode: coupon || undefined }),
        })
        const data = await res.json()
        if (data.url) {
            window.location.href = data.url
        } else {
            alert(data.error || 'Something went wrong')
        }
        setLoading(null)
    }

    const fmt = (n: number) => n === -1 ? '∞' : n.toLocaleString()
    const fmtStorage = (mb: number) => mb === -1 ? '∞' : mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`

    const annualSaving = (plan: Plan) => {
        if (plan.priceMonthly === 0) return null
        const saving = plan.priceMonthly * 12 - plan.priceAnnual
        return saving > 0 ? saving : null
    }

    const PLAN_COLORS: Record<string, { from: string; to: string; border: string; badge: string }> = {
        Start: { from: '#6366f1', to: '#818cf8', border: 'border-indigo-500/30', badge: 'bg-indigo-500/15 text-indigo-300' },
        Pro: { from: '#8b5cf6', to: '#a78bfa', border: 'border-violet-500/40', badge: 'bg-violet-500/15 text-violet-300' },
        Business: { from: '#06b6d4', to: '#38bdf8', border: 'border-cyan-500/30', badge: 'bg-cyan-500/15 text-cyan-300' },
        Enterprise: { from: '#f59e0b', to: '#fbbf24', border: 'border-amber-500/30', badge: 'bg-amber-500/15 text-amber-300' },
    }
    const DEFAULT_COLOR = { from: '#6366f1', to: '#818cf8', border: 'border-slate-700', badge: 'bg-slate-700 text-slate-300' }

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 50%, #0a1020 100%)' }}>

            {/* ─── HERO ─────────────────────────────────────────────── */}
            <div className="relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20"
                        style={{ background: 'radial-gradient(ellipse, #7c3aed 0%, transparent 70%)' }} />
                    <div className="absolute bottom-[-10%] left-1/4 w-[400px] h-[300px] rounded-full opacity-10"
                        style={{ background: 'radial-gradient(ellipse, #06b6d4 0%, transparent 70%)' }} />
                </div>

                <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-8">
                    <div className="text-center mb-12">
                        {/* Trial badge */}
                        {trialEnabled && (
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-sm font-medium border"
                                style={{ background: 'rgba(124, 58, 237, 0.15)', borderColor: 'rgba(124, 58, 237, 0.4)', color: '#a78bfa' }}>
                                <Zap className="h-3.5 w-3.5" />
                                {locale === 'vi' ? 'Dùng thử miễn phí — không cần thẻ' : 'Free trial — no credit card required'}
                            </div>
                        )}

                        <h1 className="text-5xl lg:text-6xl font-bold tracking-tight mb-5 text-white">
                            {locale === 'vi' ? (
                                <>Chọn <span style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>gói phù hợp</span></>
                            ) : (
                                <>The plan that <span style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>fits your growth</span></>
                            )}
                        </h1>
                        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8">
                            {locale === 'vi'
                                ? 'Quản lý toàn bộ mạng xã hội với AI — bắt đầu miễn phí, nâng cấp khi cần.'
                                : "Manage all your social media with AI — start free, scale when you're ready."}
                        </p>

                        {/* Interval toggle */}
                        <div className="inline-flex items-center p-1 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                            <button
                                onClick={() => setInterval('monthly')}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${interval === 'monthly' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                style={interval === 'monthly' ? { background: 'rgba(255,255,255,0.1)' } : {}}
                            >
                                {locale === 'vi' ? 'Hàng tháng' : 'Monthly'}
                            </button>
                            <button
                                onClick={() => setInterval('annual')}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${interval === 'annual' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                style={interval === 'annual' ? { background: 'rgba(255,255,255,0.1)' } : {}}
                            >
                                {locale === 'vi' ? 'Hàng năm' : 'Annual'}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
                                    {locale === 'vi' ? '-17%' : 'Save 17%'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* ─── Plans Grid ─────────────────────────────── */}
                    <div className={`grid gap-5 ${plans.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'} mb-12`}>
                        {plans.map((plan) => {
                            const price = interval === 'annual' ? plan.priceAnnual : plan.priceMonthly
                            const isContact = price === 0 && (plan.maxChannels === -1 || plan.name === 'Enterprise')
                            const isPopular = plan.name === POPULAR_PLAN
                            const isFree = price === 0 && !isContact
                            const saving = annualSaving(plan)
                            const hasPriceId = interval === 'annual' ? !!plan.stripePriceIdAnnual : !!plan.stripePriceIdMonthly
                            const colors = PLAN_COLORS[plan.name] ?? DEFAULT_COLOR

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:translate-y-[-4px] ${isPopular ? 'ring-2' : 'hover:ring-1'}`}
                                    style={{
                                        background: isPopular
                                            ? 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(124,58,237,0.08) 100%)'
                                            : 'rgba(255,255,255,0.03)',
                                        border: '1px solid',
                                        borderColor: isPopular ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)',
                                        boxShadow: isPopular ? '0 0 40px rgba(139,92,246,0.15)' : 'none',
                                        ...(isPopular ? { ringColor: 'rgba(139,92,246,0.4)' } : {}),
                                    }}
                                >
                                    {/* Popular badge */}
                                    {isPopular && (
                                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff' }}>
                                            <Star className="h-3 w-3 fill-current" />
                                            {locale === 'vi' ? 'Phổ biến nhất' : 'Most Popular'}
                                        </div>
                                    )}

                                    <div className="p-6 flex flex-col gap-5 flex-1">
                                        {/* Header */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-bold text-lg text-white">
                                                    {locale === 'vi' ? plan.nameVi || plan.name : plan.name}
                                                </h3>
                                                {isContact && (
                                                    <Building2 className="h-5 w-5 text-amber-400" />
                                                )}
                                            </div>
                                            {(plan.description || plan.descriptionVi) && (
                                                <p className="text-xs text-slate-400">
                                                    {locale === 'vi' ? plan.descriptionVi || plan.description : plan.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Price */}
                                        <div>
                                            {isContact ? (
                                                <div className="text-2xl font-bold text-white">
                                                    {locale === 'vi' ? 'Liên hệ' : 'Contact us'}
                                                </div>
                                            ) : isFree ? (
                                                <div>
                                                    <span className="text-3xl font-bold text-white">$0</span>
                                                    <span className="text-slate-400 text-sm ml-1">{locale === 'vi' ? '/tháng' : '/mo'}</span>
                                                    <p className="text-xs text-emerald-400 mt-1">{locale === 'vi' ? 'Miễn phí mãi mãi' : 'Free forever'}</p>
                                                </div>
                                            ) : (
                                                <div>
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
                                                        <p className="text-[11px] text-violet-400 mt-1">
                                                            {locale === 'vi' ? '✨ Bắt đầu dùng thử miễn phí' : '✨ Start with free trial'}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

                                        {/* Features */}
                                        <ul className="space-y-2.5 flex-1">
                                            <FeatureRow
                                                value={plan.maxChannels === -1
                                                    ? (locale === 'vi' ? 'Kênh không giới hạn' : 'Unlimited channels')
                                                    : (locale === 'vi' ? `${plan.maxChannels} kênh` : `${plan.maxChannels} channel${plan.maxChannels > 1 ? 's' : ''}`)}
                                                icon={plan.maxChannels === -1 ? <Infinity className="h-3 w-3 text-violet-400" /> : undefined}
                                            />
                                            <FeatureRow
                                                value={plan.maxPostsPerMonth === -1
                                                    ? (locale === 'vi' ? 'Bài đăng không giới hạn' : 'Unlimited posts')
                                                    : (locale === 'vi' ? `${fmt(plan.maxPostsPerMonth)} bài/tháng` : `${fmt(plan.maxPostsPerMonth)} posts/month`)}
                                            />
                                            <FeatureRow
                                                value={locale === 'vi'
                                                    ? `${fmt(plan.maxMembersPerChannel)} thành viên/kênh`
                                                    : `${fmt(plan.maxMembersPerChannel)} members/channel`}
                                            />
                                            {plan.maxAiTextPerMonth !== 0 && (
                                                <FeatureRow
                                                    value={plan.maxAiTextPerMonth === -1
                                                        ? (locale === 'vi' ? 'AI Content không giới hạn' : 'Unlimited AI content')
                                                        : (locale === 'vi' ? `${fmt(plan.maxAiTextPerMonth)} AI content/tháng` : `${fmt(plan.maxAiTextPerMonth)} AI content/mo`)}
                                                    highlight
                                                />
                                            )}
                                            {plan.maxAiImagesPerMonth !== 0 && (
                                                <FeatureRow
                                                    value={plan.maxAiImagesPerMonth === -1
                                                        ? (locale === 'vi' ? 'AI Images không giới hạn' : 'Unlimited AI images')
                                                        : (locale === 'vi' ? `${fmt(plan.maxAiImagesPerMonth)} AI images/tháng` : `${fmt(plan.maxAiImagesPerMonth)} AI images/mo`)}
                                                    highlight
                                                />
                                            )}
                                            <FeatureRow value={`${fmtStorage(plan.maxStorageMB)} storage`} />
                                            {plan.maxApiCallsPerMonth !== 0 && (
                                                <FeatureRow
                                                    value={plan.maxApiCallsPerMonth === -1
                                                        ? (locale === 'vi' ? 'API không giới hạn' : 'Unlimited API calls')
                                                        : `${fmt(plan.maxApiCallsPerMonth)} API calls/mo`}
                                                />
                                            )}
                                            {plan.hasAutoSchedule && <FeatureRow value={locale === 'vi' ? 'Lên lịch tự động' : 'Auto scheduling'} highlight />}
                                            {plan.hasWebhooks && <FeatureRow value="Webhooks" />}
                                            {plan.hasAdvancedReports && <FeatureRow value={locale === 'vi' ? 'Báo cáo nâng cao' : 'Advanced reports'} highlight />}
                                            {plan.hasPrioritySupport && <FeatureRow value={locale === 'vi' ? 'Hỗ trợ ưu tiên' : 'Priority support'} highlight />}
                                            {plan.hasWhiteLabel && <FeatureRow value="White label" highlight />}
                                        </ul>

                                        {/* CTA */}
                                        {isContact ? (
                                            <a href="mailto:hello@neeflow.com"
                                                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000' }}
                                            >
                                                {locale === 'vi' ? 'Liên hệ sales' : 'Contact Sales'}
                                                <ArrowRight className="h-4 w-4" />
                                            </a>
                                        ) : isFree ? (
                                            <Link href="/login"
                                                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all"
                                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                                            >
                                                {locale === 'vi' ? 'Bắt đầu miễn phí' : 'Get Started Free'}
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        ) : (
                                            <button
                                                onClick={() => handleCheckout(plan.id)}
                                                disabled={!!loading || !hasPriceId}
                                                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                                                style={isPopular
                                                    ? { background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', boxShadow: '0 4px 20px rgba(139,92,246,0.4)' }
                                                    : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                                            >
                                                {loading === plan.id ? (
                                                    <span className="flex items-center gap-2">
                                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                        </svg>
                                                        {locale === 'vi' ? 'Đang xử lý...' : 'Processing...'}
                                                    </span>
                                                ) : (
                                                    <>
                                                        {trialEnabled
                                                            ? (locale === 'vi' ? 'Bắt đầu dùng thử' : 'Start Free Trial')
                                                            : (locale === 'vi' ? 'Bắt đầu ngay' : 'Get Started')}
                                                        <ArrowRight className="h-4 w-4" />
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Coupon row */}
                    <div className="flex justify-center mb-4">
                        <div className="flex items-center gap-3 px-4 py-2 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <span className="text-xs text-slate-400">{locale === 'vi' ? 'Mã giảm giá:' : 'Coupon code:'}</span>
                            <input
                                type="text"
                                value={coupon}
                                onChange={e => setCoupon(e.target.value)}
                                placeholder={locale === 'vi' ? 'Nhập mã...' : 'Enter code...'}
                                className="bg-transparent text-sm text-white outline-none placeholder:text-slate-600 w-28"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── HERO IMAGE SECTION ────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-4 py-16">
                <div className="relative rounded-3xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* Glow behind image */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full opacity-30"
                            style={{ background: 'radial-gradient(ellipse, #7c3aed 0%, transparent 70%)' }} />
                    </div>

                    <div className="relative grid lg:grid-cols-2 gap-0 items-center">
                        {/* Left: copy */}
                        <div className="px-10 py-12 lg:py-16">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
                                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                                <Zap className="h-3 w-3" />
                                {locale === 'vi' ? 'Nền tảng số 1 cho Social Media AI' : '#1 AI Social Media Platform'}
                            </div>
                            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
                                {locale === 'vi'
                                    ? <>Một nền tảng.<br /><span style={{ color: '#a78bfa' }}>Toàn bộ mạng xã hội.</span></>
                                    : <>One platform.<br /><span style={{ color: '#a78bfa' }}>All your social media.</span></>
                                }
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm">
                                {locale === 'vi'
                                    ? 'Lên lịch, tạo nội dung AI, quản lý inbox và phân tích hiệu suất — tất cả trong một giao diện thống nhất.'
                                    : 'Schedule posts, generate AI content, manage inbox, and analyze performance — all in one unified dashboard.'}
                            </p>

                            {/* Trust badges */}
                            <div className="flex flex-wrap gap-3 mb-8">
                                {[
                                    { icon: <Shield className="h-3.5 w-3.5 text-emerald-400" />, label: locale === 'vi' ? 'Bảo mật SSL' : 'SSL Secured' },
                                    { icon: <Lock className="h-3.5 w-3.5 text-blue-400" />, label: locale === 'vi' ? 'Không ràng buộc' : 'Cancel anytime' },
                                    { icon: <Headphones className="h-3.5 w-3.5 text-violet-400" />, label: '24/7 Support' },
                                ].map(b => (
                                    <div key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        {b.icon}{b.label}
                                    </div>
                                ))}
                            </div>

                            {/* Payment methods — auto-renders from PAYMENT_METHODS config */}
                            <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                                    <span className="text-[11px] text-slate-500">
                                        {locale === 'vi' ? 'Phương thức thanh toán được chấp nhận' : 'Accepted payment methods'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {PAYMENT_METHODS.map(pm => (
                                        <div key={pm.id}
                                            className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide"
                                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                        >
                                            {pm.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: hero image */}
                        <div className="relative lg:h-full min-h-[300px] overflow-hidden">
                            <div className="absolute inset-0 lg:inset-auto lg:relative w-full h-full">
                                <Image
                                    src="/images/hero-dashboard.webp"
                                    alt="NeeFlow AI Social Media Dashboard"
                                    fill
                                    className="object-cover object-center"
                                    sizes="(max-width: 1024px) 100vw, 50vw"
                                    priority
                                />
                                {/* Fade left edge on desktop */}
                                <div className="absolute inset-y-0 left-0 w-20 hidden lg:block"
                                    style={{ background: 'linear-gradient(to right, rgba(10,10,26,1), transparent)' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── STATS ROW ──────────────────────────────────────────── */}
            <div className="max-w-5xl mx-auto px-4 pb-16">
                <div className="grid grid-cols-3 gap-6 text-center">
                    {[
                        { n: '10+', label: locale === 'vi' ? 'Nền tảng xã hội' : 'Social platforms' },
                        { n: '0', label: locale === 'vi' ? 'Phí AI ẩn' : 'Hidden AI fees' },
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

            {/* ─── FAQ ────────────────────────────────────────────────── */}
            <div className="max-w-3xl mx-auto px-4 pb-24">
                <h2 className="text-2xl font-bold text-white text-center mb-8">
                    {locale === 'vi' ? 'Câu hỏi thường gặp' : 'Frequently Asked Questions'}
                </h2>
                <div className="space-y-3">
                    {FAQ.map((item, i) => (
                        <div key={i} className="rounded-2xl overflow-hidden transition-all"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <button
                                className="w-full flex items-center justify-between px-5 py-4 text-left"
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                            >
                                <span className="font-medium text-sm text-white">
                                    {locale === 'vi' ? item.qVi : item.q}
                                </span>
                                {openFaq === i
                                    ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                                    : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                                }
                            </button>
                            {openFaq === i && (
                                <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">
                                    {locale === 'vi' ? item.aVi : item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Bottom note */}
                <div className="mt-10 text-center space-y-1 text-xs text-slate-500">
                    <p>{locale === 'vi' ? 'Tất cả gói sử dụng API key của bạn — không phí AI.' : 'All plans use your own API keys — no extra AI fees.'}</p>
                    <p>{locale === 'vi' ? 'Hủy bất cứ lúc nào. Không ràng buộc.' : 'Cancel anytime. No lock-in.'}</p>
                </div>
            </div>
        </div>
    )
}

function FeatureRow({ value, icon, highlight }: { value: string; icon?: React.ReactNode; highlight?: boolean }) {
    return (
        <li className="flex items-center gap-2 text-sm">
            {icon ?? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: highlight ? '#a78bfa' : '#34d399' }} />}
            <span style={{ color: highlight ? '#c4b5fd' : '#94a3b8' }}>{value}</span>
        </li>
    )
}
