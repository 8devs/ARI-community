import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin";
import { hashPassword } from "../../../lib/server/password";
import { hashToken } from "../../../lib/server/tokens";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, password } = req.body ?? {};
  if (!token || !password) {
    return res.status(400).json({ error: "Token und neues Passwort sind erforderlich." });
  }

  const tokenHash = hashToken(String(token));
  const { data: tokenRow, error } = await supabaseAdmin
    .from("auth_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .eq("token_type", "RESET_PASSWORD")
    .is("used_at", null)
    .maybeSingle();

  if (error) {
    console.error("reset token lookup failed", error);
    return res.status(500).json({ error: "Zurücksetzen nicht möglich." });
  }

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return res.status(400).json({ error: "Der Link ist ungültig oder abgelaufen." });
  }

  const passwordHash = await hashPassword(String(password));
  const { error: updateError } = await supabaseAdmin
    .from("app_users")
    .update({ password_hash: passwordHash })
    .eq("id", tokenRow.user_id);

  if (updateError) {
    console.error("password update failed", updateError);
    return res.status(500).json({ error: "Passwort konnte nicht gespeichert werden." });
  }

  await supabaseAdmin
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return res.status(200).json({ success: true });
}
