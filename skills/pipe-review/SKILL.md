---
name: pipe-review
description: Roda o Radar Comercial diário do Eric (5 regras de higiene CRM Pipedrive + dashboard Vercel + LLM eval qualitativa). Pega deals abertos dos pipelines Super SDR/Educacional/SaaS, classifica em OK/pendência, gera HTML dark-theme, faz deploy em pipe-review.vercel.app, e o Claude responde no Telegram com link + stats. TRIGGER quando Eric pedir pra rodar o radar comercial, pipe review, dashboard de higiene CRM, ou checagem da disciplina dos vendedores.
---

# Pipe Review — Radar Comercial

Skill que executa o Radar Comercial diário (pré pipe review das 8h) e responde no Telegram do Eric com 1 mensagem só.

---

## CONTEXTO

- Roda seg-sex às 7h30 BRT (cron na VPS)
- Lê deals abertos dos pipelines **Super SDR**, **Educacional** e **SaaS** no Pipedrive
- Aplica 5 regras de higiene + LLM eval qualitativo nos campos texto
- Gera dashboard HTML dark-theme + faz deploy em `https://pipe-review.vercel.app`
- **Quem manda mensagem no Telegram é o Claude (não o script)** — 1 evento = 1 mensagem

## 5 REGRAS DE HIGIENE CRM

| # | Regra | O que verifica |
|---|-------|----------------|
| 1 | Sem empresa | Deal sem Organization vinculada |
| 2 | Sem email | Person sem email cadastrado |
| 3 | Sem telefone | Person sem telefone cadastrado |
| 4 | Sem atividade aberta | Deal sem próxima atividade agendada (anti-padrão #1) |
| 5 | Estagnado +3d úteis | Deal sem update há 3+ dias úteis (zumbi) |

LLM também avalia qualidade de campos texto (briefing, dores, objetivos) e aponta pendências semânticas.

## PROTOCOLO DE EXECUÇÃO

### Passo 1: Rodar o script com notificações suprimidas

```bash
cd /workspace/temp/radar-comercial
TELEGRAM_CHAT_ID="" ZOOM_CHANNEL_ID="" node radar.js
```

**Por que suprimir:** o `radar.js` tem envio de Telegram/Zoom hardcoded. Quando rodado pelo Claude, NÃO queremos que ele mande direto — o Claude orquestra a resposta. Em modo cron autônomo, deixar as env vars preenchidas pra ele notificar sozinho.

### Passo 2: Capturar do output

Da última linha relevante, extrair:
- **URL Vercel** do "Deploy concluido: <url>"
- **Stats** das linhas "Deals nos funis...", "Analise concluida: X com pendencia, Y OK"
- **LLM cache hits** ("LLM: X avaliacoes feitas, Y reutilizadas")

### Passo 3: Reply no Telegram (1 mensagem só)

Formato sugerido:

```
📊 Radar Comercial — DD/MM HH:MM

🔗 https://pipe-review.vercel.app
(deploy live: <url do build atual>)

• <total> deals nos funis alvo (de <total_abertos> abertos)
• <com_pendencia> com pendência, <ok> OK
• LLM: <novas> novas / <cache> reutilizadas
```

Mandar via `mcp__plugin_telegram_telegram__reply` com `chat_id="1028671416"`.

### Passo 4: Logar resultado

Anotar em `tasks.md` ou `log.md` apenas se houve erro ou desvio (ex: deploy Vercel falhou, Pipedrive deu 429).

## ENV VARS NECESSÁRIAS (radar.js)

Em `/workspace/temp/radar-comercial/.env`:
- `PIPEDRIVE_API_TOKEN`
- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID` (default: `prj_9dZcqlstcvofIzUz5yXz2AvQvzzC`)
- `ANTHROPIC_API_KEY` (LLM eval)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — SÓ pra modo cron autônomo (não-Claude)
- `ZOOM_CHANNEL_ID` — idem

Em modo skill (Claude orquestrando), forçar `TELEGRAM_CHAT_ID=""` e `ZOOM_CHANNEL_ID=""` na chamada pra evitar duplicação.

## CRON (autônomo, sem Claude)

Pra rodar todo dia útil às 7h30 BRT (10:30 UTC):

```
30 10 * * 1-5 cd /workspace/temp/radar-comercial && /usr/local/bin/node radar.js >> /var/log/radar.log 2>&1
```

Nesse modo, o script notifica direto o Telegram + Zoom (env vars preenchidas).

## REGRAS IMPORTANTES

1. **Em modo skill (Claude executando), suprimir TELEGRAM_CHAT_ID e ZOOM_CHANNEL_ID** pra evitar mensagem duplicada
2. **1 evento = 1 mensagem no Telegram** — Claude é a voz quando ele orquestra
3. **NÃO commitar `.env`** — secrets ficam locais por máquina
4. **URL canonical é `https://pipe-review.vercel.app`** — sempre referenciar essa, o `pipe-review-XXX.vercel.app` é só o build artifact
5. **Acentuação correta** em qualquer texto pro Eric
