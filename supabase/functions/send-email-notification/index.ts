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
        --slate-50: #f8fafc;
        --slate-100: #eef2ff;
        --slate-200: #e2e8f0;
        --slate-500: #64748b;
        --slate-700: #334155;
        --slate-900: #0f172a;
        --indigo-500: #6366f1;
        --indigo-600: #4f46e5;
        --gradient-start: #101828;
        --gradient-end: #4338ca;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 0;
        background: var(--slate-100);
        font-family: 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: var(--slate-900);
      }

      .wrapper {
        width: 100%;
        padding: 48px 16px;
        background: radial-gradient(circle at 20% 20%, rgba(99,102,241,0.12), transparent),
          radial-gradient(circle at 80% 0%, rgba(14,165,233,0.14), transparent);
      }

      .container {
        max-width: 640px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 28px;
        border: 1px solid rgba(99,102,241,0.12);
        box-shadow:
          0 30px 80px rgba(15, 23, 42, 0.22),
          inset 0 1px 0 rgba(255,255,255,0.6);
        overflow: hidden;
      }

      .header {
        padding: 42px 36px 36px;
        background:
          linear-gradient(130deg, rgba(255,255,255,0.08), transparent),
          linear-gradient(120deg, var(--gradient-start), var(--gradient-end));
        color: #f1f5f9;
        text-align: left;
        position: relative;
      }

      .header h1 {
        margin: 0 0 16px;
        font-size: 34px;
        letter-spacing: -0.04em;
        font-weight: 600;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 16px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.35);
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.85);
        background: rgba(15,23,42,0.35);
      }

      .content {
        padding: 40px 36px 36px;
        line-height: 1.65;
        font-size: 16px;
        color: var(--slate-700);
        background: #fdfdff;
      }

      .content p {
        margin: 0 0 18px;
      }

      .footer {
        padding: 0 36px 32px;
        text-align: center;
        font-size: 13px;
        color: var(--slate-500);
      }

      .logo {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 12px;
        color: rgba(255,255,255,0.8);
      }

      .logo-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #38bdf8;
        box-shadow: 0 0 16px rgba(56,189,248,0.8);
      }

      @media (max-width: 640px) {
        .content,
        .header,
        .footer {
          padding-left: 20px;
          padding-right: 20px;
        }
        .header h1 {
          font-size: 30px;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <div class="logo">
            <span class="logo-dot"></span>
            ARI COMMUNITY
          </div>
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
