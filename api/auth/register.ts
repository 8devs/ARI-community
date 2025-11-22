import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../../lib/server/supabaseAdmin.js";
import { hashPassword } from "../../lib/server/password.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, role = "MEMBER", organization_id, name } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email und Passwort sind erforderlich." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await hashPassword(String(password));

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .insert({
      email: normalizedEmail,
      password_hash: passwordHash,
      role,
      organization_id: organization_id ?? null,
      name: name ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("create app user failed", error);
    return res.status(500).json({ error: "Nutzer konnte nicht angelegt werden." });
  }

  return res.status(201).json({ userId: data.id });
}
