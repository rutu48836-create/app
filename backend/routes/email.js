import express from "express";
import {
  authUrl,
  verifyState,
  saveConnection,
  getConnection,
  removeConnection,
  listDrafts,
  sendDraft,
  discardDraft,
} from "../utils/gmail.js";

const router = express.Router();

const APP_REDIRECT_URL = process.env.APP_REDIRECT_URL || "myapp://email/callback";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const page = (message) =>
  `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gmail</title></head><body style="font-family:sans-serif;padding:32px"><p>${esc(message)}</p></body></html>`;

const backToApp = (res, status, params = {}) => {
  const query = new URLSearchParams({ status, ...params }).toString();
  const target = `${APP_REDIRECT_URL}${APP_REDIRECT_URL.includes("?") ? "&" : "?"}${query}`;
  const safe = esc(target);
  const jsTarget = JSON.stringify(target).replace(/</g, "\\u003c");

  return res
    .status(200)
    .send(
      `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${safe}"><title>Gmail</title></head><body style="font-family:sans-serif;padding:32px"><p>Returning to the app...</p><p><a href="${safe}">Tap here if nothing happens</a></p><script>window.location.replace(${jsTarget});</script></body></html>`
    );
};

router.get("/email/status", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  try {
    const conn = await getConnection(user_id);
    return res.status(200).json({ connected: !!conn, email: conn?.email || null });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/email/start", (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).send(page("Missing user id."));

  try {
    return res.redirect(authUrl(user_id));
  } catch (e) {
    console.log(e);
    return res.status(500).send(page("Could not start the Gmail connection."));
  }
});

router.get("/email/connect", (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });
  return res.status(200).json({ url: authUrl(user_id) });
});

router.get("/email/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const userId = verifyState(state);

  if (error || !code || !userId) {
    return backToApp(res, "error", { reason: error ? "denied" : "invalid_request" });
  }

  try {
    const email = await saveConnection(code, userId);
    return backToApp(res, "success", email ? { email } : {});
  } catch (e) {
    console.log(e);
    return backToApp(res, "error", { reason: "connect_failed" });
  }
});

router.post("/email/disconnect", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  try {
    await removeConnection(user_id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/email/drafts", async (req, res) => {
  const { user_id, bot_id } = req.query;
  if (!user_id || !bot_id) return res.status(400).json({ error: "Missing user id or bot id" });

  try {
    const data = await listDrafts(user_id, bot_id);
    return res.status(200).json({ data });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/email/drafts/:id/send", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  try {
    const result = await sendDraft(user_id, req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/email/drafts/:id/discard", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  try {
    const result = await discardDraft(user_id, req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
