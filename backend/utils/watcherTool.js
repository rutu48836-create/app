import supabase from "./supabase.js";
import { checkWatch } from "./watcher.js";

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$)/i;

function safeUrl(u) {
  try {
    const p = new URL(String(u));
    if (!/^https?:$/.test(p.protocol)) return null;
    if (PRIVATE_HOST.test(p.hostname)) return null;
    return p.toString();
  } catch {
    return null;
  }
}

export const WATCH_TOOLS = [
  {
    name: "watch_url",
    description:
      "Start watching one public web page for changes. Checks it once immediately to record a baseline. Optional css selector limits what is compared, for example .job-list.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full http or https URL" },
        selector: { type: "string", description: "Optional CSS selector for the part of the page to watch" },
        interval_minutes: { type: "integer", description: "Check interval, 15 to 1440, default 60" },
      },
      required: ["url"],
    },
  },
  {
    name: "list_watches",
    description: "List the pages the user is watching, with last checked time, last change time and any error.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "recent_changes",
    description: "Show the most recent detected changes across the user's watched pages, with added and removed text.",
    parameters: {
      type: "object",
      properties: { limit: { type: "integer", description: "Number of changes, 1 to 10" } },
    },
  },
  {
    name: "stop_watching",
    description: "Stop watching a page and delete its history.",
    parameters: {
      type: "object",
      properties: { url: { type: "string", description: "The exact URL that was being watched" } },
      required: ["url"],
    },
  },
];

export const WATCH_NAMES = new Set(WATCH_TOOLS.map((t) => t.name));

export const WATCH_NOTE =
  "\n\nYou can also watch pages for changes with watch_url, list_watches, recent_changes and stop_watching. Watch a page only when the user asks. You cannot notify the user on your own: tell them to ask you for recent changes. If watch_url returns an error, explain it plainly and suggest the site's RSS feed or API instead.";

export async function runWatchTool(userId, name, args) {
  if (name === "watch_url") {
    const url = safeUrl(args.url);
    if (!url) return { error: "Invalid or non-public URL." };

    const interval = Math.min(Math.max(parseInt(args.interval_minutes, 10) || 60, 15), 1440);

    const { data, error } = await supabase
      .from("watches")
      .upsert(
        {
          owner_id: userId,
          url,
          selector: args.selector ? String(args.selector).slice(0, 200) : null,
          interval_minutes: interval,
          active: true,
        },
        { onConflict: "owner_id,url" }
      )
      .select()
      .single();

    if (error) return { error: error.message };

    const first = await checkWatch(data);
    if (first.error) return { watching: false, error: first.error };
    return { watching: true, url, interval_minutes: interval, baseline_recorded: !!first.baseline };
  }

  if (name === "list_watches") {
    const { data, error } = await supabase
      .from("watches")
      .select("url, selector, interval_minutes, active, last_checked_at, last_changed_at, last_error")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return { error: error.message };
    return { watches: data };
  }

  if (name === "recent_changes") {
    const limit = Math.min(Math.max(parseInt(args.limit, 10) || 5, 1), 10);
    const { data, error } = await supabase
      .from("watch_events")
      .select("added, removed, created_at, watches(url)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { error: error.message };
    return {
      changes: (data || []).map((e) => ({
        url: e.watches?.url,
        at: e.created_at,
        added: String(e.added || "").slice(0, 600),
        removed: String(e.removed || "").slice(0, 300),
      })),
    };
  }

  if (name === "stop_watching") {
    const url = safeUrl(args.url);
    if (!url) return { error: "Invalid URL." };
    const { error } = await supabase.from("watches").delete().eq("owner_id", userId).eq("url", url);
    if (error) return { error: error.message };
    return { stopped: true };
  }

  return { error: "Unknown tool" };
}