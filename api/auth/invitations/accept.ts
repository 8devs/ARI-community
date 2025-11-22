import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin.js";
import { hashPassword } from "../../../lib/server/password.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, password, name } = req.body ?? {};
  if (!token || !password || !name) {
    return res.status(400).json({ error: "Token, Name und Passwort sind erforderlich." });
  }

  const { data: invitation, error } = await supabaseAdmin
    .from("employee_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("invitation lookup failed", error);
    return res.status(500).json({ error: "Einladung konnte nicht geprüft werden." });
  }

  if (!invitation) {
    return res.status(400).json({ error: "Einladung ungültig." });
  }

  if (invitation.accepted_at) {
    return res.status(400).json({ error: "Einladung wurde bereits verwendet." });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return res.status(400).json({ error: "Einladung ist abgelaufen." });
  }

  const existing = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("email", invitation.email.toLowerCase())
    .maybeSingle();

  if (existing.data) {
    return res.status(400).json({ error: "Für diese E-Mail existiert bereits ein Zugang." });
  }

  const passwordHash = await hashPassword(String(password));
  const { data: appUser, error: insertError } = await supabaseAdmin
    .from("app_users")
    .insert({
      email: invitation.email.toLowerCase(),
      password_hash: passwordHash,
      role: invitation.role,
      organization_id: invitation.organization_id,
      name: String(name),
      is_email_verified: true,
    })
    .select("*")
    .single();

  if (insertError || !appUser) {
    console.error("app user creation failed", insertError);
    return res.status(500).json({ error: "Nutzerkonto konnte nicht angelegt werden." });
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: appUser.id,
    local_user_id: appUser.id,
    email: appUser.email,
    name: appUser.name,
    role: appUser.role,
    organization_id: appUser.organization_id,
    is_news_manager: invitation.is_news_manager ?? false,
    is_event_manager: invitation.is_event_manager ?? false,
  });

  if (profileError) {
    console.error("profile creation failed", profileError);
    return res.status(500).json({ error: "Profil konnte nicht angelegt werden." });
  }

  await supabaseAdmin
    .from("employee_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return res.status(200).json({ success: true });
}
