import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { WorkspaceProvider } from '@/lib/workspace-context'
import { DashboardMain } from '@/components/layout/dashboard-main'
import { TrialBanner } from '@/components/trial-banner'
import { DashboardClientShell } from '@/components/layout/dashboard-client-shell'
import { DashboardHeader } from '@/components/layout/dashboard-header'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user) {
        redirect('/login')
    }

    // CUSTOMER users: check if they have staff channel access (dual-role)
    if (session.user.role === 'CUSTOMER') {
        const cookieStore = await cookies()
        const accessMode = cookieStore.get('access-mode')?.value

        // If user explicitly chose dashboard on /choose page, allow through
        if (accessMode !== 'dashboard') {
            // Check if they have any non-CUSTOMER channel memberships (staff access)
            const staffMemberships = await prisma.channelMember.count({
                where: { userId: session.user.id, role: { not: 'CUSTOMER' } },
            })

            if (staffMemberships === 0) {
                // Pure customer — redirect to portal
                redirect('/portal')
            } else {
                // Dual-access but hasn't chosen yet — redirect to chooser
                redirect('/choose')
            }
        }
        // If accessMode === 'dashboard', fall through and render dashboard
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <WorkspaceProvider>
                <DashboardClientShell>
                    <Sidebar session={session} />
                    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                        <DashboardHeader session={session} />
                        <TrialBanner />
                        <DashboardMain>
                            {children}
                        </DashboardMain>
                    </div>
                </DashboardClientShell>
            </WorkspaceProvider>
            <Toaster richColors position="top-right" />
        </div>
    )
}
