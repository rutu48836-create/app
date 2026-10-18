import supabase from "../utils/supabase.js";
import { encrypt, decrypt } from "../utils/crypto.js";
import { generateReply, ProviderError } from "../utils/llm.js";
import express from "express";
import { randomInt } from "crypto";

const router = express.Router();
const secureNumber = randomInt(100000, 1000000); 

const PROVIDERS = ["groq", "gemini"];
const MAX_CONTEXT = 20;
const GROUP_CONTEXT = 20;


function buildHistory(botId, thread, names) {
  const out = [];
  for (const m of thread.slice(-GROUP_CONTEXT)) {
    const mine = m.sender_type === "bot" && m.sender_id === botId;
    const role = mine ? "ai" : "human";
    const label = m.sender_type === "user" ? "User" : names[m.sender_id] || "Bot";
    const content = mine ? m.content : `[${label}]: ${m.content}`;
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content += "\n" + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== "human") out.shift();
  return out;
}


const cleanHistory = (messages) =>
  messages
    .filter((m) => (m.role === "human" || m.role === "ai") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-MAX_CONTEXT);

router.post("/bot_upload", async (req, res) => {
  const { botName, botDescription, botType, provider, apiKey, mascot, user_id } = req.body;

  if (!user_id) return res.status(400).json({ error: "Missing user id" });
  if (!botName || !botName.trim()) return res.status(400).json({ error: "Name is required" });
  if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "Invalid provider" });
  if (!apiKey || !apiKey.trim()) return res.status(400).json({ error: "API key is required" });

  try {
    const { data, error } = await supabase
      .from("bots")
      .insert({
        owner_id: user_id,
        tenant_id: user_id,
        name: botName.trim(),
        system_prompt: (botDescription || "").trim(),
        bot_type: botType,
        provider,
        avatar_config: mascot,
      })
      .select("id")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const { error: secretError } = await supabase
      .from("bot_secrets")
      .insert({ bot_id: data.id, api_key_enc: encrypt(apiKey.trim()) });

    if (secretError) {
      await supabase.from("bots").delete().eq("id", data.id);
      return res.status(500).json({ error: "Could not save API key" });
    }

    return res.status(200).json({ message: "Bot uploaded successfully", id: data.id });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/fetch_bot/:user_id", async (req, res) => {
  const { user_id } = req.params;
  if (!user_id) return res.status(400).json({ error: "Missing user" });

  try {
    const { data, error } = await supabase
      .from("bots")
      .select("id, name, system_prompt, bot_type, provider, avatar_config, avatar_url, created_at")
      .eq("owner_id", user_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ message: "fetched successfully", data });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/history/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;

  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  try {
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id")
      .eq("id", id)
      .eq("owner_id", user_id)
      .maybeSingle();

    if (botError) return res.status(500).json({ error: botError.message });
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, results, created_at")
      .eq("bot_id", id)
      .eq("user_id", user_id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ data });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/chat", async (req, res) => {
  const { user_id, messages, id } = req.body;

  if (!user_id) return res.status(400).json({ error: "Missing user id" });
  if (!id) return res.status(400).json({ error: "Missing bot id" });
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages required" });
  }

  const history = cleanHistory(messages);
  const last = history[history.length - 1];
  if (!last || last.role !== "human") {
    return res.status(400).json({ error: "Last message must be from the human" });
  }

  try {
    const { data: bot, error } = await supabase
      .from("bots")
      .select("id, system_prompt, provider, bot_type")
      .eq("id", id)
      .eq("owner_id", user_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    const { data: secret, error: secretError } = await supabase
      .from("bot_secrets")
      .select("api_key_enc")
      .eq("bot_id", id)
      .maybeSingle();

    if (secretError || !secret) return res.status(404).json({ error: "API key not found" });

    const out = await generateReply({
      provider: bot.provider,
      apiKey: decrypt(secret.api_key_enc),
      systemPrompt: bot.system_prompt || "",
      history,
      userId: user_id,
      botId: id,
      botType: bot.bot_type,
      toolRound: req.body.tool_round,
      fileList: req.body.files,
    });

    if (out && Array.isArray(out.tool_calls) && out.tool_calls.length > 0) {
      return res.status(200).json({ reply: "", results: [], tool_calls: out.tool_calls });
    }

    const replyText = typeof out === "string" ? out : String(out?.reply || "");
    const results = Array.isArray(out?.results) ? out.results : [];

    if (!replyText.trim()) {
      return res.status(502).json({ error: "The model returned an empty reply. Try again." });
    }

    const now = Date.now();
    const { error: saveError } = await supabase.from("messages").insert([
      {
        bot_id: id,
        user_id,
        role: "human",
        content: last.content,
        results: null,
        created_at: new Date(now).toISOString(),
      },
      {
        bot_id: id,
        user_id,
        role: "ai",
        content: replyText,
        results: results.length ? results : null,
        created_at: new Date(now + 1).toISOString(),
      },
    ]);

    if (saveError) console.log("history save failed", saveError.message);

    return res.status(200).json({ reply: replyText, results });
  } catch (e) {
    console.log(e);
    if (e instanceof ProviderError) return res.status(502).json({ error: e.message });
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/create_group", async (req, res) => {
  const { user_id, title, bots } = req.body;

  if (!user_id) return res.status(400).json({ error: "Missing user id" });
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
  if (!Array.isArray(bots) || bots.length < 2) {
    return res.status(400).json({ error: "Pick at least 2 bots" });
  }

  try {
    // 1. keep only bots this user owns, in the order they were picked
    const { data: owned, error: ownedError } = await supabase
      .from("bots")
      .select("id")
      .in("id", bots)
      .eq("owner_id", user_id);

    if (ownedError) return res.status(500).json({ error: ownedError.message });

    const ownedSet = new Set(owned.map((b) => b.id));
    const validIds = [...new Set(bots)].filter((id) => ownedSet.has(id));

    if (validIds.length < 2) {
      return res.status(400).json({ error: "Pick at least 2 of your bots" });
    }

    // 2. create the group (.single() returns one object, not an array)
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({ owner: user_id, title: title.trim() })
      .select()
      .single();

    if (groupError) {
      console.log("group insert failed", groupError.message);
      return res.status(500).json({ error: groupError.message });
    }

    if (!group || group.id == null) {
      console.log("group insert returned no id", group);
      return res.status(500).json({ error: "Group created but no id returned" });
    }

    // 3. one row per bot, one insert call
    const rows = validIds.map((bot_id, i) => ({
      group_id: group.id,
      bot_id,
      position: i,
    }));

    const { error: membersError } = await supabase.from("group_members").insert(rows);

    if (membersError) {
      console.log("members insert failed", membersError.message);
      await supabase.from("groups").delete().eq("id", group.id); // rollback
      return res.status(500).json({ error: membersError.message });
    }

    return res.status(200).json({
      message: "Group created",
      data: { ...group, members: validIds },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/fetch_groups/:user_id", async (req, res) => {
  const { user_id } = req.params;
  if (!user_id) return res.status(400).json({ error: "Missing user" });

  try {
    const { data, error } = await supabase
      .from("groups")
      .select("id, title, created_at, group_members(position, bots(id, name, avatar_config))")
      .eq("owner", user_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

const groups = data.map((g) => ({
  id: g.id,
  title: g.title,
  created_at: g.created_at,
  members: (g.group_members || [])
    .sort((a, b) => a.position - b.position)
    .filter((m) => m.bots)
    .map((m) => ({
      id: m.bots.id,
      name: m.bots.name,
      avatar_config: m.bots.avatar_config,
    })),
}));

    return res.status(200).json({ data: groups });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentionedBots(content, members) {
  const text = content.toLowerCase();
  return members.filter((b) => {
    const name = String(b.name || "").trim().toLowerCase();
    if (!name) return false;
    const forms = [...new Set([name, name.replace(/\s+/g, ""), name.replace(/\s+/g, "_")])];
    return forms.some((f) => new RegExp(`(^|\\s)/${escapeRe(f)}(?=$|[\\s.,!?:;])`).test(text));
  });
}

router.post("/group/:id/message", async (req, res) => {
  const { id } = req.params;
  const { user_id, content } = req.body;

  if (!user_id) return res.status(400).json({ error: "Missing user id" });
  if (!content || !content.trim()) return res.status(400).json({ error: "Message required" });

  try {
    const { data: group, error } = await supabase
      .from("groups")
      .select("id, group_members(position, bots(id, name, system_prompt, provider, bot_type))")
      .eq("id", id)
      .eq("owner", user_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const members = (group.group_members || [])
      .sort((a, b) => a.position - b.position)
      .map((m) => m.bots)
      .filter(Boolean);

    if (!members.length) return res.status(400).json({ error: "Group has no bots" });

    const { data: secrets } = await supabase
      .from("bot_secrets")
      .select("bot_id, api_key_enc")
      .in("bot_id", members.map((b) => b.id));

    const keyById = Object.fromEntries((secrets || []).map((s) => [s.bot_id, s.api_key_enc]));
    const names = Object.fromEntries(members.map((b) => [b.id, b.name]));
    const teamList = members.map((b) => b.name).join(", ");

    const { data: recent } = await supabase
      .from("group_messages")
      .select("id, sender_type, sender_id, content, created_at")
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(GROUP_CONTEXT);

    const thread = (recent || []).reverse();

    const { data: userMsg, error: userErr } = await supabase
      .from("group_messages")
      .insert({ group_id: id, sender_type: "user", sender_id: user_id, content: content.trim() })
      .select()
      .single();

    if (userErr) return res.status(500).json({ error: userErr.message });
    thread.push(userMsg);

    const addressed = mentionedBots(content.trim(), members);
    const responders = addressed.length ? addressed : members;

    const replies = [];
    for (const bot of responders) {
      try {
        if (!keyById[bot.id]) continue;

        const out = await generateReply({
          provider: bot.provider,
          apiKey: decrypt(keyById[bot.id]),
          systemPrompt:
            `${bot.system_prompt || ""}\n\nYou are "${bot.name}" in a group chat with: ${teamList}. ` +
            `Messages from others are prefixed like [Name]:. Reply only as yourself and never start with your own name. ` +
            `A message that contains /Name is addressed only to the bot with that name. ` +
            (addressed.length
              ? `The latest message is addressed to you, so answer it directly.`
              : `The latest message is not addressed to a specific bot, so answer it normally.`),
          history: buildHistory(bot.id, thread, names),
          userId: user_id,
          botId: bot.id,
          botType: bot.bot_type,
        });

        if (out && Array.isArray(out.tool_calls) && out.tool_calls.length > 0) continue;

        const text = typeof out === "string" ? out : String(out?.reply || "");
        if (!text.trim()) continue;
        const results = Array.isArray(out?.results) ? out.results : [];

        const { data: saved } = await supabase
          .from("group_messages")
          .insert({
            group_id: id,
            sender_type: "bot",
            sender_id: bot.id,
            content: text,
            results: results.length ? results : null,
          })
          .select()
          .single();

        if (saved) {
          thread.push(saved);
          replies.push(saved);
        }
      } catch (e) {
        console.log(`bot ${bot.name} failed:`, e.message);
      }
    }

    return res.status(200).json({ data: [userMsg, ...replies] });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/group/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  try {
    const { data: group, error } = await supabase
      .from("groups")
      .select("id, title, group_members(position, bots(id, name, bot_type, avatar_config))")
      .eq("id", id)
      .eq("owner", user_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const { data: messages, error: msgError } = await supabase
      .from("group_messages")
      .select("id, sender_type, sender_id, content, results, created_at")
      .eq("group_id", id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (msgError) return res.status(500).json({ error: msgError.message });

    const members = (group.group_members || [])
      .sort((a, b) => a.position - b.position)
      .filter((m) => m.bots)
      .map((m) => m.bots);

    return res.status(200).json({
      data: { id: group.id, title: group.title, members, messages },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/bot/:id", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "Missing user id" });

  try {
    const { data, error } = await supabase
      .from("bots")
      .delete()
      .eq("id", req.params.id)
      .eq("owner_id", user_id)
      .select("id");

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: "Bot not found" });

    return res.status(200).json({ message: "Deleted" });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;