import jwt from "jsonwebtoken";

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  organization_id: string | null;
}

function getSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SESSION_SECRET env variable");
  }
  return secret;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, getSecret()) as SessionPayload;
}
