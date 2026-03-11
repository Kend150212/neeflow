/**
 * Seed script: 15 Knowledge Base articles for NeeFlow (English)
 * Run: npx tsx prisma/seed-kb-articles.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function h(tag: string, attrs: string, inner: string) { return `<${tag} ${attrs}>${inner}</${tag}>` }
function section(inner: string) { return h('div', 'style="margin-bottom:24px"', inner) }
function h2(text: string) { return h('h2', 'style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px"', text) }
function h3(text: string) { return h('h3', 'style="font-size:17px;font-weight:600;color:#111;margin:20px 0 8px"', text) }
function p(text: string) { return h('p', 'style="color:#374151;line-height:1.7;margin:0 0 12px;font-size:15px"', text) }
function tip(text: string) { return h('div', 'style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:6px;margin:16px 0"', h('p', 'style="margin:0;color:#1d4ed8;font-size:14px;line-height:1.5"', `💡 <strong>Tip:</strong> ${text}`)) }
function warn(text: string) { return h('div', 'style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:16px 0"', h('p', 'style="margin:0;color:#92400e;font-size:14px;line-height:1.5"', `⚠️ <strong>Note:</strong> ${text}`)) }
function ol(items: string[]) { return h('ol', 'style="padding-left:20px;margin:12px 0"', items.map(t => h('li', 'style="margin-bottom:8px;color:#374151;font-size:14px;line-height:1.6"', t)).join('')) }
function ul(items: string[]) { return h('ul', 'style="padding-left:20px;margin:12px 0"', items.map(t => h('li', 'style="margin-bottom:6px;color:#374151;font-size:14px;line-height:1.6"', t)).join('')) }
function code(text: string) { return h('code', 'style="background:#f3f4f6;border:1px solid #e5e7eb;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px"', text) }
function badge(text: string, color: string) { return h('span', `style="background:${color}22;color:${color};border:1px solid ${color}44;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;margin-right:4px"`, text) }
function tbl(headers: string[], rows: string[][]) {
    const th = headers.map(t => h('th', 'style="text-align:left;padding:8px;border:1px solid #e5e7eb;background:#f3f4f6"', t)).join('')
    const trs = rows.map(row => h('tr', '', row.map(c => h('td', 'style="padding:8px;border:1px solid #e5e7eb"', c)).join(''))).join('')
    return h('table', 'style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0"', h('thead', '', h('tr', '', th)) + h('tbody', '', trs))
}

// ─── Articles ─────────────────────────────────────────────────────────────────
const articles = [

    // ── GETTING STARTED ──
    {
        title: 'Creating Your First Channel',
        slug: 'creating-your-first-channel',
        category: 'getting_started',
        tags: ['channel', 'setup', 'getting started'],
        excerpt: 'A step-by-step guide to creating a channel and connecting your social media accounts to NeeFlow.',
        content: [
            h2('Creating Your First Channel'),
            p('A Channel is the central unit in NeeFlow — each channel represents a brand or business and contains all its connected social media accounts.'),
            section(h3('Step 1: Go to Channels') + ol(['Log in to NeeFlow at <strong>neeflow.com/dashboard</strong>', 'Click <strong>Channels</strong> in the left sidebar', 'Click the <strong>+ New Channel</strong> button in the top-right'])),
            section(h3('Step 2: Fill in Channel details') + ul(['<strong>Name:</strong> Your brand or project name (e.g. "Flower Shop ABC")', '<strong>Avatar:</strong> Brand logo or profile picture (optional)', '<strong>Description:</strong> A short description of your channel', '<strong>Language:</strong> Primary language you will post in'])),
            section(h3('Step 3: Connect social platforms') + p('After creating the channel, you will see the platform connection screen. Click the logo of each network you want to connect:') + ul([badge('Facebook', '#1877f2') + ' Facebook Pages, Groups', badge('Instagram', '#e1306c') + ' Business or Creator accounts', badge('TikTok', '#000') + ' TikTok accounts', badge('YouTube', '#ff0000') + ' YouTube channels', badge('LinkedIn', '#0a66c2') + ' Company pages'])),
            tip('You can connect multiple platforms to a single channel. Keep all accounts belonging to one brand in the same channel for easier management.'),
            section(h3('Step 4: Start posting') + p('Once connected, your Channel is ready! Go to the <strong>Compose</strong> tab to create your first post.')),
            warn('If you manage multiple brands, create a separate channel for each brand instead of mixing them together.'),
        ].join('\n'),
    },

    {
        title: 'Connecting Facebook & Instagram',
        slug: 'connecting-facebook-instagram',
        category: 'getting_started',
        tags: ['facebook', 'instagram', 'connect', 'oauth'],
        excerpt: 'How to connect your Facebook Page and Instagram account to NeeFlow, including permissions and common errors.',
        content: [
            h2('Connecting Facebook & Instagram'),
            p('NeeFlow uses the Meta Graph API to publish to Facebook and Instagram. You need admin access to a Facebook Page and a linked Instagram Business/Creator account.'),
            section(h3('Requirements') + ul(['A <strong>personal Facebook account</strong> (used to log in)', 'A <strong>Facebook Page</strong> (not a personal profile)', 'Instagram must be a <strong>Business or Creator</strong> account <strong>linked to your Facebook Page</strong>', 'You must be an <strong>Admin</strong> of that Facebook Page'])),
            section(h3('Connect Facebook') + ol(['Go to <strong>Channel Settings → Platforms</strong>', 'Click <strong>Connect Facebook</strong>', 'Log in with your Facebook account', 'Select <strong>all Pages</strong> you want to manage', 'Grant <strong>all requested permissions</strong>', 'Choose the specific Facebook Page from the list NeeFlow shows you'])),
            tip('Make sure to grant ALL requested permissions. Deselecting any permission may prevent posting from working correctly.'),
            section(h3('Connect Instagram') + p('Instagram is connected <strong>via</strong> the linked Facebook Page:') + ol(['After connecting Facebook, click <strong>Connect Instagram</strong>', 'NeeFlow will automatically find the Instagram account linked to your Page', 'Select your Instagram account from the list'])),
            warn('Personal Instagram accounts cannot be connected. You must switch to a Business or Creator account in your Instagram App settings.'),
            section(h3('Common errors') + ul([
                '<strong>"Token expired"</strong> — Reconnect the account in Channel Settings',
                '<strong>"Page not found"</strong> — Make sure you selected the correct Page during Facebook auth',
                '<strong>"Instagram not linked"</strong> — Go to Instagram → Settings → Account → Switch to Professional Account',
                code('Error 190') + ' — Token expired, reconnect required',
            ])),
        ].join('\n'),
    },

    {
        title: 'NeeFlow Dashboard Overview',
        slug: 'dashboard-overview',
        category: 'getting_started',
        tags: ['dashboard', 'interface', 'overview'],
        excerpt: 'Explore all the main areas of the NeeFlow Dashboard and how to use them effectively.',
        content: [
            h2('NeeFlow Dashboard Overview'),
            p('The NeeFlow Dashboard is designed so you can manage all your social media content from one place. Here are the key areas.'),
            section(h3('🗂️ Sidebar Navigation') + ul([
                '<strong>Dashboard:</strong> Performance overview, stats, recent posts',
                '<strong>Compose:</strong> Create and schedule new posts',
                '<strong>Posts:</strong> Manage all posts (published, scheduled, drafts)',
                '<strong>Calendar:</strong> Visual calendar view of your scheduled content',
                '<strong>Media:</strong> Your image and video library',
                '<strong>Inbox:</strong> Messages and comments from all platforms',
                '<strong>Analytics:</strong> Post performance metrics',
                '<strong>Settings:</strong> Channel and account settings',
            ])),
            section(h3('🔄 Switching Channels') + p('At the top of the sidebar, you can switch between channels. All data (posts, calendar, media) is separated per channel.')),
            section(h3('📊 Main Dashboard Screen') + ul([
                '<strong>Stats bar:</strong> Total posts, posting rate, connected accounts',
                '<strong>Recent posts:</strong> Latest posts and their status',
                '<strong>Upcoming:</strong> Posts scheduled to go live in the next 24 hours',
                '<strong>Quick compose:</strong> Draft a post directly from the Dashboard',
            ])),
            tip('Use the keyboard shortcut <strong>Ctrl + N</strong> (or <strong>⌘ + N</strong> on Mac) to open the Compose Editor instantly from any page.'),
        ].join('\n'),
    },

    // ── AI & AUTOMATION ──
    {
        title: 'Using the AI Compose Editor',
        slug: 'using-ai-compose-editor',
        category: 'ai',
        tags: ['AI', 'compose', 'content creation', 'caption'],
        excerpt: 'A complete guide to using AI to create and schedule content across multiple platforms at once.',
        content: [
            h2('Using the AI Compose Editor'),
            p('The AI Compose Editor is the heart of NeeFlow — it lets you create professional content for Facebook, Instagram, TikTok, LinkedIn and more simultaneously, with AI optimized for each platform.'),
            section(h3('3-column layout') + ul([
                '<strong>Left — Settings:</strong> Select channel, platforms, tone, language',
                '<strong>Center — Editor:</strong> Enter your prompt or edit AI-generated content',
                '<strong>Right — Preview:</strong> See how the post will look on each platform',
            ])),
            section(h3('Generating content with AI') + ol([
                'Select your <strong>Channel</strong> and the target <strong>Platforms</strong> (Facebook, Instagram, etc.)',
                'Enter your <strong>topic</strong> or <strong>idea</strong> in the Prompt field',
                'Choose a <strong>Tone</strong> (Professional, Casual, Emotional, etc.)',
                'Click <strong>✨ Generate</strong>',
                'AI creates platform-specific content for <em>each platform you selected</em>',
                'Edit if needed, then click <strong>Post Now</strong> or <strong>Schedule</strong>',
            ])),
            tip('Select multiple platforms at once — AI creates different versions for each (Instagram gets more hashtags, LinkedIn gets formal language, etc.)'),
            section(h3('Content types AI supports') + ul([
                '📝 <strong>Captions / Post text</strong> — Main copy',
                '🖼️ <strong>Image generation</strong> — Create images from a prompt',
                '🎨 <strong>Robolly templates</strong> — Apply branded design templates',
                '🏷️ <strong>Hashtag suggestions</strong> — Relevant hashtags per platform',
                '📅 <strong>Optimal timing</strong> — AI suggests the best posting time',
            ])),
            section(h3('Tips for better AI output') + ul([
                'Describe your product/service clearly and specify the target audience',
                'Include important keywords you want in the post',
                'Specify a style (e.g. "write like a lifestyle influencer", "luxury brand tone")',
                'State the goal of the post (engagement, product promotion, event announcement…)',
            ])),
        ].join('\n'),
    },

    {
        title: 'Setting Up Your AI API Key (OpenAI / Gemini)',
        slug: 'setting-up-ai-api-key',
        category: 'ai',
        tags: ['OpenAI', 'Gemini', 'API key', 'AI setup'],
        excerpt: 'How to get an API key and connect OpenAI or Google Gemini to NeeFlow to enable AI features.',
        content: [
            h2('Setting Up Your AI API Key'),
            p('NeeFlow supports multiple AI providers: OpenAI (GPT-4), Google Gemini, OpenRouter, and more. You need an API key to use AI-powered content creation features.'),
            section(h3('Getting an OpenAI API Key') + ol([
                'Go to <strong>platform.openai.com/api-keys</strong>',
                'Log in or create an OpenAI account',
                'Click <strong>"Create new secret key"</strong>',
                'Name your key and copy the value (it is only shown once!)',
                'Make sure your account has credits — OpenAI uses a pay-per-use billing model',
            ])),
            tip('New OpenAI accounts receive $5 in free credits. For ongoing use, add credits at <strong>platform.openai.com/account/billing</strong>'),
            section(h3('Getting a Google Gemini API Key') + ol([
                'Go to <strong>aistudio.google.com</strong>',
                'Log in with your Google account',
                'Click <strong>"Get API Key"</strong> → <strong>"Create API key"</strong>',
                'Copy the generated API key',
                'Gemini has a free tier with a limit of 15 requests/minute',
            ])),
            section(h3('Adding the key to NeeFlow') + ol([
                'Go to <strong>Admin → Integrations → AI</strong>',
                'Click the <strong>OpenAI</strong> or <strong>Google Gemini</strong> card',
                'Paste your API key in the field',
                'Click <strong>Save & Test</strong> to verify the key works',
                'Select a default model (GPT-4o, Gemini Pro, etc.)',
            ])),
            warn('Never share your API key with anyone. NeeFlow stores keys encrypted, but you should regenerate the key if you suspect it has been compromised.'),
        ].join('\n'),
    },

    {
        title: 'Bulk Post Creator — Create Posts at Scale',
        slug: 'bulk-post-creator',
        category: 'ai',
        tags: ['bulk', 'batch', 'products', 'shopify'],
        excerpt: 'How to use the Bulk Post Creator to generate and schedule multiple posts at the same time.',
        content: [
            h2('Bulk Post Creator'),
            p('Bulk Post Creator lets you create multiple posts at once — ideal for weekly content planning or promoting an entire product catalog in one go.'),
            section(h3('Accessing Bulk Creator') + ol(['Go to <strong>Posts</strong> in the sidebar', 'Click the <strong>Bulk Create</strong> tab or the <strong>Bulk</strong> button', 'Choose a source: <strong>Manual</strong>, <strong>Shopify</strong>, or <strong>External</strong>'])),
            section(h3('Create from Shopify') + ol([
                'Select the <strong>Shopify Products</strong> source',
                'Check the products you want to create posts for (multi-select)',
                'Configure the AI template and tone',
                'Click <strong>Generate All</strong> — AI creates a unique caption per product',
                'Review and adjust individual posts if needed',
                'Click <strong>Schedule All</strong> to auto-distribute posting times',
            ])),
            tip('When scheduling Bulk posts, NeeFlow automatically spaces them out to avoid flooding your feed. You can adjust the spacing interval in the scheduling step.'),
            section(h3('Manual bulk creation') + ol([
                'Select the <strong>Manual</strong> source',
                'Enter a list of topics/products (one per line)',
                'AI generates a unique caption for each item',
                'Review and adjust before publishing',
            ])),
            warn('Bulk creation limits depend on your plan. Free plan: up to 10 posts per batch. Pro plan: unlimited.'),
        ].join('\n'),
    },

    // ── SCHEDULING ──
    {
        title: 'Auto-Scheduling Posts',
        slug: 'auto-scheduling-posts',
        category: 'integrations',
        tags: ['schedule', 'calendar', 'automation', 'timing'],
        excerpt: 'How to schedule posts automatically, manage them in the Calendar view, and optimize posting times.',
        content: [
            h2('Auto-Scheduling Posts'),
            p('Scheduling posts in advance lets you maintain a consistent posting cadence without needing to be online at specific times. NeeFlow publishes automatically at the exact time you set.'),
            section(h3('Schedule from the Compose Editor') + ol([
                'Finish writing your post in the Compose Editor',
                'Instead of clicking <strong>Post Now</strong>, click the arrow next to it → <strong>Schedule</strong>',
                'Select the <strong>date</strong> and <strong>time</strong>',
                'Select the <strong>timezone</strong> — defaults to your account timezone',
                'Click <strong>Schedule Post</strong> to confirm',
            ])),
            section(h3('Managing scheduled posts in Calendar') + ul([
                'Go to <strong>Calendar</strong> in the sidebar to see all scheduled posts',
                'Drag and drop posts to change their scheduled time',
                'Click any post to edit or delete it',
                'Toggle between week and month view for a broader or detailed overview',
            ])),
            tip('NeeFlow\'s AI can suggest the best posting times based on your account\'s historical engagement data. Click <strong>AI Suggest Time</strong> when scheduling.'),
            section(h3('Best practice posting times') + ul([
                '<strong>Facebook/Instagram:</strong> 9–11am and 7–9pm on weekdays',
                '<strong>LinkedIn:</strong> Early morning (7–9am) and lunchtime (12–1pm)',
                '<strong>TikTok:</strong> 7–11pm, especially Tuesday–Thursday',
                '<strong>Frequency:</strong> 1–2 posts/day on Facebook, 1 post/day on Instagram',
            ])),
        ].join('\n'),
    },

    {
        title: 'Post Approval Workflow',
        slug: 'post-approval-workflow',
        category: 'integrations',
        tags: ['approval', 'workflow', 'team', 'review'],
        excerpt: 'Set up a review-before-publish workflow — ideal for teams where content needs sign-off before going live.',
        content: [
            h2('Post Approval Workflow'),
            p('Post Approval gives Admins control over content before it goes live on social media — useful when working with a content team and ensuring quality.'),
            section(h3('Approval modes') + ul([
                badge('None', '#6b7280') + ' <strong>No approval required</strong> — Posts publish immediately after creation (default)',
                badge('Optional', '#f59e0b') + ' <strong>Optional</strong> — Creator decides whether to request approval',
                badge('Required', '#ef4444') + ' <strong>Required</strong> — EVERY post must be approved by an Admin before publishing',
            ])),
            section(h3('Enabling Approval Mode') + ol([
                'Go to <strong>Channel Settings → Content Policy</strong>',
                'Find the <strong>Post Approval</strong> section',
                'Select a mode: None / Optional / Required',
                'Click <strong>Save</strong>',
            ])),
            section(h3('Approval workflow') + ol([
                'Creator writes a post → Post status becomes ' + badge('PENDING APPROVAL', '#f59e0b'),
                'Admin receives a notification that a post is awaiting review',
                'Admin goes to <strong>Posts → Pending</strong>',
                'Admin clicks <strong>Approve</strong> or <strong>Reject</strong> (with optional notes)',
                'If Approved and time is set → Post publishes automatically at the scheduled time',
            ])),
            tip('Add a note when rejecting so the creator knows exactly what to fix. This raises content quality over time.'),
        ].join('\n'),
    },

    // ── INTEGRATIONS ──
    {
        title: 'Connecting Shopify — Sync Products',
        slug: 'connecting-shopify',
        category: 'integrations',
        tags: ['shopify', 'ecommerce', 'products', 'sync'],
        excerpt: 'How to connect your Shopify store to NeeFlow to sync products and auto-create social posts.',
        content: [
            h2('Connecting Shopify'),
            p('The Shopify integration lets you import products from your store and use AI to automatically create promotional posts from product details and images.'),
            section(h3('Step 1: Get your Shopify API credentials') + ol([
                'Log in to your Shopify Admin',
                'Go to <strong>Settings → Apps and sales channels → Develop apps</strong>',
                'Click <strong>Create an app</strong>, give it a name (e.g. "NeeFlow")',
                'Under <strong>Configuration</strong>, enable: ' + code('read_products') + ', ' + code('read_product_listings'),
                'Go to <strong>API credentials</strong> and click <strong>Install app</strong>',
                'Copy the <strong>Admin API access token</strong>',
            ])),
            section(h3('Step 2: Connect in NeeFlow') + ol([
                'Go to <strong>Integrations → E-commerce → Shopify</strong>',
                'Enter your <strong>Store URL</strong> (e.g. mystore.myshopify.com)',
                'Enter your <strong>Admin API Access Token</strong>',
                'Click <strong>Test Connection</strong>',
                'If successful, click <strong>Save & Sync</strong>',
            ])),
            section(h3('Using synced products') + ul([
                'In <strong>Compose → Shopify Product</strong>, select any product',
                'AI automatically reads the product name, description, price, and images',
                'Generate a promo caption in seconds',
                'Import product images directly into your post',
            ])),
            tip('Use Bulk Post Creator with the Shopify source to create promotional posts for your entire product catalog at once!'),
        ].join('\n'),
    },

    {
        title: 'Setting Up Google Drive — Media Import',
        slug: 'setting-up-google-drive',
        category: 'integrations',
        tags: ['google drive', 'media', 'import', 'images'],
        excerpt: 'Connect Google Drive to import images and videos directly into your NeeFlow Media Library.',
        content: [
            h2('Setting Up Google Drive'),
            p('The Google Drive integration lets you browse and import media from your Drive directly into posts — no need to download files and re-upload them.'),
            section(h3('Connect Google Drive') + ol([
                'Go to <strong>Admin → Integrations → Storage → Google Drive</strong>',
                'Click <strong>Connect with Google</strong>',
                'Log in with the Google account that holds your media',
                'Grant Google Drive access permissions',
                'NeeFlow will confirm the connection',
            ])),
            section(h3('Using Google Drive in posts') + ol([
                'While composing a post, click the <strong>📁 Media</strong> button',
                'Select the <strong>Google Drive</strong> tab',
                'Browse your Drive folders',
                'Select a file and click <strong>Insert</strong>',
            ])),
            tip('Organise your media into folders in Drive (e.g. /NeeFlow/Products/, /NeeFlow/Events/) to find content faster.'),
            warn('Supported formats: JPG, PNG, GIF, MP4, MOV. Maximum file size: 100MB.'),
        ].join('\n'),
    },

    // ── BILLING ──
    {
        title: 'Plans & Features Comparison',
        slug: 'plans-and-features',
        category: 'billing',
        tags: ['pricing', 'plans', 'features', 'free', 'pro'],
        excerpt: 'Detailed comparison of the Free, Pro, and Enterprise plans to help you choose the right one.',
        content: [
            h2('NeeFlow Plans & Features'),
            tbl(
                ['Feature', 'Free', 'Pro', 'Enterprise'],
                [
                    ['Channels', '1', '5', 'Unlimited'],
                    ['Social accounts', '3', 'Unlimited', 'Unlimited'],
                    ['Scheduled posts', '10', 'Unlimited', 'Unlimited'],
                    ['AI generations / month', '30', '500', 'Unlimited'],
                    ['Bulk Post Creator', '✗', '✓ up to 100', '✓ up to 500'],
                    ['Shopify / WooCommerce', '✗', '✓', '✓'],
                    ['Media storage', '500MB', '10GB', '100GB'],
                    ['Advanced analytics', '✗', '✓', '✓'],
                    ['Own AI API key', '✗', '✓', '✓'],
                    ['Custom branding', '✗', '✗', '✓'],
                    ['Multi-user / Teams', '✗', '✗', '✓'],
                    ['Dedicated support', '✗', 'Priority', 'Account manager'],
                ]
            ),
            tip('You can upgrade your plan at any time. You\'ll only be charged a prorated amount for the remaining days in your current billing period.'),
            section(h3('Choosing the right plan') + ul([
                '<strong>Free:</strong> Perfect for individuals who want to test NeeFlow',
                '<strong>Pro:</strong> Best for small businesses managing 1–5 brands',
                '<strong>Enterprise:</strong> For agencies and large teams managing many brands',
            ])),
        ].join('\n'),
    },

    {
        title: 'Upgrading & Cancelling Your Subscription',
        slug: 'upgrading-cancelling-subscription',
        category: 'billing',
        tags: ['upgrade', 'cancel', 'subscription', 'billing'],
        excerpt: 'How to upgrade to a higher plan, cancel your subscription, and handle billing issues.',
        content: [
            h2('Upgrading & Cancelling Your Subscription'),
            section(h3('Upgrading your plan') + ol([
                'Go to <strong>Settings → Billing</strong>',
                'Choose the plan you want and click <strong>Upgrade</strong>',
                'Enter your card details or use a saved card',
                'Confirm the payment',
                'Your new plan takes effect immediately',
            ])),
            tip('When upgrading mid-cycle, you only pay for the remaining days of the current period — the credit from your existing plan is applied automatically.'),
            section(h3('Cancelling your subscription') + ol([
                'Go to <strong>Settings → Billing → Manage Subscription</strong>',
                'Click <strong>Cancel Subscription</strong>',
                'Select a cancellation reason (this helps us improve)',
                'Confirm the cancellation',
                'Your current plan remains active until the end of the paid period',
            ])),
            section(h3('Handling billing issues') + ul([
                '<strong>Card declined:</strong> Check your balance or contact your bank. Update your card in the Billing section.',
                '<strong>Missing invoice:</strong> Check your spam/junk folder',
                '<strong>Requesting a refund:</strong> Contact support within 14 days of the charge',
            ])),
            warn('After cancellation and the end of your billing period, your account reverts to the Free plan. Your data is preserved, but some features will be disabled.'),
        ].join('\n'),
    },

    // ── TROUBLESHOOTING ──
    {
        title: 'Why Did My Post Fail to Publish?',
        slug: 'post-failed-to-publish',
        category: 'troubleshooting',
        tags: ['debug', 'error', 'post failed', 'troubleshoot'],
        excerpt: 'A complete checklist to debug why a scheduled post did not publish on time.',
        content: [
            h2('Post Failed to Publish — Debug Checklist'),
            p('If a scheduled post did not publish, work through the following steps:'),
            section(h3('1. Check the post status') + ul([
                'Go to <strong>Posts → Scheduled</strong> and find your post',
                'Look at the <strong>Status</strong> column — if there\'s an error icon, hover to see the details',
                badge('FAILED', '#ef4444') + ' = Attempted but failed — check the specific reason',
                badge('PENDING', '#f59e0b') + ' = Waiting to publish or waiting for approval',
            ])),
            section(h3('2. Check platform connection') + ul([
                'Go to <strong>Channel Settings → Platforms</strong>',
                'Check that the target account shows ' + badge('Connected', '#22c55e'),
                'If it shows ' + badge('Token Expired', '#ef4444') + ' — reconnect the account',
                'Facebook/Instagram tokens typically expire after 60 days',
            ])),
            section(h3('3. Check content requirements') + ul([
                '<strong>Facebook:</strong> No shortened links (bit.ly); content must not violate Community Standards',
                '<strong>Instagram:</strong> Images must be at least 400×400px; videos max 60s for feed posts',
                '<strong>TikTok:</strong> Videos must be 3–60 seconds; avoid copyrighted music',
                '<strong>LinkedIn:</strong> Images must be at least 200×200px',
            ])),
            section(h3('4. Check Approval Mode') + p('If the channel has <strong>Required Approval</strong> enabled, posts will not publish until an Admin approves them. Check <strong>Posts → Pending Approval</strong>.')),
            tip('If you\'ve gone through all the above and the post still didn\'t publish, create a Support Ticket with the Post ID. Our team will check the system logs.'),
        ].join('\n'),
    },

    {
        title: 'Social Media Connection Errors — Token Expired',
        slug: 'connection-errors-token-expired',
        category: 'troubleshooting',
        tags: ['token', 'connection error', 're-auth', 'facebook', 'instagram'],
        excerpt: 'How to handle expired social media tokens and reconnect your accounts step by step.',
        content: [
            h2('Connection Errors — Token Expired'),
            p('A token is the authentication credential that allows NeeFlow to post on your behalf. Tokens can expire or be revoked in certain situations.'),
            section(h3('When does a token expire?') + ul([
                '<strong>Facebook/Instagram:</strong> Short-lived user tokens (1–2 hrs), long-lived page tokens (~60 days)',
                '<strong>TikTok:</strong> Tokens expire after 24 hours of inactivity',
                '<strong>LinkedIn:</strong> Tokens expire after 60 days',
                'You changed the password of the social media account',
                'You revoked app access in the platform\'s settings',
                'Your account was temporarily locked or required verification',
            ])),
            section(h3('How to reconnect') + ol([
                'Go to <strong>Channel Settings → Platforms</strong>',
                'Find the account showing ' + badge('Token Expired', '#ef4444') + ' or ' + badge('Disconnected', '#ef4444'),
                'Click <strong>Reconnect</strong> or <strong>Re-authenticate</strong>',
                'Complete the OAuth login flow again',
                'After reconnecting, scheduled posts will resume publishing normally',
            ])),
            tip('Set a calendar reminder every 50 days to check your platform connections. This prevents unplanned posting interruptions caused by expired tokens.'),
            section(h3('Common error codes') + ul([
                code('Error 190') + ' — Token expired; reconnect required',
                code('Error 200') + ' — Insufficient permissions; re-auth and grant additional permissions',
                code('Error 341') + ' — Platform posting rate limit exceeded; retry after 1 hour',
                code('Error 368') + ' — Content violates platform policy; edit the post content',
            ])),
        ].join('\n'),
    },

    {
        title: 'API Rate Limits & Quota by Plan',
        slug: 'api-rate-limits-quota',
        category: 'troubleshooting',
        tags: ['quota', 'rate limit', 'limits', 'API'],
        excerpt: 'A summary of usage limits by plan and how to handle quota exceeded scenarios.',
        content: [
            h2('API Rate Limits & Quota'),
            p('Each NeeFlow plan has different usage limits. Understanding these helps you plan your content strategy effectively.'),
            section(h3('Limits by feature') + tbl(
                ['Feature', 'Free', 'Pro', 'Enterprise'],
                [
                    ['Channels', '1', '5', 'Unlimited'],
                    ['AI generations / month', '30', '500', 'Unlimited'],
                    ['Scheduled posts', '10', 'Unlimited', 'Unlimited'],
                    ['Bulk create / batch', '—', '100', '500'],
                    ['Media storage', '500MB', '10GB', '100GB'],
                    ['Own API key bypass', '✗', '✓', '✓'],
                ]
            )),
            section(h3('When you exceed AI quota') + ul([
                'A warning notification appears when you have 10% quota remaining',
                'When quota is exhausted, AI features pause until the start of the next month',
                'You can still compose and publish posts manually when quota is used up',
                'Upgrade your plan at any time to increase quota immediately',
            ])),
            tip('Connect your own API key (OpenAI or Gemini) in <strong>Integrations → AI</strong> to bypass NeeFlow\'s built-in AI quota — your own key is not counted against your plan limits.'),
            section(h3('Platform rate limits') + ul([
                '<strong>Facebook:</strong> 200 API calls/hour per Page',
                '<strong>Instagram:</strong> 200 API calls/hour per account',
                '<strong>TikTok:</strong> 100 requests/minute',
                '<strong>LinkedIn:</strong> 100 requests/day per connected app',
            ])),
        ].join('\n'),
    },
]

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true, email: true },
    })
    if (!admin) {
        console.error('❌ No ADMIN user found. Run seed.ts first.')
        process.exit(1)
    }
    console.log(`👤 Using admin: ${admin.email}`)

    let created = 0, skipped = 0

    for (const article of articles) {
        const existing = await prisma.supportArticle.findFirst({ where: { slug: article.slug } })
        if (existing) {
            console.log(`⏭️  Skip (exists): ${article.slug}`)
            skipped++
            continue
        }
        await prisma.supportArticle.create({
            data: {
                title: article.title,
                slug: article.slug,
                excerpt: article.excerpt,
                content: article.content,
                metaDesc: article.excerpt,
                category: article.category,
                tags: article.tags,
                status: 'published',
                authorId: admin.id,
                viewCount: 0,
                helpfulCount: 0,
            },
        })
        console.log(`✅ Created: ${article.title}`)
        created++
    }

    console.log(`\n🎉 Done! Created: ${created} | Skipped: ${skipped}`)
}

main()
    .then(async () => { await prisma.$disconnect(); await pool.end() })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); await pool.end(); process.exit(1) })
