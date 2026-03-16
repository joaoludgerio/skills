import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium } from "playwright";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────

const CHATGURU_MODE = (process.env.CHATGURU_MODE || "full").toLowerCase();
const API_KEY = process.env.CHATGURU_API_KEY;
const ACCOUNT_ID = process.env.CHATGURU_ACCOUNT_ID;
const PHONE_ID = process.env.CHATGURU_PHONE_ID;
const SERVER = process.env.CHATGURU_SERVER;
const BASE_URL = SERVER ? `https://s${SERVER}.expertintegrado.app/api/v1` : "";

if (CHATGURU_MODE !== "readonly") {
  if (!API_KEY || !ACCOUNT_ID || !PHONE_ID || !SERVER) {
    console.error(
      "ERRO: Variáveis de ambiente obrigatórias não definidas.\n" +
      "Defina: CHATGURU_API_KEY, CHATGURU_ACCOUNT_ID, CHATGURU_PHONE_ID, CHATGURU_SERVER\n" +
      "Ou use CHATGURU_MODE=readonly para modo somente leitura (Playwright)."
    );
    process.exit(1);
  }
} else {
  if (!SERVER) {
    console.error("ERRO: CHATGURU_SERVER é obrigatório mesmo no modo readonly.");
    process.exit(1);
  }
}

// Caminho do session.json relativo a este arquivo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSION_PATH = join(__dirname, "session.json");

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

function friendlyError(status, defaultMsg) {
  const messages = {
    401: "Chave de API inválida. Verifique a variável CHATGURU_API_KEY.",
    403: "Sem permissão para acessar este recurso no ChatGuru.",
    404: "Recurso não encontrado no ChatGuru.",
    429: "Limite de requisições atingido. Tente novamente em alguns segundos.",
    500: "Erro interno do servidor ChatGuru. Tente novamente.",
    502: "ChatGuru temporariamente indisponível. Tente novamente.",
    503: "ChatGuru em manutenção. Tente novamente em instantes.",
  };
  return messages[status] || defaultMsg || `Erro ${status} na API do ChatGuru.`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normaliza número de telefone para formato DDI+DDD+NÚMERO (somente dígitos).
 * Aceita: +55 (81) 91095702, 55 81 9109-5702, 81991095702, 5581991095702
 */
function normalizePhone(input) {
  // Remove tudo que não é dígito
  let digits = input.replace(/\D/g, "");

  // Se começa com 55 e tem 12-13 dígitos, já está normalizado
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }

  // Se tem 10-11 dígitos (DDD + número), adiciona DDI 55
  if (digits.length >= 10 && digits.length <= 11) {
    return "55" + digits;
  }

  // Retorna como está (pode ser número internacional não-BR)
  return digits;
}

/**
 * Faz requisição à API do ChatGuru com retry automático.
 * Body é form-encoded (application/x-www-form-urlencoded), NÃO JSON.
 */
async function chatguruRequest(action, params = {}, { retries = 3, paramsInUrl = false } = {}) {
  const urlParams = new URLSearchParams({
    key: API_KEY,
    account_id: ACCOUNT_ID,
    phone_id: PHONE_ID,
    action: action,
  });

  let body = "";
  if (paramsInUrl) {
    // Enviar todos os params na query string (ex: chat_update_custom_fields)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) urlParams.append(key, String(value));
    }
  } else {
    // Enviar params no body (padrão para a maioria dos endpoints)
    const bodyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) bodyParams.append(key, String(value));
    }
    body = bodyParams.toString();
  }

  const url = `${BASE_URL}?${urlParams.toString()}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (err) {
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.error(`[ChatGuru] Erro de rede (tentativa ${attempt}/${retries}): ${err.message}. Retry em ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw new Error(`Erro de conexão com ChatGuru após ${retries} tentativas: ${err.message}`);
    }

    if (!response.ok && RETRYABLE_STATUSES.includes(response.status) && attempt < retries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      console.error(`[ChatGuru] HTTP ${response.status} (tentativa ${attempt}/${retries}). Retry em ${delay}ms...`);
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      throw new Error(friendlyError(response.status));
    }

    const data = await response.json();
    if (data.success === false) {
      throw new Error(data.error || data.message || "Erro desconhecido na API do ChatGuru.");
    }
    return data;
  }
}

// ─── MCP SERVER ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "chatguru-mcp",
  version: "1.0.0",
});

// ─── TOOLS API (apenas no modo full) ────────────────────────────────────────

if (CHATGURU_MODE !== "readonly") {

// ─── TOOL 1: ENVIAR MENSAGEM ────────────────────────────────────────────────

server.tool(
  "chatguru_send_message",
  "Envia mensagem de texto via WhatsApp pelo ChatGuru. Suporta agendamento opcional.",
  {
    chat_number: z.string().describe("Número do telefone com DDI (ex: 5581991095702). Aceita formatos variados."),
    text: z.string().describe("Texto da mensagem a enviar"),
    send_date: z.string().optional().describe("Data/hora para agendamento (YYYY-MM-DD HH:MM). Se omitido, envia imediatamente."),
  },
  async ({ chat_number, text, send_date }) => {
    const number = normalizePhone(chat_number);
    const params = { chat_number: number, text };
    if (send_date) params.send_date = send_date;
    const data = await chatguruRequest("message_send", params);
    let msg = `Mensagem enviada para ${number}.`;
    if (data.message_id) msg += ` ID: ${data.message_id}`;
    if (send_date) msg += ` (agendada para ${send_date})`;
    return { content: [{ type: "text", text: msg }] };
  }
);

// ─── TOOL 2: ENVIAR ARQUIVO ─────────────────────────────────────────────────

server.tool(
  "chatguru_send_file",
  "Envia arquivo (imagem, PDF, documento) via URL pelo ChatGuru.",
  {
    chat_number: z.string().describe("Número do telefone com DDI (ex: 5581991095702)"),
    file_url: z.string().describe("URL pública do arquivo a enviar"),
    caption: z.string().optional().describe("Legenda do arquivo (opcional)"),
  },
  async ({ chat_number, file_url, caption }) => {
    const number = normalizePhone(chat_number);
    const params = { chat_number: number, file_url };
    if (caption) params.caption = caption;
    const data = await chatguruRequest("message_file_send", params);
    let msg = `Arquivo enviado para ${number}.`;
    if (data.message_id) msg += ` ID: ${data.message_id}`;
    return { content: [{ type: "text", text: msg }] };
  }
);

// ─── TOOL 3: STATUS DA MENSAGEM ─────────────────────────────────────────────

server.tool(
  "chatguru_get_message_status",
  "Consulta o status de entrega de uma mensagem enviada pelo ChatGuru.",
  {
    message_id: z.string().describe("ID da mensagem retornado pelo envio"),
  },
  async ({ message_id }) => {
    const data = await chatguruRequest("message_status", { message_id });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ─── TOOL 4: REGISTRAR CHAT ─────────────────────────────────────────────────

server.tool(
  "chatguru_register_chat",
  "Registra um novo contato no ChatGuru (operação assíncrona). Retorna chat_add_id (hash interno). Use chatguru_get_chat_status para acompanhar.",
  {
    chat_number: z.string().describe("Número do telefone com DDI (ex: 5581991095702)"),
    name: z.string().describe("Nome do contato a registrar"),
    text: z.string().describe("Mensagem inicial a enviar (obrigatório pela API)"),
    user_id: z.string().optional().describe("ID do usuário/atendente (opcional)"),
    dialog_id: z.string().optional().describe("ID do diálogo/fluxo a executar após registro (opcional)"),
  },
  async ({ chat_number, name, text, user_id, dialog_id }) => {
    const number = normalizePhone(chat_number);
    const params = { chat_number: number, name, text };
    if (user_id) params.user_id = user_id;
    if (dialog_id) params.dialog_id = dialog_id;
    const data = await chatguruRequest("chat_add", params);
    let msg = `Chat registrado para ${number} (${name}).`;
    if (data.chat_add_id) {
      msg += ` chat_add_id: ${data.chat_add_id}`;
      msg += `\nLink: https://s${SERVER}.expertintegrado.app/chats#${data.chat_add_id}`;
    }
    msg += "\nStatus: operação assíncrona. Use chatguru_get_chat_status para acompanhar.";
    return { content: [{ type: "text", text: msg }] };
  }
);

// ─── TOOL 5: STATUS DO REGISTRO ─────────────────────────────────────────────

server.tool(
  "chatguru_get_chat_status",
  "Verifica o status do registro de um chat no ChatGuru. Retorna: pending, fetched, done ou error. Quando done, inclui link do chat.",
  {
    chat_add_id: z.string().describe("ID retornado pelo chatguru_register_chat ou chatguru_get_chat_link (ex: 699ce2eab27ac598c766e752)"),
  },
  async ({ chat_add_id }) => {
    const data = await chatguruRequest("chat_add_status", { chat_add_id });
    let msg = `Status: ${data.chat_add_status || "desconhecido"}`;
    msg += `\nchat_add_id: ${chat_add_id}`;
    msg += `\nLink: https://s${SERVER}.expertintegrado.app/chats#${chat_add_id}`;
    if (data.chat_add_status_description) msg += `\nDescrição: ${data.chat_add_status_description}`;
    return { content: [{ type: "text", text: msg }] };
  }
);

// ─── TOOL 6: ATUALIZAR CAMPOS CUSTOMIZADOS ──────────────────────────────────

server.tool(
  "chatguru_update_custom_fields",
  "Atualiza campos customizados de um chat no ChatGuru. Passe os campos como JSON string.",
  {
    chat_number: z.string().describe("Número do telefone com DDI (ex: 5581991095702)"),
    custom_fields: z.string().describe('JSON string com campos a atualizar. Ex: {"campo1": "valor1", "campo2": "valor2"}'),
  },
  async ({ chat_number, custom_fields }) => {
    const number = normalizePhone(chat_number);
    // Validar que é JSON válido
    let fields;
    try {
      fields = JSON.parse(custom_fields);
    } catch {
      return { content: [{ type: "text", text: "Erro: custom_fields deve ser um JSON válido." }] };
    }
    // API espera cada campo como field__VARIAVEL=valor na query string (não no body)
    // Variáveis conforme cadastro: Nome, Email, Instagram, Empresa, Dores, CRM__Link_negocio, etc.
    const params = { chat_number: number };
    for (const [key, value] of Object.entries(fields)) {
      params[`field__${key}`] = value;
    }
    const data = await chatguruRequest("chat_update_custom_fields", params, { paramsInUrl: true });
    return { content: [{ type: "text", text: `Campos customizados atualizados para ${number}: ${Object.keys(fields).join(", ")}` }] };
  }
);

// ─── TOOL 7: ATUALIZAR NOME DO CHAT ─────────────────────────────────────────

server.tool(
  "chatguru_update_chat_name",
  "Atualiza o nome de um contato no ChatGuru.",
  {
    chat_number: z.string().describe("Número do telefone com DDI (ex: 5581991095702)"),
    name: z.string().describe("Novo nome do contato"),
  },
  async ({ chat_number, name }) => {
    const number = normalizePhone(chat_number);
    await chatguruRequest("chat_update_name", { chat_number: number, name });
    return { content: [{ type: "text", text: `Nome do chat ${number} atualizado para "${name}".` }] };
  }
);

// ─── TOOL 8: ATUALIZAR CONTEXTO ─────────────────────────────────────────────

server.tool(
  "chatguru_update_context",
  "Atualiza o contexto de um chat no ChatGuru (dados livres sobre a conversa).",
  {
    chat_number: z.string().describe("Número do telefone com DDI (ex: 5581991095702)"),
    context: z.string().describe("Texto do contexto a definir"),
  },
  async ({ chat_number, context }) => {
    const number = normalizePhone(chat_number);
    await chatguruRequest("chat_update_context", { chat_number: number, context });
    return { content: [{ type: "text", text: `Contexto do chat ${number} atualizado.` }] };
  }
);

// ─── TOOL 9: ADICIONAR NOTA ─────────────────────────────────────────────────

server.tool(
  "chatguru_add_note",
  "Adiciona uma anotação interna a um chat no ChatGuru (visível apenas para a equipe).",
  {
    chat_number: z.string().describe("Número do telefone com DDI (ex: 5581991095702)"),
    note_text: z.string().describe("Texto da nota interna"),
  },
  async ({ chat_number, note_text }) => {
    const number = normalizePhone(chat_number);
    await chatguruRequest("note_add", { chat_number: number, note_text });
    return { content: [{ type: "text", text: `Nota adicionada ao chat ${number}.` }] };
  }
);

// ─── TOOL 10: EXECUTAR DIÁLOGO ──────────────────────────────────────────────

server.tool(
  "chatguru_execute_dialog",
  "Dispara um fluxo de automação/diálogo do chatbot em uma conversa existente no ChatGuru.",
  {
    chat_number: z.string().describe("Número do telefone com DDI (ex: 5581991095702)"),
    dialog_id: z.string().describe("ID do diálogo/fluxo a executar"),
  },
  async ({ chat_number, dialog_id }) => {
    const number = normalizePhone(chat_number);
    await chatguruRequest("dialog_execute", { chat_number: number, dialog_id });
    return { content: [{ type: "text", text: `Diálogo ${dialog_id} executado no chat ${number}.` }] };
  }
);

} // fim do bloco CHATGURU_MODE !== "readonly"

// ─── TOOLS PLAYWRIGHT (disponíveis em todos os modos) ───────────────────────

// ─── HELPER: ABRIR BROWSER COM SESSÃO ────────────────────────────────────────

async function openBrowserWithSession() {
  if (!existsSync(SESSION_PATH)) {
    return { error: `Sessão não encontrada. Execute \`CHATGURU_SERVER=${SERVER} node login.js\` para fazer login.` };
  }
  const storageState = JSON.parse(await readFile(SESSION_PATH, "utf-8"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState, permissions: ["notifications"] });
  const page = await context.newPage();
  return { browser, context, page };
}

function isLoginPage(url) {
  return url.includes("login") || url.includes("signin") || url.endsWith("/");
}

/**
 * Seleciona o aparelho (device) no dropdown do painel ChatGuru.
 * @param {import('playwright').Page} page
 * @param {string} deviceName - Nome do aparelho (ex: "Expert Integrado")
 */
async function selectDevice(page, deviceName) {
  const sel = await page.$("select");
  if (!sel) return;
  const options = await sel.$$("option");
  for (const opt of options) {
    const text = await opt.textContent();
    if (text && text.toLowerCase().includes(deviceName.toLowerCase())) {
      const value = await opt.getAttribute("value");
      await sel.selectOption(value);
      await sleep(2000);
      return;
    }
  }
}

/**
 * Ativa o filtro de chats arquivados (FECHADO/RESOLVIDO).
 * Usa o seletor correto: .list__single__filter.archived input[type='checkbox']
 * @param {import('playwright').Page} page
 */
async function enableArchivedFilter(page) {
  const cb = await page.$(".list__single__filter.archived input[type='checkbox']");
  if (cb) {
    const isChecked = await cb.isChecked();
    if (!isChecked) {
      await cb.click();
      await sleep(2000);
    }
  }
}

/**
 * Gera variantes de busca para um número de telefone.
 * O ChatGuru aceita formatos variados, então tentamos múltiplos.
 * Retorna array de strings únicas para tentar na busca.
 */
function phoneSearchVariants(input) {
  const digits = input.replace(/\D/g, "");
  const variants = new Set();

  // 1) Número completo sem formatação
  variants.add(digits);

  // 2) Sem DDI brasileiro (55)
  if (digits.startsWith("55") && digits.length >= 12) {
    variants.add(digits.substring(2)); // DDD + número
  }

  // 3) Sem DDI argentino (549) / panamenho (507) / outros
  if (digits.startsWith("549") && digits.length >= 12) {
    variants.add(digits.substring(3));
  }
  if (digits.startsWith("507") && digits.length >= 11) {
    variants.add(digits.substring(3));
  }

  // 4) Últimos 8 dígitos (formato antigo BR sem nono dígito)
  if (digits.length >= 8) {
    variants.add(digits.slice(-8));
  }

  // 5) Últimos 9 dígitos (formato novo BR com nono dígito)
  if (digits.length >= 9) {
    variants.add(digits.slice(-9));
  }

  return [...variants];
}

/**
 * Busca um chat pelo telefone no painel já aberto, tentando múltiplos formatos.
 * Retorna { chat_id, link } ou null se não encontrado.
 * @param {import('playwright').Page} page
 * @param {string} phoneRaw - Número original do telefone
 */
async function searchChatByPhone(page, phoneRaw) {
  const variants = phoneSearchVariants(phoneRaw);

  for (const variant of variants) {
    const phoneInput = await page.waitForSelector("#inChatsWhatsappNum", { timeout: 10000 });
    await phoneInput.fill("");
    await sleep(300);
    await phoneInput.fill(variant);
    await page.keyboard.press("Enter");
    await sleep(3500);

    const chatItem = await page.$(".list__user-card");
    if (chatItem) {
      await chatItem.click();
      await sleep(2000);

      const currentUrl = page.url();
      const hashMatch = currentUrl.match(/#([a-f0-9]{24})/);
      if (hashMatch) {
        const chatId = hashMatch[1];
        const link = `https://s${SERVER}.expertintegrado.app/chats#${chatId}`;
        return { chat_id: chatId, link, matched_variant: variant };
      }
    }
  }

  return null;
}

// ─── TOOL 11: BUSCAR CHAT POR TELEFONE (PLAYWRIGHT) ─────────────────────────

server.tool(
  "chatguru_get_chat_link",
  "Busca um contato existente no ChatGuru pelo número de telefone via Playwright (web scraping). Tenta múltiplos formatos de número automaticamente. Retorna chat_id e link direto. NÃO envia mensagem. Requer session.json (execute login.js primeiro). Latência: 10-30s.",
  {
    chat_number: z.string().describe("Número do telefone para buscar (ex: 5511996647492, +55 11 96647-492, 96647492). Aceita formatos variados — a busca tenta múltiplas variantes automaticamente."),
    device: z.string().optional().default("Expert Integrado").describe("Nome do aparelho/dispositivo no ChatGuru (padrão: 'Expert Integrado'). Use string vazia para não filtrar."),
    archived: z.boolean().optional().default(true).describe("Incluir chats arquivados/fechados na busca (padrão: true)."),
  },
  async ({ chat_number, device, archived }) => {
    const session = await openBrowserWithSession();
    if (session.error) return { content: [{ type: "text", text: session.error }] };

    const { browser, page } = session;
    try {
      const panelUrl = `https://s${SERVER}.expertintegrado.app/chats`;
      await page.goto(panelUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(5000);

      if (isLoginPage(page.url())) {
        await browser.close();
        return { content: [{ type: "text", text: `Sessão expirada. Execute \`CHATGURU_SERVER=${SERVER} node login.js\` para renovar.` }] };
      }

      // Selecionar aparelho
      if (device) {
        await selectDevice(page, device);
      }

      // Ativar filtro de arquivados
      if (archived) {
        await enableArchivedFilter(page);
      }

      // Buscar chat tentando múltiplos formatos
      const result = await searchChatByPhone(page, chat_number);
      await browser.close();

      if (result) {
        return { content: [{ type: "text", text: `Chat encontrado!\nchat_id: ${result.chat_id}\nLink: ${result.link}\nFormato que encontrou: ${result.matched_variant}` }] };
      }

      const variants = phoneSearchVariants(chat_number);
      return { content: [{ type: "text", text: `Nenhum chat encontrado para ${chat_number}.\nFormatos tentados: ${variants.join(", ")}\nO contato pode não existir no ChatGuru${device ? ` no aparelho "${device}"` : ""}.` }] };
    } catch (err) {
      await browser.close().catch(() => {});
      return { content: [{ type: "text", text: `Erro ao buscar chat: ${err.message}` }] };
    }
  }
);

// ─── TOOL 11B: BUSCAR CHAT EM LOTE (PLAYWRIGHT) ─────────────────────────────

server.tool(
  "chatguru_batch_get_chat_links",
  "Busca múltiplos contatos no ChatGuru de uma vez via Playwright. Abre UMA sessão de browser e processa todos os números sequencialmente (muito mais rápido que chamar get_chat_link N vezes). Retorna lista com chat_id e link para cada contato encontrado. Latência: ~8s por contato.",
  {
    contacts: z.array(z.object({
      id: z.string().describe("Identificador externo do contato (ex: person_id do Pipedrive). Retornado no resultado para facilitar cruzamento."),
      phone: z.string().describe("Número do telefone para buscar. Aceita formatos variados."),
      name: z.string().optional().describe("Nome do contato (apenas para referência no resultado)."),
    })).describe("Lista de contatos para buscar. Máximo 50 por chamada."),
    device: z.string().optional().default("Expert Integrado").describe("Nome do aparelho/dispositivo no ChatGuru (padrão: 'Expert Integrado')."),
    archived: z.boolean().optional().default(true).describe("Incluir chats arquivados/fechados na busca (padrão: true)."),
  },
  async ({ contacts, device, archived }) => {
    if (contacts.length > 50) {
      return { content: [{ type: "text", text: "Máximo 50 contatos por chamada. Divida em lotes menores." }] };
    }

    const session = await openBrowserWithSession();
    if (session.error) return { content: [{ type: "text", text: session.error }] };

    const { browser, page } = session;
    const results = [];

    try {
      const panelUrl = `https://s${SERVER}.expertintegrado.app/chats`;
      await page.goto(panelUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(5000);

      if (isLoginPage(page.url())) {
        await browser.close();
        return { content: [{ type: "text", text: `Sessão expirada. Execute \`CHATGURU_SERVER=${SERVER} node login.js\` para renovar.` }] };
      }

      // Configurar filtros uma única vez
      if (device) await selectDevice(page, device);
      if (archived) await enableArchivedFilter(page);

      for (const contact of contacts) {
        const result = await searchChatByPhone(page, contact.phone);

        if (result) {
          results.push({
            id: contact.id,
            name: contact.name || "",
            phone: contact.phone,
            status: "ENCONTRADO",
            chat_id: result.chat_id,
            link: result.link,
            matched_variant: result.matched_variant,
          });
        } else {
          results.push({
            id: contact.id,
            name: contact.name || "",
            phone: contact.phone,
            status: "NAO_ENCONTRADO",
            chat_id: null,
            link: null,
          });
        }

        // Navegar de volta para a lista e reconfigurar filtros
        await page.goto(panelUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(3000);
        if (device) await selectDevice(page, device);
        if (archived) await enableArchivedFilter(page);
      }

      await browser.close();

      const found = results.filter(r => r.status === "ENCONTRADO");
      const notFound = results.filter(r => r.status === "NAO_ENCONTRADO");

      let summary = `Processados: ${results.length} | Encontrados: ${found.length} | Não encontrados: ${notFound.length}\n\n`;

      if (found.length > 0) {
        summary += "ENCONTRADOS:\n";
        for (const r of found) {
          summary += `  ${r.name || r.id} -> ${r.link} (formato: ${r.matched_variant})\n`;
        }
      }

      if (notFound.length > 0) {
        summary += "\nNÃO ENCONTRADOS:\n";
        for (const r of notFound) {
          summary += `  ${r.name || r.id} (${r.phone})\n`;
        }
      }

      summary += "\n\nJSON:\n" + JSON.stringify(results);

      return { content: [{ type: "text", text: summary }] };
    } catch (err) {
      await browser.close().catch(() => {});
      // Retornar resultados parciais se houver
      if (results.length > 0) {
        return { content: [{ type: "text", text: `Erro após processar ${results.length} contatos: ${err.message}\nResultados parciais:\n${JSON.stringify(results)}` }] };
      }
      return { content: [{ type: "text", text: `Erro ao processar lote: ${err.message}` }] };
    }
  }
);

// ─── TOOL 12: LER MENSAGENS (PLAYWRIGHT) ────────────────────────────────────

server.tool(
  "chatguru_read_messages",
  "Lê o histórico de mensagens de um chat no ChatGuru via Playwright (web scraping). Requer session.json válido (execute login.js primeiro). Latência: 5-15s.",
  {
    chat_id: z.string().describe("ID do chat (hash, ex: 686ede5b2333cb755c57d1a5). Obtido via chatguru_get_chat_link ou chatguru_get_chat_status."),
    limit: z.number().optional().default(50).describe("Quantidade máxima de mensagens a retornar (padrão: 50)"),
  },
  async ({ chat_id, limit }) => {
    const session = await openBrowserWithSession();
    if (session.error) return { content: [{ type: "text", text: session.error }] };

    const { browser, page } = session;
    try {
      const chatUrl = `https://s${SERVER}.expertintegrado.app/chats#${chat_id}`;
      await page.goto(chatUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(5000); // Aguardar SPA carregar (WebSocket mantém networkidle ativo)

      // Verificar se sessão expirou
      if (isLoginPage(page.url())) {
        await browser.close();
        return { content: [{ type: "text", text: `Sessão expirada. Execute \`CHATGURU_SERVER=${SERVER} node login.js\` para renovar.` }] };
      }

      // Aguardar container de mensagens carregar
      await page.waitForSelector("#chat_messages_app", { timeout: 15000 }).catch(() => null);
      await sleep(2000); // Aguardar mensagens renderizarem

      // Remover modais que possam bloquear scroll
      await page.evaluate(() => {
        const beamer = document.querySelector("#beamerPushModal");
        if (beamer) beamer.remove();
        document.querySelectorAll(".modal.show, .modal.active, [role='dialog'].active").forEach(el => el.remove());
        document.querySelectorAll(".modal-backdrop, .push-overlay").forEach(el => el.remove());
      });

      // Scroll para CIMA para carregar mais mensagens (mouse.wheel real)
      let msgCountBefore = 0;
      for (let scrollAttempt = 0; scrollAttempt < 10; scrollAttempt++) {
        const currentCount = await page.evaluate(() => document.querySelectorAll(".row_msg").length);
        if (currentCount >= limit) break;
        if (currentCount === msgCountBefore && scrollAttempt > 1) break;
        msgCountBefore = currentCount;

        await page.evaluate(() => {
          const beamer = document.querySelector("#beamerPushModal");
          if (beamer) beamer.remove();
          document.querySelectorAll(".modal-backdrop, .push-overlay").forEach(el => el.remove());
        });

        const chatContainer = await page.$("#chat_messages_app");
        if (chatContainer) {
          const box = await chatContainer.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + 50);
            await page.mouse.wheel(0, -3000);
          }
        }
        await sleep(2500);
      }

      // Extrair mensagens do DOM (pega as últimas N)
      const messages = await page.evaluate((maxMessages) => {
        let currentDate = "";
        const container = document.querySelector("#chat_messages_app > div");
        if (!container) return [];

        const allMsgs = [];
        for (const child of container.children) {
          if (child.classList.contains("msg-data")) {
            currentDate = child.textContent.trim();
            continue;
          }
          if (!child.classList.contains("row_msg")) continue;

          const msgContainer = child.querySelector(".msg-container");
          if (!msgContainer) continue;

          const isOutgoing = msgContainer.classList.contains("bg-sent-msg");
          const remetente = isOutgoing ? "atendente" : "cliente";
          const textEl = msgContainer.querySelector("span.msg-contentT");
          const texto = textEl?.innerText?.trim() || "";

          if (!texto) {
            const audioEl = msgContainer.querySelector("audio");
            if (audioEl) {
              const timeEl = msgContainer.querySelector("span.msg-timestamp");
              allMsgs.push({ remetente, horario: timeEl?.textContent?.trim() || "", data: currentDate, texto: "[Áudio]" });
            }
            continue;
          }

          const timeEl = msgContainer.querySelector("span.msg-timestamp");
          allMsgs.push({ remetente, horario: timeEl?.textContent?.trim() || "", data: currentDate, texto });
        }

        return allMsgs.slice(-maxMessages);
      }, limit);

      await browser.close();

      if (messages.length === 0) {
        return {
          content: [{ type: "text", text: `Nenhuma mensagem encontrada no chat ${chat_id}. O chat pode estar vazio ou a estrutura da página mudou.` }],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(messages, null, 2) }],
      };
    } catch (err) {
      await browser.close().catch(() => {});
      return { content: [{ type: "text", text: `Erro ao ler mensagens: ${err.message}` }] };
    }
  }
);

// ─── TOOL 13: LISTAR CHATS COM FILTROS (PLAYWRIGHT) ─────────────────────────

server.tool(
  "chatguru_list_chats",
  "Lista e filtra chats do painel ChatGuru via Playwright. Permite filtrar por status (ABERTO, EM ATENDIMENTO, AGUARDANDO, RESOLVIDO, FECHADO), não lidas, arquivados, favoritos, departamento, nome e número. Retorna lista com nome, status, última mensagem, timestamp e contagem de não lidas. Máximo 100 resultados. Latência: 10-20s.",
  {
    status: z.enum(["ABERTO", "EM ATENDIMENTO", "AGUARDANDO", "RESOLVIDO", "FECHADO", "INDEFINIDO"])
      .optional()
      .describe("Filtrar por status do chat."),
    unread_only: z.boolean().optional().default(false)
      .describe("Se true, mostra apenas chats com mensagens não lidas."),
    archived: z.boolean().optional().default(false)
      .describe("Se true, inclui chats arquivados (FECHADO/RESOLVIDO)."),
    favorited: z.boolean().optional().default(false)
      .describe("Se true, mostra apenas chats favoritados."),
    order_by: z.enum(["-updated", "updated", "-created", "created", "-new_messages", "new_messages", "-date_last_message", "date_last_message"])
      .optional()
      .describe("Ordenação. Padrão: -updated (mais recentes). Use -new_messages para ordenar por não lidas."),
    department: z.string().optional()
      .describe("Nome do departamento/usuário (ex: 'Super SDR', 'Vendas', 'Eric Luciano')."),
    name: z.string().optional()
      .describe("Filtrar por nome do contato (busca parcial)."),
    whatsapp_number: z.string().optional()
      .describe("Filtrar por número WhatsApp (ex: 5581991095702)."),
    limit: z.number().optional().default(50)
      .describe("Máximo de chats a retornar (padrão: 50, máximo: 100)."),
  },
  async ({ status, unread_only, archived, favorited, order_by, department, name, whatsapp_number, limit }) => {
    const effectiveLimit = Math.min(limit, 100);
    const session = await openBrowserWithSession();
    if (session.error) return { content: [{ type: "text", text: session.error }] };

    const { browser, page } = session;
    try {
      const panelUrl = `https://s${SERVER}.expertintegrado.app/chats`;
      await page.goto(panelUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(5000);

      if (isLoginPage(page.url())) {
        await browser.close();
        return { content: [{ type: "text", text: `Sessão expirada. Execute \`CHATGURU_SERVER=${SERVER} node login.js\` para renovar.` }] };
      }

      // Remover modais (Beamer push, etc.)
      await page.evaluate(() => {
        const beamer = document.querySelector("#beamerPushModal");
        if (beamer) beamer.remove();
        document.querySelectorAll(".modal.show, .modal.active, [role='dialog'].active").forEach(el => el.remove());
        document.querySelectorAll(".modal-backdrop, .push-overlay").forEach(el => el.remove());
      });

      // ── Aplicar filtros ──

      // Nome
      if (name) {
        const nameInput = await page.$("#inChatsName");
        if (nameInput) {
          await nameInput.fill(name);
          await page.keyboard.press("Enter");
          await sleep(2000);
        }
      }

      // Número WhatsApp
      if (whatsapp_number) {
        const phoneInput = await page.$("#inChatsWhatsappNum");
        if (phoneInput) {
          await phoneInput.fill(normalizePhone(whatsapp_number));
          await page.keyboard.press("Enter");
          await sleep(2000);
        }
      }

      // Status
      if (status) {
        await page.selectOption("#selChatsStatus", status).catch(() => {});
        await sleep(2000);
      }

      // Ordenação
      if (order_by) {
        await page.selectOption("#selChatsOrder", order_by).catch(() => {});
        await sleep(2000);
      }

      // Toggle: Não lidas
      if (unread_only) {
        const unreadCb = await page.$(".list__single__filter.unread input[type='checkbox']");
        if (unreadCb) { await unreadCb.click(); await sleep(2000); }
      }

      // Toggle: Arquivados
      if (archived) {
        const archivedCb = await page.$(".list__single__filter.archived input[type='checkbox']");
        if (archivedCb) { await archivedCb.click(); await sleep(2000); }
      }

      // Toggle: Favoritos
      if (favorited) {
        const favCb = await page.$(".list__single__filter.favorited input[type='checkbox']");
        if (favCb) { await favCb.click(); await sleep(2000); }
      }

      // Departamento (busca checkbox por label dentro da seção de departamentos)
      if (department) {
        await page.evaluate((deptName) => {
          // Procura em todos os labels visíveis de checkbox
          const allLabels = document.querySelectorAll("label");
          for (const label of allLabels) {
            const text = label.textContent?.trim();
            if (text && text.toLowerCase() === deptName.toLowerCase()) {
              const cb = label.querySelector("input[type='checkbox']");
              if (cb) { cb.click(); return; }
            }
          }
          // Fallback: busca parcial
          for (const label of allLabels) {
            const text = label.textContent?.trim();
            if (text && text.toLowerCase().includes(deptName.toLowerCase())) {
              const cb = label.querySelector("input[type='checkbox']");
              if (cb) { cb.click(); return; }
            }
          }
        }, department);
        await sleep(2000);
      }

      // Aguardar lista estabilizar
      await sleep(1000);

      // ── Scroll para carregar cards lazy-loaded ──
      await page.evaluate(async (targetCount) => {
        const container = document.querySelector(".list__user-cards")
          || document.querySelector(".list__container")
          || document.querySelector("[class*='chat-list']");
        if (!container) return;
        let prevCount = 0;
        for (let i = 0; i < 10; i++) {
          const cards = document.querySelectorAll(".list__user-card");
          if (cards.length >= targetCount || cards.length === prevCount) break;
          prevCount = cards.length;
          container.scrollTop = container.scrollHeight;
          await new Promise(r => setTimeout(r, 800));
        }
      }, effectiveLimit);
      await sleep(1000);

      // ── Extrair dados dos chat cards ──
      const chats = await page.evaluate((maxChats) => {
        const result = [];
        const cards = document.querySelectorAll(".list__user-card");

        for (const card of cards) {
          if (result.length >= maxChats) break;

          // Nome do contato
          const nameEl = card.querySelector(".user-name");
          const contactName = nameEl?.textContent?.trim() || "";

          // Prévia da última mensagem (texto completo no atributo title)
          const msgEl = card.querySelector(".user-msg span[title]");
          const lastMessage = msgEl?.getAttribute("title") || msgEl?.textContent?.trim() || "";

          // Status (span.attendance__status com texto ABERTO/AGUARDANDO/EM ATENDI/etc)
          const statusEl = card.querySelector("span.attendance__status");
          let chatStatus = statusEl?.textContent?.trim() || "";
          if (chatStatus === "EM ATENDI") chatStatus = "EM ATENDIMENTO";

          // Contagem de não lidas (span.attendance__number)
          const unreadEl = card.querySelector("span.attendance__number");
          const unreadCount = unreadEl ? parseInt(unreadEl.textContent.trim(), 10) || 0 : 0;

          // Timestamp (.attendance__hour span)
          const timeEl = card.querySelector(".attendance__hour span");
          const timestamp = timeEl?.textContent?.trim() || "";

          // chat_id: tentar extrair do Vue component data ou data attributes
          let chatId = "";
          chatId = card.getAttribute("data-id")
            || card.getAttribute("data-chat-id")
            || card.getAttribute("data-chat")
            || "";

          if (!chatId) {
            try {
              const vue = card.__vue__;
              if (vue) {
                chatId = vue.chat?._id || vue.chat?.id || vue.$props?.chatId || vue.$props?.chat?._id || "";
              }
            } catch (e) { /* ignore */ }
          }

          result.push({
            contact_name: contactName,
            status: chatStatus,
            last_message: lastMessage,
            timestamp,
            unread_count: unreadCount,
            chat_id: chatId,
          });
        }

        return result;
      }, effectiveLimit);

      await browser.close();

      if (chats.length === 0) {
        return { content: [{ type: "text", text: "Nenhum chat encontrado com os filtros aplicados." }] };
      }

      // Resumo dos filtros aplicados
      const filtersApplied = [];
      if (status) filtersApplied.push(`status=${status}`);
      if (name) filtersApplied.push(`nome="${name}"`);
      if (whatsapp_number) filtersApplied.push(`numero=${whatsapp_number}`);
      if (unread_only) filtersApplied.push("apenas_nao_lidas");
      if (archived) filtersApplied.push("arquivados");
      if (favorited) filtersApplied.push("favoritos");
      if (department) filtersApplied.push(`departamento="${department}"`);
      if (order_by) filtersApplied.push(`ordenacao=${order_by}`);

      const summary = `Encontrados ${chats.length} chat(s)${filtersApplied.length ? ` (filtros: ${filtersApplied.join(", ")})` : ""}.`;

      return {
        content: [{ type: "text", text: summary + "\n\n" + JSON.stringify(chats, null, 2) }],
      };
    } catch (err) {
      await browser.close().catch(() => {});
      return { content: [{ type: "text", text: `Erro ao listar chats: ${err.message}` }] };
    }
  }
);

// ─── START ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
