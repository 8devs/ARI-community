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
    .from("organizations")
    .select("*")
    .order("name");

  if (error) {
    console.error("organizations lookup failed", error);
    return res.status(500).json({ error: "Organisationen konnten nicht geladen werden." });
  }

  return res.status(200).json({ organizations: data ?? [] });
}
