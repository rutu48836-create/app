const CACHE_TTL = 10 * 60 * 1000;
const SERVICE_PAUSE = 2 * 60 * 1000;

const cache = new Map();
let serviceDownUntil = 0;


const FALLBACK_NOTE =
  "General web search is unavailable right now, so these results come only from Wikipedia, Hacker News, Stack Overflow and GitHub. Tell the user the coverage is limited and suggest pasting links for anything else.";

const clean = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

async function getJson(url, headers = {}) {
  const r = await fetch(url, {
    headers: { "User-Agent": "LunaarBot/1.0 (research assistant)", Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`returned ${r.status}`);
  return r.json();
}

export async function serviceSearch(q, limit) {
  const base = process.env.SEARCH_SERVICE_URL;
  if (!base) {
    console.log("SEARCH_SERVICE_URL is not set");
    return [];
  }
  if (Date.now() < serviceDownUntil) {
    console.log("search service paused after earlier failure");
    return [];
  }

  try {
    const p = new URLSearchParams({ q, max: String(limit) });
    const r = await fetch(`${base.replace(/\/$/, "")}/search?${p}`, {
      headers: { "x-service-key": process.env.SEARCH_SERVICE_SECRET || "" },
      signal: AbortSignal.timeout(25000),
    });

    if (r.status === 401) {
      console.log("search service rejected the key, check SEARCH_SERVICE_SECRET");
      serviceDownUntil = Date.now() + SERVICE_PAUSE;
      return [];
    }

    if (!r.ok) throw new Error(`returned ${r.status}`);

    const j = await r.json();
    console.log("search service ok, keys:", Object.keys(j), "count:", (j.results || []).length);

    return (j.results || [])
      .filter((x) => x && x.title && typeof x.url === "string" && x.url.startsWith("http"))
      .slice(0, limit)
      .map((x) => ({ title: x.title, url: x.url, snippet: x.snippet || "", source: "web" }));
  } catch (e) {
    console.log("search service failed:", e.message);
    serviceDownUntil = Date.now() + 30 * 1000; // shorter pause
    return [];
  }
}

async function wikipedia(q, n) {
  const p = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: q,
    srlimit: String(n),
    format: "json",
  });
  const j = await getJson(`https://en.wikipedia.org/w/api.php?${p}`);

  return (j.query?.search || []).map((x) => ({
    title: x.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(x.title.replace(/ /g, "_"))}`,
    snippet: clean(x.snippet),
    source: "wikipedia",
  }));
}

async function hackernews(q, n) {
  const p = new URLSearchParams({ query: q, tags: "story", hitsPerPage: String(n) });
  const j = await getJson(`https://hn.algolia.com/api/v1/search?${p}`);

  return (j.hits || [])
    .filter((x) => x.title)
    .map((x) => {
      const thread = `https://news.ycombinator.com/item?id=${x.objectID}`;
      return {
        title: clean(x.title),
        url: x.url || thread,
        snippet: `${x.points ?? 0} points, ${x.num_comments ?? 0} comments. Discussion: ${thread}`,
        source: "hackernews",
      };
    });
}

async function stackoverflow(q, n) {
  const p = new URLSearchParams({
    order: "desc",
    sort: "relevance",
    q,
    site: "stackoverflow",
    pagesize: String(n),
  });
  const j = await getJson(`https://api.stackexchange.com/2.3/search/advanced?${p}`);

  return (j.items || []).map((x) => ({
    title: clean(x.title),
    url: x.link,
    snippet: `${x.score ?? 0} votes, ${x.answer_count ?? 0} answers${x.is_answered ? ", answered" : ""}`,
    source: "stackoverflow",
  }));
}

async function github(q, n) {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const p = new URLSearchParams({ q, per_page: String(n) });
  const j = await getJson(`https://api.github.com/search/repositories?${p}`, headers);

  return (j.items || []).map((x) => ({
    title: x.full_name,
    url: x.html_url,
    snippet: `${x.stargazers_count ?? 0} stars. ${clean(x.description)}`.trim(),
    source: "github",
  }));
}

const FREE_SOURCES = [
  { name: "wikipedia", run: wikipedia },
  { name: "hackernews", run: hackernews },
  { name: "stackoverflow", run: stackoverflow },
  { name: "github", run: github },
];

function interleave(lists, limit) {
  const out = [];
  const seen = new Set();
  const longest = Math.max(0, ...lists.map((l) => l.length));

  for (let i = 0; i < longest && out.length < limit; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item && item.url && !seen.has(item.url) && out.length < limit) {
        seen.add(item.url);
        out.push(item);
      }
    }
  }

  return out;
}

async function freeSearch(q, limit) {
  const settled = await Promise.allSettled(FREE_SOURCES.map((s) => s.run(q, limit)));

  const lists = [];
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") lists.push(res.value);
    else console.log(`search source ${FREE_SOURCES[i].name} failed:`, res.reason?.message);
  });

  if (!lists.length) throw new Error("Search is unavailable right now");

  return interleave(lists, limit);
}

export async function searchWeb(query, max = 8) {
  const q = String(query || "").trim().slice(0, 200);
  if (!q) throw new Error("Query is required");

  const limit = Math.min(Math.max(Number(max) || 8, 1), 15);
  const cacheKey = `${q.toLowerCase()}|${limit}`;
  const hit = cache.get(cacheKey);

  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;

  let value = null;

  const web = await serviceSearch(q, limit);
  if (web.length) value = { results: web };

  if (!value) value = { results: await freeSearch(q, limit), note: FALLBACK_NOTE };

  if (value.results.length) {
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { at: Date.now(), value });
  }

  return value;
}