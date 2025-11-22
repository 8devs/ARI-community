import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const EMAIL_RELAY_URL = Deno.env.get("EMAIL_RELAY_URL") ?? Deno.env.get("_URL");
const EMAIL_RELAY_TOKEN = Deno.env.get("EMAIL_RELAY_TOKEN") ?? Deno.env.get("_TOKEN");
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "notifications@ari-worms.de";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function wrapWithAriTemplate(title: string, innerHtml: string, badge?: string) {
  return `<!DOCTYPE html>
<html lang="de" style="margin:0;padding:0;">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --primary-start: #0f172a;
        --primary-end: #1d4ed8;
        --surface: #ffffff;
        --bg: #eef2ff;
        --text-strong: #111827;
        --text: #4b5563;
        --text-muted: #6b7280;
        --border: #e2e8f0;
      }

      body {
        margin: 0;
        padding: 0;
        background: var(--bg);
        font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: var(--text-strong);
      }

      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background: var(--bg);
      }

      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: var(--surface);
        border-radius: 18px;
        border: 1px solid var(--border);
        box-shadow: 0 35px 80px rgba(15, 23, 42, 0.20);
        overflow: hidden;
        position: relative;
        isolation: isolate;
      }

      .header {
        background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.2), transparent),
          linear-gradient(120deg, var(--primary-start), var(--primary-end));
        color: #f8fafc;
        padding: 40px 32px 60px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      .header h1 {
        position: relative;
        margin: 0;
        font-size: 30px;
        letter-spacing: -0.03em;
      }

      .badge {
        display: inline-block;
        margin-top: 20px;
        padding: 6px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.4);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1.4px;
        color: #e2e8f0;
        background: rgba(15,23,42,0.25);
      }

      .content {
        padding: 32px;
        line-height: 1.55;
        font-size: 16px;
        color: var(--text);
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }

      .content p {
        margin: 0 0 18px;
        color: var(--text);
      }

      .footer {
        padding: 0 32px 32px;
        text-align: center;
        font-size: 13px;
        color: #94a3b8;
      }

      @media (max-width: 620px) {
        .content,
        .header,
        .footer {
          padding-left: 20px;
          padding-right: 20px;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
          ${badge ? `<div class="badge">${badge}</div>` : ""}
        </div>
        <div class="content">
          ${innerHtml}
        </div>
        <div class="footer">
          Diese Benachrichtigung stammt aus der ARI Community App.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!EMAIL_RELAY_URL) {
    return new Response(
      JSON.stringify({
        error: "Missing EMAIL_RELAY_URL",
        details: "Edge Function requires EMAIL_RELAY_URL to call your mail relay",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: {
    to?: string | string[];
    subject?: string;
    html?: string;
    badge?: string;
  };
  try {
    payload = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.to || !payload.subject || !payload.html) {
    return new Response(JSON.stringify({ error: "Missing to/subject/html fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

  try {
    const response = await fetch(EMAIL_RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(EMAIL_RELAY_TOKEN ? { Authorization: `Bearer ${EMAIL_RELAY_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipients,
        subject: payload.subject,
        html: wrapWithAriTemplate(payload.subject, payload.html, payload.badge),
      }),
    });

    if (!response.ok) {
      const relayError = await response.text();
      console.error("Relay responded with error", relayError);
      return new Response(
        JSON.stringify({ error: "Relay call failed", details: relayError || response.statusText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    console.error("Relay request failed", error);
    return new Response(
      JSON.stringify({ error: "Failed to reach email relay", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
