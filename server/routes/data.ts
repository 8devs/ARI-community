import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ─── GET /api/data/profile ───────────────────────────────────────────
router.get("/profile", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.profile.findUnique({
    where: { id: user.id },
    include: {
      organization: {
        select: { name: true, logoUrl: true, costCenterCode: true },
      },
    },
  });

  if (!data) return res.status(200).json({ profile: null });

  // Map to snake_case for frontend compatibility
  const profile = {
    id: data.id,
    name: data.name,
    email: data.email,
    avatar_url: data.avatarUrl,
    bio: data.bio,
    skills_text: data.skillsText,
    first_aid_certified: data.firstAidCertified,
    phone: data.phone,
    position: data.position,
    role: data.role,
    organization_id: data.organizationId,
    pref_email_notifications: data.prefEmailNotifications,
    pref_push_notifications: data.prefPushNotifications,
    is_news_manager: data.isNewsManager,
    is_event_manager: data.isEventManager,
    is_receptionist: data.isReceptionist,
    created_at: data.createdAt,
    organization: data.organization
      ? {
          name: data.organization.name,
          logo_url: data.organization.logoUrl,
          cost_center_code: data.organization.costCenterCode,
        }
      : null,
  };

  return res.status(200).json({ profile });
});

// ─── GET /api/data/members ───────────────────────────────────────────
router.get("/members", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.profile.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      bio: true,
      skillsText: true,
      firstAidCertified: true,
      phone: true,
      organizationId: true,
      position: true,
      role: true,
      isNewsManager: true,
      isEventManager: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  // Map to snake_case for frontend compatibility
  const members = data.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    avatar_url: m.avatarUrl,
    bio: m.bio,
    skills_text: m.skillsText,
    first_aid_certified: m.firstAidCertified,
    phone: m.phone,
    organization_id: m.organizationId,
    position: m.position,
    role: m.role,
    is_news_manager: m.isNewsManager,
    is_event_manager: m.isEventManager,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    organization: m.organization,
  }));

  return res.status(200).json({ members });
});

// ─── GET /api/data/organizations ─────────────────────────────────────
router.get("/organizations", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const data = await prisma.organization.findMany({
    orderBy: { name: "asc" },
  });

  // Map to snake_case for frontend compatibility
  const organizations = data.map((o) => ({
    id: o.id,
    name: o.name,
    logo_url: o.logoUrl,
    location_text: o.locationText,
    cost_center_code: o.costCenterCode,
    contact_email: o.contactEmail,
    contact_name: o.contactName,
    contact_phone: o.contactPhone,
    website_url: o.websiteUrl,
    created_at: o.createdAt,
  }));

  return res.status(200).json({ organizations });
});

export default router;
