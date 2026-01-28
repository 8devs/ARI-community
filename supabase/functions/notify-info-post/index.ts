import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "https://www.ari-worms.de").replace(
  /\/$/,
  "",
);

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
  if (error || !data?.user) {
    return null;
  }
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
    body: JSON.stringify({ to, subject, html, badge: "Pinnwand" }),
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
    return new Response("Server not configured", { status: 500, headers: corsHeaders });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let body: { post_id?: string };
  try {
    body = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.post_id) {
    return new Response(JSON.stringify({ error: "post_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: requester } = await supabaseAdmin
    .from("profiles")
    .select("id, role, organization_id, is_news_manager, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!requester || (!requester.is_news_manager && requester.role !== "SUPER_ADMIN")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: post, error: postError } = await supabaseAdmin
    .from("info_posts")
    .select(
      `
        id,
        title,
        content,
        audience,
        target_organization_id,
        created_by_id,
        created_by:profiles(name)
      `,
    )
    .eq("id", body.post_id)
    .maybeSingle();

  if (postError || !post) {
    return new Response(JSON.stringify({ error: "Post not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let recipientsQuery = supabaseAdmin
    .from("profiles")
    .select("id, email, name, pref_email_notifications, organization_id")
    .neq("id", post.created_by_id);

  if (post.audience === "ORG_ONLY" && post.target_organization_id) {
    recipientsQuery = recipientsQuery.eq("organization_id", post.target_organization_id);
  }

  const { data: recipients = [], error: recipientsError } = await recipientsQuery;
  if (recipientsError) {
    console.error("Failed to load recipients", recipientsError);
    return new Response(JSON.stringify({ error: "Recipients unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!recipients.length) {
    return new Response(JSON.stringify({ success: true, delivered: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const preview = post.content.length > 160 ? `${post.content.slice(0, 160)}…` : post.content;
  const notificationRows = recipients.map((recipient) => ({
    user_id: recipient.id,
    title: `Neuer Pinnwandeintrag: ${post.title}`,
    body: preview,
    type: "INFO",
    url: "/pinnwand",
  }));

  const notificationChunks = chunkArray(notificationRows, 200);
  for (const chunk of notificationChunks) {
    const { error } = await supabaseAdmin.from("notifications").insert(chunk);
    if (error) {
      console.error("Error inserting notifications", error);
      return new Response(JSON.stringify({ error: "Notification insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const emailRecipients = recipients
    .filter((recipient) => recipient.pref_email_notifications && recipient.email)
    .map((recipient) => recipient.email as string);

  if (emailRecipients.length) {
    const link = SITE_URL ? `${SITE_URL}/#/pinnwand` : null;
    const emailHtml = `
      <p>Hallo,</p>
      <p>${requester.name ?? "Jemand"} hat einen neuen Pinnwandeintrag veröffentlicht:</p>
      <h3>${post.title}</h3>
      <p>${preview}</p>
      ${link ? `<p><a href="${link}">Jetzt zur Pinnwand wechseln</a></p>` : ""}
    `;
    const emailChunks = chunkArray(emailRecipients, 30);
    await Promise.all(emailChunks.map((chunk) => sendEmailBatch(chunk, `Neuer Pinnwandeintrag: ${post.title}`, emailHtml)));
  }

  return new Response(JSON.stringify({ success: true, delivered: recipients.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
