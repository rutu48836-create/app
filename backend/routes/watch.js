import express from "express";
import supabase from "../utils/supabase.js";
import { checkWatch, runDueWatches, clampInterval } from "../utils/watcher.js";

const router = express.Router();

const validUrl = (u) => {
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
};

router.post("/", async (req, res) => {
  const { user_id, url, selector, interval_minutes } = req.body;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });
  if (!validUrl(url)) return res.status(400).json({ error: "Invalid URL" });

  const { data, error } = await supabase
    .from("watches")
    .upsert(
      {
        owner_id: user_id,
        url,
        selector: selector || null,
        interval_minutes: clampInterval(interval_minutes),
        active: true,
      },
      { onConflict: "owner_id,url" }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const first = await checkWatch(data);
  return res.status(200).json({ data, first });
});

router.get("/:user_id", async (req, res) => {
  const { data, error } = await supabase
    .from("watches")
    .select("id, url, selector, interval_minutes, active, last_checked_at, last_changed_at, last_error")
    .eq("owner_id", req.params.user_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
});

router.get("/:user_id/events", async (req, res) => {
  const { data, error } = await supabase
    .from("watch_events")
    .select("id, watch_id, added, removed, created_at, watches(url)")
    .eq("owner_id", req.params.user_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
});

router.patch("/:id", async (req, res) => {
  const { user_id, interval_minutes, selector, active } = req.body;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  const patch = {};
  if (interval_minutes !== undefined) patch.interval_minutes = clampInterval(interval_minutes);
  if (selector !== undefined) patch.selector = selector ? String(selector).slice(0, 200) : null;
  if (active !== undefined) {
    patch.active = !!active;
    if (active) patch.last_error = null;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });

  const { data, error } = await supabase
    .from("watches")
    .update(patch)
    .eq("id", req.params.id)
    .eq("owner_id", user_id)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Watch not found" });
  return res.status(200).json({ data });
});

router.delete("/:id", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  const { error } = await supabase.from("watches").delete().eq("id", req.params.id).eq("owner_id", user_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ message: "Deleted" });
});

router.post("/run", async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const out = await runDueWatches(async (watch, result) => {
      console.log("watch changed:", watch.url, result.added.slice(0, 120));
    });
    return res.status(200).json(out);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;