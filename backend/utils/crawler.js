import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";

const UA = "Mozilla/5.0 (compatible; LunaarBot/1.0)";
const MAX_HTML = 2_000_000;
const MAX_TEXT = Number(process.env.READ_URL_MAX_CHARS) || 5000;
const MAX_LINKS = 12;

function cut(text, max) {
  if (text.length <= max) return { text, truncated: false };
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return { text: (lastSpace > max * 0.8 ? slice.slice(0, lastSpace) : slice).trim(), truncated: true };
}

export async function readUrl(url) {
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http/https URLs are allowed");

  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (r.status === 401 || r.status === 403 || r.status === 429) {
    throw new Error(`returned ${r.status}: this site blocks automated access, do not retry, use another source`);
  }
  if (!r.ok) throw new Error(`returned ${r.status}`);

  const type = r.headers.get("content-type") || "";
  if (!type.includes("html")) throw new Error(`Unsupported content type: ${type}`);

  const html = (await r.text()).slice(0, MAX_HTML);
  const dom = new JSDOM(html, { url: r.url, virtualConsole: new VirtualConsole() });
  const doc = dom.window.document;

  const seen = new Set();
  const links = [];
  for (const a of doc.querySelectorAll("a[href]")) {
    const text = a.textContent.replace(/\s+/g, " ").trim().slice(0, 100);
    const href = a.href;
    if (text.length < 3 || !href.startsWith("http")) continue;
    const clean = href.split("#")[0];
    if (seen.has(clean)) continue;
    seen.add(clean);
    links.push({ text, url: clean });
    if (links.length >= MAX_LINKS) break;
  }

  const article = new Readability(doc.cloneNode(true)).parse();

  const full = (article?.textContent || doc.body?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();

  const { text, truncated } = cut(full, MAX_TEXT);
  const title = article?.title || doc.title || "";

  dom.window.close();

  return { url: r.url, title, text, truncated, links };
}
