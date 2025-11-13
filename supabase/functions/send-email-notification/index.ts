import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "notifications@ari-worms.de";

const wrapWithAriTemplate = (title: string, innerHtml: string, badge?: string) => `<!DOCTYPE html>
<html lang="de" style="margin:0;padding:0;">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --primary-start: #ff591a;
        --primary-end: #ff914d;
        --surface: #ffffff;
        --bg: #f6f7fb;
        --text-strong: #111827;
        --text: #4b5563;
        --text-muted: #6b7280;
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
        padding: 32px 12px;
        background: var(--bg);
      }

      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: var(--surface);
        border-radius: 18px;
        border: 1px solid #edf0f7;
        box-shadow: 0 25px 55px rgba(15, 23, 42, 0.15);
        overflow: hidden;
      }

      .header {
        background: linear-gradient(135deg, var(--primary-start), var(--primary-end));
        color: #fffdf9;
        padding: 34px 32px 46px;
        text-align: center;
      }

      .header h1 {
        margin: 0;
        font-size: 26px;
      }

      .badge {
        display: inline-block;
        margin-top: 16px;
        padding: 6px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.5);
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1.4px;
      }

      .content {
        padding: 32px;
        line-height: 1.55;
        font-size: 16px;
        color: var(--text);
      }

      .content p {
        margin: 0 0 18px;
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
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing RESEND_API_KEY environment variable" }),
      { status: 500 },
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
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400 });
  }

  if (!payload.to || !payload.subject || !payload.html) {
    return new Response(JSON.stringify({ error: "Missing to/subject/html fields" }), { status: 400 });
  }

  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: recipients,
      subject: payload.subject,
      html: wrapWithAriTemplate(payload.subject, payload.html, payload.badge),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Resend error", data);
    return new Response(JSON.stringify({ error: "Failed to send email", details: data }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { "Content-Type": "application/json" },
  });
});
