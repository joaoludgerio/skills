#!/usr/bin/env node
// pesquisa-instagram — entry point.
// Uso: node run.mjs <username> [--posts 12] [--json] [--out arquivo.json]

import { fetchProfile, normalizeUsername, ScraperError } from "./scraper.mjs";
import { computeScore } from "./score.mjs";
import { writeFileSync } from "node:fs";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const opts = parseArgs(argv);
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    fail("APIFY_TOKEN não está setado. Defina antes de invocar:\n  export APIFY_TOKEN=apify_api_...");
  }

  const username = normalizeUsername(opts.username);
  if (!username) fail("username vazio depois de normalizar");

  // --- fetch com retry exponencial ---
  let items;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      items = await fetchProfile({ token, username, postsLimit: opts.posts });
      break;
    } catch (e) {
      lastErr = e;
      const retriable = e instanceof ScraperError && (e.code === "RATE_LIMIT" || e.code === "TIMEOUT" || e.code === "UNKNOWN");
      if (!retriable || attempt === MAX_RETRIES) break;
      const wait = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      stderr(`[retry ${attempt}/${MAX_RETRIES}] ${e.code}: ${e.message} — esperando ${wait}ms`);
      await sleep(wait);
    }
  }

  if (!items) {
    if (lastErr instanceof ScraperError) {
      handleScraperError(lastErr, username, opts);
      return;
    }
    fail(`Falha desconhecida: ${lastErr?.message ?? lastErr}`);
  }

  // --- normaliza payload do actor ---
  const profile = normalizeProfile(items, username);

  // --- score ---
  const { metrics, score } = computeScore(profile);
  profile.metrics = metrics;
  profile.score = score;

  // --- output ---
  emit(profile, opts);
}

function normalizeProfile(items, requestedUsername) {
  // O instagram-profile-scraper retorna 1 item por username com header + lista posts.
  const root = items[0] ?? {};
  const latestPosts = (root.latestPosts ?? root.posts ?? []).map(p => ({
    shortcode: p.shortCode ?? p.shortcode ?? null,
    caption: trimText(p.caption, 140),
    likes: num(p.likesCount ?? p.likes),
    comments: num(p.commentsCount ?? p.comments),
    date: normalizeDate(p.timestamp ?? p.takenAtTimestamp),
    type: p.type ?? p.__typename ?? null,
    url: p.url ?? (p.shortCode ? `https://instagram.com/p/${p.shortCode}` : null),
  }));

  return {
    username: root.username ?? requestedUsername,
    fullName: root.fullName ?? root.name ?? null,
    bio: root.biography ?? root.bio ?? null,
    followers: num(root.followersCount ?? root.followers),
    following: num(root.followsCount ?? root.following),
    posts: num(root.postsCount ?? root.posts),
    verified: !!(root.verified ?? root.isVerified),
    private: !!(root.private ?? root.isPrivate),
    businessAccount: !!(root.isBusinessAccount ?? root.businessAccount),
    category: root.businessCategoryName ?? root.category ?? null,
    externalUrl: root.externalUrl ?? root.website ?? null,
    profilePicUrl: root.profilePicUrlHD ?? root.profilePicUrl ?? null,
    lastPosts: latestPosts,
  };
}

function emit(profile, opts) {
  if (opts.out) {
    writeFileSync(opts.out, JSON.stringify(profile, null, 2));
    stderr(`gravado em ${opts.out}`);
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(profile, null, 2) + "\n");
  } else {
    process.stdout.write(renderSummary(profile) + "\n\n");
    process.stdout.write("```json\n" + JSON.stringify(profile, null, 2) + "\n```\n");
  }
}

function renderSummary(p) {
  const lines = [];
  const handle = p.username ? `@${p.username}` : "(sem username)";
  const name = p.fullName ? ` — ${p.fullName}` : "";
  lines.push(`# ${handle}${name}`);
  lines.push("");
  lines.push(`📊 Score: ${p.score.total}/100 (${p.score.band})`);
  lines.push(`👥 ${fmtNum(p.followers)} seguidores · ${fmtNum(p.following)} seguindo · ${fmtNum(p.posts)} posts`);
  const meta = [];
  if (p.verified) meta.push("✅ Verificado");
  if (p.private) meta.push("🔒 Privado");
  if (p.businessAccount && p.category) meta.push(`🏷 ${p.category}`);
  if (p.externalUrl) meta.push(`🔗 ${p.externalUrl}`);
  if (meta.length) lines.push(meta.join(" · "));
  if (p.bio) lines.push(`📝 "${trimText(p.bio, 200)}"`);
  lines.push("");

  const er = p.metrics.engagementRate;
  const erTag = er >= 1 && er <= 6 ? "saudável" : er > 6 ? "muito alto" : er > 0 ? "baixo" : "n/a";
  lines.push(`Engajamento médio: ${er}% (${erTag})`);
  if (p.metrics.daysSinceLastPost !== null && p.metrics.daysSinceLastPost !== undefined) {
    lines.push(`Último post: ${p.metrics.daysSinceLastPost} dias atrás`);
  }
  lines.push(`Postagem últimos 60d: ${p.lastPosts.filter(post => {
    const t = post.date ? new Date(post.date).getTime() : NaN;
    return !isNaN(t) && Date.now() - t <= 60 * 86400 * 1000;
  }).length} posts`);
  lines.push("");

  if (p.score.flags.length === 0) {
    lines.push("⚠️ Sinais de atenção: nenhum");
  } else {
    lines.push("⚠️ Sinais de atenção:");
    for (const f of p.score.flags) lines.push(`  - ${f}`);
  }
  return lines.join("\n");
}

function handleScraperError(err, username, opts) {
  const payload = {
    username,
    error: err.code,
    message: err.message,
    score: null,
  };
  if (err.code === "PROFILE_PRIVATE") payload.private = true;
  if (opts.out) writeFileSync(opts.out, JSON.stringify(payload, null, 2));
  if (opts.json) {
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  } else {
    process.stdout.write(`# @${username}\n\n❌ ${err.code}: ${err.message}\n\n` +
      "```json\n" + JSON.stringify(payload, null, 2) + "\n```\n");
  }
  process.exit(err.code === "PROFILE_NOT_FOUND" ? 2 : 1);
}

// --- helpers ---

function parseArgs(argv) {
  const out = { username: null, posts: 12, json: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--posts") { out.posts = clamp(parseInt(argv[++i], 10) || 12, 1, 50); continue; }
    if (a === "--json") { out.json = true; continue; }
    if (a === "--out") { out.out = argv[++i]; continue; }
    if (!out.username) out.username = a;
  }
  if (!out.username) fail("username obrigatório. Uso: node run.mjs <username>");
  return out;
}

function printHelp() {
  process.stdout.write(
    "pesquisa-instagram — perfil + score de autenticidade\n\n" +
    "Uso: node run.mjs <username> [--posts N] [--json] [--out arquivo.json]\n\n" +
    "Exemplos:\n" +
    "  node run.mjs ericluciano\n" +
    "  node run.mjs @G4educacao --posts 20\n" +
    "  node run.mjs https://instagram.com/anthropic --json --out anthropic.json\n"
  );
}

function fail(msg) { stderr("erro: " + msg); process.exit(1); }
function stderr(s) { process.stderr.write(s + "\n"); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
// Normaliza data de post pra ISO. O actor pode mandar timestamp ISO (string)
// OU takenAtTimestamp como epoch em SEGUNDOS (10 dígitos) — `new Date(seg)`
// trataria como ms e cairia em 1970, quebrando consistência/dias-desde-último.
function normalizeDate(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    if (/^\d+$/.test(v.trim())) return normalizeDate(Number(v));
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v; // <1e12 ⇒ epoch em segundos
    return new Date(ms).toISOString();
  }
  return null;
}
function trimText(s, n) { if (!s) return s; return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

main().catch(e => fail(e?.stack ?? String(e)));
