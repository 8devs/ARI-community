import { readSessionCookie } from "../../lib/server/authCookies.js";
import { verifySession } from "../../lib/server/jwt.js";
import { supabaseAdmin } from "../../lib/server/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = readSessionCookie(req);
  if (!token) {
    return res.status(200).json({ user: null });
  }

  try {
    const payload = verifySession(token);
    const { data } = await supabaseAdmin
      .from("app_users")
      .select("id, email, role, organization_id, name")
      .eq("id", payload.sub)
      .maybeSingle();

    if (!data) {
      return res.status(200).json({ user: null });
    }

    return res.status(200).json({ user: data });
  } catch (error) {
    console.error("session verification failed", error);
    return res.status(200).json({ user: null });
  }
}
