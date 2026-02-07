import type { Request, Response } from "express";
import { verifySession, type SessionPayload } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { serialize, parse } from "cookie";

const SESSION_COOKIE_NAME = "ari_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function createSessionCookie(token: string): string {
  return serialize(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(): string {
  return serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function readSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  organization_id: string | null;
  name: string | null;
}

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  try {
    const payload = verifySession(token);
    const data = await prisma.appUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, organizationId: true, name: true },
    });
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      role: data.role,
      organization_id: data.organizationId,
      name: data.name,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  options?: { roles?: string[] }
): Promise<SessionUser | null> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Nicht angemeldet." });
    return null;
  }
  if (options?.roles && !options.roles.includes(user.role)) {
    res.status(403).json({ error: "Keine Berechtigung." });
    return null;
  }
  return user;
}
