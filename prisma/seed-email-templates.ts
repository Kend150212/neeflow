// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any

// Helper: encode SVGs as data URIs for email img tags (better compatibility than inline SVG in email)
// We use table-based layout for max email client compatibility

export const EMAIL_TEMPLATE_DEFAULTS = [
  // ─── Welcome (new signup via Pay-First flow) ──────────────────────────────
  {
    key: 'welcome',
    name: 'Welcome Email',
    description: 'Sent to new users after they complete checkout on the pricing page.',
    subject: '🚀 Welcome to {{appName}}! Your {{planName}} workspace is ready',
    variables: ['appName', 'logoUrl', 'appUrl', 'userName', 'userEmail', 'planName', 'planPrice', 'billingInterval', 'trialDays', 'setupUrl'],
    htmlBody: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to {{appName}}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #0d0d14; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 16px 8px !important; }
      .email-card { border-radius: 16px !important; }
      .email-content { padding: 28px 24px !important; }
      .feature-row td { display: block !important; width: 100% !important; padding: 0 0 16px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0d0d14;-webkit-font-smoothing:antialiased;">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d14;">
<tr><td align="center" class="email-wrapper" style="padding:48px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

    <!-- ══ LOGO + BRAND ══ -->
    <tr><td align="center" style="padding:0 0 32px;">
      <img src="{{logoUrl}}" alt="{{appName}}" width="60" height="60" style="display:inline-block;border-radius:18px;box-shadow:0 0 0 1px rgba(255,255,255,0.1),0 8px 32px rgba(99,102,241,0.3);" />
      <br>
      <span style="display:inline-block;margin-top:12px;font-size:18px;font-weight:800;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-0.3px;">{{appName}}</span>
    </td></tr>

    <!-- ══ MAIN CARD ══ -->
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(160deg,#1c1c2e 0%,#161624 50%,#13131f 100%);border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;" class="email-card">

        <!-- Rainbow gradient bar -->
        <tr><td height="5" style="height:5px;font-size:0;background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 25%,#a855f7 50%,#ec4899 75%,#f43f5e 100%);"></td></tr>

        <!-- ── HERO SECTION ── -->
        <tr><td style="padding:48px 48px 0 48px;" class="email-content">
          <!-- Activated badge -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:6px 16px;border-radius:100px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);margin-bottom:24px;">
            <span style="font-size:11px;font-weight:700;color:#a5b4fc;letter-spacing:1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">&#x2728;&nbsp;&nbsp;ACCOUNT ACTIVATED</span>
          </td></tr></table>

          <div style="height:20px;font-size:20px;">&nbsp;</div>

          <h1 style="margin:0 0 16px;font-size:32px;font-weight:800;color:#ffffff;line-height:1.15;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-0.5px;">
            Welcome aboard,<br><span style="background:linear-gradient(135deg,#a5b4fc,#c084fc,#f9a8d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">{{userName}}!</span>
          </h1>

          <p style="margin:0 0 8px;font-size:16px;color:#94a3b8;line-height:1.75;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            Your <strong style="color:#c4b5fd;">{{planName}}</strong> workspace on <strong style="color:#e2e8f0;">{{appName}}</strong> is ready.
            You now have access to everything you need to <strong style="color:#e2e8f0;">grow your social media presence with AI.</strong>
          </p>

          {{#if trialDays}}
          <div style="height:16px;font-size:16px;">&nbsp;</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:14px 20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <!-- Clock SVG -->
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E" width="20" height="20" alt="" />
              </td>
              <td>
                <span style="font-size:14px;font-weight:600;color:#6ee7b7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  {{trialDays}}-day free trial active — full access, zero charge until your trial ends
                </span>
              </td>
            </tr></table>
          </td></tr></table>
          {{/if}}
        </td></tr>

        <!-- ── DIVIDER ── -->
        <tr><td style="padding:32px 48px 0;">
          <div style="height:1px;background:rgba(255,255,255,0.06);font-size:0;">&nbsp;</div>
        </td></tr>

        <!-- ── PLAN DETAILS ── -->
        <tr><td style="padding:32px 48px 0;">
          <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Your Subscription</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:18px 24px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td>
                    <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Plan</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{{planName}}</p>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:5px 14px;border-radius:100px;font-size:11px;font-weight:700;color:#ffffff;background:linear-gradient(135deg,#6366f1,#8b5cf6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">ACTIVE</span>
                  </td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Billing</p>
                <p style="margin:0;font-size:20px;font-weight:800;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">&#36;{{planPrice}}<span style="font-size:14px;font-weight:400;color:#64748b;">&nbsp;/ {{billingInterval}}</span></p>
                {{#if trialDays}}<p style="margin:4px 0 0;font-size:12px;color:#10b981;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Free for {{trialDays}} days, then &#36;{{planPrice}}/{{billingInterval}}</p>{{/if}}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:rgba(255,255,255,0.02);">
                <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Account Email</p>
                <p style="margin:0;font-size:14px;color:#a5b4fc;font-family:'SF Mono','Fira Code',Consolas,monospace;">{{userEmail}}</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ── FEATURES SECTION ── -->
        <tr><td style="padding:32px 48px 0;">
          <div style="height:1px;background:rgba(255,255,255,0.06);font-size:0;">&nbsp;</div>
        </td></tr>

        <tr><td style="padding:32px 48px 0;">
          <p style="margin:0 0 24px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Everything Included In Your Plan</p>

          <!-- Feature 1: Multi-Platform -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
          <tr>
            <td width="48" valign="top">
              <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.3));border:1px solid rgba(139,92,246,0.3);text-align:center;line-height:40px;">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23a5b4fc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='3' width='20' height='14' rx='2'/%3E%3Cline x1='8' y1='21' x2='16' y2='21'/%3E%3Cline x1='12' y1='17' x2='12' y2='21'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline-block;vertical-align:middle;margin-top:10px;" />
              </div>
            </td>
            <td style="padding-left:16px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Multi-Platform Publishing</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Connect and post to Facebook, Instagram, TikTok, YouTube, X, LinkedIn, Pinterest simultaneously from one dashboard</p>
            </td>
          </tr>
          </table>

          <!-- Feature 2: AI Content -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
          <tr>
            <td width="48" valign="top">
              <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,rgba(168,85,247,0.3),rgba(236,72,153,0.3));border:1px solid rgba(168,85,247,0.3);text-align:center;line-height:40px;">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23c084fc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline-block;vertical-align:middle;margin-top:10px;" />
              </div>
            </td>
            <td style="padding-left:16px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">AI Content Generation</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Generate captions, scripts &amp; hashtags in seconds. AI trained on viral content patterns to maximize your reach and engagement</p>
            </td>
          </tr>
          </table>

          <!-- Feature 3: Chat Bot -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
          <tr>
            <td width="48" valign="top">
              <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,rgba(16,185,129,0.3),rgba(5,150,105,0.3));border:1px solid rgba(16,185,129,0.3);text-align:center;line-height:40px;">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236ee7b7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3Cline x1='9' y1='10' x2='9' y2='10'/%3E%3Cline x1='12' y1='10' x2='12' y2='10'/%3E%3Cline x1='15' y1='10' x2='15' y2='10'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline-block;vertical-align:middle;margin-top:10px;" />
              </div>
            </td>
            <td style="padding-left:16px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">AI Chat Bot (Auto-Reply)</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Automated AI-powered chat bot responds to comments and messages on your social pages 24/7 — never miss an engagement</p>
            </td>
          </tr>
          </table>

          <!-- Feature 4: Smart Scheduler -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
          <tr>
            <td width="48" valign="top">
              <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,rgba(245,158,11,0.3),rgba(217,119,6,0.3));border:1px solid rgba(245,158,11,0.3);text-align:center;line-height:40px;">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23fcd34d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline-block;vertical-align:middle;margin-top:10px;" />
              </div>
            </td>
            <td style="padding-left:16px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Smart Scheduler &amp; SmartFlow</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Schedule posts at optimal times for maximum reach. SmartFlow automation handles repetitive tasks so you focus on strategy</p>
            </td>
          </tr>
          </table>

          <!-- Feature 5: Media Library -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
          <tr>
            <td width="48" valign="top">
              <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,rgba(59,130,246,0.3),rgba(37,99,235,0.3));border:1px solid rgba(59,130,246,0.3);text-align:center;line-height:40px;">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2393c5fd' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline-block;vertical-align:middle;margin-top:10px;" />
              </div>
            </td>
            <td style="padding-left:16px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Media Library &amp; AI Image Generator</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Centralized media library with AI-powered image generation. Create stunning visuals for your posts without a designer</p>
            </td>
          </tr>
          </table>

          <!-- Feature 6: Analytics -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:0;">
          <tr>
            <td width="48" valign="top">
              <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,rgba(239,68,68,0.3),rgba(220,38,38,0.3));border:1px solid rgba(239,68,68,0.3);text-align:center;line-height:40px;">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23fca5a5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='20' x2='18' y2='10'/%3E%3Cline x1='12' y1='20' x2='12' y2='4'/%3E%3Cline x1='6' y1='20' x2='6' y2='14'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline-block;vertical-align:middle;margin-top:10px;" />
              </div>
            </td>
            <td style="padding-left:16px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Analytics &amp; Reports</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Deep performance analytics across all platforms. Track reach, engagement, follower growth and get actionable insights</p>
            </td>
          </tr>
          </table>

        </td></tr>

        <!-- ── DIVIDER ── -->
        <tr><td style="padding:32px 48px 0;">
          <div style="height:1px;background:rgba(255,255,255,0.06);font-size:0;">&nbsp;</div>
        </td></tr>

        <!-- ── NEXT STEP: SET PASSWORD ── -->
        <tr><td style="padding:32px 48px 0;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">&#x2193;&nbsp; One Last Step</p>
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Create your password to enter your dashboard</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            You're almost there! Set your password and you'll instantly have access to your full {{planName}} dashboard — all features unlocked from day one.
          </p>

          <!-- CTA Button -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td align="center" style="border-radius:14px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 40%,#a855f7 100%);box-shadow:0 4px 32px rgba(99,102,241,0.4);">
            <a href="{{setupUrl}}" style="display:block;padding:18px 32px;text-align:center;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              &#x1F680;&nbsp; Set Up My Account &rarr;
            </a>
          </td></tr>
          </table>

          <p style="margin:16px 0 0;font-size:12px;color:#374151;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E" width="12" height="12" alt="" style="vertical-align:middle;margin-right:4px;" />
            Link expires in <strong style="color:#9ca3af;">72 hours</strong> &bull; Single use only
          </p>
        </td></tr>

        <!-- ── SUPPORT BOX ── -->
        <tr><td style="padding:28px 48px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.2);border-radius:12px;">
          <tr><td style="padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding-right:12px;vertical-align:top;">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23a5b4fc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3C/svg%3E" width="20" height="20" alt="" style="margin-top:2px;" />
              </td>
              <td>
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#a5b4fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Need help getting started?</p>
                <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  Just reply to this email — our team typically responds within a few hours. We're committed to helping you get the most out of {{appName}} from day one.
                </p>
              </td>
            </tr></table>
          </td></tr>
          </table>
        </td></tr>

        <!-- Bottom padding -->
        <tr><td style="padding:40px 48px;">
          <div style="height:1px;background:rgba(255,255,255,0.04);font-size:0;margin-bottom:32px;">&nbsp;</div>

          <!-- Social proof -->
          <p style="margin:0;font-size:12px;color:#374151;text-align:center;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            &#x1F30D;&nbsp; Trusted by social media teams and content creators worldwide
          </p>
        </td></tr>

      </table>
    </td></tr>

    <!-- ══ FOOTER ══ -->
    <tr><td align="center" style="padding:24px 20px 48px;">
      <p style="margin:0 0 10px;font-size:12px;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        If the button doesn't work, copy and paste this link:
      </p>
      <p style="margin:0 0 24px;font-size:11px;word-break:break-all;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <a href="{{setupUrl}}" style="color:#6366f1;text-decoration:none;">{{setupUrl}}</a>
      </p>
      <p style="margin:0 0 4px;font-size:11px;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        &copy; {{year}} {{appName}} &middot; Social Media Management Platform
      </p>
      <p style="margin:0;font-size:11px;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        You're receiving this because you created an {{appName}} account.
      </p>
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
<body style="margin:0;padding:0;background-color:#0d0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d14;padding:48px 16px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td align="center" style="padding:0 0 32px;">
      <img src="{{logoUrl}}" alt="{{appName}}" width="60" height="60" style="border-radius:18px;display:inline-block;box-shadow:0 0 0 1px rgba(255,255,255,0.1);" />
      <br><span style="display:inline-block;margin-top:12px;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">{{appName}}</span>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#1c1c2e,#13131f);border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
        <tr><td height="5" style="background:linear-gradient(90deg,#10b981,#059669,#047857);font-size:0;"></td></tr>
        <tr><td style="padding:44px 44px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 16px;border-radius:100px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);">
            <span style="font-size:11px;font-weight:700;color:#6ee7b7;letter-spacing:1px;">&#x2714;&nbsp;&nbsp;PAYMENT CONFIRMED</span>
          </td></tr></table>
          <div style="height:20px;">&nbsp;</div>
          <h1 style="margin:0 0 14px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">Your payment was<br>successful! &#x1F389;</h1>
          <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.75;">
            Hi <strong style="color:#e2e8f0;">{{userName}}</strong>, your <strong style="color:#6ee7b7;">{{planName}}</strong> subscription is now active.
            {{#if trialDays}}Your <strong style="color:#a5b4fc;">{{trialDays}}-day free trial</strong> begins today — no charge until <strong style="color:#ffffff;">{{nextBillingDate}}</strong>.{{else}}Your next billing date is <strong style="color:#ffffff;">{{nextBillingDate}}</strong>.{{/if}}
          </p>
        </td></tr>
        <tr><td style="padding:0 44px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(16,185,129,0.2);border-radius:14px;overflow:hidden;">
            <tr><td style="padding:18px 24px;background:rgba(16,185,129,0.07);border-bottom:1px solid rgba(16,185,129,0.1);">
              <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;">Plan</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">{{planName}}</p>
            </td></tr>
            <tr><td style="padding:18px 24px;border-bottom:1px solid rgba(16,185,129,0.1);">
              <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;">Amount</p>
              <p style="margin:0;font-size:20px;font-weight:800;color:#f1f5f9;">&#36;{{planPrice}}<span style="font-size:14px;font-weight:400;color:#64748b;">&nbsp;/ {{billingInterval}}</span></p>
            </td></tr>
            <tr><td style="padding:18px 24px;">
              <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px;">Next Billing Date</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#e2e8f0;">{{nextBillingDate}}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 44px 44px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="border-radius:12px;background:linear-gradient(135deg,#10b981,#059669);">
            <a href="{{dashboardUrl}}" style="display:block;padding:16px 32px;text-align:center;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;">
              Go to My Dashboard &rarr;
            </a>
          </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:28px 20px;">
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
<body style="margin:0;padding:0;background-color:#0d0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d14;padding:48px 16px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td align="center" style="padding:0 0 32px;">
      <img src="{{logoUrl}}" alt="{{appName}}" width="60" height="60" style="border-radius:18px;display:inline-block;" />
      <br><span style="display:inline-block;margin-top:12px;font-size:18px;font-weight:800;color:#ffffff;">{{appName}}</span>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#1c1c2e,#13131f);border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
        <tr><td height="5" style="background:linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7,#ec4899);font-size:0;"></td></tr>
        <tr><td style="padding:44px 44px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 16px;border-radius:100px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);">
            <span style="font-size:11px;font-weight:700;color:#a5b4fc;letter-spacing:1px;">&#x1F465;&nbsp;&nbsp;TEAM INVITATION</span>
          </td></tr></table>
          <div style="height:20px;">&nbsp;</div>
          <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#ffffff;">You're invited to join<br><span style="color:#a5b4fc;">{{appName}}</span>!</h1>
          <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.75;">
            You've been added as <strong style="color:#ffffff;">{{role}}</strong>. Set up your account to collaborate with your team and start managing social media together.
          </p>
        </td></tr>
        <tr><td style="padding:0 44px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;">
            <tr><td style="padding:18px 24px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1px;">Name</p>
              <p style="margin:0;font-size:15px;color:#e2e8f0;font-weight:600;">{{toName}}</p>
            </td></tr>
            <tr><td style="padding:18px 24px;">
              <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1px;">Email</p>
              <p style="margin:0;font-size:14px;color:#a5b4fc;font-family:'SF Mono','Fira Code',monospace;">{{toEmail}}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 44px 44px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);">
            <a href="{{setupUrl}}" style="display:block;padding:16px 32px;text-align:center;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;">
              Set Up My Account &rarr;
            </a>
          </td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#374151;text-align:center;">Link expires in 7 days</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:28px 20px;">
      <p style="margin:0 0 8px;font-size:12px;color:#374151;">If the button doesn't work:<br><a href="{{setupUrl}}" style="color:#6366f1;text-decoration:none;">{{setupUrl}}</a></p>
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
<body style="margin:0;padding:0;background-color:#0d0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d14;padding:48px 16px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td align="center" style="padding:0 0 32px;">
      <img src="{{logoUrl}}" alt="{{appName}}" width="60" height="60" style="border-radius:18px;display:inline-block;" />
      <br><span style="display:inline-block;margin-top:12px;font-size:18px;font-weight:800;color:#ffffff;">{{appName}}</span>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#1c1c2e,#13131f);border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
        <tr><td height="5" style="background:linear-gradient(90deg,#f59e0b,#d97706,#b45309);font-size:0;"></td></tr>
        <tr><td style="padding:44px 44px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 16px;border-radius:100px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);">
            <span style="font-size:11px;font-weight:700;color:#fcd34d;letter-spacing:1px;">&#x1F510;&nbsp;&nbsp;PASSWORD RESET</span>
          </td></tr></table>
          <div style="height:20px;">&nbsp;</div>
          <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#ffffff;">Reset your password</h1>
          <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.75;">
            Hi <strong style="color:#e2e8f0;">{{userName}}</strong>, we received a request to reset your {{appName}} password.
            This link is valid for <strong style="color:#fcd34d;">1 hour</strong> and can only be used once.<br><br>
            If you didn't request this, you can safely ignore this email — your password remains unchanged.
          </p>
        </td></tr>
        <tr><td style="padding:0 44px 44px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="border-radius:12px;background:linear-gradient(135deg,#f59e0b,#d97706);">
            <a href="{{resetUrl}}" style="display:block;padding:16px 32px;text-align:center;color:#000000;text-decoration:none;font-size:16px;font-weight:800;">
              Reset My Password &rarr;
            </a>
          </td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#374151;text-align:center;">Expires in 1 hour &bull; Single use only</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:28px 20px;">
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
