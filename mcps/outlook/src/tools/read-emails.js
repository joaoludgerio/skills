/**
 * read-emails.js — Ferramenta MCP para ler e-mails via Outlook
 */

import { z } from "zod";
import { graphRequestPaginated } from "../graph.js";

export const readEmailsSchema = z.object({
  pasta: z
    .string()
    .optional()
    .default("inbox")
    .describe("Pasta a ler: 'inbox' (caixa de entrada), 'sentitems' (enviados), 'drafts' (rascunhos). Padrão: inbox"),
  quantidade: z
    .number()
    .optional()
    .default(20)
    .describe("Número de e-mails a retornar. Padrão: 20. Máximo: 200"),
  apenas_nao_lidos: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se true, retorna apenas e-mails não lidos. Padrão: false"),
  busca: z
    .string()
    .optional()
    .describe("Texto para filtrar e-mails por assunto ou remetente"),
  data_inicio: z
    .string()
    .optional()
    .describe("Data inicial para filtrar e-mails (formato YYYY-MM-DD). Ex: 2026-01-01"),
  data_fim: z
    .string()
    .optional()
    .describe("Data final para filtrar e-mails (formato YYYY-MM-DD). Ex: 2026-02-28"),
});

export async function readEmails(params) {
  const { pasta, quantidade, apenas_nao_lidos, busca, data_inicio, data_fim } = params;

  const top = Math.min(quantidade, 200);

  // Montar filtros
  let searchQuery = "";
  let filterParts = [];
  let orderbyQuery = "&$orderby=receivedDateTime desc";

  // Filtro de data — incompatível com $search, avisar se combinados
  if (busca && (data_inicio || data_fim)) {
    throw new Error(
      "Não é possível combinar 'busca' com 'data_inicio'/'data_fim'. " +
      "Use busca de texto OU filtro de data, não os dois ao mesmo tempo."
    );
  }

  if (data_inicio || data_fim) {
    const inicio = data_inicio
      ? new Date(`${data_inicio}T00:00:00-03:00`).toISOString()
      : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const fim = data_fim
      ? new Date(`${data_fim}T23:59:59-03:00`).toISOString()
      : new Date().toISOString();
    filterParts.push(`receivedDateTime ge datetime('${inicio}') and receivedDateTime le datetime('${fim}')`);
  }

  if (busca) {
    // $search não é compatível com $filter ou $orderby
    searchQuery = `&$search=${encodeURIComponent(`"${busca}"`)}`;
    orderbyQuery = "";
    filterParts = [];
  } else {
    if (apenas_nao_lidos) {
      filterParts.push("isRead eq false");
      orderbyQuery = ""; // evita InefficientFilter
    }
  }

  const filterQuery = filterParts.length > 0
    ? `&$filter=${encodeURIComponent(filterParts.join(" and "))}`
    : "";

  const endpoint = `/me/mailFolders/${pasta}/messages?$top=${top}${orderbyQuery}&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,bodyPreview,body,hasAttachments${filterQuery}${searchQuery}`;

  const result = await graphRequestPaginated(endpoint, top);

  if (!result || !result.value || result.value.length === 0) {
    return "Nenhum e-mail encontrado.";
  }

  // Extrai texto plano do body HTML — remove tags, decodifica entidades, limpa espaços
  function stripHtml(html) {
    if (!html) return "";
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  const emails = result.value.map((msg, i) => {
    const de = msg.from?.emailAddress?.name
      ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`
      : msg.from?.emailAddress?.address || "Desconhecido";
    const data = new Date(msg.receivedDateTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const lido = msg.isRead ? "✓" : "●";

    // Destinatários (Para e CC)
    const para = (msg.toRecipients || [])
      .map(r => r.emailAddress?.name && r.emailAddress.name !== r.emailAddress.address
        ? `${r.emailAddress.name} <${r.emailAddress.address}>`
        : r.emailAddress?.address || "")
      .filter(Boolean);
    const paraStr = para.length > 0 ? `\n   Para: ${para.join(", ")}` : "";

    const cc = (msg.ccRecipients || [])
      .map(r => r.emailAddress?.name && r.emailAddress.name !== r.emailAddress.address
        ? `${r.emailAddress.name} <${r.emailAddress.address}>`
        : r.emailAddress?.address || "")
      .filter(Boolean);
    const ccStr = cc.length > 0 ? `\n   CC: ${cc.join(", ")}` : "";

    // Indicador de anexos
    const anexoStr = msg.hasAttachments ? `\n   Anexos: sim (use o ID ${msg.id} para baixar)` : "";

    // Usa corpo completo (text/plain via stripHtml) com limite de 2000 chars
    const bodyContent = msg.body?.content
      ? stripHtml(msg.body.content).substring(0, 2000)
      : msg.bodyPreview?.substring(0, 200) || "";

    return `${i + 1}. [${lido}] ${msg.subject || "(sem assunto)"}\n   De: ${de}${paraStr}${ccStr}\n   Data: ${data}${anexoStr}\n   ${bodyContent}`;
  });

  const titulo = `E-mails (${pasta}) — ${emails.length} encontrado(s):\n${"─".repeat(50)}\n`;
  return titulo + emails.join("\n\n");
}
