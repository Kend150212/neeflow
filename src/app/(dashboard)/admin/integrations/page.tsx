'use client'

import { useBranding } from '@/lib/use-branding'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Plug,
    Loader2,
    Check,
    X,
    Eye,
    EyeOff,
    RefreshCw,
    Zap,
    BrainCircuit,
    HardDrive,
    Mail,
    Webhook,
    Save,
    ExternalLink,
    Info,
    FolderPlus,
    Link,
    Palette,
    CreditCard,
    Shield,
} from 'lucide-react'
import { toast } from 'sonner'

interface ModelInfo {
    id: string
    name: string
    type: 'text' | 'image' | 'video' | 'audio' | 'embedding' | 'other'
    description?: string
}

interface Integration {
    id: string
    category: string
    provider: string
    name: string
    baseUrl: string | null
    config: Record<string, unknown> | null
    isActive: boolean
    isDefault: boolean
    status: string
    lastTestedAt: string | null
    usageCount: number
    rateLimitPerSec: number | null
    hasApiKey: boolean
    apiKeyMasked: string | null
}

const categoryIcons: Record<string, React.ReactNode> = {
    AUTH: <Shield className="h-5 w-5" />,
    SOCIAL: <Zap className="h-5 w-5" />,
    AI: <BrainCircuit className="h-5 w-5" />,
    STORAGE: <HardDrive className="h-5 w-5" />,
    EMAIL: <Mail className="h-5 w-5" />,
    WEBHOOK: <Webhook className="h-5 w-5" />,
    DESIGN: <Palette className="h-5 w-5" />,
    BILLING: <CreditCard className="h-5 w-5" />,
}

// categoryLabels now driven by t() inside the component

const providerColors: Record<string, string> = {
    vbout: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    youtube: 'bg-red-500/10 text-red-500 border-red-500/20',
    tiktok: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
    facebook: 'bg-blue-600/10 text-blue-600 border-blue-600/20',
    instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    linkedin: 'bg-sky-600/10 text-sky-600 border-sky-600/20',
    x: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
    pinterest: 'bg-red-600/10 text-red-600 border-red-600/20',
    threads: 'bg-neutral-700/10 text-neutral-300 border-neutral-500/20',
    openai: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    gemini: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    runware: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    openrouter: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    synthetic: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    robolly: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    gdrive: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    r2: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    smtp: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    canva: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    stripe: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    google_oauth: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    recaptcha: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    shopify: 'bg-[#96bf47]/10 text-[#96bf47] border-[#96bf47]/20',
    whatsapp: 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20',
    zalo: 'bg-[#0068FF]/10 text-[#0068FF] border-[#0068FF]/20',
}

const providerGuideUrls: Record<string, string> = {
    vbout: 'https://app.vbout.com/Settings#tab-api',
    youtube: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    tiktok: 'https://developers.tiktok.com/',
    facebook: 'https://developers.facebook.com/apps/',
    instagram: 'https://developers.facebook.com/apps/',
    linkedin: 'https://www.linkedin.com/developers/apps',
    x: 'https://developer.twitter.com/en/portal/dashboard',
    pinterest: 'https://developers.pinterest.com/apps/',
    threads: 'https://developers.facebook.com/apps/',
    openai: 'https://platform.openai.com/api-keys',
    gemini: 'https://aistudio.google.com/apikey',
    runware: 'https://my.runware.ai/keys',
    openrouter: 'https://openrouter.ai/settings/keys',
    synthetic: 'https://synthetic.new/api-keys',
    robolly: 'https://robolly.com/dashboard/',
    gdrive: 'https://console.cloud.google.com/apis/library/drive.googleapis.com',
    r2: 'https://dash.cloudflare.com/?to=/:account/r2/overview',
    smtp: 'https://myaccount.google.com/apppasswords',
    canva: 'https://www.canva.com/developers/',
    stripe: 'https://dashboard.stripe.com/apikeys',
    google_oauth: 'https://console.cloud.google.com/apis/credentials',
    recaptcha: 'https://www.google.com/recaptcha/admin',
    shopify: 'https://partners.shopify.com/',
    whatsapp: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    zalo: 'https://developers.zalo.me/',
}

interface PlatformGuide {
    title: string
    description: string
    steps: { title: string; detail: string }[]
    tips?: string[]
    url: string
    urlLabel: string
}

const platformGuides: Record<string, PlatformGuide> = {
    facebook: {
        title: '🔵 Facebook App Setup Guide / Hướng Dẫn Cài Đặt Facebook',
        description: 'Connect your Facebook Pages to publish posts and manage engagement.\nKết nối Facebook Pages để đăng bài và quản lý tương tác.',
        steps: [
            { title: 'Step 1: Go to Meta for Developers / Vào Meta for Developers', detail: 'Visit developers.facebook.com → click "My Apps" → "Create App".\n\nTruy cập developers.facebook.com → nhấn "My Apps" → "Create App".' },
            { title: 'Step 2: Enter App Details / Nhập thông tin App', detail: 'Enter App name (e.g. `"${branding.appName}"`) and your contact email. Click "Next".\n\nNhập tên App (ví dụ `"${branding.appName}"`) và email liên hệ. Nhấn "Next".' },
            { title: 'Step 3: Select Use Case / Chọn Use Case', detail: 'Choose "Authenticate and request data from users with Facebook Login". Click "Next".\n\nChọn "Authenticate and request data from users with Facebook Login". Nhấn "Next".' },
            { title: 'Step 4: Select App Type / Chọn loại App', detail: 'Choose "Business" — this gives access to Pages, Events, Groups, and Instagram. Click "Next" → "Create app".\n\nChọn "Business" — sẽ có quyền truy cập Pages, Events, Groups, và Instagram. Nhấn "Next" → "Create app".' },
            { title: 'Step 5: Get App ID & Secret / Lấy App ID & Secret', detail: 'Go to App Settings → Basic. Copy "App ID" and "App Secret". Paste them into the fields below.\n\nVào App Settings → Basic. Copy "App ID" và "App Secret". Dán vào các ô bên dưới.' },
            { title: 'Step 6: Add Facebook Login / Thêm Facebook Login', detail: 'In sidebar → Products → "Add Product" → find "Facebook Login for Business" → "Set up".\n\nTrong menu bên trái → Products → "Add Product" → tìm "Facebook Login for Business" → "Set up".' },
            { title: 'Step 7: Configure Redirect URI / Cấu hình Redirect URI', detail: 'Go to Facebook Login → Settings → "Valid OAuth Redirect URIs". Add:\n{YOUR_DOMAIN}/api/oauth/facebook/callback\n\nVào Facebook Login → Settings → "Valid OAuth Redirect URIs". Thêm:\n{YOUR_DOMAIN}/api/oauth/facebook/callback' },
            { title: 'Step 8: Add Privacy Policy / Thêm Privacy Policy', detail: 'Go to App Settings → Basic → add Privacy Policy URL (required to go Live).\nExample: {YOUR_DOMAIN}/privacy\n\nVào App Settings → Basic → thêm Privacy Policy URL (bắt buộc để chuyển sang Live).\nVí dụ: {YOUR_DOMAIN}/privacy' },
            { title: 'Step 9: Set App to Live / Chuyển App sang Live', detail: 'Toggle the app from "Development" to "Live" in the top bar. You may need to complete Data Use Checkup first.\n\nChuyển app từ "Development" sang "Live" ở thanh trên cùng. Có thể cần hoàn thành Data Use Checkup trước.' },
        ],
        tips: [
            '✅ Redirect URI: {YOUR_DOMAIN}/api/oauth/facebook/callback',
            '✅ Required scopes: pages_show_list, pages_read_engagement, pages_manage_posts',
            '⚠️ In Development mode, only app admins/developers/testers can use the app / Ở chế độ Development, chỉ admin/developer/tester mới dùng được',
            '⚠️ Your Facebook account must be an admin of the Pages / Tài khoản Facebook phải là admin của Pages',
            '💡 A Privacy Policy URL is required before Live mode / Cần Privacy Policy URL trước khi chuyển Live',
        ],
        url: 'https://developers.facebook.com/apps/',
        urlLabel: 'Open Facebook Developers Portal',
    },
    instagram: {
        title: '📸 Instagram Business API Setup Guide / Hướng Dẫn Cài Đặt Instagram',
        description: 'Publish content and manage your Instagram Business/Creator accounts. Uses the same Facebook App.\nĐăng nội dung và quản lý tài khoản Instagram Business/Creator. Dùng chung Facebook App.',
        steps: [
            { title: 'Step 1: Use Your Facebook App / Dùng chung Facebook App', detail: 'Instagram API uses the SAME Facebook App. If you haven\'t created one, follow the Facebook guide first.\n→ Go to https://developers.facebook.com/apps/ → select your App.\n\nInstagram API sử dụng CÙNG Facebook App. Nếu bạn chưa có, hãy setup Facebook trước.\n→ Vào https://developers.facebook.com/apps/ → chọn App của bạn.' },
            { title: 'Step 2: Add Instagram Product / Thêm Instagram Product', detail: 'In your Facebook App Dashboard:\n1. Left menu → "Add Product" or "Products"\n2. Find "Instagram" → click "Set Up"\n3. Select "Instagram Graph API" (NOT Instagram Basic Display)\n\nTrong Facebook App Dashboard:\n1. Menu bên trái → "Add Product" hoặc "Products"\n2. Tìm "Instagram" → nhấn "Set Up"\n3. Chọn "Instagram Graph API" (KHÔNG phải Instagram Basic Display)' },
            { title: 'Step 3: Switch to Professional Account / Chuyển sang tài khoản Professional', detail: 'Personal Instagram accounts will NOT work. Switch to Business or Creator:\n1. Open Instagram app → Settings → Account\n2. "Switch to Professional account"\n3. Choose "Business" or "Creator"\n4. Select Category → Done\n\nInstagram cá nhân KHÔNG hoạt động. Chuyển sang Business hoặc Creator:\n1. Mở Instagram app → Settings → Account\n2. "Switch to Professional account"\n3. Chọn "Business" hoặc "Creator"\n4. Chọn Category → Done' },
            { title: 'Step 4: Link Instagram to Facebook Page / Liên kết IG với Facebook Page', detail: 'Each Instagram Business account must be linked to a Facebook Page:\n\nOption A (from Facebook):\n1. Open Facebook Page → Settings → Linked Accounts\n2. Click "Connect" next to Instagram → Authorize\n\nOption B (from Instagram):\n1. Open Instagram → Settings → Account → Linked Accounts\n2. Select Facebook → link to your Page\n\nMỗi Instagram Business phải liên kết với 1 Facebook Page:\n\nCách A (từ Facebook):\n1. Mở Facebook Page → Settings → Linked Accounts\n2. Nhấn "Connect" bên cạnh Instagram → Authorize\n\nCách B (từ Instagram):\n1. Mở Instagram → Settings → Account → Linked Accounts\n2. Chọn Facebook → liên kết với Page' },
            { title: 'Step 5: Add Redirect URI / Thêm Redirect URI', detail: 'In Facebook App → Facebook Login → Settings:\n"Valid OAuth Redirect URIs" → add:\n{YOUR_DOMAIN}/api/oauth/instagram/callback\n\nTrong Facebook App → Facebook Login → Settings:\n"Valid OAuth Redirect URIs" → thêm:\n{YOUR_DOMAIN}/api/oauth/instagram/callback' },
            { title: 'Step 6: Enter App ID & Secret / Nhập App ID & Secret', detail: 'Use the SAME App ID and App Secret from your Facebook App:\nApp Settings → Basic → copy "App ID" and "App Secret" → paste below.\nIf you already set up Facebook, you DON\'T need to enter again — the system auto-uses Facebook credentials.\n\nDùng CÙNG App ID và App Secret từ Facebook App:\nApp Settings → Basic → copy "App ID" và "App Secret" → dán bên dưới.\nNếu đã setup Facebook rồi thì KHÔNG cần nhập lại — hệ thống tự dùng credentials từ Facebook.' },
        ],
        tips: [
            '✅ Redirect URI: {YOUR_DOMAIN}/api/oauth/instagram/callback',
            '✅ Scopes: instagram_business_basic, instagram_business_content_publish, pages_show_list, pages_read_engagement',
            '⚠️ Personal IG accounts won\'t work — switch to Business or Creator / IG cá nhân không hoạt động — chuyển sang Business hoặc Creator',
            '⚠️ Each IG account must be linked to a Facebook Page / Mỗi IG account phải liên kết với 1 Facebook Page',
            '💡 Uses the SAME Facebook App — no separate app needed / Dùng CÙNG Facebook App — không cần tạo app riêng',
            '💡 If Facebook is already set up, just add redirect URI and click Connect / Nếu đã setup Facebook, chỉ cần thêm redirect URI và nhấn Connect',
        ],
        url: 'https://developers.facebook.com/apps/',
        urlLabel: 'Open Facebook Developers Portal',
    },
    youtube: {
        title: '🔴 YouTube API Setup Guide',
        description: 'Upload videos and manage your YouTube channel.',
        steps: [
            { title: 'Open Google Cloud Console', detail: 'Visit console.cloud.google.com and sign in with your Google account.' },
            { title: 'Create or Select a Project', detail: 'Click the project dropdown at the top → "New Project". Give it a name and create it.' },
            { title: 'Enable YouTube Data API v3', detail: 'Go to APIs & Services → Library. Search for "YouTube Data API v3" and click "Enable".' },
            { title: 'Configure OAuth Consent Screen', detail: 'Go to APIs & Services → OAuth consent screen. Select "External", fill in app name, email, and save.' },
            { title: 'Create OAuth Credentials', detail: 'Go to APIs & Services → Credentials → Create Credentials → OAuth client ID. Select "Web application".' },
            { title: 'Set Redirect URI', detail: 'Add authorized redirect URI:\n{YOUR_DOMAIN}/api/oauth/youtube/callback' },
            { title: 'Copy Client ID & Secret', detail: 'Copy the "Client ID" and "Client Secret" from the created credential. Paste them below.' },
        ],
        tips: [
            'Redirect URI: {YOUR_DOMAIN}/api/oauth/youtube/callback',
            'Required scopes: youtube.readonly, youtube.upload, youtube.force-ssl, youtubepartner',
            'Add test users in the OAuth consent screen while the app is in "Testing" status.',
            'Make sure the YouTube channel is linked to the Google account you\'re using.',
        ],
        url: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
        urlLabel: 'Open Google Cloud Console',
    },
    tiktok: {
        title: '🎵 TikTok API Setup Guide',
        description: 'Publish videos to TikTok directly from the platform.',
        steps: [
            { title: 'Go to TikTok Developer Portal', detail: 'Visit developers.tiktok.com → log in → click "Manage apps" → "Create app".' },
            { title: 'Fill App Details', detail: 'Enter app name, description, and icon. Select the platform as "Web".' },
            { title: 'Enable Login Kit', detail: 'In your app settings, find "Login Kit" and enable it. Add redirect URI:\n{YOUR_DOMAIN}/api/oauth/tiktok/callback' },
            { title: 'Enable Content Posting API', detail: 'Find "Content Posting API" in the products list and enable it.' },
            { title: 'Copy Client Key & Secret', detail: 'Go to your app\'s basic info. Copy the "Client Key" and "Client Secret". Paste them below.' },
            { title: 'Submit for Review', detail: 'Your app needs TikTok\'s approval. Submit for review and wait for approval (1-3 business days).' },
        ],
        tips: [
            'Redirect URI: {YOUR_DOMAIN}/api/oauth/tiktok/callback',
            'Required scope: user.info.basic',
            'In sandbox mode, you can only post to your own account for testing.',
        ],
        url: 'https://developers.tiktok.com/',
        urlLabel: 'Open TikTok Developer Portal',
    },
    linkedin: {
        title: '🔗 LinkedIn API Setup Guide',
        description: 'Share posts and articles to LinkedIn company pages and profiles.',
        steps: [
            { title: 'Go to LinkedIn Developer Portal', detail: 'Visit linkedin.com/developers and sign in with your LinkedIn account.' },
            { title: 'Create a New App', detail: 'Click "Create App". Fill in app name, LinkedIn Page (required), logo, and accept terms.' },
            { title: 'Request Products', detail: 'Go to the "Products" tab. Request "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect".' },
            { title: 'Configure OAuth 2.0', detail: 'Go to the "Auth" tab. Add your redirect URI:\n{YOUR_DOMAIN}/api/oauth/linkedin/callback' },
            { title: 'Copy Client ID & Secret', detail: 'In the "Auth" tab, copy your "Client ID" and "Client Secret". Paste them below.' },
        ],
        tips: [
            'Redirect URI: {YOUR_DOMAIN}/api/oauth/linkedin/callback',
            'Required scopes: openid, profile, w_member_social',
            'You must associate a LinkedIn Company Page with your app.',
            'Product access requests may take a few days for approval.',
        ],
        url: 'https://www.linkedin.com/developers/apps',
        urlLabel: 'Open LinkedIn Developer Portal',
    },
    x: {
        title: '𝕏 X (Twitter) API Setup Guide',
        description: 'Post tweets and manage your X account.',
        steps: [
            { title: 'Go to X Developer Portal', detail: 'Visit developer.x.com and sign in. Apply for a developer account if needed.' },
            { title: 'Create a Project & App', detail: 'Create a new Project, then create an App within it.' },
            { title: 'Set App Permissions', detail: 'In App Settings → User authentication settings → set permissions to "Read and Write".' },
            { title: 'Enable OAuth 2.0', detail: 'Enable OAuth 2.0. Select type: "Web App". Add redirect URI:\n{YOUR_DOMAIN}/api/oauth/x/callback' },
            { title: 'Copy Client ID & Secret', detail: 'Go to "Keys and tokens" tab. Copy your "Client ID" and "Client Secret" (OAuth 2.0). Paste them below.' },
        ],
        tips: [
            'Redirect URI: {YOUR_DOMAIN}/api/oauth/x/callback',
            'Required scopes: tweet.read, tweet.write, users.read, offline.access',
            'Free tier: 1,500 tweets/month. Basic tier ($100/month) has more generous limits.',
            'Use OAuth 2.0 Client ID — not the API Key (OAuth 1.0a).',
        ],
        url: 'https://developer.twitter.com/en/portal/dashboard',
        urlLabel: 'Open X Developer Portal',
    },
    pinterest: {
        title: '📌 Pinterest API Setup Guide',
        description: 'Create and manage Pins on your Pinterest boards.',
        steps: [
            { title: 'Go to Pinterest Developer Portal', detail: 'Visit developers.pinterest.com and log in with your Pinterest Business account.' },
            { title: 'Create a New App', detail: 'Click "My Apps" → "Create" → fill in app name and description.' },
            { title: 'Set Redirect URI', detail: 'Add your redirect URI:\n{YOUR_DOMAIN}/api/oauth/pinterest/callback' },
            { title: 'Copy App ID & Secret', detail: 'Copy your "App ID" and "App Secret" from the app details page. Paste them below.' },
            { title: 'Submit for Review', detail: 'Submit your app for Pinterest\'s review to get production access.' },
        ],
        tips: [
            'Redirect URI: {YOUR_DOMAIN}/api/oauth/pinterest/callback',
            'Required scopes: boards:read, pins:read, pins:write, user_accounts:read',
            'Pinterest account must be a Business account.',
            'In sandbox mode, API use is limited to app collaborators.',
        ],
        url: 'https://developers.pinterest.com/apps/',
        urlLabel: 'Open Pinterest Developer Portal',
    },
    threads: {
        title: '🧵 Threads API Setup Guide',
        description: 'Post content to Threads accounts directly from the platform.\nĐăng nội dung lên Threads trực tiếp từ nền tảng.',
        steps: [
            { title: 'Step 1: Go to Meta for Developers / Vào Meta for Developers', detail: 'Visit developers.facebook.com → click "My Apps" → "Create App".\n\nTruy cập developers.facebook.com → nhấn "My Apps" → "Create App".' },
            { title: 'Step 2: Select App Type / Chọn loại App', detail: 'When asked "What do you want your app to do?", choose "Other" → "Business" type. Click "Next" → "Create App".\n\nKhi được hỏi muốn app làm gì, chọn "Other" → loại "Business". Nhấn "Next" → "Create App".' },
            { title: 'Step 3: Add Threads Product / Thêm Threads Product', detail: 'In App Dashboard → left sidebar → "Add Product". Find "Threads API" and click "Set Up".\n\nTrong App Dashboard → menu bên trái → "Add Product". Tìm "Threads API" và nhấn "Set Up".' },
            { title: 'Step 4: Configure Redirect URI / Cấu hình Redirect URI', detail: 'In Threads API Settings → add your Redirect URI:\n{YOUR_DOMAIN}/api/oauth/threads/callback\n\nTrong Threads API Settings → thêm Redirect URI:\n{YOUR_DOMAIN}/api/oauth/threads/callback' },
            { title: 'Step 5: Get App ID & Secret / Lấy App ID & Secret', detail: 'Go to App Settings → Basic. Copy "App ID" and "App Secret". Paste them below.\n\nVào App Settings → Basic. Copy "App ID" và "App Secret". Dán vào các ô bên dưới.' },
            { title: 'Step 6: Add Test Users / Thêm Test Users (Development mode)', detail: 'In App Roles → Roles → Add Testers. Invite any Threads account you want to test with.\nNote: In Development mode only added testers can connect.\n\nTrong App Roles → Roles → Add Testers. Mời tài khoản Threads muốn test.\nLưu ý: Ở Development mode chỉ testers mới kết nối được.' },
            { title: 'Step 7: Submit for App Review / Gửi App Review (Production)', detail: 'Go to App Review → Permissions and Features. Request these permissions:\n✅ threads_basic\n✅ threads_content_publish\n✅ threads_manage_insights\n✅ threads_manage_replies\n✅ threads_read_replies\n\nVào App Review → Permissions and Features. Yêu cầu các quyền trên để chuyển sang Production.' },
        ],
        tips: [
            '✅ Callback URI: {YOUR_DOMAIN}/api/oauth/threads/callback',
            '✅ Required scopes: threads_basic, threads_content_publish, threads_manage_insights, threads_manage_replies, threads_read_replies',
            '⚠️ In Development mode, only added testers can connect / Ở Development mode chỉ testers mới kết nối được',
            '⚠️ Threads account must be a personal account — not possible with Pages / Tài khoản Threads phải là personal account',
            '💡 Access tokens are long-lived (60 days) and auto-refresh / Token có hiệu lực 60 ngày và tự refresh',
            '💡 Uses a SEPARATE Meta app from Facebook/Instagram / Dùng Meta app RIÊNG biệt với Facebook/Instagram',
        ],
        url: 'https://developers.facebook.com/apps/',
        urlLabel: 'Open Meta Developer Portal',
    },
    canva: {
        title: '🎨 Canva Connect API Setup Guide',
        description: 'Design stunning social media graphics with Canva editor embedded in your platform.',
        steps: [
            { title: 'Go to Canva Developers', detail: 'Visit canva.com/developers → sign in with your Canva account → click "Create an integration".' },
            { title: 'Set Integration Name', detail: 'Name your integration `"${branding.appName}"`. Copy the "Client ID" shown.' },
            { title: 'Generate Client Secret', detail: 'Click "Generate secret" — copy it IMMEDIATELY. It will only be shown once.' },
            { title: 'Set Scopes', detail: 'Check these scopes:\n✅ design:content — Read and Write\n✅ design:meta — Read\n✅ asset — Read and Write\n✅ profile — Read' },
            { title: 'Add Redirect URL', detail: 'Under Authentication → Add Authentication → URL 1:\n{YOUR_DOMAIN}/api/oauth/canva/callback' },
            { title: 'Enable Return Navigation', detail: 'Toggle "Enable return navigation" ON.\nSet Return URL: {YOUR_DOMAIN}/dashboard/posts/compose' },
            { title: 'Paste Credentials Below', detail: 'Paste the Client ID and Client Secret into the fields below and click Save.' },
        ],
        tips: [
            'Redirect URI: {YOUR_DOMAIN}/api/oauth/canva/callback',
            'Required scopes: design:content, design:meta, asset, profile',
            'Canva Connect API is free for developers — users need Canva Free or Pro.',
        ],
        url: 'https://www.canva.com/developers/',
        urlLabel: 'Open Canva Developer Portal',
    },
    vbout: {
        title: '🟦 Vbout API Setup Guide',
        description: 'Connect to Vbout for social media management and email marketing.',
        steps: [
            { title: 'Log in to Vbout', detail: 'Go to app.vbout.com and sign in with your account.' },
            { title: 'Go to API Settings', detail: 'Navigate to Settings → API. You\'ll find your API key here.' },
            { title: 'Copy API Key', detail: 'Copy the API key and paste it into the field below.' },
        ],
        url: 'https://app.vbout.com/Settings#tab-api',
        urlLabel: 'Open Vbout Settings',
    },
    stripe: {
        title: '💳 Stripe API Setup Guide',
        description: 'Configure Stripe for subscription billing, checkout, and payment webhooks.\nCấu hình Stripe để xử lý thanh toán và subscription.',
        steps: [
            { title: 'Go to Stripe Dashboard', detail: 'Visit dashboard.stripe.com → sign in or create an account.\n\nTruy cập dashboard.stripe.com → đăng nhập hoặc tạo tài khoản.' },
            { title: 'Get API Keys', detail: 'Go to Developers → API Keys.\nCopy the "Secret key" (sk_live_...) → paste into "Secret Key" below.\nCopy the "Publishable key" (pk_live_...) → paste into "Publishable Key" below.\n\nVào Developers → API Keys.\nCopy "Secret key" (sk_live_...) → dán vào ô "Secret Key".\nCopy "Publishable key" (pk_live_...) → dán vào ô "Publishable Key".' },
            { title: 'Set up Webhook', detail: 'Go to Developers → Webhooks → "Add endpoint".\nEndpoint URL: {YOUR_DOMAIN}/api/billing/webhook\nEvents to listen:\n• checkout.session.completed\n• customer.subscription.updated\n• customer.subscription.deleted\n• invoice.payment_failed\n\nVào Developers → Webhooks → "Add endpoint".\nURL: {YOUR_DOMAIN}/api/billing/webhook\nSự kiện cần lắng nghe:\n• checkout.session.completed\n• customer.subscription.updated\n• customer.subscription.deleted\n• invoice.payment_failed' },
            { title: 'Get Webhook Secret', detail: 'After creating the webhook, click into it → "Signing secret" → Reveal.\nCopy the whsec_... value → paste into "Webhook Secret" below.\n\nSau khi tạo webhook, nhấn vào nó → "Signing secret" → Reveal.\nCopy giá trị whsec_... → dán vào ô "Webhook Secret".' },
            { title: 'Click Save → Test', detail: 'Click "Save" to store all 3 keys. Then click "Test Connection" to verify the Secret Key works.\n\nNhấn "Save" để lưu 3 key. Sau đó nhấn "Test Connection" để kiểm tra Secret Key.' },
            { title: 'Seed Plans (server)', detail: 'On the server, run: npx tsx prisma/seed-plans.ts\nThis creates the Free/Pro/Business/Enterprise plans in the database.\n\nTrên server chạy: npx tsx prisma/seed-plans.ts\nSẽ tạo các gói Free/Pro/Business/Enterprise trong database.' },
        ],
        tips: [
            '✅ Use Test keys (sk_test_ / pk_test_) for development, Live keys for production',
            '✅ Webhook endpoint: {YOUR_DOMAIN}/api/billing/webhook',
            '⚠️ Webhook Secret changes if you delete and recreate the webhook — update it here too',
            '💡 After saving, run the seed script to create default plans',
        ],
        url: 'https://dashboard.stripe.com/apikeys',
        urlLabel: 'Open Stripe Dashboard',
    },

    openai: {
        title: '🤖 OpenAI API Setup Guide',
        description: 'Connect to GPT models for AI-powered content generation.',
        steps: [
            { title: 'Go to OpenAI Platform', detail: 'Visit platform.openai.com and sign in or create an account.' },
            { title: 'Navigate to API Keys', detail: 'Go to Settings → API Keys (or visit platform.openai.com/api-keys directly).' },
            { title: 'Create a new API Key', detail: 'Click "Create new secret key", name it, and copy the key immediately (it won\'t be shown again).' },
            { title: 'Add billing', detail: 'Go to Settings → Billing and add a payment method. API usage is pay-as-you-go.' },
        ],
        tips: [
            'Store your API key securely — it grants access to your account.',
            'Set usage limits in Settings → Limits to control spending.',
        ],
        url: 'https://platform.openai.com/api-keys',
        urlLabel: 'Open OpenAI Platform',
    },
    gemini: {
        title: '✨ Google Gemini API Setup Guide',
        description: 'Connect to Gemini models for AI-powered content generation.',
        steps: [
            { title: 'Go to Google AI Studio', detail: 'Visit aistudio.google.com and sign in with your Google account.' },
            { title: 'Create an API Key', detail: 'Click "Get API Key" → "Create API Key in new project" (or select existing).' },
            { title: 'Copy the Key', detail: 'Copy the generated API key and paste it below.' },
        ],
        tips: [
            'Gemini API has a free tier with generous limits.',
            'For production use, enable billing on your Google Cloud project.',
        ],
        url: 'https://aistudio.google.com/apikey',
        urlLabel: 'Open Google AI Studio',
    },
    google_oauth: {
        title: '🔵 Google OAuth Setup / Cài Đặt Google Sign-In',
        description: 'Google OAuth 2.0 for "Sign in with Google" on the login page. Users can register and log in without a password.',
        steps: [
            { title: 'Go to Google Cloud Console', detail: 'Visit console.cloud.google.com and select or create a project.' },
            { title: 'Enable OAuth consent screen', detail: 'Go to APIs & Services → OAuth consent screen. Set User Type to External, fill in app name, support email.' },
            { title: 'Create OAuth 2.0 Credentials', detail: 'Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID. Application type: Web application.' },
            { title: 'Add Authorized Redirect URI', detail: 'Under "Authorized redirect URIs", add:\n{YOUR_DOMAIN}/api/auth/callback/google' },
            { title: 'Copy credentials', detail: 'Copy the Client ID and paste it in the "OAuth Client ID" field below. Copy Client Secret and paste in the "OAuth Client Secret" field.' },
        ],
        tips: [
            'The redirect URI must match exactly: {YOUR_DOMAIN}/api/auth/callback/google',
            'After saving, restart the server for changes to take effect.',
            'New users signing in with Google will automatically receive a Free Plan.',
        ],
        url: 'https://console.cloud.google.com/apis/credentials',
        urlLabel: 'Open Google Cloud Console',
    },
    zalo: {
        title: '💬 Zalo OA API Setup Guide / Hướng Dẫn Cài Đặt Zalo OA',
        description: 'Connect Zalo Official Account for webhook notifications via OAuth login.\nKết nối Zalo Official Account để gửi thông báo webhook qua đăng nhập OAuth.',
        steps: [
            { title: 'Step 1: Go to Zalo Developers / Vào Zalo Developers', detail: 'Visit developers.zalo.me → sign in with your Zalo account → create a new application.\n\nTruy cập developers.zalo.me → đăng nhập bằng tài khoản Zalo → tạo ứng dụng mới.' },
            { title: 'Step 2: Get App ID / Lấy App ID', detail: 'In your app settings, copy the "App ID" and paste it in the field below.\n\nTrong cài đặt ứng dụng, copy "App ID" và dán vào ô bên dưới.' },
            { title: 'Step 3: Get Secret Key / Lấy Secret Key', detail: 'Find the "Application\'s private key" (Secret Key) in your app settings. Copy and paste it below.\n\nTìm "Application\'s private key" (Secret Key) trong cài đặt ứng dụng. Copy và dán bên dưới.' },
            { title: 'Step 4: Configure Callback URL / Cấu hình Callback URL', detail: 'In your Zalo app settings, add the callback URL:\n{YOUR_DOMAIN}/api/oauth/zalo/callback\n\nTrong cài đặt Zalo app, thêm callback URL:\n{YOUR_DOMAIN}/api/oauth/zalo/callback' },
            { title: 'Step 5: Link OA / Liên kết OA', detail: 'Go to Channel Settings → Zalo OA section → click "Connect Zalo OA".\nYou will be redirected to log in via Zalo and authorize your OA.\n\nVào Channel Settings → phần Zalo OA → nhấn "Connect Zalo OA".\nBạn sẽ được chuyển sang đăng nhập Zalo và cấp quyền cho OA.' },
        ],
        tips: [
            '✅ Callback URL: {YOUR_DOMAIN}/api/oauth/zalo/callback',
            '⚠️ Access tokens expire after ~25 hours — the system auto-refreshes them',
            '⚠️ Refresh tokens are valid for 3 months — reconnect before expiry',
            '💡 After saving App ID + Secret here, go to each Channel to connect the OA',
        ],
        url: 'https://developers.zalo.me/',
        urlLabel: 'Open Zalo Developer Portal',
    },
    r2: {
        title: '☁️ Cloudflare R2 Storage Setup Guide / Hướng Dẫn Cài Đặt Cloudflare R2',
        description: 'Store media files on Cloudflare R2 for fast, direct access. No proxy needed — platforms download directly.\nLưu trữ media trên Cloudflare R2, tải trực tiếp và nhanh. Không cần proxy.',
        steps: [
            { title: 'Step 1: Create Cloudflare Account / Tạo tài khoản Cloudflare', detail: 'Go to dash.cloudflare.com → Sign up (free) or sign in.\n\nVào dash.cloudflare.com → Đăng ký (miễn phí) hoặc đăng nhập.' },
            { title: 'Step 2: Create R2 Bucket / Tạo R2 Bucket', detail: 'In sidebar → R2 Object Storage → "Create bucket".\nBucket name: e.g. `neeflow-media` (lowercase, no spaces).\nLocation: Auto or choose nearest region.\n\nMenu bên trái → R2 Object Storage → "Create bucket".\nTên bucket: ví dụ `neeflow-media` (chữ thường, không dấu cách).\nVị trí: Auto hoặc chọn vùng gần nhất.' },
            { title: 'Step 3: Enable Public Access / Bật Public Access', detail: 'In your bucket → Settings → "Public Access".\nOption A: Enable "R2.dev subdomain" → you get a URL like `pub-xxxx.r2.dev`\nOption B: Add "Custom Domain" (e.g. `media.yoursite.com`) → recommended for production.\n\nTrong bucket → Settings → "Public Access".\nCách A: Bật "R2.dev subdomain" → URL dạng `pub-xxxx.r2.dev`\nCách B: Thêm "Custom Domain" (ví dụ `media.yoursite.com`) → khuyến nghị cho production.' },
            { title: 'Step 4: Create API Token / Tạo API Token', detail: 'Go to R2 Overview → "Manage R2 API Tokens" → "Create API Token".\nPermissions: "Object Read & Write" → select your bucket.\nCopy "Access Key ID" and "Secret Access Key".\n\nVào R2 Overview → "Manage R2 API Tokens" → "Create API Token".\nQuyền: "Object Read & Write" → chọn bucket.\nCopy "Access Key ID" và "Secret Access Key".' },
            { title: 'Step 5: Get Account ID / Lấy Account ID', detail: 'In Cloudflare Dashboard → right sidebar or URL bar → copy your Account ID (32-char hex).\n\nTrong Cloudflare Dashboard → thanh bên phải hoặc URL → copy Account ID (32 ký tự hex).' },
            { title: 'Step 6: Fill in Below / Điền vào bên dưới', detail: 'Paste all 5 values into the fields below:\n• Account ID\n• Bucket Name\n• Public URL (from Step 3)\n• Access Key ID\n• Secret Access Key\nClick Save.\n\nDán 5 giá trị vào các ô bên dưới:\n• Account ID\n• Bucket Name\n• Public URL (từ Bước 3)\n• Access Key ID\n• Secret Access Key\nNhấn Save.' },
        ],
        tips: [
            '✅ Free tier: 10GB storage + 10 million requests/month',
            '✅ Egress (bandwidth) is FREE — no download fees / Bandwidth tải xuống MIỄN PHÍ',
            '✅ S3-compatible — works like AWS S3 / Tương thích S3',
            '💡 Custom domain recommended for production — better than r2.dev subdomain',
            '💡 CORS: Add your domain in bucket Settings → CORS if needed',
            '⚠️ Keep your Secret Access Key safe — it grants full bucket access / Giữ Secret Key an toàn',
        ],
        url: 'https://dash.cloudflare.com/?to=/:account/r2/overview',
        urlLabel: 'Open Cloudflare R2 Dashboard',
    },
    shopify: {
        title: '🛍️ Shopify OAuth App Setup Guide',
        description: 'Allow users to connect their Shopify stores via OAuth for catalog sync and inventory management.',
        steps: [
            { title: 'Go to Shopify Partners', detail: 'Visit partners.shopify.com → log in → click "Apps" in the top nav.' },
            { title: 'Create a new app', detail: 'Click "Create app" → "Create app manually" → give it a name (e.g. Neeflow).' },
            { title: 'Set App URL & Redirect URL', detail: 'App URL: https://neeflow.com/\nAllowed redirect URL:\n{YOUR_DOMAIN}/api/integrations/shopify/oauth/callback' },
            { title: 'Set Scopes', detail: 'Go to Configuration → Optional scopes and add:\n• read_products\n• read_inventory' },
            { title: 'Copy Client ID & Secret', detail: 'Go to Overview tab → copy the "Client ID" and "Client secret" → paste them below.' },
            { title: 'Release a version', detail: 'Go to Versions → click "Release" on the latest version to make the app available.' },
        ],
        tips: [
            '✅ Redirect URL: {YOUR_DOMAIN}/api/integrations/shopify/oauth/callback',
            '✅ Scopes: read_products, read_inventory',
            '⚠️ After saving here, users can connect from Neeflow → Integrations → Shopify',
            '💡 Each Shopify store owner must consent — OAuth grants per-store access tokens',
        ],
        url: 'https://partners.shopify.com/',
        urlLabel: 'Open Shopify Partners',
    },
    etsy: {
        title: '🧶 Etsy OAuth App Setup Guide',
        description: 'Allow users to connect their Etsy shops via OAuth 2.0 PKCE for listing sync and AI post creation.',
        steps: [
            { title: 'Create an Etsy Developer Account', detail: 'Visit etsy.com/developers → sign in → create a new app.' },
            { title: 'Configure your App', detail: 'App Name: Neeflow (or your brand)\nApp Scopes: listings_r shops_r\nCallback URL:\n{YOUR_DOMAIN}/api/integrations/etsy/oauth/callback' },
            { title: 'Copy App Credentials', detail: 'From the app detail page, copy the "Keystring" (Client ID) and "Shared Secret" (Client Secret) → paste them below.' },
            { title: 'Save & Test', detail: 'Paste both values below and save. Then have a user go to Integrations → Etsy and click "Connect with Etsy".' },
        ],
        tips: [
            '✅ Callback URL: {YOUR_DOMAIN}/api/integrations/etsy/oauth/callback',
            '✅ Required scopes: listings_r, shops_r',
            '✅ This uses OAuth 2.0 PKCE — no client secret is sent to the browser',
            '⚠️ After saving here, users can connect from Neeflow → Integrations → Etsy',
            '💡 One Etsy Developer app serves all users — each user authorizes their own shop',
        ],
        url: 'https://www.etsy.com/developers/register',
        urlLabel: 'Open Etsy Developer Portal',
    },
    whatsapp: {
        title: '💬 WhatsApp Business API Setup Guide / Hướng Dẫn Cài Đặt WhatsApp Business',
        description: 'Connect WhatsApp Business to receive and reply to customer messages directly in Inbox.\nKết nối WhatsApp Business để nhận và trả lời tin nhắn khách hàng trong Inbox.',
        steps: [
            { title: 'Step 1: Go to Meta for Developers / Vào Meta for Developers', detail: 'Visit developers.facebook.com → click "My Apps" → "Create App" → choose "Business" type.\n\nTruy cập developers.facebook.com → nhấn "My Apps" → "Create App" → chọn loại "Business".' },
            { title: 'Step 2: Add WhatsApp Product / Thêm WhatsApp Product', detail: 'In App Dashboard → left sidebar → "Add Product" → find "WhatsApp" → click "Set Up".\n\nTrong App Dashboard → menu bên trái → "Add Product" → tìm "WhatsApp" → nhấn "Set Up".' },
            { title: 'Step 3: Get Phone Number ID / Lấy Phone Number ID', detail: 'In WhatsApp → Getting Started → copy the "Phone Number ID" (not the phone number itself). Paste it below.\n\nTrong WhatsApp → Getting Started → copy "Phone Number ID" (không phải số điện thoại). Dán vào ô bên dưới.' },
            { title: 'Step 4: Get WhatsApp Business Account ID / Lấy WABA ID', detail: 'On the same page, copy the "WhatsApp Business Account ID" (WABA ID). Paste it below.\n\nTrên cùng trang, copy "WhatsApp Business Account ID" (WABA ID). Dán vào ô bên dưới.' },
            { title: 'Step 5: Generate a System Token / Tạo System Token', detail: 'Go to Meta Business Suite → Business Settings → System Users → Add System User.\nAssign assets (your WABA), generate a token with whatsapp_business_messaging permission.\nCopy the token and paste below as the API Key.\n\nVào Meta Business Suite → Business Settings → System Users → Thêm System User.\nGán tài sản (WABA), tạo token với quyền whatsapp_business_messaging.\nCopy token và dán vào ô API Key bên dưới.' },
            { title: 'Step 6: Set Webhook / Cấu hình Webhook', detail: 'In API Setup → Webhooks → Configure. Set:\nCallback URL: {YOUR_DOMAIN}/api/webhook/whatsapp\nVerify Token: (any string — save it as WHATSAPP_VERIFY_TOKEN in .env)\nSubscribe to: messages\n\nTrong API Setup → Webhooks → Configure. Điền:\nCallback URL: {YOUR_DOMAIN}/api/webhook/whatsapp\nVerify Token: (chuỗi bất kỳ — lưu vào .env là WHATSAPP_VERIFY_TOKEN)\nĐăng ký: messages' },
        ],
        tips: [
            '✅ Webhook URL: {YOUR_DOMAIN}/api/webhook/whatsapp',
            '✅ Required permission: whatsapp_business_messaging',
            '⚠️ Free tier: 1,000 user-initiated conversations/month',
            '💡 Use System User token for stable long-lived access',
            '💡 After saving here, users connect WhatsApp from Channel → Integrations tab',
        ],
        url: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
        urlLabel: 'Open WhatsApp Cloud API Docs',
    },
}

export default function IntegrationsPage() {
    const branding = useBranding()
    const t = useTranslation()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [integrations, setIntegrations] = useState<Integration[]>([])
    const [loading, setLoading] = useState(true)
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
    const [saving, setSaving] = useState<Record<string, boolean>>({})
    const [testing, setTesting] = useState<Record<string, boolean>>({})
    const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
    const [models, setModels] = useState<Record<string, ModelInfo[]>>({})
    const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({})
    const [selectedModels, setSelectedModels] = useState<Record<string, Record<string, string>>>({})
    const [smtpConfigs, setSmtpConfigs] = useState<Record<string, SmtpConfig>>({})
    const [gdriveConfigs, setGdriveConfigs] = useState<Record<string, GDriveConfig>>({})
    const [r2Configs, setR2Configs] = useState<Record<string, R2Config>>({})
    const [oauthConfigs, setOauthConfigs] = useState<Record<string, OAuthConfig>>({})
    const [testEmails, setTestEmails] = useState<Record<string, string>>({})
    const [showGuide, setShowGuide] = useState<Record<string, boolean>>({})
    const [folderName, setFolderName] = useState('')
    const [creatingFolder, setCreatingFolder] = useState(false)
    const [stripeConfigs, setStripeConfigs] = useState<Record<string, StripeConfig>>({})
    const [recaptchaSiteKeys, setRecaptchaSiteKeys] = useState<Record<string, string>>({})

    // Handle Google Drive OAuth callback
    useEffect(() => {
        const gdriveStatus = searchParams.get('gdrive')
        if (gdriveStatus === 'connected') {
            toast.success('Google Drive connected successfully!')
            router.replace('/admin/integrations')
            fetchIntegrations()
        } else if (gdriveStatus === 'error') {
            const message = searchParams.get('message') || 'Connection failed'
            toast.error(`Google Drive: ${message}`)
            router.replace('/admin/integrations')
        }
    }, [searchParams, router])

    const fetchIntegrations = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/integrations')
            const data = await res.json()
            setIntegrations(data)

            // Initialize selected models, SMTP config, and GDrive config from config
            const modelSelections: Record<string, Record<string, string>> = {}
            const smtpConfigMap: Record<string, SmtpConfig> = {}
            const gdriveConfigMap: Record<string, GDriveConfig> = {}
            const r2ConfigMap: Record<string, R2Config> = {}
            const oauthConfigMap: Record<string, OAuthConfig> = {}
            const stripeConfigMap: Record<string, StripeConfig> = {}
            for (const i of data) {
                const config = (i.config || {}) as Record<string, string>
                modelSelections[i.id] = {
                    text: config.defaultTextModel || '',
                    image: config.defaultImageModel || '',
                    video: config.defaultVideoModel || '',
                }
                if (i.provider === 'smtp') {
                    smtpConfigMap[i.id] = {
                        host: config.smtpHost || 'smtp.gmail.com',
                        port: config.smtpPort || '465',
                        secure: config.smtpSecure || 'ssl',
                        username: config.smtpUsername || '',
                        password: '',
                        from: config.smtpFrom || '',
                    }
                }
                if (i.provider === 'google_oauth') {
                    oauthConfigMap[i.id] = {
                        clientId: config.clientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'gdrive') {
                    gdriveConfigMap[i.id] = {
                        clientId: config.gdriveClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'r2') {
                    r2ConfigMap[i.id] = {
                        accountId: config.r2AccountId || '',
                        bucketName: config.r2BucketName || '',
                        publicUrl: config.r2PublicUrl || '',
                        accessKeyId: '',
                        secretAccessKey: '',
                    }
                }
                if (i.provider === 'youtube') {
                    oauthConfigMap[i.id] = {
                        clientId: config.youtubeClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'tiktok') {
                    oauthConfigMap[i.id] = {
                        clientId: config.tiktokClientKey || '',
                        clientSecret: '',
                        sandbox: config.tiktokSandbox === 'true' ? 'true' : '',
                    }
                }
                if (i.provider === 'facebook') {
                    oauthConfigMap[i.id] = {
                        clientId: config.facebookClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'instagram') {
                    oauthConfigMap[i.id] = {
                        clientId: config.instagramClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'linkedin') {
                    oauthConfigMap[i.id] = {
                        clientId: config.linkedinClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'x') {
                    oauthConfigMap[i.id] = {
                        clientId: config.xClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'pinterest') {
                    oauthConfigMap[i.id] = {
                        clientId: config.pinterestClientId || '',
                        clientSecret: '',
                        sandbox: config.pinterestSandbox === 'true' || config.pinterestSandbox === '1' ? 'true' : '',
                    }
                }
                if (i.provider === 'threads') {
                    oauthConfigMap[i.id] = {
                        clientId: config.threadsClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'gbp') {
                    oauthConfigMap[i.id] = {
                        clientId: config.gbpClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'canva') {
                    oauthConfigMap[i.id] = {
                        clientId: config.canvaClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'zalo') {
                    oauthConfigMap[i.id] = {
                        clientId: config.zaloAppId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'whatsapp') {
                    oauthConfigMap[i.id] = {
                        clientId: config.whatsappPhoneNumberId || '',
                        clientSecret: config.whatsappBusinessAccountId || '',
                    }
                }
                if (i.provider === 'shopify') {
                    oauthConfigMap[i.id] = {
                        clientId: config.shopifyClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'etsy') {
                    oauthConfigMap[i.id] = {
                        clientId: config.etsyClientId || '',
                        clientSecret: '',
                    }
                }
                if (i.provider === 'stripe') {
                    stripeConfigMap[i.id] = {
                        publishableKey: config.publishableKey || '',
                        webhookSecret: '',
                    }
                }
            }
            setSelectedModels(modelSelections)
            setSmtpConfigs(smtpConfigMap)
            setGdriveConfigs(gdriveConfigMap)
            setR2Configs(r2ConfigMap)
            setOauthConfigs(oauthConfigMap)
            setStripeConfigs(stripeConfigMap)

            // Init reCAPTCHA site keys
            const rKeys: Record<string, string> = {}
            for (const i of data) {
                if (i.provider === 'recaptcha') {
                    rKeys[i.id] = ((i.config || {}) as Record<string, string>).siteKey || ''
                }
            }
            setRecaptchaSiteKeys(rKeys)
        } catch {
            toast.error('Failed to load integrations')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        // Auto-seed missing integrations (e.g. google_oauth, canva) then fetch
        const init = async () => {
            try { await fetch('/api/admin/integrations/seed', { method: 'POST' }) } catch { /* */ }
            fetchIntegrations()
        }
        init()
    }, [fetchIntegrations])

    const handleSave = async (integration: Integration) => {
        setSaving((s) => ({ ...s, [integration.id]: true }))
        try {
            const body: Record<string, unknown> = { id: integration.id }

            if (apiKeys[integration.id] !== undefined && apiKeys[integration.id] !== '') {
                body.apiKey = apiKeys[integration.id]
            }

            // SMTP config
            if (integration.provider === 'smtp') {
                const smtp = smtpConfigs[integration.id]
                if (smtp) {
                    body.config = {
                        smtpHost: smtp.host,
                        smtpPort: smtp.port,
                        smtpSecure: smtp.secure,
                        smtpUsername: smtp.username,
                        smtpFrom: smtp.from || smtp.username,
                    }
                    // Use SMTP password as the "API key" for encrypted storage
                    if (smtp.password) {
                        body.apiKey = smtp.password
                    }
                }
            }

            // Google Drive OAuth2 config
            if (integration.provider === 'gdrive') {
                const gdrive = gdriveConfigs[integration.id]
                if (gdrive) {
                    body.config = {
                        gdriveClientId: gdrive.clientId,
                    }
                    // Store Client Secret encrypted as the "API key"
                    if (gdrive.clientSecret) {
                        body.apiKey = gdrive.clientSecret
                    }
                }
            }

            // Cloudflare R2 config
            if (integration.provider === 'r2') {
                const r2 = r2Configs[integration.id]
                if (r2) {
                    body.config = {
                        r2AccountId: r2.accountId,
                        r2BucketName: r2.bucketName,
                        r2PublicUrl: r2.publicUrl,
                        ...(r2.secretAccessKey ? { r2SecretAccessKey: r2.secretAccessKey } : {}),
                    }
                    // Access Key ID stored encrypted as the "API key"
                    if (r2.accessKeyId) {
                        body.apiKey = r2.accessKeyId
                    }
                }
            }

            // YouTube OAuth config
            if (integration.provider === 'youtube') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = {
                        youtubeClientId: oauth.clientId,
                    }
                    if (oauth.clientSecret) {
                        body.apiKey = oauth.clientSecret
                    }
                }
            }

            // TikTok OAuth config
            if (integration.provider === 'tiktok') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = {
                        tiktokClientKey: oauth.clientId,
                        tiktokSandbox: oauth.sandbox === 'true' ? 'true' : 'false',
                    }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Facebook OAuth config
            if (integration.provider === 'facebook') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { facebookClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Instagram OAuth config
            if (integration.provider === 'instagram') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { instagramClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // LinkedIn OAuth config
            if (integration.provider === 'linkedin') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { linkedinClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // X (Twitter) OAuth config
            if (integration.provider === 'x') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { xClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Pinterest OAuth config
            if (integration.provider === 'pinterest') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = {
                        pinterestClientId: oauth.clientId,
                        pinterestSandbox: oauth.sandbox === 'true' ? 'true' : 'false',
                    }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Threads OAuth config
            if (integration.provider === 'threads') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { threadsClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // GBP OAuth config (uses shared GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
            if (integration.provider === 'gbp') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { gbpClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Google OAuth (Sign-In) config
            if (integration.provider === 'google_oauth') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { clientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Canva OAuth config
            if (integration.provider === 'canva') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { canvaClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Zalo OA OAuth config
            if (integration.provider === 'zalo') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { zaloAppId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Shopify OAuth app config
            if (integration.provider === 'shopify') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { shopifyClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // Etsy OAuth app config
            if (integration.provider === 'etsy') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = { etsyClientId: oauth.clientId }
                    if (oauth.clientSecret) body.apiKey = oauth.clientSecret
                }
            }

            // WhatsApp Business config
            if (integration.provider === 'whatsapp') {
                const oauth = oauthConfigs[integration.id]
                if (oauth) {
                    body.config = {
                        whatsappPhoneNumberId: oauth.clientId,
                        whatsappBusinessAccountId: oauth.clientSecret,
                    }
                    // System User Token stored as encrypted API key
                    if (apiKeys[integration.id]) body.apiKey = apiKeys[integration.id]
                }
            }

            // Stripe config
            if (integration.provider === 'stripe') {
                const sc = stripeConfigs[integration.id]
                if (sc) {
                    body.config = {
                        publishableKey: sc.publishableKey,
                        ...(sc.webhookSecret ? { webhookSecret: sc.webhookSecret } : {}),
                    }
                    // secret key is stored as apiKey (encrypted)
                }
            }

            // reCAPTCHA config
            if (integration.provider === 'recaptcha') {
                const sk = recaptchaSiteKeys[integration.id]
                if (sk) {
                    body.config = { siteKey: sk }
                }
            }

            // AI model selections
            const ms = selectedModels[integration.id]
            if (ms?.text) body.defaultTextModel = ms.text
            if (ms?.image) body.defaultImageModel = ms.image
            if (ms?.video) body.defaultVideoModel = ms.video

            const res = await fetch('/api/admin/integrations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (res.ok) {
                toast.success(`${integration.name} updated`)
                setApiKeys((k) => ({ ...k, [integration.id]: '' }))
                fetchIntegrations()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Failed to save')
            }
        } catch {
            toast.error('Failed to save')
        } finally {
            setSaving((s) => ({ ...s, [integration.id]: false }))
        }
    }

    const handleTest = async (integration: Integration) => {
        setTesting((t) => ({ ...t, [integration.id]: true }))
        setTestResults((r) => {
            const copy = { ...r }
            delete copy[integration.id]
            return copy
        })
        try {
            const res = await fetch('/api/admin/integrations/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: integration.id,
                    ...(integration.provider === 'smtp' && { testEmail: testEmails[integration.id] || '' }),
                }),
            })
            const result = await res.json()
            setTestResults((r) => ({ ...r, [integration.id]: result }))

            if (result.success) {
                toast.success(result.message)
                fetchIntegrations()
            } else {
                toast.error(result.message || 'Test failed')
            }
        } catch {
            toast.error('Connection test failed')
        } finally {
            setTesting((t) => ({ ...t, [integration.id]: false }))
        }
    }

    const handleFetchModels = async (integration: Integration) => {
        setLoadingModels((l) => ({ ...l, [integration.id]: true }))
        try {
            const res = await fetch('/api/admin/integrations/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: integration.id }),
            })
            const data = await res.json()
            if (data.models) {
                setModels((m) => ({ ...m, [integration.id]: data.models }))
                toast.success(`Loaded ${data.models.length} models`)
            } else {
                toast.error(data.error || 'Failed to load models')
            }
        } catch {
            toast.error('Failed to fetch models')
        } finally {
            setLoadingModels((l) => ({ ...l, [integration.id]: false }))
        }
    }

    // ---------- Handle creating a Google Drive folder ----------
    const handleCreateFolder = async () => {
        setCreatingFolder(true)
        try {
            const res = await fetch('/api/admin/gdrive/folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: folderName }),
            })
            const data = await res.json()
            if (data.success) {
                toast.success(`Folder "${data.folder.name}" created!`)
                setFolderName('')
                fetchIntegrations()
            } else {
                toast.error(data.error || 'Failed to create folder')
            }
        } catch {
            toast.error('Failed to create folder')
        } finally {
            setCreatingFolder(false)
        }
    }

    const grouped = integrations.reduce<Record<string, Integration[]>>((acc, i) => {
        acc[i.category] = acc[i.category] || []
        acc[i.category].push(i)
        return acc
    }, {})

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('integrations.title')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t('integrations.description')}
                    </p>
                </div>
                <Badge variant="outline" className="gap-1">
                    <Plug className="h-3 w-3" />
                    {integrations.filter((i) => i.hasApiKey).length}/{integrations.length} {t('common.configured')}
                </Badge>
            </div>

            {/* Integration Categories */}
            {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="space-y-4">
                    <div className="flex items-center gap-2">
                        {categoryIcons[category]}
                        <h2 className="text-xl font-semibold">
                            {t(`integrations.categories.${category}`) || category}
                        </h2>
                        <Badge variant="secondary" className="ml-2">
                            {items.filter((i) => i.hasApiKey).length}/{items.length}
                        </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {items.map((integration) => (
                            <IntegrationCard
                                key={integration.id}
                                integration={integration}
                                apiKey={apiKeys[integration.id] || ''}
                                showKey={showKeys[integration.id] || false}
                                isSaving={saving[integration.id] || false}
                                isTesting={testing[integration.id] || false}
                                testResult={testResults[integration.id]}
                                providerModels={models[integration.id] || []}
                                isLoadingModels={loadingModels[integration.id] || false}
                                selectedModel={selectedModels[integration.id] || {}}
                                smtpConfig={smtpConfigs[integration.id]}
                                gdriveConfig={gdriveConfigs[integration.id]}
                                showSetupGuide={showGuide[integration.id] || false}
                                onApiKeyChange={(val: string) => setApiKeys((k) => ({ ...k, [integration.id]: val }))}
                                onToggleShow={() => setShowKeys((s) => ({ ...s, [integration.id]: !s[integration.id] }))}
                                onSave={() => handleSave(integration)}
                                onTest={() => handleTest(integration)}
                                testEmail={testEmails[integration.id] || ''}
                                onTestEmailChange={(val: string) => setTestEmails((e) => ({ ...e, [integration.id]: val }))}
                                onFetchModels={() => handleFetchModels(integration)}
                                onModelSelect={(type: string, modelId: string) =>
                                    setSelectedModels((s) => ({
                                        ...s,
                                        [integration.id]: { ...s[integration.id], [type]: modelId },
                                    }))
                                }
                                onSmtpChange={(field: string, value: string) =>
                                    setSmtpConfigs((s) => ({
                                        ...s,
                                        [integration.id]: { ...s[integration.id], [field]: value },
                                    }))
                                }
                                onGdriveChange={(field: string, value: string) =>
                                    setGdriveConfigs((s) => ({
                                        ...s,
                                        [integration.id]: { ...s[integration.id], [field]: value },
                                    }))
                                }
                                r2Config={r2Configs[integration.id]}
                                onR2Change={(field: string, value: string) =>
                                    setR2Configs((s) => ({
                                        ...s,
                                        [integration.id]: { ...s[integration.id], [field]: value },
                                    }))
                                }
                                oauthConfig={oauthConfigs[integration.id]}
                                onOauthChange={(field: string, value: string) =>
                                    setOauthConfigs((s) => ({
                                        ...s,
                                        [integration.id]: { ...s[integration.id], [field]: value },
                                    }))
                                }
                                stripeConfig={stripeConfigs[integration.id]}
                                onStripeChange={(field: string, value: string) =>
                                    setStripeConfigs((s) => ({
                                        ...s,
                                        [integration.id]: { ...s[integration.id], [field]: value },
                                    }))
                                }
                                recaptchaSiteKey={recaptchaSiteKeys[integration.id] || ''}
                                onRecaptchaSiteKeyChange={(val: string) =>
                                    setRecaptchaSiteKeys((s) => ({
                                        ...s,
                                        [integration.id]: val,
                                    }))
                                }
                                folderName={folderName}
                                onFolderNameChange={(val: string) => setFolderName(val)}
                                onCreateFolder={handleCreateFolder}
                                isCreatingFolder={creatingFolder}
                                onToggleGuide={() => setShowGuide((s) => ({ ...s, [integration.id]: !s[integration.id] }))}
                            />
                        ))}
                    </div>

                    <Separator className="mt-6" />
                </div>
            ))}
        </div>
    )
}

interface SmtpConfig {
    host: string
    port: string
    secure: string
    username: string
    password: string
    from: string
}

interface GDriveConfig {
    clientId: string
    clientSecret: string
}

interface R2Config {
    accountId: string
    bucketName: string
    publicUrl: string
    accessKeyId: string
    secretAccessKey: string
}

interface OAuthConfig {
    clientId: string
    clientSecret: string
    sandbox?: string
}

interface StripeConfig {
    publishableKey: string
    webhookSecret: string
}

// ─── Pinterest Sandbox section ────────────────────────────────────────────────
function PinterestSandboxSection({
    oauthConfig,
    onOauthChange,
}: {
    oauthConfig: OAuthConfig | undefined
    onOauthChange: (field: string, value: string) => void
}) {
    const [sandboxToken, setSandboxToken] = useState('')
    const [applying, setApplying] = useState(false)
    const isSandbox = oauthConfig?.sandbox === 'true'

    const handleApply = async () => {
        if (!sandboxToken.trim()) return
        setApplying(true)
        try {
            const res = await fetch('/api/admin/integrations/pinterest-sandbox-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sandboxToken: sandboxToken.trim() }),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(`✅ Sandbox token applied to ${data.updated} channel(s) — expires in ~55 min`)
                setSandboxToken('')
            } else {
                toast.error(data.error || 'Failed to apply sandbox token')
            }
        } catch {
            toast.error('Failed to apply sandbox token')
        } finally {
            setApplying(false)
        }
    }

    return (
        <div className="pt-2 border-t border-dashed space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={isSandbox}
                    onChange={(e) => onOauthChange('sandbox', e.target.checked ? 'true' : '')}
                    className="h-3.5 w-3.5 rounded border-white/20 accent-orange-500"
                />
                <span className="text-[11px] font-medium text-orange-500">
                    🏖️ Sandbox Mode (Trial apps — uses api-sandbox.pinterest.com)
                </span>
            </label>

            {isSandbox && (
                <div className="ml-5 space-y-2 rounded-md border border-orange-500/40 bg-orange-500/5 p-2.5">
                    <p className="text-[10px] text-gray-300">
                        ⏱ Sandbox tokens expire in ~1 hour. Go to <strong className="text-white">Pinterest Dev Portal → your app → Generate Access Tokens</strong> and paste below.
                    </p>
                    <textarea
                        placeholder="Paste sandbox access token here (pina_...)"
                        value={sandboxToken}
                        onChange={(e) => setSandboxToken(e.target.value)}
                        rows={3}
                        className="w-full text-[11px] font-mono rounded-md border border-orange-400 bg-zinc-900 px-2 py-1.5 text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                    <button
                        onClick={handleApply}
                        disabled={applying || !sandboxToken.trim()}
                        className="w-full text-[11px] font-semibold rounded-md bg-orange-500 hover:bg-orange-600 text-white py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {applying ? '⏳ Applying…' : '🔑 Apply Sandbox Token to All Channels'}
                    </button>
                    <p className="text-[9px] text-gray-500">
                        This updates the access token for all channels that have Pinterest connected.
                    </p>
                </div>
            )}
        </div>
    )
}

function IntegrationCard({
    integration,
    apiKey,
    showKey,
    isSaving,
    isTesting,
    testResult,
    providerModels,
    isLoadingModels,
    selectedModel,
    smtpConfig,
    gdriveConfig,
    showSetupGuide,
    onApiKeyChange,
    onToggleShow,
    onSave,
    onTest,
    testEmail,
    onTestEmailChange,
    onFetchModels,
    onModelSelect,
    onSmtpChange,
    onGdriveChange,
    r2Config,
    onR2Change,
    oauthConfig,
    onOauthChange,
    stripeConfig,
    onStripeChange,
    recaptchaSiteKey,
    onRecaptchaSiteKeyChange,
    folderName,
    onFolderNameChange,
    onCreateFolder,
    isCreatingFolder,
    onToggleGuide,
}: {
    integration: Integration
    apiKey: string
    showKey: boolean
    isSaving: boolean
    isTesting: boolean
    testResult?: { success: boolean; message: string }
    providerModels: ModelInfo[]
    isLoadingModels: boolean
    selectedModel: Record<string, string>
    smtpConfig?: SmtpConfig
    gdriveConfig?: GDriveConfig
    showSetupGuide: boolean
    onApiKeyChange: (val: string) => void
    onToggleShow: () => void
    onSave: () => void
    onTest: () => void
    testEmail: string
    onTestEmailChange: (value: string) => void
    onFetchModels: () => void
    onModelSelect: (type: string, modelId: string) => void
    onSmtpChange: (field: string, value: string) => void
    onGdriveChange: (field: string, value: string) => void
    r2Config?: R2Config
    onR2Change: (field: string, value: string) => void
    oauthConfig?: OAuthConfig
    onOauthChange: (field: string, value: string) => void
    stripeConfig?: StripeConfig
    onStripeChange: (field: string, value: string) => void
    recaptchaSiteKey: string
    onRecaptchaSiteKeyChange: (value: string) => void
    folderName: string
    onFolderNameChange: (value: string) => void
    onCreateFolder: () => void
    isCreatingFolder: boolean
    onToggleGuide: () => void
}) {
    const t = useTranslation()
    const isAI = integration.category === 'AI'
    const isSMTP = integration.provider === 'smtp'
    const isGDrive = integration.provider === 'gdrive'
    const isR2 = integration.provider === 'r2'
    const isStripe = integration.provider === 'stripe'
    const isOAuth = ['youtube', 'tiktok', 'facebook', 'instagram', 'linkedin', 'x', 'pinterest', 'canva', 'google_oauth', 'threads', 'gbp', 'zalo', 'shopify', 'etsy', 'whatsapp'].includes(integration.provider)
    const textModels = providerModels.filter((m) => m.type === 'text')
    const imageModels = providerModels.filter((m) => m.type === 'image')
    const videoModels = providerModels.filter((m) => m.type === 'video')
    const hasModels = providerModels.length > 0
    const guideUrl = providerGuideUrls[integration.provider]
    const guideKey = `guides.${integration.provider}`

    return (
        <Card className={`relative transition-all hover:shadow-md ${providerColors[integration.provider] || ''} border`}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        {integration.isDefault && (
                            <Badge variant="outline" className="text-[10px] px-1.5">
                                Default
                            </Badge>
                        )}
                    </div>
                    <StatusBadge
                        status={integration.status}
                        hasKey={integration.hasApiKey}
                    />
                </div>
                <CardDescription className="text-xs">
                    {integration.baseUrl || `${integration.provider} integration`}
                    {integration.lastTestedAt && (
                        <span className="ml-1">
                            • Tested {new Date(integration.lastTestedAt).toLocaleDateString()}
                        </span>
                    )}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Setup Guide Modal */}
                {guideUrl && (
                    <div>
                        <button
                            type="button"
                            onClick={onToggleGuide}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                            <Info className="h-3.5 w-3.5" />
                            <span>{showSetupGuide ? t('integrations.hideGuide') : t('integrations.setupGuide')}</span>
                        </button>

                        {(() => {
                            const guide = platformGuides[integration.provider]
                            if (!guide) return null
                            const domain = typeof window !== 'undefined' ? window.location.origin : '{YOUR_DOMAIN}'
                            const resolveText = (text: string) => text.replace(/\{YOUR_DOMAIN\}/g, domain)
                            return (
                                <Dialog open={showSetupGuide} onOpenChange={onToggleGuide}>
                                    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl">{guide.title}</DialogTitle>
                                            <p className="text-sm text-muted-foreground mt-1">{guide.description}</p>
                                        </DialogHeader>

                                        <div className="space-y-3 mt-4">
                                            {guide.steps.map((step, i) => (
                                                <div key={i} className="flex gap-3">
                                                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex-1 pt-0.5">
                                                        <p className="text-sm font-medium">{step.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed whitespace-pre-line">{resolveText(step.detail)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {guide.tips && guide.tips.length > 0 && (
                                            <div className="mt-5 rounded-lg border border-dashed p-3 bg-muted/30">
                                                <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                                                    <Zap className="h-3.5 w-3.5 text-yellow-500" />
                                                    Pro Tips
                                                </p>
                                                <ul className="space-y-1.5">
                                                    {guide.tips.map((tip, i) => (
                                                        <li key={i} className="text-[11px] text-muted-foreground flex gap-2">
                                                            <span className="text-yellow-500 mt-0.5">•</span>
                                                            <span>{resolveText(tip)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="mt-4 flex justify-between items-center">
                                            <a
                                                href={guide.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                {guide.urlLabel}
                                            </a>
                                            <Button variant="outline" size="sm" onClick={onToggleGuide}>
                                                {t('common.close') || 'Close'}
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            )
                        })()}
                    </div>
                )}

                {/* Stripe Config */}
                {isStripe && stripeConfig ? (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-[11px]">Secret Key (sk_live_ / sk_test_)</Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => onApiKeyChange(e.target.value)}
                                    placeholder={integration.hasApiKey ? '••••••••••••••••' : 'sk_live_xxxx'}
                                    className="pr-8 h-8 text-xs font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShow}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Stored encrypted. Used for API calls server-side.</p>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">Publishable Key (pk_live_ / pk_test_)</Label>
                            <Input
                                value={stripeConfig.publishableKey}
                                onChange={(e) => onStripeChange('publishableKey', e.target.value)}
                                placeholder="pk_live_xxxx"
                                className="h-8 text-xs font-mono"
                            />
                            <p className="text-[10px] text-muted-foreground">Stored in config, used on the client side (checkout).</p>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">Webhook Secret (whsec_)</Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    value={stripeConfig.webhookSecret}
                                    onChange={(e) => onStripeChange('webhookSecret', e.target.value)}
                                    placeholder="whsec_xxxx (leave blank to keep existing)"
                                    className="pr-8 h-8 text-xs font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShow}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">From Stripe Dashboard → Webhooks → Signing secret.</p>
                        </div>
                    </div>
                ) : null}

                {/* SMTP Config */}
                {isSMTP && smtpConfig ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[11px]">{t('integrations.smtpHost')}</Label>
                                <Input
                                    value={smtpConfig.host}
                                    onChange={(e) => onSmtpChange('host', e.target.value)}
                                    placeholder="smtp.gmail.com"
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px]">{t('integrations.smtpPort')}</Label>
                                <Input
                                    value={smtpConfig.port}
                                    onChange={(e) => onSmtpChange('port', e.target.value)}
                                    placeholder="465"
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">{t('integrations.smtpSecurity')}</Label>
                            <Select
                                value={smtpConfig.secure}
                                onValueChange={(v) => onSmtpChange('secure', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ssl">{t('integrations.sslPort465')}</SelectItem>
                                    <SelectItem value="tls">{t('integrations.tlsPort587')}</SelectItem>
                                    <SelectItem value="none">{t('integrations.nonePort25')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">{t('integrations.smtpUsername')}</Label>
                            <Input
                                value={smtpConfig.username}
                                onChange={(e) => onSmtpChange('username', e.target.value)}
                                placeholder="your@gmail.com"
                                className="h-8 text-xs"
                                type="email"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">{t('integrations.smtpPassword')}</Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    value={smtpConfig.password}
                                    onChange={(e) => onSmtpChange('password', e.target.value)}
                                    placeholder={integration.hasApiKey ? '••••••••••••••••' : t('integrations.smtpAppPasswordPlaceholder')}
                                    className="pr-8 h-8 text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShow}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">{t('integrations.smtpFrom')}</Label>
                            <Input
                                value={smtpConfig.from}
                                onChange={(e) => onSmtpChange('from', e.target.value)}
                                placeholder="noreply@neeflow.com"
                                className="h-8 text-xs"
                                type="email"
                            />
                        </div>
                    </div>
                ) : isGDrive && gdriveConfig ? (
                    /* Google Drive OAuth2 Config */
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-[11px]">{t('integrations.gdriveClientId')}</Label>
                            <Input
                                value={gdriveConfig.clientId}
                                onChange={(e) => onGdriveChange('clientId', e.target.value)}
                                placeholder="xxxxx.apps.googleusercontent.com"
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">{t('integrations.gdriveClientSecret')}</Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    value={gdriveConfig.clientSecret || (showKey ? '' : (integration.apiKeyMasked || ''))}
                                    onChange={(e) => onGdriveChange('clientSecret', e.target.value)}
                                    placeholder={integration.hasApiKey ? '' : t('integrations.gdriveClientSecretPlaceholder')}
                                    className="pr-8 h-8 text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShow}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Connection Status & Folder Management */}
                        {(() => {
                            const config = integration.config as Record<string, string> | null
                            const isConnected = !!config?.gdriveEmail
                            const hasFolder = !!config?.parentFolderId

                            return (
                                <div className="space-y-3 pt-2 border-t border-dashed">
                                    {/* Connect Button or Connected Status */}
                                    {isConnected ? (
                                        <div className="flex items-center gap-2 text-xs">
                                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                                            <span className="text-emerald-600 font-medium">
                                                {t('integrations.gdriveConnected')}
                                            </span>
                                            <span className="text-muted-foreground truncate">
                                                ({config?.gdriveEmail})
                                            </span>
                                        </div>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full h-8 text-xs gap-1"
                                            onClick={() => {
                                                window.location.href = '/api/admin/gdrive/auth'
                                            }}
                                            disabled={!gdriveConfig?.clientId || !gdriveConfig?.clientSecret}
                                        >
                                            <Link className="h-3 w-3" />
                                            {t('integrations.gdriveConnect')}
                                        </Button>
                                    )}

                                    {/* Parent Folder Section */}
                                    {isConnected && (
                                        <div className="space-y-2">
                                            {hasFolder ? (
                                                <div className="rounded-md bg-emerald-500/10 p-2 text-xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <FolderPlus className="h-3.5 w-3.5 text-emerald-500" />
                                                        <span className="font-medium text-emerald-600">
                                                            {config?.parentFolderName || 'Parent Folder'}
                                                        </span>
                                                    </div>
                                                    <a
                                                        href={`https://drive.google.com/drive/folders/${config?.parentFolderId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        {t('integrations.gdriveOpenFolder')}
                                                    </a>
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <Label className="text-[11px]">
                                                        {t('integrations.gdriveFolderName')}
                                                    </Label>
                                                    <div className="flex gap-1.5">
                                                        <Input
                                                            value={folderName}
                                                            onChange={(e) => onFolderNameChange(e.target.value)}
                                                            placeholder={t('integrations.gdriveFolderPlaceholder')}
                                                            className="h-8 text-xs flex-1"
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-8 text-xs gap-1 whitespace-nowrap"
                                                            onClick={onCreateFolder}
                                                            disabled={isCreatingFolder || !folderName}
                                                        >
                                                            {isCreatingFolder ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <FolderPlus className="h-3 w-3" />
                                                            )}
                                                            {t('integrations.gdriveCreateFolder')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    </div>
                ) : isR2 && r2Config ? (
                    /* Cloudflare R2 Config */
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-[11px]">Account ID</Label>
                            <Input
                                value={r2Config.accountId}
                                onChange={(e) => onR2Change('accountId', e.target.value)}
                                placeholder="e.g. a1b2c3d4e5f6..."
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">Bucket Name</Label>
                            <Input
                                value={r2Config.bucketName}
                                onChange={(e) => onR2Change('bucketName', e.target.value)}
                                placeholder="e.g. neeflow-media"
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">Public URL</Label>
                            <Input
                                value={r2Config.publicUrl}
                                onChange={(e) => onR2Change('publicUrl', e.target.value)}
                                placeholder="e.g. https://pub-xxxx.r2.dev or https://media.yoursite.com"
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">Access Key ID</Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    value={r2Config.accessKeyId || (showKey ? '' : (integration.apiKeyMasked || ''))}
                                    onChange={(e) => onR2Change('accessKeyId', e.target.value)}
                                    placeholder={integration.hasApiKey ? '' : 'Access Key ID from R2 API Token'}
                                    className="pr-8 h-8 text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShow}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">Secret Access Key</Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    value={r2Config.secretAccessKey}
                                    onChange={(e) => onR2Change('secretAccessKey', e.target.value)}
                                    placeholder={integration.config?.r2HasSecret ? '••• configured — leave empty to keep •••' : 'Secret Access Key from R2 API Token'}
                                    className="pr-8 h-8 text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShow}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Status indicator */}
                        {(() => {
                            const config = integration.config as Record<string, string> | null
                            const isConfigured = !!config?.r2AccountId && !!config?.r2BucketName && !!config?.r2PublicUrl && integration.hasApiKey
                            return isConfigured ? (
                                <div className="flex items-center gap-2 text-xs pt-2 border-t border-dashed">
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-emerald-600 font-medium">
                                        R2 Connected
                                    </span>
                                    <span className="text-muted-foreground truncate">
                                        ({config?.r2BucketName})
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs pt-2 border-t border-dashed">
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-muted-foreground">
                                        Fill all fields above and click Save
                                    </span>
                                </div>
                            )
                        })()}
                    </div>
                ) : isOAuth && oauthConfig ? (
                    /* YouTube / TikTok OAuth2 Config */
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-[11px]">
                                {{
                                    youtube: 'Google Client ID', tiktok: 'TikTok Client Key',
                                    facebook: 'Facebook App ID', instagram: 'Instagram App ID',
                                    linkedin: 'LinkedIn Client ID', x: 'X Client ID',
                                    pinterest: 'Pinterest App ID',
                                    threads: 'Threads App ID',
                                    gbp: 'Google Client ID',
                                    zalo: 'Zalo App ID',
                                    shopify: 'Shopify Client ID (Keystring)',
                                    etsy: 'Etsy Keystring (Client ID)',
                                    whatsapp: 'Phone Number ID',
                                }[integration.provider] || 'Client ID'}
                            </Label>
                            <Input
                                value={oauthConfig.clientId}
                                onChange={(e) => onOauthChange('clientId', e.target.value)}
                                placeholder={'Enter Client ID / App ID'}
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px]">
                                {{
                                    youtube: 'Google Client Secret', tiktok: 'TikTok Client Secret',
                                    facebook: 'Facebook App Secret', instagram: 'Instagram App Secret',
                                    linkedin: 'LinkedIn Client Secret', x: 'X Client Secret',
                                    pinterest: 'Pinterest App Secret',
                                    threads: 'Threads App Secret',
                                    gbp: 'Google Client Secret',
                                    zalo: 'Zalo Secret Key',
                                    shopify: 'Shopify Client Secret',
                                    etsy: 'Etsy Shared Secret (Client Secret)',
                                    whatsapp: 'WhatsApp Business Account ID (WABA ID)',
                                }[integration.provider] || 'Client Secret'}
                            </Label>
                            <div className="relative">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    value={oauthConfig.clientSecret || (showKey ? '' : (integration.apiKeyMasked || ''))}
                                    onChange={(e) => onOauthChange('clientSecret', e.target.value)}
                                    placeholder={integration.hasApiKey ? '' : 'Enter client secret...'}
                                    className="pr-8 h-8 text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShow}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-dashed">
                            <p className="text-[11px] text-muted-foreground">
                                {{
                                    youtube: 'Create credentials at Google Cloud Console → APIs & Services → Credentials. Enable "YouTube Data API v3".',
                                    facebook: 'Go to developers.facebook.com → Create App → Business type. Add "Facebook Login" product. In Facebook Login → Settings, add your OAuth redirect URI. Under App Review, request permissions: pages_manage_posts, pages_read_engagement, pages_show_list.',
                                    instagram: 'Dùng CÙNG Facebook App. Thêm "Instagram Graph API" product. Instagram phải là Business/Creator account và liên kết với Facebook Page. Nếu đã setup Facebook rồi thì không cần nhập credentials — hệ thống tự dùng từ Facebook.',
                                    tiktok: 'Go to developers.tiktok.com → Create App. Enable "Login Kit" and "Content Posting API". Add your redirect URI under Login Kit settings. Submit for review.',
                                    linkedin: 'Go to linkedin.com/developers → Create App. Under Products tab, request "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect". Add your redirect URI under Auth settings.',
                                    x: 'Go to developer.x.com → Create Project & App. Set App permissions to "Read and Write". Enable OAuth 2.0, add your redirect URI. Note your Client ID and Client Secret from the "Keys and tokens" tab.',
                                    pinterest: 'Go to developers.pinterest.com → Create App. Request access to "pins:read", "pins:write", "boards:read", "boards:write" scopes. Add your redirect URI under App settings.',
                                    threads: 'Go to developers.facebook.com → Create App (Business type) → Add "Threads API" product → In Threads API Settings add Redirect URI: {YOUR_DOMAIN}/api/oauth/threads/callback. Copy App ID and App Secret from App Settings → Basic.',
                                    canva: 'Configure OAuth credentials for this platform.',
                                    zalo: 'Vào developers.zalo.me → tạo ứng dụng → copy App ID và Secret Key. Thêm callback URL: {YOUR_DOMAIN}/api/oauth/zalo/callback. Sau đó vào Channel Settings để kết nối OA.',
                                    shopify: 'Go to partners.shopify.com → Apps → Create app. Set Callback URL to {YOUR_DOMAIN}/api/integrations/shopify/oauth/callback. Required scopes: read_products, read_inventory. Copy Client ID (Keystring) and Client Secret.',
                                    etsy: 'Go to etsy.com/developers → Create App. Set Callback URL to {YOUR_DOMAIN}/api/integrations/etsy/oauth/callback. Required scopes: listings_r, shops_r. Copy the Keystring as Client ID and Shared Secret as Client Secret.',
                                    whatsapp: 'Go to developers.facebook.com → Create App (Business) → Add WhatsApp product. In Getting Started, copy the Phone Number ID and WhatsApp Business Account ID (WABA ID) from the fields above. Then go to Meta Business Suite → System Users to generate a System User Token with whatsapp_business_messaging permission — paste it in the API Key field below. Set Webhook: {YOUR_DOMAIN}/api/webhook/whatsapp',
                                }[integration.provider] || 'Configure OAuth credentials for this platform.'}
                            </p>
                        </div>

                        {/* WhatsApp System Token (API Key) */}
                        {integration.provider === 'whatsapp' && (
                            <div className="space-y-1 pt-2 border-t border-dashed">
                                <Label className="text-[11px]">System User Token (API Key)</Label>
                                <div className="relative">
                                    <Input
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey || ''}
                                        onChange={(e) => onApiKeyChange(e.target.value)}
                                        placeholder={integration.apiKeyMasked || 'EAAxxxxxxx...'}
                                        className="pr-8 h-8 text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={onToggleShow}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Generate from Meta Business Suite → System Users → whatsapp_business_messaging permission
                                </p>
                            </div>
                        )}

                        {/* Pinterest Sandbox toggle + token input */}
                        {integration.provider === 'pinterest' && (
                            <PinterestSandboxSection oauthConfig={oauthConfig} onOauthChange={onOauthChange} />
                        )}

                        {/* TikTok Sandbox toggle */}
                        {integration.provider === 'tiktok' && (
                            <div className="pt-2 border-t border-dashed">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={oauthConfig.sandbox === 'true'}
                                        onChange={(e) => onOauthChange('sandbox', e.target.checked ? 'true' : '')}
                                        className="h-3.5 w-3.5 rounded border-white/20 accent-amber-500"
                                    />
                                    <span className="text-[11px] text-amber-400">
                                        🏖️ Sandbox Mode — enable while recording demo videos, disable for production
                                    </span>
                                </label>
                                {oauthConfig.sandbox === 'true' && (
                                    <p className="mt-1 ml-5 text-[10px] text-amber-300/70">
                                        ⚠️ Sandbox uses sandbox.tiktokapis.com — posts only visible in TikTok Sandbox environment. Remember to save after toggling.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Canva Connect / Disconnect */}
                        {integration.provider === 'canva' && (() => {
                            const cfg = (integration.config || {}) as Record<string, string | null>
                            // Check how many users have connected
                            const connectedUsers = Object.keys(cfg).filter(k => k.startsWith('canvaToken_'))
                            const connectedUserNames = connectedUsers.map(k => {
                                const uid = k.replace('canvaToken_', '')
                                return cfg[`canvaUser_${uid}`] || 'Unknown User'
                            })
                            return (
                                <div className="pt-2 border-t border-dashed space-y-1.5">
                                    {connectedUsers.length > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full bg-green-500" />
                                            <span className="text-[11px] text-green-400">
                                                {connectedUsers.length} user(s) connected: {connectedUserNames.join(', ')}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 h-7 text-[11px] bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/20 text-violet-400 cursor-pointer"
                                            onClick={() => { window.location.href = '/api/oauth/canva' }}
                                            disabled={!oauthConfig?.clientId}
                                        >
                                            🎨 {connectedUsers.length > 0 ? 'Reconnect' : 'Connect'} Canva
                                        </Button>
                                        {connectedUsers.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[11px] px-3 text-red-400 border-red-400/30 hover:bg-red-500/10 cursor-pointer"
                                                onClick={async () => {
                                                    if (!confirm('Disconnect ALL Canva users? This will remove Canva access for everyone.')) return
                                                    try {
                                                        await fetch(`/api/admin/integrations/${integration.id}/canva-disconnect`, { method: 'POST' })
                                                        window.location.reload()
                                                    } catch { /* ignore */ }
                                                }}
                                            >
                                                Disconnect All
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Each user connects their own Canva account. Users can also connect directly from the Compose page.
                                    </p>
                                </div>
                            )
                        })()}
                    </div>
                ) : isStripe ? null : (
                    /* Standard API Key Input — hidden for Stripe (uses dedicated Secret Key above) */
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">{t('integrations.apiKey')}</Label>
                        <div className="flex gap-1.5">
                            <div className="relative flex-1">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    value={apiKey || ''}
                                    onChange={(e) => onApiKeyChange(e.target.value)}
                                    placeholder={integration.apiKeyMasked || t('integrations.enterApiKey')}
                                    className="pr-8 text-xs h-9"
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShow}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* reCAPTCHA Site Key */}
                {integration.provider === 'recaptcha' && (
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Site Key (Public)</Label>
                        <Input
                            type="text"
                            value={recaptchaSiteKey}
                            onChange={(e) => onRecaptchaSiteKeyChange(e.target.value)}
                            placeholder="6Lc..."
                            className="text-xs h-9 font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            From Google reCAPTCHA Admin → Settings → Site Key. The Secret Key goes in the API Key field above.
                        </p>
                    </div>
                )}

                {/* AI Model Selection */}
                {isAI && integration.hasApiKey && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">{t('integrations.defaultModels')}</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={onFetchModels}
                                disabled={isLoadingModels}
                            >
                                {isLoadingModels ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3 w-3" />
                                )}
                                {hasModels ? t('common.refresh') : t('integrations.fetchModels')}
                            </Button>
                        </div>

                        {hasModels && (
                            <ScrollArea className="max-h-48">
                                <div className="space-y-2">
                                    {textModels.length > 0 && (
                                        <ModelSelect
                                            label={t('integrations.textChat')}
                                            models={textModels}
                                            value={selectedModel?.text || ''}
                                            onChange={(v) => onModelSelect('text', v)}
                                        />
                                    )}
                                    {imageModels.length > 0 && (
                                        <ModelSelect
                                            label={t('integrations.image')}
                                            models={imageModels}
                                            value={selectedModel?.image || ''}
                                            onChange={(v) => onModelSelect('image', v)}
                                        />
                                    )}
                                    {videoModels.length > 0 && (
                                        <ModelSelect
                                            label={t('integrations.video')}
                                            models={videoModels}
                                            value={selectedModel?.video || ''}
                                            onChange={(v) => onModelSelect('video', v)}
                                        />
                                    )}
                                </div>
                            </ScrollArea>
                        )}

                        {!hasModels && !isLoadingModels && (
                            <p className="text-[11px] text-muted-foreground text-center py-1">
                                {t('integrations.clickFetchModels')}
                            </p>
                        )}

                    </div>
                )}

                {/* Test Result */}
                {testResult && (
                    <div
                        className={`rounded-md p-2 text-xs ${testResult.success
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-destructive/10 text-destructive'
                            }`}
                    >
                        {testResult.success ? <Check className="h-3 w-3 inline mr-1" /> : <X className="h-3 w-3 inline mr-1" />}
                        {testResult.message}
                    </div>
                )}

                {/* SMTP Test Email */}
                {isSMTP && (
                    <div className="space-y-1">
                        <Label className="text-[11px]">{t('integrations.testEmailLabel')}</Label>
                        <Input
                            type="email"
                            value={testEmail}
                            onChange={(e) => onTestEmailChange(e.target.value)}
                            placeholder={t('integrations.testEmailPlaceholder')}
                            className="h-8 text-xs"
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <Button
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1"
                        onClick={onSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        {t('common.save')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={onTest}
                        disabled={isTesting || (!integration.hasApiKey && !isSMTP)}
                    >
                        {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : isSMTP ? <Mail className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                        {isSMTP ? t('integrations.sendTest') : t('common.test')}
                    </Button>
                </div>
            </CardContent>
        </Card >
    )
}

function StatusBadge({ status, hasKey }: { status: string; hasKey: boolean }) {
    const t = useTranslation()
    if (!hasKey) {
        return (
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                {t('common.notConfigured')}
            </Badge>
        )
    }

    const variants: Record<string, string> = {
        ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
        ERROR: 'bg-destructive/10 text-destructive border-destructive/30',
        INACTIVE: 'bg-muted text-muted-foreground border-muted-foreground/30',
    }

    return (
        <Badge variant="outline" className={`text-[10px] ${variants[status] || variants.INACTIVE}`}>
            {status === 'ACTIVE' && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />}
            {status}
        </Badge>
    )
}

function ModelSelect({
    label,
    models,
    value,
    onChange,
}: {
    label: string
    models: ModelInfo[]
    value: string
    onChange: (value: string) => void
}) {
    const [search, setSearch] = useState('')
    const showSearch = models.length > 10
    const displayModels = search.trim()
        ? models.filter(
            (m) =>
                m.name.toLowerCase().includes(search.toLowerCase()) ||
                m.id.toLowerCase().includes(search.toLowerCase())
        )
        : models

    return (
        <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-16 shrink-0">{label}</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className={showSearch ? 'max-h-[300px]' : ''}>
                    {showSearch && (
                        <div className="sticky top-0 z-10 bg-popover px-2 pb-1.5 pt-1">
                            <input
                                className="w-full h-7 px-2 text-xs rounded-md border border-border bg-transparent outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                                placeholder="Search models..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                    {displayModels.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                            <span>{m.name}</span>
                            {m.description && (
                                <span className="ml-2 text-muted-foreground">— {m.description}</span>
                            )}
                        </SelectItem>
                    ))}
                    {displayModels.length === 0 && (
                        <div className="py-2 text-center text-xs text-muted-foreground">
                            No models found
                        </div>
                    )}
                </SelectContent>
            </Select>
        </div>
    )
}

