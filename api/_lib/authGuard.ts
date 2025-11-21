import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readSessionCookie } from "./authCookies";
import { verifySession } from "./jwt";
import { supabaseAdmin } from "./supabaseAdmin";

export type AppUser = {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "MEMBER";
  organization_id: string | null;
  name: string | null;
};

export async function getSessionUser(req: VercelRequest): Promise<AppUser | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  try {
    const payload = verifySession(token);
    const { data } = await supabaseAdmin
      .from("app_users")
      .select("id, email, role, organization_id, name")
      .eq("id", payload.sub)
      .maybeSingle();
    return (data as AppUser | null) ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
  options?: { roles?: AppUser["role"][] },
): Promise<AppUser | null> {
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
