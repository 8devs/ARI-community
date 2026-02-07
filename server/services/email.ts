import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn("SMTP_HOST not configured – email sending disabled");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false",
    auth:
      process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });

  return transporter;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  options?: { from?: string }
): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn("Email not sent (no SMTP configured):", subject);
    return false;
  }

  const recipients = Array.isArray(to) ? to : [to];
  const from = options?.from ?? process.env.SMTP_FROM ?? "notifications@ari-worms.de";

  try {
    await t.sendMail({ from, to: recipients, subject, html });
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}

export async function sendEmailNotification(
  to: string | string[],
  subject: string,
  html: string,
  badge?: string
): Promise<boolean> {
  // Wrap in branded template
  const wrappedHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${badge ? `<div style="background: #3b82f6; color: white; display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">${badge}</div>` : ""}
      ${html}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9ca3af;">ARI Community App</p>
    </div>
  `;
  return sendEmail(to, subject, wrappedHtml);
}
