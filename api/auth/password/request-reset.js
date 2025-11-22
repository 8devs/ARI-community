import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin.js";
import { hashToken } from "../../../lib/server/tokens.js";
import { sendEmailNotification } from "../../../lib/server/sendEmail.js";
import { resolveSiteUrl } from "../../../lib/server/siteUrl.js";

const RESET_TOKEN_TTL_MINUTES = Number(process.env.AUTH_RESET_TOKEN_TTL_MINUTES ?? 60);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: "E-Mail wird benötigt." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const { data: user } = await supabaseAdmin
    .from("app_users")
    .select("id, email, name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!user) {
    return res.status(200).json({ success: true });
  }

  const rawToken = crypto.randomUUID();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  await supabaseAdmin.from("auth_tokens").insert({
    user_id: user.id,
    token_hash: tokenHash,
    token_type: "RESET_PASSWORD",
    expires_at: expiresAt,
  });

  const baseUrl = resolveSiteUrl(req);
  const resetUrl = `${baseUrl}/#/passwort/neu?token=${encodeURIComponent(rawToken)}`;

  await sendEmailNotification(
    user.email,
    "Passwort zurücksetzen",
    `
      <div style="border:1px solid #e2e8f0;border-radius:18px;padding:28px;margin-bottom:24px;background:#f8fafc;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
          <span style="display:inline-flex;height:48px;width:48px;border-radius:14px;background:#e0e7ff;align-items:center;justify-content:center;font-size:20px;color:#1e1b4b;">🔐</span>
          <div>
            <p style="margin:0;font-size:18px;color:#0f172a;font-weight:600;">Hallo ${user.name ?? "Community-Mitglied"},</p>
            <p style="margin:2px 0 0;font-size:14px;color:#475569;">Du kannst jetzt Dein Passwort neu vergeben.</p>
          </div>
        </div>
        <p style="font-size:15px;color:#0f172a;margin-bottom:20px;">
          Mit dem folgenden Button gelangst Du zur sicheren Seite, auf der Du ein neues Passwort hinterlegen kannst.
        </p>
        <div style="text-align:center;margin:26px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 34px;background:linear-gradient(120deg,#0f172a,#312e81);color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;box-shadow:0 12px 24px rgba(15,23,42,0.25);">
            Passwort jetzt zurücksetzen
          </a>
        </div>
        <div style="margin-top:24px;">
          <p style="font-size:13px;color:#475569;margin-bottom:8px;">Falls der Button nicht klickbar ist, kopiere diesen Link in die Adresszeile:</p>
          <p style="font-size:13px;color:#1d4ed8;margin:0;word-break:break-all;background:#fff;border:1px dashed #cbd5f5;border-radius:10px;padding:12px;">
            <a href="${resetUrl}" style="color:#1d4ed8;text-decoration:none;font-weight:600;">${resetUrl}</a>
          </p>
        </div>
      </div>
      <p style="font-size:13px;color:#475569;margin-bottom:6px;">• Der Link ist ${RESET_TOKEN_TTL_MINUTES} Minuten gültig.</p>
      <p style="font-size:13px;color:#475569;margin:0;">• Wenn Du die Anfrage nicht gestellt hast, ignoriere diese Nachricht einfach.</p>
    `,
    "Passwort",
  );

  return res.status(200).json({ success: true });
}
