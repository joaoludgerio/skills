#!/usr/bin/env node

/**
 * Expert MCPs — Setup Interativo
 *
 * Guia o usuario na instalacao dos MCPs da Expert Integrado.
 * Permite escolher quais MCPs instalar, coleta credenciais e
 * configura automaticamente o Claude Code (claude_desktop_config.json).
 *
 * Uso: node setup.js
 */

import { createInterface } from "readline";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Definicao dos MCPs ─────────────────────────────────────────────────────

const MCPS = [
  {
    id: "pipedrive",
    name: "Pipedrive CRM",
    desc: "Gerenciar deals, pessoas, atividades e notas no Pipedrive",
    dir: "pipedrive",
    entry: "index.js",
    env: [
      { key: "PIPEDRIVE_API_KEY", label: "API Key do Pipedrive", hint: "Pipedrive > Configuracoes > Pessoal > API" },
      { key: "PIPEDRIVE_TIMEZONE", label: "Fuso horario", default: "America/Sao_Paulo" },
    ],
  },
  {
    id: "clickup",
    name: "ClickUp",
    desc: "Gerenciar tarefas, docs e espacos no ClickUp",
    dir: "clickup",
    entry: "index.js",
    env: [
      { key: "CLICKUP_API_KEY", label: "API Token do ClickUp", hint: "ClickUp > Settings > Apps > API Token" },
    ],
  },
  {
    id: "zoom",
    name: "Zoom",
    desc: "Enviar mensagens, gerenciar canais e contatos no Zoom",
    dir: "zoom",
    entry: "index.js",
    env: [
      { key: "ZOOM_CLIENT_ID", label: "Client ID do Zoom App", hint: "Zoom Marketplace > App > Credentials" },
      { key: "ZOOM_CLIENT_SECRET", label: "Client Secret do Zoom App", hint: "Mesmo local do Client ID" },
      { key: "ZOOM_REDIRECT_URI", label: "Redirect URI", default: "http://localhost:4488/callback" },
    ],
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    desc: "E-mails, calendario e contatos via Microsoft Graph",
    dir: "outlook",
    entry: "index.js",
    env: [
      { key: "OUTLOOK_CLIENT_ID", label: "Application (Client) ID do Azure", hint: "Azure Portal > App Registrations" },
      { key: "OUTLOOK_TENANT_ID", label: "Directory (Tenant) ID", hint: "Mesmo local do Client ID" },
    ],
    postInstall: "Apos instalar, execute: cd packages/outlook && node auth.js",
  },
  {
    id: "chatguru",
    name: "ChatGuru",
    desc: "Ler e enviar mensagens via ChatGuru (WhatsApp Business)",
    dir: "chatguru",
    entry: "index.js",
    env: [
      { key: "CHATGURU_MODE", label: "Modo de operacao (full/readonly)", default: "readonly" },
      { key: "CHATGURU_SERVER", label: "ID do servidor ChatGuru", default: "17" },
      { key: "CHATGURU_API_KEY", label: "API Key do ChatGuru", hint: "Painel ChatGuru > Configuracoes > Celulares", optional: true },
      { key: "CHATGURU_ACCOUNT_ID", label: "Account ID do ChatGuru", hint: "Mesmo local da API Key", optional: true },
      { key: "CHATGURU_PHONE_ID", label: "Phone ID do ChatGuru", hint: "Mesmo local da API Key", optional: true },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Web",
    desc: "Ler e enviar mensagens no WhatsApp via extensao do navegador",
    dir: "whatsapp",
    entry: "index.js",
    env: [],
    postInstall: "Requer extensao do navegador. Veja: packages/whatsapp/README.md",
  },
];

// ─── Utilidades ─────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function print(msg = "") {
  console.log(msg);
}

function printHeader() {
  print();
  print("╔══════════════════════════════════════════════════════╗");
  print("║         Expert Integrado — Setup de MCPs            ║");
  print("╚══════════════════════════════════════════════════════╝");
  print();
}

function printStep(num, total, label) {
  print(`\n── Passo ${num}/${total}: ${label} ${"─".repeat(Math.max(0, 40 - label.length))}\n`);
}

// ─── Passo 1: Selecao de MCPs ──────────────────────────────────────────────

async function selectMCPs() {
  printStep(1, 3, "Selecionar MCPs");

  print("MCPs disponiveis:\n");
  MCPS.forEach((mcp, i) => {
    print(`  [${i + 1}] ${mcp.name}`);
    print(`      ${mcp.desc}`);
  });

  print(`\n  [A] Instalar TODOS\n`);

  const answer = await ask("Quais MCPs instalar? (numeros separados por virgula, ou A para todos): ");

  if (answer.trim().toUpperCase() === "A") {
    return MCPS.map((m) => m.id);
  }

  const indices = answer
    .split(",")
    .map((s) => parseInt(s.trim()) - 1)
    .filter((i) => i >= 0 && i < MCPS.length);

  if (indices.length === 0) {
    print("\nNenhum MCP selecionado. Saindo.");
    process.exit(0);
  }

  return indices.map((i) => MCPS[i].id);
}

// ─── Passo 2: Coletar Credenciais ──────────────────────────────────────────

async function collectCredentials(selectedIds) {
  printStep(2, 3, "Credenciais");

  const credentials = {};

  for (const id of selectedIds) {
    const mcp = MCPS.find((m) => m.id === id);
    if (!mcp.env || mcp.env.length === 0) {
      print(`  ${mcp.name}: nenhuma credencial necessaria.`);
      credentials[id] = {};
      continue;
    }

    print(`\n  ${mcp.name}:`);
    credentials[id] = {};

    for (const envVar of mcp.env) {
      if (envVar.default) {
        const val = await ask(`    ${envVar.label} [${envVar.default}]: `);
        credentials[id][envVar.key] = val.trim() || envVar.default;
      } else {
        const hint = envVar.hint ? ` (${envVar.hint})` : "";
        const optLabel = envVar.optional ? " [Enter para pular]" : "";
        const val = await ask(`    ${envVar.label}${hint}${optLabel}: `);

        if (!val.trim() && !envVar.optional) {
          print(`      AVISO: ${envVar.key} e obrigatorio. Voce precisara configurar depois.`);
        }

        credentials[id][envVar.key] = val.trim();
      }
    }
  }

  return credentials;
}

// ─── Passo 3: Instalar e Configurar ────────────────────────────────────────

async function installAndConfigure(selectedIds, credentials) {
  printStep(3, 3, "Instalar e configurar");

  const packagesDir = path.join(__dirname, "packages");
  const mcpConfigs = {};
  const postMessages = [];

  for (const id of selectedIds) {
    const mcp = MCPS.find((m) => m.id === id);
    const mcpDir = path.join(packagesDir, mcp.dir);

    // npm install
    print(`  Instalando ${mcp.name}...`);
    try {
      execSync("npm install --production", { cwd: mcpDir, stdio: "pipe" });
      print(`    OK`);
    } catch (err) {
      print(`    ERRO no npm install: ${err.message}`);
      continue;
    }

    // Criar .env
    const envContent = Object.entries(credentials[id] || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    if (envContent) {
      fs.writeFileSync(path.join(mcpDir, ".env"), envContent + "\n");
      print(`    .env criado`);
    }

    // Preparar config para claude_desktop_config.json
    const entryPath = path.join(mcpDir, mcp.entry).replace(/\\/g, "\\\\");
    mcpConfigs[mcp.id] = {
      command: "node",
      args: [path.join(mcpDir, mcp.entry)],
      env: credentials[id] || {},
    };

    if (mcp.postInstall) {
      postMessages.push(`  ${mcp.name}: ${mcp.postInstall}`);
    }
  }

  // Gerar config para Claude Code
  print("\n  Gerando configuracao para Claude Code...");

  const configPath = getClaudeConfigPath();
  let existingConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      // config corrompido, recriar
    }
  }

  if (!existingConfig.mcpServers) {
    existingConfig.mcpServers = {};
  }

  // Merge — preserva MCPs existentes, adiciona/atualiza os novos
  for (const [id, config] of Object.entries(mcpConfigs)) {
    const mcp = MCPS.find((m) => m.id === id);
    const key = `${mcp.id}-mcp`;
    existingConfig.mcpServers[key] = config;
  }

  // Garantir diretorio existe
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));
  print(`    Salvo em: ${configPath}`);

  return postMessages;
}

function getClaudeConfigPath() {
  // Windows: %APPDATA%/Claude/claude_desktop_config.json
  // macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
  // Linux: ~/.config/claude/claude_desktop_config.json
  const platform = process.platform;

  if (platform === "win32") {
    return path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  } else if (platform === "darwin") {
    return path.join(process.env.HOME || "", "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else {
    return path.join(process.env.HOME || "", ".config", "claude", "claude_desktop_config.json");
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  printHeader();

  // Verificar Node.js
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split(".")[0]);
  if (major < 18) {
    print(`ERRO: Node.js 18+ e necessario. Versao atual: ${nodeVersion}`);
    process.exit(1);
  }
  print(`Node.js ${nodeVersion} detectado. OK.\n`);

  // Passo 1
  const selectedIds = await selectMCPs();
  print(`\nSelecionados: ${selectedIds.map((id) => MCPS.find((m) => m.id === id).name).join(", ")}`);

  // Passo 2
  const credentials = await collectCredentials(selectedIds);

  // Passo 3
  const postMessages = await installAndConfigure(selectedIds, credentials);

  // Resumo final
  print("\n╔══════════════════════════════════════════════════════╗");
  print("║                  Setup concluido!                    ║");
  print("╚══════════════════════════════════════════════════════╝\n");

  print("MCPs instalados:");
  selectedIds.forEach((id) => {
    const mcp = MCPS.find((m) => m.id === id);
    print(`  - ${mcp.name}`);
  });

  if (postMessages.length > 0) {
    print("\nAcoes pendentes:");
    postMessages.forEach((msg) => print(msg));
  }

  print("\nProximo passo: reinicie o Claude Code para carregar os MCPs.");
  print("");

  rl.close();
}

main().catch((err) => {
  console.error("Erro no setup:", err);
  rl.close();
  process.exit(1);
});
