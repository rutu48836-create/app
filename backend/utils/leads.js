
import { searchWeb } from "./search.js";
import { readUrl } from "./crawler.js";

const SKIP = /(facebook|instagram|linkedin|twitter|x\.com|youtube|justdial|indiamart|wikipedia|quora|reddit)\./i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE = /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;

async function scrape(url) {
  const base = new URL(url);
  const pages = [url, `${base.origin}/contact`];
  const settled = await Promise.allSettled(pages.map((p) => readUrl(p)));

  let text = "";
  const emails = new Set();
  const phones = new Set();

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const t = String(s.value?.text || "");
    text += " " + t;
    (t.match(EMAIL) || []).forEach((e) => emails.add(e.toLowerCase()));
    (t.match(PHONE) || []).forEach((n) => phones.add(n.trim()));
  }

  const cleanEmails = [...emails]
    .filter((e) => !/\.(png|jpe?g|gif|svg|webp)$/i.test(e))
    .slice(0, 3);

  return { text: text.trim(), emails: cleanEmails, phones: [...phones].slice(0, 2) };
}

export async function findLeads(query, limit = 5) {
  const res = await searchWeb(query, 10);
  const seen = new Set();
  const picks = [];

  for (const r of res.results || []) {
    if (picks.length >= limit) break;
    if (!r.url || SKIP.test(r.url)) continue;
    let domain;
    try {
      domain = new URL(r.url).hostname.replace("www.", "");
    } catch {
      continue;
    }
    if (seen.has(domain)) continue;
    seen.add(domain);
    picks.push({ title: r.title, url: r.url, domain });
  }

  return Promise.all(picks.map(async (p) => ({ ...p, ...(await scrape(p.url)) })));
}