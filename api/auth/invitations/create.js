import crypto from "crypto";
import { requireAuth } from "../../../lib/server/authGuard.js";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin.js";
import { sendEmailNotification } from "../../../lib/server/sendEmail.js";
import { resolveSiteUrl } from "../../../lib/server/siteUrl.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const {
    email,
    organization_id,
    role = "MEMBER",
    is_news_manager = false,
    is_event_manager = false,
  } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: "E-Mail wird benötigt." });
  }

  const orgId = user.role === "SUPER_ADMIN" ? organization_id : user.organization_id;
  if (!orgId) {
    return res.status(400).json({ error: "Organisation muss angegeben werden." });
  }

  const { data: inviterProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, name")
    .eq("local_user_id", user.id)
    .maybeSingle();

  if (!inviterProfile) {
    return res.status(400).json({ error: "Profil des Einladenden nicht gefunden." });
  }

  const inviteToken = crypto.randomUUID();
  const { error } = await supabaseAdmin.from("employee_invitations").insert({
    email: String(email).trim().toLowerCase(),
    organization_id: orgId,
    invited_by: inviterProfile.id,
    role,
    token: inviteToken,
    is_news_manager,
    is_event_manager,
  });

  if (error) {
    console.error("create invitation failed", error);
    return res.status(500).json({ error: "Einladung konnte nicht erstellt werden." });
  }

  const siteUrl = resolveSiteUrl(req);
  const inviteUrl = `${siteUrl}/#/login?invite=${inviteToken}`;
  await sendEmailNotification(
    email,
    "Einladung zur ARI Community",
    `
      <p style="font-size:15px;color:#0f172a;margin-bottom:16px;">Hallo ${payload.name.trim() || "Community-Mitglied"},</p>
      <p style="font-size:15px;color:#0f172a;margin-bottom:16px;">
        ${inviterProfile.name ?? "Eine Administratorin"} hat Dich eingeladen, Teil der ARI Community zu werden.
        Mit Deinem Zugang kannst Du Räume buchen, Pinnwände lesen und Dich mit Kolleg:innen vernetzen.
      </p>
      <div style="margin:24px 0;">
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 28px;background:#0f172a;color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;">
          Einladung annehmen
        </a>
      </div>
      <p style="font-size:13px;color:#475569;margin-bottom:8px;">Falls der Button nicht funktioniert, kopiere diesen Link:</p>
      <p style="font-size:13px;color:#1d4ed8;margin-bottom:16px;word-break:break-all;">
        <a href="${inviteUrl}" style="color:#1d4ed8;text-decoration:none;">${inviteUrl}</a>
      </p>
      <p style="font-size:13px;color:#475569;margin-bottom:0;">
        Die Einladung ist 14 Tage gültig. Bei Fragen melde Dich gerne beim Community-Team.
      </p>
    `,
    "Einladung",
  );

  return res.status(201).json({ success: true, token: inviteToken });
}
