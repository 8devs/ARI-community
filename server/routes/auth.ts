import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { signSession } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { hashToken } from "../lib/tokens.js";
import { resolveSiteUrl } from "../lib/siteUrl.js";
import { createSessionCookie, clearSessionCookie, requireAuth, getSessionUser } from "../middleware/auth.js";
import { sendEmailNotification } from "../services/email.js";

const router = Router();

const RESET_TOKEN_TTL_MINUTES = Number(process.env.AUTH_RESET_TOKEN_TTL_MINUTES ?? 60);

// ─── POST /api/auth/login ────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email und Passwort sind erforderlich." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const data = await prisma.appUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, passwordHash: true, role: true, organizationId: true, name: true },
  });

  if (!data) {
    return res.status(401).json({ error: "Ungültige Zugangsdaten." });
  }

  const isValid = await verifyPassword(password, data.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Ungültige Zugangsdaten." });
  }

  // Update last login (fire and forget)
  prisma.appUser.update({ where: { id: data.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const token = signSession({
    sub: data.id,
    email: data.email,
    role: data.role,
    organization_id: data.organizationId,
  });

  res.setHeader("Set-Cookie", createSessionCookie(token));
  return res.status(200).json({
    user: {
      id: data.id,
      email: data.email,
      role: data.role,
      organization_id: data.organizationId,
      name: data.name,
    },
  });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ success: true });
});

// ─── GET /api/auth/session ───────────────────────────────────────────
router.get("/session", async (req, res) => {
  const user = await getSessionUser(req);
  return res.status(200).json({ user: user ?? null });
});

// ─── POST /api/auth/register ─────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { email, password, role = "MEMBER", organization_id, name } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email und Passwort sind erforderlich." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await hashPassword(String(password));

  try {
    const data = await prisma.appUser.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role,
        organizationId: organization_id ?? null,
        name: name ?? null,
      },
      select: { id: true },
    });
    return res.status(201).json({ userId: data.id });
  } catch (error: any) {
    console.error("create app user failed", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "E-Mail-Adresse bereits registriert." });
    }
    return res.status(500).json({ error: "Nutzer konnte nicht angelegt werden." });
  }
});

// ─── POST /api/auth/password/request-reset ───────────────────────────
router.post("/password/request-reset", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: "E-Mail wird benötigt." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await prisma.appUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.status(200).json({ success: true });
  }

  const rawToken = crypto.randomUUID();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.authToken.create({
    data: {
      userId: user.id,
      tokenHash,
      tokenType: "RESET_PASSWORD",
      expiresAt,
    },
  });

  const baseUrl = resolveSiteUrl(req);
  const resetUrl = `${baseUrl}/#/passwort/neu?token=${encodeURIComponent(rawToken)}`;

  await sendEmailNotification(
    user.email,
    "Passwort zurücksetzen",
    `
      <div style="border:1px solid #e2e8f0;border-radius:18px;padding:28px;margin-bottom:24px;background:#f8fafc;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
          <span style="display:inline-flex;height:48px;width:48px;border-radius:14px;background:#e0e7ff;align-items:center;justify-content:center;font-size:20px;color:#1e1b4b;">🔐</span>
          <div>
            <p style="margin:0;font-size:18px;color:#0f172a;font-weight:600;">Hallo ${user.name ?? "Community-Mitglied"},</p>
            <p style="margin:2px 0 0;font-size:14px;color:#475569;">Du kannst jetzt Dein Passwort neu vergeben.</p>
          </div>
        </div>
        <p style="font-size:15px;color:#0f172a;margin-bottom:20px;">
          Mit dem folgenden Button gelangst Du zur sicheren Seite, auf der Du ein neues Passwort hinterlegen kannst.
        </p>
        <div style="text-align:center;margin:26px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 34px;background:linear-gradient(120deg,#0f172a,#312e81);color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;box-shadow:0 12px 24px rgba(15,23,42,0.25);">
            Passwort jetzt zurücksetzen
          </a>
        </div>
        <div style="margin-top:24px;">
          <p style="font-size:13px;color:#475569;margin-bottom:8px;">Falls der Button nicht klickbar ist, kopiere diesen Link in die Adresszeile:</p>
          <p style="font-size:13px;color:#1d4ed8;margin:0;word-break:break-all;background:#fff;border:1px dashed #cbd5f5;border-radius:10px;padding:12px;">
            <a href="${resetUrl}" style="color:#1d4ed8;text-decoration:none;font-weight:600;">${resetUrl}</a>
          </p>
        </div>
      </div>
      <p style="font-size:13px;color:#475569;margin-bottom:6px;">• Der Link ist ${RESET_TOKEN_TTL_MINUTES} Minuten gültig.</p>
      <p style="font-size:13px;color:#475569;margin:0;">• Wenn Du die Anfrage nicht gestellt hast, ignoriere diese Nachricht einfach.</p>
    `,
    "Passwort",
  );

  return res.status(200).json({ success: true });
});

// ─── POST /api/auth/password/reset ───────────────────────────────────
router.post("/password/reset", async (req, res) => {
  const { token, password } = req.body ?? {};
  if (!token || !password) {
    return res.status(400).json({ error: "Token und neues Passwort sind erforderlich." });
  }

  const tokenHash = hashToken(String(token));
  const tokenRow = await prisma.authToken.findFirst({
    where: {
      tokenHash,
      tokenType: "RESET_PASSWORD",
      usedAt: null,
    },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!tokenRow || tokenRow.expiresAt < new Date()) {
    return res.status(400).json({ error: "Der Link ist ungültig oder abgelaufen." });
  }

  const passwordHash = await hashPassword(String(password));

  await prisma.appUser.update({
    where: { id: tokenRow.userId },
    data: { passwordHash },
  });

  await prisma.authToken.update({
    where: { id: tokenRow.id },
    data: { usedAt: new Date() },
  });

  return res.status(200).json({ success: true });
});

// ─── POST /api/auth/password/update ──────────────────────────────────
router.post("/password/update", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { password } = req.body ?? {};
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Neues Passwort ist erforderlich." });
  }

  const passwordHash = await hashPassword(password);
  await prisma.appUser.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return res.status(200).json({ success: true });
});

// ─── POST /api/auth/invitations/create ───────────────────────────────
router.post("/invitations/create", async (req, res) => {
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

  const inviterProfile = await prisma.profile.findFirst({
    where: { localUserId: user.id },
    select: { id: true, name: true },
  });

  if (!inviterProfile) {
    return res.status(400).json({ error: "Profil des Einladenden nicht gefunden." });
  }

  const inviteToken = crypto.randomUUID();

  try {
    await prisma.employeeInvitation.create({
      data: {
        email: String(email).trim().toLowerCase(),
        organizationId: orgId,
        invitedBy: inviterProfile.id,
        role,
        token: inviteToken,
        isNewsManager: is_news_manager,
        isEventManager: is_event_manager,
      },
    });
  } catch (error: any) {
    console.error("create invitation failed", error);
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Für diese Organisation existiert bereits eine Einladung mit dieser E-Mail-Adresse.",
      });
    }
    return res.status(500).json({ error: "Einladung konnte nicht erstellt werden." });
  }

  const siteUrl = resolveSiteUrl(req);
  const inviteUrl = `${siteUrl}/#/login?invite=${inviteToken}`;
  const inviteeName =
    typeof req.body?.name === "string" && req.body.name.trim().length > 0
      ? req.body.name.trim()
      : "Community-Mitglied";

  await sendEmailNotification(
    email,
    "Einladung zur ARI Community",
    `
      <p style="font-size:15px;color:#0f172a;margin-bottom:16px;">Hallo ${inviteeName},</p>
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
});

// ─── GET /api/auth/invitations/details ───────────────────────────────
router.get("/invitations/details", async (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token fehlt." });
  }

  const data = await prisma.employeeInvitation.findFirst({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      expiresAt: true,
      acceptedAt: true,
      organization: { select: { name: true } },
    },
  });

  if (!data) {
    return res.status(404).json({ error: "Einladung nicht gefunden." });
  }

  return res.status(200).json({
    email: data.email,
    role: data.role,
    organization_name: data.organization?.name ?? null,
    expires_at: data.expiresAt,
    accepted_at: data.acceptedAt,
  });
});

// ─── POST /api/auth/invitations/accept ───────────────────────────────
router.post("/invitations/accept", async (req, res) => {
  const { token, password, name } = req.body ?? {};
  if (!token || !password || !name) {
    return res.status(400).json({ error: "Token, Name und Passwort sind erforderlich." });
  }

  const invitation = await prisma.employeeInvitation.findFirst({
    where: { token: String(token) },
  });

  if (!invitation) {
    return res.status(400).json({ error: "Einladung ungültig." });
  }

  if (invitation.acceptedAt) {
    return res.status(400).json({ error: "Einladung wurde bereits verwendet." });
  }

  if (invitation.expiresAt < new Date()) {
    return res.status(400).json({ error: "Einladung ist abgelaufen." });
  }

  const existing = await prisma.appUser.findUnique({
    where: { email: invitation.email.toLowerCase() },
    select: { id: true },
  });

  if (existing) {
    return res.status(400).json({ error: "Für diese E-Mail existiert bereits ein Zugang." });
  }

  const passwordHash = await hashPassword(String(password));

  try {
    const appUser = await prisma.appUser.create({
      data: {
        email: invitation.email.toLowerCase(),
        passwordHash,
        role: invitation.role,
        organizationId: invitation.organizationId,
        name: String(name),
        isEmailVerified: true,
      },
    });

    await prisma.profile.create({
      data: {
        id: appUser.id,
        localUserId: appUser.id,
        email: appUser.email,
        name: appUser.name ?? String(name),
        role: appUser.role,
        organizationId: appUser.organizationId!,
        isNewsManager: invitation.isNewsManager,
        isEventManager: invitation.isEventManager,
      },
    });

    await prisma.employeeInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("invitation accept failed", error);
    return res.status(500).json({ error: "Nutzerkonto konnte nicht angelegt werden." });
  }
});

// ─── POST /api/auth/members/delete ───────────────────────────────────
router.post("/members/delete", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const { user_id: targetUserId } = req.body ?? {};
  if (!targetUserId || typeof targetUserId !== "string") {
    return res.status(400).json({ error: "user_id ist erforderlich." });
  }

  if (targetUserId === user.id) {
    return res.status(400).json({ error: "Du kannst Dich nicht selbst löschen." });
  }

  const targetProfile = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, organizationId: true },
  });

  if (!targetProfile) {
    return res.status(404).json({ error: "Nutzer wurde nicht gefunden." });
  }

  if (targetProfile.role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super-Admins können nur von Super-Admins gelöscht werden." });
  }

  if (user.role === "ORG_ADMIN") {
    if (!user.organization_id || !targetProfile.organizationId || user.organization_id !== targetProfile.organizationId) {
      return res.status(403).json({ error: "Du kannst nur Mitglieder Deiner Organisation löschen." });
    }
    if (targetProfile.role === "ORG_ADMIN" || targetProfile.role === "SUPER_ADMIN") {
      return res.status(403).json({ error: "Du kannst keine Admins löschen." });
    }
  }

  // Delete profile first, then app_user (cascade should handle, but explicit for safety)
  await prisma.profile.delete({ where: { id: targetUserId } });
  await prisma.appUser.delete({ where: { id: targetUserId } });

  return res.status(200).json({ success: true });
});

export default router;
