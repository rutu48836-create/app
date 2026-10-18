import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const UA = "Mozilla/5.0 (compatible; LunaarBot/1.0)";

export async function readUrl(url) {
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http/https URLs are allowed");

  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`returned ${r.status}`);

  const type = r.headers.get("content-type") || "";
  if (!type.includes("html")) throw new Error(`Unsupported content type: ${type}`);

  const html = await r.text();
  const dom = new JSDOM(html, { url: r.url });
  const doc = dom.window.document;

  const links = [...doc.querySelectorAll("a[href]")]
    .map((a) => ({ text: a.textContent.trim().slice(0, 100), url: a.href }))
    .filter((l) => l.text && l.url.startsWith("http"));

  const article = new Readability(doc.cloneNode(true)).parse();

  const text = (article?.textContent || doc.body?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();

  return { url: r.url, title: article?.title || doc.title || "", text, links };
}