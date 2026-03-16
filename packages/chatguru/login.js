/**
 * Script de login manual para o ChatGuru.
 *
 * Uso: CHATGURU_SERVER=17 node login.js
 *
 * Abre um browser VISÍVEL na URL do ChatGuru.
 * Faça login manualmente. O script detecta automaticamente quando o login
 * é concluído (URL muda para /chats) e salva a sessão.
 *
 * O chatguru_read_messages usa esse session.json para acessar o painel em modo headless.
 */

import { chromium } from "playwright";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const SERVER = process.env.CHATGURU_SERVER;

if (!SERVER) {
  console.error("ERRO: Defina CHATGURU_SERVER. Exemplo: CHATGURU_SERVER=17 node login.js");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSION_PATH = join(__dirname, "session.json");
const LOGIN_URL = `https://s${SERVER}.expertintegrado.app`;

console.log(`\nAbrindo browser em: ${LOGIN_URL}`);
console.log("Faça login normalmente. A sessão será salva automaticamente após o login.\n");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(LOGIN_URL);

// Aguardar até que a URL indique que o login foi concluído
// (a URL muda para algo como /chats, /dashboard, ou qualquer path diferente de /login)
console.log("Aguardando login...");
try {
  await page.waitForURL((url) => {
    const path = url.pathname || "";
    return !path.includes("login") && !path.includes("signin") && path !== "/";
  }, { timeout: 300000 }); // 5 minutos de timeout
} catch {
  // Se timeout, salva mesmo assim (pode ter logado mas a URL não mudou como esperado)
  console.log("Timeout aguardando mudança de URL. Salvando sessão atual...");
}

// Aguardar um pouco para garantir que cookies/localStorage foram setados
await new Promise((r) => setTimeout(r, 2000));

// Salvar storageState (cookies + localStorage)
const storageState = await context.storageState();
await writeFile(SESSION_PATH, JSON.stringify(storageState, null, 2));

console.log(`\nSessão salva em: ${SESSION_PATH}`);
console.log("Fechando browser...");

await browser.close();
process.exit(0);
