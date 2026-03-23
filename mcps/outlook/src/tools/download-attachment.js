/**
 * download-attachment.js — Ferramenta MCP para baixar anexos de e-mails do Outlook
 */

import { z } from "zod";
import { graphRequestPaginated } from "../graph.js";
import fs from "fs";
import path from "path";
import os from "os";

// Importa getAccessToken indiretamente via graph.js — precisamos do token raw
import { PublicClientApplication } from "@azure/msal-node";
import { CLIENT_ID, AUTHORITY, SCOPES, GRAPH_BASE, TOKEN_CACHE_PATH, buildCachePlugin } from "../config.js";

let _pca = null;
function getPca() {
  if (!_pca) {
    _pca = new PublicClientApplication({
      auth: { clientId: CLIENT_ID, authority: AUTHORITY },
      cache: { cachePlugin: buildCachePlugin() },
    });
  }
  return _pca;
}

async function getAccessToken() {
  const pca = getPca();
  const tokenCache = pca.getTokenCache();
  const serialized = fs.readFileSync(TOKEN_CACHE_PATH, "utf-8");
  tokenCache.deserialize(serialized);
  const accounts = await tokenCache.getAllAccounts();
  if (!accounts || accounts.length === 0) throw new Error("Nenhuma conta encontrada. Execute: node auth.js");
  const response = await pca.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] });
  return response.accessToken;
}

export const downloadAttachmentSchema = z.object({
  email_id: z
    .string()
    .describe("ID do e-mail (retornado por ler_emails quando tem anexo)"),
  salvar_em: z
    .string()
    .optional()
    .describe("Pasta onde salvar os anexos. Padrão: pasta Downloads do usuário"),
});

export async function downloadAttachment(params) {
  const { email_id, salvar_em } = params;

  // Listar anexos do email
  const token = await getAccessToken();
  const url = `${GRAPH_BASE}/me/messages/${email_id}/attachments`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao buscar anexos: ${response.status} — ${error}`);
  }

  const result = await response.json();
  const attachments = result.value || [];

  if (attachments.length === 0) {
    return "Este e-mail não possui anexos.";
  }

  // Pasta de destino
  const destino = salvar_em || path.join(os.homedir(), "Downloads");
  if (!fs.existsSync(destino)) {
    fs.mkdirSync(destino, { recursive: true });
  }

  const baixados = [];

  for (const att of attachments) {
    if (att["@odata.type"] === "#microsoft.graph.itemAttachment") {
      baixados.push(`⏭ ${att.name} (item anexado — não é arquivo, pulado)`);
      continue;
    }

    if (!att.contentBytes) {
      baixados.push(`⏭ ${att.name} (sem conteúdo disponível)`);
      continue;
    }

    // Decodificar base64 e salvar
    const buffer = Buffer.from(att.contentBytes, "base64");
    const nomeArquivo = att.name || `anexo_${Date.now()}`;
    const caminhoFinal = path.join(destino, nomeArquivo);

    fs.writeFileSync(caminhoFinal, buffer);
    const tamanhoKB = (buffer.length / 1024).toFixed(1);
    baixados.push(`${nomeArquivo} (${tamanhoKB} KB) → ${caminhoFinal}`);
  }

  return `Anexos do e-mail:\n${baixados.join("\n")}`;
}
