import { requireAuth } from "../../lib/server/authGuard.js";
import { supabaseAdmin } from "../../lib/server/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(`
      id,
      name,
      email,
      avatar_url,
      bio,
      skills_text,
      first_aid_certified,
      phone,
      organization_id,
      position,
      role,
      is_news_manager,
      is_event_manager,
      created_at,
      updated_at,
      organization:organizations(name)
    `)
    .order("name");

  if (error) {
    console.error("members lookup failed", error);
    return res.status(500).json({ error: "Mitarbeitende konnten nicht geladen werden." });
  }

  return res.status(200).json({ members: data ?? [] });
}
