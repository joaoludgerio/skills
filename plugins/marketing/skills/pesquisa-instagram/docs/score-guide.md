# Score de autenticidade Instagram — guia interno

Heurística 0-100 para classificar perfis públicos do Instagram em 4 bandas. Usada pela skill `pesquisa-instagram`.

> **Não é veredicto.** É um sinalizador rápido pra priorizar atenção humana. Em decisões high-stakes (lead grande, palestrante de evento), validar manualmente os posts antes de agir.

---

## Por que essas variáveis?

A metodologia da Expert Integrado para auditoria de perfil público combina 6 sinais que, isolados, são fracos, mas em conjunto detectam com alta confiança perfis falsos, inflados ou inativos:

1. **Engagement rate** — bots compram seguidores, mas seguidores comprados não engajam. ER muito baixo numa conta grande, ou ER muito alto numa conta minúscula, são red flags.
2. **Follower:following ratio** — perfis fake tipicamente seguem >1k mas têm <500 seguidores (estratégia de follow-back).
3. **Profile completeness** — bots não preenchem bio, link, foto.
4. **Posting consistency** — conta dormente ou nunca postou enfraquece o sinal.
5. **Verified badge** — bonus, não obrigatório.
6. **Account size sanity** — penaliza combinações ruins (ex: 10K seguidores + 0 posts = quase certeza de conta comprada).

---

## Os 6 critérios

### 1. Engagement rate (0-30 pts)

`ER = (avg likes + avg comments) / followers × 100`

| ER % | Pts | Leitura |
|------|-----|---------|
| 1-6 | 30 | doce — engajamento natural |
| 0.5-1 ou 6-12 | 22 | ok — extremo de tier (conta grande / nicho) |
| 0.1-0.5 | 12 | baixo — conta inflada ou audiência morta |
| >12 | 10 + flag | suspeito — bot bombing ou conta minúscula |
| <0.1 | 2 + flag | morta |
| sem posts | 0 + flag | impossível medir |

> Benchmarks de mercado: nano-influencer (<10k) ~5-7%, micro (10-100k) ~2-4%, macro (100k-1M) ~1-2%, mega (>1M) ~0.5-1%.

### 2. Follower:following ratio (0-15 pts)

| Ratio | Pts | Leitura |
|-------|-----|---------|
| ≥2:1 | 15 | influenciador estabelecido |
| 1-2:1 | 12 | balanceado |
| 0.5-1:1 | 8 | normal pra conta pessoal |
| 0.2-0.5:1 | 4 + flag | follow-back farming provável |
| <0.2:1 | 2 + flag | classic perfil de spam |
| segue 0, tem seguidores | 12 (se >100) ou 6 | conta-âncora (CEO, marca) |

### 3. Profile completeness (0-15 pts)

3 pontos por item presente:

- bio com ≥10 caracteres
- foto de perfil
- link externo
- nome (fullName)
- categoria de negócio OU `isBusinessAccount = true`

Se ≤6 pontos, dispara flag.

### 4. Posting consistency (0-20 pts)

Conta posts dos últimos 60 dias.

| Posts em 60d | Pts |
|--------------|-----|
| ≥8 | 20 |
| 4-7 | 16 |
| 2-3 | 11 |
| 1 | 7 |
| 0 mas tem posts antigos | 3 + flag se >180d |
| 0 e nunca postou | 0 + flag forte |

### 5. Verified badge (0-10 pts)

Tem ✓ azul = 10. Não tem = 0. Não é obrigatório (a maioria dos perfis legítimos não tem), por isso peso baixo.

### 6. Account size sanity (0-10 pts)

| Condição | Pts |
|----------|-----|
| ≥100 seguidores E ≥5 posts | 10 |
| ≥30 seguidores E ≥3 posts | 6 |
| ≥1 seguidor E ≥1 post | 3 |
| qualquer 0 | 0 + flag |
| **>1000 seguidores E 0 posts** | **0 + flag forte** ("perfil fantasma/comprado") |

---

## Bandas finais

| Total | Banda | O que fazer |
|-------|-------|-------------|
| 80-100 | ALTA AUTENTICIDADE | seguir adiante sem cerimônia |
| 50-79 | NORMAL | ok pra prospecção, sem ressalva |
| 30-49 | SUSPEITO | olhar manual antes de incluir em lista grande |
| 0-29 | PROVAVELMENTE FAKE OU INATIVO | não usar; se for lead, marcar e descartar |

---

## Limitações conhecidas

- **Perfis privados**: actor retorna só header, não dá pra calcular ER nem consistência. Score fica baixo artificialmente — banda fica "SUSPEITO" mesmo pra contas legítimas privadas. **Não confiar no score para perfis privados.**
- **Comentários genéricos** ("nice!", "🔥🔥🔥"): não detectamos qualidade dos comments. Bots modernos compram comments em massa. Pra detectar, olhar manualmente os textos.
- **Engajamento por podcast/colab**: posts em colab inflam likes. Score não distingue.
- **Idade da conta**: actor não retorna data de criação. Conta nova com seguidores pode ser legit (lançamento) ou comprada — score não diferencia.

Em caso de borderline, **abrir o perfil no navegador** e olhar os 5 últimos posts. Custa 30 segundos e resolve.

---

## Como o score evolui

Versão atual: 1.0.0 (2026-05-05).

Mudanças quebram comparabilidade histórica de score. Se precisar revisar:
- Subir versão major se mudar pesos
- Subir minor se adicionar critério novo
- Documentar diff aqui
