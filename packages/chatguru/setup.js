/**
 * Setup automatizado do MCP ChatGuru.
 *
 * Uso interativo:
 *   node setup.js
 *
 * Uso com credenciais pré-preenchidas:
 *   node setup.js --api-key=CHAVE --account-id=ID --phone-id=ID --server=17
 *
 * O que este script faz:
 * 1. Instala dependências (npm install)
 * 2. Instala browser do Playwright (chromium)
 * 3. Pede ou lê credenciais do ChatGuru
 * 4. Registra o MCP no Claude Code
 * 5. Abre browser para login manual no ChatGuru (salva session.json)
 */

import { execSync, spawn } from "child_process";
import { createInterface } from "readline";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── HELPERS ────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log(`  > ${cmd}`);
  try {
    execSync(cmd, { cwd: __dirname, stdio: "inherit", ...opts });
    return true;
  } catch {
    return false;
  }
}

function ask(rl, question, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([a-z-]+)=(.+)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function readEnvFile() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return {};
  const env = {};
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

console.log("\n=== Setup MCP ChatGuru ===\n");

// 1. Verificar Node.js
const nodeVersion = process.versions.node;
const major = parseInt(nodeVersion.split(".")[0]);
if (major < 18) {
  console.error(`ERRO: Node.js v18+ necessario. Versao atual: ${nodeVersion}`);
  process.exit(1);
}
console.log(`Node.js v${nodeVersion} OK\n`);

// 2. Instalar dependencias
console.log("1/5 Instalando dependencias...");
if (!run("npm install")) {
  console.error("ERRO: npm install falhou.");
  process.exit(1);
}
console.log("");

// 3. Instalar Playwright Chromium
console.log("2/5 Instalando browser Chromium (Playwright)...");
if (!run("npx playwright install chromium")) {
  console.error("ERRO: playwright install falhou.");
  process.exit(1);
}
console.log("");

// 4. Obter credenciais
console.log("3/5 Configurando credenciais do ChatGuru...\n");

const cliArgs = parseArgs();
const envFile = readEnvFile();

let apiKey = cliArgs["api-key"] || envFile.CHATGURU_API_KEY || "";
let accountId = cliArgs["account-id"] || envFile.CHATGURU_ACCOUNT_ID || "";
let phoneId = cliArgs["phone-id"] || envFile.CHATGURU_PHONE_ID || "";
let server = cliArgs["server"] || envFile.CHATGURU_SERVER || "17";

const needsInput = !apiKey || !accountId || !phoneId;

if (needsInput) {
  console.log("Informe as credenciais do ChatGuru.");
  console.log("(Peca ao admin: Configuracoes > Celulares no painel ChatGuru)\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  if (!apiKey) apiKey = await ask(rl, "CHATGURU_API_KEY");
  if (!accountId) accountId = await ask(rl, "CHATGURU_ACCOUNT_ID");
  if (!phoneId) phoneId = await ask(rl, "CHATGURU_PHONE_ID");
  server = await ask(rl, "CHATGURU_SERVER", server);

  rl.close();
}

if (!apiKey || !accountId || !phoneId || !server) {
  console.error("\nERRO: Todas as 4 credenciais sao obrigatorias.");
  process.exit(1);
}

console.log(`\nCredenciais configuradas:`);
console.log(`  API_KEY:    ${apiKey.slice(0, 8)}...`);
console.log(`  ACCOUNT_ID: ${accountId}`);
console.log(`  PHONE_ID:   ${phoneId}`);
console.log(`  SERVER:     ${server}`);

// Salvar .env local
const envContent = `CHATGURU_API_KEY=${apiKey}\nCHATGURU_ACCOUNT_ID=${accountId}\nCHATGURU_PHONE_ID=${phoneId}\nCHATGURU_SERVER=${server}\n`;
writeFileSync(join(__dirname, ".env"), envContent);
console.log("\n  .env salvo localmente.\n");

// 5. Registrar MCP no Claude Code + Claude Desktop
console.log("4/6 Registrando MCP...\n");

const indexPath = join(__dirname, "index.js").replace(/\\/g, "/");
const homeDir = process.env.USERPROFILE || process.env.HOME;

const mcpEntry = {
  command: "node",
  args: [indexPath],
  env: {
    CHATGURU_API_KEY: apiKey,
    CHATGURU_ACCOUNT_ID: accountId,
    CHATGURU_PHONE_ID: phoneId,
    CHATGURU_SERVER: server,
  },
};

/**
 * Registra o MCP em um arquivo JSON de configuracao.
 * Cria o arquivo se nao existir. Preserva dados existentes.
 */
function registerMcp(configPath, label) {
  try {
    let config = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers.chatguru = { type: "stdio", ...mcpEntry };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`  [OK] ${label}: ${configPath}`);
    return true;
  } catch (e) {
    console.log(`  [AVISO] ${label}: ${e.message}`);
    return false;
  }
}

// ── Claude Code (CLI) ──
// Arquivo: ~/.claude.json
const claudeCodePath = join(homeDir, ".claude.json");
registerMcp(claudeCodePath, "Claude Code");

// ── Claude Desktop (app) ──
// Windows: %APPDATA%/Claude/claude_desktop_config.json
// macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
// Linux:   ~/.config/Claude/claude_desktop_config.json
let desktopConfigDir;
if (process.platform === "win32") {
  desktopConfigDir = join(process.env.APPDATA || join(homeDir, "AppData", "Roaming"), "Claude");
} else if (process.platform === "darwin") {
  desktopConfigDir = join(homeDir, "Library", "Application Support", "Claude");
} else {
  desktopConfigDir = join(homeDir, ".config", "Claude");
}
const desktopConfigPath = join(desktopConfigDir, "claude_desktop_config.json");

if (existsSync(desktopConfigDir)) {
  registerMcp(desktopConfigPath, "Claude Desktop");
} else {
  console.log(`  [INFO] Claude Desktop: pasta nao encontrada (${desktopConfigDir})`);
  console.log(`         Instale o Claude Desktop e rode novamente, ou configure manualmente.`);
}

console.log("");

// ── Permissoes do Claude Code ──
console.log("5/6 Configurando permissoes...\n");

const settingsDir = join(homeDir, ".claude");
const settingsPath = join(settingsDir, "settings.json");

if (existsSync(settingsPath)) {
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    if (!settings.permissions) settings.permissions = {};
    if (!settings.permissions.allow) settings.permissions.allow = [];

    const perm = "mcp__chatguru__*";
    if (!settings.permissions.allow.includes(perm)) {
      settings.permissions.allow.push(perm);
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`  Permissao "${perm}" adicionada em settings.json\n`);
    } else {
      console.log(`  Permissao "${perm}" ja existe.\n`);
    }
  } catch (e) {
    console.log(`  AVISO: Nao foi possivel editar settings.json: ${e.message}`);
    console.log(`  Adicione manualmente: "mcp__chatguru__*" em permissions.allow\n`);
  }
} else {
  console.log(`  settings.json nao encontrado. Permissao sera solicitada no primeiro uso.\n`);
}

// 6. Login no ChatGuru (session.json)
console.log("6/6 Abrindo browser para login no ChatGuru...");
console.log("    Faca login normalmente. A sessao sera salva automaticamente.\n");

const loginProcess = spawn("node", [join(__dirname, "login.js")], {
  cwd: __dirname,
  stdio: "inherit",
  env: { ...process.env, CHATGURU_SERVER: server },
});

loginProcess.on("close", (code) => {
  console.log("\n=== Setup completo! ===\n");
  console.log("MCP registrado em:");
  console.log("  - Claude Code (CLI)");
  if (existsSync(desktopConfigPath)) {
    console.log("  - Claude Desktop (app)");
  }
  console.log("\nProximo passo: reinicie o Claude Code / Claude Desktop para ativar o MCP.");
  console.log("Teste com: chatguru_send_message para enviar uma mensagem de teste.\n");
  process.exit(code || 0);
});
