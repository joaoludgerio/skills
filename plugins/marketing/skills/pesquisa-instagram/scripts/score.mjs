// Score de autenticidade Instagram — heurística 0-100, padrão de mercado.
// Documentação completa em docs/score-guide.md.
//
// Critérios e pesos:
//   1. Engagement rate (avg likes+comments / followers)        0-30
//   2. Follower:following ratio                                  0-15
//   3. Profile completeness (bio, pic, link, name, category)     0-15
//   4. Posting consistency (frequência últimos 60 dias)          0-20
//   5. Verified badge                                            0-10
//   6. Account size sanity (descontos por sinais ruins)          0-10
//
// Banda final:
//   80-100: ALTA AUTENTICIDADE
//   50-79:  NORMAL
//   30-49:  SUSPEITO
//    0-29:  PROVAVELMENTE FAKE OU INATIVO

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeScore(profile) {
  const flags = [];
  const breakdown = {};

  const followers = num(profile.followers);
  const following = num(profile.following);
  const postsCount = num(profile.posts);
  const lastPosts = Array.isArray(profile.lastPosts) ? profile.lastPosts : [];

  // --- métricas auxiliares ---
  const totalLikes = lastPosts.reduce((s, p) => s + num(p.likes), 0);
  const totalComments = lastPosts.reduce((s, p) => s + num(p.comments), 0);
  const avgLikes = lastPosts.length ? totalLikes / lastPosts.length : 0;
  const avgComments = lastPosts.length ? totalComments / lastPosts.length : 0;
  const engagementRate = followers > 0 && lastPosts.length > 0
    ? ((avgLikes + avgComments) / followers) * 100
    : 0;
  const followerFollowingRatio = following > 0 ? followers / following : (followers > 0 ? Infinity : 0);

  // posts nos últimos 60 dias
  const now = Date.now();
  const recentPosts = lastPosts.filter(p => {
    const t = p.date ? new Date(p.date).getTime() : NaN;
    return !isNaN(t) && now - t <= 60 * DAY_MS;
  });
  const postsPerMonthRecent = (recentPosts.length / 60) * 30;
  const lastPostDate = lastPosts.reduce((acc, p) => {
    const t = p.date ? new Date(p.date).getTime() : NaN;
    return !isNaN(t) && t > acc ? t : acc;
  }, 0);
  const daysSinceLastPost = lastPostDate ? Math.floor((now - lastPostDate) / DAY_MS) : null;

  // --- 1. Engagement rate (0-30) ---
  // Curva conhecida do mercado: contas pequenas têm ER mais alto.
  // 1-3% é o doce. <0.5% ou >12% acendem flag.
  let er = 0;
  if (followers > 0 && lastPosts.length > 0) {
    if (engagementRate >= 1 && engagementRate <= 6) er = 30;
    else if (engagementRate >= 0.5 && engagementRate < 1) er = 22;
    else if (engagementRate > 6 && engagementRate <= 12) er = 22;
    else if (engagementRate >= 0.1 && engagementRate < 0.5) er = 12;
    else if (engagementRate > 12) { er = 10; flags.push("engagement >12% — possível bot/bombing"); }
    else { er = 2; flags.push("engagement quase zero — conta inativa"); }
  } else if (lastPosts.length === 0) {
    er = 0;
    flags.push("sem posts visíveis para medir engajamento");
  }
  breakdown.engagement = er;

  // --- 2. Follower:following ratio (0-15) ---
  let ratio = 0;
  if (followers === 0 && following === 0) {
    ratio = 0;
  } else if (followerFollowingRatio === Infinity) {
    // segue 0 mas tem seguidores → conta-âncora pequena, OK mas não bonifica muito
    ratio = followers > 100 ? 12 : 6;
  } else if (followerFollowingRatio >= 2) {
    ratio = 15;
  } else if (followerFollowingRatio >= 1) {
    ratio = 12;
  } else if (followerFollowingRatio >= 0.5) {
    ratio = 8;
  } else if (followerFollowingRatio >= 0.2) {
    ratio = 4;
    flags.push("segue mais que é seguido — possível follow-back farming");
  } else {
    ratio = 2;
    flags.push(`segue ${following} mas tem só ${followers} seguidores`);
  }
  breakdown.ratio = ratio;

  // --- 3. Profile completeness (0-15) — 3 pts cada ---
  let comp = 0;
  if (profile.bio && profile.bio.trim().length >= 10) comp += 3;
  if (profile.profilePicUrl) comp += 3;
  if (profile.externalUrl) comp += 3;
  if (profile.fullName && profile.fullName.trim()) comp += 3;
  if (profile.category || profile.businessAccount) comp += 3;
  if (comp <= 6) flags.push("perfil pouco preenchido (bio/foto/link/nome/categoria)");
  breakdown.completeness = comp;

  // --- 4. Posting consistency (0-20) ---
  let cons = 0;
  if (postsCount === 0) {
    cons = 0;
    flags.push("zero posts no perfil");
  } else if (lastPosts.length === 0) {
    cons = 5; // tem posts mas actor não pegou — neutro
  } else if (recentPosts.length >= 8) cons = 20;
  else if (recentPosts.length >= 4) cons = 16;
  else if (recentPosts.length >= 2) cons = 11;
  else if (recentPosts.length >= 1) cons = 7;
  else {
    cons = 3;
    if (daysSinceLastPost !== null && daysSinceLastPost > 180) {
      flags.push(`último post há ${daysSinceLastPost} dias — conta dormente`);
    }
  }
  breakdown.consistency = cons;

  // --- 5. Verified badge (0-10) ---
  const verified = profile.verified ? 10 : 0;
  breakdown.verified = verified;

  // --- 6. Account size sanity (0-10) ---
  // Bonifica perfis com base mínima saudável; desconta sinais ruins.
  let size = 0;
  if (followers >= 100 && postsCount >= 5) size = 10;
  else if (followers >= 30 && postsCount >= 3) size = 6;
  else if (followers >= 1 && postsCount >= 1) size = 3;
  else { size = 0; flags.push("conta vazia ou recém-criada"); }

  // Anti-bot heurística: muitos seguidores, ZERO posts → quase certeza de fake/recém-comprada
  if (followers > 1000 && postsCount === 0) {
    size = 0;
    flags.push("muitos seguidores e nenhum post — perfil fantasma/comprado");
  }
  breakdown.size = size;

  // --- soma final ---
  const total = Math.max(0, Math.min(100,
    breakdown.engagement +
    breakdown.ratio +
    breakdown.completeness +
    breakdown.consistency +
    breakdown.verified +
    breakdown.size
  ));

  let band;
  if (total >= 80) band = "ALTA AUTENTICIDADE";
  else if (total >= 50) band = "NORMAL";
  else if (total >= 30) band = "SUSPEITO";
  else band = "PROVAVELMENTE FAKE OU INATIVO";

  return {
    metrics: {
      engagementRate: round(engagementRate, 2),
      avgLikes: Math.round(avgLikes),
      avgComments: Math.round(avgComments),
      followerFollowingRatio: followerFollowingRatio === Infinity ? null : round(followerFollowingRatio, 2),
      postsPerMonthRecent: round(postsPerMonthRecent, 1),
      daysSinceLastPost,
    },
    score: { total, band, breakdown, flags },
  };
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round(v, d) { return Math.round(v * 10 ** d) / 10 ** d; }
