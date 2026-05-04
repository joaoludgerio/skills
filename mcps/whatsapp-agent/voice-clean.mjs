// voice-clean.mjs — Remove contaminação de bot do corpus.
// Lê _all.jsonl, aplica filtros adicionais e regrava arquivos JSONL.
//
// Filtros aplicados:
//   1. Exclui chat_id "120363419051052246-group" (chat "Resumos de grupo" — feed do bot)
//   2. Marca como bot mensagens com assinatura do bot Super Grupos / Eric Luciano IA
//   3. Marca como forward mensagens com prefixo "[hh:mm, d/m/yyyy] +55..."
//   4. Re-separa holdout (seed 42) só com msgs limpas

import fs from "node:fs";
import path from "node:path";

const IN_DIR = "C:\\tmp\\voice-corpus";
const ALL_FILE = path.join(IN_DIR, "_all.jsonl");
const HOLDOUT_PER_STRATUM = 6;
const HOLDOUT_SEED = 42;

const BOT_CHAT_IDS = new Set([
  "120363419051052246-group", // Resumos de grupo — chat dedicado ao bot
]);

function isBotMessage(content) {
  if (!content) return false;
  // Assinatura explícita do bot Super Grupos
  if (/Eric Luciano IA/i.test(content)) return true;
  if (/Resumo T[áa]tico/i.test(content)) return true;
  if (/Gerado por (Eric|IA|automa|automaç)/i.test(content)) return true;
  if (/📡.*Resumo/i.test(content)) return true;
  if (/📂\s*\*?\s*Zoom\s*Out\*?/i.test(content)) return true;
  if (/🔎\s*\*?\s*Zoom\s*In\*?/i.test(content)) return true;
  if (/ℹ️\s*\*?\s*Desfecho/i.test(content)) return true;
  if (/Tudo que rolou ontem[\s\S]*Em uma mensagem/i.test(content)) return true;
  if (/^\*?Bom dia\*?!\s*\*?Servi[çc]o de resumo/i.test(content)) return true;
  return false;
}

function isForwardOfThirdParties(content) {
  // mensagens compostas que são copy-paste de chat de terceiros
  // Padrão: "[hh:mm, d/m/aaaa] Nome:" repetido 3+ vezes
  const matches = content.match(/\[\d{1,2}:\d{2}, \d{1,2}\/\d{1,2}\/\d{2,4}\][^:]+:/g);
  return matches && matches.length >= 3;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const STRATA = ["vendas-lead", "cliente", "equipe", "network", "intimo"];

console.log("Carregando _all.jsonl...");
const all = fs.readFileSync(ALL_FILE, "utf8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
console.log(`  ${all.length} mensagens iniciais\n`);

let stats = {
  excluded_chat: 0,
  excluded_bot: 0,
  excluded_forward: 0,
  kept: 0,
};

const clean = [];
for (const m of all) {
  if (BOT_CHAT_IDS.has(m.chat_id)) { stats.excluded_chat++; continue; }
  if (isBotMessage(m.content)) { stats.excluded_bot++; continue; }
  if (isForwardOfThirdParties(m.content)) { stats.excluded_forward++; continue; }
  stats.kept++;
  clean.push(m);
}

console.log("Filtros aplicados:");
console.log(`  Mensagens em chats descartados (Resumos de grupo): ${stats.excluded_chat}`);
console.log(`  Mensagens com assinatura de bot: ${stats.excluded_bot}`);
console.log(`  Mensagens que são forward de chat de terceiros (3+ headers): ${stats.excluded_forward}`);
console.log(`  Mantidas: ${stats.kept}\n`);

// Re-separa holdout
const rng = mulberry32(HOLDOUT_SEED);
const holdout = [];
const holdoutKeys = new Set();
for (const stratum of STRATA) {
  const candidates = clean
    .filter(m => m.estrato === stratum)
    .sort((a, b) => b.length - a.length)
    .slice(0, 200);
  const shuffled = [...candidates].map(m => ({ m, r: rng() })).sort((a, b) => a.r - b.r).map(x => x.m);
  for (const m of shuffled.slice(0, HOLDOUT_PER_STRATUM)) {
    holdout.push(m);
    holdoutKeys.add(`${m.chat_id}|${m.message_ts}`);
  }
}
const finalCorpus = clean.filter(m => !holdoutKeys.has(`${m.chat_id}|${m.message_ts}`));

// Regrava arquivos
const stratumStats = {};
for (const stratum of STRATA) {
  const subset = finalCorpus.filter(m => m.estrato === stratum);
  const file = path.join(IN_DIR, `${stratum}.jsonl`);
  fs.writeFileSync(file, subset.map(m => JSON.stringify(m)).join("\n") + "\n");
  const totalChars = subset.reduce((s, m) => s + m.length, 0);
  stratumStats[stratum] = {
    msgs: subset.length,
    total_chars: totalChars,
    avg_chars: subset.length ? Math.round(totalChars / subset.length) : 0,
    audios: subset.filter(m => m.is_audio).length,
  };
  console.log(`  ${stratum.padEnd(13)} → ${subset.length} msgs / ${totalChars} chars / ${stratumStats[stratum].audios} áudios`);
}

fs.writeFileSync(path.join(IN_DIR, "_holdout.jsonl"), holdout.map(m => JSON.stringify(m)).join("\n") + "\n");
fs.writeFileSync(path.join(IN_DIR, "_all.jsonl"), finalCorpus.map(m => JSON.stringify(m)).join("\n") + "\n");

const totalCharsAll = finalCorpus.reduce((s, m) => s + m.length, 0);

// Atualiza meta
const metaFile = path.join(IN_DIR, "_meta.json");
const oldMeta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
const newMeta = {
  ...oldMeta,
  cleaned_at: new Date().toISOString(),
  cleaning_stats: stats,
  bot_chat_ids_excluded: [...BOT_CHAT_IDS],
  bot_filters: [
    "Eric Luciano IA",
    "Resumo Tático",
    "Gerado por (Eric|IA|automa)",
    "📂 Zoom Out / 🔎 Zoom In / ℹ️ Desfecho",
    "Tudo que rolou ontem ... Em uma mensagem",
    "Bom dia! Serviço de resumo",
  ],
  forward_filter: "3+ headers '[hh:mm, d/m/aaaa] Nome:'",
  final_corpus_size: finalCorpus.length,
  final_corpus_chars: totalCharsAll,
  stratum_stats_after_clean: stratumStats,
};
fs.writeFileSync(metaFile, JSON.stringify(newMeta, null, 2));

console.log(`\n✓ Corpus limpo: ${finalCorpus.length} msgs / ${(totalCharsAll / 1024).toFixed(1)}KB / ~${Math.round(totalCharsAll / 4)} tokens`);
console.log(`  Holdout: ${holdout.length} msgs`);
console.log(`  Removidos: ${all.length - finalCorpus.length - holdout.length} (${stats.excluded_chat + stats.excluded_bot + stats.excluded_forward} bot/forward + ${holdout.length} holdout)`);
