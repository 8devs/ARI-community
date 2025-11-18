import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const RESET_PATH = Deno.env.get("PASSWORD_RESET_PATH") ?? "/#/passwort/neu";
const DEFAULT_REDIRECT = SITE_URL ? `${SITE_URL}${RESET_PATH}` : null;

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

  let body: { user_id?: string; redirect_to?: string };
  try {
    body = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targetUserId = body.user_id;
  if (!targetUserId) {
    return new Response(JSON.stringify({ error: "user_id is required" }), {
      status: 400,
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

  const { data: member, error: memberError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, organization_id")
    .eq("id", targetUserId)
    .maybeSingle<MemberProfile>();

  if (memberError || !member) {
    return new Response(JSON.stringify({ error: "Mitglied wurde nicht gefunden." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  if (!member.email) {
    return new Response(JSON.stringify({ error: "Für diesen Nutzer ist keine E-Mail hinterlegt." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const redirectTo = body.redirect_to?.trim() || DEFAULT_REDIRECT || undefined;

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: member.email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (linkError) {
    console.error("Failed to generate password link", linkError);
    return new Response(JSON.stringify({ error: "Link konnte nicht erstellt werden." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const actionLink =
    linkData?.properties?.action_link ||
    (linkData as Record<string, string | undefined>)?.action_link ||
    null;

  if (!actionLink) {
    return new Response(JSON.stringify({ error: "Keine Weiterleitungs-URL erhalten." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ link: actionLink }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
