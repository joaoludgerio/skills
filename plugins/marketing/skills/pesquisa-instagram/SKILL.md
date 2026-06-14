---
name: pesquisa-instagram
description: Auditoria de perfil público do Instagram — devolve dados estruturados + score de autenticidade Expert Integrado (0-100) + resumo legível. Trata os erros canônicos (RATE_LIMIT, TIMEOUT, PROFILE_PRIVATE, PROFILE_NOT_FOUND) com retry exponencial. NÃO faz follow, like ou qualquer ação. Apenas leitura. TRIGGER quando o usuário pedir "pesquisa o @ no Instagram", "perfil instagram do fulano", "analisa @username", "checa esse insta", "esse perfil é fake?", "score de autenticidade do @", ou similar.
---

# Pesquisa Instagram — perfil + score de autenticidade

Skill atômica da Expert Integrado: pesquisa UM perfil público do Instagram, devolve JSON estruturado com header, posts recentes e score de autenticidade.

> **Esta skill NÃO segue, curte ou comenta.** Apenas leitura.

---

## Quando usar

- "Pesquisa o @ no Instagram" / "analisa @username" / "esse perfil é fake?"
- Validação rápida de lead antes de prospecção (cruza com Pipedrive depois, se pedido)
- Auditoria de perfil de palestrante / convidado de evento
- Curadoria de seguidores de algum perfil-âncora

**Não use** quando:
- O perfil é privado (retorna PROFILE_PRIVATE — só dá pra ver header, score perde sentido)
- O usuário pediu "pesquisa o LinkedIn" / "pesquisa a empresa" — usar `prospecta-lead`
- O usuário quer baixar mídias / comentar / seguir — fora do escopo

---

## Setup (uma vez)

A skill lê o token Apify de `process.env.APIFY_TOKEN`. Fonte canônica: 1Password (vault `Agentes Eric`).

**PC (Windows):** o token já fica cacheado no User env do Windows (gravado pelo `setup-secrets.ps1`). Em sessão nova ele carrega sozinho — nada a fazer. Pra checar:
```bash
node -e "console.log(process.env.APIFY_TOKEN ? 'ok' : 'faltando')"
```

**Se faltar (qualquer máquina com `op` CLI):** exportar direto do 1Password antes de invocar:
```bash
export APIFY_TOKEN="$(op read 'op://Agentes Eric/APIFY_TOKEN/credential')"
```

Se o `op` CLI não estiver disponível, a skill aborta com `INVALID_TOKEN` pedindo pra setar a env — sem inventar workaround.

---

## Como invocar

Skill instalada via plugin marketplace — usar `${CLAUDE_PLUGIN_ROOT}` que aponta pra raiz do plugin:

```bash
node "${CLAUDE_PLUGIN_ROOT}/plugins/marketing/skills/pesquisa-instagram/scripts/run.mjs" <username>
```

Alternativa portável (path relativo, se cwd já estiver na pasta da skill):
```bash
node ./scripts/run.mjs ericluciano
node ./scripts/run.mjs @G4educacao
node ./scripts/run.mjs https://instagram.com/anthropic
```

A skill aceita `username`, `@username` ou URL completo.

### Flags opcionais

| Flag | Default | Uso |
|------|---------|-----|
| `--posts N` | `12` | quantos posts puxar (max 50) |
| `--json` | (off) | imprime SÓ JSON, sem resumo legível |
| `--out arquivo.json` | (stdout) | grava output em arquivo |

---

## Output

Por padrão imprime DOIS blocos:

### 1. Resumo legível (markdown)
```
# @ericluciano — Eric Luciano

📊 Score: 87/100 (ALTA AUTENTICIDADE)
👥 12.4K seguidores · 487 seguindo · 312 posts
✅ Verificado · 🔗 expertintegrado.com.br
📝 "CEO Expert Integrado | Educador IA | G4 Educação"

Engajamento médio: 3.2% (saudável)
Último post: 2 dias atrás
Postagem últimos 60d: 12 posts

⚠️ Sinais de atenção: nenhum
```

### 2. JSON estruturado
```json
{
  "username": "ericluciano",
  "fullName": "Eric Luciano",
  "bio": "...",
  "followers": 12400,
  "following": 487,
  "posts": 312,
  "verified": true,
  "private": false,
  "businessAccount": true,
  "category": "Education",
  "externalUrl": "https://expertintegrado.com.br",
  "profilePicUrl": "...",
  "lastPosts": [
    { "shortcode": "...", "caption": "...", "likes": 412, "comments": 28, "date": "2026-05-03", "type": "image|video|carousel" }
  ],
  "metrics": {
    "engagementRate": 3.2,
    "avgLikes": 380,
    "avgComments": 22,
    "followerFollowingRatio": 25.5,
    "postsPerMonthRecent": 6
  },
  "score": {
    "total": 87,
    "band": "ALTA AUTENTICIDADE",
    "breakdown": {
      "engagement": 28,
      "ratio": 15,
      "completeness": 15,
      "consistency": 19,
      "verified": 10,
      "size": 0
    },
    "flags": []
  }
}
```

---

## Score de autenticidade — racional

Score 0-100, soma de 6 critérios. Banda final:

- **80-100**: ALTA AUTENTICIDADE — perfil saudável, ativo, engajamento real
- **50-79**: NORMAL — perfil legítimo, sem sinais óbvios
- **30-49**: SUSPEITO — engajamento fraco / inconsistente / perfil incompleto
- **0-29**: PROVAVELMENTE FAKE OU INATIVO — não confiar antes de checar manual

Detalhamento dos 6 critérios em [`docs/score-guide.md`](docs/score-guide.md).

> Score é **heurística**, não veredicto. Em caso de dúvida (lead high-ticket), sempre validar manualmente.

---

## Erros canônicos (já tratados pela skill)

| Erro | O que aconteceu | Skill faz |
|------|-----------------|-----------|
| `RATE_LIMIT` | Limite de requests no provedor | Retry com backoff (1s → 2s → 4s) até 3x |
| `TIMEOUT` | Sem resposta em 60s | Retry com backoff até 3x |
| `PROFILE_PRIVATE` | Perfil é privado | Retorna o que tem (header) + flag `private: true` |
| `PROFILE_NOT_FOUND` | Username não existe | Retorna erro estruturado, NÃO retry |
| `INVALID_TOKEN` | Token ausente/inválido | Falha imediata pedindo Eric setar a env |

---

## Anti-padrão (NÃO fazer)

- Tirar conclusão sobre identidade só pelo nome do perfil (sem cruzar com Pipedrive/empresa)
- Usar este score pra decidir "é bot" sozinho — checar manual o conteúdo dos posts em borderline
- Usar pra perfis privados — a info é incompleta, score perde sentido
