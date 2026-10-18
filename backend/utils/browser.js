
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const PROFILES = path.resolve("browser-profiles");
const HEADLESS = process.env.BROWSER_HEADLESS === "true";
const CHANNEL = process.env.BROWSER_CHANNEL || "";
const TIMEOUT = 15000;

const RISKY =
  /\b(buy|purchase|pay|checkout|place order|order now|subscribe|submit|send|post|publish|tweet|delete|remove|unfollow|follow|confirm|apply|connect|transfer|withdraw|log out|logout|sign out)\b/i;

const SEARCHY = /search|find|query|lookup/i;

const SNAPSHOT = () => {
  document.querySelectorAll("[data-agent-id]").forEach((e) => e.removeAttribute("data-agent-id"));

  const nodes = [
    ...document.querySelectorAll(
      "a[href], button, input, textarea, select, [role=button], [role=link], [role=tab], [role=searchbox]"
    ),
  ];

  const visible = nodes
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && el.type !== "hidden";
    })
    .slice(0, 60);

  const elements = visible.map((el, i) => {
    const id = i + 1;
    el.setAttribute("data-agent-id", String(id));

    const isPassword = el.tagName === "INPUT" && el.type === "password";
    const raw =
      el.innerText ||
      (isPassword ? "" : el.value) ||
      el.placeholder ||
      el.getAttribute("aria-label") ||
      el.title ||
      "";

    return {
      id,
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      label: String(raw).replace(/\s+/g, " ").trim().slice(0, 80),
      href: el.tagName === "A" ? el.href : "",
    };
  });

  const text = (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 3000);

  return { elements, text };
};

const sessions = new Map();

async function launch(userId) {
  const safeId = String(userId).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) throw new Error("Invalid user id");

  const dir = path.join(PROFILES, safeId);
  fs.mkdirSync(dir, { recursive: true });

  const context = await chromium.launchPersistentContext(dir, {
    headless: HEADLESS,
    viewport: { width: 1280, height: 800 },
    ...(CHANNEL ? { channel: CHANNEL } : {}),
  });

  context.setDefaultTimeout(TIMEOUT);
  context.on("close", () => sessions.delete(userId));

  return { context };
}

function session(userId) {
  if (!sessions.has(userId)) {
    const p = launch(userId).catch((e) => {
      sessions.delete(userId);
      throw e;
    });
    sessions.set(userId, p);
  }
  return sessions.get(userId);
}

async function activePage(s) {
  const open = s.context.pages().filter((p) => !p.isClosed());
  return open[open.length - 1] || (await s.context.newPage());
}

function allowedUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links are allowed");

  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked =
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h === "::1" ||
    /^(127|10|0)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h);

  if (blocked) throw new Error("That address is not allowed");
  return url.toString();
}

async function snapshot(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(800);
  const data = await page.evaluate(SNAPSHOT);
  const title = await page.title().catch(() => "");
  return { url: page.url(), title, ...data };
}

async function labelOf(loc) {
  const el = loc.first();
  const parts = await Promise.all([
    el.innerText().catch(() => ""),
    el.getAttribute("value").catch(() => ""),
    el.getAttribute("aria-label").catch(() => ""),
    el.getAttribute("title").catch(() => ""),
  ]);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function target(userId, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return { error: "Invalid element id" };

  const s = await session(userId);
  const page = await activePage(s);
  const loc = page.locator(`[data-agent-id="${n}"]`);

  if (!(await loc.count())) return { error: "Element not found. Call browser_read again to get fresh ids." };
  return { s, page, loc };
}

export async function browserOpen(userId, url) {
  const href = allowedUrl(url);
  const s = await session(userId);
  const page = await activePage(s);
  await page.goto(href, { waitUntil: "domcontentloaded" });
  return snapshot(page);
}

export async function browserRead(userId) {
  const s = await session(userId);
  return snapshot(await activePage(s));
}

export async function browserClick(userId, id) {
  const t = await target(userId, id);
  if (t.error) return t;

  const label = await labelOf(t.loc);
  if (RISKY.test(label)) {
    return {
      error: `Blocked: "${label}" looks like an action that sends, buys, posts, deletes or follows. Tell the user and let them click it in the browser window.`,
    };
  }

  await t.loc.first().click();
  await t.page.waitForTimeout(500);
  return snapshot(await activePage(t.s));
}

export async function browserType(userId, id, text, submit) {
  const t = await target(userId, id);
  if (t.error) return t;

  const el = t.loc.first();
  const type = ((await el.getAttribute("type").catch(() => "")) || "").toLowerCase();

  if (type === "password") {
    return { error: "Blocked: the agent never types passwords. Ask the user to type it in the browser window." };
  }

  if (submit) {
    const hint = [
      type,
      await el.getAttribute("placeholder").catch(() => ""),
      await el.getAttribute("aria-label").catch(() => ""),
      await el.getAttribute("name").catch(() => ""),
    ].join(" ");

    if (!(type === "search" || SEARCHY.test(hint))) {
      return { error: "Blocked: pressing Enter is only allowed in search boxes. Type without submit and use a button instead." };
    }
  }

  await el.fill(String(text ?? "").slice(0, 2000));
  if (submit) await el.press("Enter");

  await t.page.waitForTimeout(500);
  return snapshot(await activePage(t.s));
}

export async function browserScroll(userId, direction) {
  const s = await session(userId);
  const page = await activePage(s);
  await page.mouse.wheel(0, direction === "up" ? -700 : 700);
  return snapshot(page);
}