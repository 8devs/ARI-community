import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { sendEmailNotification } from "../services/email.js";
import { emitToUser } from "../services/realtime.js";

const router = Router();

// ─── POST /api/notifications/info-post ───────────────────────────────
// Replaces: supabase/functions/notify-info-post
router.post("/info-post", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { post_id, title, audience, target_organization_id } = req.body;

  // Get all profiles to notify
  const where: any = { prefEmailNotifications: true };
  if (audience === "ORG_ONLY" && target_organization_id) {
    where.organizationId = target_organization_id;
  }

  const profiles = await prisma.profile.findMany({
    where,
    select: { id: true, email: true, name: true, prefEmailNotifications: true },
  });

  // Create in-app notifications
  const notifications = profiles
    .filter((p) => p.id !== user.id)
    .map((p) => ({
      userId: p.id,
      title: "Neuer Pinnwand-Beitrag",
      body: title,
      type: "INFO" as const,
      url: `/#/pinnwand`,
    }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });

    // Emit realtime notifications
    for (const n of notifications) {
      emitToUser(n.userId, "notification:new", n);
    }
  }

  // Send emails to those who want them
  const emailRecipients = profiles
    .filter((p) => p.id !== user.id && p.prefEmailNotifications)
    .map((p) => p.email);

  if (emailRecipients.length > 0) {
    // Send in batches of 50
    for (let i = 0; i < emailRecipients.length; i += 50) {
      const batch = emailRecipients.slice(i, i + 50);
      await sendEmailNotification(
        batch,
        `Pinnwand: ${title}`,
        `<p>Es gibt einen neuen Beitrag auf der Pinnwand: <strong>${title}</strong></p>`,
        "Pinnwand",
      );
    }
  }

  return res.json({ success: true, notified: notifications.length });
});

// ─── POST /api/notifications/qna ─────────────────────────────────────
// Replaces: supabase/functions/notify-qna-question
router.post("/qna", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { question_id, title } = req.body;

  // Get the question creator's org
  const question = await prisma.question.findUnique({
    where: { id: question_id },
    select: { createdBy: { select: { organizationId: true } } },
  });

  if (!question) return res.status(404).json({ error: "Frage nicht gefunden." });

  // Notify admins of the same org
  const admins = await prisma.profile.findMany({
    where: {
      organizationId: question.createdBy.organizationId,
      role: { in: ["SUPER_ADMIN", "ORG_ADMIN"] },
      id: { not: user.id },
    },
    select: { id: true, email: true, prefEmailNotifications: true },
  });

  const notifications = admins.map((a) => ({
    userId: a.id,
    title: "Neue Frage im Q&A",
    body: title,
    type: "QNA" as const,
    url: `/#/qa`,
  }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
    for (const n of notifications) {
      emitToUser(n.userId, "notification:new", n);
    }
  }

  const emailRecipients = admins
    .filter((a) => a.prefEmailNotifications)
    .map((a) => a.email);

  if (emailRecipients.length > 0) {
    await sendEmailNotification(
      emailRecipients,
      `Q&A: ${title}`,
      `<p>Es wurde eine neue Frage gestellt: <strong>${title}</strong></p>`,
      "Q&A",
    );
  }

  return res.json({ success: true });
});

// ─── POST /api/notifications/booking ─────────────────────────────────
// Replaces: supabase/functions/notify-room-booking
router.post("/booking", async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: "to, subject, html required" });
  }

  await sendEmailNotification(to, subject, html, "Raumbuchung");
  return res.json({ success: true });
});

export default router;
