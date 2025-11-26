// These files live at repo/lib/server; the function root is /api/auth/members,
// so we only need to go three levels up.
import { requireAuth } from "../../../lib/server/authGuard.js";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const { user_id: targetUserId } = req.body ?? {};
  if (!targetUserId || typeof targetUserId !== "string") {
    return res.status(400).json({ error: "user_id ist erforderlich." });
  }

  if (targetUserId === user.id) {
    return res.status(400).json({ error: "Du kannst Dich nicht selbst löschen." });
  }

  const { data: targetProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) {
    console.error("load target profile failed", profileError);
    return res.status(500).json({ error: "Nutzer konnte nicht geprüft werden." });
  }

  if (!targetProfile) {
    return res.status(404).json({ error: "Nutzer wurde nicht gefunden." });
  }

  if (targetProfile.role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super-Admins können nur von Super-Admins gelöscht werden." });
  }

  if (user.role === "ORG_ADMIN") {
    if (
      !user.organization_id ||
      !targetProfile.organization_id ||
      user.organization_id !== targetProfile.organization_id
    ) {
      return res.status(403).json({ error: "Du kannst nur Mitglieder Deiner Organisation löschen." });
    }
    if (targetProfile.role === "ORG_ADMIN" || targetProfile.role === "SUPER_ADMIN") {
      return res.status(403).json({ error: "Du kannst keine Admins löschen." });
    }
  }

  const { error: deleteError } = await supabaseAdmin.from("app_users").delete().eq("id", targetUserId);
  if (deleteError) {
    console.error("delete app_user failed", deleteError);
    return res.status(500).json({ error: "Nutzer konnte nicht gelöscht werden." });
  }

  return res.status(200).json({ success: true });
}
