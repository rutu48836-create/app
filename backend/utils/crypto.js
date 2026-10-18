
import crypto from "crypto";

const secret = process.env.KEY_ENCRYPTION_SECRET;
if (!secret || secret.length !== 64) {
  throw new Error("KEY_ENCRYPTION_SECRET must be 64 hex characters");
}
const key = Buffer.from(secret, "hex");

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(":");
}

export function decrypt(payload) {
  const [iv, tag, enc] = payload.split(":").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}