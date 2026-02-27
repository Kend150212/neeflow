import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkMemberLimit } from '@/lib/billing/check-limits'

// GET /api/admin/channels/[id]/members — list channel members with permissions
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const members = await prisma.channelMember.findMany({
        where: { channelId: id, role: { not: 'CUSTOMER' } },
        include: {
            user: { select: { id: true, email: true, name: true, image: true, role: true, isActive: true } },
            permission: true,
        },
        orderBy: { user: { name: 'asc' } },
    })

    return NextResponse.json(members)
}

// Default permissions by role
function getDefaultPermissions(role: string) {
    // OWNER and ADMIN get ALL permissions including Delete Media
    if (role === 'OWNER' || role === 'ADMIN') {
        return {
            canCreatePost: true,
            canEditPost: true,
            canDeletePost: true,
            canApprovePost: true,
            canSchedulePost: true,
            canUploadMedia: true,
            canDeleteMedia: true,
            canViewMedia: true,
            canCreateEmail: true,
            canManageContacts: true,
            canViewReports: true,
            canEditSettings: true,
        }
    }
    // MANAGER: all permissions EXCEPT Delete Media
    if (role === 'MANAGER') {
        return {
            canCreatePost: true,
            canEditPost: true,
            canDeletePost: true,
            canApprovePost: true,
            canSchedulePost: true,
            canUploadMedia: true,
            canDeleteMedia: false,
            canViewMedia: true,
            canCreateEmail: true,
            canManageContacts: true,
            canViewReports: true,
            canEditSettings: true,
        }
    }
    // STAFF: limited permissions
    return {
        canCreatePost: true,
        canEditPost: true,
        canDeletePost: false,
        canApprovePost: false,
        canSchedulePost: true,
        canUploadMedia: true,
        canDeleteMedia: false,
        canViewMedia: true,
        canCreateEmail: false,
        canManageContacts: false,
        canViewReports: true,
        canEditSettings: false,
    }
}

// POST /api/admin/channels/[id]/members — add member (admin: userId or email, others: email only)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { userId, email, role } = body
    const isAdmin = session.user.role === 'ADMIN'

    // Non-admin can only invite by email
    if (!isAdmin && userId) {
        return NextResponse.json({ error: 'Only admins can add users directly' }, { status: 403 })
    }

    if (!userId && !email) {
        return NextResponse.json({ error: 'Either userId or email is required' }, { status: 400 })
    }

    // Get channel info for the invite email
    const channel = await prisma.channel.findUnique({ where: { id }, select: { displayName: true } })
    if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    let targetUserId = userId

    // If inviting by email, find or create user
    if (email && !userId) {
        let user = await prisma.user.findUnique({ where: { email } })

        if (!user) {
            // Create new user with invite token
            const crypto = await import('crypto')
            const inviteToken = crypto.randomBytes(32).toString('hex')
            user = await prisma.user.create({
                data: {
                    email,
                    name: email.split('@')[0],
                    role: role || 'MANAGER',
                    isActive: true,
                    inviteToken,
                    inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                },
            })

            // Create ChannelInvite record so /invite/[token] can validate it
            try {
                await prisma.channelInvite.upsert({
                    where: { channelId_email: { channelId: id, email } },
                    create: {
                        channelId: id,
                        email,
                        name: user.name || email.split('@')[0],
                        token: inviteToken,
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        invitedBy: session.user.id,
                    },
                    update: {
                        token: inviteToken,
                        acceptedAt: null,
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    },
                })
            } catch (e) {
                console.error('[Invite] Failed to upsert ChannelInvite (new user):', e)
            }

            // Send invitation email
            try {
                const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
                const { sendChannelInviteEmail } = await import('@/lib/email')
                await sendChannelInviteEmail({
                    toEmail: email,
                    toName: user.name || email,
                    channelName: channel.displayName,
                    inviterName: session.user.name || session.user.email,
                    role: role || 'MANAGER',
                    appUrl,
                    inviteToken,
                    hasPassword: false,
                })
            } catch (e) {
                console.error('[Invite] Failed to send invite email (new user):', e)
            }
        } else {
            // Existing user — check if they already have a password set
            const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

            if (user.passwordHash) {
                // User already has an account — send notification email with Login button
                // No need to generate a new invite token for them
                try {
                    const { sendChannelAddedNotificationEmail } = await import('@/lib/email')
                    const result = await sendChannelAddedNotificationEmail({
                        toEmail: email,
                        toName: user.name || email,
                        channelName: channel.displayName,
                        inviterName: session.user.name || session.user.email || 'Admin',
                        role: role || 'MANAGER',
                        appUrl,
                    })
                    if (!result.success) {
                        console.warn('[Invite] Notification email not sent:', result.reason)
                    }
                } catch (e) {
                    console.error('[Invite] Failed to send channel notification (existing user with password):', e)
                }
            } else {
                // User exists but hasn't set password yet — send a fresh invite link
                const crypto = await import('crypto')
                const inviteToken = crypto.randomBytes(32).toString('hex')
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        inviteToken,
                        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    },
                })

                // Upsert ChannelInvite so /invite/[token] can validate it
                try {
                    await prisma.channelInvite.upsert({
                        where: { channelId_email: { channelId: id, email } },
                        create: {
                            channelId: id,
                            email,
                            name: user.name || email.split('@')[0],
                            token: inviteToken,
                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                            invitedBy: session.user.id,
                        },
                        update: {
                            token: inviteToken,
                            acceptedAt: null,
                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        },
                    })
                } catch (e) {
                    console.error('[Invite] Failed to upsert ChannelInvite (existing user, no password):', e)
                }

                try {
                    const { sendChannelInviteEmail } = await import('@/lib/email')
                    const result = await sendChannelInviteEmail({
                        toEmail: email,
                        toName: user.name || email,
                        channelName: channel.displayName,
                        inviterName: session.user.name || session.user.email || 'Admin',
                        role: role || 'MANAGER',
                        appUrl,
                        inviteToken,
                        hasPassword: false,
                    })
                    if (!result.success) {
                        console.warn('[Invite] Invite email not sent:', result.reason)
                    }
                } catch (e) {
                    console.error('[Invite] Failed to send invite email (existing user, no password):', e)
                }
            }
        }
        targetUserId = user.id
    }

    // Check if already a member
    const existing = await prisma.channelMember.findUnique({
        where: { userId_channelId: { userId: targetUserId, channelId: id } },
    })
    if (existing) {
        return NextResponse.json({ error: 'User is already a member of this channel' }, { status: 409 })
    }

    // ─── Member seat quota enforcement (non-admin only) ──────────────────────
    if (!isAdmin) {
        // Find the channel owner to check their plan's member limit
        const ownerMember = await prisma.channelMember.findFirst({
            where: { channelId: id, role: 'OWNER' },
            select: { userId: true },
        })
        if (ownerMember) {
            const limitError = await checkMemberLimit(id, ownerMember.userId)
            if (limitError) {
                return NextResponse.json(
                    { error: limitError.message, errorType: 'LIMIT_REACHED', feature: 'members', limit: limitError.limit, current: limitError.current },
                    { status: 402 }
                )
            }
        }
    }

    // Create member with role-based default permissions
    const permissions = getDefaultPermissions(role || 'MANAGER')
    const member = await prisma.channelMember.create({
        data: {
            userId: targetUserId,
            channelId: id,
            role: role || 'MANAGER',
            permission: {
                create: permissions,
            },
        },
        include: {
            user: { select: { id: true, email: true, name: true, image: true, role: true, isActive: true } },
            permission: true,
        },
    })

    // Fire in-app notification for the invited user
    try {
        const { createNotification } = await import('@/lib/notify')
        await createNotification({
            userId: targetUserId,
            type: 'member_invited',
            title: `You've been added to ${channel.displayName} 👋`,
            message: `${session.user.name || session.user.email || 'An admin'} added you as ${role || 'MANAGER'} to ${channel.displayName}.`,
            data: { channelId: id },
            link: `/dashboard/channels/${id}`,
        })
    } catch { /* notifications are non-blocking */ }

    return NextResponse.json(member, { status: 201 })
}

// DELETE /api/admin/channels/[id]/members — remove a member
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await params
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    await prisma.channelMember.delete({ where: { id: memberId } })

    return NextResponse.json({ success: true })
}
