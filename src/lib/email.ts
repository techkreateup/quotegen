import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "QuoteGen <onboarding@resend.dev>";

/** Extract the bare address from a "Name <addr@dom>" or plain "addr@dom" string. */
function fromAddress(): string {
  const m = FROM.match(/<([^>]+)>/);
  return (m ? m[1] : FROM).trim();
}

/**
 * Sends an email via Resend. Without RESEND_API_KEY (local dev), logs the
 * content to the server console instead so flows remain testable.
 * Returns true if the email was actually sent.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  // Display name to show as the sender, e.g. the company name. The actual
  // address stays our verified domain (SPF/DKIM) so it doesn't fail auth — only
  // the friendly name changes: "Acme Solutions <noreply-quotegen@kreateup.in>".
  fromName?: string;
  // PDF/file attachments. `content` is base64 (e.g. a client-generated invoice
  // PDF passed through to the send API). Resend accepts base64 string content.
  // `contentId` makes an attachment inline (referenced via cid: in the HTML) —
  // used to embed a data-URI logo that email clients would otherwise block.
  attachments?: { filename: string; content: string; contentId?: string; contentType?: string }[];
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:dev] To: ${opts.to}\nSubject: ${opts.subject}\n${opts.html}`);
    return false;
  }
  try {
    const resend = new Resend(apiKey);
    const from = opts.fromName ? `${opts.fromName.replace(/[<>]/g, "")} <${fromAddress()}>` : FROM;
    const { error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.cc?.length ? { cc: opts.cc } : {}),
      ...(opts.bcc?.length ? { bcc: opts.bcc } : {}),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.attachments?.length
        ? {
            attachments: opts.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              ...(a.contentId ? { content_id: a.contentId } : {}),
              ...(a.contentType ? { content_type: a.contentType } : {}),
            })),
          }
        : {}),
    });
    if (error) {
      console.error("Email send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}

export function passwordResetEmail(name: string, link: string): string {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
    <h2>Reset your password</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click the button below — the link is valid for 1 hour and can be used once.</p>
    <p><a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Reset password</a></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  </div>`;
}

const wrap = (inner: string) =>
  `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">${inner}</div>`;

export function paymentReceiptEmail(
  name: string,
  planName: string,
  amountInr: string,
  invoiceNumber: string,
  invoiceUrl?: string,
): string {
  const appUrl = process.env.APP_URL || "https://quotegen.kreateup.in";
  const fullUrl = invoiceUrl ? (invoiceUrl.startsWith("http") ? invoiceUrl : `${appUrl}${invoiceUrl}`) : `${appUrl}/billing`;
  const buttonLabel = invoiceUrl ? "View GST invoice" : "View billing history";
  return wrap(`
    <h2>Payment received — thank you!</h2>
    <p>Hi ${name},</p>
    <p>We've received your payment of <strong>${amountInr}</strong> for the <strong>${planName}</strong> plan. Your subscription is now active.</p>
    <p>Your GST tax invoice <strong>${invoiceNumber}</strong> has been generated. You can view or download it anytime:</p>
    <p style="margin:18px 0"><a href="${fullUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600">${buttonLabel}</a></p>
    <p style="font-size:13px;color:#6b7280">All your invoices are also available at <a href="${appUrl}/billing" style="color:#4f46e5">Billing & Invoices</a> inside QuoteGen.</p>
    <p>— The QuoteGen team</p>`);
}

export function paymentFailedEmail(name: string, retryUrl: string): string {
  return wrap(`
    <h2>Payment failed</h2>
    <p>Hi ${name},</p>
    <p>We couldn't process your recent subscription payment. Your account is in a grace period —
    please update your payment to avoid interruption.</p>
    <p><a href="${retryUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Retry payment</a></p>`);
}

export function subscriptionCanceledEmail(name: string): string {
  return wrap(`
    <h2>Subscription canceled</h2>
    <p>Hi ${name},</p>
    <p>Your QuoteGen subscription has been canceled. You'll keep access until the end of your current
    billing period. We'd love to have you back anytime.</p>`);
}

export function renewalReminderEmail(
  name: string,
  planName: string,
  daysLeft: number,
  renewUrl: string,
  amountInr: string,
): string {
  const urgent = daysLeft <= 1;
  const headline = daysLeft === 0
    ? `Your ${planName} plan renews today`
    : daysLeft === 1
      ? `Your ${planName} plan renews tomorrow`
      : `Your ${planName} plan renews in ${daysLeft} days`;
  const buttonColor = urgent ? "#dc2626" : "#4f46e5";
  return wrap(`
    <h2>${headline}</h2>
    <p>Hi ${name},</p>
    <p>Your <strong>${planName}</strong> subscription with QuoteGen is up for renewal
    ${daysLeft === 0 ? "<strong>today</strong>" : daysLeft === 1 ? "<strong>tomorrow</strong>" : `in <strong>${daysLeft} days</strong>`}.
    Pay <strong>${amountInr}</strong> to keep your access without interruption.</p>
    <p style="margin:18px 0"><a href="${renewUrl}" style="display:inline-block;background:${buttonColor};color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600">Renew now</a></p>
    <p style="font-size:13px;color:#6b7280">If your subscription lapses, your account drops to the Free plan and some features become unavailable. You can renew anytime.</p>`);
}

export function renewalLapsedEmail(name: string, planName: string, renewUrl: string): string {
  return wrap(`
    <h2>Your subscription has expired</h2>
    <p>Hi ${name},</p>
    <p>Your <strong>${planName}</strong> plan expired today and your account has dropped to the
    Free plan. Some features are now disabled.</p>
    <p style="margin:18px 0"><a href="${renewUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600">Renew now</a></p>
    <p style="font-size:13px;color:#6b7280">Your data is safe and will reappear immediately on renewal.</p>`);
}

export function trialReminderEmail(name: string, daysLeft: number, upgradeUrl: string): string {
  return wrap(`
    <h2>${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial</h2>
    <p>Hi ${name},</p>
    <p>Your QuoteGen free trial ends in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.
    Upgrade now to keep everything running without interruption.</p>
    <p><a href="${upgradeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Upgrade now</a></p>`);
}

export function verificationEmail(name: string, link: string): string {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
    <h2>Verify your email</h2>
    <p>Hi ${name},</p>
    <p>Welcome to QuoteGen! Please confirm your email address to activate your account.</p>
    <p><a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Verify email</a></p>
    <p>If you didn't create this account, you can safely ignore this email.</p>
  </div>`;
}

export function inviteEmail(name: string, companyName: string, email: string, tempPassword: string, loginUrl: string): string {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
    <h2>You've been invited to ${companyName}</h2>
    <p>Hi ${name},</p>
    <p>An account has been created for you on QuoteGen.</p>
    <p><strong>Email:</strong> ${email}<br/><strong>Temporary password:</strong> ${tempPassword}</p>
    <p>You'll be asked to set a new password on first login.</p>
    <p><a href="${loginUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Log in</a></p>
  </div>`;
}
