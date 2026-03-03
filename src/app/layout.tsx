import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { getBrandingServer } from '@/lib/use-branding-server'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandingServer()
  const name = brand.appName || 'NeeFlow'
  const tagline = brand.tagline || 'Social Media Management'
  const description = `${name} — AI-powered Social Media & Email Marketing Management Platform. Schedule posts, generate content with AI, and manage all your social accounts in one place.`
  const url = process.env.NEXTAUTH_URL || 'https://neeflow.com'

  return {
    title: {
      default: `${name} — ${tagline}`,
      template: `%s | ${name}`,
    },
    description,
    keywords: ['social media management', 'AI content generation', 'schedule posts', 'TikTok', 'Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'marketing automation'],
    authors: [{ name }],
    creator: name,
    metadataBase: new URL(url),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      siteName: name,
      title: `${name} — ${tagline}`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} — ${tagline}`,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    icons: {
      icon: brand.faviconUrl || '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    verification: {
      google: 'SeCWhzMMwoYXe4EHwX_-xvZbLQRBOThtMNlCssrtqQo',
    },
    other: {
      'facebook-domain-verification': '067n6haeldnqrdj5tizunolln4pzoe',
    },
  }
}


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const initialBranding = await getBrandingServer()
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Standard link rels — Google OAuth & search bots read these to find privacy/terms */}
        <link rel="privacy-policy" href="https://neeflow.com/privacy" />
        <link rel="terms-of-service" href="https://neeflow.com/terms" />
      </head>
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        <Providers initialBranding={initialBranding}>
          {/* Background ambient orb blobs — purple layout style */}
          <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none">
            <div className="absolute top-[8%] left-[15%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
            <div className="absolute bottom-[10%] right-[8%] w-[600px] h-[600px] rounded-full bg-primary/4 blur-[150px]" />
            <div className="absolute top-[45%] right-[25%] w-[300px] h-[300px] rounded-full bg-primary/3 blur-[100px]" />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  )
}
