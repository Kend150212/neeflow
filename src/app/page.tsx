'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useBranding } from '@/lib/use-branding'
// ─── Inline SVG icons — never use Lucide or any icon library ─────────────
const SvgMoon = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>)
const SvgSun = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>)
const SvgArrowRight = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>)
const SvgZap = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>)
const SvgCalendar = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>)
const SvgBarChart3 = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18" rx="1" /><rect x="10" y="8" width="4" height="13" rx="1" /><rect x="2" y="13" width="4" height="8" rx="1" /></svg>)
const SvgUsers = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>)
const SvgMenu = ({ className = 'w-5 h-5' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>)
const SvgX = ({ className = 'w-5 h-5' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)
const SvgSparkles = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>)
const SvgGlobe = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>)
const SvgClock = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>)
const SvgTrendingUp = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>)
const SvgShield = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>)
const SvgBot = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></svg>)
const SvgLayers = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>)
const SvgChevronRight = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>)
const SvgStar = ({ className = 'w-4 h-4', filled = false }: { className?: string; filled?: boolean }) => (<svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>)
const SvgInbox = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>)
const SvgFileText = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>)
const SvgRefreshCw = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>)
const SvgLock = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>)
const SvgCheckCircle = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>)
// Pricing hidden for pre-launch

// ── SVG Platform Logos ────────────────────────────────────────────────────────
const FacebookSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)
const InstagramSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
)
const TikTokSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
)
const YouTubeSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)
const LinkedInSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)
const XSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 5.892zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)
const PinterestSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
)

const platforms = [
  { name: 'Facebook', component: FacebookSVG, color: '#1877F2' },
  { name: 'Instagram', component: InstagramSVG, color: '#E4405F' },
  { name: 'TikTok', component: TikTokSVG, color: '#000000' },
  { name: 'YouTube', component: YouTubeSVG, color: '#FF0000' },
  { name: 'LinkedIn', component: LinkedInSVG, color: '#0A66C2' },
  { name: 'X', component: XSVG, color: '#000000' },
  { name: 'Pinterest', component: PinterestSVG, color: '#E60023' },
]

// ── Feature Data ───────────────────────────────────────────────────────────────
const features = [
  {
    icon: SvgSparkles,
    title: 'AI Content Engine',
    desc: 'Type your brand in plain English. Get captions, hashtags, hooks, and a full content calendar — tuned for each platform. Powered by GPT-4, Gemini, Claude and more.',
    gradient: 'from-violet-500 to-purple-600',
    badge: '🔥 Core Feature',
  },
  {
    icon: SvgCalendar,
    title: 'Smart Auto-Scheduler',
    desc: 'AI analyzes your audience and picks the exact time each post should go live for maximum reach. Schedule once, repeat forever.',
    gradient: 'from-green-500 to-emerald-600',
    badge: null,
  },
  {
    icon: SvgBarChart3,
    title: 'Unified Analytics',
    desc: 'One dashboard for all your platforms. See follower growth, reach, engagement rate, and content ROI — no tab-switching required.',
    gradient: 'from-blue-500 to-cyan-600',
    badge: null,
  },
  {
    icon: SvgInbox,
    title: 'Smart Unified Inbox',
    desc: 'Every DM, comment, and mention across Facebook, Instagram, TikTok and more — priority-sorted, AI-labeled, in one inbox.',
    gradient: 'from-orange-500 to-amber-600',
    badge: null,
  },
  {
    icon: SvgBot,
    title: 'AI Chatbot (Trained on Your Brand)',
    desc: 'Build an AI agent that knows your products, tone, and FAQs. Replies to DMs and comments 24/7 — feels human, scales infinitely.',
    gradient: 'from-indigo-500 to-violet-600',
    badge: '✨ New',
  },
  {
    icon: SvgUsers,
    title: 'Agency-Ready Team Tools',
    desc: 'Multi-channel workspaces, role-based access, post approval flows, and client reporting. Built for agencies managing 10+ brands.',
    gradient: 'from-pink-500 to-rose-600',
    badge: null,
  },
]

const steps = [
  {
    number: '01',
    icon: SvgGlobe,
    title: 'Connect All Your Channels',
    desc: 'Link Facebook, Instagram, TikTok, YouTube, LinkedIn, X and Pinterest in under 2 minutes. Every account, one workspace.',
  },
  {
    number: '02',
    icon: SvgSparkles,
    title: 'Train Your AI on Your Brand',
    desc: 'Upload your brand voice, product catalog, FAQs, and tone. The AI learns to write and reply exactly like you — but faster.',
  },
  {
    number: '03',
    icon: SvgTrendingUp,
    title: 'Publish, Reply & Grow — on Autopilot',
    desc: 'AI creates posts, schedules at optimal times, replies to comments and DMs, and surfaces insights — while you focus on the big picture.',
  },
]


// ── Animated Counter ───────────────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const step = target / 60
    let current = 0
    const timer = setInterval(() => {
      current += step
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(current))
    }, 25)
    return () => clearInterval(timer)
  }, [target])
  return <span>{count}{suffix}</span>
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const branding = useBranding()
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistEmail) return
    setWaitlistLoading(true)
    try { await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: waitlistEmail }) }) } catch { }
    setWaitlistSubmitted(true)
    setWaitlistLoading(false)
  }

  useEffect(() => {
    setMounted(true)
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-300" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        @keyframes marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes float { 0%,100% { transform:translateY(0px) } 50% { transform:translateY(-10px) } }
        @keyframes gradient { 0%,100% { background-position:0% 50% } 50% { background-position:100% 50% } }
        @keyframes pulse-ring { 0% { transform:scale(1); opacity:.4 } 100% { transform:scale(1.6); opacity:0 } }
        @keyframes spin-slow { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes beam { 0%,100% { opacity:0; transform:scaleX(0) } 50% { opacity:1; transform:scaleX(1) } }

        .animate-marquee { animation: marquee 28s linear infinite; }
        .animate-fade-up { animation: fadeUp 0.7s ease-out forwards; }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-gradient { animation: gradient 6s ease infinite; background-size: 300% 300%; }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }

        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }

        .text-gradient {
          background: linear-gradient(135deg, #14d46b 0%, #059669 40%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .bg-grid {
          background-image: radial-gradient(circle, rgba(20,212,107,0.12) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        .dark .bg-grid {
          background-image: radial-gradient(circle, rgba(20,212,107,0.07) 1px, transparent 1px);
        }

        .card-hover {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
        }

        .glass-nav {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .dark .glass-nav {
          background: rgba(3,7,18,0.85);
        }

        .feature-card {
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0,0,0,0.06);
        }
        .dark .feature-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .btn-primary {
          background: linear-gradient(135deg, #14d46b, #059669);
          transition: all 0.2s ease;
        }
        .btn-primary:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(20,212,107,0.4);
        }

        .step-connector {
          background: linear-gradient(90deg, #14d46b, #059669);
        }

        .orb {
          filter: blur(80px);
          opacity: 0.35;
        }
        .dark .orb {
          opacity: 0.2;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 40 ? 'glass-nav border-b border-gray-200/60 dark:border-white/5 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={branding.logoUrl} alt={branding.appName} width={32} height={32} className="rounded-lg object-contain" unoptimized />
            <span className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">{branding.appName}</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-7">
            {[['Features', '#features'], ['How It Works', '#how-it-works'], ['Waitlist', '#waitlist'], ['Privacy', '/privacy']].map(([label, href]) => (
              <a key={label} href={href} className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <SvgSun className="w-4 h-4" /> : <SvgMoon className="w-4 h-4" />}
              </button>
            )}

            <a href="#waitlist" className="btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-full flex items-center gap-1.5">
              Join Waitlist <SvgArrowRight className="w-3.5 h-3.5" />
            </a>
            {/* Mobile menu button */}
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"
              onClick={() => setMobileMenuOpen(v => !v)}
            >
              {mobileMenuOpen ? <SvgX className="w-5 h-5" /> : <SvgMenu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-nav border-t border-gray-200/60 dark:border-white/5 px-6 py-4 space-y-3">
            {[['Features', '#features'], ['How It Works', '#how-it-works'], ['Waitlist', '#waitlist'], ['Privacy', '/privacy']].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2 hover:text-green-500 transition-colors">
                {label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-grid" />

        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-green-400 rounded-full orb" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-emerald-500 rounded-full orb" />
        <div className="absolute -bottom-20 left-1/2 w-72 h-72 bg-green-300 rounded-full orb" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800/60 text-green-700 dark:text-green-300 text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <SvgLock className="w-3.5 h-3.5" />
            Private Beta — Waitlist Now Open
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-100 text-5xl sm:text-6xl md:text-7xl font-800 leading-[1.08] tracking-tight mb-6 font-extrabold">
            Your Social Media,
            <br />
            <span className="text-gradient">Runs on Autopilot</span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-up delay-200 text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            NeeFlow is the AI-powered platform that writes your posts, replies to every DM and comment, schedules at peak times, and grows your audience — across 7 platforms, 24/7, without lifting a finger.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <a href="#waitlist" className="btn-primary text-white font-semibold px-8 py-4 rounded-full text-base flex items-center gap-2 shadow-xl">
              Request Early Access <SvgArrowRight className="w-4 h-4" />
            </a>
            <a href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition-colors px-6 py-4">
              See Features <SvgChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Trust badges */}
          <div className="animate-fade-up delay-400 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            {[
              { icon: SvgUsers, text: 'Limited Beta Spots' },
              { icon: SvgZap, text: 'Early Access Perks' },
              { icon: SvgShield, text: 'No Credit Card' },
              { icon: SvgGlobe, text: '7 Platforms' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon className="w-4 h-4 text-green-500" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Hero Visual — CSS-based dashboard mockup */}
          <div className="animate-fade-up delay-500 mt-16 relative">
            {/* Main mockup card */}
            <div className="relative mx-auto max-w-4xl">
              {/* Floating metric cards */}
              <div className="absolute -top-6 -left-4 md:-left-16 animate-float bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl p-4 text-left z-10 w-44">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Engagement</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">+140%</div>
                <div className="text-xs text-green-500 font-medium mt-0.5">↑ vs last month</div>
              </div>

              <div className="absolute -top-6 -right-4 md:-right-16 animate-float delay-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl p-4 text-left z-10 w-44">
                <div className="flex items-center gap-2 mb-2">
                  <SvgZap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Time Saved</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">45 hrs</div>
                <div className="text-xs text-amber-500 font-medium mt-0.5">per month</div>
              </div>

              {/* Dashboard UI mockup */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-4 h-6 bg-gray-100 dark:bg-white/5 rounded-full" />
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-indigo-500" />
                </div>

                {/* Dashboard content */}
                <div className="grid grid-cols-12 h-72 md:h-96">
                  {/* Sidebar */}
                  <div className="col-span-2 border-r border-gray-100 dark:border-white/5 p-3 space-y-2">
                    {[SvgBarChart3, SvgCalendar, SvgInbox, SvgUsers, SvgFileText].map((Icon, i) => (
                      <div key={i} className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto cursor-pointer ${i === 0 ? 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-lg' : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    ))}
                  </div>

                  {/* Main area */}
                  <div className="col-span-10 p-4 md:p-6">
                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {[
                        { label: 'Followers', value: '48.2K', trend: '+12%', color: 'text-teal-600 dark:text-teal-400' },
                        { label: 'Reach', value: '312K', trend: '+8%', color: 'text-blue-600 dark:text-blue-400' },
                        { label: 'Posts', value: '142', trend: '+24', color: 'text-violet-600 dark:text-violet-400' },
                        { label: 'Eng. Rate', value: '4.8%', trend: '+0.6%', color: 'text-orange-600 dark:text-orange-400' },
                      ].map((s) => (
                        <div key={s.label} className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                          <div className="text-[10px] text-gray-500 dark:text-gray-500 mb-1">{s.label}</div>
                          <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                          <div className="text-[9px] text-green-500 font-medium">{s.trend}</div>
                        </div>
                      ))}
                    </div>

                    {/* Chart bars */}
                    <div className="flex items-end gap-1.5 h-24 md:h-36 mb-3">
                      {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88, 50, 72].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-md transition-all duration-500"
                          style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, #14b8a6, #6366f1)`,
                            opacity: i === 10 ? 1 : 0.4 + (i * 0.04),
                          }}
                        />
                      ))}
                    </div>

                    {/* Platform icons row */}
                    <div className="flex items-center gap-2">
                      {platforms.map((p) => (
                        <div key={p.name} className="w-6 h-6 opacity-60" style={{ color: p.color }}>
                          <p.component />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom floating card */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 animate-float delay-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl px-5 py-3 flex items-center gap-3 z-10 whitespace-nowrap">
                <div className="w-8 h-8 rounded-full btn-primary flex items-center justify-center">
                  <SvgBot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">AI just generated 12 posts</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">Scheduled for next week · 2s ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM MARQUEE ────────────────────────────────────────────────── */}
      <section className="py-12 border-y border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] overflow-hidden">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-6">Publish to all your platforms in one click</p>
        <div className="flex overflow-hidden">
          <div className="animate-marquee flex gap-12 items-center pr-12 shrink-0">
            {[...platforms, ...platforms, ...platforms].map((p, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-default shrink-0">
                <div className="w-6 h-6 shrink-0" style={{ color: p.color }}>
                  <p.component />
                </div>
                <span className="text-sm font-semibold">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 7, suffix: '', label: 'Platforms in One Workspace', sub: 'Facebook, IG, TikTok + more' },
            { value: 10, suffix: 'x', label: 'More Content Output', sub: 'Compared to manual posting' },
            { value: 3, suffix: 'min', label: 'Setup to First Post', sub: 'Connect and go live instantly' },
            { value: 24, suffix: '/7', label: 'AI Works For You', sub: 'Never sleeps, never stops' },
          ].map((stat, i) => (
            <div key={i} className="group">
              <div className="text-4xl sm:text-5xl font-extrabold text-gradient mb-2">
                <AnimatedNumber target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm mb-0.5">{stat.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-500">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-gray-50/50 dark:bg-gray-900/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-300 text-xs font-semibold px-4 py-2 rounded-full mb-5">
              <SvgLayers className="w-3.5 h-3.5" /> What We&apos;re Building
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
              Every tool your brand needs.<br />
              <span className="text-gradient">Powered by AI. All in one place.</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-lg">
              Stop juggling 6 different tools. NeeFlow handles content creation, scheduling, replies, analytics, and team management — so you just focus on strategy.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="feature-card card-hover rounded-2xl p-6 group cursor-default relative overflow-hidden">
                {f.badge && (
                  <div className="absolute top-4 right-4 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {f.badge}
                  </div>
                )}
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MID CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-16 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative rounded-3xl overflow-hidden p-10 sm:p-14 text-center" style={{ background: 'linear-gradient(135deg, #14d46b 0%, #059669 50%, #047857 100%)' }}>
            <div className="absolute inset-0 bg-grid opacity-20" />
            <div className="relative">
              <div className="text-sm font-semibold text-green-100 mb-3">🤖 Your entire social media team — in one AI</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Stop paying 5 freelancers to do what one AI can handle.
              </h2>
              <p className="text-green-100 mb-8 max-w-lg mx-auto">
                Content writer. Scheduler. Community manager. Analyst. Chatbot. NeeFlow replaces them all — and works 24/7.
              </p>
              <a href="#waitlist" className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-8 py-4 rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200">
                I Want Early Access <SvgArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800/50 text-violet-700 dark:text-violet-300 text-xs font-semibold px-4 py-2 rounded-full mb-5">
              <SvgClock className="w-3.5 h-3.5" /> Up & Running in Minutes
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
              So simple, you&apos;ll wonder why<br />you ever did it manually
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto text-lg">
              Connect → Train → Automate. Your social media on rails in 3 steps.
            </p>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-1/2 -translate-x-1/2 w-2/3 h-0.5 step-connector rounded-full" />

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <div key={i} className="relative text-center group">
                  {/* Number circle */}
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl btn-primary flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-200 relative z-10">
                      <step.icon className="w-7 h-7" />
                    </div>
                    <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-700 -translate-y-1 translate-x-1 flex items-center justify-center z-20">
                      <span className="text-[9px] font-extrabold text-gray-500 dark:text-gray-400">{step.number}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{step.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ── WAITLIST ─────────────────────────────────────────────────────────── */}
      <section id="waitlist" className="py-24 bg-white dark:bg-gray-950">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-300 text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <SvgSparkles className="w-3.5 h-3.5" /> Secure your spot — limited availability
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
            Get <span className="text-gradient">Early Access</span> — Before Everyone Else
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-10 max-w-lg mx-auto">
            We&apos;re opening access to a limited number of early members. Join today to lock in founding-member pricing and get hands-on onboarding from our team.
          </p>

          {waitlistSubmitted ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/60 flex items-center justify-center mb-2">
                <SvgCheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">You&apos;re on the list!</p>
              <p className="text-gray-500 dark:text-gray-400">We&apos;ll email you as soon as early access opens. Stay tuned! 🎉</p>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={waitlistEmail}
                onChange={e => setWaitlistEmail(e.target.value)}
                className="flex-1 h-12 px-4 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
              <button
                type="submit"
                disabled={waitlistLoading}
                className="btn-primary text-white font-semibold px-7 h-12 rounded-full text-sm whitespace-nowrap disabled:opacity-70 flex items-center gap-2"
              >
                {waitlistLoading ? 'Joining...' : <>Join Waitlist <SvgArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-gray-500 dark:text-gray-500">
            {[{ icon: SvgShield, t: 'No spam, ever' }, { icon: SvgLock, t: 'Unsubscribe anytime' }, { icon: SvgZap, t: 'Early bird pricing' }].map(({ icon: Icon, t }) => (
              <div key={t} className="flex items-center gap-1.5"><Icon className="w-4 h-4 text-green-500" />{t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className="py-28 bg-gray-950 dark:bg-black relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-900 rounded-full orb" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-900 rounded-full orb" />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 border border-green-800 text-green-400 text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <SvgSparkles className="w-3.5 h-3.5" /> Private Beta — Opening Soon
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            Your social media.<br />
            <span className="text-gradient">On autopilot.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            We&apos;re putting the final touches on the platform. Join the waitlist now — early members get founding pricing, direct access to our team, and first dibs on every new feature.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#waitlist" className="btn-primary text-white font-bold px-10 py-4 rounded-full text-base flex items-center gap-2 shadow-2xl">
              Join the Waitlist <SvgArrowRight className="w-4 h-4" />
            </a>
            <Link href="/login" className="text-gray-400 hover:text-white font-medium text-sm flex items-center gap-1 transition-colors">
              Already have an account <SvgChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {['Free to join waitlist', 'Early bird pricing', 'Priority onboarding', 'Cancel anytime'].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-xs text-gray-500">
                <SvgCheckCircle className="w-3.5 h-3.5 text-green-500" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 dark:bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-5 gap-10 mb-14">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <Image src={branding.logoUrl} alt={branding.appName} width={32} height={32} className="rounded-lg object-contain" unoptimized />
                <span className="text-lg font-extrabold text-white">{branding.appName}</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs mb-5">
                AI-powered social media management for modern agencies and brands. Post smarter, grow faster.
              </p>
              <div className="flex gap-3">
                {platforms.slice(0, 5).map((p) => (
                  <div key={p.name} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                    <p.component />
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              {
                title: 'Product',
                links: [['Features', '#features'], ['Waitlist', '#waitlist'], ['How It Works', '#how-it-works'], ['Changelog', '#']],
              },
              {
                title: 'Company',
                links: [['About', '/about'], ['Blog', '#'], ['Careers', '#'], ['Contact', 'mailto:hello@neeflow.com']],
              },
              {
                title: 'Legal',
                links: [['Privacy Policy', '/privacy'], ['Terms of Service', '/terms'], ['Cookie Policy', '/cookies'], ['GDPR', '/gdpr']],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-4">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <span>© {new Date().getFullYear()} NeeFlow. All rights reserved. Built with ♥ in Richmond, VA.</span>
            <div className="flex gap-5">
              <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-gray-400 transition-colors">Terms</a>
              <a href="/cookies" className="hover:text-gray-400 transition-colors">Cookies</a>
              <a href="/gdpr" className="hover:text-gray-400 transition-colors">GDPR</a>
              <a href="/about" className="hover:text-gray-400 transition-colors">About</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
