import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

type RelayConfig = {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fallbackFrom: string;
  authToken?: string;
};

function readConfig(): RelayConfig | null {
  const host = process.env.RELAY_SMTP_HOST;
  if (!host) return null;

  return {
    host,
    port: Number(process.env.RELAY_SMTP_PORT ?? "465"),
    secure: (process.env.RELAY_SMTP_SECURE ?? "true").toLowerCase() !== "false",
    username: process.env.RELAY_SMTP_USERNAME,
    password: process.env.RELAY_SMTP_PASSWORD,
    fallbackFrom: process.env.RELAY_FROM_FALLBACK ?? "notifications@ari-worms.de",
    authToken: process.env.RELAY_AUTH_TOKEN,
  };
}

function createTransport(config: RelayConfig) {
  const auth = config.username && config.password ? { user: config.username, pass: config.password } : undefined;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const config = readConfig();
  if (!config) {
    return res.status(500).json({ error: "Missing RELAY_SMTP_HOST environment variable" });
  }

  if (req.method === "GET") {
    try {
      const transporter = createTransport(config);
      await transporter.verify();
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ ok: false, error: String(error) });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (config.authToken) {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader !== `Bearer ${config.authToken}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { from, to, subject, html } = (req.body ?? {}) as {
    from?: string;
    to?: string | string[];
    subject?: string;
    html?: string;
  };

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Missing to, subject or html" });
  }

  const recipients = Array.isArray(to) ? to : [to];

  try {
    const transporter = createTransport(config);
    await transporter.sendMail({
      from: from ?? config.fallbackFrom,
      to: recipients,
      subject,
      html,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Vercel relay send failed", error);
    return res.status(500).json({ error: "Failed to send", details: String(error) });
  }
}
