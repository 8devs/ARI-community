import { supabaseAdmin } from "../../../lib/server/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.query.token;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token fehlt." });
  }

  const { data, error } = await supabaseAdmin
    .from("employee_invitations")
    .select(
      `
        id,
        email,
        role,
        organization_id,
        expires_at,
        accepted_at,
        organization:organizations(name)
      `,
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("load invitation failed", error);
    return res.status(500).json({ error: "Einladung konnte nicht geladen werden." });
  }

  if (!data) {
    return res.status(404).json({ error: "Einladung nicht gefunden." });
  }

  return res.status(200).json({
    email: data.email,
    role: data.role,
    organization_name: data.organization?.name ?? null,
    expires_at: data.expires_at,
    accepted_at: data.accepted_at,
  });
}
