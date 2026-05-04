// voice-sample.mjs — Gera amostra estratificada qualitativa pra agentes especialistas.
// Por estrato: 30 longas + 30 médias + 30 curtas + 20 áudios + 20 random = ~130 msgs.
// Total ~650 msgs / ~150KB cabe em 1 prompt.

import fs from "node:fs";
import path from "node:path";

const IN_DIR = "C:\\tmp\\voice-corpus";
const OUT_FILE = path.join(IN_DIR, "_sample.jsonl");
const SEED = 42;

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

const all = fs.readFileSync(path.join(IN_DIR, "_all.jsonl"), "utf8")
  .split("\n").filter(l => l.trim()).map(l => JSON.parse(l));

const rng = mulberry32(SEED);
const sample = [];
const summary = {};

for (const stratum of STRATA) {
  const subset = all.filter(m => m.estrato === stratum);
  // Buckets
  const longas = subset.filter(m => m.length >= 250).sort((a, b) => b.length - a.length).slice(0, 30);
  const medias = subset.filter(m => m.length >= 100 && m.length < 250)
    .map(m => ({ m, r: rng() })).sort((a, b) => a.r - b.r).slice(0, 30).map(x => x.m);
  const curtas = subset.filter(m => m.length >= 40 && m.length < 100)
    .map(m => ({ m, r: rng() })).sort((a, b) => a.r - b.r).slice(0, 30).map(x => x.m);
  const audios = subset.filter(m => m.is_audio).sort((a, b) => b.length - a.length).slice(0, 20);
  const random = subset
    .map(m => ({ m, r: rng() })).sort((a, b) => a.r - b.r).slice(0, 20).map(x => x.m);

  // Dedupe por chat_id+ts
  const dedupe = new Map();
  for (const m of [...longas, ...medias, ...curtas, ...audios, ...random]) {
    dedupe.set(`${m.chat_id}|${m.message_ts}`, m);
  }
  const stratumSample = [...dedupe.values()];
  sample.push(...stratumSample);
  summary[stratum] = {
    longas: longas.length,
    medias: medias.length,
    curtas: curtas.length,
    audios: audios.length,
    random: random.length,
    deduped_total: stratumSample.length,
  };
}

fs.writeFileSync(OUT_FILE, sample.map(m => JSON.stringify(m)).join("\n") + "\n");
const totalChars = sample.reduce((s, m) => s + m.length, 0);

console.log("Sample estratificado por estrato:");
console.log(JSON.stringify(summary, null, 2));
console.log(`\n✓ ${OUT_FILE}`);
console.log(`  Total: ${sample.length} msgs / ${(totalChars/1024).toFixed(1)}KB / ~${Math.round(totalChars/4)} tokens`);
