'use client'

import { useWorkspace } from '@/lib/workspace-context'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

export function DashboardMain({ children }: { children: ReactNode }) {
    const { isSwitching } = useWorkspace()

    return (
        <main className="flex-1 min-w-0 overflow-y-auto relative">
            {/* Thin progress bar at top when switching */}
            <div
                className={cn(
                    'absolute top-0 left-0 h-[2px] bg-primary z-50 transition-all',
                    isSwitching
                        ? 'w-[85%] opacity-100 duration-300 ease-out'
                        : 'w-full opacity-0 duration-150 ease-in'
                )}
            />

            {/* Page content — fade slightly while switching */}
            <div
                className={cn(
                    'relative px-3 py-4 sm:p-6 max-w-full h-full overflow-y-auto transition-opacity duration-200',
                    'pb-16 md:pb-0',   // mobile: bottom clearance for fixed bottom tab bar
                    isSwitching ? 'opacity-50 pointer-events-none' : 'opacity-100'
                )}
            >
                {children}
            </div>
        </main>
    )
}
