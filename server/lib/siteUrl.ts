import type { Request } from "express";

export function resolveSiteUrl(req?: Request): string {
  const envUrl = process.env.PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (!req) return "http://localhost:3000";

  const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "").toString();
  if (!host) return "http://localhost:3000";

  const protoHeader = req.headers["x-forwarded-proto"];
  const protocol = protoHeader
    ? protoHeader.toString()
    : host.includes("localhost")
      ? "http"
      : "https";

  return `${protocol}://${host}`.replace(/\/$/, "");
}
