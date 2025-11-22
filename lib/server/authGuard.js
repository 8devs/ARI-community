import { readSessionCookie } from "./authCookies";
import { verifySession } from "./jwt";
import { supabaseAdmin } from "./supabaseAdmin";

export async function getSessionUser(req) {
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

export async function requireAuth(req, res, options) {
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
