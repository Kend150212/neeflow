import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { getBrandingServer } from '@/lib/use-branding-server'

// Safe branding getter — ensures appName/tagline always have a string value
async function getBrand() {
    const b = await getBrandingServer()
    return {
        ...b,
        appName: b.appName || 'NeeFlow',
        tagline: b.tagline || 'Social Media Management',
    }
}

// ─── Get SMTP transporter from ApiIntegration ───────
async function getTransporter() {
    const smtp = await prisma.apiIntegration.findFirst({
        where: { provider: 'smtp', status: 'ACTIVE' },
    })

    if (!smtp) {
        console.warn('[Email] No active SMTP integration found in database')
        return null
    }

    const config = (smtp.config as Record<string, string>) || {}
    const host = config.smtpHost || 'smtp.gmail.com'
    const port = parseInt(config.smtpPort || '465', 10)
    const secure = config.smtpSecure || 'ssl'
    const username = config.smtpUsername
    const password = smtp.apiKeyEncrypted ? decrypt(smtp.apiKeyEncrypted) : null
    const from = config.smtpFrom || username

    if (!username || !password) {
        console.warn('[Email] SMTP username or password missing', { hasUsername: !!username, hasPassword: !!password })
        return null
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: secure === 'ssl',
        auth: { user: username, pass: password },
        ...(secure === 'tls' ? { requireTLS: true } : {}),
    })

    return { transporter, from }
}

// ─── Generic sendEmail ────────────────────────────────
export async function sendEmail({
    to,
    subject,
    html,
}: {
    to: string
    subject: string
    html: string
}) {
    const smtp = await getTransporter()
    if (!smtp) {
        console.warn('[Email] SMTP not configured, skipping email to', to)
        return { success: false, reason: 'SMTP not configured' }
    }
    const { transporter, from } = smtp
    const brand = await getBrand()
    await transporter.sendMail({
        from: `"${brand.appName}" <${from}>`,
        to,
        subject,
        html,
    })
    return { success: true }
}

// ─── DB Template Engine ──────────────────────────────────────────────────────
// Fetches a template from the DB by key, replaces {{variable}} placeholders,
// and falls back to the provided fallbackHtml if the template doesn't exist.
export async function renderTemplate(
    key: string,
    vars: Record<string, string>,
    fallbackSubject?: string,
    fallbackHtml?: string
): Promise<{ subject: string; html: string } | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const template = await db.emailTemplate?.findUnique({ where: { key, isActive: true } })
        const brand = await getBrand()
        const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const logoUrl = brand.logoUrl?.startsWith('http') ? brand.logoUrl : `${appUrl}${brand.logoUrl || '/logo.png'}`

        const allVars: Record<string, string> = {
            appName: brand.appName,
            appUrl,
            logoUrl,
            year: new Date().getFullYear().toString(),
            ...vars,
        }

        // Simple {{var}} replace — handles {{var}} and strips unsupported {{#if}} blocks
        function replaceVars(str: string): string {
            // Replace {{var}} with value
            let result = str.replace(/\{\{(\w+)\}\}/g, (_, key) => allVars[key] ?? '')
            // Strip {{#if varName}}...{{/if}} blocks — show content only if var is truthy
            result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, inner) => {
                return allVars[varName] ? inner : ''
            })
            // Strip {{else}} handled version (simplified — no nested ifs)
            result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, ifInner, elseInner) => {
                return allVars[varName] ? ifInner : elseInner
            })
            return result
        }

        if (template) {
            return {
                subject: replaceVars(template.subject),
                html: replaceVars(template.htmlBody),
            }
        }

        // Fallback to hardcoded
        if (fallbackSubject && fallbackHtml) {
            return {
                subject: replaceVars(fallbackSubject),
                html: replaceVars(fallbackHtml),
            }
        }

        return null
    } catch (err) {
        console.error('[Email] renderTemplate error:', err)
        return null
    }
}

// ─── Send Welcome Email (Pay-First new user) ────────────────────────────────
export async function sendWelcomeEmail({
    toEmail,
    userName,
    planName,
    planPrice,
    billingInterval,
    trialDays,
    setupUrl,
}: {
    toEmail: string
    userName: string
    planName: string
    planPrice: string
    billingInterval: string
    trialDays?: number
    setupUrl: string
}) {
    try {
        const brand = await getBrand()
        const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        const rendered = await renderTemplate('welcome', {
            userName,
            userEmail: toEmail,
            planName,
            planPrice,
            billingInterval,
            trialDays: trialDays ? String(trialDays) : '',
            setupUrl,
            dashboardUrl: `${appUrl}/dashboard`,
        })

        if (!rendered) {
            console.warn('[Email] welcome template not found, skipping')
            return { success: false, reason: 'Template not found' }
        }

        return await sendEmail({ to: toEmail, subject: rendered.subject || `Welcome to ${brand.appName}!`, html: rendered.html })
    } catch (error) {
        console.error('[Email] sendWelcomeEmail failed:', error)
        return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' }
    }
}

// ─── Send Payment Confirmation Email ─────────────────────────────────────────
export async function sendPaymentConfirmationEmail({
    toEmail,
    userName,
    planName,
    planPrice,
    billingInterval,
    trialDays,
    nextBillingDate,
}: {
    toEmail: string
    userName: string
    planName: string
    planPrice: string
    billingInterval: string
    trialDays?: number
    nextBillingDate: string
}) {
    try {
        const brand = await getBrand()
        const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        const rendered = await renderTemplate('payment_confirmation', {
            userName,
            planName,
            planPrice,
            billingInterval,
            trialDays: trialDays ? String(trialDays) : '',
            nextBillingDate,
            dashboardUrl: `${appUrl}/dashboard`,
        })

        if (!rendered) {
            console.warn('[Email] payment_confirmation template not found, skipping')
            return { success: false, reason: 'Template not found' }
        }

        return await sendEmail({ to: toEmail, subject: rendered.subject || `Payment confirmed — ${planName}`, html: rendered.html })
    } catch (error) {
        console.error('[Email] sendPaymentConfirmationEmail failed:', error)
        return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' }
    }
}

// ─── Send Invitation Email ──────────────────────────
export async function sendInvitationEmail({
    toEmail,
    toName,
    role,
    appUrl,
    inviteToken,
}: {
    toEmail: string
    toName: string
    role: string
    appUrl: string
    inviteToken: string
}) {
    try {
        const smtp = await getTransporter()
        if (!smtp) {
            console.warn('[Email] SMTP not configured, skipping invitation email')
            return { success: false, reason: 'SMTP not configured' }
        }

        const { transporter, from } = smtp
        const setupUrl = `${appUrl}/setup-password?token=${inviteToken}`
        const brand = await getBrand()
        const logoUrl = brand.logoUrl?.startsWith('http') ? brand.logoUrl : `${appUrl}${brand.logoUrl || '/logo.png'}`
        const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'MANAGER' ? 'Manager' : 'Customer'
        const roleBg = role === 'ADMIN' ? '#dc2626' : role === 'MANAGER' ? '#7c3aed' : '#0891b2'

        await transporter.sendMail({
            from: `"${brand.appName}" <${from}>`,
            to: toEmail,
            subject: `You've been invited to join ${brand.appName}`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 48px 16px;">
        <tr><td align="center">
            <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%;">

                <!-- Logo -->
                <tr><td style="padding: 0 0 32px; text-align: center;">
                    <img src="${logoUrl}" alt="${brand.appName}" width="52" height="52" style="border-radius: 14px; display: inline-block;" />
                </td></tr>

                <!-- Main Card -->
                <tr><td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04); overflow: hidden;">

                        <!-- Gradient Accent Bar -->
                        <tr><td style="height: 4px; background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7, #ec4899);"></td></tr>

                        <!-- Header -->
                        <tr><td style="padding: 36px 36px 0;">
                            <h1 style="margin: 0 0 6px; font-size: 22px; font-weight: 700; color: #18181b; letter-spacing: -0.3px;">You're invited!</h1>
                            <p style="margin: 0; font-size: 14px; color: #71717a; line-height: 1.6;">
                                You've been added to <strong style="color: #18181b;">${brand.appName}</strong> as a team member. Set up your password below to get started.
                            </p>
                        </td></tr>

                        <!-- Info Card -->
                        <tr><td style="padding: 24px 36px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px;">
                                <tr>
                                    <td style="padding: 16px 20px; border-bottom: 1px solid #f4f4f5;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td>
                                                    <p style="margin: 0 0 2px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Name</p>
                                                    <p style="margin: 0; font-size: 15px; color: #18181b; font-weight: 500;">${toName}</p>
                                                </td>
                                                <td align="right" valign="top">
                                                    <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #ffffff; background-color: ${roleBg}; letter-spacing: 0.3px;">${roleLabel}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <p style="margin: 0 0 2px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Email</p>
                                        <p style="margin: 0; font-size: 15px; color: #18181b; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;">${toEmail}</p>
                                    </td>
                                </tr>
                            </table>
                        </td></tr>

                        <!-- CTA Button -->
                        <tr><td style="padding: 0 36px 36px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr><td align="center">
                                    <a href="${setupUrl}" style="display: inline-block; width: 100%; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: 0.2px; box-sizing: border-box;">
                                        Set Up Your Password →
                                    </a>
                                </td></tr>
                            </table>
                            <p style="margin: 12px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                                This link expires in 7 days
                            </p>
                        </td></tr>

                    </table>
                </td></tr>

                <!-- Footer -->
                <tr><td style="padding: 28px 36px; text-align: center;">
                    <p style="margin: 0 0 6px; font-size: 12px; color: #a1a1aa;">
                        If the button doesn't work, copy this link:
                    </p>
                    <p style="margin: 0 0 20px; font-size: 11px; word-break: break-all;">
                        <a href="${setupUrl}" style="color: #6366f1; text-decoration: none;">${setupUrl}</a>
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #d4d4d8;">
                        &copy; ${new Date().getFullYear()} ${brand.appName} &middot; Social Media Management Platform
                    </p>
                </td></tr>

            </table>
        </td></tr>
    </table>
</body>
</html>
            `,
        })

        return { success: true }
    } catch (error) {
        console.error('[Email] Failed to send invitation:', error)
        return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' }
    }
}

// ─── Send Channel Invite Email (Role-specific) ─────────────────
export async function sendChannelInviteEmail({
    toEmail,
    toName,
    channelName,
    inviterName,
    role,
    appUrl,
    inviteToken,
    hasPassword,
}: {
    toEmail: string
    toName: string
    channelName: string
    inviterName: string
    role: string
    appUrl: string
    inviteToken: string
    hasPassword?: boolean
}) {
    try {
        const smtp = await getTransporter()
        if (!smtp) {
            console.warn('[Email] SMTP not configured, skipping channel invite email')
            return { success: false, reason: 'SMTP not configured' }
        }

        const { transporter, from } = smtp
        const brand = await getBrand()
        const logoUrl = brand.logoUrl?.startsWith('http') ? brand.logoUrl : `${appUrl}${brand.logoUrl || '/logo.png'}`

        // ─── Role-specific content ───────────────────────
        const isCustomer = role === 'CUSTOMER'
        const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'OWNER' ? 'Owner' : role === 'MANAGER' ? 'Manager' : role === 'STAFF' ? 'Staff' : 'Client'
        const roleBg = role === 'ADMIN' ? '#dc2626' : role === 'OWNER' ? '#d97706' : role === 'MANAGER' ? '#7c3aed' : role === 'STAFF' ? '#2563eb' : '#0891b2'

        // Subject
        const subject = isCustomer
            ? `Review content for "${channelName}" — ${brand.appName}`
            : `Join the "${channelName}" team on ${brand.appName}`

        // Headline
        const headline = isCustomer
            ? `You're invited to review content!`
            : `You're invited to join the team!`

        // Description
        const description = isCustomer
            ? `<strong style="color: #18181b;">${inviterName}</strong> has invited you to the <strong style="color: #18181b;">"${channelName}"</strong> Client Portal on ${brand.appName} — where you can review and approve social media content before it goes live.`
            : `<strong style="color: #18181b;">${inviterName}</strong> has invited you to manage the channel <strong style="color: #18181b;">"${channelName}"</strong> on ${brand.appName} as a <strong style="color: #18181b;">${roleLabel}</strong>.`

        // Feature bullets
        const features = isCustomer
            ? [
                { icon: '📋', text: 'Review & approve posts before they publish' },
                { icon: '📅', text: 'View your content calendar' },
                { icon: '💬', text: 'Leave feedback and comments' },
            ]
            : [
                { icon: '📝', text: 'Create and schedule social media posts' },
                { icon: '📊', text: 'View analytics and reports' },
                { icon: '👥', text: 'Collaborate with the team' },
                ...(role === 'MANAGER' ? [{ icon: '⚙️', text: 'Manage channel settings and members' }] : []),
            ]

        // CTA
        const ctaUrl = hasPassword
            ? (isCustomer ? `${appUrl}/portal` : `${appUrl}/dashboard`)
            : `${appUrl}/invite/${inviteToken}`
        const ctaText = hasPassword
            ? (isCustomer ? 'Open Client Portal →' : 'Open Dashboard →')
            : 'Accept Invitation & Set Up Password →'
        const ctaGradient = isCustomer
            ? 'background: linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%);'
            : 'background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);'

        // Top bar gradient
        const topBarGradient = isCustomer
            ? 'background: linear-gradient(90deg, #0891b2, #06b6d4, #22d3ee, #14b8a6);'
            : 'background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7, #ec4899);'

        const featureRows = features.map(f => `
            <tr><td style="padding: 8px 16px; font-size: 14px; color: #52525b; line-height: 1.5;">
                <span style="margin-right: 8px;">${f.icon}</span> ${f.text}
            </td></tr>
        `).join('')

        await transporter.sendMail({
            from: `"${brand.appName}" <${from}>`,
            to: toEmail,
            subject,
            html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 48px 16px;">
        <tr><td align="center">
            <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%;">
                <tr><td style="padding: 0 0 32px; text-align: center;">
                    <img src="${logoUrl}" alt="${brand.appName}" width="52" height="52" style="border-radius: 14px; display: inline-block;" />
                </td></tr>
                <tr><td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04); overflow: hidden;">
                        <tr><td style="height: 4px; ${topBarGradient}"></td></tr>
                        <tr><td style="padding: 36px 36px 0;">
                            <h1 style="margin: 0 0 6px; font-size: 22px; font-weight: 700; color: #18181b;">${headline}</h1>
                            <p style="margin: 0; font-size: 14px; color: #71717a; line-height: 1.6;">
                                ${description}
                            </p>
                        </td></tr>
                        <tr><td style="padding: 24px 36px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px;">
                                <tr><td style="padding: 16px 20px; border-bottom: 1px solid #f4f4f5;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                                        <td>
                                            <p style="margin: 0 0 2px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Channel</p>
                                            <p style="margin: 0; font-size: 15px; color: #18181b; font-weight: 500;">${channelName}</p>
                                        </td>
                                        <td align="right" valign="top">
                                            <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #ffffff; background-color: ${roleBg};">${roleLabel}</span>
                                        </td>
                                    </tr></table>
                                </td></tr>
                                <tr><td style="padding: 16px 20px;">
                                    <p style="margin: 0 0 2px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Your Email</p>
                                    <p style="margin: 0; font-size: 15px; color: #18181b; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;">${toEmail}</p>
                                </td></tr>
                            </table>
                        </td></tr>

                        <!-- What you can do -->
                        <tr><td style="padding: 0 36px 24px;">
                            <p style="margin: 0 0 8px; font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">${isCustomer ? 'What you can do in the Portal' : 'What you can do'}</p>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 10px;">
                                ${featureRows}
                            </table>
                        </td></tr>

                        <tr><td style="padding: 0 36px 36px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr><td align="center">
                                    <a href="${ctaUrl}" style="display: inline-block; width: 100%; text-align: center; ${ctaGradient} color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; box-sizing: border-box;">
                                        ${ctaText}
                                    </a>
                                </td></tr>
                            </table>
                            ${hasPassword
                    ? '<p style="margin: 12px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Use your existing password to log in</p>'
                    : '<p style="margin: 12px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">This link expires in 7 days</p>'
                }
                        </td></tr>
                    </table>
                </td></tr>
                <tr><td style="padding: 28px 36px 12px; text-align: center; border-top: 1px solid #f4f4f5;">
                    <p style="margin: 0 0 6px; font-size: 12px; color: #a1a1aa;">If the button doesn't work, copy this link:</p>
                    <p style="margin: 0 0 24px; font-size: 11px; word-break: break-all;">
                        <a href="${ctaUrl}" style="color: #6366f1; text-decoration: none;">${ctaUrl}</a>
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding-bottom: 14px;">
                            <a href="${appUrl}/terms" style="font-size: 11px; color: #a1a1aa; text-decoration: underline; margin: 0 10px;">Terms of Service</a>
                            <span style="font-size: 11px; color: #d4d4d8;">&middot;</span>
                            <a href="${appUrl}/privacy" style="font-size: 11px; color: #a1a1aa; text-decoration: underline; margin: 0 10px;">Privacy Policy</a>
                        </td></tr>
                        <tr><td align="center">
                            <p style="margin: 0; font-size: 11px; color: #d4d4d8;">
                                &copy; ${new Date().getFullYear()} ${brand.appName} &middot; Social Media Management Platform
                            </p>
                        </td></tr>
                    </table>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>
            `,
        })

        return { success: true }
    } catch (error) {
        console.error('[Email] Failed to send channel invite:', error)
        return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' }
    }
}

// ─── Channel Added Notification (existing users with password) ─────────────
export async function sendChannelAddedNotificationEmail({
    toEmail,
    toName,
    channelName,
    inviterName,
    role,
    appUrl,
}: {
    toEmail: string
    toName: string
    channelName: string
    inviterName: string
    role: string
    appUrl: string
}) {
    try {
        const smtp = await getTransporter()
        if (!smtp) {
            console.warn('[Email] No SMTP configured — skipping channel added notification')
            return { success: false, reason: 'SMTP not configured' }
        }

        const { transporter, from } = smtp
        const brand = await getBrand()
        const logoUrl = brand.logoUrl?.startsWith('http') ? brand.logoUrl : `${appUrl}${brand.logoUrl || '/logo.png'}`
        const loginUrl = `${appUrl}/login`
        const roleLabel = role === 'ADMIN' ? 'Administrator' : role === 'OWNER' ? 'Owner' : role === 'MANAGER' ? 'Manager' : role === 'STAFF' ? 'Staff' : 'Client'
        const roleBg = role === 'ADMIN' ? '#dc2626' : role === 'OWNER' ? '#d97706' : role === 'MANAGER' ? '#7c3aed' : role === 'STAFF' ? '#2563eb' : '#0891b2'

        await transporter.sendMail({
            from: `"${brand.appName}" <${from}>`,
            to: toEmail,
            subject: `You've been added to ${channelName}`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 48px 16px;">
        <tr><td align="center">
            <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%;">

                <!-- Logo -->
                <tr><td align="center" style="padding-bottom: 24px;">
                    <img src="${logoUrl}" alt="${brand.appName}" width="36" height="36" style="border-radius: 8px;" onerror="this.style.display='none'">
                </td></tr>

                <!-- Card -->
                <tr><td style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                        <!-- Header bar -->
                        <tr><td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 28px 36px;">
                            <p style="margin: 0 0 6px; font-size: 12px; color: rgba(255,255,255,0.75); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Channel Access</p>
                            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">${channelName}</h1>
                        </td></tr>

                        <!-- Body -->
                        <tr><td style="padding: 28px 36px 0;">
                            <p style="margin: 0; font-size: 16px; color: #18181b; font-weight: 500;">
                                Hi ${toName || toEmail.split('@')[0]},
                            </p>
                            <p style="margin: 10px 0 0; font-size: 14px; color: #52525b; line-height: 1.6;">
                                <strong>${inviterName}</strong> has added you to the <strong>${channelName}</strong> channel on ${brand.appName}.
                                You can log in to your existing account to access it right away.
                            </p>
                        </td></tr>

                        <!-- Channel + Role info -->
                        <tr><td style="padding: 24px 36px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px;">
                                <tr><td style="padding: 16px 20px;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                                        <td>
                                            <p style="margin: 0 0 2px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Channel</p>
                                            <p style="margin: 0; font-size: 15px; color: #18181b; font-weight: 500;">${channelName}</p>
                                        </td>
                                        <td align="right" valign="top">
                                            <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #ffffff; background-color: ${roleBg};">${roleLabel}</span>
                                        </td>
                                    </tr></table>
                                </td></tr>
                                <tr><td style="padding: 12px 20px; border-top: 1px solid #f4f4f5;">
                                    <p style="margin: 0 0 2px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Your Account</p>
                                    <p style="margin: 0; font-size: 14px; color: #18181b; font-family: 'SF Mono', 'Fira Code', monospace;">${toEmail}</p>
                                </td></tr>
                            </table>
                        </td></tr>

                        <!-- CTA -->
                        <tr><td style="padding: 0 36px 36px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr><td align="center">
                                    <a href="${loginUrl}" style="display: inline-block; width: 100%; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; box-sizing: border-box;">
                                        Log In to Your Account →
                                    </a>
                                </tr><tr><td>
                                    <p style="margin: 12px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Use your existing email and password to log in</p>
                                </td></tr>
                            </table>
                        </td></tr>

                    </table>
                </td></tr>

                <!-- Footer -->
                <tr><td style="padding: 24px 36px 12px; text-align: center; border-top: 1px solid #f4f4f5;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding-bottom: 14px;">
                            <a href="${appUrl}/terms" style="font-size: 11px; color: #a1a1aa; text-decoration: underline; margin: 0 10px;">Terms of Service</a>
                            <span style="font-size: 11px; color: #d4d4d8;">&middot;</span>
                            <a href="${appUrl}/privacy" style="font-size: 11px; color: #a1a1aa; text-decoration: underline; margin: 0 10px;">Privacy Policy</a>
                        </td></tr>
                        <tr><td align="center">
                            <p style="margin: 0; font-size: 11px; color: #d4d4d8;">
                                &copy; ${new Date().getFullYear()} ${brand.appName} &middot; Social Media Management Platform
                            </p>
                        </td></tr>
                    </table>
                </td></tr>

            </table>
        </td></tr>
    </table>
</body>
</html>
            `,
        })

        return { success: true }
    } catch (error) {
        console.error('[Email] Failed to send channel added notification:', error)
        return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' }
    }
}
