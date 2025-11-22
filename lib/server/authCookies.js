import { serialize, parse } from "cookie";

const SESSION_COOKIE_NAME = "ari_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function createSessionCookie(token) {
  return serialize(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie() {
  return serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function readSessionCookie(req) {
  if (!req.headers.cookie) return null;
  const cookies = parse(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] ?? null;
}
