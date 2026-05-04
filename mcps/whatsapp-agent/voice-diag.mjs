// voice-diag.mjs — Diagnóstico SQL agregado pra Voice Brain do Eric.
// Sem cap de inbox: varre TODAS as mensagens do banco filtradas por estrato + janela de 1 ano.
//
// Uso (no diretório deste arquivo):
//   node --env-file=.env voice-diag.mjs
//
// Output: tabela ASCII com contagens reais por estrato.
// Não escreve nada no banco. Read-only.

import { createClient } from "@supabase/supabase-js";

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

const ONE_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
const PAGE_SIZE = 1000;

async function getChatIdsByStratum() {
  // Resolve category_id → chat_id por slug
  const { data: cats, error: e1 } = await supabase
    .from("categories")
    .select("id, slug");
  if (e1) throw e1;
  const slugById = new Map(cats.map(c => [c.id, c.slug]));
  const idBySlug = new Map(cats.map(c => [c.slug, c.id]));

  const { data: links, error: e2 } = await supabase
    .from("chat_categories")
    .select("chat_id, category_id");
  if (e2) throw e2;

  // chat_id → set de slugs
  const chatSlugs = new Map();
  for (const l of links) {
    const slug = slugById.get(l.category_id);
    if (!slug) continue;
    if (!chatSlugs.has(l.chat_id)) chatSlugs.set(l.chat_id, new Set());
    chatSlugs.get(l.chat_id).add(slug);
  }

  // Aplica grupos de estrato
  const out = {};
  for (const [stratum, slugs] of Object.entries(STRATA)) {
    const chats = new Set();
    for (const [chatId, chatSlugSet] of chatSlugs) {
      if (slugs.some(s => chatSlugSet.has(s))) chats.add(chatId);
    }
    out[stratum] = [...chats];
  }
  out._totalChatsCategorizados = chatSlugs.size;
  return out;
}

async function fetchMessagesPaginated(chatIds) {
  // Paginação: até 1000 por página até esgotar
  // Filtro: from_me=true, message_ts >= 1 ano, content not null/empty, is_deleted=false
  // Itera CHAT POR CHAT pra evitar statement_timeout do Postgres em IN(...) grande.
  // Cada chat tem indice (chat_id, message_ts DESC) — query individual é rápida.
  if (chatIds.length === 0) return [];
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
        // Se um chat individual der timeout, log e segue — não bloqueia o resto
        console.error(`\n  WARN chat ${chatId}: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    if (processed % 10 === 0) process.stdout.write(`.`);
  }
  return all;
}

function summarize(msgs) {
  const total = msgs.length;
  const sub40 = msgs.filter(m => (m.content || "").length > 40).length;
  const sub80 = msgs.filter(m => (m.content || "").length > 80).length;
  const sub200 = msgs.filter(m => (m.content || "").length > 200).length;
  const audios = msgs.filter(m => ["ptt", "audio"].includes(m.message_type) && (m.content || "").length > 100).length;
  const totalChars = msgs.reduce((s, m) => s + (m.content?.length || 0), 0);
  const avgLen = total ? Math.round(totalChars / total) : 0;
  const uniqChats = new Set(msgs.map(m => m.chat_id)).size;
  return { total, sub40, sub80, sub200, audios, avgLen, uniqChats };
}

(async () => {
  console.log(`Voice Brain — Diagnóstico SQL (janela: ${ONE_YEAR_AGO} → agora)\n`);

  const stratum = await getChatIdsByStratum();
  const totalCategorizados = stratum._totalChatsCategorizados;
  delete stratum._totalChatsCategorizados;
  console.log(`Total de chats categorizados (qualquer categoria): ${totalCategorizados}\n`);

  const results = {};
  for (const [name, chatIds] of Object.entries(stratum)) {
    process.stdout.write(`Coletando ${name} (${chatIds.length} chats)... `);
    const msgs = await fetchMessagesPaginated(chatIds);
    results[name] = { chats: chatIds.length, ...summarize(msgs) };
    console.log(`OK (${msgs.length} msgs)`);
  }

  console.log("\n┌─────────────────┬───────┬────────┬────────┬────────┬─────────┬────────┬──────────┐");
  console.log("│ Estrato         │ Chats │ TotMsg │ >40chr │ >80chr │ >200chr │ Áudios │ AvgChars │");
  console.log("├─────────────────┼───────┼────────┼────────┼────────┼─────────┼────────┼──────────┤");
  for (const [name, r] of Object.entries(results)) {
    const status = r.sub40 >= 1500 ? "OK" : r.sub40 >= 400 ? "MARGINAL" : "FRACO";
    console.log(
      `│ ${name.padEnd(15)} │ ${String(r.chats).padStart(5)} │ ${String(r.total).padStart(6)} │ ${String(r.sub40).padStart(6)} │ ${String(r.sub80).padStart(6)} │ ${String(r.sub200).padStart(7)} │ ${String(r.audios).padStart(6)} │ ${String(r.avgLen).padStart(8)} │  ${status}`
    );
  }
  console.log("└─────────────────┴───────┴────────┴────────┴────────┴─────────┴────────┴──────────┘");

  // Total agregado
  const tot = {
    total: 0, sub40: 0, sub80: 0, sub200: 0, audios: 0, chatsUnicos: new Set()
  };
  for (const [name, chatIds] of Object.entries(stratum)) {
    tot.total += results[name].total;
    tot.sub40 += results[name].sub40;
    tot.sub80 += results[name].sub80;
    tot.sub200 += results[name].sub200;
    tot.audios += results[name].audios;
    chatIds.forEach(c => tot.chatsUnicos.add(c));
  }
  console.log(`\nAgregado nos 5 estratos:`);
  console.log(`  Chats únicos: ${tot.chatsUnicos.size}`);
  console.log(`  Mensagens totais: ${tot.total}`);
  console.log(`  Substantivas >40 chars: ${tot.sub40}`);
  console.log(`  Substantivas >80 chars: ${tot.sub80}`);
  console.log(`  Substantivas >200 chars (áudios + textos longos): ${tot.sub200}`);
  console.log(`  Áudios transcritos longos: ${tot.audios}`);
})().catch(e => {
  console.error("ERRO:", e.message || e);
  process.exit(1);
});
