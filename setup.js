#!/usr/bin/env node

/**
 * Expert Integrado — Setup de Conexões com IA
 *
 * Onboarding 100% em português, para pessoas não técnicas.
 * Auto-detecta tudo, guia passo a passo e configura automaticamente.
 *
 * Uso: node setup.js
 */

import { createInterface } from "readline";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCPS_DIR = path.join(__dirname, "mcps");

// ─── Credenciais do app (compartilhadas, não pessoais) ─────────────────────

const ZOOM_APP_CREDENTIALS = {
  ZOOM_CLIENT_ID: "U2WuOarhRmOD96Njg4B38g",
  ZOOM_CLIENT_SECRET: "JbhR3QhIXPfi7k3JShq1brRkwn5ebtlQ",
  ZOOM_REDIRECT_URI: "http://localhost:4488/callback",
};

// ─── Definição das conexões ─────────────────────────────────────────────────

const CONNECTIONS = [
  {
    id: "pipedrive",
    name: "Pipedrive",
    desc: "Acessar deals, contatos, atividades e notas do CRM",
    dir: "pipedrive",
    entry: "index.js",
    credentialType: "personal_key",
    setupGuide: [
      "",
      "  Para conectar o Pipedrive, você precisa da sua chave pessoal de API.",
      "  Siga estes passos para encontrá-la:",
      "",
      "  1. Abra o Pipedrive (expertintegrado.pipedrive.com)",
      "  2. Clique no seu avatar (canto superior direito)",
      "  3. Vá em Configurações > Preferências pessoais > API",
      "  4. Copie o Token de API pessoal e cole aqui embaixo",
      "",
    ],
    envVars: [
      { key: "PIPEDRIVE_API_KEY", prompt: "  Cole sua chave do Pipedrive aqui: " },
      { key: "PIPEDRIVE_TIMEZONE", value: "America/Sao_Paulo" },
    ],
    postInstall: async () => {
      print("\n  Pipedrive conectado!");
      print("  Dica: após reiniciar o Claude, peça a ele:");
      print('  > "Sincroniza os campos do Pipedrive"');
      print("  Isso carrega os campos personalizados da empresa.\n");
    },
  },
  {
    id: "clickup",
    name: "ClickUp",
    desc: "Acessar tarefas, documentos e controlar tempo",
    dir: "clickup",
    entry: "index.js",
    credentialType: "personal_key",
    setupGuide: [
      "",
      "  IMPORTANTE: O token de API do ClickUp só está disponível",
      "  para contas com plano pago. Se você não tem plano pago,",
      "  pergunte ao seu gestor se existe uma conta compartilhada",
      "  para uso da equipe.",
      "",
      "  Se você tem plano pago, siga estes passos:",
      "",
      "  1. Abra o ClickUp (app.clickup.com)",
      "  2. Clique no seu avatar (canto inferior esquerdo)",
      "  3. Vá em Settings > Apps",
      "  4. Em API Token, clique em Generate (ou copie o existente)",
      "  5. O token começa com pk_",
      "",
    ],
    envVars: [
      { key: "CLICKUP_API_KEY", prompt: "  Cole seu token do ClickUp aqui: " },
    ],
  },
  {
    id: "outlook",
    name: "Outlook / E-mail",
    desc: "Acessar e-mails, calendário e contatos da Microsoft",
    dir: "outlook",
    entry: "index.js",
    credentialType: "oauth_device_code",
    envVars: [],
    postInstall: async (mcpDir) => {
      print("");
      print("  ┌─────────────────────────────────────────────────────────┐");
      print("  │  ATENÇÃO — Leia com calma antes de continuar           │");
      print("  └─────────────────────────────────────────────────────────┘");
      print("");
      print("  Para conectar seu e-mail, vai funcionar assim:");
      print("");
      print("  1. Vai aparecer um LINK e um CÓDIGO aqui na tela");
      print("  2. Abra o link no seu navegador");
      print("  3. Digite o CÓDIGO que apareceu aqui");
      print("  4. Faça login com sua conta @expertintegrado.com.br");
      print("  5. Quando terminar, volte aqui — vai mostrar que deu certo");
      print("");
      print("  É rápido, menos de 1 minuto!");
      print("");

      const proceed = await ask("  Pressione Enter quando estiver pronto...");

      print("");
      print("  Aguarde... o link e o código vão aparecer logo abaixo:");
      print("  ─────────────────────────────────────────────────────────");

      try {
        execSync("node auth.js", {
          cwd: mcpDir,
          stdio: "inherit",
          timeout: 180000,
        });
        print("  ─────────────────────────────────────────────────────────");
        print("\n  E-mail conectado com sucesso!");
      } catch {
        print("  ─────────────────────────────────────────────────────────");
        print("\n  Não foi possível conectar agora. Sem problemas!");
        print("  Peça ao Claude depois: \"Conecta meu Outlook\"");
      }
    },
  },
  {
    id: "zoom",
    name: "Zoom",
    desc: "Acessar mensagens, canais e contatos do Zoom",
    dir: "zoom",
    entry: "index.js",
    credentialType: "oauth_browser",
    envVars: [
      { key: "ZOOM_CLIENT_ID", value: ZOOM_APP_CREDENTIALS.ZOOM_CLIENT_ID },
      { key: "ZOOM_CLIENT_SECRET", value: ZOOM_APP_CREDENTIALS.ZOOM_CLIENT_SECRET },
      { key: "ZOOM_REDIRECT_URI", value: ZOOM_APP_CREDENTIALS.ZOOM_REDIRECT_URI },
    ],
    postInstall: async (mcpDir) => {
      print("");
      print("  Para conectar o Zoom, um navegador vai abrir automaticamente.");
      print("  Faça login com sua conta Zoom da Expert Integrado.");
      print("  Quando terminar, volte aqui.\n");

      const proceed = await ask("  Pressione Enter para abrir o navegador...");
      try {
        execSync("node auth.js", {
          cwd: mcpDir,
          stdio: "inherit",
          timeout: 180000,
          env: { ...process.env, ...ZOOM_APP_CREDENTIALS },
        });
        print("\n  Zoom conectado com sucesso!");
      } catch {
        print("\n  Não foi possível conectar agora. Sem problemas!");
        print("  Peça ao Claude depois: \"Conecta meu Zoom\"");
      }
    },
  },
  {
    id: "chatguru",
    name: "ChatGuru",
    desc: "Ler e enviar mensagens do WhatsApp da empresa (ChatGuru)",
    dir: "chatguru",
    entry: "index.js",
    credentialType: "playwright_login",
    envVars: [],
    collectCustomCredentials: async (askFn, printFn) => {
      const creds = {};

      printFn("");
      printFn("  ── ChatGuru ─────────────────────────────────────────────");
      printFn("");
      printFn("  O ChatGuru tem dois tipos de acesso:");
      printFn("");
      printFn("    1. Padrao — Você consegue ler conversas e enviar");
      printFn("       mensagens nos chats que tem permissao de acessar.");
      printFn("       E o acesso para todos os colaboradores.");
      printFn("");
      printFn("    2. Completo — Alem de ler e enviar, voce pode registrar");
      printFn("       contatos, adicionar notas e usar a API diretamente.");
      printFn("       Apenas para diretores e gerentes com chave de API.");
      printFn("");

      const modeAnswer = await askFn("  Você tem uma chave de API do ChatGuru? (s/N): ");

      if (modeAnswer.trim().toLowerCase() === "s") {
        creds.CHATGURU_MODE = "api";
        const apiKey = await askFn("  Cole sua chave de API do ChatGuru: ");
        if (apiKey.trim()) {
          creds.CHATGURU_API_KEY = apiKey.trim();
        }
      } else {
        creds.CHATGURU_MODE = "navegador";
      }

      const server = await askFn("  Em qual servidor do ChatGuru você acessa? (ex: 13, 17): ");
      creds.CHATGURU_SERVER = server.trim() || "17";

      return creds;
    },
    postInstall: async (mcpDir, credentials) => {
      const server = credentials?.CHATGURU_SERVER || "17";
      const mode = credentials?.CHATGURU_MODE || "navegador";

      print("");
      if (mode === "navegador") {
        print("  Modo: padrao (leitura + envio de mensagens via navegador).");
      } else {
        print("  Modo: completo (leitura + envio + API do ChatGuru).");
      }
      print("");
      print("  Agora vamos fazer seu login no ChatGuru.");
      print("  Um navegador vai abrir. Digite seu usuario e senha normalmente.");
      print("  Esse login e feito apenas uma vez — depois sera automatico.\n");

      // Instalar Playwright Chromium (necessario para ler e enviar mensagens)
      print("  Preparando navegador...");
      try {
        execSync("npx playwright install chromium", { cwd: mcpDir, stdio: "pipe", timeout: 120000 });
      } catch {
        print("  Aviso: nao foi possivel instalar o navegador automaticamente.");
        print("  O administrador pode resolver depois com: npx playwright install chromium");
      }

      const proceed = await ask("  Pressione Enter para abrir o navegador...");
      try {
        execSync("node login.js", {
          cwd: mcpDir,
          stdio: "inherit",
          timeout: 180000,
          env: { ...process.env, CHATGURU_SERVER: server },
        });
        print("\n  ChatGuru conectado!");
      } catch {
        print("\n  Nao foi possivel conectar agora. Sem problemas!");
        print("  Peca ao Claude depois: \"Conecta meu ChatGuru\"");
      }
    },
  },
  {
    id: "whatsapp",
    name: "WhatsApp Pessoal",
    desc: "Acessar mensagens do seu WhatsApp pessoal",
    dir: "whatsapp",
    entry: "index.js",
    credentialType: "extension",
    envVars: [],
    postInstall: async (mcpDir) => {
      print("");
      print("  O WhatsApp pessoal funciona via uma extensão do navegador.");
      print("  Para configurar:");
      print("  1. Abra o Edge ou Chrome");
      print("  2. Acesse edge://extensions/ (ou chrome://extensions/)");
      print("  3. Ative o Modo do desenvolvedor");
      print("  4. Clique em \"Carregar sem compactação\"");
      print("  5. Selecione a pasta: " + path.join(mcpDir, "extension"));
      print("  6. Abra web.whatsapp.com e mantenha a aba aberta");
      print("");
      print("  Se precisar de ajuda, peça ao responsável pela TI.\n");
    },
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

// ─── Verificações automáticas (silenciosas) ─────────────────────────────────

function checkNodeVersion() {
  const version = process.versions.node;
  const major = parseInt(version.split(".")[0]);

  if (major < 18) {
    print("");
    print("  Ops! Seu Node.js está desatualizado (versão " + version + ").");
    print("  É necessário a versão 18 ou superior.");
    print("  Baixe em: https://nodejs.org/");
    print("  Depois de instalar, reinicie o computador e rode este setup de novo.");
    print("");
    process.exit(1);
  }
}

// ─── Seleção de conexões ────────────────────────────────────────────────────

async function selectConnections() {
  print("");
  print("  Estas são as conexões disponíveis para o seu Claude:");
  print("");

  CONNECTIONS.forEach((conn, i) => {
    print(`    ${i + 1}. ${conn.name}  —  ${conn.desc}`);
  });

  print("");
  print("  Quais você gostaria de conectar?");
  print("");

  const answer = await ask("  Digite os números separados por vírgula (ex: 1,3,5) ou T para todas: ");

  if (answer.trim().toUpperCase() === "T") {
    return CONNECTIONS.map((c) => c.id);
  }

  const indices = answer
    .split(",")
    .map((s) => parseInt(s.trim()) - 1)
    .filter((i) => i >= 0 && i < CONNECTIONS.length);

  if (indices.length === 0) {
    print("\n  Nenhuma conexão selecionada. Saindo.");
    process.exit(0);
  }

  return indices.map((i) => CONNECTIONS[i].id);
}

// ─── Coleta de credenciais ──────────────────────────────────────────────────

async function collectCredentials(selectedIds) {
  const credentials = {};

  for (const id of selectedIds) {
    const conn = CONNECTIONS.find((c) => c.id === id);
    credentials[id] = {};

    // Coleta customizada (ChatGuru, etc.)
    if (conn.collectCustomCredentials) {
      const customCreds = await conn.collectCustomCredentials(ask, print);
      Object.assign(credentials[id], customCreds);
      continue;
    }

    const hasPrompts = conn.envVars.some((v) => v.prompt);

    if (hasPrompts) {
      print("");
      print(`  ── ${conn.name} ${"─".repeat(Math.max(0, 50 - conn.name.length))}`);

      if (conn.setupGuide) {
        conn.setupGuide.forEach((line) => print(line));
      }
    }

    for (const envVar of conn.envVars) {
      if (envVar.value) {
        credentials[id][envVar.key] = envVar.value;
      } else if (envVar.prompt) {
        const val = await ask(envVar.prompt);
        if (val.trim()) {
          credentials[id][envVar.key] = val.trim();
        } else {
          print("  Tudo bem, você pode configurar isso depois pelo Claude.");
        }
      }
    }
  }

  return credentials;
}

// ─── Instalação ─────────────────────────────────────────────────────────────

async function installConnections(selectedIds, credentials) {
  print("");
  print("  Conectando...");
  print("");

  const mcpConfigs = {};
  const installed = [];

  for (const id of selectedIds) {
    const conn = CONNECTIONS.find((c) => c.id === id);
    const connDir = path.join(MCPS_DIR, conn.dir);

    print(`  Preparando ${conn.name}...`);

    // npm install (silencioso)
    try {
      execSync("npm install --production", { cwd: connDir, stdio: "pipe" });
    } catch (err) {
      print(`  Não foi possível preparar o ${conn.name}. Peça ajuda ao responsável pela TI.`);
      continue;
    }

    // Criar .env
    const envContent = Object.entries(credentials[id] || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    if (envContent) {
      fs.writeFileSync(path.join(connDir, ".env"), envContent + "\n");
    }

    // Config para Claude
    mcpConfigs[conn.id] = {
      command: "node",
      args: [path.join(connDir, conn.entry)],
      env: credentials[id] || {},
    };

    installed.push(id);

    // Autenticação (se necessário)
    if (conn.postInstall) {
      await conn.postInstall(connDir, credentials[id]);
    }
  }

  // Salvar configuração do Claude
  if (installed.length > 0) {
    saveClaudeConfig(mcpConfigs);
  }

  return installed;
}

// Nomes antigos que pessoas podem ter nos configs (MCPs individuais)
const OLD_MCP_NAMES = {
  pipedrive: ["pipedrive", "pipedrive-mcp"],
  clickup: ["clickup", "clickup-mcp"],
  outlook: ["outlook", "outlook-mcp"],
  zoom: ["zoom", "zoom-mcp"],
  chatguru: ["chatguru", "chatguru-mcp"],
  whatsapp: ["whatsapp", "whatsapp-mcp"],
};

function saveClaudeConfig(mcpConfigs) {
  const desktopPath = getClaudeDesktopConfigPath();
  const codePath = getClaudeCodeConfigPath();

  // Limpar entradas antigas antes de adicionar as novas
  cleanOldMcpEntries(desktopPath, mcpConfigs);
  cleanOldMcpEntries(codePath, mcpConfigs);

  // 1. Claude Desktop — claude_desktop_config.json
  saveToJsonFile(desktopPath, mcpConfigs, "mcpServers");

  // 2. Claude Code — ~/.claude.json (com type: "stdio")
  const codeConfigs = {};
  for (const [id, cfg] of Object.entries(mcpConfigs)) {
    codeConfigs[id] = { type: "stdio", ...cfg };
  }
  saveToJsonFile(codePath, codeConfigs, "mcpServers");

  // 3. Permissões — ~/.claude/settings.json
  savePermissions(mcpConfigs);

  print("  Configuração salva para Claude Code e Claude Desktop.");
}

function cleanOldMcpEntries(filePath, newConfigs) {
  if (!fs.existsSync(filePath)) return;

  let config;
  try {
    config = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return;
  }

  if (!config.mcpServers) return;

  let cleaned = 0;

  // Para cada MCP que estamos instalando, remover versões antigas
  for (const newId of Object.keys(newConfigs)) {
    const oldNames = OLD_MCP_NAMES[newId] || [newId];

    for (const oldName of oldNames) {
      if (oldName !== newId && config.mcpServers[oldName]) {
        delete config.mcpServers[oldName];
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    print(`  Removidas ${cleaned} entrada(s) antiga(s) de ${path.basename(filePath)}.`);
  }
}

function saveToJsonFile(filePath, mcpConfigs, key) {
  let existing = {};

  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      // corrompido, manter vazio
    }
  }

  if (!existing[key]) {
    existing[key] = {};
  }

  for (const [id, config] of Object.entries(mcpConfigs)) {
    existing[key][id] = config;
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

function savePermissions(mcpConfigs) {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const settingsPath = path.join(homeDir, ".claude", "settings.json");

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      // corrompido, recriar
    }
  }

  if (!settings.permissions) {
    settings.permissions = {};
  }
  if (!settings.permissions.allow) {
    settings.permissions.allow = [];
  }

  // Permissões base
  const basePermissions = [
    "Bash", "Edit", "Write", "Read", "Glob", "Grep",
    "WebFetch", "WebSearch", "Agent", "Skill", "ToolSearch",
  ];

  for (const perm of basePermissions) {
    if (!settings.permissions.allow.includes(perm)) {
      settings.permissions.allow.push(perm);
    }
  }

  // Wildcards para cada MCP instalado
  for (const id of Object.keys(mcpConfigs)) {
    const wildcard = `mcp__${id}__*`;
    if (!settings.permissions.allow.includes(wildcard)) {
      settings.permissions.allow.push(wildcard);
    }

    // Limpar permissões de nomes antigos
    const oldNames = OLD_MCP_NAMES[id] || [];
    for (const oldName of oldNames) {
      if (oldName !== id) {
        const oldWildcard = `mcp__${oldName}__*`;
        const idx = settings.permissions.allow.indexOf(oldWildcard);
        if (idx !== -1) {
          settings.permissions.allow.splice(idx, 1);
        }
      }
    }
  }

  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function getClaudeDesktopConfigPath() {
  const platform = process.platform;
  if (platform === "win32") {
    return path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  } else if (platform === "darwin") {
    return path.join(process.env.HOME || "", "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else {
    return path.join(process.env.HOME || "", ".config", "claude", "claude_desktop_config.json");
  }
}

function getClaudeCodeConfigPath() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(homeDir, ".claude.json");
}

// ─── Skill de onboard de memória ────────────────────────────────────────────

async function installOnboardSkill() {
  const skillSrc = path.join(__dirname, "skills", "onboard");
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const skillDest = path.join(homeDir, ".claude", "skills", "onboard");

  if (!fs.existsSync(skillSrc)) return;

  print("");
  print("  ── Configuração de memória ──────────────────────────────");
  print("");
  print("  O Claude pode aprender sobre você, sua função e a empresa");
  print("  para te ajudar de forma personalizada no dia a dia.");
  print("");

  const answer = await ask("  Gostaria de ativar essa função? (S/n): ");

  if (answer.trim().toLowerCase() === "n") {
    print("  Sem problemas! Você pode ativar depois pedindo ao Claude:");
    print('  > "Faz meu onboard de memória"');
    return;
  }

  try {
    // Copiar skill para ~/.claude/skills/onboard/
    copyDirRecursive(skillSrc, skillDest);
    print("  Função de memória ativada!");
    print("  Após reiniciar o Claude, peça: \"Faz meu onboard de memória\"");
  } catch (err) {
    print("  Não foi possível ativar agora.");
    print("  Peça ao responsável pela TI para ajudar.");
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  print("");
  print("  ╔════════════════════════════════════════════════════════╗");
  print("  ║   Expert Integrado — Conexões com Inteligência Artificial  ║");
  print("  ╚════════════════════════════════════════════════════════╝");
  print("");
  print("  Bem-vindo! Este assistente vai conectar suas ferramentas");
  print("  ao Claude para que ele possa te ajudar no dia a dia.");
  print("");

  // Verificação silenciosa
  checkNodeVersion();

  // Seleção
  const selectedIds = await selectConnections();

  const selectedNames = selectedIds.map((id) => CONNECTIONS.find((c) => c.id === id).name);
  print(`\n  Ótimo! Vamos conectar: ${selectedNames.join(", ")}`);

  // Credenciais
  const credentials = await collectCredentials(selectedIds);

  // Instalação
  const installed = await installConnections(selectedIds, credentials);

  // Instalar skill de onboard de memória
  await installOnboardSkill();

  // Resumo final
  print("");
  print("  ════════════════════════════════════════════════════════");
  print("  Tudo pronto!");
  print("  ════════════════════════════════════════════════════════");
  print("");

  if (installed.length > 0) {
    print("  Conexões ativas:");
    installed.forEach((id) => {
      const conn = CONNECTIONS.find((c) => c.id === id);
      print(`    - ${conn.name}`);
    });

    print("");
    print("  Agora feche e reabra o Claude.");
    print("");
    print("  Depois, peça ao Claude:");
    print('    "Faz meu onboard de memória"');
    print("");
    print("  Isso vai configurar o Claude com informações sobre você,");
    print("  sua função e a empresa — para que ele te ajude melhor.");
    print("");
    print("  Exemplos do que você pode pedir depois:");
    print('    "Mostra meus deals no Pipedrive"');
    print('    "Quais compromissos eu tenho amanhã?"');
    print('    "Quais tarefas estão atrasadas no ClickUp?"');
    print('    "Envia uma mensagem no Zoom pro fulano"');
    print("");
    print("  Qualquer dúvida, peça ajuda ao responsável pela TI.");
  }

  print("");
  rl.close();
}

main().catch((err) => {
  console.error("Erro:", err);
  rl.close();
  process.exit(1);
});
