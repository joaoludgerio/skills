// Scraper de perfil público do Instagram — camada de transporte da skill
// pesquisa-instagram da Expert Integrado.
//
// Sem dependências externas — usa fetch nativo do Node 20+.
//
// Padrão de erro: lança ScraperError com .code ∈ {RATE_LIMIT, TIMEOUT,
// PROFILE_PRIVATE, PROFILE_NOT_FOUND, INVALID_TOKEN, UNKNOWN}.
// O retry com backoff exponencial fica no caller (run.mjs) — esta camada
// apenas classifica.

const ACTOR_ID = "apify~instagram-profile-scraper";
const BASE = "https://api.apify.com/v2";

export class ScraperError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = "ScraperError";
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/**
 * Roda o scraper de forma síncrona e retorna os items do dataset.
 * @param {{ token: string, username: string, postsLimit?: number, timeoutMs?: number }} opts
 * @returns {Promise<object[]>} dataset items
 */
export async function fetchProfile({ token, username, postsLimit = 12, timeoutMs = 60000 }) {
  if (!token) throw new ScraperError("INVALID_TOKEN", "APIFY_TOKEN ausente");

  const url = `${BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  const body = {
    usernames: [normalizeUsername(username)],
    resultsType: "details",
    resultsLimit: postsLimit,
    addParentData: false,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new ScraperError("TIMEOUT", `Scraper passou de ${timeoutMs}ms sem resposta`);
    throw new ScraperError("UNKNOWN", `Falha de rede: ${e.message}`, e);
  } finally {
    clearTimeout(timer);
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new ScraperError("INVALID_TOKEN", `HTTP ${resp.status} — token rejeitado`);
  }
  if (resp.status === 429) {
    throw new ScraperError("RATE_LIMIT", "HTTP 429 — rate limit");
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new ScraperError("UNKNOWN", `HTTP ${resp.status} — ${text.slice(0, 200)}`);
  }

  let items;
  try {
    items = await resp.json();
  } catch (e) {
    throw new ScraperError("UNKNOWN", "Resposta do scraper não é JSON válido", e);
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ScraperError("PROFILE_NOT_FOUND", `Sem item retornado para "${username}"`);
  }

  const item = items[0];
  if (item?.error === "not_found" || item?.errorDescription?.toLowerCase().includes("not found")) {
    throw new ScraperError("PROFILE_NOT_FOUND", `Perfil @${username} não existe`);
  }

  return items;
}

export function normalizeUsername(input) {
  if (!input) return "";
  let s = String(input).trim();
  const urlMatch = s.match(/instagram\.com\/([^/?#]+)/i);
  if (urlMatch) s = urlMatch[1];
  s = s.replace(/^@/, "");
  s = s.replace(/\/+$/, "");
  return s.toLowerCase();
}
