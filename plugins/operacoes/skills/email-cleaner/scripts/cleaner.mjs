/**
 * cleaner.mjs — Skill email-cleaner: limpeza inteligente da inbox via Graph API.
 * Lê rules.json e aplica regras (delete/move/mark-read) com modificadores de subject.
 * Auth ISOLADO: cache em C:/tmp/email-cleaner-token.json. Não toca no MCP outlook.
 *
 * Subcomandos:
 *   --auth                Device code flow (1x)
 *   --auth-check          Verifica token sem solicitar
 *   --logout              Apaga cache local
 *   --list-folders        Lista pastas existentes
 *   --inspect-all         Dumpa não-lidos em C:/tmp/inbox-unread.json
 *   --apply-rules --dry-run|--execute   Aplica regras de rules.json
 *   --view <id>           Mostra corpo do email
 *   --reply <id> --body "texto"
 *   --delete-ids "id,id..."
 *   --read-ids "id,id..."
 *   --move-ids "id,id..." --folder "Pasta"
 */

import { PublicClientApplication } from "@azure/msal-node";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, "..", "rules.json");

// Mesmo app Azure do MCP outlook (Eric já deu consent).
const CLIENT_ID = "b044cdc1-5c75-4c25-be87-46e51f036ae6";
const TENANT_ID = "ac4a752a-850f-4705-9525-7270b98b20b4";
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Mail.ReadWrite", "Mail.Send", "offline_access", "User.Read"];

// Cache isolado, fora do MCP. Apagar com --logout.
const TOKEN_PATH = "C:/tmp/email-cleaner-token.json";
const SNAPSHOT_PATH = "C:/tmp/inbox-unread.json";

// ---------- AUTH ----------

function buildCachePlugin() {
  return {
    beforeCacheAccess: async (ctx) => {
      if (fs.existsSync(TOKEN_PATH)) {
        ctx.tokenCache.deserialize(fs.readFileSync(TOKEN_PATH, "utf-8"));
      }
    },
    afterCacheAccess: async (ctx) => {
      if (ctx.cacheHasChanged) {
        fs.writeFileSync(TOKEN_PATH, ctx.tokenCache.serialize(), { mode: 0o600 });
      }
    },
  };
}

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

async function deviceCodeAuth() {
  console.log("\nAutenticação isolada (cache em " + TOKEN_PATH + ")\n");
  const pca = getPca();
  const r = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (info) => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("1. Acesse: " + info.verificationUri);
      console.log("2. Digite o código: " + info.userCode);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    },
  });
  console.log("OK. Conta: " + r.account.username);
}

async function authCheck() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.log("status: SEM_AUTH");
    console.log("acao: rodar `node cleaner.mjs --auth`");
    process.exit(1);
  }
  try {
    const token = await getToken();
    console.log("status: OK");
    console.log("token_existe: true");
  } catch (e) {
    console.log("status: TOKEN_INVALIDO");
    console.log("acao: rodar `node cleaner.mjs --logout` e depois `--auth`");
    process.exit(1);
  }
}

async function getToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error("Sem auth. Rode: node cleaner.mjs --auth");
  }
  const pca = getPca();
  const cache = pca.getTokenCache();
  cache.deserialize(fs.readFileSync(TOKEN_PATH, "utf-8"));
  const accounts = await cache.getAllAccounts();
  if (!accounts.length) throw new Error("Cache vazio. Rode --auth");
  const r = await pca.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] });
  return r.accessToken;
}

// ---------- GRAPH ----------

async function graph(method, endpoint, body = null) {
  const token = await getToken();
  const isFull = endpoint.startsWith("https://");
  const url = isFull ? endpoint : `${GRAPH_BASE}${endpoint}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="America/Sao_Paulo"',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Graph ${r.status}: ${t}`);
  }
  if (r.status === 204 || r.status === 202) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function graphPaged(endpoint, max = 5000) {
  let all = [];
  let next = endpoint;
  while (next && all.length < max) {
    const res = await graph("GET", next);
    if (res?.value) all = all.concat(res.value);
    next = res?.["@odata.nextLink"] && all.length < max ? res["@odata.nextLink"] : null;
  }
  return all.slice(0, max);
}

// ---------- AÇÕES BÁSICAS ----------

async function listFolders() {
  const list = await graphPaged("/me/mailFolders?$select=id,displayName,totalItemCount,unreadItemCount&$top=100");
  console.log("\nPastas:");
  for (const f of list) {
    console.log(`  - ${f.displayName.padEnd(40)} [total: ${f.totalItemCount}, não lidos: ${f.unreadItemCount}]`);
  }
}

async function findOrCreateFolder(name) {
  const filtro = encodeURIComponent(`displayName eq '${name.replace(/'/g, "''")}'`);
  const r = await graphPaged(`/me/mailFolders?$filter=${filtro}&$select=id,displayName`, 5);
  if (r.length) return r[0].id;
  const created = await graph("POST", "/me/mailFolders", { displayName: name });
  console.log(`  > pasta "${name}" criada`);
  return created.id;
}

async function fetchAllUnread() {
  const url = `/me/mailFolders/inbox/messages?$filter=${encodeURIComponent("isRead eq false")}&$select=id,subject,from,receivedDateTime&$top=999`;
  return await graphPaged(url, 5000);
}

async function batchAction(ids, action, folderId = null) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));
  let ok = 0, fail = 0;
  for (const chunk of chunks) {
    const requests = chunk.map((id, idx) => {
      if (action === "delete") return { id: String(idx + 1), method: "DELETE", url: `/me/messages/${id}` };
      if (action === "mark-read") return {
        id: String(idx + 1), method: "PATCH", url: `/me/messages/${id}`,
        headers: { "Content-Type": "application/json" }, body: { isRead: true },
      };
      if (action === "move") return {
        id: String(idx + 1), method: "POST", url: `/me/messages/${id}/move`,
        headers: { "Content-Type": "application/json" }, body: { destinationId: folderId },
      };
    });
    const result = await graph("POST", "/$batch", { requests });
    for (const r of result.responses || []) {
      if (r.status >= 200 && r.status < 300) ok++; else fail++;
    }
  }
  return { ok, fail };
}

// ---------- REGRAS ----------

function loadRules() {
  if (!fs.existsSync(RULES_PATH)) {
    throw new Error(`rules.json não encontrado em ${RULES_PATH}`);
  }
  return JSON.parse(fs.readFileSync(RULES_PATH, "utf-8"));
}

function ruleMatches(rule, addr, subject) {
  // Match address
  let addrMatches = false;
  if (rule.match_type === "domain_suffix") {
    addrMatches = (rule.domains || []).some(d => addr.endsWith(d.toLowerCase()));
  } else if (rule.match_type === "exact_address") {
    addrMatches = (rule.addresses || []).some(a => addr === a.toLowerCase());
  } else if (rule.match_type === "regex_address") {
    addrMatches = new RegExp(rule.regex, "i").test(addr);
  }
  if (!addrMatches) return false;

  // Subject modifiers
  if (rule.subject_must_match) {
    if (!new RegExp(rule.subject_must_match).test(subject)) return false;
  }
  if (rule.subject_must_not_match) {
    if (new RegExp(rule.subject_must_not_match).test(subject)) return false;
  }
  return true;
}

function isPreserved(rules, addr) {
  if ((rules.preserve_addresses || []).some(a => addr === a.toLowerCase())) return true;
  if ((rules.preserve_domains || []).some(d => addr.endsWith(d.toLowerCase()))) return true;
  return false;
}

async function applyRules(isExecute) {
  console.log(isExecute ? "[EXECUTE]\n" : "[DRY-RUN]\n");
  const rules = loadRules();

  // 1. Cria pastas que faltam (só em execute)
  const folderIds = {};
  if (isExecute) {
    const requiredFolders = new Set([
      ...(rules.folders_to_create_if_missing || []),
      ...rules.rules.filter(r => r.action === "move").map(r => r.folder),
    ]);
    for (const f of requiredFolders) {
      folderIds[f] = await findOrCreateFolder(f);
    }
  }

  // 2. Snapshot
  console.log("Buscando todos os não lidos...");
  const all = await fetchAllUnread();
  console.log(`  ${all.length} encontrados.\n`);

  // 3. Classifica
  const buckets = new Map();   // ruleName -> [msgs]
  const preserved = [];
  const unmatched = [];
  for (const msg of all) {
    const addr = (msg.from?.emailAddress?.address || "").toLowerCase();
    const subj = msg.subject || "";
    if (isPreserved(rules, addr)) { preserved.push(msg); continue; }
    let m = null;
    for (const r of rules.rules) {
      if (ruleMatches(r, addr, subj)) { m = r; break; }
    }
    if (m) {
      if (!buckets.has(m.name)) buckets.set(m.name, []);
      buckets.get(m.name).push(msg);
    } else {
      unmatched.push(msg);
    }
  }

  // 4. Executa por regra
  let total = 0;
  for (const rule of rules.rules) {
    const msgs = buckets.get(rule.name) || [];
    const count = msgs.length;
    if (count === 0) continue;
    total += count;
    let res = { ok: 0, fail: 0 };
    if (isExecute) {
      const fid = rule.folder ? folderIds[rule.folder] : null;
      res = await batchAction(msgs.map(m => m.id), rule.action, fid);
    }
    const tag = rule.action === "delete" ? "DEL" : rule.action === "mark-read" ? "READ" : `MOVE->${rule.folder}`;
    const status = isExecute ? ` [ok:${res.ok} fail:${res.fail}]` : "";
    console.log(`  ${tag.padEnd(28)} ${String(count).padStart(4)}  ${rule.name}${status}`);
  }

  const pct = all.length ? (100 * total / all.length).toFixed(1) : "0.0";
  console.log(`\nAfetados pelas regras: ${total} de ${all.length} (${pct}%)`);
  console.log(`Preservados (humano/equipe): ${preserved.length}`);
  console.log(`Não cobertos (precisam classificação): ${unmatched.length}`);

  if (preserved.length) {
    console.log(`\n=== PRESERVADOS (Eric decide) ===`);
    for (const m of preserved) {
      const addr = m.from?.emailAddress?.address || "?";
      console.log(`  ${m.receivedDateTime.slice(0,10)} | ${addr.padEnd(45)} | ${(m.subject||"").slice(0,80)} | id=${m.id}`);
    }
  }

  if (unmatched.length) {
    console.log(`\n=== NÃO COBERTOS (precisam --view <id>) ===`);
    const byDom = new Map();
    for (const m of unmatched) {
      const a = (m.from?.emailAddress?.address || "?").toLowerCase();
      const d = a.split("@")[1] || a;
      if (!byDom.has(d)) byDom.set(d, []);
      byDom.get(d).push(m);
    }
    const sorted = [...byDom.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [dom, msgs] of sorted) {
      console.log(`  [${msgs.length}] @${dom}`);
      for (const m of msgs.slice(0, 3)) {
        console.log(`    ${m.receivedDateTime.slice(0,10)} ${(m.subject||"").slice(0,70)} | id=${m.id}`);
      }
      if (msgs.length > 3) console.log(`    ...mais ${msgs.length - 3}`);
    }
  }

  if (isExecute) {
    console.log(`\nLEMBRETE: pra apagar o token de auth desta sessão, rode:`);
    console.log(`  node cleaner.mjs --logout`);
  }
}

// ---------- MAIN ----------

const args = process.argv.slice(2);

async function main() {
  if (args.includes("--auth")) return deviceCodeAuth();
  if (args.includes("--auth-check")) return authCheck();
  if (args.includes("--logout")) {
    if (fs.existsSync(TOKEN_PATH)) { fs.unlinkSync(TOKEN_PATH); console.log("Token apagado."); }
    else console.log("Sem token pra apagar.");
    return;
  }
  if (args.includes("--list-folders")) return listFolders();

  if (args.includes("--inspect-all")) {
    const all = await fetchAllUnread();
    const out = all.map(m => ({
      id: m.id,
      from_addr: m.from?.emailAddress?.address || "?",
      from_name: m.from?.emailAddress?.name || "?",
      subject: m.subject || "",
      date: m.receivedDateTime,
    }));
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(out, null, 2));
    console.log(`${out.length} emails dumpados em ${SNAPSHOT_PATH}`);
    return;
  }

  if (args.includes("--view")) {
    const id = args[args.indexOf("--view") + 1];
    if (!id) { console.log("Uso: --view <id>"); return; }
    const m = await graph("GET", `/me/messages/${id}?$select=subject,from,toRecipients,ccRecipients,receivedDateTime,body`);
    console.log(`\nDe: ${m.from?.emailAddress?.name} <${m.from?.emailAddress?.address}>`);
    console.log(`Para: ${(m.toRecipients || []).map(r => r.emailAddress.address).join(", ")}`);
    if (m.ccRecipients?.length) console.log(`CC: ${m.ccRecipients.map(r => r.emailAddress.address).join(", ")}`);
    console.log(`Data: ${m.receivedDateTime}`);
    console.log(`Assunto: ${m.subject}\n`);
    const body = (m.body?.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(body.slice(0, 4000));
    return;
  }

  if (args.includes("--reply")) {
    const id = args[args.indexOf("--reply") + 1];
    const body = args[args.indexOf("--body") + 1];
    if (!id || !body) { console.log("Uso: --reply <id> --body \"texto\""); return; }
    await graph("POST", `/me/messages/${id}/reply`, { comment: body });
    console.log(`Respondido: ${id}`);
    return;
  }

  if (args.includes("--delete-ids")) {
    const ids = args[args.indexOf("--delete-ids") + 1].split(",").filter(Boolean);
    const r = await batchAction(ids, "delete");
    console.log(`Delete: ok=${r.ok} fail=${r.fail}`);
    return;
  }

  if (args.includes("--read-ids")) {
    const ids = args[args.indexOf("--read-ids") + 1].split(",").filter(Boolean);
    const r = await batchAction(ids, "mark-read");
    console.log(`Mark-read: ok=${r.ok} fail=${r.fail}`);
    return;
  }

  if (args.includes("--move-ids")) {
    const ids = args[args.indexOf("--move-ids") + 1].split(",").filter(Boolean);
    const folder = args[args.indexOf("--folder") + 1];
    if (!folder) { console.log("Uso: --move-ids \"...\" --folder \"Pasta\""); return; }
    const fid = await findOrCreateFolder(folder);
    const r = await batchAction(ids, "move", fid);
    console.log(`Move pra "${folder}": ok=${r.ok} fail=${r.fail}`);
    return;
  }

  if (args.includes("--apply-rules")) {
    const isExecute = args.includes("--execute");
    const isDryRun = args.includes("--dry-run");
    if (!isExecute && !isDryRun) { console.log("Use --apply-rules com --dry-run ou --execute"); return; }
    return applyRules(isExecute);
  }

  console.log("Subcomandos: --auth | --auth-check | --logout | --list-folders | --inspect-all | --apply-rules --dry-run|--execute | --view <id> | --reply <id> --body \"texto\" | --delete-ids \"...\" | --read-ids \"...\" | --move-ids \"...\" --folder \"...\"");
}

main().catch(e => {
  console.error("Falha:", e.message);
  process.exit(1);
});
