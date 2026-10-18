import express from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import supabase from "../utils/supabase.js";

const router = express.Router();

const MAX_CHARS = 300000;
const MAX_WRITE = 200000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const extOf = (name) => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

async function requireUser(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Unauthorized" });

  req.user = data.user;
  next();
}

function parseBlocks(content) {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const t = line.trimEnd();
      if (!t.trim()) return { type: "blank", text: "" };
      if (t.startsWith("### ")) return { type: "h3", text: t.slice(4) };
      if (t.startsWith("## ")) return { type: "h2", text: t.slice(3) };
      if (t.startsWith("# ")) return { type: "h1", text: t.slice(2) };
      if (/^[-*]\s+/.test(t)) return { type: "bullet", text: t.replace(/^[-*]\s+/, "") };
      return { type: "p", text: t };
    });
}

function buildPdf(blocks) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (const b of blocks) {
      if (b.type === "h1") doc.font("Helvetica-Bold").fontSize(20).text(b.text).moveDown(0.5);
      else if (b.type === "h2") doc.font("Helvetica-Bold").fontSize(16).text(b.text).moveDown(0.4);
      else if (b.type === "h3") doc.font("Helvetica-Bold").fontSize(13).text(b.text).moveDown(0.3);
      else if (b.type === "bullet") doc.font("Helvetica").fontSize(11).text(`\u2022 ${b.text}`, { indent: 12 }).moveDown(0.2);
      else if (b.type === "blank") doc.moveDown(0.5);
      else doc.font("Helvetica").fontSize(11).text(b.text).moveDown(0.2);
    }

    doc.end();
  });
}

function buildDocx(blocks) {
  const children = blocks.map((b) => {
    if (b.type === "h1") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1 });
    if (b.type === "h2") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2 });
    if (b.type === "h3") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_3 });
    if (b.type === "bullet") return new Paragraph({ text: b.text, bullet: { level: 0 } });
    return new Paragraph({ text: b.text });
  });

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

router.post("/extract-text", requireUser, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const ext = extOf(String(req.body.name || req.file.originalname || ""));
    let text = "";

    if (ext === "pdf") {
      const out = await pdf(req.file.buffer);
      text = out.text || "";
    } else if (ext === "docx") {
      const out = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = out.value || "";
    } else {
      return res.status(415).json({ error: `Unsupported file type: ${ext || "none"}` });
    }

    text = text.replace(/\n{3,}/g, "\n\n").trim();
    return res.json({ text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS });
  } catch (e) {
    console.log("extract error", e.message);
    return res.status(500).json({ error: "Failed to read the document" });
  }
});

router.post("/generate-doc", requireUser, async (req, res) => {
  try {
    const name = String(req.body?.name || "");
    const content = String(req.body?.content ?? "").slice(0, MAX_WRITE);
    const ext = extOf(name);

    if (!content.trim()) return res.status(400).json({ error: "Content is empty" });

    const blocks = parseBlocks(content);
    let buffer;

    if (ext === "pdf") buffer = await buildPdf(blocks);
    else if (ext === "docx") buffer = await buildDocx(blocks);
    else return res.status(415).json({ error: `Unsupported file type: ${ext || "none"}` });

    return res.json({ base64: buffer.toString("base64") });
  } catch (e) {
    console.log("generate error", e.message);
    return res.status(500).json({ error: "Failed to create the document" });
  }
});

export default router;