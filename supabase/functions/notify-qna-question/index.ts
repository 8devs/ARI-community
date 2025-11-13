import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getUser(req: Request) {
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function sendEmailBatch(to: string[], subject: string, html: string) {
  if (!to.length) return;
  await fetch(`${SUPABASE_URL}/functions/v1/send-email-notification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, subject, html, badge: "Q&A" }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  const user = await getUser(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let body: { question_id?: string };
  try {
    body = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.question_id) {
    return new Response(JSON.stringify({ error: "question_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: question, error: questionError } = await supabaseAdmin
    .from("questions")
    .select(
      `
        id,
        title,
        created_by_id,
        created_at,
        created_by:profiles(name, organization_id)
      `,
    )
    .eq("id", body.question_id)
    .maybeSingle();

  if (questionError || !question) {
    return new Response(JSON.stringify({ error: "Question not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (question.created_by_id !== user.id) {
    const { data: requester } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (requester?.role !== "SUPER_ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { data: recipients, error: recipientError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, name, pref_email_notifications, role, organization_id")
    .or("role.eq.SUPER_ADMIN,role.eq.ORG_ADMIN")
    .neq("id", question.created_by_id);

  if (recipientError) {
    console.error("Failed to load admins", recipientError);
    return new Response(JSON.stringify({ error: "Recipients unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const filteredRecipients = (recipients ?? []).filter((profile) =>
    profile.role === "SUPER_ADMIN" || profile.organization_id === question.created_by?.organization_id,
  );

  if (!filteredRecipients.length) {
    return new Response(JSON.stringify({ success: true, delivered: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = question.title.length > 120 ? `${question.title.slice(0, 120)}…` : question.title;
  const notificationRows = filteredRecipients.map((recipient) => ({
    user_id: recipient.id,
    title: "Neue Q&A Frage",
    body: `${question.created_by?.name ?? "Ein Mitglied"} hat gefragt: ${summary}`,
    type: "QNA",
    url: `/qa?question=${question.id}`,
  }));

  for (const chunk of chunkArray(notificationRows, 200)) {
    const { error } = await supabaseAdmin.from("notifications").insert(chunk);
    if (error) {
      console.error("Failed to insert notifications", error);
      return new Response(JSON.stringify({ error: "Notification insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const emailRecipients = filteredRecipients
    .filter((recipient) => recipient.pref_email_notifications && recipient.email)
    .map((recipient) => recipient.email as string);

  if (emailRecipients.length) {
    const url = SITE_URL ? `${SITE_URL}/#/qa?question=${question.id}` : null;
    const html = `
      <p>Hallo Admin-Team,</p>
      <p>${question.created_by?.name ?? "Ein Mitglied"} hat eine neue Frage gestellt:</p>
      <blockquote>${question.title}</blockquote>
      ${url ? `<p><a href="${url}">Zur Frage wechseln</a></p>` : ""}
    `;
    for (const chunk of chunkArray(emailRecipients, 30)) {
      await sendEmailBatch(chunk, "Neue Frage im Q&A", html);
    }
  }

  return new Response(JSON.stringify({ success: true, delivered: filteredRecipients.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
