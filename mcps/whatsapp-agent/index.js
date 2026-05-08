import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AGENT_NAME = process.env.AGENT_NAME || "unknown-agent";  // identifica esta instancia em audit log

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.warn("AVISO: OPENAI_API_KEY nao configurada — transcricao automatica de audio desativada.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ZAPI_BASE = ZAPI_INSTANCE_ID && ZAPI_TOKEN
  ? `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`
  : null;

const SEND_MESSAGE_URL = `${SUPABASE_URL}/functions/v1/send-message`;

// ─── VOICE GUIDE ─────────────────────────────────────────────────────────────
// Carrega arquivo de voice guide do user (single-tenant per install).
// Procura em ordem: VOICE_GUIDE_PATH env > ./voice-guide.md (raiz MCP) > ~/.claude/voice-guide.md
// > OneDrive\Workspace\claude-sync\memory\voice-guide.md > eric-voice.md (legacy seed)
//
// Filosofia: warning, nunca bloqueio. send() executa normal mas avisa Claude se detectar
// violacao das regras hard. Cabe a Claude reescrever ou prosseguir consciente.
//
// Multi-instalacao: cada user gera o proprio voice-guide.md a partir do template.

const VOICE_GUIDE_CANDIDATES = [
  process.env.VOICE_GUIDE_PATH,
  path.join(process.cwd(), "voice-guide.md"),
  path.join(os.homedir(), ".claude", "voice-guide.md"),
  path.join(os.homedir(), "OneDrive", "Workspace", "claude-sync", "memory", "voice-guide.md"),
  path.join(os.homedir(), "OneDrive", "Workspace", "claude-sync", "memory", "eric-voice.md"),
].filter(Boolean);

function findVoiceGuide() {
  for (const candidate of VOICE_GUIDE_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        return { path: candidate, content: fs.readFileSync(candidate, "utf8") };
      }
    } catch { /* ignora e tenta proximo */ }
  }
  return null;
}

// Regras hard universais — fingerprints binarias de "nao-Eric" (e fingerprints de IA em geral)
// Pode ser sobrescrito via voice-guide.md customizado no campo `regras_hard_regex` (futuro).
const HARD_RULES = [
  {
    id: "tu-pronome",
    pattern: /\b(tu|teu|tua|teus|tuas|ti)\b/iu,
    severity: "high",
    message: "Detectado uso de 'tu/teu/tua' — voice guide proibe em qualquer estrato. Eric usa 'vc'/'seu'.",
  },
  {
    id: "em-dash",
    pattern: /—/,
    severity: "high",
    message: "Detectado em-dash (—) — fingerprint de IA. Voice guide manda usar virgula, dois-pontos, parenteses ou '..'.",
  },
  {
    id: "saudacao-generica",
    // \b em JS regex nao trata acentos como word chars; usa boundary custom (inicio/whitespace antes, nao-letra ASCII depois)
    pattern: /(?:^|[\s,!?;:.])(ol[áa]|prezad[oa]|cordialmente|atenciosamente|esp[ée]ro que esteja bem)(?=$|[\s,!?;:.])/iu,
    severity: "high",
    message: "Detectada saudacao generica/formal. Voice guide manda 'Fala [Nome], beleza?' ou direto no assunto.",
  },
  {
    id: "hype",
    pattern: /(?:^|[\s,!?;:.])(revolucion[áa]ri[oa]|transformador|disruptivo|game[- ]?changer|mindset|f[óo]rmula m[áa]gica)(?=$|[\s,!?;:.])/iu,
    severity: "high",
    message: "Detectado vocabulario de hype. Voice guide proibe — user posiciona com contencao.",
  },
  {
    id: "urgencia-manufaturada",
    pattern: /(?:^|[\s,!?;:.])([úu]ltima chance|s[óo] hoje|corre que|aproveita j[áa])(?=$|[\s,!?;:.])/iu,
    severity: "high",
    message: "Detectada urgencia manufaturada. Voice guide so aceita escassez REAL ('to fechando a lista').",
  },
  {
    id: "softener-equipe",
    pattern: /\b(quando puder, por favor|se for poss[íi]vel|quando der um tempinho|com todo respeito)\b/iu,
    severity: "medium",
    message: "Detectado softener. Em equipe Eric usa ordem direta ('tem q resolver X'). Em discordancia, frontalidade direta.",
  },
  {
    id: "validacao-afetiva",
    pattern: /\b(te entendo|imagino como (voc[êe]|vc) (est[áa]|t[áa])|faz sentido (sua|tua) preocupa[çc][ãa]o|fica tranquil[oa] (que|q) vamos)\b/iu,
    severity: "high",
    message: "Detectada validacao afetiva. Voice guide regra hard: frontalidade nao inclui validar emocao — devolve pergunta de plano.",
  },
  {
    id: "rsrs",
    pattern: /\brsrs\w*\b/iu,
    severity: "medium",
    message: "Detectado 'rsrs'. Voice guide aceita 'kkk' (risada) ou 'rs' solto fim-de-frase (atenuador), mas nao 'rsrs'.",
  },
];

function checkVoiceViolations(content) {
  if (!content || typeof content !== "string") return [];
  const violations = [];
  for (const rule of HARD_RULES) {
    const match = content.match(rule.pattern);
    if (match) {
      violations.push({
        id: rule.id,
        severity: rule.severity,
        message: rule.message,
        match: match[0],
      });
    }
  }
  return violations;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function zapiHeaders() {
  return {
    "Content-Type": "application/json",
    "Client-Token": ZAPI_CLIENT_TOKEN || "",
  };
}

function serviceHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(msg) {
  return { content: [{ type: "text", text: `ERRO: ${msg}` }], isError: true };
}

// Converte ISO UTC pra string legivel em horario de Brasilia (BRT, UTC-3).
// Ex: "2026-05-06T21:38:26+00:00" -> "2026-05-06 18:38:26 BRT"
// Mantem campo original message_ts pra compatibilidade; adiciona _brt em paralelo.
function toBRT(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    const pad = n => String(n).padStart(2, "0");
    return `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())} ${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}:${pad(brt.getUTCSeconds())} BRT`;
  } catch {
    return null;
  }
}

// Anexa message_ts_brt e created_at_brt em cada mensagem (nao remove os campos UTC originais).
function withBRT(messages) {
  return (messages || []).map(m => ({
    ...m,
    ...(m.message_ts ? { message_ts_brt: toBRT(m.message_ts) } : {}),
    ...(m.created_at ? { created_at_brt: toBRT(m.created_at) } : {}),
  }));
}

// \u2500\u2500\u2500 SCORING CONSTANTS (calibradas contra DB real, ver test-resolve.js) \u2500\u2500\u2500\u2500\u2500\u2500
// Tier de match no nome \u2014 gap de >= 15 entre top e runner-up significa "vence claramente".
const SCORE_EXACT       = 100;  // chat_name === input apos normalize
const SCORE_STARTS_WITH =  80;  // chat_name comeca com input (ex: "Cesar" -> "Cesar Barboza")
const SCORE_WORD        =  70;  // input e palavra inteira em chat_name (ex: "Barboza")
const SCORE_SUBSTRING   =  50;  // input e substring contigua
const SCORE_FUZZY       =  25;  // Levenshtein por palavra dentro do threshold

// Boost aditivo aplicado em cima do score base \u2014 tiebreakers entre chats com mesmo nome
const BOOST_NOT_GROUP    = 4;   // 1:1 > grupo (CEO geralmente quer pessoa)
const BOOST_NOT_LID      = 3;   // chat_id puro digit > @lid (LID e ID interno do WhatsApp)
const BOOST_RECENT_7D    = 4;   // mensagem na ultima semana = chat ativo
const BOOST_RECENT_30D   = 2;   // mensagem no ultimo mes = morno
const FUZZY_THRESHOLD_RATIO = 0.25;  // Lev <= floor(len * ratio), minimo 1
const MIN_CONFIDENT_SCORE = 80; // top precisa ter pelo menos isso pra "vencer claramente"
const MIN_WINNING_GAP     = 15; // ... E gap de pelo menos isso pro runner-up

/**
 * Normaliza string para busca: remove acentos, converte pra minusculo,
 * colapsa espacos e trim. Aplicada antes de qualquer comparacao por nome.
 */
function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gera variantes de telefone BR (com e sem o 9 do celular).
 * Input: digitos sem formatacao.
 * Retorna lista de strings candidatas pra busca em chats.
 *
 * Exemplos:
 *   "5562981514742" (13d, com 9) \u2192 ["5562981514742", "556281514742"]
 *   "556281514742"  (12d, sem 9) \u2192 ["556281514742", "5562981514742"]
 *   "11999998888"   (curto)      \u2192 ["11999998888"]
 */
function normalizePhoneBR(digits) {
  const out = new Set();
  if (!digits) return [];
  out.add(digits);

  const flipNine = (d) => {
    if (d.length === 13 && d.startsWith("55") && d[4] === "9") {
      // 55 DDD 9 XXXXXXXX -> tira o 9
      out.add(d.slice(0, 4) + d.slice(5));
    } else if (d.length === 12 && d.startsWith("55")) {
      // 55 DDD XXXXXXXX -> adiciona o 9
      out.add(d.slice(0, 4) + "9" + d.slice(4));
    }
  };
  flipNine(digits);

  // Sem prefixo 55 mas length 10 ou 11 cabe num phone BR domestico (DDD + 8d ou DDD + 9d)
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    const with55 = "55" + digits;
    out.add(with55);
    flipNine(with55);
  }

  return Array.from(out);
}

/**
 * Extrai os digitos iniciais do chat_id (parte antes de @ ou -group).
 * Retorna null se chat_id nao comeca com digitos.
 */
function chatIdDigits(chat_id) {
  if (!chat_id) return null;
  const m = String(chat_id).match(/^(\d+)/);
  return m ? m[1] : null;
}

/**
 * Para cada variante de phone, gera todos os formatos de chat_id que ela poderia assumir.
 * Cobre: numero puro, @s.whatsapp.net, @c.us, @lid (raro), -group, @g.us.
 */
function expandChatIdCandidates(phoneVariants) {
  const suffixes = ["", "@s.whatsapp.net", "@c.us", "@lid", "-group", "@g.us"];
  const out = new Set();
  for (const v of phoneVariants) {
    for (const s of suffixes) out.add(v + s);
  }
  return Array.from(out);
}

/**
 * Distancia de Levenshtein entre duas strings.
 */
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

/**
 * Retorna true se cada palavra do input tiver pelo menos uma palavra proxima em name.
 * Threshold: 30% do tamanho da palavra, minimo 2.
 */
function fuzzyMatch(input, name) {
  const inputParts = input.split(/\s+/).filter(Boolean);
  const nameParts = name.split(/\s+/).filter(Boolean);
  if (!nameParts.length) return false;
  return inputParts.every((ip) => {
    // Threshold apertado pra reduzir falsos positivos (ex: "barboza" nao casa "barbara")
    const threshold = Math.max(1, Math.floor(ip.length * FUZZY_THRESHOLD_RATIO));
    return nameParts.some((np) => levenshtein(ip, np) <= threshold);
  });
}

/**
 * Determina quao bem um chat casa com o input (nome).
 * Retorna { score, kind } onde score 0 = nao casa, mais alto = melhor match.
 */
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

/**
 * Aplica boost a chats com base em sinais de qualidade:
 * - Nao-grupo > grupo
 * - chat_id puro digit > @lid
 * - Atividade recente
 */
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

/**
 * Resolve "to" (nome, telefone ou chat_id) para um chat_id concreto.
 *
 * Retorna:
 *   { chat_id, chat_name }              -> match unico ou top score claramente vencedor
 *   { candidates: [...] }               -> >1 match com score parecido (ambiguo)
 *   { error: "..." }                    -> nada encontrado
 *
 * Estrategia em camadas (early return assim que ha resultado claro):
 *   1. Pass-through para chat_id literal (digits + sufixo @x ou -group)
 *   2. Branch numerico: phone com 8+ digitos
 *      - Match exato em chat_id usando todas as variantes BR (com/sem 55, com/sem 9)
 *        + sufixos comuns (@s.whatsapp.net, @c.us, @lid, -group, @g.us)
 *      - Fallback prefix LIKE (chat_id ~ '^digits') para cobrir formatos raros
 *   3. Branch nome: busca client-side em v_chats_with_contact (1500 rows, todos)
 *      com scoring (exato > startsWith > word > substring > fuzzy) + boost de
 *      qualidade (nao-grupo, nao-LID, atividade recente).
 *      Top score >= 80 e gap >= 15 -> resolve sozinho. Senao, retorna candidatos.
 *
 * Multi-layer fail open: se branch numerico nao encontra nada, ainda tenta nome.
 */
/**
 * Dado um chat_id resolvido, retorna a lista de chat_ids equivalentes via lid_mapping.
 * Cobre o gap onde mensagens enviadas por linked device chegam com @lid no webhook
 * apesar do chat principal ser numerico (ou vice-versa). Sempre inclui o proprio chat_id.
 *
 * Casos:
 *  - chat_id numerico -> retorna [chat_id, ...lids que mapeiam pro phone]
 *  - chat_id @lid     -> retorna [chat_id, phone] (se houver mapping)
 *  - grupo / sem map  -> retorna [chat_id]
 */
async function expandChatIdsViaLidMapping(chat_id) {
  if (!chat_id) return [];
  const ids = new Set([chat_id]);
  try {
    if (String(chat_id).endsWith("@lid")) {
      const { data } = await supabase
        .from("lid_mapping")
        .select("phone")
        .eq("lid", chat_id)
        .limit(1);
      if (data?.[0]?.phone) ids.add(data[0].phone);
    } else if (/^\d+$/.test(String(chat_id))) {
      const { data } = await supabase
        .from("lid_mapping")
        .select("lid")
        .eq("phone", chat_id);
      if (data?.length) for (const r of data) ids.add(r.lid);
    }
  } catch {
    // fail open: se lid_mapping nao existir ou der erro, segue so com chat_id original
  }
  return Array.from(ids);
}

async function resolveChat(to) {
  if (!to || !String(to).trim()) return { error: "Input vazio" };
  to = String(to).trim();

  // 1. chat_id literal (digits + sufixo) -> tenta confirmar; passthrough se nao achar
  if (/^[0-9]+(@[a-z.]+|-group)$/i.test(to)) {
    const { data } = await supabase
      .from("v_chats_with_contact")
      .select("chat_id,chat_name,contact_name,is_group")
      .eq("chat_id", to)
      .limit(1);
    if (data?.length) {
      return { chat_id: data[0].chat_id, chat_name: data[0].chat_name || data[0].contact_name || to };
    }
    return { chat_id: to, chat_name: to };
  }

  // Detecta se input parece phone (digit + separadores comuns)
  const digits = to.replace(/\D/g, "");
  const looksLikePhone = digits.length >= 8 && /^[\d\s+()\-.]+$/.test(to);

  // 2. Branch numerico
  if (looksLikePhone) {
    const phoneVariants = normalizePhoneBR(digits);
    const idCandidates = expandChatIdCandidates(phoneVariants);

    // 2a. Match exato em chat_id contra todas as variantes
    // Tiebreaker chat_id ASC garante ordem deterministica em empates de last_message_at
    const { data: exact } = await supabase
      .from("v_chats_with_contact")
      .select("chat_id,chat_name,contact_name,is_group,last_message_at")
      .in("chat_id", idCandidates)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("chat_id", { ascending: true })
      .limit(10);

    if (exact?.length === 1) {
      return { chat_id: exact[0].chat_id, chat_name: exact[0].chat_name || exact[0].contact_name };
    }
    if (exact?.length > 1) {
      const ranked = exact.map(c => ({ ...c, _score: applyChatBoost(50, c) }))
                          .sort((a, b) => b._score - a._score);
      if (ranked[0]._score - ranked[1]._score >= 5) {
        return { chat_id: ranked[0].chat_id, chat_name: ranked[0].chat_name || ranked[0].contact_name };
      }
      return { candidates: ranked.slice(0, 5).map(c => ({
        chat_id: c.chat_id, name: c.chat_name || c.contact_name, is_group: c.is_group,
      })) };
    }

    // 2b. Fallback: prefix match em chat_id pra digitos sem sufixo conhecido
    const longest = phoneVariants.slice().sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 8) {
      const { data: prefix } = await supabase
        .from("v_chats_with_contact")
        .select("chat_id,chat_name,contact_name,is_group,last_message_at")
        .like("chat_id", `${longest}%`)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("chat_id", { ascending: true })
        .limit(5);
      if (prefix?.length === 1) {
        return { chat_id: prefix[0].chat_id, chat_name: prefix[0].chat_name || prefix[0].contact_name };
      }
      if (prefix?.length > 1) {
        const ranked = prefix.map(c => ({ ...c, _score: applyChatBoost(40, c) }))
                             .sort((a, b) => b._score - a._score);
        if (ranked[0]._score - ranked[1]._score >= 5) {
          return { chat_id: ranked[0].chat_id, chat_name: ranked[0].chat_name || ranked[0].contact_name };
        }
        return { candidates: ranked.slice(0, 5).map(c => ({
          chat_id: c.chat_id, name: c.chat_name || c.contact_name, is_group: c.is_group,
        })) };
      }
    }
    // Nada bateu pra phone — cai pro branch nome (input talvez seja codigo numerico que e nome)
  }

  // 3. Branch nome
  // TODO: migrar pra pg_trgm + similarity() server-side quando chats > 3000.
  // O indice idx_chats_name_trgm (gin_trgm_ops) ja existe — basta usar.
  // Mantem hibrido: trgm corta top 50, rerank com applyChatBoost in-memory.
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
    return { ...c, _score: score > 0 ? applyChatBoost(score, c) : 0, _kind: kind };
  }).filter(c => c._score > 0)
    .sort((a, b) => b._score - a._score || String(a.chat_id).localeCompare(String(b.chat_id)));

  if (!scored.length) return { error: `Nenhum chat encontrado para "${to}"` };
  if (scored.length === 1) {
    return { chat_id: scored[0].chat_id, chat_name: scored[0].chat_name || scored[0].contact_name };
  }

  const top = scored[0], runner = scored[1];
  const topIsLid = String(top.chat_id || "").includes("@lid");
  const runnerIsLid = String(runner.chat_id || "").includes("@lid");

  // Twin chat: exatamente 2 candidatos, mesmo nome, um e phone e outro e LID -> prefere o phone
  // (independente de score — vale tambem quando o match veio via fuzzy)
  if (scored.length === 2) {
    const topName = normalize(top.chat_name || top.contact_name || "");
    const runnerName = normalize(runner.chat_name || runner.contact_name || "");
    if (topName && topName === runnerName && topIsLid !== runnerIsLid) {
      const phoneOne = topIsLid ? runner : top;
      return { chat_id: phoneOne.chat_id, chat_name: phoneOne.chat_name || phoneOne.contact_name };
    }
  }

  // Top vence claramente: score >= MIN_CONFIDENT_SCORE e gap >= MIN_WINNING_GAP
  if (top._score >= MIN_CONFIDENT_SCORE && top._score - runner._score >= MIN_WINNING_GAP) {
    return { chat_id: top.chat_id, chat_name: top.chat_name || top.contact_name };
  }

  return { candidates: scored.slice(0, 10).map(c => ({
    chat_id: c.chat_id,
    name: c.chat_name || c.contact_name,
    is_group: c.is_group,
    last_message_at: c.last_message_at,
  })) };
}

// ─── AUDIO TRANSCRIPTION ─────────────────────────────────────────────────────

const AUDIO_TYPES = new Set(["audio", "voice", "ptt"]);

const MIME_BY_EXT = {
  ogg: "audio/ogg", oga: "audio/ogg",
  mp3: "audio/mpeg", mpeg: "audio/mpeg",
  mp4: "audio/mp4", m4a: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  opus: "audio/ogg; codecs=opus",
};

/**
 * Baixa o audio da mediaUrl e transcreve via OpenAI Whisper API (whisper-1).
 * - Para URLs do Supabase Storage: adiciona Bearer do service role.
 * - Para original_url (Backblaze CDN da Z-API): acesso direto sem auth.
 * Retorna o texto transcrito, ou uma string de erro se falhar.
 */
async function transcribeAudio(mediaUrl, mimeHint) {
  if (!OPENAI_API_KEY) return "Transcricao indisponivel: OPENAI_API_KEY nao configurada";
  try {
    const downloadHeaders = {};
    if (mediaUrl.includes(".supabase.co/storage")) {
      downloadHeaders["Authorization"] = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    }

    const audioRes = await fetch(mediaUrl, { headers: downloadHeaders });
    if (!audioRes.ok) return `Erro ao transcrever: download falhou (HTTP ${audioRes.status})`;

    const audioBuffer = await audioRes.arrayBuffer();
    if (!audioBuffer.byteLength) return "Erro ao transcrever: arquivo de audio vazio";

    // Usa mimeHint do banco (ex: "audio/ogg; codecs=opus") ou infere pela extensao da URL
    const baseMime = mimeHint ? mimeHint.split(";")[0].trim() : null;
    const ext = (mediaUrl.match(/\.(ogg|oga|mp3|mp4|m4a|wav|webm|mpeg|opus)(\?|$)/i)?.[1] || "ogg").toLowerCase();
    const mimeType = baseMime || MIME_BY_EXT[ext] || "audio/ogg";
    const filename = `audio.${ext}`;

    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: mimeType }), filename);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "text");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      return `Erro ao transcrever: OpenAI ${whisperRes.status} — ${errText.slice(0, 120)}`;
    }

    const text = await whisperRes.text();
    return text.trim() || "(audio sem fala detectada)";
  } catch (e) {
    return `Erro ao transcrever: ${e.message}`;
  }
}

/**
 * Recebe um array de mensagens e adiciona campo `transcription` nas de audio.
 *
 * Logica por tipo de chat:
 * - Privado: a Edge Function transcribe-queue ja salva em messages.content (cache).
 *   Se content nao for null, retorna direto sem chamar API.
 * - Grupo: transcreve on-demand (a cron so processa privados).
 *   Apos transcrever, salva em messages.content como cache permanente.
 *   Proxima leitura usa o cache — zero API call.
 *
 * Schema real do message_media:
 *   message_id, mime_type, storage_bucket, storage_path, original_url, download_status
 */
async function enrichWithTranscriptions(messages) {
  const audioMessages = messages.filter(m => AUDIO_TYPES.has(m.message_type));
  if (!audioMessages.length) return messages;

  // Separa cache hits (content ja preenchido) de cache misses (precisa transcrever)
  const cacheHits = audioMessages.filter(m => m.content && typeof m.content === "string" && !m.content.startsWith("http"));
  const cacheMisses = audioMessages.filter(m => !m.content || m.content.startsWith("http"));

  // Para cache misses: busca URLs de midia em lote
  const mediaById = {};
  const missIds = cacheMisses.map(m => m.id).filter(Boolean);

  if (missIds.length) {
    const { data: mediaRows } = await supabase
      .from("message_media")
      .select("message_id,original_url,storage_bucket,storage_path,mime_type,download_status")
      .in("message_id", missIds);

    for (const row of mediaRows || []) {
      if (row.download_status !== "done") continue;
      // Prefere Supabase Storage (persistente) sobre original_url (CDN Backblaze)
      const storageUrl = row.storage_path && row.storage_bucket
        ? `${SUPABASE_URL}/storage/v1/object/${row.storage_bucket}/${row.storage_path}`
        : null;
      mediaById[row.message_id] = { url: storageUrl || row.original_url, mimeType: row.mime_type };
    }
  }

  // Transcreve cache misses em paralelo e salva no banco (cache permanente)
  const newTranscriptions = await Promise.all(
    cacheMisses.map(async m => {
      const media = mediaById[m.id];
      const mediaUrl = media?.url;

      if (!mediaUrl) return { id: m.id, transcription: "Erro ao transcrever: midia nao encontrada no banco" };

      const transcription = await transcribeAudio(mediaUrl, media?.mimeType);

      // Salva no banco se transcricao bem-sucedida (sem mensagem de erro)
      if (m.id && !transcription.startsWith("Erro ao transcrever")) {
        supabase.from("messages").update({ content: transcription }).eq("id", m.id).then(({ error }) => {
          if (error) console.error(`Cache save failed for msg ${m.id}:`, error.message);
        });
      }

      return { id: m.id, transcription };
    })
  );

  // Monta mapa final: cache hits usam content existente, misses usam resultado da API
  const transcriptionById = {};
  for (const m of cacheHits) transcriptionById[m.id] = m.content;
  for (const t of newTranscriptions) transcriptionById[t.id] = t.transcription;

  return messages.map(m =>
    AUDIO_TYPES.has(m.message_type)
      ? { ...m, transcription: transcriptionById[m.id] ?? "Erro ao transcrever audio" }
      : m
  );
}

// ─── SERVER ──────────────────────────────────────────────────────────────────

const server = new McpServer({ name: "whatsapp-agent", version: "2.9.0" });

// Auto-calcula tempo de typing baseado em tipo+content (humanize=true).
// Heuristica: ~30 chars/seg = velocidade de digitacao confortavel. Cap em 15s (limite Z-API).
function humanizedTypingSeconds(type, content) {
  const len = (content || "").length;
  if (type === "text")            return Math.min(15, Math.max(1, Math.ceil(len / 30)));
  if (type === "audio" || type === "ptt") return 3;  // "Gravando audio..."
  if (type === "image" || type === "video") return 2;
  return 1; // document
}

// ─── 1. inbox ────────────────────────────────────────────────────────────────
server.tool(
  "inbox",
  `Mostra as conversas recentes do WhatsApp com as ultimas mensagens de cada uma.
Use para: "quem me mandou mensagem?", "o que tem no WhatsApp?".

Filtros disponiveis:
- since: ISO timestamp, so atividade apos a data
- waiting_on: "eric" (lead respondeu por ultimo, eu devo responder), "lead" (eu respondi por ultimo, espera deles), "none"
- exclude_groups: ignora grupos (default false)
- category_slugs: array de slugs (use list_categories pra ver opcoes). Se passar, so retorna chats que TEM PELO MENOS UMA dessas categorias.
- exclude_categories: array de slugs. Chats com QUALQUER uma dessas categorias sao filtrados fora.

Retorna: lista de chats com nome, ultima msg, timestamp, categorias atribuidas, waiting_on.
Mensagens de audio incluem campo transcription transcrito automaticamente.`,
  {
    limit: z.number().int().min(1).max(50).default(15),
    since: z.string().optional().describe("ISO timestamp — so chats com atividade apos esta data"),
    waiting_on: z.enum(["eric", "lead", "none"]).optional().describe("Filtra por quem deve responder agora"),
    exclude_groups: z.boolean().default(false).describe("Se true, ignora grupos (so 1:1)"),
    category_slugs: z.array(z.string()).optional().describe("So chats que tem pelo menos uma dessas categorias"),
    exclude_categories: z.array(z.string()).optional().describe("Chats com qualquer uma dessas categorias sao filtrados fora"),
  },
  async ({ limit, since, waiting_on: waitingFilter, exclude_groups, category_slugs, exclude_categories }) => {
    try {
      // Quando ha filtro de categoria, vai pela view v_chats_with_categories pra
      // ja vir com category_slugs no resultado e poder filtrar via .contains().
      const useCategoryView = !!(category_slugs?.length || exclude_categories?.length);

      let q = supabase
        .from(useCategoryView ? "v_chats_with_categories" : "v_chats_with_contact")
        .select(useCategoryView
          ? "chat_id,chat_name,is_group,last_message_at,last_received_at,last_sent_at,category_slugs"
          : "chat_id,chat_name,contact_name,is_group,last_message_at,last_received_at,last_sent_at,observations")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("chat_id", { ascending: true })
        .limit(useCategoryView ? Math.max(limit * 5, 100) : limit); // pega mais quando filtra por categoria

      if (since) q = q.gt("last_message_at", since);
      if (exclude_groups) q = q.eq("is_group", false);
      if (category_slugs?.length) q = q.overlaps("category_slugs", category_slugs);

      const { data: rawChats, error } = await q;
      if (error) return err(error.message);

      // Aplica filtros client-side: waiting_on, exclude_categories
      let chats = (rawChats || []).filter(c => {
        if (waitingFilter) {
          const recv = c.last_received_at ? new Date(c.last_received_at).getTime() : 0;
          const sent = c.last_sent_at ? new Date(c.last_sent_at).getTime() : 0;
          const w = recv > sent ? "eric" : (sent > recv ? "lead" : "none");
          if (w !== waitingFilter) return false;
        }
        if (exclude_categories?.length && c.category_slugs) {
          if (c.category_slugs.some(s => exclude_categories.includes(s))) return false;
        }
        return true;
      }).slice(0, limit);

      // Se foi pela view de categorias, busca contact_name separado
      let contactById = {};
      if (useCategoryView && chats.length) {
        const ids = chats.map(c => c.chat_id);
        const { data: enriched } = await supabase
          .from("v_chats_with_contact")
          .select("chat_id,contact_name")
          .in("chat_id", ids);
        contactById = Object.fromEntries((enriched || []).map(e => [e.chat_id, e]));
      }

      // Categorias por chat — quando NAO veio pela view, busca avulso
      let categoriesByChat = {};
      if (!useCategoryView && chats.length) {
        const ids = chats.map(c => c.chat_id);
        const { data: catRows } = await supabase
          .from("v_chats_with_categories")
          .select("chat_id,category_slugs")
          .in("chat_id", ids);
        categoriesByChat = Object.fromEntries((catRows || []).map(r => [r.chat_id, r.category_slugs || []]));
      } else {
        categoriesByChat = Object.fromEntries(chats.map(c => [c.chat_id, c.category_slugs || []]));
      }

      // Buscar ultima mensagem de cada chat (com id para poder transcrever audios)
      // Usa message_ts (data ORIGINAL da mensagem no WhatsApp), nao created_at (data de insercao no banco)
      const chatIds = chats.map((c) => c.chat_id);
      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("id,chat_id,content,message_type,from_me,message_ts,created_at")
        .in("chat_id", chatIds)
        .order("message_ts", { ascending: false, nullsFirst: false });

      const lastByChat = {};
      for (const m of lastMsgs || []) {
        if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m;
      }

      const lastMsgsList = Object.values(lastByChat);
      const enrichedList = await enrichWithTranscriptions(lastMsgsList);
      const enrichedByChat = Object.fromEntries(enrichedList.map(m => [m.chat_id, m]));

      const result = chats.map((c) => {
        const msg = enrichedByChat[c.chat_id];
        const recv = c.last_received_at ? new Date(c.last_received_at).getTime() : 0;
        const sent = c.last_sent_at ? new Date(c.last_sent_at).getTime() : 0;
        const waiting_on = recv > sent ? "eric" : (sent > recv ? "lead" : "none");
        const enriched = contactById[c.chat_id] || {};
        return {
          chat_id: c.chat_id,
          name: enriched.contact_name || c.contact_name || c.chat_name,
          is_group: c.is_group,
          ...(c.observations && { observations: c.observations }),
          categories: categoriesByChat[c.chat_id] || [],
          last_message_at: c.last_message_at,
          ...(c.last_message_at && { last_message_at_brt: toBRT(c.last_message_at) }),
          last_received_at: c.last_received_at,
          ...(c.last_received_at && { last_received_at_brt: toBRT(c.last_received_at) }),
          last_sent_at: c.last_sent_at,
          ...(c.last_sent_at && { last_sent_at_brt: toBRT(c.last_sent_at) }),
          waiting_on,
          last_message: msg
            ? {
                content: msg.content?.slice(0, 120),
                type: msg.message_type,
                from_me: msg.from_me,
                ...(AUDIO_TYPES.has(msg.message_type) && { transcription: msg.transcription }),
              }
            : null,
        };
      });

      return ok({ chats: result, total: result.length });
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── 2. read ─────────────────────────────────────────────────────────────────
server.tool(
  "read",
  `Le as mensagens de uma conversa especifica.
Use para: "o que o Marcos disse?", "mostra as msgs do grupo G4", "qual foi a ultima msg da Maria?".
O parametro "chat" aceita: nome do contato, nome do grupo, numero de telefone, ou chat_id.
Se o nome for ambiguo, retorna lista de candidatos para voce escolher.
Retorna mensagens em ordem cronologica com conteudo, tipo, remetente e timestamp.
Mensagens de audio incluem campo transcription com o conteudo transcrito automaticamente (requer OPENAI_API_KEY).`,
  {
    chat: z.string().describe("Nome, telefone ou chat_id da conversa"),
    limit: z.number().int().min(1).max(100).default(30).describe("Numero de mensagens (mais recentes)"),
    before: z.string().optional().describe("ISO timestamp — mensagens anteriores a esta data (para paginar)"),
  },
  async ({ chat, limit, before }) => {
    try {
      const resolved = await resolveChat(chat);
      if (resolved.error) return err(resolved.error);
      if (resolved.candidates) {
        return ok({
          ambiguous: true,
          message: `Nome "${chat}" retornou multiplos resultados. Especifique usando um dos chat_id abaixo.`,
          candidates: resolved.candidates.map((c) => ({
            chat_id: c.chat_id,
            name: c.contact_name || c.chat_name,
            is_group: c.is_group,
          })),
        });
      }

      // Expande chat_id via lid_mapping (cobre msgs que chegaram como @lid antes do
      // resolver atual capturar). Mantem chat_id principal pra exibir, mas busca em todos.
      const chatIdSet = await expandChatIdsViaLidMapping(resolved.chat_id);

      let q = supabase
        .from("v_messages_with_sender")
        .select("id,message_type,content,direction,from_me,sender_contact_name,sender_phone,message_ts,created_at")
        .in("chat_id", chatIdSet)
        .order("message_ts", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (before) q = q.lt("message_ts", before);

      const { data, error } = await q;
      if (error) return err(error.message);

      const enriched = await enrichWithTranscriptions(data || []);

      // Categorias + contexto do contato (observations, links)
      const [catResult, chatResult] = await Promise.all([
        supabase.from("v_chats_with_categories")
          .select("category_slugs,category_labels,linked_pipedrive_person_id")
          .eq("chat_id", resolved.chat_id).single(),
        supabase.from("chats")
          .select("observations,links")
          .eq("chat_id", resolved.chat_id).single(),
      ]);
      const catRow = catResult.data;
      const chatMeta = chatResult.data;

      return ok({
        chat_id: resolved.chat_id,
        chat_name: resolved.chat_name,
        ...(chatMeta?.observations && { observations: chatMeta.observations }),
        ...(chatMeta?.links?.length && { links: chatMeta.links }),
        categories: catRow?.category_slugs || [],
        category_labels: catRow?.category_labels || [],
        ...(catRow?.linked_pipedrive_person_id && { linked_pipedrive_person_id: catRow.linked_pipedrive_person_id }),
        messages: withBRT(enriched.reverse()),
        count: enriched.length,
      });
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── 3. send ─────────────────────────────────────────────────────────────────
server.tool(
  "send",
  `Envia mensagem para qualquer contato ou grupo.
Use para: "manda pra Marcos: oi", "envia a imagem X pra Maria", "responde aquela msg dizendo Y".
O parametro "to" aceita nome, telefone ou chat_id (igual ao "read").
Tipos suportados: text (padrao), image, audio, video, document.
Para reply (responder mensagem especifica): passe reply_to com o UUID da mensagem.
Para midia: passe media_url com URL publica do arquivo.

Simulacao de comportamento humano (Z-API delayMessage/delayTyping):
- humanize=true (padrao): calcula automaticamente delay_typing baseado em tamanho+tipo
  do conteudo (ex: texto curto=1s, texto longo=15s, audio=3s "gravando audio").
  Override explicito via delay_typing.
- delay_typing (0-15s): tempo mostrando "Digitando..." / "Gravando audio..." pro destinatario
- delay_message (0-15s): atraso geral antes de enviar (alem do typing)

FLUXO OBRIGATORIO (duas chamadas):
1a chamada — SEM confirmed: mostre ao usuario destinatario + conteudo, aguarde confirmacao. O MCP vai bloquear e retornar o resumo para exibir ao usuario.
2a chamada — COM confirmed: true: so apos o usuario confirmar explicitamente ("sim", "confirma", "pode enviar").`,
  {
    to: z.string().describe("Destinatario: nome, telefone ou chat_id"),
    content: z.string().default("").describe("Texto ou legenda da midia"),
    type: z.enum(["text", "image", "audio", "video", "document"]).default("text"),
    media_url: z.string().url().optional().describe("URL publica da midia (obrigatorio se type != text)"),
    file_name: z.string().optional().describe("Nome do arquivo para type=document (ex: 'proposta.pdf'). Se omitido, usa content como fallback."),
    reply_to: z.string().optional().describe("UUID da mensagem para responder (quote reply)"),
    confirmed: z.boolean().default(false).describe("OBRIGATORIO true para enviar. So passe true apos mostrar destinatario+conteudo ao usuario e receber confirmacao explicita."),
    allow_new: z.boolean().default(false).describe("Se true, permite enviar para numeros que ainda nao existem em chats (primeiro contato). Cria entrada em chats automaticamente. Use para dispatch consciente."),
    humanize: z.boolean().default(true).describe("Se true (padrao), calcula delay_typing automaticamente baseado em tamanho+tipo. Passe false pra desligar simulacao humana."),
    delay_typing: z.number().int().min(0).max(15).optional().describe("Override do delay de digitacao (0-15s). Se passado, ignora humanize."),
    delay_message: z.number().int().min(0).max(15).optional().describe("Atraso geral antes de enviar (0-15s, alem do typing)."),
    mentions: z.array(z.string()).optional().describe("Phones pra mencionar (ex: [\"5511999998888\"]). So funciona em grupos."),
    mentions_everyone: z.boolean().optional().describe("Se true, menciona @todos no grupo."),
  },
  async ({ to, content, type, media_url, file_name, reply_to, confirmed, allow_new, humanize, delay_typing, delay_message, mentions, mentions_everyone }) => {
    if (!confirmed) {
      return {
        content: [{
          type: "text",
          text: [
            "BLOQUEADO: confirmacao pendente.",
            "",
            "Mostre ao usuario:",
            `  Destinatario : ${to}`,
            `  Mensagem     : ${content || "(midia)"}`,
            `  Tipo         : ${type}`,
            ...(media_url ? [`  URL midia    : ${media_url}`] : []),
            "",
            'Apos o usuario confirmar ("sim", "confirma", "pode enviar"), chame novamente com confirmed: true.',
          ].join("\n"),
        }],
        isError: true,
      };
    }

    try {
      let resolved = await resolveChat(to);

      // Se chat nao foi achado, mas to parece phone valido E allow_new=true → cria — fix #3
      if (resolved.error) {
        const digits = to.replace(/\D/g, "");
        const looksLikePhone = digits.length >= 10 && digits.length <= 13;

        if (!allow_new) {
          return err(
            looksLikePhone
              ? `Numero "${to}" nao esta em chats. Se for primeiro contato, passe allow_new=true (junto com confirmed=true).`
              : resolved.error
          );
        }

        if (!looksLikePhone) {
          return err(`allow_new=true so funciona com phone valido (10-13 digitos). Recebido: "${to}".`);
        }

        // Cria chat minimo (will be enriched quando a primeira resposta chegar via webhook)
        const newChatId = digits.startsWith("55") ? digits : `55${digits}`;
        const { error: insErr } = await supabase
          .from("chats")
          .upsert({
            chat_id: newChatId,
            phone: newChatId,
            chat_name: newChatId,
            is_group: false,
            last_message_at: new Date().toISOString(),
          }, { onConflict: "chat_id" });
        if (insErr) return err(`Falha ao criar chat novo: ${insErr.message}`);
        resolved = { chat_id: newChatId, chat_name: newChatId, _new: true };
      }

      if (resolved.candidates) {
        return ok({
          ambiguous: true,
          message: `Nome "${to}" retornou multiplos resultados. Use o chat_id correto.`,
          candidates: resolved.candidates.map((c) => ({
            chat_id: c.chat_id,
            name: c.contact_name || c.chat_name,
          })),
        });
      }

      if (type !== "text" && !media_url) {
        return err(`media_url e obrigatorio para mensagens do tipo "${type}".`);
      }

      // Resolve delay_typing efetivo: explicito > humanize auto > nada
      const effectiveDelayTyping =
        delay_typing !== undefined
          ? delay_typing
          : (humanize ? humanizedTypingSeconds(type, content) : undefined);

      // Passa confirmed=true E agent_name pro server-side guard + audit log (Edge Function v8+)
      const body = {
        chat_id: resolved.chat_id,
        content,
        message_type: type,
        confirmed: true,             // gate cliente ja validou (linha 670+); server-side dobra
        agent_name: AGENT_NAME,      // identifica esta instancia em messages.sent_by_agent_name
        ...(media_url && { media_url }),
        ...(file_name && { file_name }),
        ...(reply_to && { quoted_msg_id: reply_to }),
        ...(effectiveDelayTyping !== undefined && { delay_typing: effectiveDelayTyping }),
        ...(delay_message !== undefined && { delay_message }),
        ...(mentions?.length && { mentions }),
        ...(mentions_everyone && { mentions_everyone: true }),
      };

      const res = await fetch(SEND_MESSAGE_URL, {
        method: "POST",
        headers: serviceHeaders(),
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) return err(result?.error || `HTTP ${res.status}`);

      // Voice guide check — WARNING only, nao bloqueia envio
      let voiceWarning = null;
      if (type === "text" && content) {
        const violations = checkVoiceViolations(content);
        if (violations.length > 0) {
          const guide = findVoiceGuide();
          voiceWarning = {
            voice_guide_violations: violations.length,
            violations: violations.map(v => `[${v.severity}] ${v.id} ("${v.match}"): ${v.message}`),
            voice_guide_loaded: !!guide,
            voice_guide_path: guide?.path,
            note: "Mensagem foi enviada mesmo assim. Pra proxima, considere reescrever respeitando regras hard. Use get_voice_guide() pra ler o documento.",
          };
        } else if (findVoiceGuide()) {
          voiceWarning = {
            voice_guide_check: "passed",
            note: "Mensagem compativel com voice guide.",
          };
        }
      }

      return ok({
        sent: true,
        to: resolved.chat_name,
        ...(resolved._new && { new_chat: true }),
        ...result,
        ...(voiceWarning && { voice: voiceWarning }),
      });
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── 4. search ───────────────────────────────────────────────────────────────
server.tool(
  "search",
  `Busca texto nas mensagens do WhatsApp.
Use para: "vc falou alguma coisa sobre reuniao?", "o que o Pedro disse sobre o contrato?".
Pode filtrar por chat especifico (parametro "chat"), categoria (category_slugs), e periodo (after/before).
Retorna mensagens com contexto: chat de origem, remetente e timestamp.
Mensagens de audio nos resultados incluem campo transcription automaticamente.`,
  {
    query: z.string().min(2).describe("Texto a buscar"),
    chat: z.string().optional().describe("Limitar busca a um chat especifico (nome ou chat_id)"),
    search_in: z.enum(["content", "chat_name", "both"]).default("both").describe("Onde buscar: content (texto das msgs), chat_name (nome do contato/grupo), ou both (default)"),
    category_slugs: z.array(z.string()).optional().describe("Limitar busca a chats com pelo menos uma destas categorias (ex: ['saude','familia'])"),
    exclude_categories: z.array(z.string()).optional().describe("Filtrar fora chats com qualquer uma destas categorias"),
    limit: z.number().int().min(1).max(50).default(20),
    after: z.string().optional().describe("ISO timestamp — so mensagens apos esta data"),
    before: z.string().optional().describe("ISO timestamp — so mensagens antes desta data"),
  },
  async ({ query, chat, search_in, category_slugs, exclude_categories, limit, after, before }) => {
    try {
      let chat_id = null;
      if (chat) {
        const resolved = await resolveChat(chat);
        if (resolved.error) return err(resolved.error);
        if (resolved.candidates) return ok({ ambiguous: true, candidates: resolved.candidates });
        chat_id = resolved.chat_id;
      }

      // Resolve set de chat_ids permitidos quando ha filtro de categoria
      let allowedChatIds = null;
      if (category_slugs?.length || exclude_categories?.length) {
        let cq = supabase.from("v_chats_with_categories").select("chat_id,category_slugs");
        if (category_slugs?.length) cq = cq.overlaps("category_slugs", category_slugs);
        const { data: catChats } = await cq;
        let ids = (catChats || []).map(c => c.chat_id);
        if (exclude_categories?.length) {
          const { data: excluded } = await supabase
            .from("v_chats_with_categories")
            .select("chat_id")
            .overlaps("category_slugs", exclude_categories);
          const excludedSet = new Set((excluded || []).map(e => e.chat_id));
          ids = ids.length
            ? ids.filter(id => !excludedSet.has(id))
            : null; // nada a filtrar se categoria_slugs nao foi passado
          if (!category_slugs?.length) {
            // Apenas exclude — pega todos exceto os excluidos
            const { data: allChats } = await supabase
              .from("v_chats_with_contact").select("chat_id");
            ids = (allChats || []).map(c => c.chat_id).filter(id => !excludedSet.has(id));
          }
        }
        allowedChatIds = ids;
        if (allowedChatIds && allowedChatIds.length === 0) {
          return ok({ query, search_in, chats: [], messages: [], message_count: 0,
            note: "Filtro de categoria nao retornou nenhum chat — sem o que buscar." });
        }
      }

      const result = { query, search_in };

      // Busca em chat_name (contatos/grupos) — fix #9, com scoring v2.2.0
      if (search_in === "chat_name" || search_in === "both") {
        const qNorm = normalize(query);
        let cq = supabase
          .from("v_chats_with_contact")
          .select("chat_id,chat_name,contact_name,is_group,last_message_at,last_received_at")
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .order("chat_id", { ascending: true })
          .limit(1500);
        if (allowedChatIds) cq = cq.in("chat_id", allowedChatIds);
        const { data: chats } = await cq;
        const ranked = (chats || []).map(c => {
          const { score, kind } = scoreNameMatch(qNorm, c);
          return { ...c, _score: score > 0 ? applyChatBoost(score, c) : 0, _kind: kind };
        }).filter(c => c._score > 0)
          .sort((a, b) => b._score - a._score || String(a.chat_id).localeCompare(String(b.chat_id)))
          .slice(0, limit);
        result.chats = ranked.map(c => ({
          chat_id: c.chat_id,
          name: c.contact_name || c.chat_name,
          is_group: c.is_group,
          last_message_at: c.last_message_at,
          last_received_at: c.last_received_at,
          match: c._kind,
        }));
      }

      // Busca em content (mensagens) — comportamento original + filtro de categoria
      if (search_in === "content" || search_in === "both") {
        let q = supabase
          .from("v_messages_with_sender")
          .select("id,chat_id,chat_display_name,chat_is_group,content,message_type,from_me,sender_contact_name,message_ts,created_at,direction")
          .ilike("content", `%${query}%`)
          .order("message_ts", { ascending: false, nullsFirst: false })
          .limit(limit);

        if (chat_id) q = q.eq("chat_id", chat_id);
        if (allowedChatIds) q = q.in("chat_id", allowedChatIds);
        if (after) q = q.gt("message_ts", after);
        if (before) q = q.lt("message_ts", before);

        const { data, error } = await q;
        if (error) return err(error.message);

        const enriched = await enrichWithTranscriptions(data || []);
        result.messages = withBRT(enriched);
        result.message_count = enriched.length;
      }

      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── transcribe_audio ────────────────────────────────────────────────────────
server.tool(
  "transcribe_audio",
  `Forca transcricao de audios antigos que nao foram processados pelo cron automatico
(ex: audios de grupos, audios mais antigos que 29 dias, ou audios que falharam).

Aceita um message_id especifico OU um chat (transcreve ate 20 audios pendentes do chat).
Salva o resultado em messages.content (cache permanente).
Reaproveita a logica do cron transcribe-queue: prefere Supabase Storage, fallback CDN.`,
  {
    message_id: z.string().optional().describe("UUID da mensagem (de read/search). Transcreve so essa."),
    chat: z.string().optional().describe("Nome/phone/chat_id. Transcreve ate 20 audios pendentes desse chat."),
    limit: z.number().int().min(1).max(20).default(20).describe("Maximo de audios por chamada (so com chat). Default 20."),
  },
  async ({ message_id, chat, limit }) => {
    try {
      if (!OPENAI_API_KEY) return err("OPENAI_API_KEY nao configurada — transcricao indisponivel.");
      if (!message_id && !chat) return err("Forneca message_id OU chat.");

      let candidates;
      if (message_id) {
        const { data, error } = await supabase
          .from("messages")
          .select("id,chat_id,message_type,content")
          .eq("id", message_id)
          .single();
        if (error) return err(error.message);
        if (!AUDIO_TYPES.has(data.message_type)) return err(`Mensagem ${message_id} nao e audio (tipo=${data.message_type}).`);
        candidates = [data];
      } else {
        const resolved = await resolveChat(chat);
        if (resolved.error) return err(resolved.error);
        if (resolved.candidates) return ok({ ambiguous: true, candidates: resolved.candidates });
        const { data, error } = await supabase
          .from("messages")
          .select("id,chat_id,message_type,content")
          .eq("chat_id", resolved.chat_id)
          .in("message_type", Array.from(AUDIO_TYPES))
          .or("content.is.null,content.eq.")
          .order("message_ts", { ascending: false, nullsFirst: false })
          .limit(limit);
        if (error) return err(error.message);
        candidates = data || [];
      }

      if (!candidates.length) return ok({ transcribed: 0, skipped: 0, message: "Nenhum audio pendente" });

      const enriched = await enrichWithTranscriptions(candidates);
      const transcribed = enriched.filter(m => m.transcription && !String(m.transcription).startsWith("Erro")).length;
      const failed = enriched.length - transcribed;

      return ok({
        transcribed,
        failed,
        total: enriched.length,
        results: enriched.map(m => ({
          id: m.id,
          chat_id: m.chat_id,
          transcription: m.transcription,
        })),
      });
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── 5. react ────────────────────────────────────────────────────────────────
server.tool(
  "react",
  `Reage a uma mensagem com emoji.
Use para: "reage com joinha naquela msg", "coloca um coracao na ultima mensagem do Marcos".
Precisa do message_id (UUID da tabela messages — obtenha via read ou search).`,
  {
    message_id: z.string().describe("UUID da mensagem (campo id retornado por read/search)"),
    emoji: z.string().describe("Emoji de reacao. Ex: '❤️', '👍', '😂', '🔥'. String vazia remove reacao."),
  },
  async ({ message_id, emoji }) => {
    try {
      if (!ZAPI_BASE) return err("Credenciais Z-API nao configuradas (ZAPI_INSTANCE_ID/ZAPI_TOKEN).");

      const { data: msg, error } = await supabase
        .from("messages")
        .select("provider_msg_id,chat_id")
        .eq("id", message_id)
        .single();

      if (error) return err(error.message);

      const phone = msg.chat_id.replace(/@.*$/, "");
      const res = await fetch(`${ZAPI_BASE}/send-reaction`, {
        method: "POST",
        headers: zapiHeaders(),
        body: JSON.stringify({ phone, messageId: msg.provider_msg_id, reaction: emoji }),
      });

      if (!res.ok) return err(`Z-API ${res.status}: ${await res.text()}`);
      const result = await res.json();
      return ok({ reacted: true, emoji, result });
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── 6. status ───────────────────────────────────────────────────────────────
server.tool(
  "status",
  `Verifica se o WhatsApp esta conectado e funcionando.
Use quando: o usuario pedir status, antes de enviar mensagens importantes, ou ao investigar por que nao chegam msgs.`,
  {},
  async () => {
    try {
      if (!ZAPI_BASE) return err("Credenciais Z-API nao configuradas.");

      const res = await fetch(`${ZAPI_BASE}/status`, { headers: zapiHeaders() });
      const zapiData = res.ok ? await res.json() : { error: `Z-API HTTP ${res.status}` };

      const { data: instance } = await supabase
        .from("zapi_instance")
        .select("webhook_url,is_active,updated_at")
        .limit(1)
        .single();

      const { count: totalMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true });

      const { count: todayMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());

      return ok({
        connected: zapiData?.connected || zapiData?.smartphoneConnected || false,
        zapi: zapiData,
        webhook_active: instance?.is_active,
        transcription_enabled: !!OPENAI_API_KEY,
        stats: { total_messages: totalMessages, messages_last_24h: todayMessages },
      });
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── 7. sync_groups ──────────────────────────────────────────────────────────
server.tool(
  "sync_groups",
  `Sincroniza nomes de grupos do WhatsApp buscando diretamente da Z-API (GET /chats).
Use quando nomes de grupos estiverem faltando ou desatualizados no banco do Supabase.
O webhook da Z-API nem sempre envia chatName para grupos — esta tool corrige isso manualmente.
Retorna: total de grupos encontrados na Z-API, quantos foram atualizados no banco, e quais nao foram encontrados.`,
  {
    dry_run: z.boolean().default(false).describe("Se true, lista o que seria atualizado sem salvar nada no banco"),
  },
  async ({ dry_run }) => {
    try {
      if (!ZAPI_BASE) return err("Credenciais Z-API nao configuradas (ZAPI_INSTANCE_ID/ZAPI_TOKEN).");

      // Busca todos os chats da Z-API
      const res = await fetch(`${ZAPI_BASE}/chats`, { headers: zapiHeaders() });
      if (!res.ok) return err(`Z-API ${res.status}: ${await res.text()}`);

      const raw = await res.json();
      // Z-API pode retornar { value: [...] } ou diretamente array
      const allChats = Array.isArray(raw) ? raw : (raw.value || raw.chats || raw.data || []);

      // Filtra apenas grupos
      const groups = allChats.filter((c) => c.isGroup === true || c.is_group === true || c.type === "group");

      if (!groups.length) {
        return ok({
          message: "Nenhum grupo encontrado na Z-API.",
          total_chats: allChats.length,
          total_groups: 0,
        });
      }

      const updated = [];
      const not_found = [];

      for (const group of groups) {
        // Z-API usa formatos variados para ID e nome do grupo
        const rawPhone = (group.phone || group.id || group.chatId || "").toString();
        const phone = rawPhone.replace(/[^0-9]/g, "");
        const name = group.name || group.chatName || group.subject || group.groupName || null;

        if (!phone || !name) continue;

        if (dry_run) {
          updated.push({ phone, name, dry_run: true });
          continue;
        }

        // chat_id de grupos pode ter formatos diferentes dependendo do provider
        const candidateIds = [
          `${phone}@g.us`,
          `${phone}-group`,
          phone,
          rawPhone,
        ];

        let matched = false;
        for (const chat_id of candidateIds) {
          const { data: rows, error } = await supabase
            .from("chats")
            .update({ chat_name: name })
            .eq("chat_id", chat_id)
            .eq("is_group", true)
            .select("chat_id");

          if (!error && rows?.length > 0) {
            updated.push({ chat_id, name });
            matched = true;
            break;
          }
        }

        if (!matched) {
          not_found.push({ phone, name, reason: "chat_id nao encontrado no banco" });
        }
      }

      return ok({
        total_groups_in_zapi: groups.length,
        updated_count: updated.length,
        not_found_count: not_found.length,
        updated,
        ...(not_found.length > 0 && { not_found }),
        dry_run,
      });
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── CATEGORIES TOOLS ────────────────────────────────────────────────────────

server.tool(
  "list_categories",
  `Lista todas as categorias disponiveis pra classificar chats.
Use antes de chamar categorize_chat pra saber quais slugs sao validos.
Retorna: array de { slug, label, color, description, parent_slug }.

Slugs sao normalizados (lowercase ascii). Eric pode adicionar categorias novas
diretamente no DB ou via tool no futuro — sempre listar primeiro.`,
  {},
  async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id,slug,label,color,description,parent_id,created_at")
        .order("label", { ascending: true });
      if (error) return err(error.message);

      // Resolve parent_slug pro consumidor entender hierarquia sem segundo lookup
      const byId = Object.fromEntries((data || []).map(c => [c.id, c.slug]));
      return ok({
        categories: (data || []).map(c => ({
          slug: c.slug,
          label: c.label,
          color: c.color,
          description: c.description,
          parent_slug: c.parent_id ? byId[c.parent_id] || null : null,
        })),
        total: data?.length || 0,
      });
    } catch (e) {
      return err(e.message);
    }
  }
);

server.tool(
  "categorize_chat",
  `Atribui uma ou mais categorias a um chat. Idempotente: rerun com mesma combinacao
nao falha (ON CONFLICT DO NOTHING).

Use depois de list_categories pra saber slugs validos. Se passar slug invalido
retorna erro com a lista de slugs aceitos.

Param assigned_by indica origem da atribuicao:
- "manual" — Eric atribuiu (default)
- "llm"    — Modelo categorizou; passa confidence (0-1)
- "rule:X" — Regra automatica (futuro)

Multi-valor: 1 chat pode ter varias categorias (ex: cliente + saude pra um plano
de saude que o Eric paga). Slug unico por chat (PK chat_id+category_id).

Retorna: { chat_id, chat_name, applied: [...slugs aplicados], skipped: [...slugs ja existiam] }.`,
  {
    chat: z.string().describe("Nome, telefone ou chat_id da conversa (mesmo formato de read/send)"),
    category_slugs: z.array(z.string()).min(1).describe("Lista de slugs (ex: ['cliente', 'saude']). Use list_categories pra ver opcoes."),
    assigned_by: z.enum(["manual", "llm"]).default("manual"),
    confidence: z.number().min(0).max(1).optional().describe("Obrigatorio quando assigned_by=llm"),
    notes: z.string().optional().describe("Justificativa opcional (especialmente util pra llm)"),
  },
  async ({ chat, category_slugs, assigned_by, confidence, notes }) => {
    try {
      if (assigned_by === "llm" && (confidence === undefined || confidence === null)) {
        return err("confidence e obrigatorio quando assigned_by=llm");
      }

      const resolved = await resolveChat(chat);
      if (resolved.error) return err(resolved.error);
      if (resolved.candidates) {
        return ok({ ambiguous: true, candidates: resolved.candidates });
      }

      // Resolve slugs -> ids; reporta slugs invalidos
      const { data: cats } = await supabase
        .from("categories")
        .select("id,slug")
        .in("slug", category_slugs);

      const validSlugs = new Set((cats || []).map(c => c.slug));
      const invalid = category_slugs.filter(s => !validSlugs.has(s));
      if (invalid.length) {
        const { data: all } = await supabase.from("categories").select("slug").order("slug");
        return err(`Slug(s) invalido(s): ${invalid.join(", ")}. Slugs validos: ${(all||[]).map(c=>c.slug).join(", ")}.`);
      }

      // Quem ja existe? (pra reportar "skipped" honestamente)
      const { data: existing } = await supabase
        .from("chat_categories")
        .select("category_id")
        .eq("chat_id", resolved.chat_id)
        .in("category_id", cats.map(c => c.id));
      const existingIds = new Set((existing || []).map(e => e.category_id));

      const toInsert = cats.filter(c => !existingIds.has(c.id)).map(c => ({
        chat_id: resolved.chat_id,
        category_id: c.id,
        assigned_by,
        ...(confidence !== undefined && { confidence }),
        ...(notes && { notes }),
      }));

      if (toInsert.length) {
        const { error: insErr } = await supabase
          .from("chat_categories")
          .upsert(toInsert, { onConflict: "chat_id,category_id" });
        if (insErr) return err(`Falha ao inserir: ${insErr.message}`);
      }

      const slugById = Object.fromEntries(cats.map(c => [c.id, c.slug]));
      return ok({
        chat_id: resolved.chat_id,
        chat_name: resolved.chat_name,
        applied: toInsert.map(t => slugById[t.category_id]),
        skipped: [...existingIds].map(id => slugById[id]),
      });
    } catch (e) {
      return err(e.message);
    }
  }
);

server.tool(
  "uncategorize_chat",
  `Remove uma ou mais categorias de um chat. Categorias nao atribuidas sao ignoradas
(no-op, nao retorna erro).

Use quando perceber que categorizou errado, ou quando a relacao mudou
(ex: cliente virou ex-cliente).

Retorna: { chat_id, chat_name, removed: [...slugs removidos] }.`,
  {
    chat: z.string().describe("Nome, telefone ou chat_id da conversa"),
    category_slugs: z.array(z.string()).min(1).describe("Slugs a remover"),
  },
  async ({ chat, category_slugs }) => {
    try {
      const resolved = await resolveChat(chat);
      if (resolved.error) return err(resolved.error);
      if (resolved.candidates) {
        return ok({ ambiguous: true, candidates: resolved.candidates });
      }

      const { data: cats } = await supabase
        .from("categories")
        .select("id,slug")
        .in("slug", category_slugs);
      if (!cats?.length) return ok({ chat_id: resolved.chat_id, removed: [] });

      const ids = cats.map(c => c.id);
      const slugById = Object.fromEntries(cats.map(c => [c.id, c.slug]));

      const { data: removed, error: delErr } = await supabase
        .from("chat_categories")
        .delete()
        .eq("chat_id", resolved.chat_id)
        .in("category_id", ids)
        .select("category_id");

      if (delErr) return err(`Falha ao remover: ${delErr.message}`);

      return ok({
        chat_id: resolved.chat_id,
        chat_name: resolved.chat_name,
        removed: (removed || []).map(r => slugById[r.category_id]),
      });
    } catch (e) {
      return err(e.message);
    }
  }
);

// Actions que enviam conteudo visivel para outros — requerem confirmed: true
const ZAPI_SEND_ACTIONS = new Set([
  "send-poll",
  "forward-message",
  "edit-message",
  "send-text",
  "send-message",
]);

// ─── VOICE GUIDE TOOLS ───────────────────────────────────────────────────────

server.tool(
  "get_voice_guide",
  `Retorna o voice guide do user (markdown completo).

O voice guide descreve como o user se comunica — lexico, sintaxe, modulacao por audiencia,
padroes retoricos, anti-padroes — pra que o agente possa simular a voz dele com fidelidade.

Use SEMPRE antes de redigir mensagem em nome do user, simular voz dele, ou avaliar
se um texto soa como ele.

Procura nos paths (em ordem): VOICE_GUIDE_PATH env > ./voice-guide.md > ~/.claude/voice-guide.md
> OneDrive\\Workspace\\claude-sync\\memory\\voice-guide.md > eric-voice.md (legacy seed).

Se nao encontrar, retorna instrucoes pra setup. Cada user tem o proprio voice guide
em sua maquina (single-tenant per install).`,
  {},
  async () => {
    const guide = findVoiceGuide();
    if (!guide) {
      return {
        content: [{
          type: "text",
          text: [
            "VOICE GUIDE NAO ENCONTRADO.",
            "",
            "Pra ativar a checagem de voz nas mensagens, crie um arquivo `voice-guide.md` em UM destes locais:",
            ...VOICE_GUIDE_CANDIDATES.map(p => `  - ${p}`),
            "",
            "Ou defina a env var VOICE_GUIDE_PATH apontando pra qualquer caminho.",
            "",
            "Template inicial: copie `voice-guide-template.md` da pasta deste MCP e personalize.",
            "Pra gerar empiricamente a partir do seu historico de WhatsApp: rode o pipeline em scripts/voice-pipeline/ (ver README).",
          ].join("\n"),
        }],
        isError: false, // nao e erro, so estado de setup pendente
      };
    }
    return {
      content: [{
        type: "text",
        text: [
          `# Voice Guide carregado de: ${guide.path}`,
          "",
          guide.content,
        ].join("\n"),
      }],
    };
  }
);

server.tool(
  "check_message",
  `Verifica se um texto viola alguma regra hard do voice guide do user.

Roda checagem regex contra padroes hard (pronomes, em-dash, hype, saudacoes proibidas,
validacao afetiva, etc) e retorna lista de violacoes detectadas com severidade e sugestao.

Use ANTES de chamar send() pra revisar/reescrever se houver violacoes.
A tool send() ja roda esta checagem internamente — esta tool e pra checar drafts
sem enviar.

Filosofia: warning, nao bloqueio. send() executa mesmo com violacoes mas inclui aviso.
Cabe a Claude decidir reescrever ou prosseguir consciente.`,
  {
    content: z.string().describe("Texto a verificar"),
  },
  async ({ content }) => {
    const violations = checkVoiceViolations(content);
    if (violations.length === 0) {
      return ok({
        ok: true,
        violations_count: 0,
        message: "Nenhuma violacao hard detectada. Texto compativel com voice guide.",
      });
    }
    const guide = findVoiceGuide();
    return ok({
      ok: false,
      violations_count: violations.length,
      violations,
      voice_guide_loaded: !!guide,
      voice_guide_path: guide?.path,
      hint: "Use get_voice_guide() pra ler o documento completo e reescrever respeitando as regras hard.",
    });
  }
);

server.tool(
  "setup_voice_guide",
  `Mostra status atual do voice guide e instrucoes pra setup.

Use quando o user perguntar "como ativo a checagem de voz", "tem voice guide configurado?",
ou quando get_voice_guide() retornar setup pendente.`,
  {},
  async () => {
    const guide = findVoiceGuide();
    const lines = ["=== Voice Guide Setup ==="];
    if (guide) {
      lines.push(`Status: ATIVO`);
      lines.push(`Path: ${guide.path}`);
      lines.push(`Tamanho: ${guide.content.length} chars / ${guide.content.split("\n").length} linhas`);
      lines.push("");
      lines.push("Cada send() vai rodar checagem regex contra as regras hard e incluir warning no retorno se detectar violacao.");
      lines.push("Pra validar um draft sem enviar, use check_message(content).");
    } else {
      lines.push(`Status: NAO CONFIGURADO`);
      lines.push("");
      lines.push("Paths procurados (em ordem):");
      VOICE_GUIDE_CANDIDATES.forEach(p => lines.push(`  - ${p}`));
      lines.push("");
      lines.push("Pra ativar:");
      lines.push("  1. Crie arquivo voice-guide.md em qualquer um dos paths acima");
      lines.push("  2. Ou defina VOICE_GUIDE_PATH no env apontando pro arquivo");
      lines.push("  3. Reinicie o MCP (Claude Code: /mcp restart whatsapp-agent)");
      lines.push("");
      lines.push("Template inicial disponivel em voice-guide-template.md na pasta do MCP.");
    }
    lines.push("");
    lines.push("Regras hard ativas (regex bloqueio nivel WARNING — send executa mesmo com violacao):");
    HARD_RULES.forEach(r => lines.push(`  - [${r.severity}] ${r.id}: ${r.message.split(".")[0]}`));
    return ok({ status: guide ? "active" : "not_configured", info: lines.join("\n") });
  }
);

// ─── 8. zapi_action ──────────────────────────────────────────────────────────
server.tool(
  "zapi_action",
  `Executa qualquer acao avancada da Z-API diretamente.
Use quando as tools acima nao cobrirem o caso (operacoes infrequentes).

Para acoes que enviam conteudo (send-poll, forward-message, edit-message):
  - confirmed: false (padrao): MCP bloqueia e retorna resumo para exibir ao usuario.
  - confirmed: true: so apos confirmacao explicita do usuario.
  Acoes de leitura/config nao precisam de confirmed.

Actions disponiveis e seus params:
- mark-read: { phone } — marca todas mensagens do chat como lidas
- delete-message: { phone, messageId, owner } — deleta mensagem (owner: true=minha, false=de outro)
- edit-message: { phone, messageId, newMessage } — edita mensagem de texto enviada por voce  [REQUER confirmed]
- send-poll: { phone, question, options: string[], selectableCount } — envia enquete  [REQUER confirmed]
- forward-message: { phone, messageId, forwardPhone } — encaminha mensagem  [REQUER confirmed]
- send-reaction: { phone, messageId, reaction } — reage com emoji (nao requer confirmed)
- block-contact: { phone } — bloqueia contato
- unblock-contact: { phone } — desbloqueia contato
- get-contact-info: { phone } — info do contato (nome, foto, status do WhatsApp)
- create-group: { groupName, phones: string[] } — cria grupo
- add-participant: { groupId, phone } — adiciona membro ao grupo
- remove-participant: { groupId, phone } — remove membro do grupo
- promote-participant: { groupId, phone } — promove a admin
- demote-participant: { groupId, phone } — rebaixa de admin

Para "phone": usar apenas digitos sem + (ex: "5511999998888").
Para "messageId": usar provider_msg_id da tabela messages (nao o UUID interno).`,
  {
    action: z.string().describe("Nome do endpoint Z-API (ex: mark-read, delete-message, send-poll)"),
    params: z.record(z.unknown()).describe("Parametros da action conforme documentacao acima"),
    confirmed: z.boolean().default(false).describe("Obrigatorio true para actions de envio (send-poll, forward-message, edit-message). So passe true apos confirmacao explicita do usuario."),
  },
  async ({ action, params, confirmed }) => {
    if (ZAPI_SEND_ACTIONS.has(action) && !confirmed) {
      return {
        content: [{
          type: "text",
          text: [
            `BLOQUEADO: a action "${action}" envia conteudo e requer confirmacao do usuario.`,
            "",
            "Mostre ao usuario o que sera enviado (action + parametros) e aguarde confirmacao.",
            'Apos "sim", "confirma" ou equivalente, chame novamente com confirmed: true.',
          ].join("\n"),
        }],
        isError: true,
      };
    }

    try {
      if (!ZAPI_BASE) return err("Credenciais Z-API nao configuradas.");

      const res = await fetch(`${ZAPI_BASE}/${action}`, {
        method: "POST",
        headers: zapiHeaders(),
        body: JSON.stringify(params),
      });

      const text = await res.text();
      let result;
      try { result = JSON.parse(text); } catch { result = text; }

      if (!res.ok) return err(`Z-API ${res.status}: ${text}`);
      return ok({ ok: true, action, result });
    } catch (e) {
      return err(e.message);
    }
  }
);

// ─── START ───────────────────────────────────────────────────────────────────


// ─── 9. annotate_chat ────────────────────────────────────────────────────────
server.tool(
  "annotate_chat",
  `Salva observacoes e/ou links sobre um contato ou grupo.
Use para: "anota que o Marcos so responde audio", "salva o LinkedIn da Maria", "esse lead nao lê texto".
observations: texto livre com contexto do contato (exibido no read e inbox automaticamente).
links: array de {label, url} com links relevantes (LinkedIn, proposta, etc).
Passe so o campo que quer atualizar — o outro permanece inalterado.`,
  {
    chat: z.string().describe("Nome, telefone ou chat_id do contato"),
    observations: z.string().optional().describe("Texto livre com contexto do contato. Ex: 'So responde audio. Cliente desde 2023.'"),
    links: z.array(z.object({
      label: z.string().describe("Rotulo do link. Ex: LinkedIn, Proposta, Site"),
      url: z.string().url().describe("URL completa"),
    })).optional().describe("Links relevantes do contato"),
  },
  async ({ chat, observations, links }) => {
    if (!observations && !links) return err("Passe ao menos observations ou links.");
    try {
      const resolved = await resolveChat(chat);
      if (resolved.error) return err(resolved.error);
      if (resolved.candidates) return ok({
        ambiguous: true,
        message: `Nome "${chat}" retornou multiplos resultados. Use o chat_id correto.`,
        candidates: resolved.candidates.map(c => ({ chat_id: c.chat_id, name: c.contact_name || c.chat_name })),
      });

      const update = {};
      if (observations !== undefined) update.observations = observations;
      if (links !== undefined) update.links = links;

      const { error } = await supabase.from("chats").update(update).eq("chat_id", resolved.chat_id);
      if (error) return err(error.message);

      return ok({ annotated: true, chat_id: resolved.chat_id, chat_name: resolved.chat_name, ...update });
    } catch (e) { return err(e.message); }
  }
);

// ─── 10. edit_message ─────────────────────────────────────────────────────────
server.tool(
  "edit_message",
  `Edita o texto de uma mensagem enviada por voce.
Use para: "corrige aquela msg que mandei pro Marcos", "edita a ultima mensagem que enviei".
Precisa do message_id (UUID da tabela messages) — obtenha via read ou search.
Funciona apenas em mensagens de texto enviadas por voce (from_me=true).`,
  {
    message_id: z.string().describe("UUID da mensagem (campo id retornado por read/search)"),
    new_content: z.string().describe("Novo texto da mensagem"),
    confirmed: z.boolean().default(false).describe("Obrigatorio true para editar. So passe true apos confirmacao explicita do usuario."),
  },
  async ({ message_id, new_content, confirmed }) => {
    if (!confirmed) {
      return {
        content: [{ type: "text", text: [
          "BLOQUEADO: confirmacao pendente.",
          "",
          "Mostre ao usuario:",
          `  Mensagem ID: ${message_id}`,
          `  Novo texto : ${new_content}`,
          "",
          'Apos confirmacao, chame novamente com confirmed: true.',
        ].join("\n") }],
        isError: true,
      };
    }
    try {
      if (!ZAPI_BASE) return err("Credenciais Z-API nao configuradas.");
      const { data: msg, error } = await supabase
        .from("messages")
        .select("provider_msg_id,chat_id,from_me")
        .eq("id", message_id)
        .single();
      if (error || !msg) return err(error?.message || "Mensagem nao encontrada.");
      if (!msg.from_me) return err("Nao e possivel editar mensagens de outros contatos.");
      const phone = msg.chat_id.replace(/@.*$/, "");
      const res = await fetch(`${ZAPI_BASE}/edit-message`, {
        method: "POST",
        headers: zapiHeaders(),
        body: JSON.stringify({ phone, messageId: msg.provider_msg_id, newMessage: new_content }),
      });
      if (!res.ok) return err(`Z-API ${res.status}: ${await res.text()}`);
      await supabase.from("messages").update({ content: new_content, is_edited: true }).eq("id", message_id);
      return ok({ edited: true, message_id, new_content });
    } catch (e) { return err(e.message); }
  }
);

// ─── 10. delete_message ──────────────────────────────────────────────────────
server.tool(
  "delete_message",
  `Deleta uma mensagem enviada por voce (apaga para todos).
Use para: "apaga aquela msg que mandei", "deleta a ultima mensagem para o Marcos".
Precisa do message_id (UUID da tabela messages) — obtenha via read ou search.`,
  {
    message_id: z.string().describe("UUID da mensagem (campo id retornado por read/search)"),
    confirmed: z.boolean().default(false).describe("Obrigatorio true para deletar. So passe true apos confirmacao explicita do usuario."),
  },
  async ({ message_id, confirmed }) => {
    if (!confirmed) {
      return {
        content: [{ type: "text", text: [
          "BLOQUEADO: confirmacao pendente.",
          "",
          `  Mensagem ID: ${message_id}`,
          "",
          'Apos confirmacao, chame novamente com confirmed: true.',
        ].join("\n") }],
        isError: true,
      };
    }
    try {
      if (!ZAPI_BASE) return err("Credenciais Z-API nao configuradas.");
      const { data: msg, error } = await supabase
        .from("messages")
        .select("provider_msg_id,chat_id,from_me")
        .eq("id", message_id)
        .single();
      if (error || !msg) return err(error?.message || "Mensagem nao encontrada.");
      const phone = msg.chat_id.replace(/@.*$/, "");
      const res = await fetch(`${ZAPI_BASE}/delete-message`, {
        method: "POST",
        headers: zapiHeaders(),
        body: JSON.stringify({ phone, messageId: msg.provider_msg_id, owner: !!msg.from_me }),
      });
      if (!res.ok) return err(`Z-API ${res.status}: ${await res.text()}`);
      await supabase.from("messages").update({ is_deleted: true }).eq("id", message_id);
      return ok({ deleted: true, message_id });
    } catch (e) { return err(e.message); }
  }
);

// ─── 11. download_attachment ─────────────────────────────────────────────────
server.tool(
  "download_attachment",
  `Retorna a URL publica de uma midia (imagem, audio, video, documento) salva no Storage.
Use para: "me mostra o PDF que o Marcos mandou", "qual o link da foto da Maria".
Precisa do message_id (UUID da tabela messages) — obtenha via read ou search.
Retorna URL do Supabase Storage (permanente) ou original_url (CDN temporaria Z-API como fallback).`,
  {
    message_id: z.string().describe("UUID da mensagem (campo id retornado por read/search)"),
  },
  async ({ message_id }) => {
    try {
      const { data: media, error } = await supabase
        .from("message_media")
        .select("storage_bucket,storage_path,original_url,mime_type,file_size_bytes,download_status,download_error")
        .eq("message_id", message_id)
        .single();
      if (error || !media) return err("Nenhuma midia associada a esta mensagem.");
      let public_url = null;
      if (media.storage_path && media.download_status === "done") {
        const { data } = supabase.storage.from(media.storage_bucket).getPublicUrl(media.storage_path);
        public_url = data?.publicUrl ?? null;
      }
      return ok({
        public_url,
        original_url: media.original_url,
        mime_type: media.mime_type,
        file_size_bytes: media.file_size_bytes,
        download_status: media.download_status,
        ...(media.download_status !== "done" && { note: "Arquivo ainda nao baixado pro Storage. Usando original_url (pode expirar)." }),
        ...(media.download_error && { download_error: media.download_error }),
      });
    } catch (e) { return err(e.message); }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
