import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getBrandingServer } from '@/lib/use-branding-server'

export const metadata: Metadata = {
    title: 'Privacy Policy — NeeFlow',
    description: 'NeeFlow Privacy Policy: How we collect, use, and protect your personal data on our AI-powered social media management platform.',
}

const sections = [
    {
        id: 'introduction',
        title: '1. Introduction & Scope',
        content: `
        <p>NeeFlow ("we," "us," or "our") operates an AI-powered social media management platform at <strong>neeflow.com</strong> (the "Service"). This Privacy Policy explains how we collect, use, disclose, retain, and safeguard your personal information when you use our Service.</p>
        <p>This policy applies to all users of the NeeFlow platform, including administrators, team members, and end-users who access the Service through any device or interface. By using NeeFlow, you agree to the collection and use of information in accordance with this policy.</p>
        <p>NeeFlow is operated by the company behind the platform. Our registered business address is <strong>Richmond, VA, United States</strong>. For privacy inquiries, contact us at <a href="mailto:privacy@neeflow.com">privacy@neeflow.com</a>.</p>
        `
    },
    {
        id: 'data-collected',
        title: '2. Information We Collect',
        content: `
        <h4>2.1 Account & Identity Data</h4>
        <ul>
            <li><strong>Registration Information:</strong> Name, email address, and password (stored as bcrypt hash — we never store plain-text passwords).</li>
            <li><strong>Profile Information:</strong> Avatar, display name, language and theme preferences.</li>
            <li><strong>Billing Information:</strong> Subscription plan tier; payment card details are processed and stored exclusively by Stripe and are never stored on NeeFlow servers.</li>
        </ul>
        <h4>2.2 Connected Platform Credentials</h4>
        <p>When you connect social media accounts (Facebook, Instagram, TikTok, YouTube, LinkedIn, X/Twitter, Pinterest), we receive and store OAuth access tokens issued by those platforms. These tokens are encrypted at rest using <strong>AES-256 encryption</strong>. We use these tokens solely to publish content, retrieve analytics, and manage messages on your behalf — never for any other purpose.</p>
        <h4>2.3 Content Data</h4>
        <ul>
            <li>Posts, captions, images, and videos you create or upload through NeeFlow.</li>
            <li>AI-generated content created using our AI tools (OpenAI, Gemini, Runware, etc.) at your request.</li>
            <li>Scheduling configurations, calendar entries, and content queues.</li>
        </ul>
        <h4>2.4 Usage & Technical Data</h4>
        <ul>
            <li>Log data: IP address, browser type, operating system, pages visited, actions taken, timestamps.</li>
            <li>Device information: screen resolution, device type.</li>
            <li>Feature usage patterns (which tools you use, how often) — used to improve the Service.</li>
        </ul>
        <h4>2.5 Inbox & Communication Data</h4>
        <p>Comments, messages, and replies received from social media platforms via our Inbox feature. These are processed to display your conversations and, optionally, to generate AI-suggested responses.</p>
        <h4>2.6 Information We Do NOT Collect</h4>
        <ul>
            <li>We do <strong>not</strong> collect your social media followers' personal data beyond what is provided to us by platform APIs for analytics purposes (aggregate, anonymized).</li>
            <li>We do <strong>not</strong> use advertising cookies or sell data to ad networks.</li>
        </ul>
        `
    },
    {
        id: 'how-we-use',
        title: '3. How We Use Your Information',
        content: `
        <p>We use the collected information for the following purposes:</p>
        <ul>
            <li><strong>Service Delivery:</strong> Publishing posts to connected social media accounts, displaying analytics dashboards, managing your content calendar and inbox.</li>
            <li><strong>AI Features:</strong> Processing your content requests through AI providers (OpenAI, Google Gemini, Runware) to generate captions, images, and content suggestions. Your prompts are transmitted to these providers under their respective privacy policies.</li>
            <li><strong>Account Management:</strong> Creating and maintaining your account, authenticating your identity, managing team role permissions.</li>
            <li><strong>Communication:</strong> Sending transactional emails (account confirmation, password reset, billing notifications, post approval requests) via our SMTP infrastructure.</li>
            <li><strong>Security & Fraud Prevention:</strong> Monitoring for unauthorized access, detecting abuse, and enforcing our Terms of Service.</li>
            <li><strong>Service Improvement:</strong> Analyzing aggregated usage patterns to improve features, fix bugs, and prioritize development.</li>
            <li><strong>Legal Compliance:</strong> Fulfilling obligations under applicable laws and regulations.</li>
        </ul>
        <p><strong>We do not use your content to train AI models</strong> without your explicit consent. Content you create is yours.</p>
        `
    },
    {
        id: 'google-limited-use',
        title: '4. Google API Services — Limited Use Disclosure',
        content: `
        <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 10px; padding: 14px 18px; margin-bottom: 1.2rem;">
            <p style="color: #713f12; font-weight: 600; margin: 0 0 6px;">⚠️ Required Google API Disclosure</p>
            <p style="color: #713f12; margin: 0; font-size: 0.9rem;">NeeFlow's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener" style="color: #92400e;">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
        </div>
        <h4>What Google User Data We Access</h4>
        <p>When you connect a Google account (YouTube, Google Drive), NeeFlow accesses only the specific data scopes you authorize:</p>
        <ul>
            <li><strong>YouTube Data API:</strong> Channel information, video upload capabilities, analytics for your own channel — used solely to publish and manage your YouTube content within NeeFlow.</li>
            <li><strong>Google Drive API:</strong> Access to files and folders you explicitly select — used solely to import media into NeeFlow's content editor at your request.</li>
        </ul>
        <h4>Limited Use Rules — How We Use Google User Data</h4>
        <ul>
            <li><strong>Permitted purpose only:</strong> Google user data is used exclusively to provide the specific NeeFlow features you requested (publishing to YouTube, importing Drive files). It is not used for any secondary purpose.</li>
            <li><strong>No AI training:</strong> Google user data is <strong>never</strong> used to train AI models — ours or any third-party's.</li>
            <li><strong>No transfer to AI providers:</strong> Google user data is <strong>never</strong> sent to OpenRouter, OpenAI, Runware, Synthetic.new, or any other AI service. These providers only receive text and content you <em>directly type or upload</em> in NeeFlow's editor — completely separate from any Google API data flow.</li>
            <li><strong>No unauthorized sharing:</strong> Google user data is never sold, rented, or shared beyond what is strictly necessary to operate NeeFlow's core features.</li>
            <li><strong>No human access:</strong> NeeFlow staff do not read your Google user data unless you explicitly request support and share specific information, or as required by law.</li>
        </ul>
        <h4>Data Segregation Architecture</h4>
        <p>NeeFlow maintains strict architectural separation between Google API data flows and AI generation pipelines:</p>
        <ul>
            <li>Files accessed via Google Drive API flow only to NeeFlow's own storage and editor display — they are never routed through AI generation endpoints.</li>
            <li>YouTube data flows only to NeeFlow's publishing and analytics systems.</li>
            <li>AI content generation (captions, images via OpenRouter etc.) is triggered <em>only</em> by text and media you manually provide in NeeFlow's AI tools — this pipeline is technically isolated from any Google API data path.</li>
        </ul>
        <p>To revoke NeeFlow's access to your Google data at any time, visit your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Google Account permissions page</a> or disconnect the integration from your NeeFlow dashboard.</p>
        `
    },
    {
        id: 'data-sharing',
        title: '5. Data Sharing & Third Parties',
        content: `
        <p><strong>We do not sell, rent, or broker your personal information to any third party.</strong></p>
        <h4>5.1 Service Providers</h4>
        <p>We share data with trusted third-party providers strictly to operate the Service:</p>
        <ul>
            <li><strong>Social Media Platforms:</strong> Facebook, Instagram, TikTok, YouTube, LinkedIn, X, Pinterest — content published on your behalf.</li>
            <li><strong>AI Providers (user-supplied content only):</strong> OpenAI, Google Gemini, Runware, OpenRouter, Synthetic.new — for AI content generation features you enable. <strong>Google API data is never sent to these providers.</strong> They only receive text and media you directly create in NeeFlow.</li>
            <li><strong>Stripe:</strong> Payment processing and subscription management.</li>
            <li><strong>Google Drive:</strong> Media storage integration (only if you connect Google Drive). Data from Google Drive API is used exclusively within NeeFlow and never forwarded to AI providers.</li>
            <li><strong>Robolly:</strong> Template-based image generation (only if you enable this integration).</li>
            <li><strong>SMTP Provider:</strong> Sending transactional emails.</li>
        </ul>
        <h4>5.2 Legal Requirements</h4>
        <p>We may disclose your information where required by law, court order, or governmental authority, or to protect the rights, property, or safety of NeeFlow, our users, or the public.</p>
        <h4>5.3 Business Transfers</h4>
        <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. You will be notified via email before your data is subject to a different privacy policy.</p>
        `
    },

    {
        id: 'data-security',
        title: '6. Data Security',
        content: `
        <p>We implement industry-standard security measures to protect your data:</p>
        <ul>
            <li><strong>Encryption at Rest:</strong> OAuth tokens and sensitive credentials are encrypted using AES-256.</li>
            <li><strong>Encryption in Transit:</strong> All data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher.</li>
            <li><strong>Password Security:</strong> User passwords are hashed using bcrypt with a work factor of 12 — passwords are never stored in plain text.</li>
            <li><strong>Access Control:</strong> Role-based access control (RBAC) ensures team members can only access resources within their assigned permissions. Admin actions are logged.</li>
            <li><strong>Security Headers:</strong> Our web application enforces HSTS, X-Frame-Options, X-Content-Type-Options, and Content-Security-Policy headers.</li>
            <li><strong>Infrastructure:</strong> Hosted on reputable cloud infrastructure with firewall protection and regular security updates.</li>
        </ul>
        <p>While we implement robust safeguards, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security but commit to promptly notifying users of any confirmed data breach affecting their personal information.</p>
        `
    },
    {
        id: 'data-retention',
        title: '7. Data Retention',
        content: `
        <ul>
            <li><strong>Account Data:</strong> Retained as long as your account is active. Upon account deletion, personal data is purged within 30 days, except where retention is required by law.</li>
            <li><strong>Content & Posts:</strong> Retained until you delete them or your account is closed.</li>
            <li><strong>OAuth Tokens:</strong> Deleted immediately when you disconnect a social media account from NeeFlow.</li>
            <li><strong>Billing Records:</strong> Retained for 7 years as required by financial regulations.</li>
            <li><strong>Server Logs:</strong> Retained for up to 90 days for security and debugging purposes.</li>
        </ul>
        `
    },
    {
        id: 'your-rights',
        title: '8. Your Rights',
        content: `
        <p>Depending on your location, you may have the following rights regarding your personal data:</p>
        <ul>
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Erasure ("Right to be Forgotten"):</strong> Request deletion of your personal data, subject to legal retention requirements.</li>
            <li><strong>Data Portability:</strong> Receive your data in a structured, machine-readable format.</li>
            <li><strong>Objection:</strong> Object to processing of your data for specific purposes.</li>
            <li><strong>Withdrawal of Consent:</strong> Withdraw consent at any time where processing is consent-based.</li>
            <li><strong>Disconnect Integrations:</strong> Disconnect any social media platform from within the NeeFlow dashboard to revoke our access to those platform APIs.</li>
        </ul>
        <p>To exercise any of these rights, contact us at <a href="mailto:privacy@neeflow.com">privacy@neeflow.com</a>. We will respond within 30 days.</p>
        `
    },
    {
        id: 'cookies',
        title: '9. Cookies & Tracking',
        content: `
        <p>NeeFlow uses only <strong>essential cookies</strong> required for the Service to function:</p>
        <ul>
            <li><strong>Session Cookies:</strong> Authentication session tokens (httpOnly, Secure, SameSite=Strict) to keep you logged in.</li>
            <li><strong>CSRF Tokens:</strong> Cross-site request forgery protection tokens.</li>
        </ul>
        <p><strong>We do not use:</strong> advertising cookies, cross-site tracking cookies, Google Analytics, Facebook Pixel, or any third-party behavioral tracking scripts on authenticated pages.</p>
        `
    },
    {
        id: 'international',
        title: '10. International Data Transfers',
        content: `
        <p>NeeFlow is operated from the United States. If you access the Service from outside the United States, your data may be transferred to, stored, and processed in the United States or other countries where our service providers operate. By using the Service, you consent to this transfer.</p>
        <p>For users in the European Economic Area (EEA) or United Kingdom, we ensure appropriate safeguards are in place for international transfers, including Standard Contractual Clauses (SCCs) where applicable.</p>
        `
    },
    {
        id: 'children',
        title: '11. Children\'s Privacy',
        content: `
        <p>NeeFlow is not directed to individuals under the age of 16. We do not knowingly collect personal information from children under 16. If you believe we have inadvertently collected information from a minor, please contact us immediately at <a href="mailto:privacy@neeflow.com">privacy@neeflow.com</a> and we will delete it promptly.</p>
        `
    },
    {
        id: 'changes',
        title: '12. Changes to This Policy',
        content: `
        <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify you by:</p>
        <ul>
            <li>Sending an email to your registered address, and/or</li>
            <li>Displaying a prominent notice within the NeeFlow dashboard.</li>
        </ul>
        <p>The "Last Updated" date at the top of this page reflects the most recent revision. Continued use of the Service after changes are posted constitutes your acceptance of the updated policy.</p>
        `
    },
    {
        id: 'contact',
        title: '13. Contact Us',
        content: `
        <p>For any privacy-related questions, requests, or concerns, please contact us:</p>
        <ul>
            <li><strong>Email:</strong> <a href="mailto:privacy@neeflow.com">privacy@neeflow.com</a></li>
            <li><strong>Support:</strong> <a href="mailto:support@neeflow.com">support@neeflow.com</a></li>
            <li><strong>Address:</strong> Richmond, VA, United States</li>
        </ul>
        `
    },
]

export default async function PrivacyPolicyPage() {
    const lastUpdated = 'March 14, 2026'
    const branding = await getBrandingServer()

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                .prose-content h4 { font-size: 0.95rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
                .prose-content p { line-height: 1.75; margin-bottom: 0.9rem; }
                .prose-content ul { padding-left: 1.25rem; margin-bottom: 0.9rem; }
                .prose-content li { margin-bottom: 0.4rem; line-height: 1.7; }
                .prose-content a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
                .toc-link { transition: all 0.2s; border-left: 2px solid transparent; }
                .toc-link:hover { border-left-color: #4f46e5; color: #4f46e5; padding-left: 0.5rem; }

                /* Light mode prose */
                .prose-content h4 { color: #1e293b; }
                .prose-content p { color: #475569; }
                .prose-content ul { color: #475569; }
                .prose-content strong { color: #1e293b; }

                /* Dark mode prose */
                .dark .prose-content h4 { color: #e2e8f0; }
                .dark .prose-content p { color: #94a3b8; }
                .dark .prose-content ul { color: #94a3b8; }
                .dark .prose-content strong { color: #e2e8f0; }
                .dark .prose-content a { color: #818cf8; }
                .dark .toc-link:hover { border-left-color: #818cf8; color: #818cf8; }
            `}</style>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm border-b border-gray-100 dark:border-white/5 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src={branding.logoUrl} alt={branding.appName} width={32} height={32} className="rounded-lg object-contain" unoptimized />
                        <span className="font-bold text-gray-900 dark:text-white text-lg">{branding.appName}</span>
                    </Link>
                    <nav className="flex items-center gap-6 text-sm">
                        <Link href="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Terms of Service</Link>
                        <Link href="/login" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">Sign In</Link>
                    </nav>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid lg:grid-cols-[280px_1fr] gap-12">

                    {/* Sidebar TOC */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-24">
                            <div className="bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 p-6">
                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Table of Contents</p>
                                <nav className="space-y-1">
                                    {sections.map((s) => (
                                        <a key={s.id} href={`#${s.id}`} className="toc-link block text-sm text-gray-500 dark:text-gray-400 py-1.5 px-2 rounded-lg hover:bg-white dark:hover:bg-white/5">
                                            {s.title}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                            <div className="mt-6 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 p-5">
                                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-1">Privacy Questions?</p>
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-3">We&apos;re here to help with any data concerns.</p>
                                <a href="mailto:privacy@neeflow.com" className="text-xs font-medium text-indigo-700 dark:text-indigo-400 underline">privacy@neeflow.com</a>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main>
                        {/* Hero */}
                        <div className="mb-10 pb-8 border-b border-gray-100 dark:border-white/10">
                            <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800/60 mb-4">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Your Privacy Matters
                            </div>
                            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Privacy Policy</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed max-w-2xl">
                                We believe in transparency. This policy explains exactly what data we collect, why we collect it, and how we protect it across the NeeFlow platform.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-400 dark:text-gray-500">
                                <span><strong className="text-gray-600 dark:text-gray-300">Last Updated:</strong> {lastUpdated}</span>
                                <span><strong className="text-gray-600 dark:text-gray-300">Effective Date:</strong> {lastUpdated}</span>
                                <span><strong className="text-gray-600 dark:text-gray-300">Version:</strong> 1.0</span>
                            </div>
                        </div>

                        {/* Key Commitments */}
                        <div className="grid sm:grid-cols-3 gap-4 mb-10">
                            {[
                                { icon: '🔒', title: 'We never sell your data', desc: 'Your personal information is never sold or rented to third parties.' },
                                { icon: '🛡️', title: 'AES-256 Encryption', desc: 'All sensitive credentials are encrypted at rest and in transit.' },
                                { icon: '✅', title: 'You stay in control', desc: 'Access, export, or delete your data anytime from your account settings.' },
                            ].map((c, i) => (
                                <div key={i} className="bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 p-5">
                                    <div className="text-2xl mb-2">{c.icon}</div>
                                    <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">{c.title}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{c.desc}</div>
                                </div>
                            ))}
                        </div>

                        {/* Policy Sections */}
                        <div className="space-y-10">
                            {sections.map((section) => (
                                <section key={section.id} id={section.id} className="scroll-mt-24">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-100 dark:border-white/10">
                                        {section.title}
                                    </h2>
                                    <div
                                        className="prose-content"
                                        dangerouslySetInnerHTML={{ __html: section.content }}
                                    />
                                </section>
                            ))}
                        </div>

                        {/* Footer nav */}
                        <div className="mt-14 pt-8 border-t border-gray-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-sm text-gray-400 dark:text-gray-500">© {new Date().getFullYear()} NeeFlow. All rights reserved.</p>
                            <div className="flex gap-6 text-sm">
                                <Link href="/terms" className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms of Service</Link>
                                <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 font-medium">Privacy Policy</Link>
                                <Link href="/" className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Home</Link>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
