// voice-stats.mjs — Pré-processamento estatístico do corpus.
// Lê o corpus completo (8MB) e gera stats globais que cabem em context dos agentes.
//
// Saída em C:\tmp\voice-corpus\_stats.json:
//   - global: counts, length distribution, audio share
//   - per_stratum: mesma análise + top tokens, openers, closers, ngrams
//   - cross_stratum_diffs: tokens que diferenciam um estrato dos outros (TF-IDF simples)
//
// Sem dependências externas — JS puro.

import fs from "node:fs";
import path from "node:path";

const IN_DIR = "C:\\tmp\\voice-corpus";
const OUT_FILE = path.join(IN_DIR, "_stats.json");

// Stopwords PT-BR mais comuns (cortar pra dar destaque às palavras de assinatura)
const STOPWORDS = new Set([
  "a","o","e","de","do","da","das","dos","em","na","no","nos","nas","um","uma","uns","umas",
  "pra","para","por","com","sem","sobre","entre","ate","ate","mais","menos","muito","muita","bem",
  "que","quem","qual","quais","onde","quando","como","porque","por","se","sim","nao","na","no",
  "eu","tu","ele","ela","nos","voces","voce","vc","vcs","vou","vai","vamos","vão","va","já","ja",
  "to","ta","tava","tô","tô","ter","tem","tinha","tive","tive","teve","tendo","ser","sou","é","e",
  "foi","fui","era","fica","ficou","ficar","faz","faço","fiz","fazer","fazendo","feito",
  "isso","isto","aquilo","esse","essa","esses","essas","este","esta","estes","estas","aquele","aquela",
  "meu","minha","meus","minhas","seu","sua","seus","suas","nosso","nossa","nossos","nossas",
  "tudo","todo","toda","todos","todas","nada","alguma","algum","algumas","alguns","outro","outra","outros","outras",
  "lá","la","aqui","ali","aí","ai","então","entao","só","so","mas","ou","como","ne","né","tá","ta","ok",
  "vc","ne","aí","já","ja","kkk","kkkk","kkkkk","rs","rsrs","hahaha","haha","hehe","blz","beleza","valeu",
  "https","http","www","com","br","pt","co","https://",
  "the","of","to","in","is","it","you","i","and","for","on","at","an","be","this","that","with","my","your",
  "1","2","3","4","5","6","7","8","9","0","10","20","30",
]);

// ─── helpers ─────────────────────────────────────────────────────────────────

function tokenize(s) {
  // pt-br tokenizer simples: lower, mantém acentos, separa por espaço/pontuação
  return s
    .toLowerCase()
    .replace(/[\r\n]+/g, " ")
    .split(/[\s.,!?;:()\[\]{}\/\\"'`<>|*~_=+\-—–]+/u)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function tokenizeKeepStop(s) {
  // Pra ngrams, mantém stopwords (capturar "vamos lá", "fica frio")
  return s.toLowerCase()
    .replace(/[\r\n]+/g, " ")
    .split(/[\s.,!?;:()\[\]{}\/\\"'`<>|*~_=+\-—–]+/u)
    .filter(t => t.length >= 1);
}

function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function ngrams(tokens, n) {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

function countLen(arr) {
  if (!arr.length) return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, max: 0, min: 0, avg: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return {
    min: sorted[0],
    p10: pct(0.10),
    p25: pct(0.25),
    p50: pct(0.50),
    p75: pct(0.75),
    p90: pct(0.90),
    max: sorted[sorted.length - 1],
    avg: Math.round(arr.reduce((s, x) => s + x, 0) / arr.length),
  };
}

function readJsonl(file) {
  const raw = fs.readFileSync(file, "utf8");
  return raw.split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
}

// ─── main ────────────────────────────────────────────────────────────────────

console.log("Carregando _all.jsonl...");
const all = readJsonl(path.join(IN_DIR, "_all.jsonl"));
console.log(`  ${all.length} mensagens / ${(all.reduce((s, m) => s + m.length, 0) / 1024).toFixed(0)}KB\n`);

const STRATA = ["vendas-lead", "cliente", "equipe", "network", "intimo"];

function analyzeBucket(msgs) {
  const lengths = msgs.map(m => m.length);
  const audios = msgs.filter(m => m.is_audio);
  const groups = msgs.filter(m => m.is_group);

  // Tokens (sem stopwords)
  const tokenCount = new Map();
  for (const m of msgs) {
    const toks = tokenize(m.content);
    for (const t of toks) tokenCount.set(t, (tokenCount.get(t) || 0) + 1);
  }

  // Bigrams / trigrams (com stopwords pra capturar expressões)
  const bigrams = new Map();
  const trigrams = new Map();
  for (const m of msgs) {
    const toks = tokenizeKeepStop(m.content);
    for (const bg of ngrams(toks, 2)) {
      // pula bigrams onde os 2 são stopwords
      const [a, b] = bg.split(" ");
      if (STOPWORDS.has(a) && STOPWORDS.has(b)) continue;
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    for (const tg of ngrams(toks, 3)) {
      trigrams.set(tg, (trigrams.get(tg) || 0) + 1);
    }
  }

  // Aberturas (primeiros 25 chars normalizados)
  const openers = new Map();
  for (const m of msgs) {
    const open = m.content.replace(/[\r\n]+/g, " ").slice(0, 25).toLowerCase().trim();
    if (open.length < 5) continue;
    openers.set(open, (openers.get(open) || 0) + 1);
  }

  // Fechamentos (últimos 25 chars)
  const closers = new Map();
  for (const m of msgs) {
    const close = m.content.replace(/[\r\n]+/g, " ").slice(-25).toLowerCase().trim();
    if (close.length < 5) continue;
    closers.set(close, (closers.get(close) || 0) + 1);
  }

  // Punct + estilo
  const punctStats = {
    exclamations: msgs.filter(m => m.content.includes("!")).length,
    questions: msgs.filter(m => m.content.includes("?")).length,
    ellipsis: msgs.filter(m => m.content.includes("...") || m.content.includes("…")).length,
    em_dash: msgs.filter(m => m.content.includes("—") || m.content.includes("--")).length,
    parens: msgs.filter(m => m.content.includes("(") && m.content.includes(")")).length,
    line_break: msgs.filter(m => m.content.includes("\n")).length,
    multi_para: msgs.filter(m => (m.content.match(/\n\n/g) || []).length >= 1).length,
    bullets: msgs.filter(m => /(^|\n)[-•*]\s/.test(m.content)).length,
    numbered_list: msgs.filter(m => /(^|\n)\d+[.)]\s/.test(m.content)).length,
    has_uppercase_word: msgs.filter(m => /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}\b/.test(m.content)).length,
  };

  // Audio sample (transcrições — geralmente são as mais longas)
  const longestAudios = audios
    .sort((a, b) => b.length - a.length)
    .slice(0, 5)
    .map(m => ({ chat_name: m.chat_name, length: m.length, preview: m.content.slice(0, 250) }));

  // Top msgs (longest) — útil pra ver voz autoral em texto longo
  const longestTexts = msgs
    .filter(m => !m.is_audio)
    .sort((a, b) => b.length - a.length)
    .slice(0, 5)
    .map(m => ({ chat_name: m.chat_name, length: m.length, preview: m.content.slice(0, 250) }));

  return {
    count: msgs.length,
    audios: audios.length,
    groups: groups.length,
    length_stats: countLen(lengths),
    total_chars: lengths.reduce((s, x) => s + x, 0),
    top_tokens: topN(tokenCount, 100).map(([t, c]) => ({ token: t, count: c })),
    top_bigrams: topN(bigrams, 60).map(([t, c]) => ({ bigram: t, count: c })),
    top_trigrams: topN(trigrams, 40).map(([t, c]) => ({ trigram: t, count: c })),
    top_openers: topN(openers, 30).map(([t, c]) => ({ opener: t, count: c })),
    top_closers: topN(closers, 30).map(([t, c]) => ({ closer: t, count: c })),
    punct: punctStats,
    longest_audios: longestAudios,
    longest_texts: longestTexts,
  };
}

console.log("Analisando GLOBAL...");
const global = analyzeBucket(all);

console.log("Analisando POR ESTRATO...");
const byStratum = {};
for (const s of STRATA) {
  const subset = all.filter(m => m.estrato === s);
  console.log(`  ${s}: ${subset.length} msgs`);
  byStratum[s] = analyzeBucket(subset);
}

// TF-IDF simples: tokens que aparecem MUITO em um estrato e POUCO nos outros = marcadores
console.log("\nCalculando marcadores cross-estrato (TF-IDF)...");
const allTokens = new Set();
for (const s of STRATA) for (const t of byStratum[s].top_tokens) allTokens.add(t.token);

function freqInStratum(token, stratum) {
  const found = byStratum[stratum].top_tokens.find(x => x.token === token);
  return found ? found.count / byStratum[stratum].count : 0;
}

const markers = {};
for (const s of STRATA) {
  const scores = [];
  for (const tok of allTokens) {
    const own = freqInStratum(tok, s);
    if (own < 0.005) continue; // freq mínima no próprio estrato
    let othersAvg = 0;
    for (const o of STRATA) if (o !== s) othersAvg += freqInStratum(tok, o);
    othersAvg = othersAvg / (STRATA.length - 1);
    const ratio = othersAvg > 0 ? own / othersAvg : own * 100;
    scores.push({ token: tok, own_freq: +own.toFixed(4), others_freq: +othersAvg.toFixed(4), distinctiveness: +ratio.toFixed(2) });
  }
  scores.sort((a, b) => b.distinctiveness - a.distinctiveness);
  markers[s] = scores.slice(0, 30);
}

const out = {
  generated_at: new Date().toISOString(),
  source: "C:\\tmp\\voice-corpus\\_all.jsonl",
  total_msgs: all.length,
  strata: STRATA,
  global,
  by_stratum: byStratum,
  cross_stratum_markers: markers,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
const sizeKB = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
console.log(`\n✓ ${OUT_FILE} (${sizeKB}KB)`);
