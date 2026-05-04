// voice-pairs.mjs — Extrai 5 pares pergunta→resposta de 5 pessoas reais (1 por estrato).
// Pergunta = mensagem de TERCEIRO (from_me=false). Resposta = Eric (from_me=true) logo depois.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const STRATA = {
  "vendas-lead": ["lead"],
  "cliente": ["cliente"],
  "equipe": ["equipe"],
  "network": ["comunidade", "parceiro"],
  "intimo": ["familia", "pessoal"],
};

const OUT_FILE = process.env.PAIRS_OUT || "C:\\tmp\\voice-corpus\\_pairs.json";
const EXCLUDE_CHATS = new Set((process.env.EXCLUDE_CHATS || "").split(",").filter(Boolean));
const ONE_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

const BOT_CHAT_IDS = new Set(["120363419051052246-group"]);

function isBotMessage(content) {
  if (!content) return false;
  if (/Eric Luciano IA/i.test(content)) return true;
  if (/Resumo T[áa]tico/i.test(content)) return true;
  if (/Gerado por (Eric|IA|automa)/i.test(content)) return true;
  if (/📂\s*\*?\s*Zoom\s*Out\*?/i.test(content)) return true;
  if (/🔎\s*\*?\s*Zoom\s*In\*?/i.test(content)) return true;
  if (/ℹ️\s*\*?\s*Desfecho/i.test(content)) return true;
  // Resumos auto-gerados que escaparam do filtro original
  if (/^\s*\*?\s*Resumo\s*:\*?/i.test(content)) return true;
  if (/^\s*\*?\s*📊\s*Resumo/i.test(content)) return true;
  if (/A pessoa expressa|O interlocutor (se )?desculpa|O áudio aborda/i.test(content)) return true;
  // Broadcasts oficiais (avisos pra galera)
  if (/^\s*\*?⚠️\s*Comunicado/i.test(content)) return true;
  if (/^\s*\*?📢/.test(content)) return true;
  return false;
}

function looksLikeBroadcast(content) {
  // Mensagem genérica pra grupo grande, não resposta 1:1
  if (/Pessoal,\s*com as atualiza/i.test(content)) return true;
  if (/^\*?\[/.test(content) && /Equipe|Time/i.test(content.slice(0, 50))) return true;
  return false;
}

function looksLikeQuestion(content) {
  if (!content) return false;
  const c = content.trim();
  if (c.length < 30 || c.length > 600) return false;
  // Não pode ser link/forward/emoji
  if (/^https?:\/\//.test(c)) return false;
  if (/^\[\d{1,2}:\d{2}/.test(c)) return false; // forward pattern
  // Tem que ter sinal de pergunta ou palavra interrogativa
  if (c.includes("?")) return true;
  if (/\b(como|qual|quando|onde|porque|por que|quanto|quantos|quem|o que|que tal|sera|vc tem|vc sabe|vc pode|me explica|me ajuda|tenho uma duvida|preciso de|quero saber|tem alguma|posso|poderia)\b/i.test(c)) return true;
  return false;
}

async function getStratumChats() {
  const { data: cats } = await supabase.from("categories").select("id, slug");
  const slugById = new Map(cats.map(c => [c.id, c.slug]));
  const { data: links } = await supabase.from("chat_categories").select("chat_id, category_id");

  const chatSlugs = new Map();
  for (const l of links) {
    const slug = slugById.get(l.category_id);
    if (!slug) continue;
    if (!chatSlugs.has(l.chat_id)) chatSlugs.set(l.chat_id, new Set());
    chatSlugs.get(l.chat_id).add(slug);
  }

  const out = {};
  for (const [stratum, slugs] of Object.entries(STRATA)) out[stratum] = [];
  for (const [chatId, slugSet] of chatSlugs) {
    for (const [stratum, slugs] of Object.entries(STRATA)) {
      if (slugs.some(s => slugSet.has(s))) { out[stratum].push(chatId); break; }
    }
  }
  return out;
}

async function findPairsInChat(chatId, chatName, isGroup) {
  // Buscar todas as mensagens do chat (last 1 ano), ordenadas por ts asc
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, content, from_me, message_type, message_ts, sender_name")
      .eq("chat_id", chatId)
      .eq("is_deleted", false)
      .not("content", "is", null)
      .neq("content", "")
      .gte("message_ts", ONE_YEAR_AGO)
      .order("message_ts", { ascending: true })
      .range(from, from + 999);
    if (error) { console.error(`  WARN ${chatId}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  const pairs = [];
  for (let i = 0; i < all.length - 1; i++) {
    const q = all[i];
    const r = all[i + 1];
    if (q.from_me !== false) continue;
    if (r.from_me !== true) continue;
    if (!q.content || !r.content) continue;
    if (isBotMessage(r.content) || isBotMessage(q.content)) continue;
    if (looksLikeBroadcast(r.content)) continue;
    if (!looksLikeQuestion(q.content)) continue;
    if (r.content.length < 80 || r.content.length > 1500) continue;
    // Resposta tem que mencionar contexto da pergunta — não pode ser tópico totalmente desconectado
    // Heurística: ao menos uma palavra de 5+ chars compartilhada
    const qTokens = new Set(q.content.toLowerCase().match(/\b[a-záéíóúâêôãõç]{5,}\b/g) || []);
    const rTokens = new Set(r.content.toLowerCase().match(/\b[a-záéíóúâêôãõç]{5,}\b/g) || []);
    let overlap = 0;
    for (const t of qTokens) if (rTokens.has(t)) overlap++;
    if (overlap < 1) continue;
    // Pergunta não pode ser só um link
    if (/^https?:\/\/\S+$/.test(q.content.trim())) continue;
    // Resposta não pode ser só anúncio com link no início
    if (/^[🚀🎉📢]\s*\*/.test(r.content)) continue;
    // Resposta tem que vir em até 24h
    const dtHours = (new Date(r.message_ts) - new Date(q.message_ts)) / 3600000;
    if (dtHours < 0 || dtHours > 24) continue;
    pairs.push({
      chat_id: chatId,
      chat_name: chatName,
      is_group: isGroup,
      question: q.content,
      question_sender: q.sender_name,
      question_ts: q.message_ts,
      response: r.content,
      response_ts: r.message_ts,
      response_length: r.content.length,
      delta_minutes: Math.round((new Date(r.message_ts) - new Date(q.message_ts)) / 60000),
    });
  }
  return pairs;
}

async function getChatMeta(chatIds) {
  const meta = new Map();
  const CHUNK = 100;
  for (let i = 0; i < chatIds.length; i += CHUNK) {
    const chunk = chatIds.slice(i, i + CHUNK);
    const { data } = await supabase.from("chats").select("chat_id, chat_name, is_group").in("chat_id", chunk);
    for (const c of data) meta.set(c.chat_id, c);
  }
  return meta;
}

(async () => {
  console.log("Coletando pares pergunta→resposta por estrato...\n");
  const stratumChats = await getStratumChats();
  const allChatIds = Object.values(stratumChats).flat();
  const chatMeta = await getChatMeta(allChatIds);

  const finalPairs = {};
  for (const stratum of Object.keys(STRATA)) {
    process.stdout.write(`${stratum} (${stratumChats[stratum].length} chats) `);
    // Limita a 30 chats 1:1 mais ativos por estrato pra economizar query
    const chats = stratumChats[stratum]
      .map(id => chatMeta.get(id))
      .filter(c => c && !c.is_group)
      .filter(c => !/Eric Luciano|Expert Integrado/i.test(c.chat_name || ""))
      .filter(c => !EXCLUDE_CHATS.has(c.chat_id) && !EXCLUDE_CHATS.has(c.chat_name || ""));

    let bestPair = null;
    let bestScore = -1;
    let scanned = 0;

    for (const c of chats.slice(0, 150)) {
      scanned++;
      if (scanned % 5 === 0) process.stdout.write(".");
      const pairs = await findPairsInChat(c.chat_id, c.chat_name, c.is_group);
      // Score: quanto mais "limpo" o par (resposta substancial, pergunta clara), maior
      for (const p of pairs) {
        const score = p.response_length + (p.question.length * 0.5) + (p.question.includes("?") ? 30 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestPair = p;
        }
      }
      if (bestPair && bestScore > 600) break; // suficiente
    }
    if (bestPair) {
      finalPairs[stratum] = bestPair;
      console.log(` ✓ "${bestPair.chat_name}" (Q: ${bestPair.question.length}c, R: ${bestPair.response_length}c)`);
    } else {
      console.log(` ✗ nenhum par encontrado`);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(finalPairs, null, 2));
  console.log(`\n✓ ${OUT_FILE}`);
  for (const [s, p] of Object.entries(finalPairs)) {
    console.log(`\n--- ${s} | ${p.chat_name} | Δ=${p.delta_minutes}min ---`);
    console.log(`Q: ${p.question.slice(0, 200).replace(/\n/g, " ")}${p.question.length > 200 ? "..." : ""}`);
    console.log(`R: ${p.response.slice(0, 200).replace(/\n/g, " ")}${p.response.length > 200 ? "..." : ""}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
