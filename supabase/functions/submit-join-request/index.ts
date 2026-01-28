import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "https://www.ari-worms.de").replace(
  /\/$/,
  "",
);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdminProfile = {
  id: string;
  email: string | null;
};

const adminNotificationUrl = SITE_URL ? `${SITE_URL}/admin?section=requests` : null;

const sendEmailNotification = async (to: string[], html: string, subject: string) => {
  if (to.length === 0) {
    return;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email-notification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      subject,
      badge: "Beitrittsanfrage",
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Failed to send notification email", details);
  }
};

const createInAppNotifications = async (
  recipients: AdminProfile[],
  requesterName: string,
  requesterEmail: string,
  organizationName: string,
) => {
  if (recipients.length === 0) {
    return;
  }

  const rows = recipients.map((recipient) => ({
    user_id: recipient.id,
    title: 'Neue Beitrittsanfrage',
    body: `${requesterName} (${requesterEmail}) möchte ${organizationName} beitreten.`,
    url: adminNotificationUrl,
    type: 'INFO',
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    console.error('Failed to create notifications for join request', error);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: { name?: string; email?: string; organization_id?: string };
  try {
    body = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const organizationId = body.organization_id;

  if (!name || !email || !organizationId) {
    return new Response(JSON.stringify({ error: "Name, E-Mail und Organisation sind erforderlich." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: "Bitte gib eine gültige E-Mail-Adresse an." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgError || !organization) {
      return new Response(JSON.stringify({ error: "Organisation konnte nicht gefunden werden." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase.from("join_requests").insert({
      name,
      email,
      organization_id: organizationId,
    });

    if (insertError) {
      console.error("Failed to save join request", insertError);
      return new Response(JSON.stringify({ error: "Anfrage konnte nicht gespeichert werden." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const superAdminsPromise = supabase
      .from("profiles")
      .select("id, email")
      .eq("role", "SUPER_ADMIN");

    const orgAdminsPromise = supabase
      .from("profiles")
      .select("id, email")
      .eq("role", "ORG_ADMIN")
      .eq("organization_id", organization.id);

    const [{ data: superAdmins = [] }, { data: orgAdmins = [] }] = await Promise.all([
      superAdminsPromise,
      orgAdminsPromise,
    ]);

    const allAdmins = [...superAdmins, ...orgAdmins].filter(
      (profile): profile is AdminProfile => Boolean(profile?.id),
    );

    const recipients = Array.from(
      new Set(
        allAdmins
          .map((profile) => profile.email)
          .filter((emailValue): emailValue is string => Boolean(emailValue)),
      ),
    );

    const adminLink = SITE_URL ? `${SITE_URL}/admin?section=requests` : "";
    const html = `
      <p><strong>${name}</strong> (${email}) möchte der Organisation <strong>${organization.name}</strong> beitreten.</p>
      <p>Du kannst die Anfrage im Adminbereich unter <em>Beitrittsanfragen</em> bearbeiten.</p>
      ${
        adminLink
          ? `<p style="text-align:center;margin-top:24px;">
              <a href="${adminLink}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#ff591a,#ff914d);color:#fff;text-decoration:none;border-radius:14px;font-weight:600;">
                Adminbereich öffnen
              </a>
            </p>`
          : ""
      }
    `;

    await Promise.all([
      sendEmailNotification(recipients, html, `Neue Beitrittsanfrage von ${name}`),
      createInAppNotifications(allAdmins, name, email, organization.name ?? 'deiner Organisation'),
    ]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error handling join request", error);
    return new Response(JSON.stringify({ error: "Unbekannter Fehler bei der Verarbeitung." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
