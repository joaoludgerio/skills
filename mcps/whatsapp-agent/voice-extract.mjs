// voice-extract.mjs — Bulk extract do corpus do Voice Brain.
// Lê todas as mensagens substantivas do Eric (1 ano) por estrato, detecta templates,
// filtra ruído e separa holdout pra validação cega.
//
// Uso:
//   node --env-file=.env voice-extract.mjs
//
// Output em C:\tmp\voice-corpus\:
//   - {estrato}.jsonl                (corpus principal por estrato)
//   - _holdout.jsonl                 (30 mensagens reservadas pra validação cega)
//   - _all.jsonl                     (corpus consolidado, todos estratos)
//   - _meta.json                     (estatísticas, filtros, templates detectados)

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatorios (use --env-file=.env)");
  process.exit(2);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const STRATA = {
  "vendas-lead":     ["lead"],
  "cliente":         ["cliente"],
  "equipe":          ["equipe"],
  "network":         ["comunidade", "parceiro"],
  "intimo":          ["familia", "pessoal"],
};

const OUT_DIR = "C:\\tmp\\voice-corpus";
const ONE_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
const PAGE_SIZE = 1000;
const MIN_LEN = 40;
const TEMPLATE_THRESHOLD = 3; // Mesmo content em N+ chats = template
const HOLDOUT_PER_STRATUM = 6;
const HOLDOUT_SEED = 42;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

// PRNG determinístico (mulberry32) pra reprodutibilidade do holdout
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

async function getStratumChatMap() {
  const { data: cats, error: e1 } = await supabase.from("categories").select("id, slug");
  if (e1) throw e1;
  const slugById = new Map(cats.map(c => [c.id, c.slug]));

  const { data: links, error: e2 } = await supabase.from("chat_categories").select("chat_id, category_id");
  if (e2) throw e2;

  const chatSlugs = new Map();
  for (const l of links) {
    const slug = slugById.get(l.category_id);
    if (!slug) continue;
    if (!chatSlugs.has(l.chat_id)) chatSlugs.set(l.chat_id, new Set());
    chatSlugs.get(l.chat_id).add(slug);
  }

  // chat_id → estrato (pode ter mais de um, escolhe o primeiro match na ordem de STRATA)
  const chatToStratum = new Map();
  for (const [chatId, slugSet] of chatSlugs) {
    for (const [stratum, slugs] of Object.entries(STRATA)) {
      if (slugs.some(s => slugSet.has(s))) {
        if (!chatToStratum.has(chatId)) chatToStratum.set(chatId, stratum);
        break;
      }
    }
  }

  // Set de chats em cada estrato (ordem do mapa STRATA)
  const stratumChats = {};
  for (const stratum of Object.keys(STRATA)) stratumChats[stratum] = [];
  for (const [chatId, stratum] of chatToStratum) stratumChats[stratum].push(chatId);

  return { stratumChats, chatToStratum };
}

async function getChatNames(chatIds) {
  // Pegar chat_name + is_group de uma vez via in() em chunks
  const out = new Map();
  const CHUNK = 100;
  for (let i = 0; i < chatIds.length; i += CHUNK) {
    const chunk = chatIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("chats")
      .select("chat_id, chat_name, is_group, phone")
      .in("chat_id", chunk);
    if (error) throw error;
    for (const c of data) out.set(c.chat_id, { name: c.chat_name, is_group: c.is_group, phone: c.phone });
  }
  return out;
}

async function fetchMessagesForChats(chatIds) {
  const all = [];
  let processed = 0;
  for (const chatId of chatIds) {
    processed++;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("messages")
        .select("id, chat_id, content, message_type, message_ts")
        .eq("chat_id", chatId)
        .eq("from_me", true)
        .eq("is_deleted", false)
        .not("content", "is", null)
        .neq("content", "")
        .gte("message_ts", ONE_YEAR_AGO)
        .order("message_ts", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        process.stderr.write(`\n  WARN chat ${chatId}: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    if (processed % 20 === 0) process.stdout.write(`.`);
  }
  return all;
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  ensureOutDir();
  console.log(`Voice Brain — Bulk Extract`);
  console.log(`Janela: ${ONE_YEAR_AGO} → agora`);
  console.log(`MinLen: ${MIN_LEN} chars  |  TemplateThreshold: ${TEMPLATE_THRESHOLD}+ chats com mesma string`);
  console.log(`Holdout: ${HOLDOUT_PER_STRATUM} msgs/estrato (seed=${HOLDOUT_SEED})`);
  console.log(`Output: ${OUT_DIR}\n`);

  const { stratumChats, chatToStratum } = await getStratumChatMap();
  const allChatIds = [...chatToStratum.keys()];
  console.log(`Chats categorizados nos estratos: ${allChatIds.length}\n`);

  console.log(`Resolvendo chat_names...`);
  const chatMeta = await getChatNames(allChatIds);

  // 1) Coleta corpus por estrato
  const allMsgs = []; // {estrato, chat_id, chat_name, is_group, content, message_ts, message_type, length}
  for (const [stratum, chatIds] of Object.entries(stratumChats)) {
    process.stdout.write(`Coletando ${stratum} (${chatIds.length} chats) `);
    const msgs = await fetchMessagesForChats(chatIds);
    for (const m of msgs) {
      const len = (m.content || "").length;
      if (len < MIN_LEN) continue;
      const meta = chatMeta.get(m.chat_id) || { name: null, is_group: false, phone: null };
      allMsgs.push({
        estrato: stratum,
        chat_id: m.chat_id,
        chat_name: meta.name,
        is_group: meta.is_group,
        content: m.content,
        message_ts: m.message_ts,
        message_type: m.message_type,
        length: len,
        is_audio: m.message_type === "ptt" || m.message_type === "audio",
      });
    }
    console.log(` ✓ (${msgs.filter(m => (m.content||"").length >= MIN_LEN).length} ≥${MIN_LEN}chars)`);
  }
  console.log(`\nTotal pré-filtro de templates: ${allMsgs.length} mensagens substantivas\n`);

  // 2) Detecta templates (content idêntico em N+ chats distintos)
  const contentToChats = new Map();
  for (const m of allMsgs) {
    if (!contentToChats.has(m.content)) contentToChats.set(m.content, new Set());
    contentToChats.get(m.content).add(m.chat_id);
  }
  const templates = [];
  for (const [content, chatSet] of contentToChats) {
    if (chatSet.size >= TEMPLATE_THRESHOLD) {
      templates.push({ content, chat_count: chatSet.size, length: content.length });
    }
  }
  templates.sort((a, b) => b.chat_count - a.chat_count);
  const templateSet = new Set(templates.map(t => t.content));
  console.log(`Templates detectados (mesma string em ${TEMPLATE_THRESHOLD}+ chats): ${templates.length}`);
  if (templates.length > 0) {
    console.log(`  Top 5:`);
    for (const t of templates.slice(0, 5)) {
      const preview = t.content.slice(0, 80).replace(/\n/g, " ⏎ ");
      console.log(`    [${t.chat_count}x] ${preview}${t.content.length > 80 ? "..." : ""}`);
    }
  }

  // 3) Filtra templates do corpus
  const cleanMsgs = allMsgs.filter(m => !templateSet.has(m.content));
  const templatedRemoved = allMsgs.length - cleanMsgs.length;
  console.log(`Mensagens removidas como template: ${templatedRemoved}`);
  console.log(`Corpus limpo: ${cleanMsgs.length} mensagens\n`);

  // 4) Separa holdout (6 por estrato, seed determinístico, prioriza msgs longas)
  const rng = mulberry32(HOLDOUT_SEED);
  const holdout = [];
  const holdoutIds = new Set();
  for (const stratum of Object.keys(STRATA)) {
    const candidates = cleanMsgs
      .filter(m => m.estrato === stratum)
      .sort((a, b) => b.length - a.length)
      .slice(0, 200); // top 200 maiores como pool
    // Embaralha pseudoaleatoriamente
    const shuffled = [...candidates].map(m => ({ m, r: rng() })).sort((a, b) => a.r - b.r).map(x => x.m);
    for (const m of shuffled.slice(0, HOLDOUT_PER_STRATUM)) {
      holdout.push(m);
      holdoutIds.add(`${m.chat_id}|${m.message_ts}`);
    }
  }
  const finalCorpus = cleanMsgs.filter(m => !holdoutIds.has(`${m.chat_id}|${m.message_ts}`));
  console.log(`Holdout: ${holdout.length} mensagens (${HOLDOUT_PER_STRATUM} por estrato)`);
  console.log(`Corpus final (sem holdout): ${finalCorpus.length} mensagens\n`);

  // 5) Grava output
  // Por estrato
  const stats = {};
  for (const stratum of Object.keys(STRATA)) {
    const subset = finalCorpus.filter(m => m.estrato === stratum);
    const file = path.join(OUT_DIR, `${stratum}.jsonl`);
    fs.writeFileSync(file, subset.map(m => JSON.stringify(m)).join("\n") + "\n");
    const totalChars = subset.reduce((s, m) => s + m.length, 0);
    stats[stratum] = {
      msgs: subset.length,
      total_chars: totalChars,
      avg_chars: subset.length ? Math.round(totalChars / subset.length) : 0,
      audios: subset.filter(m => m.is_audio).length,
      file,
    };
    console.log(`  ${stratum.padEnd(13)} → ${subset.length} msgs / ${totalChars} chars / ${stats[stratum].audios} áudios → ${file}`);
  }

  // Holdout
  const holdoutFile = path.join(OUT_DIR, "_holdout.jsonl");
  fs.writeFileSync(holdoutFile, holdout.map(m => JSON.stringify(m)).join("\n") + "\n");
  console.log(`  holdout       → ${holdout.length} msgs → ${holdoutFile}`);

  // Consolidado
  const allFile = path.join(OUT_DIR, "_all.jsonl");
  fs.writeFileSync(allFile, finalCorpus.map(m => JSON.stringify(m)).join("\n") + "\n");
  const totalCharsAll = finalCorpus.reduce((s, m) => s + m.length, 0);
  console.log(`  _all          → ${finalCorpus.length} msgs / ${totalCharsAll} chars → ${allFile}`);

  // Meta
  const meta = {
    generated_at: new Date().toISOString(),
    window_start: ONE_YEAR_AGO,
    min_len: MIN_LEN,
    template_threshold: TEMPLATE_THRESHOLD,
    holdout_per_stratum: HOLDOUT_PER_STRATUM,
    holdout_seed: HOLDOUT_SEED,
    total_chats_categorized: allChatIds.length,
    pre_template_filter: allMsgs.length,
    templates_detected: templates.length,
    templated_removed: templatedRemoved,
    final_corpus_size: finalCorpus.length,
    final_corpus_chars: totalCharsAll,
    stratum_stats: stats,
    templates_top20: templates.slice(0, 20).map(t => ({
      preview: t.content.slice(0, 200),
      chat_count: t.chat_count,
      length: t.length,
    })),
  };
  const metaFile = path.join(OUT_DIR, "_meta.json");
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  console.log(`  _meta         → ${metaFile}\n`);

  console.log(`✓ Bulk extract concluído.`);
  console.log(`  Corpus final: ${finalCorpus.length} msgs / ${(totalCharsAll / 1024).toFixed(1)}KB`);
  console.log(`  Aprox tokens: ~${Math.round(totalCharsAll / 4)} tokens`);
})().catch(e => {
  console.error("ERRO:", e.message || e);
  console.error(e.stack);
  process.exit(1);
});
