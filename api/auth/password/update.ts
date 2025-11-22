import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../../../lib/server/authGuard";
import { hashPassword } from "../../../lib/server/password";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { password } = req.body ?? {};
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Neues Passwort ist erforderlich." });
  }

  const passwordHash = await hashPassword(password);
  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ password_hash: passwordHash })
    .eq("id", user.id);

  if (error) {
    console.error("password update failed", error);
    return res.status(500).json({ error: "Passwort konnte nicht aktualisiert werden." });
  }

  return res.status(200).json({ success: true });
}
