import "dotenv/config";
import crypto from "crypto";
import supabase from "./supabase.js";
import { encrypt, decrypt } from "./crypto.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const stateSecret = Buffer.from(process.env.KEY_ENCRYPTION_SECRET, "hex");

const sign = (payload) =>
  crypto.createHmac("sha256", stateSecret).update(payload).digest("hex");

export function authUrl(userId) {
  const payload = `${userId}.${Date.now()}`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: `${payload}.${sign(payload)}`,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function verifyState(state) {
  const parts = String(state || "").split(".");
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(`${userId}.${ts}`));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() - Number(ts) > 10 * 60 * 1000) return null;
  return userId;
}

export async function saveConnection(code, userId) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) throw new Error(j.error_description || "No refresh token returned");

  const granted = String(j.scope || "");
  if (!granted.includes("gmail.readonly") || !granted.includes("gmail.send")) {
    throw new Error("Both the read and send permissions must be allowed");
  }

  const p = await fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${j.access_token}` } });
  const profile = await p.json();

  const { error } = await supabase.from("email_connections").upsert({
    user_id: userId,
    email: profile.emailAddress || null,
    refresh_token_enc: encrypt(j.refresh_token),
  });
  if (error) throw new Error(error.message);

  return profile.emailAddress;
}

export async function getConnection(userId) {
  const { data } = await supabase
    .from("email_connections")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export async function removeConnection(userId) {
  await supabase.from("email_connections").delete().eq("user_id", userId);
}

async function accessToken(userId) {
  const { data } = await supabase
    .from("email_connections")
    .select("refresh_token_enc")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: decrypt(data.refresh_token_enc),
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || "Gmail access expired, reconnect Gmail");
  return j.access_token;
}

const headerMap = (m) =>
  Object.fromEntries((m.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));

const decode = (data) =>
  Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function extractText(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  if (part.parts) {
    for (const p of part.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decode(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

export async function searchEmails(userId, query, max) {
  const token = await accessToken(userId);
  if (!token) return { error: "Gmail is not connected" };
  const headers = { Authorization: `Bearer ${token}` };

  const limit = Math.min(Math.max(Number(max) || 5, 1), 10);
  const list = await (
    await fetch(`${API}/messages?${new URLSearchParams({ q: query || "", maxResults: String(limit) })}`, { headers })
  ).json();

  const ids = (list.messages || []).map((m) => m.id);

  const emails = await Promise.all(
    ids.map(async (id) => {
      const r = await fetch(
        `${API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers }
      );
      const m = await r.json();
      const h = headerMap(m);
      return { id, from: h.from, subject: h.subject, date: h.date, snippet: m.snippet };
    })
  );

  return { emails };
}

export async function readEmail(userId, id) {
  const token = await accessToken(userId);
  if (!token) return { error: "Gmail is not connected" };

  const r = await fetch(`${API}/messages/${encodeURIComponent(id)}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const m = await r.json();
  if (!r.ok) return { error: m.error?.message || "Could not read that email" };

  const h = headerMap(m);
  return {
    id,
    from: h.from,
    to: h.to,
    subject: h.subject,
    date: h.date,
    body: extractText(m.payload).slice(0, 4000),
  };
}

const ADDRESS = /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[^\s@<>,;"'()]+$/;

export async function createDraft(userId, botId, args) {
  const to = String(args.to || "").trim();
  const subject = String(args.subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  const body = String(args.body || "").trim().slice(0, 10000);

  if (!ADDRESS.test(to) || to.length > 254) return { error: "Invalid recipient address. Use one plain email address." };
  if (!subject) return { error: "Subject is required" };
  if (!body) return { error: "Body is required" };

  const { data, error } = await supabase
    .from("email_drafts")
    .insert({ user_id: userId, bot_id: botId, to_address: to, subject, body })
    .select("id")
    .single();

  if (error) return { error: error.message };

  return {
    status: "draft_created_awaiting_user_approval",
    draft_id: data.id,
    note: "Nothing has been sent. The user must tap Send on the draft card in the app.",
  };
}

export async function listDrafts(userId, botId) {
  const { data, error } = await supabase
    .from("email_drafts")
    .select("id, to_address, subject, body, created_at")
    .eq("user_id", userId)
    .eq("bot_id", botId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function discardDraft(userId, id) {
  const { data, error } = await supabase
    .from("email_drafts")
    .update({ status: "discarded" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Draft not found or already handled" };
  return { ok: true };
}

async function sendEmail(userId, draft) {
  const token = await accessToken(userId);
  if (!token) throw new Error("Gmail is not connected");

  const subject = /^[\x20-\x7e]*$/.test(draft.subject)
    ? draft.subject
    : `=?UTF-8?B?${Buffer.from(draft.subject, "utf8").toString("base64")}?=`;

  const raw = [
    `To: ${draft.to_address}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(draft.body, "utf8").toString("base64"),
  ].join("\r\n");

  const r = await fetch(`${API}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
  });
  const j = await r.json();

  if (r.status === 403) throw new Error("Sending is not allowed yet. Disconnect and reconnect Gmail, and allow sending.");
  if (!r.ok) throw new Error(j.error?.message || "Gmail could not send the email");

  return j.id;
}

export async function sendDraft(userId, id) {
  const { data: draft, error } = await supabase
    .from("email_drafts")
    .update({ status: "sending" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id, to_address, subject, body")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!draft) return { error: "Draft not found or already handled" };

  try {
    await sendEmail(userId, draft);
    await supabase.from("email_drafts").update({ status: "sent" }).eq("id", id);
    return { ok: true };
  } catch (e) {
    await supabase.from("email_drafts").update({ status: "pending" }).eq("id", id);
    return { error: e.message };
  }
}