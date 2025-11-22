import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin.js";
import { hashToken } from "../../../lib/server/tokens.js";
import { sendEmailNotification } from "../../../lib/server/sendEmail.js";

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

  const resetUrlBase = process.env.PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "";
  const base = resetUrlBase.replace(/\/$/, "");
  const resetUrl = base
    ? `${base}/#/passwort/neu?token=${encodeURIComponent(rawToken)}`
    : rawToken;

  await sendEmailNotification(
    user.email,
    "Passwort zurücksetzen",
    `
      <p>Hallo ${user.name ?? "Community-Mitglied"},</p>
      <p>Nutze den folgenden Link, um Dein Passwort zurückzusetzen:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Der Link ist ${RESET_TOKEN_TTL_MINUTES} Minuten gültig.</p>
    `,
    "Passwort",
  );

  return res.status(200).json({ success: true });
}
