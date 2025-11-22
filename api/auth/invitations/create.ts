import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { requireAuth } from "../../../lib/server/authGuard";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin";
import { sendEmailNotification } from "../../../lib/server/sendEmail";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const siteUrl = (process.env.PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
  const inviteUrl = `${siteUrl}/#/login?invite=${inviteToken}`;
  await sendEmailNotification(
    email,
    "Einladung zur ARI Community",
    `
      <p>Hallo,</p>
      <p>${inviterProfile.name ?? "Ein Admin"} hat Dich zur ARI Community eingeladen.</p>
      <p>Nutze diesen Link, um Deinen Zugang zu aktivieren:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
    `,
    "Einladung",
  );

  return res.status(201).json({ success: true, token: inviteToken });
}
