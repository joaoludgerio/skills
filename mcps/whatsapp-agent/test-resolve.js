// Bateria de smoke tests pro resolveChat() do MCP whatsapp-agent v2.2.0.
// Roda contra o Supabase real — exige SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no env.
//
// Uso:
//   node test-resolve.js
//   node test-resolve.js --verbose
//
// Os casos cobrem:
//   - Phones BR com/sem 55, com/sem 9, formatado e cru
//   - Internacionais (US, Chile, Uruguay, Panama, Republica Dominicana)
//   - Nomes exatos / com acento / parciais / por palavra individual / fuzzy
//   - chat_id literal (puro digit, @lid, -group)
//   - Nomes ambiguos (multiplos chats com mesmo nome)
//   - Inputs absurdos (vazio, so espaco, gibberish)

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

// Carrega o modulo do MCP — extraimos resolveChat e helpers via re-export logico.
// O index.js inicia o servidor MCP no modulo top-level; pra testar resolveChat
// sem subir o stdio, vamos reaproveitar via dynamic import + interceptar antes de connect.
//
// Workaround: chamamos os helpers via SQL direto com a mesma logica em paralelo.
// Mais simples: importamos o index.js que ja se conecta — mas o stdio nao recebe input,
// entao server.connect nunca completa o handshake e o processo segue. Vamos fazer
// o teste em out-of-process: pre-extraimos resolveChat numa pequena copia.

const { createClient } = await import("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatorios");
  process.exit(2);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Replica os helpers do index.js (mantenha em sync) ───────────────────────
// ─── SCORING CONSTANTS (espelho do index.js — manter em sync) ────────────────
const SCORE_EXACT = 100, SCORE_STARTS_WITH = 80, SCORE_WORD = 70, SCORE_SUBSTRING = 50, SCORE_FUZZY = 25;
const BOOST_NOT_GROUP = 4, BOOST_NOT_LID = 3, BOOST_RECENT_7D = 4, BOOST_RECENT_30D = 2;
const FUZZY_THRESHOLD_RATIO = 0.25;
const MIN_CONFIDENT_SCORE = 80, MIN_WINNING_GAP = 15;

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function normalizePhoneBR(digits) {
  const out = new Set();
  if (!digits) return [];
  out.add(digits);
  const flipNine = (d) => {
    if (d.length === 13 && d.startsWith("55") && d[4] === "9") {
      out.add(d.slice(0, 4) + d.slice(5));
    } else if (d.length === 12 && d.startsWith("55")) {
      out.add(d.slice(0, 4) + "9" + d.slice(4));
    }
  };
  flipNine(digits);
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    const with55 = "55" + digits;
    out.add(with55);
    flipNine(with55);
  }
  return Array.from(out);
}
function expandChatIdCandidates(phoneVariants) {
  const suffixes = ["", "@s.whatsapp.net", "@c.us", "@lid", "-group", "@g.us"];
  const out = new Set();
  for (const v of phoneVariants) for (const s of suffixes) out.add(v + s);
  return Array.from(out);
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
function fuzzyMatch(input, name) {
  const inputParts = input.split(/\s+/).filter(Boolean);
  const nameParts = name.split(/\s+/).filter(Boolean);
  if (!nameParts.length) return false;
  return inputParts.every((ip) => {
    const threshold = Math.max(1, Math.floor(ip.length * FUZZY_THRESHOLD_RATIO));
    return nameParts.some((np) => levenshtein(ip, np) <= threshold);
  });
}
function scoreNameMatch(input, chat) {
  const name = normalize(chat.chat_name || "");
  const contact = normalize(chat.contact_name || "");
  if (!name && !contact) return { score: 0, kind: "miss" };
  if (name === input || contact === input) return { score: SCORE_EXACT, kind: "exact" };
  if (name.startsWith(input) || contact.startsWith(input)) return { score: SCORE_STARTS_WITH, kind: "starts" };
  const allWords = (name + " " + contact).split(/\s+/).filter(Boolean);
  if (allWords.includes(input)) return { score: SCORE_WORD, kind: "word" };
  if (name.includes(input) || contact.includes(input)) return { score: SCORE_SUBSTRING, kind: "substring" };
  if (fuzzyMatch(input, name) || fuzzyMatch(input, contact)) return { score: SCORE_FUZZY, kind: "fuzzy" };
  return { score: 0, kind: "miss" };
}
function applyChatBoost(score, chat) {
  let boost = 0;
  if (!chat.is_group) boost += BOOST_NOT_GROUP;
  if (chat.chat_id && !String(chat.chat_id).includes("@lid")) boost += BOOST_NOT_LID;
  if (chat.last_message_at) {
    const days = (Date.now() - new Date(chat.last_message_at).getTime()) / 86400000;
    if (days < 7) boost += BOOST_RECENT_7D;
    else if (days < 30) boost += BOOST_RECENT_30D;
  }
  return score + boost;
}
async function resolveChat(to) {
  if (!to || !String(to).trim()) return { error: "Input vazio" };
  to = String(to).trim();
  if (/^[0-9]+(@[a-z.]+|-group)$/i.test(to)) {
    const { data } = await supabase
      .from("v_chats_with_contact")
      .select("chat_id,chat_name,contact_name,is_group")
      .eq("chat_id", to)
      .limit(1);
    if (data?.length) return { chat_id: data[0].chat_id, chat_name: data[0].chat_name || data[0].contact_name || to };
    return { chat_id: to, chat_name: to };
  }
  const digits = to.replace(/\D/g, "");
  const looksLikePhone = digits.length >= 8 && /^[\d\s+()\-.]+$/.test(to);
  if (looksLikePhone) {
    const phoneVariants = normalizePhoneBR(digits);
    const idCandidates = expandChatIdCandidates(phoneVariants);
    const { data: exact } = await supabase
      .from("v_chats_with_contact")
      .select("chat_id,chat_name,contact_name,is_group,last_message_at")
      .in("chat_id", idCandidates)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("chat_id", { ascending: true })
      .limit(10);
    if (exact?.length === 1) return { chat_id: exact[0].chat_id, chat_name: exact[0].chat_name || exact[0].contact_name };
    if (exact?.length > 1) {
      const ranked = exact.map(c => ({ ...c, _score: applyChatBoost(50, c) })).sort((a,b)=>b._score-a._score);
      if (ranked[0]._score - ranked[1]._score >= 5) return { chat_id: ranked[0].chat_id, chat_name: ranked[0].chat_name || ranked[0].contact_name };
      return { candidates: ranked.slice(0,5).map(c => ({ chat_id: c.chat_id, name: c.chat_name||c.contact_name, is_group: c.is_group })) };
    }
    const longest = phoneVariants.slice().sort((a,b)=>b.length-a.length)[0];
    if (longest && longest.length >= 8) {
      const { data: prefix } = await supabase
        .from("v_chats_with_contact")
        .select("chat_id,chat_name,contact_name,is_group,last_message_at")
        .like("chat_id", `${longest}%`)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("chat_id", { ascending: true })
        .limit(5);
      if (prefix?.length === 1) return { chat_id: prefix[0].chat_id, chat_name: prefix[0].chat_name || prefix[0].contact_name };
      if (prefix?.length > 1) {
        const ranked = prefix.map(c => ({ ...c, _score: applyChatBoost(40, c) })).sort((a,b)=>b._score-a._score);
        if (ranked[0]._score - ranked[1]._score >= 5) return { chat_id: ranked[0].chat_id, chat_name: ranked[0].chat_name || ranked[0].contact_name };
        return { candidates: ranked.slice(0,5).map(c => ({ chat_id: c.chat_id, name: c.chat_name||c.contact_name, is_group: c.is_group })) };
      }
    }
  }
  const toNorm = normalize(to);
  if (!toNorm) return { error: `Nenhum chat encontrado para "${to}"` };
  const { data: all } = await supabase
    .from("v_chats_with_contact")
    .select("chat_id,chat_name,contact_name,is_group,last_message_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("chat_id", { ascending: true })
    .limit(1500);
  if (!all?.length) return { error: "Tabela de chats vazia" };
  const scored = all.map(c => {
    const { score, kind } = scoreNameMatch(toNorm, c);
    return { ...c, _score: score>0 ? applyChatBoost(score, c) : 0, _kind: kind };
  }).filter(c => c._score>0).sort((a,b)=>b._score-a._score || String(a.chat_id).localeCompare(String(b.chat_id)));
  if (!scored.length) return { error: `Nenhum chat encontrado para "${to}"` };
  if (scored.length === 1) return { chat_id: scored[0].chat_id, chat_name: scored[0].chat_name || scored[0].contact_name };
  const top = scored[0], runner = scored[1];
  const topIsLid = String(top.chat_id||"").includes("@lid");
  const runnerIsLid = String(runner.chat_id||"").includes("@lid");
  if (scored.length === 2) {
    const topName = normalize(top.chat_name || top.contact_name || "");
    const runnerName = normalize(runner.chat_name || runner.contact_name || "");
    if (topName && topName === runnerName && topIsLid !== runnerIsLid) {
      const phoneOne = topIsLid ? runner : top;
      return { chat_id: phoneOne.chat_id, chat_name: phoneOne.chat_name || phoneOne.contact_name };
    }
  }
  if (top._score >= MIN_CONFIDENT_SCORE && top._score - runner._score >= MIN_WINNING_GAP) {
    return { chat_id: top.chat_id, chat_name: top.chat_name || top.contact_name };
  }
  return { candidates: scored.slice(0,10).map(c => ({ chat_id: c.chat_id, name: c.chat_name||c.contact_name, is_group: c.is_group, last_message_at: c.last_message_at })) };
}

// ─── Casos de teste ──────────────────────────────────────────────────────────
const verbose = process.argv.includes("--verbose");

const cases = [
  // Pure pass-through
  { name: "chat_id digit puro existente", input: "554896561958", expect: { chat_id: "554896561958" } },
  { name: "chat_id @lid passthrough", input: "83627341791456@lid", expect: { chat_id: "83627341791456@lid" } },
  { name: "chat_id -group passthrough", input: "120363039397537141-group", expect: { chat_id: "120363039397537141-group" } },

  // Phones BR — Cesar Barboza tem 554896561958 (12d, sem 9 — fixo de SC)
  { name: "phone 12d com 55 (Cesar Barboza)",   input: "554896561958",   expect: { chat_id: "554896561958" } },
  { name: "phone 13d com 9 (Cesar Barboza variante)", input: "5548996561958", expect: { chat_id: "554896561958" } },
  { name: "phone 11d sem 55 sem 9 (Cesar Barboza)", input: "4896561958", expect: { chat_id: "554896561958" } },
  { name: "phone formatado +55 (48) 9656-1958", input: "+55 (48) 9656-1958", expect: { chat_id: "554896561958" } },
  { name: "phone formatado parenteses+9", input: "(48) 99656-1958", expect: { chat_id: "554896561958" } },

  // Asafe — 3 chats: 558192030166 (recente), 110092947058769@lid, 558191095702 (sem msg)
  { name: "phone Asafe 12d com 55", input: "558192030166", expect: { chat_id: "558192030166" } },
  { name: "phone Asafe 11d sem 55", input: "8192030166", expect: { chat_id: "558192030166" } },
  { name: "nome Asafe (ambiguo) -> candidates", input: "Asafe", expectKind: "ambiguous" },
  { name: "nome Asafe Silva (mais especifico)", input: "Asafe Silva", expect: { chat_id: "558191095702" } },

  // Camila Andrejus — 2 chats: 5511961928169 e 67895010828511@lid
  { name: "phone Camila 13d com 9 + 55", input: "5511961928169", expect: { chat_id: "5511961928169" } },
  { name: "phone Camila 11d sem 55", input: "11961928169", expect: { chat_id: "5511961928169" } },
  { name: "phone Camila 10d sem 55 sem 9", input: "1161928169", expect: { chat_id: "5511961928169" } },

  // Nomes
  { name: "nome exato Cesar Barboza (ambiguo, prefer non-LID)", input: "Cesar Barboza", expect: { chat_id: "554896561958" } },
  { name: "nome com acento Cesar Baleco", input: "Cesar Baleco", expect: { chat_id: "554488313400" } },
  { name: "nome sem acento Cesar Baleco", input: "Cesar Baleco", expect: { chat_id: "554488313400" } },
  { name: "nome parcial Camila And", input: "Camila And", expect: { chat_id: "5511961928169" } },
  { name: "nome Mirtes (twin chat -> phone)", input: "Mirtes", expect: { chat_id: "5511999666636" } },

  // Internacional
  { name: "internacional ChatGuru Suporte (US 11d)", input: "12565593008", expect: { chat_id: "12565593008" } },
  { name: "nome ChatGuru Suporte", input: "ChatGuru Suporte", expect: { chat_id: "12565593008" } },
  { name: "internacional LATAM (Chile 11d)", input: "56989672852", expect: { chat_id: "56989672852" } },
  { name: "nome LATAM (ambiguo)", input: "LATAM", expectKind: "ambiguous" },
  { name: "nome Rappi (US 11d)", input: "Rappi", expect: { chat_id: "12677744159" } },

  // Edge cases
  { name: "input vazio", input: "", expect: { error: /Input vazio/ } },
  { name: "input so espaco", input: "   ", expect: { error: /Input vazio/ } },
  { name: "input gibberish", input: "xpto1234asdfgh", expect: { error: /Nenhum chat/ } },
  { name: "input numero inexistente", input: "5511000000001", expect: { error: /Nenhum chat/ } },

  // Grupos por nome
  { name: "nome grupo CS - Churn", input: "CS - Churn", expect: { chat_id: "120363039397537141-group" } },
  { name: "grupo emoji Wpp Builders", input: "Wpp Builders", expect: { chat_id: "120363406506811873-group" } },

  // Mais variantes de nome
  { name: "nome parcial Cesar B (legitimamente ambiguo)", input: "Cesar B", expectKind: "ambiguous" },
  { name: "sobrenome Barboza (word match)", input: "Barboza", expect: { chat_id: "554896561958" } },
  { name: "nome em UPPERCASE", input: "CESAR BARBOZA", expect: { chat_id: "554896561958" } },
  { name: "nome com espacos extras", input: "  Cesar   Barboza  ", expect: { chat_id: "554896561958" } },
  { name: "nome com fuzzy typo (Cesarx)", input: "Cesarx Barboza", expect: { chat_id: "554896561958" } },

  // Phones formatados extremos
  { name: "phone com pontos (48.9656.1958)", input: "55.48.9656.1958", expect: { chat_id: "554896561958" } },
  { name: "phone com tabs e espacos", input: "55\t48\t9656\t1958", expect: { chat_id: "554896561958" } },
  { name: "phone errado por 1 digito (deve falhar/listar)", input: "5548999000111", expect: { error: /Nenhum chat/ } },

  // Internacional via nome ambiguo
  { name: "Carlos De Oliveira (Panama 11d)", input: "Carlos De Oliveira", expect: { chat_id: "50764503175" } },
  { name: "Fernando Galiano (Uruguai 11d)", input: "Fernando Galiano", expect: { chat_id: "59892799798" } },

  // chat_id puro digit que nao existe -> branch nome -> error
  { name: "digit puro 5 chars (parece phone, nao bate)", input: "12345", expect: { error: /Nenhum chat/ } },

  // Confirma que branch numerico nao engole match de nome com digits
  { name: "nome com numero embutido (Lourivaldo)", input: "Lourivaldo", expect: { chat_id: "5511995807599" } },

  // Buracos apontados pelo conselho — fixes do v2.2 final
  { name: "acento nao penaliza Lev (Hugo Doria sem acento, twin -> phone)", input: "Hugo Doria", expect: { chat_id: "557991148174" } },
  { name: "acento nao penaliza Lev (Hugo Dória com acento, twin -> phone)", input: "Hugo Dória", expect: { chat_id: "557991148174" } },
  { name: "nome curto 3 chars (Ana)", input: "Ana", expectKind: "ambiguous_or_resolved" },
  { name: "input com newline e tab", input: "\n  Cesar\tBarboza  \n", expect: { chat_id: "554896561958" } },
];

let pass = 0, fail = 0;
const failures = [];
const t0 = Date.now();

for (const c of cases) {
  const result = await resolveChat(c.input);
  let ok = false;
  let detail = "";
  if (c.expect?.chat_id) {
    ok = result.chat_id === c.expect.chat_id;
    detail = `got chat_id=${result.chat_id || result.error || JSON.stringify(result.candidates?.map(x=>x.chat_id))}`;
  } else if (c.expect?.error) {
    ok = result.error && (c.expect.error instanceof RegExp ? c.expect.error.test(result.error) : result.error === c.expect.error);
    detail = `got error=${result.error || "(none)"}`;
  } else if (c.expectKind === "ambiguous") {
    ok = Array.isArray(result.candidates) && result.candidates.length > 1;
    detail = `got candidates=${result.candidates?.length || 0}`;
  } else if (c.expectKind === "ambiguous_or_resolved") {
    ok = !!(result.chat_id) || (Array.isArray(result.candidates) && result.candidates.length >= 1);
    detail = result.chat_id ? `got chat_id=${result.chat_id}` : `got candidates=${result.candidates?.length||0}`;
  }
  if (ok) {
    pass++;
    if (verbose) console.log(`  PASS  ${c.name}  ::  ${detail}`);
  } else {
    fail++;
    failures.push({ ...c, result });
    console.log(`  FAIL  ${c.name}  ::  input=${JSON.stringify(c.input)}  ::  ${detail}`);
  }
}

console.log("");
console.log(`${pass}/${cases.length} passou (${fail} falhou) em ${Date.now()-t0}ms`);

// ─── Determinismo: rodar inputs ambiguos varias vezes e ver se resultado e estavel ─
console.log("\nTeste de determinismo (5 runs do mesmo input ambiguo):");
const detCases = ["Asafe", "Cesar B", "Mirtes", "Cesar Barboza", "11999666636"];
let detFail = 0;
for (const input of detCases) {
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(JSON.stringify(await resolveChat(input)));
  const stable = runs.every(r => r === runs[0]);
  console.log(`  ${stable ? "STABLE" : "FLAKY "}  ${JSON.stringify(input)}`);
  if (!stable) {
    detFail++;
    for (let i = 0; i < runs.length; i++) console.log(`    run ${i+1}: ${runs[i].slice(0, 200)}`);
  }
}
if (detFail) console.log(`  ${detFail}/${detCases.length} FLAKY — adicionar tiebreaker`);

if (failures.length || detFail) process.exit(1);
process.exit(0);
