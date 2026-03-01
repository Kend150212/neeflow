// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any

export const EMAIL_TEMPLATE_DEFAULTS = [
  // ─── Welcome (new signup via Pay-First flow) ──────────────────────────────
  {
    key: 'welcome',
    name: 'Welcome Email',
    description: 'Sent to new users after they complete checkout on the pricing page.',
    subject: '🎉 Welcome to {{appName}}! Your {{planName}} plan is ready',
    variables: ['appName', 'logoUrl', 'appUrl', 'userName', 'userEmail', 'planName', 'planPrice', 'billingInterval', 'trialDays', 'setupUrl'],
    htmlBody: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:48px 16px;">
  <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

      <!-- Logo -->
      <tr><td style="padding:0 0 32px;text-align:center;">
        <img src="{{logoUrl}}" alt="{{appName}}" width="52" height="52" style="border-radius:14px;display:inline-block;" />
      </td></tr>

      <!-- Card -->
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);overflow:hidden;">

          <!-- Gradient bar -->
          <tr><td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7,#ec4899);"></td></tr>

          <!-- Header -->
          <tr><td style="padding:36px 36px 0;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;">Welcome, {{userName}}! 🎉</h1>
            <p style="margin:0;font-size:14px;color:#71717a;line-height:1.6;">
              Your <strong style="color:#18181b;">{{planName}}</strong> subscription on <strong style="color:#18181b;">{{appName}}</strong> is ready.
              {{#if trialDays}}You have a <strong style="color:#7c3aed;">{{trialDays}}-day free trial</strong> — no charge until it ends.{{/if}}
            </p>
          </td></tr>

          <!-- Plan info box -->
          <tr><td style="padding:24px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td>
                      <p style="margin:0 0 2px;font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Plan</p>
                      <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">{{planName}}</p>
                    </td>
                    <td align="right" valign="top">
                      <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;color:#ffffff;background:linear-gradient(135deg,#6366f1,#8b5cf6);">Active</span>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
                  <p style="margin:0 0 2px;font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Billing</p>
                  <p style="margin:0;font-size:15px;color:#18181b;font-weight:500;">$' + '{{planPrice}} / {{billingInterval}}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 2px;font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Account Email</p>
                  <p style="margin:0;font-size:14px;color:#18181b;font-family:'SF Mono','Fira Code',Consolas,monospace;">{{userEmail}}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td style="padding:0 36px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="{{setupUrl}}" style="display:inline-block;width:100%;text-align:center;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.2px;box-sizing:border-box;">
                  Set Up Your Password →
                </a>
              </td></tr>
            </table>
            <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">This link expires in 72 hours</p>
          </td></tr>

        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:28px 36px;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa;">If the button doesn't work, copy this link:</p>
        <p style="margin:0 0 20px;font-size:11px;word-break:break-all;">
          <a href="{{setupUrl}}" style="color:#6366f1;text-decoration:none;">{{setupUrl}}</a>
        </p>
        <p style="margin:0;font-size:11px;color:#d4d4d8;">&copy; {{year}} {{appName}} &middot; Social Media Management Platform</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
  },

  // ─── Payment Confirmation ─────────────────────────────────────────────────
  {
    key: 'payment_confirmation',
    name: 'Payment Confirmation',
    description: 'Sent after a successful Stripe checkout (trial start or paid invoice).',
    subject: '✅ Payment confirmed — {{planName}} on {{appName}}',
    variables: ['appName', 'logoUrl', 'appUrl', 'userName', 'planName', 'planPrice', 'billingInterval', 'nextBillingDate', 'trialDays', 'dashboardUrl'],
    htmlBody: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:48px 16px;">
  <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

      <tr><td style="padding:0 0 32px;text-align:center;">
        <img src="{{logoUrl}}" alt="{{appName}}" width="52" height="52" style="border-radius:14px;display:inline-block;" />
      </td></tr>

      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
          <tr><td style="height:4px;background:linear-gradient(90deg,#10b981,#059669,#047857);"></td></tr>

          <tr><td style="padding:36px 36px 0;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Payment confirmed ✅</h1>
            <p style="margin:0;font-size:14px;color:#71717a;line-height:1.6;">
              Hi {{userName}}, your <strong style="color:#18181b;">{{planName}}</strong> subscription is active.
              {{#if trialDays}}Your free trial lasts <strong style="color:#7c3aed;">{{trialDays}} days</strong> — you won't be charged until <strong>{{nextBillingDate}}</strong>.{{else}}Your next billing date is <strong>{{nextBillingDate}}</strong>.{{/if}}
            </p>
          </td></tr>

          <tr><td style="padding:24px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
              <tr><td style="padding:16px 20px;border-bottom:1px solid #dcfce7;">
                <p style="margin:0 0 2px;font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Plan</p>
                <p style="margin:0;font-size:15px;color:#14532d;font-weight:600;">{{planName}}</p>
              </td></tr>
              <tr><td style="padding:16px 20px;border-bottom:1px solid #dcfce7;">
                <p style="margin:0 0 2px;font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Amount</p>
                <p style="margin:0;font-size:15px;color:#14532d;font-weight:500;">$' + '{{planPrice}} / {{billingInterval}}</p>
              </td></tr>
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 2px;font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Next billing date</p>
                <p style="margin:0;font-size:15px;color:#14532d;font-weight:500;">{{nextBillingDate}}</p>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:0 36px 36px;">
            <a href="{{dashboardUrl}}" style="display:inline-block;width:100%;text-align:center;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;box-sizing:border-box;">
              Go to Dashboard →
            </a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:28px 36px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#d4d4d8;">&copy; {{year}} {{appName}} &middot; Social Media Management Platform</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
  },

  // ─── Invitation (team member) ─────────────────────────────────────────────
  {
    key: 'invitation',
    name: 'Team Invitation',
    description: 'Sent when an admin invites a new team member.',
    subject: "You've been invited to join {{appName}}",
    variables: ['appName', 'logoUrl', 'appUrl', 'toName', 'toEmail', 'role', 'setupUrl'],
    htmlBody: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:48px 16px;">
  <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
      <tr><td style="padding:0 0 32px;text-align:center;">
        <img src="{{logoUrl}}" alt="{{appName}}" width="52" height="52" style="border-radius:14px;display:inline-block;" />
      </td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
          <tr><td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7,#ec4899);"></td></tr>
          <tr><td style="padding:36px 36px 0;">
            <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#18181b;">You're invited!</h1>
            <p style="margin:0;font-size:14px;color:#71717a;line-height:1.6;">
              You've been added to <strong style="color:#18181b;">{{appName}}</strong> as <strong style="color:#18181b;">{{role}}</strong>. Set up your password to get started.
            </p>
          </td></tr>
          <tr><td style="padding:24px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;">
              <tr><td style="padding:16px 20px;border-bottom:1px solid #f4f4f5;">
                <p style="margin:0 0 2px;font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Name</p>
                <p style="margin:0;font-size:15px;color:#18181b;font-weight:500;">{{toName}}</p>
              </td></tr>
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 2px;font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Email</p>
                <p style="margin:0;font-size:14px;color:#18181b;font-family:'SF Mono','Fira Code',monospace;">{{toEmail}}</p>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 36px 36px;">
            <a href="{{setupUrl}}" style="display:inline-block;width:100%;text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;box-sizing:border-box;">
              Set Up Your Password →
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">This link expires in 7 days</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 36px;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa;">If the button doesn't work, copy this link:</p>
        <p style="margin:0 0 20px;font-size:11px;word-break:break-all;"><a href="{{setupUrl}}" style="color:#6366f1;text-decoration:none;">{{setupUrl}}</a></p>
        <p style="margin:0;font-size:11px;color:#d4d4d8;">&copy; {{year}} {{appName}} &middot; Social Media Management Platform</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
  },

  // ─── Password Reset ───────────────────────────────────────────────────────
  {
    key: 'password_reset',
    name: 'Password Reset',
    description: 'Sent when a user requests a password reset.',
    subject: 'Reset your {{appName}} password',
    variables: ['appName', 'logoUrl', 'appUrl', 'userName', 'resetUrl'],
    htmlBody: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:48px 16px;">
  <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
      <tr><td style="padding:0 0 32px;text-align:center;">
        <img src="{{logoUrl}}" alt="{{appName}}" width="52" height="52" style="border-radius:14px;display:inline-block;" />
      </td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
          <tr><td style="height:4px;background:linear-gradient(90deg,#f59e0b,#d97706,#b45309);"></td></tr>
          <tr><td style="padding:36px 36px 0;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Reset your password</h1>
            <p style="margin:0;font-size:14px;color:#71717a;line-height:1.6;">
              Hi {{userName}}, we received a request to reset your password. Click the button below to proceed.
              If you didn't request this, you can safely ignore this email.
            </p>
          </td></tr>
          <tr><td style="padding:24px 36px 36px;">
            <a href="{{resetUrl}}" style="display:inline-block;width:100%;text-align:center;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;box-sizing:border-box;">
              Reset Password →
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">This link expires in 1 hour</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 36px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#d4d4d8;">&copy; {{year}} {{appName}}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
  },
]

export async function seedEmailTemplates(db: AnyPrisma) {
  console.log('📧 Seeding email templates...')
  for (const template of EMAIL_TEMPLATE_DEFAULTS) {
    await db.emailTemplate.upsert({
      where: { key: template.key },
      update: {
        name: template.name,
        description: template.description,
        subject: template.subject,
        variables: template.variables,
        // Don't overwrite htmlBody if admin has customized it
      },
      create: {
        key: template.key,
        name: template.name,
        description: template.description,
        subject: template.subject,
        htmlBody: template.htmlBody,
        variables: template.variables,
      },
    })
    console.log(`  ✅ ${template.key}`)
  }
}
