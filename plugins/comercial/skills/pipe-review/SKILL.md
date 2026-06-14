---
name: pipe-review
description: Use quando Eric pedir pra rodar o radar comercial, "pipe review", dashboard de higiene CRM, checagem da disciplina/diligência dos vendedores nos pipelines (Super SDR / Educacional / SaaS), ou o relatório pré pipe review das 8h. Gera dashboard HTML auditando deals abertos do Pipedrive contra 5 regras de higiene e faz deploy em pipe-review.vercel.app. NÃO usar pra criar/editar deal específico, reabordar leads, agendar call, ou transferir lead — essas são outras skills do plugin comercial.
---

# Pipe Review — Radar Comercial

Skill autocontida que roda o Radar Comercial (pré pipe review das 8h) direto da máquina, sem SSH e sem script externo. Tudo vive em `scripts/radar.cjs` dentro da própria skill.

---

## CONTEXTO

- Lê **deals abertos** dos pipelines **SaaS** (1), **Super SDR** (2) e **Educacional** (6) no Pipedrive
- Aplica **5 regras de higiene** determinísticas (sem LLM — números 100% reproduzíveis)
- Gera dashboard HTML dark-theme com **gráficos SVG inline** (sem CDN, sem JS client-side → renderiza igual sempre)
- Faz **deploy de produção** no projeto Vercel `pipe-review` → alias canônico `https://pipe-review.vercel.app`
- **O Claude é a voz** — lê o JSON de saída do script e reporta pro Eric (1 evento = 1 mensagem)

## 5 REGRAS DE HIGIENE CRM

| # | Regra | O que verifica |
|---|-------|----------------|
| 1 | Sem empresa | Deal sem Organization vinculada (`org_id`) |
| 2 | Sem email | Person sem email cadastrado |
| 3 | Sem telefone | Person sem telefone cadastrado |
| 4 | Sem atividade aberta | Deal sem próxima atividade agendada (`next_activity_date`) — anti-padrão #1 |
| 5 | Estagnado +3d úteis | Deal sem update há 3+ dias úteis (zumbi) |

Cada deal vira uma linha na tabela com chips coloridos por pendência. Deals sem nenhuma flag = higiene OK.

## GRÁFICOS (SVG inline, determinísticos)

| Gráfico | O que mostra |
|---------|--------------|
| Donut | % do funil-alvo com pendência (laranja) vs OK (verde) |
| Barras horizontais | nº de deals afetados por cada uma das 5 regras |
| Barras empilhadas | pendência vs OK por pipeline (SaaS / Super SDR / Educacional) |

Sem dependência de CDN ou JavaScript no cliente — o SVG é montado server-side no `radar.cjs`, então o render é idêntico em qualquer navegador/print.

## PROTOCOLO DE EXECUÇÃO

### Passo 1: Rodar o script

O script é autocontido em `scripts/radar.cjs` (relativo à pasta da skill). Tokens vêm do **1Password** (vault `Agentes Eric`) — nunca hardcodar.

Via Bash tool (sintaxe que funciona com `op read` inline):

```bash
cd "<skill-dir>/scripts" && \
PD_TOKEN="$(op read 'op://Agentes Eric/PIPEDRIVE_API_KEY/credential')" \
VT="$(op read 'op://Agentes Eric/VERCEL_API_TOKEN/credential')" \
node radar.cjs
```

`<skill-dir>` quando instalada via marketplace (PC do Eric):
`C:/Users/Eric Luciano/.claude/plugins/marketplaces/expertintegrado/plugins/comercial/skills/pipe-review`

Não hardcodar esse caminho num comando — derivar do diretório da própria skill em execução (o `SKILL.md` que está sendo lido). O `scripts/radar.cjs` fica sempre em `<skill-dir>/scripts/radar.cjs`, qualquer que seja a máquina ou o usuário.

**Tokens aceitos (qualquer um dos aliases):**
- Pipedrive: `PD_TOKEN` | `PIPEDRIVE_API_TOKEN` | `PIPEDRIVE_API_KEY`
- Vercel: `VT` | `VERCEL_API_TOKEN` | `VERCEL_TOKEN`

**Flags opcionais (env):**
- `RADAR_NO_DEPLOY=1` → só fetch + build, pula o deploy (útil pra testar mudança de layout)
- `RADAR_PIPELINES="1:SaaS,2:Super SDR,6:Educacional"` → sobrescreve os pipelines-alvo (csv `id:nome`)
- `RADAR_PROJECT="pipe-review"` → nome do projeto Vercel
- `RADAR_OUT="<dir>"` → dir de saída (default `os.tmpdir()/radar-skill`)

### Passo 2: Capturar do output

O script imprime **um JSON** no stdout. Campos relevantes:

```json
{
  "total": 133, "totalAbertos": 819, "comPendencia": 97, "ok": 36,
  "r1": 43, "r2": 24, "r3": 0, "r4": 8, "r5": 78,
  "byPipeline": { "SaaS": {...}, "Super SDR": {...}, "Educacional": {...} },
  "deploy": { "id": "dpl_...", "url": "https://pipe-review-XXX.vercel.app" },
  "canonical": "https://pipe-review.vercel.app"
}
```

Artefatos também ficam em `RADAR_OUT`: `index.html` (o dashboard) e `data.json` (deals + flags detalhados).

### Passo 3: Reportar pro Eric (1 mensagem só)

Por padrão o Claude reporta **na própria conversa**. Formato sugerido:

```
Radar Comercial — DD/MM HH:MM (BRT)

https://pipe-review.vercel.app

- <total> deals nos funis-alvo (de <totalAbertos> abertos)
- <comPendencia> com pendência, <ok> com higiene OK
- Top regra: <regra com maior contagem> (<n> deals)
```

Sempre referenciar a **URL canônica** `https://pipe-review.vercel.app`, não o `pipe-review-XXX.vercel.app` (esse é só o artefato do build).

Se o Eric estiver fora do Claude Code (pediu por outro canal), notificar via o canal canônico de avisos assíncronos: grupo WhatsApp **"Notificações dos Agentes"** (`chat_id 120363428759906229-group`) usando o MCP `whatsapp-agent` com `instance: "profissional"` (dispara do telefone corporativo; Eric lê do pessoal). Se bater no gate de inbound recente, reenviar com `force_send_after_inbound: true`. Detalhes na memória `canal-notificacoes-eric.md`.

### Passo 4: Logar só se houve desvio

Anotar em `tasks.md` ou `log.md` **apenas** se algo falhou (deploy Vercel ≥300, Pipedrive 429, token ausente). Execução limpa não precisa de log.

## CRON (autônomo, opcional)

O `radar.cjs` não dispara notificação sozinho — quem fala é o Claude. Pra modo cron autônomo (sem Claude), agendar a execução e parsear o JSON num wrapper que notifique. Hoje o fluxo canônico é **skill-mode interativo** (Eric pede → Claude roda → Claude reporta).

## REGRAS IMPORTANTES

1. **Tokens só do 1Password** (vault `Agentes Eric`) — nunca hardcodar, nunca commitar secret
2. **Números são determinísticos** — sem LLM no caminho; mesma base = mesmo resultado
3. **URL canônica é `https://pipe-review.vercel.app`** — o `pipe-review-XXX.vercel.app` é só build artifact
4. **Deploy é side-effect de produção** — em modo interativo Eric já pediu pra rodar (consentimento implícito); em automação, confirmar antes
5. **Acentuação correta** em qualquer texto pro Eric
6. **1 evento = 1 mensagem** — Claude consolida o report, não spama
