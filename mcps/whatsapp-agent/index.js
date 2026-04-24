import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ZAPI_BASE = ZAPI_INSTANCE_ID && ZAPI_TOKEN
  ? `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`
  : null;

const SEND_MESSAGE_URL = `${SUPABASE_URL}/functions/v1/send-message`;

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

/**
 * Normaliza string para busca: remove acentos e converte pra minusculo.
 */
function normalize(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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
    const threshold = Math.max(2, Math.floor(ip.length * 0.3));
    return nameParts.some((np) => levenshtein(ip, np) <= threshold);
  });
}

/**
 * Resolve "to" (nome, telefone ou chat_id) para chat_id.
 * Retorna { chat_id, chat_name } ou { candidates } se ambiguo.
 */
async function resolveChat(to) {
  // Ja e um chat_id valido (contem @ ou termina em -group)
  if (to.includes("@") || to.endsWith("-group")) {
    return { chat_id: to, chat_name: to };
  }

  // So digitos: pode ser chat_id numerico ou telefone
  const digits = to.replace(/\D/g, "");
  if (digits.length >= 8) {
    // Tenta como chat_id direto primeiro
    const { data: byId } = await supabase
      .from("chats")
      .select("chat_id,chat_name")
      .eq("chat_id", digits)
      .limit(1);
    if (byId?.length) return { chat_id: byId[0].chat_id, chat_name: byId[0].chat_name };

    // Tenta como telefone no campo phone
    const { data: byPhone } = await supabase
      .from("chats")
      .select("chat_id,chat_name,phone")
      .ilike("phone", `%${digits}%`)
      .limit(3);
    if (byPhone?.length === 1) return { chat_id: byPhone[0].chat_id, chat_name: byPhone[0].chat_name };
    if (byPhone?.length > 1) return { candidates: byPhone };
  }

  // Busca por nome — tenta primeiro com o texto original, depois normalizado (sem acento)
  const toNorm = normalize(to);
  const { data: all } = await supabase
    .from("v_chats_with_contact")
    .select("chat_id,chat_name,contact_name,is_group")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (!all?.length) return { error: `Nenhum chat encontrado para "${to}"` };

  const matches = all.filter((c) => {
    const name = normalize(c.chat_name || "");
    const contact = normalize(c.contact_name || "");
    return name.includes(toNorm) || contact.includes(toNorm);
  });

  if (!matches.length) {
    // Fallback fuzzy: Levenshtein por palavra quando includes() nao encontra
    const fuzzy = all.filter((c) => {
      const name = normalize(c.chat_name || "");
      const contact = normalize(c.contact_name || "");
      return fuzzyMatch(toNorm, name) || fuzzyMatch(toNorm, contact);
    });
    if (!fuzzy.length) return { error: `Nenhum chat encontrado para "${to}"` };
    if (fuzzy.length === 1) return { chat_id: fuzzy[0].chat_id, chat_name: fuzzy[0].chat_name || fuzzy[0].contact_name };
    return { candidates: fuzzy };
  }
  if (matches.length === 1) return { chat_id: matches[0].chat_id, chat_name: matches[0].chat_name || matches[0].contact_name };
  return { candidates: matches };
}

// ─── SERVER ──────────────────────────────────────────────────────────────────

const server = new McpServer({ name: "whatsapp-agent", version: "2.0.0" });

// ─── 1. inbox ────────────────────────────────────────────────────────────────
server.tool(
  "inbox",
  `Mostra as conversas recentes do WhatsApp com as ultimas mensagens de cada uma.
Use para: "quem me mandou mensagem?", "tem msg nao lida?", "o que tem no WhatsApp?".
Parametros opcionais: limit (padrao 15), unread_only (so nao lidos), since (ISO timestamp).
Retorna: lista de chats com nome do contato, ultima msg, timestamp, contagem nao lidos.`,
  {
    limit: z.number().int().min(1).max(50).default(15),
    unread_only: z.boolean().default(false).describe("Se true, retorna apenas chats com mensagens nao lidas"),
    since: z.string().optional().describe("ISO timestamp — so chats com atividade apos esta data"),
  },
  async ({ limit, unread_only, since }) => {
    try {
      let q = supabase
        .from("v_chats_with_contact")
        .select("chat_id,chat_name,contact_name,is_group,last_message_at")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (unread_only) q = q.gt("unread_count", 0);
      if (since) q = q.gt("last_message_at", since);

      const { data: chats, error } = await q;
      if (error) return err(error.message);

      // Buscar ultima mensagem de cada chat
      const chatIds = (chats || []).map((c) => c.chat_id);
      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("chat_id,content,message_type,from_me,created_at")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false });

      const lastByChat = {};
      for (const m of lastMsgs || []) {
        if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m;
      }

      const result = (chats || []).map((c) => ({
        chat_id: c.chat_id,
        name: c.contact_name || c.chat_name,
        is_group: c.is_group,
        unread: c.unread_count || 0,
        last_message_at: c.last_message_at,
        last_message: lastByChat[c.chat_id]
          ? {
              content: lastByChat[c.chat_id].content?.slice(0, 120),
              type: lastByChat[c.chat_id].message_type,
              from_me: lastByChat[c.chat_id].from_me,
            }
          : null,
      }));

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
Retorna mensagens em ordem cronologica com conteudo, tipo, remetente e timestamp.`,
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

      let q = supabase
        .from("v_messages_with_sender")
        .select("id,message_type,content,direction,from_me,sender_contact_name,sender_phone,created_at")
        .eq("chat_id", resolved.chat_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (before) q = q.lt("created_at", before);

      const { data, error } = await q;
      if (error) return err(error.message);

      return ok({
        chat_id: resolved.chat_id,
        chat_name: resolved.chat_name,
        messages: (data || []).reverse(),
        count: data?.length || 0,
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

FLUXO OBRIGATORIO (duas chamadas):
1a chamada — SEM confirmed: mostre ao usuario destinatario + conteudo, aguarde confirmacao. O MCP vai bloquear e retornar o resumo para exibir ao usuario.
2a chamada — COM confirmed: true: so apos o usuario confirmar explicitamente ("sim", "confirma", "pode enviar").`,
  {
    to: z.string().describe("Destinatario: nome, telefone ou chat_id"),
    content: z.string().default("").describe("Texto ou legenda da midia"),
    type: z.enum(["text", "image", "audio", "video", "document"]).default("text"),
    media_url: z.string().url().optional().describe("URL publica da midia (obrigatorio se type != text)"),
    reply_to: z.string().optional().describe("UUID da mensagem para responder (quote reply)"),
    confirmed: z.boolean().default(false).describe("OBRIGATORIO true para enviar. So passe true apos mostrar destinatario+conteudo ao usuario e receber confirmacao explicita."),
  },
  async ({ to, content, type, media_url, reply_to, confirmed }) => {
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
      const resolved = await resolveChat(to);
      if (resolved.error) return err(resolved.error);
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

      const body = {
        chat_id: resolved.chat_id,
        content,
        message_type: type,
        ...(media_url && { media_url }),
        ...(reply_to && { quoted_msg_id: reply_to }),
      };

      const res = await fetch(SEND_MESSAGE_URL, {
        method: "POST",
        headers: serviceHeaders(),
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) return err(result?.error || `HTTP ${res.status}`);
      return ok({ sent: true, to: resolved.chat_name, ...result });
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
Pode filtrar por chat especifico (parametro "chat") e por periodo (after/before).
Retorna mensagens com contexto: chat de origem, remetente e timestamp.`,
  {
    query: z.string().min(2).describe("Texto a buscar nas mensagens"),
    chat: z.string().optional().describe("Limitar busca a um chat especifico (nome ou chat_id)"),
    limit: z.number().int().min(1).max(50).default(20),
    after: z.string().optional().describe("ISO timestamp — so mensagens apos esta data"),
    before: z.string().optional().describe("ISO timestamp — so mensagens antes desta data"),
  },
  async ({ query, chat, limit, after, before }) => {
    try {
      let chat_id = null;
      if (chat) {
        const resolved = await resolveChat(chat);
        if (resolved.error) return err(resolved.error);
        if (resolved.candidates) return ok({ ambiguous: true, candidates: resolved.candidates });
        chat_id = resolved.chat_id;
      }

      let q = supabase
        .from("v_messages_with_sender")
        .select("id,chat_id,chat_display_name,chat_is_group,content,message_type,from_me,sender_contact_name,created_at,direction")
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (chat_id) q = q.eq("chat_id", chat_id);
      if (after) q = q.gt("created_at", after);
      if (before) q = q.lt("created_at", before);

      const { data, error } = await q;
      if (error) return err(error.message);
      return ok({ results: data, count: data?.length || 0, query });
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

// Actions que enviam conteudo visivel para outros — requerem confirmed: true
const ZAPI_SEND_ACTIONS = new Set([
  "send-poll",
  "forward-message",
  "edit-message",
  "send-text",
  "send-message",
]);

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

const transport = new StdioServerTransport();
await server.connect(transport);
