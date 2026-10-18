
import crypto from "crypto";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import supabase from "./supabase.js";

const MAX_TEXT = 200000;
const MAX_DIFF = 4000;
const CONCURRENCY = 3;
const UA = "LunaarWatcher/1.0 (+https://lunaar.online)";

function extract(html, selector) {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,iframe,nav,footer").remove();
  $("br,p,div,li,tr,h1,h2,h3,h4,h5,h6").after("\n");
  const root = selector ? $(selector) : $("body");
  return root
    .text()
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT);
}

async function allowedByRobots(url) {
  try {
    const origin = new URL(url).origin;
    const robotsUrl = `${origin}/robots.txt`;
    const r = await fetch(robotsUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return true;
    const robots = robotsParser(robotsUrl, await r.text());
    return robots.isAllowed(url, UA) !== false;
  } catch {
    return true;
  }
}

async function fetchPage(url) {
  if (!(await allowedByRobots(url))) {
    throw new Error("robots_disallowed: this site does not allow automated access to this page.");
  }

  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (r.status === 401) throw new Error("login_required: this page needs authentication.");
  if (r.status === 403 || r.status === 503 || r.headers.get("cf-mitigated") === "challenge") {
    throw new Error("blocked: the site refused automated access. Try its RSS feed or API instead.");
  }
  if (r.status === 429) throw new Error("rate_limited: the site is limiting requests. Use a longer interval.");
  if (r.status === 404 || r.status === 410) throw new Error("not_found: the page no longer exists.");
  if (!r.ok) throw new Error(`http_${r.status}: the site returned an error.`);

  const type = r.headers.get("content-type") || "";
  if (!/text\/|html|xml|json/i.test(type)) throw new Error("unsupported_type: not a text page.");

  return r.text();
}

function diffLines(prev, next) {
  const a = new Set(prev.split("\n"));
  const b = new Set(next.split("\n"));
  const added = [...b].filter((l) => !a.has(l));
  const removed = [...a].filter((l) => !b.has(l));
  return {
    added: added.join("\n").slice(0, MAX_DIFF),
    removed: removed.join("\n").slice(0, MAX_DIFF),
  };
}

export async function checkWatch(w) {
  const now = new Date().toISOString();
  try {
    const html = await fetchPage(w.url);
    const text = extract(html, w.selector);
    if (!text) {
      throw new Error("no_text: the page may need JavaScript, or the selector matches nothing.");
    }
    const hash = crypto.createHash("sha256").update(text).digest("hex");

    if (!w.last_hash) {
      await supabase
        .from("watches")
        .update({ last_hash: hash, last_text: text, last_checked_at: now, last_error: null })
        .eq("id", w.id);
      return { changed: false, baseline: true };
    }

    if (hash === w.last_hash) {
      await supabase.from("watches").update({ last_checked_at: now, last_error: null }).eq("id", w.id);
      return { changed: false };
    }

    const { added, removed } = diffLines(w.last_text || "", text);

    await supabase.from("watch_events").insert({
      watch_id: w.id,
      owner_id: w.owner_id,
      added,
      removed,
    });

    await supabase
      .from("watches")
      .update({
        last_hash: hash,
        last_text: text,
        last_checked_at: now,
        last_changed_at: now,
        last_error: null,
      })
      .eq("id", w.id);

    return { changed: true, added, removed };
  } catch (e) {
    const permanent = /^(robots_disallowed|login_required|blocked|not_found|unsupported_type)/.test(e.message);
    await supabase
      .from("watches")
      .update({
        last_checked_at: now,
        last_error: e.message.slice(0, 300),
        ...(permanent ? { active: false } : {}),
      })
      .eq("id", w.id);
    return { changed: false, error: e.message };
  }
}

export async function runDueWatches(onChange) {
  const { data, error } = await supabase.from("watches").select("*").eq("active", true);
  if (error) throw new Error(error.message);

  const nowMs = Date.now();
  const due = (data || []).filter(
    (w) => !w.last_checked_at || nowMs - new Date(w.last_checked_at).getTime() >= w.interval_minutes * 60000
  );

  let changed = 0;
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const batch = due.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((w) => checkWatch(w)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j].changed) {
        changed += 1;
        if (onChange) await onChange(batch[j], results[j]).catch((e) => console.log("notify error", e.message));
      }
    }
  }

  return { checked: due.length, changed };
}