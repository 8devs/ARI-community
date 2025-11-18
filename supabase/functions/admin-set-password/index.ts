import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const DEFAULT_PASSWORD = Deno.env.get("DEFAULT_USER_PASSWORD") ?? "Adenauerring1";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getUserFromRequest(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

type MemberProfile = {
  id: string;
  email: string | null;
  role: "MEMBER" | "ORG_ADMIN" | "SUPER_ADMIN";
  organization_id: string | null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function findProfileByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, organization_id")
      .eq("email", normalized)
      .maybeSingle<MemberProfile>();

    if (error) {
      console.error("Failed to query profiles", error);
      break;
    }

    if (data) {
      return data;
    }

    await wait(400);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    return new Response("Server not configured", { status: 500, headers: corsHeaders });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let body: { user_id?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let member: MemberProfile | null = null;

  if (body.user_id) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, organization_id")
      .eq("id", body.user_id)
      .maybeSingle<MemberProfile>();

    if (error) {
      console.error("Failed to load member profile", error);
      return new Response(JSON.stringify({ error: "Nutzer konnte nicht geladen werden." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    member = data;
  } else if (body.email) {
    member = await findProfileByEmail(body.email);
  }

  if (!member) {
    return new Response(JSON.stringify({ error: "Nutzer wurde nicht gefunden." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: requester } = await supabaseAdmin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!requester) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const isSuperAdmin = requester.role === "SUPER_ADMIN";
  const isOrgAdmin = requester.role === "ORG_ADMIN";
  const sameOrg =
    requester.organization_id && member.organization_id && requester.organization_id === member.organization_id;
  const canManageMember =
    isSuperAdmin || (isOrgAdmin && sameOrg && member.role !== "SUPER_ADMIN");

  if (!canManageMember) {
    return new Response(JSON.stringify({ error: "Keine Berechtigung für diesen Nutzer." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!member.id) {
    return new Response(JSON.stringify({ error: "Ungültige Nutzer-ID." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const password = body.password?.trim() || DEFAULT_PASSWORD;
  if (!password) {
    return new Response(JSON.stringify({ error: "Kein Passwort definiert." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(member.id, { password });
  if (updateError) {
    console.error("Failed to reset password", updateError);
    return new Response(JSON.stringify({ error: "Passwort konnte nicht gesetzt werden." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
