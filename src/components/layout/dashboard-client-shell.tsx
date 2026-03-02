'use client'

import { BulkGenProvider } from '@/lib/bulk-gen-context'
import { GlobalBulkProgress } from '@/components/global-bulk-progress'

/**
 * Client wrapper that provides BulkGenContext and mounts the header progress bar.
 * Used inside the server-side dashboard layout.
 */
export function DashboardClientShell({ children }: { children: React.ReactNode }) {
    return (
        <BulkGenProvider>
            <GlobalBulkProgress />
            {children}
        </BulkGenProvider>
    )
}
