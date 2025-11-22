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
      <p style="font-size:15px;color:#0f172a;margin-bottom:16px;">Hallo ${user.name ?? "Community-Mitglied"},</p>
      <p style="font-size:15px;color:#0f172a;margin-bottom:16px;">
        Du hast angefordert, Dein Passwort zurückzusetzen. Klicke auf den folgenden Button und wähle ein neues Passwort.
      </p>
      <div style="margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#0f172a;color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;">
          Passwort zurücksetzen
        </a>
      </div>
      <p style="font-size:13px;color:#475569;margin-bottom:8px;">Falls der Button nicht funktioniert, kopiere diesen Link:</p>
      <p style="font-size:13px;color:#1d4ed8;margin-bottom:16px;word-break:break-all;">
        <a href="${resetUrl}" style="color:#1d4ed8;text-decoration:none;">${resetUrl}</a>
      </p>
      <p style="font-size:13px;color:#475569;margin-bottom:0;">Der Link ist ${RESET_TOKEN_TTL_MINUTES} Minuten gültig.</p>
    `,
    "Passwort",
  );

  return res.status(200).json({ success: true });
}
