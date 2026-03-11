'use client'

import { BulkGenProvider } from '@/lib/bulk-gen-context'
import { GlobalBulkProgress } from '@/components/global-bulk-progress'
import { SupportChatWidget } from '@/components/support/support-chat-widget'

/**
 * Client wrapper that provides BulkGenContext, the global bulk-progress bar,
 * and the floating Support Chat Widget.
 */
export function DashboardClientShell({ children }: { children: React.ReactNode }) {
    return (
        <BulkGenProvider>
            <GlobalBulkProgress />
            {children}
            <SupportChatWidget />
        </BulkGenProvider>
    )
}
