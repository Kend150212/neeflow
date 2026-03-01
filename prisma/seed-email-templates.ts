// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any

export const EMAIL_TEMPLATE_DEFAULTS = [
  // ─── Welcome (new signup via Pay-First flow) ──────────────────────────────
  {
    key: 'welcome',
    name: 'Welcome Email',
    description: 'Sent to new users after they complete checkout on the pricing page.',
    subject: '🎉 Welcome to {{appName}}! Your account is ready — let\'s get started',
    variables: ['appName', 'logoUrl', 'appUrl', 'userName', 'userEmail', 'planName', 'planPrice', 'billingInterval', 'trialDays', 'setupUrl'],
    htmlBody: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to {{appName}}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f13;padding:48px 16px;">
  <tr><td align="center">
    <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

      <!-- Logo -->
      <tr><td style="padding:0 0 28px;text-align:center;">
        <img src="{{logoUrl}}" alt="{{appName}}" width="56" height="56" style="border-radius:16px;display:inline-block;box-shadow:0 0 0 1px rgba(255,255,255,0.1);" />
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.5px;">{{appName}}</p>
      </td></tr>

      <!-- Main Card -->
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a24;border-radius:20px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

          <!-- Gradient hero bar -->
          <tr><td style="height:5px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7,#ec4899,#f43f5e);"></td></tr>

          <!-- Hero section -->
          <tr><td style="padding:44px 44px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <!-- Celebration badge -->
                  <div style="display:inline-block;padding:6px 14px;border-radius:100px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);margin-bottom:20px;">
                    <span style="font-size:12px;font-weight:600;color:#a5b4fc;letter-spacing:0.5px;">🎉 &nbsp;ACCOUNT ACTIVATED</span>
                  </div>
                  <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">Welcome aboard,<br>{{userName}}!</h1>
                  <p style="margin:0;font-size:16px;color:#9ca3af;line-height:1.7;">
                    Your <strong style="color:#c4b5fd;">{{planName}}</strong> plan is active and your workspace is ready.
                    {{#if trialDays}}
                    You're starting with a <strong style="color:#a5b4fc;">{{trialDays}}-day free trial</strong> — full access, no charge until the trial ends.
                    {{/if}}
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Plan details card -->
          <tr><td style="padding:0 44px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td>
                      <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Plan</p>
                      <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">{{planName}}</p>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 14px;border-radius:100px;font-size:11px;font-weight:700;color:#ffffff;background:linear-gradient(135deg,#6366f1,#8b5cf6);">&#x2714; Active</span>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Billing</p>
                  <p style="margin:0;font-size:16px;font-weight:600;color:#e5e7eb;">&#36;{{planPrice}} <span style="color:#6b7280;font-weight:400;font-size:14px;">/ {{billingInterval}}</span></p>
                  {{#if trialDays}}<p style="margin:4px 0 0;font-size:12px;color:#10b981;">&#x2665; Free for {{trialDays}} days, then &#36;{{planPrice}}/{{billingInterval}}</p>{{/if}}
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Account Email</p>
                  <p style="margin:0;font-size:14px;color:#c4b5fd;font-family:'SF Mono','Fira Code',Consolas,monospace;">{{userEmail}}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- What you get section -->
          <tr><td style="padding:0 44px 32px;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">What's included in your plan</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;padding-right:4px;">
                      <div style="width:22px;height:22px;border-radius:6px;background:rgba(99,102,241,0.2);text-align:center;line-height:22px;font-size:12px;">&#128279;</div>
                    </td>
                    <td><p style="margin:0;font-size:14px;color:#d1d5db;">Connect unlimited social accounts</p></td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;padding-right:4px;">
                      <div style="width:22px;height:22px;border-radius:6px;background:rgba(139,92,246,0.2);text-align:center;line-height:22px;font-size:12px;">&#129302;</div>
                    </td>
                    <td><p style="margin:0;font-size:14px;color:#d1d5db;">AI-powered content generation</p></td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;padding-right:4px;">
                      <div style="width:22px;height:22px;border-radius:6px;background:rgba(168,85,247,0.2);text-align:center;line-height:22px;font-size:12px;">&#128197;</div>
                    </td>
                    <td><p style="margin:0;font-size:14px;color:#d1d5db;">Schedule & auto-publish posts</p></td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;padding-right:4px;">
                      <div style="width:22px;height:22px;border-radius:6px;background:rgba(236,72,153,0.2);text-align:center;line-height:22px;font-size:12px;">&#128200;</div>
                    </td>
                    <td><p style="margin:0;font-size:14px;color:#d1d5db;">Analytics & performance insights</p></td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Next step: set password -->
          <tr><td style="padding:0 44px 16px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Next step</p>
            <p style="margin:0 0 20px;font-size:15px;color:#9ca3af;line-height:1.6;">
              Create your password to access your dashboard. This is the final step before you can start growing your social media presence.
            </p>
            <a href="{{setupUrl}}" style="display:block;text-align:center;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.3px;">
              Set Up Your Password &rarr;
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#4b5563;text-align:center;">&#x23F3; This link expires in 72 hours</p>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 44px 32px;">
            <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
          </td></tr>

          <!-- Support note -->
          <tr><td style="padding:0 44px 44px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:20px 24px;">
              <tr><td>
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#a5b4fc;">&#128172; Need help getting started?</p>
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                  Reply to this email anytime — our team typically responds within a few hours. We're here to make sure you get the most out of {{appName}}.
                </p>
              </td></tr>
            </table>
          </td></tr>

        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:28px 20px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:#374151;">If the button doesn't work, copy this link:</p>
        <p style="margin:0 0 20px;font-size:11px;word-break:break-all;">
          <a href="{{setupUrl}}" style="color:#6366f1;text-decoration:none;">{{setupUrl}}</a>
        </p>
        <p style="margin:0 0 4px;font-size:11px;color:#374151;">&copy; {{year}} {{appName}} &middot; Social Media Management Platform</p>
        <p style="margin:0;font-size:11px;color:#374151;">You're receiving this because you signed up for {{appName}}.</p>
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
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f13;padding:48px 16px;">
  <tr><td align="center">
    <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <tr><td style="padding:0 0 28px;text-align:center;">
        <img src="{{logoUrl}}" alt="{{appName}}" width="56" height="56" style="border-radius:16px;display:inline-block;" />
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;font-weight:500;">{{appName}}</p>
      </td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a24;border-radius:20px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
          <tr><td style="height:5px;background:linear-gradient(90deg,#10b981,#059669,#047857);"></td></tr>
          <tr><td style="padding:44px 44px 28px;">
            <div style="display:inline-block;padding:6px 14px;border-radius:100px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);margin-bottom:20px;">
              <span style="font-size:12px;font-weight:600;color:#6ee7b7;letter-spacing:0.5px;">&#x2714; &nbsp;PAYMENT CONFIRMED</span>
            </div>
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">Your payment was<br>successful!</h1>
            <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.7;">
              Hi {{userName}}, your <strong style="color:#6ee7b7;">{{planName}}</strong> subscription is now active.
              {{#if trialDays}}Your <strong style="color:#a5b4fc;">{{trialDays}}-day free trial</strong> starts today — you won't be charged until <strong style="color:#ffffff;">{{nextBillingDate}}</strong>.{{else}}Your next billing date is <strong style="color:#ffffff;">{{nextBillingDate}}</strong>.{{/if}}
            </p>
          </td></tr>
          <tr><td style="padding:0 44px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:14px;overflow:hidden;">
              <tr><td style="padding:18px 24px;border-bottom:1px solid rgba(16,185,129,0.1);">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;">Plan</p>
                <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">{{planName}}</p>
              </td></tr>
              <tr><td style="padding:18px 24px;border-bottom:1px solid rgba(16,185,129,0.1);">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;">Amount</p>
                <p style="margin:0;font-size:16px;font-weight:600;color:#e5e7eb;">&#36;{{planPrice}} <span style="color:#6b7280;font-weight:400;font-size:14px;">/ {{billingInterval}}</span></p>
              </td></tr>
              <tr><td style="padding:18px 24px;">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;">Next billing date</p>
                <p style="margin:0;font-size:15px;font-weight:600;color:#e5e7eb;">{{nextBillingDate}}</p>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 44px 44px;">
            <a href="{{dashboardUrl}}" style="display:block;text-align:center;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;">
              Go to Dashboard &rarr;
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 20px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#374151;">&copy; {{year}} {{appName}} &middot; Social Media Management Platform</p>
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
<body style="margin:0;padding:0;background-color:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f13;padding:48px 16px;">
  <tr><td align="center">
    <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <tr><td style="padding:0 0 28px;text-align:center;">
        <img src="{{logoUrl}}" alt="{{appName}}" width="56" height="56" style="border-radius:16px;display:inline-block;" />
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;font-weight:500;">{{appName}}</p>
      </td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a24;border-radius:20px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
          <tr><td style="height:5px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7,#ec4899);"></td></tr>
          <tr><td style="padding:44px 44px 28px;">
            <div style="display:inline-block;padding:6px 14px;border-radius:100px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);margin-bottom:20px;">
              <span style="font-size:12px;font-weight:600;color:#a5b4fc;letter-spacing:0.5px;">&#128172; &nbsp;TEAM INVITATION</span>
            </div>
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#ffffff;">You're invited!</h1>
            <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.7;">
              You've been added to <strong style="color:#c4b5fd;">{{appName}}</strong> as <strong style="color:#ffffff;">{{role}}</strong>. Set up your password to get started.
            </p>
          </td></tr>
          <tr><td style="padding:0 44px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">
              <tr><td style="padding:18px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Name</p>
                <p style="margin:0;font-size:15px;color:#ffffff;font-weight:600;">{{toName}}</p>
              </td></tr>
              <tr><td style="padding:18px 24px;">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Email</p>
                <p style="margin:0;font-size:14px;color:#c4b5fd;font-family:'SF Mono','Fira Code',monospace;">{{toEmail}}</p>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 44px 44px;">
            <a href="{{setupUrl}}" style="display:block;text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;">
              Set Up Your Password &rarr;
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#4b5563;text-align:center;">This link expires in 7 days</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 20px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:#374151;">If the button doesn't work, copy this link:</p>
        <p style="margin:0 0 16px;font-size:11px;word-break:break-all;"><a href="{{setupUrl}}" style="color:#6366f1;text-decoration:none;">{{setupUrl}}</a></p>
        <p style="margin:0;font-size:11px;color:#374151;">&copy; {{year}} {{appName}} &middot; Social Media Management Platform</p>
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
<body style="margin:0;padding:0;background-color:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f13;padding:48px 16px;">
  <tr><td align="center">
    <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <tr><td style="padding:0 0 28px;text-align:center;">
        <img src="{{logoUrl}}" alt="{{appName}}" width="56" height="56" style="border-radius:16px;display:inline-block;" />
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;font-weight:500;">{{appName}}</p>
      </td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a24;border-radius:20px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
          <tr><td style="height:5px;background:linear-gradient(90deg,#f59e0b,#d97706,#b45309);"></td></tr>
          <tr><td style="padding:44px 44px 28px;">
            <div style="display:inline-block;padding:6px 14px;border-radius:100px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);margin-bottom:20px;">
              <span style="font-size:12px;font-weight:600;color:#fcd34d;letter-spacing:0.5px;">&#128274; &nbsp;PASSWORD RESET</span>
            </div>
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#ffffff;">Reset your password</h1>
            <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.7;">
              Hi {{userName}}, we received a request to reset your {{appName}} password. Click the button below — this link is only valid for <strong style="color:#fcd34d;">1 hour</strong>.<br><br>
              If you didn't request this, you can safely ignore this email. Your password remains unchanged.
            </p>
          </td></tr>
          <tr><td style="padding:0 44px 44px;">
            <a href="{{resetUrl}}" style="display:block;text-align:center;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;padding:16px 32px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:700;">
              Reset Password &rarr;
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#4b5563;text-align:center;">Expires in 1 hour &middot; Single use only</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:28px 20px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#374151;">&copy; {{year}} {{appName}}</p>
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
        htmlBody: template.htmlBody,
        variables: template.variables,
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
