import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/server/supabaseAdmin";
import { verifyPassword } from "../../lib/server/password";
import { signSession } from "../../lib/server/jwt";
import { createSessionCookie } from "../../lib/server/authCookies";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body ?? {};
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email und Passwort sind erforderlich." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, password_hash, role, organization_id, name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error("app_users lookup failed", error);
    return res.status(500).json({ error: "Anmeldung aktuell nicht möglich." });
  }

  if (!data) {
    return res.status(401).json({ error: "Ungültige Zugangsdaten." });
  }

  const isValid = await verifyPassword(password, data.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: "Ungültige Zugangsdaten." });
  }

  void supabaseAdmin
    .from("app_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.id);

  const token = signSession({
    sub: data.id,
    email: data.email,
    role: data.role,
    organization_id: data.organization_id,
  });

  res.setHeader("Set-Cookie", createSessionCookie(token));
  return res.status(200).json({
    user: {
      id: data.id,
      email: data.email,
      role: data.role,
      organization_id: data.organization_id,
      name: data.name,
    },
  });
}
