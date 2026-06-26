---
name: orquestrar-conteudo
description: Cria conteúdo (site/landing page, post de Instagram — carrossel/reel, copy+design juntos) orquestrando um time de subagentes em paralelo no Claude Code (padrão Agent Teams/OpenSquad): Estrategista → Copywriter ∥ Designer → Revisor. Imagens via OpenAI Images API, vídeo via HeyGen (skill `video`), deploy Vercel. TRIGGER quando Eric pedir "cria um site", "faz uma landing", "monta um post/carrossel/reel pro Instagram", "cria conteúdo", "produz uma peça".
---

# orquestrar-conteudo — Fábrica de conteúdo multi-agente (Claude Code)

Porta da skill homônima que rodava no OpenClaw (Fred + `sessions_spawn`) para o **Claude Code nativo**.
Mantém a arquitetura validada (paralelismo Copywriter ∥ Designer, contrato único de briefing, schemas,
circuit breakers) e troca o mecanismo de orquestração para o **Agent tool** do Claude Code — o mesmo
padrão "Agent Teams" do OpenSquad, só que com subagentes nativos.

**v3.5 (merge jun/2026):** absorveu o melhor do squad `conteudo-instagram` (OpenSquad de referência):
papel **Estrategista** formal antes do spawn, **checkpoints adaptativos por risco**, **checklist de
revisão + escala de qualidade** no Revisor e **estrutura prescritiva de copy de Instagram**. Sem perder
o que a skill já tinha de melhor: paralelismo real, 3 pipelines, deploy Vercel, HeyGen e o protocolo de
export validado em produção.

## Quando usar
- Criar um **site / landing page** (com ou sem vídeo HeyGen)
- Criar **post de Instagram** (carrossel, reel ou ambos)
- Qualquer conteúdo que combine **copy + design** juntos

Ativação automática — não precisa nomear a skill.

---

## Arquitetura (padrão Agent Teams)

**Por que multi-agente, e não fazer tudo na sessão principal?**
- A sessão principal fica presa 10-20 min sem responder o Eric — inaceitável.
- Copy e imagens são tarefas **independentes** — paralelismo real economiza ~35% do tempo.
- Referência: Anthropic "Building Effective Agents" → padrão *Parallelization (Sectioning)*.

**Fluxo canônico (4 papéis):**

```
Fase 0  Estratégia      sessão principal monta briefing.json     → [checkpoint adaptativo]
Fase 1  Produção        Copywriter ∥ Designer (mesma mensagem)    → [checkpoint adaptativo]
Fase 2  Montagem        sessão principal injeta copy nos tokens
Fase 3  Revisão         Revisor (obrigatório no Instagram)        → aplica ajuste
Fase 4  Export/Deploy   PNGs (Instagram) ou Vercel (site)
```

**Como orquestrar no Claude Code (substitui `sessions_spawn` do OpenClaw):**
- Use a tool **Agent** para abrir cada subagente. Para rodar em paralelo, dispare as chamadas
  Agent **na mesma mensagem** (múltiplos `Agent` num bloco só) — elas executam concorrentemente.
- Cada subagente recebe TODO o material no prompt (briefing completo). O final message dele É o
  output — peça que devolva **JSON** no schema definido (use `Agent` sem schema e instrua o formato,
  ou modele o retorno como bloco JSON no final).
- Para jobs longos sem travar a conversa, use `run_in_background: true` e colete quando terminarem.
- Alternativa de orquestração determinística (loops/fan-out): a tool **Workflow** (`pipeline`/`parallel`).

**Papéis:**
| Papel | Quem executa | Função | Modelo |
|---|---|---|---|
| **Estrategista** | sessão principal (Fase 0) | define objetivo, público, ângulo/pauta, formato, CTA → monta `briefing.json` | sessão |
| Copywriter | `exp-copywriter` | copy de todas as seções/slides + script HeyGen | execução (sonnet) |
| Designer | `exp-designer` | imagens (skill `imagem`) + HTML/slides + deploy v1 | execução (sonnet) |
| Revisor | `exp-ger-marketing` | revisão editorial + score — **obrigatório no Instagram** | rápido (haiku) |

> O Estrategista NÃO é um subagente — é a própria sessão principal pensando antes de disparar. Formalizá-lo
> como fase explícita evita briefing raso (a causa nº 1 de subagente "completando" errado). Só vire subagente
> dedicado se o Eric pedir um plano de pauta separado.
> Não force model exótico; deixe inerir o modelo da sessão. Só baixe pra um modelo rápido no
> Revisor (revisão simples). Suba pra Opus apenas se o Eric pedir.

**Regra de profundidade:** o Revisor NUNCA abre subagentes (mantém profundidade rasa). O Designer
pode chamar a skill `imagem`/`video` como ferramenta, não como novo subagente-orquestrador.

---

## Checkpoints adaptativos por risco (NÃO bloquear à toa)

O squad de referência usava 4 checkpoints **bloqueantes** (esperava aprovação humana entre cada agente).
Aqui o default é **fluxo contínuo** — a velocidade é a vantagem da skill. Pare pra validar com o Eric
**só** quando o job é caro ou arriscado:

| Situação | Checkpoint? |
|---|---|
| Carrossel/landing rotina, brief claro | **Não** — segue direto até a entrega |
| Site com vídeo HeyGen (custo + tempo alto) | **Sim, antes do spawn** — confirma pauta/ângulo + CTA |
| Tema sensível, cliente, ou 1ª vez de um formato novo | **Sim, antes do spawn** — valida o briefing |
| Copy ficou longa/cara de produzir antes de gerar N imagens | **Sim, antes do design caro** — valida a copy |
| Risco reputacional (números, claims) | Revisor cobre — não precisa parar o Eric |

Checkpoint = uma pergunta curta e objetiva ("ângulo X, CTA Y, fecho?"), nunca um interrogatório. Na dúvida
entre parar e seguir num job barato: **siga** (é mais barato refazer que travar o Eric).

---

## Anti-padrões (não violar)
- **Sem "steering" destrutivo:** todo o material vai no briefing ANTES de abrir o subagente. Se o
  Eric ainda está mandando fotos/contexto: ESPERE ele terminar, só então dispare.
- **Material tardio:** chegou foto/CTA novo depois do spawn? Salve em `handoffs/<slug>/late/`,
  espere os agentes, e faça patch no HTML + redeploy (ou respawn do Designer se for crítico).
- **Mudança de direção mid-flight:** se o Eric muda requisito fundamental durante a execução,
  pare os subagentes, atualize o briefing e redispare. Melhor refazer barato que entregar errado.
- **Briefing raso:** não disparar subagente com `context` vazio ou pauta genérica — Fase 0 existe pra isso.
- **Escrita atômica** de arquivos de output: escreve `.tmp` → renomeia pro `.json` final.

---

## Detecção de pipeline

| Eric pede… | Pipeline | Vídeo? |
|---|---|---|
| Site / landing + vídeo | `site` | sim |
| Site / landing (sem mencionar vídeo) | `landing-rapida` | não |
| Post Instagram / carrossel / reel | `instagram` | opcional |

Workspace do job: `C:/tmp/conteudo/<slug>/` (ou subpasta `handoffs/<slug>/` do projeto). Copie pra
lá todas as fotos/assets antes de começar.

---

## Fase 0 — Estratégia (sessão principal, antes de qualquer subagente)

Antes de montar o `briefing.json`, responda (do contexto do Eric, recall no Brain, ou perguntando só o que faltar):

1. **Objetivo** — o que esse conteúdo precisa fazer? (educar, gerar lead, autoridade, lançar algo)
2. **Público** — pra quem? (dono de restaurante, gestor comercial, aluno…)
3. **Ângulo/pauta** — qual a tese central? Qual o gancho que para o scroll?
4. **Formato** — pipeline + nº de slides/seções + tem foto editada do Eric?
5. **CTA** — uma ação específica (seguir @, link, agendar). Nunca CTA genérico.

Esses 5 viram os campos do contrato. Brief raso = subagente entrega errado.

---

## Brand-kit (carregar ANTES do briefing)
A identidade visual NÃO é hardcoded — vem de um **brand-kit por perfil-alvo**, em `brand-kits/`:
- `brand-kits/ericluciano.md` — perfil pessoal **@ericluciano** (dark + azul/ciano tech)
- `brand-kits/expertintegrado.md` — empresa **@expertintegrado** (azul royal + roxo/magenta)
- Outro perfil (ex. @empresariolivre): **criar `brand-kits/<perfil>.md` antes** — NUNCA reusar a marca de outro perfil.

Leia o kit do alvo e use a paleta + tipografia dele pra preencher `color_palette` e `brand_rules` do briefing. Os hex dos kits são **aproximados (do visual do IG)**; se o Eric tiver os valores/fontes oficiais, eles têm prioridade.

---

## Contrato único — `briefing.json`
Saída da Fase 0. Contrato que TODOS os subagentes leem:

```json
{
  "slug": "<slug>",
  "pipeline": "site|landing-rapida|instagram",
  "heygen_video": true,
  "objective": "<o que o conteúdo precisa fazer>",
  "target_audience": "<público>",
  "angle": "<tese central / gancho>",
  "tone": "educador, direto, sem hype",
  "color_palette": ["#0D1B2A", "#1B2838", "#FFFFFF", "#C9A227"],
  "cta": {"text": "<CTA>", "url": "<url ou #inscrever>"},
  "sections_required": ["hero", "sobre", "features", "cta-final"],
  "eric_photos": ["<paths das fotos, se houver>"],
  "brand_rules": "azul escuro + preto, Playfair Display + DM Sans, sem emojis, mobile-first",
  "image_specs": [
    {"prompt": "<prompt>", "aspect_ratio": "16:9", "output_path": "<saida.png>", "type": "edit|generate", "input_path": "<foto ou null>"}
  ],
  "context": "<diferenciais, referências, observações do Eric>"
}
```
Se `eric_photos` está vazio: o Designer só usa `type: "generate"` (imagens conceituais). NUNCA `edit` sem foto de input.

---

## Pipeline `landing-rapida` (sem vídeo) — ~4-6 min
1. Sessão principal monta o `briefing.json` completo.
2. Abre **só o Designer** (1 Agent). Ele gera as imagens, escreve a copy a partir do briefing, monta o HTML e faz deploy v1.0.
3. Sessão principal confirma o deploy (HTTP 200) e devolve a URL ao Eric.

Sem coordenação entre agentes = mais barato e rápido.

---

## Pipeline `site` (com vídeo HeyGen) — v1.0 ~8 min, v2.0 ~13 min
1. **Preparação:** sessão principal espera o Eric terminar de mandar material, define `slug`, copia assets, monta `briefing.json`. **Checkpoint antes do spawn** (custo alto) — confirma pauta/ângulo + CTA.
2. **Spawn paralelo (mesma mensagem, 2 Agents):**
   - **Copywriter:** copy de todas as seções + script HeyGen (60-90s). Salva `copywriter-output.json` ANTES de disparar o render do vídeo (circuit breaker).
   - **Designer:** gera imagens → espera/lê a copy → monta HTML → deploy v1.0.
3. **Coleta + validação de schema** (abaixo). Se faltou campo → reportar.
4. **Notificar v1.0:** confirmar `curl` HTTP 200 → mandar URL ao Eric.
5. **v2.0 (vídeo):** a sessão principal baixa o MP4 do HeyGen, faz patch da `<video>` no HTML e redeploy. Se o vídeo atrasar, v1.0 já está no ar; atualiza quando chegar.

---

## Pipeline `instagram`
1. **Spawn paralelo (mesma mensagem, 2 Agents):**
   - **Copywriter** → legenda + slides do carrossel, retornando JSON `{caption, hashtags, slides:[{n,title,body}]}`, seguindo a **estrutura de copy** abaixo. **Copy SEMPRE com acentuação correta do português** — NÃO devolver sem acento (erro recorrente; se vier sem acento, a sessão principal corrige na montagem).
   - **Designer** → constrói `carrossel.html` com N `<section id="slide-N">` de **1080×1080** empilhadas, estilo do brand-kit, usando **tokens** `{{SLIDEn_TITLE}}` / `{{SLIDEn_BODY}}` no lugar do texto (NÃO escreve a copy final — só o template visual). **Sempre incluir no CSS** `html{scrollbar-width:none} html::-webkit-scrollbar{display:none}` pra a barra de rolagem não vazar no screenshot.
     **Quando o carrossel usa fotos editadas do Eric (eric_photos preenchido):** variar o layout por slide — não usar o mesmo template para todos. Padrões validados: capa fullscreen com gradient dramático; foto direita (blended gradient); foto esquerda (invertida, texto à direita); fullscreen como bg com stat cards; CTA fullscreen com overlay. Isso cria ritmo visual e cada slide se sustenta sozinho no feed. Com fotos editadas, preferir **5 slides** (capa + 3 conteúdo + CTA) em vez de 8 — menos copy por slide, mais impacto visual.
2. **Montagem (sessão principal):** injeta a copy do Copywriter nos tokens → `carrossel-final.html`; confere que sobraram **0** `{{`.
3. **Revisor (`exp-ger-marketing`) OBRIGATÓRIO** — risco reputacional. Roda o checklist + score (abaixo), aprova/reprova e aplica o ajuste antes de exportar.
4. **Export** (protocolo abaixo) → **N PNGs de 1080×1080, 1 por slide**.
5. Devolve os PNGs + legenda ao Eric. Carrossel NÃO vai pra Vercel.

### Estrutura de copy do Instagram (Copywriter segue)
**Legenda:**
```
[HOOK — 1ª linha que para o scroll; sem rodeio]
[Corpo — 3-5 parágrafos curtos, 1-3 linhas cada]
[CTA específico — uma ação clara]
[Hashtags — 8-20, separadas por espaço, no fim]
```
**Slides:** título curto e forte (não é frase inteira) + corpo enxuto. Capa = gancho; slides do meio = 1 ideia cada; último = CTA. Voz do Eric: 1ª pessoa, direto, dados quando der, **zero buzzword** (`revolucionário`, `game-changer`, `transformador`, `disruptivo`, `mindset`).

### Protocolo de export do carrossel (CRÍTICO — validado em produção jun/2026)

**NUNCA usar MCP Playwright para este export.** O MCP roda em `deviceScaleFactor` ~1.333, o que causa dois bugs combinados:
- `window.scrollTo(0, N*1080)` não funciona — body com `gap` ou `padding` desloca os slides de múltiplos exatos de 1080px; a área capturada fica cortada
- Element locator (`#slide-N`) em slides distantes do viewport produz screenshot em branco (imagens não renderizadas pelo browser)

**Método validado: Python Playwright com `device_scale_factor=1`.**

Servidor HTTP e script Python **obrigatoriamente no mesmo Bash call** — o Bash tool não persiste processos entre chamadas.

```bash
cd "C:/tmp/conteudo/<slug>" && python -m http.server <porta> --bind 127.0.0.1 &
SERVER_PID=$!
sleep 2

python - << 'PYEOF'
import asyncio, os
from playwright.async_api import async_playwright

OUTPUT = "C:/Users/Eric Luciano/OneDrive/Workspace/temp/<slug>"
os.makedirs(OUTPUT, exist_ok=True)

async def export():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1080, "height": 1080},
            device_scale_factor=1          # CRÍTICO — garante 1080px reais, não 1440px
        )
        page = await ctx.new_page()
        await page.goto("http://127.0.0.1:<porta>/carrossel-final.html")
        await page.add_style_tag(content="""
            body { padding: 0 !important; gap: 0 !important; }
            html, body { scrollbar-width: none !important; overflow-x: hidden !important; }
            html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }
        """)
        await page.wait_for_function(
            "() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)"
        )
        for i in range(1, N+1):          # N = número de slides
            out = f"{OUTPUT}/slide-{i}.png"
            await page.locator(f"#slide-{i}").screenshot(path=out, type="png")
        await browser.close()

asyncio.run(export())
PYEOF

kill $SERVER_PID 2>/dev/null
```

Conferir tamanhos com `ls -la` — cada PNG deve ter dimensão variada (300KB–1MB); tamanhos todos iguais indicam falha no carregamento da imagem.

---

## Geração de imagens
**Primário:** a skill **`imagem`** do lab (já encapsula o gerador de imagem). 
**Direto (se preferir API):** OpenAI Images API com `OPENAI_API_KEY` (1Password `op://Agentes Eric/OPENAI_API_KEY/credential` ou env):
- Gerar: `POST /v1/images/generations` (model `gpt-image-2`)
- Editar (colocar o Eric em outro contexto): `POST /v1/images/edits` (model `gpt-image-2`) com a foto real como input
**Regras de identidade:** rosto do Eric → SEMPRE `edit` com foto real de referência; nunca gerar o rosto dele do zero. Sem rosto → `generate`.

**Banco de fotos do Eric (mesma fonte da skill `tweet-print`):** `C:\Users\Eric Luciano\OneDrive\Imagens\Perfil profissional\`
- `Avatar.jpg` — headshot/avatar (idêntico ao que a `tweet-print` usa; compatível com a env `TWEET_PRINT_DEFAULT_AVATAR`).
- Ensaios pra `edit` (corpo/contexto): `Legacy -*.jpg`, `PPGX_SouMemoravel*.jpg`, `Eric (imersão High Ticket) 4.jpg`.
- A pasta sincroniza via OneDrive → mesmo caminho vale no PC e no notebook. Em outra máquina, sobrepor com a env `ERIC_FOTOS_DIR`.
- Antes de um `edit`, escolher a foto cujo enquadramento/roupa melhor casa com o resultado desejado; passar o caminho dela em `image_specs[].input_path`.
Serialize as chamadas (1 imagem por vez) e trate rate limit (429 → espera Retry-After + 5s, máx 3 retries; fallback: foto real sem edição).

## Vídeo
Use a skill **`video`** do lab (HeyGen). Regras: baixar o MP4 **imediatamente** (URL HeyGen expira ~1h) e comprimir com `ffmpeg` (~5MB) antes do deploy.

## Deploy (sites)
Vercel via `VERCEL_TOKEN` (1P/env): `npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"`. Desabilitar SSO após o deploy. Payload >10MB → usar file upload API. Confirmar HTTP 200 antes de avisar o Eric.

---

## Schemas (minimum viable output)
**Copywriter:** `{ status, pipeline, project_slug, headline, sub_headline, sections[], cta_link, heygen_script, mp4_path|null, video_url|null, video_error|null, timestamp }` — mínimo: seções `hero` + `cta-final`. **Toda a copy com acentuação correta do português.**
**Designer:** `{ status: "done|preview", pipeline, project_slug, html_path, images_generated[], video_embedded, deploy_v1_url, timestamp }`.
**Revisor:** `{ score: 1-10, status: "aprovado|aprovado-com-ajustes|reprovado", checklist: {...}, ajustes_aplicados: [], timestamp }`.

Se o Copywriter não entregar em ~8 min: o Designer gera **copy derivado do briefing** (nunca placeholder genérico) e sobe **v1.0-preview**; avisa o Eric que o copy final atualiza depois.

---

## Revisor — checklist + escala de qualidade (Instagram, obrigatório)

O Revisor (`exp-ger-marketing`) roda este checklist sobre `carrossel-final.html` + legenda ANTES do export:

**Tom de voz (bloqueante):**
- [ ] Acentuação correta do português em TUDO (erro de acento = reprova, conserta e re-checa)
- [ ] 1ª pessoa do singular, direto, sem rodeio
- [ ] Zero buzzword (`revolucionário`, `game-changer`, `transformador`, `disruptivo`, `mindset`, `hype`)
- [ ] Sem emoji

**Conteúdo (bloqueante):**
- [ ] Número/claim → tem fonte ou é experiência real do Eric? Sem fonte = remover ou suavizar
- [ ] Urgência manufaturada ("só hoje", "última chance" sem motivo real) = remover
- [ ] CTA específico e único (não genérico)
- [ ] Hook da capa para o scroll de verdade

**Visual:**
- [ ] 0 tokens `{{` sobrando no HTML
- [ ] Layout varia entre slides quando há foto editada
- [ ] Brand-kit respeitado (paleta + tipografia)

**Escala:**
| Score | Classificação | Ação |
|---|---|---|
| 9-10 | Excelente | Aprovar e exportar |
| 7-8 | Bom | Aprovar **com ajustes** — aplicar e exportar |
| < 7 | Insuficiente | **Reprovar** — corrigir e re-revisar antes de exportar |

Item bloqueante violado derruba o score pra < 7, independente do resto. O Revisor aplica o ajuste e
devolve o `status` — a sessão principal só exporta com score ≥ 7.

---

## Lições aprendidas (herdadas da v2.2 OpenClaw + merge jun/2026)
- Briefings explícitos com schema evitam subagente "completando" cedo demais. **Fase 0 (Estrategista) é o seguro contra brief raso.**
- Rate limit de imagem: serializar + backoff.
- Vercel: payload 10MB → file upload API; sempre desabilitar SSO.
- HeyGen: baixar MP4 na hora (expira ~1h).
- Revisor só no Instagram; sites a sessão principal fecha a v2.0 direto.
- **Carrossel com fotos editadas → variar layout por slide** (validado em produção, jun/2026): foto direita, foto esquerda, fullscreen bg, stats cards — cada slide com composição distinta. Slides uniformes desperdiçam o impacto visual das fotos geradas.
- **5 slides é o sweet spot para carrossel com fotos do Eric** (vs 8 slides de copy pura): menos texto por slide, foto ocupa mais área, ritmo mais ágil no swipe.
- **MCP Playwright quebra o export de carrossel** (validado jun/2026): DPR ~1.333 → `window.scrollTo` captura área errada; element locator de slides distantes retorna branco. Fix definitivo: Python Playwright com `device_scale_factor=1` + `locator("#slide-N").screenshot()`, servidor HTTP e Python no mesmo Bash call (processos não persistem entre chamadas).
- **Checkpoint bloqueante por padrão mata a velocidade** (lição do merge): o squad de referência parava em 4 pontos; aqui só parar quando o job é caro/arriscado (ver tabela). Em job barato, refazer < travar.

---

## Diferenças vs versão OpenClaw (nota de port — 2026-06-08) + merge (2026-06-25)
- `sessions_spawn`/`sessions_yield`/`subagents kill` → **Agent tool** (paralelo na mesma mensagem; `run_in_background` quando precisar não travar) ou **Workflow**.
- "Fred" + Telegram → sessão principal do Claude Code reportando ao Eric.
- gpt-image-2 via Codex CLI (VPS) → skill `imagem` do lab **ou** OpenAI Images API direta.
- Paths `/data/.openclaw/...` → workspace local (`C:/tmp/conteudo/<slug>/`).
- HeyGen embutido → skill `video` do lab.
- Modelos `anthropic/claude-...` hardcoded → herda o modelo da sessão (rápido só no Revisor).
- **Merge com squad `conteudo-instagram` (João Ludgério):** trouxe Estrategista formal (Fase 0), checkpoints (aqui adaptativos, não bloqueantes), checklist+escala do Revisor e estrutura de copy de IG. Manteve da skill: paralelismo real, 3 pipelines, deploy Vercel, HeyGen e o protocolo de export Python Playwright.
