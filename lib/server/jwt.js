import jwt from "jsonwebtoken";

const SESSION_SECRET = process.env.AUTH_SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("Missing AUTH_SESSION_SECRET env variable");
}

export function signSession(payload) {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "7d" });
}

export function verifySession(token) {
  return jwt.verify(token, SESSION_SECRET);
}
