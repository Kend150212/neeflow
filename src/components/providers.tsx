'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { SessionProvider } from 'next-auth/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/lib/i18n'
import { BrandingProvider, type BrandingSettings } from '@/lib/use-branding'
import { RecaptchaProvider } from '@/lib/use-recaptcha'
import { Session } from 'next-auth'
import { useState } from 'react'

export function Providers({ children, session, initialBranding }: { children: React.ReactNode; session?: Session | null; initialBranding?: BrandingSettings }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    )

    return (
        <SessionProvider session={session}>
            <QueryClientProvider client={queryClient}>
                <NextThemesProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <I18nProvider>
                        <BrandingProvider initialBranding={initialBranding}>
                            <TooltipProvider delayDuration={0}>
                                <RecaptchaProvider>
                                    {children}
                                </RecaptchaProvider>
                            </TooltipProvider>
                        </BrandingProvider>
                    </I18nProvider>
                </NextThemesProvider>
            </QueryClientProvider>
        </SessionProvider>
    )
}

