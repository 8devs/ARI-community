import jwt from "jsonwebtoken";

const SESSION_SECRET = process.env.AUTH_SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("Missing AUTH_SESSION_SECRET env variable");
}

export type SessionPayload = {
  sub: string;
  email: string;
  role: string;
  organization_id?: string | null;
};

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "7d" });
}

export function verifySession<T = SessionPayload>(token: string) {
  return jwt.verify(token, SESSION_SECRET) as T;
}
