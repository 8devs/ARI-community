export function resolveSiteUrl(req) {
  const envUrl = process.env.PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  const host =
    (req?.headers?.["x-forwarded-host"] ??
      req?.headers?.host ??
      process.env.VERCEL_URL ??
      "").toString();

  if (!host) {
    return "https://www.ari-worms.de";
  }

  const protoHeader = req?.headers?.["x-forwarded-proto"];
  const protocol = protoHeader
    ? protoHeader.toString()
    : host.includes("localhost")
      ? "http"
      : "https";

  return `${protocol}://${host}`.replace(/\/$/, "");
}
