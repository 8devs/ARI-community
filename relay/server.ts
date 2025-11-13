import express from "express";
import nodemailer from "nodemailer";

const {
  RELAY_PORT = "8788",
  RELAY_AUTH_TOKEN,
  RELAY_SMTP_HOST,
  RELAY_SMTP_PORT = "465",
  RELAY_SMTP_SECURE = "true",
  RELAY_SMTP_USERNAME,
  RELAY_SMTP_PASSWORD,
  RELAY_FROM_FALLBACK = "notifications@ari-worms.de",
} = process.env;

if (!RELAY_SMTP_HOST) {
  console.error("Missing RELAY_SMTP_HOST environment variable");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: RELAY_SMTP_HOST,
  port: Number(RELAY_SMTP_PORT),
  secure: RELAY_SMTP_SECURE.toLowerCase() !== "false",
  auth:
    RELAY_SMTP_USERNAME && RELAY_SMTP_PASSWORD
      ? {
          user: RELAY_SMTP_USERNAME,
          pass: RELAY_SMTP_PASSWORD,
        }
      : undefined,
});

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  try {
    await transporter.verify();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.post("/send", async (req, res) => {
  if (RELAY_AUTH_TOKEN) {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader !== `Bearer ${RELAY_AUTH_TOKEN}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { from, to, subject, html } = req.body ?? {};

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Missing to, subject or html" });
  }

  const recipients = Array.isArray(to) ? to : [to];

  try {
    await transporter.sendMail({
      from: from ?? RELAY_FROM_FALLBACK,
      to: recipients,
      subject,
      html,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("SMTP relay send failed", error);
    res.status(500).json({ error: "Failed to send", details: String(error) });
  }
});

app.listen(Number(RELAY_PORT), () => {
  console.log(`Email relay listening on port ${RELAY_PORT}`);
});
