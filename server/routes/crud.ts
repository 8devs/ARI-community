import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { emitToUser, emitToAdmins } from "../services/realtime.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════

router.get("/notifications", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const data = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return res.json({ data: data.map(mapNotification) });
});

router.patch("/notifications/:id/read", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.notification.update({
    where: { id: req.params.id, userId: user.id },
    data: { readAt: new Date() },
  });
  return res.json({ success: true });
});

router.post("/notifications/read-all", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return res.json({ success: true });
});

router.delete("/notifications/all", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.notification.deleteMany({ where: { userId: user.id } });
  return res.json({ success: true });
});

router.delete("/notifications/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  await prisma.notification.delete({ where: { id: req.params.id, userId: user.id } });
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════

router.get("/messages/threads", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  // Replaces the get_message_threads RPC
  const messages = await prisma.employeeMessage.findMany({
    where: { OR: [{ senderId: user.id }, { recipientId: user.id }] },
    orderBy: { createdAt: "desc" },
  });

  const threadsMap = new Map<string, any>();
  for (const msg of messages) {
    const partnerId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
    if (!threadsMap.has(partnerId)) {
      threadsMap.set(partnerId, {
        partner_id: partnerId,
        last_message: msg.body,
        last_created_at: msg.createdAt,
        last_sender_id: msg.senderId,
        unread_count: 0,
      });
    }
    if (msg.recipientId === user.id && !msg.readAt) {
      const thread = threadsMap.get(partnerId)!;
      thread.unread_count++;
    }
  }

  return res.json({ data: Array.from(threadsMap.values()) });
});

router.get("/messages/:partnerId", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const partnerId = req.params.partnerId;
  const data = await prisma.employeeMessage.findMany({
    where: {
      OR: [
        { senderId: user.id, recipientId: partnerId },
        { senderId: partnerId, recipientId: user.id },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  return res.json({ data: data.map(mapMessage) });
});

router.post("/messages", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { recipient_id, body } = req.body;
  const msg = await prisma.employeeMessage.create({
    data: { senderId: user.id, recipientId: recipient_id, body },
  });

  emitToUser(recipient_id, "message:new", mapMessage(msg));
  return res.status(201).json({ data: mapMessage(msg) });
});

router.patch("/messages/read", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids array required" });

  await prisma.employeeMessage.updateMany({
    where: { id: { in: ids }, recipientId: user.id },
    data: { readAt: new Date() },
  });
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// PROFILES (for Messages page people list)
// ═══════════════════════════════════════════════════════════════════════

router.get("/profiles", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.profile.findMany({
    select: {
      id: true, name: true, email: true, avatarUrl: true, organizationId: true,
      bio: true, skillsText: true, phone: true, position: true,
      firstAidCertified: true, prefEmailNotifications: true,
      organization: { select: { name: true, logoUrl: true } },
    },
    orderBy: { name: "asc" },
  });

  return res.json({
    data: data.map((p) => ({
      id: p.id, name: p.name, email: p.email,
      avatar_url: p.avatarUrl, organization_id: p.organizationId,
      bio: p.bio, skills_text: p.skillsText, phone: p.phone,
      position: p.position, first_aid_certified: p.firstAidCertified,
      pref_email_notifications: p.prefEmailNotifications,
      organization: p.organization ? { name: p.organization.name, logo_url: p.organization.logoUrl } : null,
    })),
  });
});

router.patch("/profiles/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.params.id !== user.id && user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Keine Berechtigung." });
  }

  const allowed = [
    "name", "bio", "skillsText", "phone", "avatarUrl", "position",
    "firstAidCertified", "firstAidAvailable", "firstAidAvailableSince",
    "prefEmailNotifications", "prefPushNotifications",
  ];

  // Map snake_case from frontend to camelCase Prisma fields
  const fieldMap: Record<string, string> = {
    skills_text: "skillsText",
    avatar_url: "avatarUrl",
    first_aid_certified: "firstAidCertified",
    first_aid_available: "firstAidAvailable",
    first_aid_available_since: "firstAidAvailableSince",
    pref_email_notifications: "prefEmailNotifications",
    pref_push_notifications: "prefPushNotifications",
  };

  const updateData: any = {};
  for (const [key, value] of Object.entries(req.body)) {
    const prismaKey = fieldMap[key] ?? key;
    if (allowed.includes(prismaKey)) {
      updateData[prismaKey] = value;
    }
  }

  const data = await prisma.profile.update({
    where: { id: req.params.id },
    data: updateData,
  });

  return res.json({ data });
});

// ═══════════════════════════════════════════════════════════════════════
// ORGANIZATIONS
// ═══════════════════════════════════════════════════════════════════════

router.get("/organizations", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  // Replaces get_organizations_with_counts RPC
  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { profiles: true } } },
  });

  return res.json({
    data: orgs.map((o) => ({
      id: o.id, name: o.name, logo_url: o.logoUrl,
      location_text: o.locationText, cost_center_code: o.costCenterCode,
      contact_email: o.contactEmail, contact_name: o.contactName,
      contact_phone: o.contactPhone, website_url: o.websiteUrl,
      created_at: o.createdAt, member_count: o._count.profiles,
    })),
  });
});

router.get("/organizations/simple", async (req, res) => {
  const data = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return res.json({ data });
});

router.post("/organizations", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN"] });
  if (!user) return;

  const data = await prisma.organization.create({ data: mapOrgInput(req.body) });
  return res.status(201).json({ data: mapOrgOutput(data) });
});

router.patch("/organizations/:id", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const data = await prisma.organization.update({
    where: { id: req.params.id },
    data: mapOrgInput(req.body),
  });
  return res.json({ data: mapOrgOutput(data) });
});

router.delete("/organizations/:id", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN"] });
  if (!user) return;
  await prisma.organization.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// INFO POSTS (Pinnwand)
// ═══════════════════════════════════════════════════════════════════════

// Public endpoint for Index page
router.get("/info-posts/public", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const data = await prisma.infoPost.findMany({
    where: { audience: "PUBLIC" },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      createdBy: { select: { name: true } },
    },
  });

  return res.json({
    data: data.map((p) => ({
      id: p.id, title: p.title, content: p.content,
      created_at: p.createdAt, pinned: p.pinned,
      created_by: p.createdBy ? { name: p.createdBy.name } : null,
    })),
  });
});

router.get("/info-posts", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.infoPost.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true, avatarUrl: true, organizationId: true, organization: { select: { name: true } } },
      },
    },
  });

  return res.json({
    data: data.map((p) => ({
      id: p.id, title: p.title, content: p.content, audience: p.audience,
      target_organization_id: p.targetOrganizationId,
      created_by_id: p.createdById,
      attachment_url: p.attachmentUrl, pinned: p.pinned,
      created_at: p.createdAt,
      created_by: p.createdBy ? {
        id: p.createdBy.id, name: p.createdBy.name,
        avatar_url: p.createdBy.avatarUrl,
        organization_id: p.createdBy.organizationId,
        organization: p.createdBy.organization,
      } : null,
    })),
  });
});

router.post("/info-posts", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { title, content, audience, target_organization_id, attachment_url } = req.body;
  const data = await prisma.infoPost.create({
    data: {
      title, content,
      audience: audience ?? "PUBLIC",
      targetOrganizationId: target_organization_id,
      createdById: user.id,
      attachmentUrl: attachment_url,
    },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.patch("/info-posts/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { title, content, attachment_url } = req.body;
  await prisma.infoPost.update({
    where: { id: req.params.id },
    data: { title, content, attachmentUrl: attachment_url },
  });
  return res.json({ success: true });
});

router.delete("/info-posts/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.infoPost.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// Q&A (Questions & Answers)
// ═══════════════════════════════════════════════════════════════════════

router.get("/questions", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true, organizationId: true, organization: { select: { name: true } } } },
      answers: {
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true, organizationId: true, organization: { select: { name: true } } } },
          votes: { select: { voterId: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return res.json({
    data: data.map((q) => ({
      id: q.id, title: q.title, body: q.body, tags: q.tags,
      created_by_id: q.createdById, accepted_answer_id: q.acceptedAnswerId,
      is_solved: q.isSolved, created_at: q.createdAt, updated_at: q.updatedAt,
      created_by: mapProfileShort(q.createdBy),
      answers: q.answers.map((a) => ({
        id: a.id, question_id: a.questionId, body: a.body,
        created_by_id: a.createdById, upvotes: a.votes.length,
        created_at: a.createdAt, updated_at: a.updatedAt,
        created_by: mapProfileShort(a.createdBy),
        answer_votes: a.votes.map((v) => ({ voter_id: v.voterId })),
      })),
    })),
  });
});

router.post("/questions", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { title, body, tags } = req.body;
  const data = await prisma.question.create({
    data: { title, body, tags: tags ?? [], createdById: user.id },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.patch("/questions/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { title, body, tags, is_solved, accepted_answer_id } = req.body;
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (body !== undefined) updateData.body = body;
  if (tags !== undefined) updateData.tags = tags;
  if (is_solved !== undefined) updateData.isSolved = is_solved;
  if (accepted_answer_id !== undefined) updateData.acceptedAnswerId = accepted_answer_id;

  await prisma.question.update({ where: { id: req.params.id }, data: updateData });
  return res.json({ success: true });
});

router.delete("/questions/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.question.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

router.post("/answers", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { question_id, body } = req.body;
  const data = await prisma.answer.create({
    data: { questionId: question_id, body, createdById: user.id },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.patch("/answers/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.answer.update({ where: { id: req.params.id }, data: { body: req.body.body } });
  return res.json({ success: true });
});

router.delete("/answers/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.answer.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

router.post("/answer-votes", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { answer_id } = req.body;
  try {
    await prisma.answerVote.create({ data: { answerId: answer_id, voterId: user.id } });
    return res.status(201).json({ success: true });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Bereits abgestimmt." });
    throw e;
  }
});

// ═══════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════

router.get("/events", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true, organizationId: true, organization: { select: { name: true } } } },
    },
  });

  return res.json({
    data: data.map((e) => ({
      id: e.id, title: e.title, starts_at: e.startsAt, ends_at: e.endsAt,
      location: e.location, description: e.description, audience: e.audience,
      audience_group: e.audienceGroup, is_open_to_all: e.isOpenToAll,
      external_registration_url: e.externalRegistrationUrl,
      owner_id: e.ownerId, created_at: e.createdAt,
      owner: mapProfileShort(e.owner),
    })),
  });
});

router.post("/events", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  const data = await prisma.event.create({
    data: {
      title: b.title, startsAt: b.starts_at, endsAt: b.ends_at,
      location: b.location, description: b.description,
      audience: b.audience ?? "PUBLIC", audienceGroup: b.audience_group,
      isOpenToAll: b.is_open_to_all, externalRegistrationUrl: b.external_registration_url,
      ownerId: user.id,
    },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.patch("/events/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  await prisma.event.update({
    where: { id: req.params.id },
    data: {
      title: b.title, startsAt: b.starts_at, endsAt: b.ends_at,
      location: b.location, description: b.description,
      audience: b.audience, audienceGroup: b.audience_group,
      isOpenToAll: b.is_open_to_all, externalRegistrationUrl: b.external_registration_url,
    },
  });
  return res.json({ success: true });
});

router.delete("/events/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.event.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// ROOMS
// ═══════════════════════════════════════════════════════════════════════

router.get("/rooms", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.room.findMany({
    include: {
      organization: { select: { name: true } },
      resourceGroup: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return res.json({ data: data.map(mapRoom) });
});

router.post("/rooms", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.room.create({ data: mapRoomInput(req.body, user.id) });
  return res.status(201).json({ data: mapRoom(data as any) });
});

router.patch("/rooms/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.room.update({
    where: { id: req.params.id },
    data: mapRoomInput(req.body),
  });
  return res.json({ data });
});

router.delete("/rooms/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.room.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

// Public room view (no auth)
router.get("/rooms/public/:token", async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { publicShareToken: req.params.token },
    include: { organization: { select: { name: true } } },
  });
  if (!room) return res.status(404).json({ error: "Raum nicht gefunden." });
  return res.json({ data: mapRoom(room as any) });
});

router.get("/rooms/public/:token/bookings", async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { publicShareToken: req.params.token },
    select: { id: true },
  });
  if (!room) return res.status(404).json({ error: "Raum nicht gefunden." });

  const bookings = await prisma.roomBooking.findMany({
    where: { roomId: room.id },
    include: {
      creator: { select: { id: true, name: true } },
      organization: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return res.json({
    data: bookings.map((b) => ({
      id: b.id, room_id: b.roomId, created_by: b.createdBy,
      organization_id: b.organizationId, start_time: b.startTime,
      end_time: b.endTime, title: b.title, description: b.description,
      expected_attendees: b.expectedAttendees, chairs_needed: b.chairsNeeded,
      tables_needed: b.tablesNeeded, whiteboards_needed: b.whiteboardsNeeded,
      requires_catering: b.requiresCatering, catering_details: b.cateringDetails,
      created_at: b.createdAt, updated_at: b.updatedAt,
      creator: b.creator, organization: b.organization,
    })),
  });
});

// Room resource groups
router.get("/room-resource-groups", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.roomResourceGroup.findMany({
    include: { organization: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return res.json({
    data: data.map((g) => ({
      id: g.id, name: g.name, organization_id: g.organizationId,
      chairs_total: g.chairsTotal, tables_total: g.tablesTotal,
      whiteboards_total: g.whiteboardsTotal,
      created_at: g.createdAt, updated_at: g.updatedAt,
      organization: g.organization,
    })),
  });
});

router.post("/room-resource-groups", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  const data = await prisma.roomResourceGroup.create({
    data: { name: b.name, organizationId: b.organization_id, chairsTotal: b.chairs_total, tablesTotal: b.tables_total, whiteboardsTotal: b.whiteboards_total },
  });
  return res.status(201).json({ data });
});

router.patch("/room-resource-groups/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  const data = await prisma.roomResourceGroup.update({
    where: { id: req.params.id },
    data: { name: b.name, organizationId: b.organization_id, chairsTotal: b.chairs_total, tablesTotal: b.tables_total, whiteboardsTotal: b.whiteboards_total },
  });
  return res.json({ data });
});

// Room bookings
router.get("/room-bookings", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.roomBooking.findMany({
    include: {
      creator: { select: { id: true, name: true } },
      organization: { select: { name: true } },
      room: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return res.json({
    data: data.map((b) => ({
      id: b.id, room_id: b.roomId, created_by: b.createdBy,
      organization_id: b.organizationId, start_time: b.startTime,
      end_time: b.endTime, title: b.title, description: b.description,
      expected_attendees: b.expectedAttendees, chairs_needed: b.chairsNeeded,
      tables_needed: b.tablesNeeded, whiteboards_needed: b.whiteboardsNeeded,
      requires_catering: b.requiresCatering, catering_details: b.cateringDetails,
      created_at: b.createdAt, updated_at: b.updatedAt,
      creator: b.creator, organization: b.organization, room: b.room,
    })),
  });
});

router.post("/room-bookings", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  const data = await prisma.roomBooking.create({
    data: {
      roomId: b.room_id, createdBy: b.created_by ?? user.id,
      organizationId: b.organization_id, startTime: b.start_time,
      endTime: b.end_time, title: b.title, description: b.description,
      expectedAttendees: b.expected_attendees, chairsNeeded: b.chairs_needed,
      tablesNeeded: b.tables_needed, whiteboardsNeeded: b.whiteboards_needed,
      requiresCatering: b.requires_catering, cateringDetails: b.catering_details,
    },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.patch("/room-bookings/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  await prisma.roomBooking.update({
    where: { id: req.params.id },
    data: {
      roomId: b.room_id, organizationId: b.organization_id,
      startTime: b.start_time, endTime: b.end_time, title: b.title,
      description: b.description, expectedAttendees: b.expected_attendees,
      chairsNeeded: b.chairs_needed, tablesNeeded: b.tables_needed,
      whiteboardsNeeded: b.whiteboards_needed,
      requiresCatering: b.requires_catering, cateringDetails: b.catering_details,
    },
  });
  return res.json({ success: true });
});

router.delete("/room-bookings/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.roomBooking.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// COFFEE
// ═══════════════════════════════════════════════════════════════════════

router.get("/coffee/products", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.coffeeProduct.findMany({ orderBy: { name: "asc" } });
  return res.json({
    data: data.map((p) => ({
      id: p.id, name: p.name, price_cents: p.priceCents, is_active: p.isActive,
    })),
  });
});

router.post("/coffee/products", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const b = req.body;
  const data = await prisma.coffeeProduct.create({
    data: { name: b.name, priceCents: b.price_cents, isActive: b.is_active ?? true },
  });
  return res.status(201).json({ data });
});

router.patch("/coffee/products/:id", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;
  const b = req.body;
  const data = await prisma.coffeeProduct.update({
    where: { id: req.params.id },
    data: { name: b.name, priceCents: b.price_cents, isActive: b.is_active },
  });
  return res.json({ data });
});

router.delete("/coffee/products/:id", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;
  await prisma.coffeeProduct.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

router.get("/coffee/transactions", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const where: any = {};
  if (req.query.user_id) where.userId = String(req.query.user_id);
  if (req.query.organization_id) where.organizationId = String(req.query.organization_id);
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(String(req.query.from));
    if (req.query.to) where.createdAt.lt = new Date(String(req.query.to));
  }

  const data = await prisma.coffeeTransaction.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      organization: { select: { name: true } },
    },
  });

  return res.json({
    data: data.map((t) => ({
      id: t.id, user_id: t.userId, organization_id: t.organizationId,
      product_id: t.productId, product_name_snapshot: t.productNameSnapshot,
      price_cents_snapshot: t.priceCentsSnapshot, created_at: t.createdAt,
      user: t.user, organization: t.organization,
    })),
  });
});

router.post("/coffee/transactions", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  const data = await prisma.coffeeTransaction.create({
    data: {
      userId: b.user_id, organizationId: b.organization_id,
      productId: b.product_id, productNameSnapshot: b.product_name_snapshot,
      priceCentsSnapshot: b.price_cents_snapshot,
    },
  });
  return res.status(201).json({ data });
});

// ═══════════════════════════════════════════════════════════════════════
// LUNCH ROULETTE (Match Rounds)
// ═══════════════════════════════════════════════════════════════════════

router.get("/match-rounds", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.matchRound.findMany({
    where: { kind: "LUNCH" },
    orderBy: { scheduledDate: "asc" },
    include: {
      participations: { select: { id: true, userId: true } },
      pairs: {
        include: {
          userA: { select: { id: true, name: true, avatarUrl: true, organizationId: true, organization: { select: { name: true } } } },
          userB: { select: { id: true, name: true, avatarUrl: true, organizationId: true, organization: { select: { name: true } } } },
        },
      },
    },
  });

  return res.json({
    data: data.map((r) => ({
      id: r.id, kind: r.kind, scheduled_date: r.scheduledDate,
      weekday: r.weekday, status: r.status, created_at: r.createdAt,
      participations: r.participations.map((p) => ({ id: p.id, user_id: p.userId })),
      pairs: r.pairs.map((p) => ({
        id: p.id, round_id: p.roundId,
        user_a_id: p.userAId, user_b_id: p.userBId,
        user_a: mapProfileShort(p.userA),
        user_b: mapProfileShort(p.userB),
      })),
    })),
  });
});

router.post("/match-rounds", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const b = req.body;
  const data = await prisma.matchRound.create({
    data: { kind: "LUNCH", scheduledDate: b.scheduled_date, weekday: b.weekday, status: b.status ?? "OPEN" },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.patch("/match-rounds/:id", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  await prisma.matchRound.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
  });
  return res.json({ success: true });
});

router.delete("/match-rounds/:id", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  await prisma.matchRound.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

router.post("/match-participations", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { round_id } = req.body;
  const data = await prisma.matchParticipation.create({
    data: { roundId: round_id, userId: user.id },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.delete("/match-participations", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { round_id } = req.body;
  await prisma.matchParticipation.deleteMany({
    where: { roundId: round_id, userId: user.id },
  });
  return res.json({ success: true });
});

router.post("/match-pairs", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const { pairs } = req.body; // Array of { round_id, user_a_id, user_b_id }
  const data = await prisma.matchPair.createMany({
    data: pairs.map((p: any) => ({
      roundId: p.round_id,
      userAId: p.user_a_id,
      userBId: p.user_b_id,
    })),
  });
  return res.status(201).json({ data });
});

// ═══════════════════════════════════════════════════════════════════════
// LUNCH PLACES
// ═══════════════════════════════════════════════════════════════════════

router.get("/lunch-places", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.lunchPlace.findMany({
    orderBy: { name: "asc" },
    include: {
      creator: { select: { id: true, name: true } },
      reviews: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  });

  return res.json({
    data: data.map((p) => ({
      id: p.id, name: p.name, website_url: p.websiteUrl, phone: p.phone,
      contact_email: p.contactEmail, address: p.address, cuisine: p.cuisine,
      distance_minutes: p.distanceMinutes, opening_hours: p.openingHours,
      menu_url: p.menuUrl, latitude: p.latitude, longitude: p.longitude,
      open_days: p.openDays, created_by: p.createdBy,
      last_reviewed_at: p.lastReviewedAt, created_at: p.createdAt,
      updated_at: p.updatedAt, creator: p.creator,
      lunch_reviews: p.reviews.map((r) => ({
        id: r.id, place_id: r.placeId, user_id: r.userId,
        rating: r.rating, wait_time_minutes: r.waitTimeMinutes,
        comment: r.comment, created_at: r.createdAt,
        user: r.user ? { id: r.user.id, name: r.user.name, avatar_url: r.user.avatarUrl } : null,
      })),
    })),
  });
});

router.post("/lunch-places", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  const data = await prisma.lunchPlace.create({
    data: {
      name: b.name, websiteUrl: b.website_url, phone: b.phone,
      contactEmail: b.contact_email, address: b.address, cuisine: b.cuisine,
      distanceMinutes: b.distance_minutes, openingHours: b.opening_hours,
      menuUrl: b.menu_url, latitude: b.latitude, longitude: b.longitude,
      openDays: b.open_days ?? [], createdBy: user.id,
    },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.patch("/lunch-places/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  await prisma.lunchPlace.update({
    where: { id: req.params.id },
    data: {
      name: b.name, websiteUrl: b.website_url, phone: b.phone,
      contactEmail: b.contact_email, address: b.address, cuisine: b.cuisine,
      distanceMinutes: b.distance_minutes, openingHours: b.opening_hours,
      menuUrl: b.menu_url, latitude: b.latitude, longitude: b.longitude,
      openDays: b.open_days,
    },
  });
  return res.json({ success: true });
});

router.delete("/lunch-places/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.lunchPlace.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

router.post("/lunch-reviews", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  // Upsert – one review per user per place
  const data = await prisma.lunchReview.upsert({
    where: { placeId_userId: { placeId: b.place_id, userId: user.id } },
    create: { placeId: b.place_id, userId: user.id, rating: b.rating, waitTimeMinutes: b.wait_time_minutes, comment: b.comment },
    update: { rating: b.rating, waitTimeMinutes: b.wait_time_minutes, comment: b.comment },
  });
  return res.status(201).json({ data });
});

router.delete("/lunch-reviews/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.lunchReview.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// RECEPTION TASKS
// ═══════════════════════════════════════════════════════════════════════

router.get("/reception-tasks", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.receptionTask.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, name: true, organizationId: true, organization: { select: { name: true } } } },
      assignedReception: { select: { id: true, name: true } },
      organization: { select: { name: true } },
      logs: {
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return res.json({
    data: data.map((t) => ({
      id: t.id, title: t.title, created_by: t.createdBy,
      direction: t.direction, status: t.status, details: t.details,
      due_at: t.dueAt, assigned_reception_id: t.assignedReceptionId,
      organization_id: t.organizationId,
      created_at: t.createdAt, updated_at: t.updatedAt,
      creator: t.creator, assigned_reception: t.assignedReception,
      organization: t.organization,
      reception_task_logs: t.logs.map((l) => ({
        id: l.id, task_id: l.taskId, entry: l.entry,
        created_by: l.createdBy, created_at: l.createdAt,
        creator: l.creator,
      })),
    })),
  });
});

router.post("/reception-tasks", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  const data = await prisma.receptionTask.create({
    data: {
      title: b.title, createdBy: user.id, direction: b.direction ?? "ORG_TODO",
      status: b.status ?? "OPEN", details: b.details, dueAt: b.due_at,
      assignedReceptionId: b.assigned_reception_id, organizationId: b.organization_id,
    },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

router.patch("/reception-tasks/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body;
  const updateData: any = {};
  if (b.status !== undefined) updateData.status = b.status;
  if (b.details !== undefined) updateData.details = b.details;
  if (b.assigned_reception_id !== undefined) updateData.assignedReceptionId = b.assigned_reception_id;

  await prisma.receptionTask.update({ where: { id: req.params.id }, data: updateData });
  return res.json({ success: true });
});

router.delete("/reception-tasks/:id", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  await prisma.receptionTask.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

router.post("/reception-task-logs", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { task_id, entry } = req.body;
  const data = await prisma.receptionTaskLog.create({
    data: { taskId: task_id, entry, createdBy: user.id },
    select: { id: true },
  });
  return res.status(201).json({ data });
});

// ═══════════════════════════════════════════════════════════════════════
// JOIN REQUESTS
// ═══════════════════════════════════════════════════════════════════════

router.get("/join-requests", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const where: any = {};
  if (user.role === "ORG_ADMIN" && user.organization_id) {
    where.organizationId = user.organization_id;
  }

  const data = await prisma.joinRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      organization: { select: { name: true } },
      approver: { select: { id: true, name: true } },
    },
  });

  return res.json({
    data: data.map((r) => ({
      id: r.id, name: r.name, email: r.email,
      organization_id: r.organizationId, status: r.status,
      approved_by: r.approvedBy, approved_at: r.approvedAt,
      created_at: r.createdAt,
      organization: r.organization, approver: r.approver,
    })),
  });
});

router.post("/join-requests", async (req, res) => {
  // Public endpoint – no auth required
  const { name, email, organization_id } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name und E-Mail sind erforderlich." });
  }

  const data = await prisma.joinRequest.create({
    data: { name, email, organizationId: organization_id },
    select: { id: true },
  });

  // Notify admins via realtime
  emitToAdmins("join-request:changed", { action: "created", id: data.id });

  return res.status(201).json({ data });
});

router.patch("/join-requests/:id", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const { status } = req.body;
  const updateData: any = { status };
  if (status === "APPROVED") {
    updateData.approvedBy = user.id;
    updateData.approvedAt = new Date();
  }

  await prisma.joinRequest.update({ where: { id: req.params.id }, data: updateData });

  emitToAdmins("join-request:changed", { action: "updated", id: req.params.id, status });

  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════

router.get("/settings/:key", async (req, res) => {
  const data = await prisma.setting.findUnique({ where: { key: req.params.key } });
  return res.json({ data: data?.value ?? null });
});

router.put("/settings/:key", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN"] });
  if (!user) return;

  const data = await prisma.setting.upsert({
    where: { key: req.params.key },
    create: { key: req.params.key, value: req.body.value },
    update: { value: req.body.value },
  });
  return res.json({ data });
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN – member management helpers
// ═══════════════════════════════════════════════════════════════════════

router.patch("/admin/profiles/:id", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const b = req.body;
  const updateData: any = {};
  if (b.role !== undefined) updateData.role = b.role;
  if (b.is_news_manager !== undefined) updateData.isNewsManager = b.is_news_manager;
  if (b.is_event_manager !== undefined) updateData.isEventManager = b.is_event_manager;
  if (b.is_receptionist !== undefined) updateData.isReceptionist = b.is_receptionist;
  if (b.organization_id !== undefined) updateData.organizationId = b.organization_id;

  await prisma.profile.update({ where: { id: req.params.id }, data: updateData });

  // Sync role to app_users
  if (b.role !== undefined) {
    await prisma.appUser.update({ where: { id: req.params.id }, data: { role: b.role } });
  }

  return res.json({ success: true });
});

router.post("/admin/set-password", async (req, res) => {
  const user = await requireAuth(req, res, { roles: ["SUPER_ADMIN", "ORG_ADMIN"] });
  if (!user) return;

  const { user_id, password } = req.body;
  if (!user_id || !password) {
    return res.status(400).json({ error: "user_id und password sind erforderlich." });
  }

  const { hashPassword } = await import("../lib/password.js");
  const passwordHash = await hashPassword(String(password));

  await prisma.appUser.update({
    where: { id: user_id },
    data: { passwordHash },
  });

  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function mapNotification(n: any) {
  return {
    id: n.id, user_id: n.userId, title: n.title, body: n.body,
    type: n.type, url: n.url, read_at: n.readAt, created_at: n.createdAt,
  };
}

function mapMessage(m: any) {
  return {
    id: m.id, sender_id: m.senderId, recipient_id: m.recipientId,
    body: m.body, created_at: m.createdAt, read_at: m.readAt,
  };
}

function mapProfileShort(p: any) {
  if (!p) return null;
  return {
    id: p.id, name: p.name, avatar_url: p.avatarUrl,
    organization_id: p.organizationId,
    organization: p.organization,
  };
}

function mapRoom(r: any) {
  return {
    id: r.id, name: r.name, organization_id: r.organizationId,
    created_by: r.createdBy, capacity: r.capacity,
    chairs_capacity: r.chairsCapacity, tables_capacity: r.tablesCapacity,
    chairs_default: r.chairsDefault, tables_default: r.tablesDefault,
    resource_group_id: r.resourceGroupId, location: r.location,
    description: r.description, equipment: r.equipment,
    info_document_url: r.infoDocumentUrl,
    booking_notify_email: r.bookingNotifyEmail,
    notify_on_booking: r.notifyOnBooking,
    public_share_token: r.publicShareToken,
    requires_beverage_catering: r.requiresBeverageCatering,
    is_active: r.isActive, created_at: r.createdAt, updated_at: r.updatedAt,
    organization: r.organization, resource_group: r.resourceGroup,
  };
}

function mapRoomInput(b: any, createdBy?: string) {
  const data: any = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.organization_id !== undefined) data.organizationId = b.organization_id;
  if (createdBy) data.createdBy = createdBy;
  if (b.capacity !== undefined) data.capacity = b.capacity;
  if (b.chairs_capacity !== undefined) data.chairsCapacity = b.chairs_capacity;
  if (b.tables_capacity !== undefined) data.tablesCapacity = b.tables_capacity;
  if (b.chairs_default !== undefined) data.chairsDefault = b.chairs_default;
  if (b.tables_default !== undefined) data.tablesDefault = b.tables_default;
  if (b.resource_group_id !== undefined) data.resourceGroupId = b.resource_group_id;
  if (b.location !== undefined) data.location = b.location;
  if (b.description !== undefined) data.description = b.description;
  if (b.equipment !== undefined) data.equipment = b.equipment;
  if (b.info_document_url !== undefined) data.infoDocumentUrl = b.info_document_url;
  if (b.booking_notify_email !== undefined) data.bookingNotifyEmail = b.booking_notify_email;
  if (b.notify_on_booking !== undefined) data.notifyOnBooking = b.notify_on_booking;
  if (b.requires_beverage_catering !== undefined) data.requiresBeverageCatering = b.requires_beverage_catering;
  if (b.is_active !== undefined) data.isActive = b.is_active;
  return data;
}

function mapOrgInput(b: any) {
  const data: any = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.logo_url !== undefined) data.logoUrl = b.logo_url;
  if (b.location_text !== undefined) data.locationText = b.location_text;
  if (b.cost_center_code !== undefined) data.costCenterCode = b.cost_center_code;
  if (b.contact_email !== undefined) data.contactEmail = b.contact_email;
  if (b.contact_name !== undefined) data.contactName = b.contact_name;
  if (b.contact_phone !== undefined) data.contactPhone = b.contact_phone;
  if (b.website_url !== undefined) data.websiteUrl = b.website_url;
  return data;
}

function mapOrgOutput(o: any) {
  return {
    id: o.id, name: o.name, logo_url: o.logoUrl,
    location_text: o.locationText, cost_center_code: o.costCenterCode,
    contact_email: o.contactEmail, contact_name: o.contactName,
    contact_phone: o.contactPhone, website_url: o.websiteUrl,
    created_at: o.createdAt,
  };
}

export default router;
