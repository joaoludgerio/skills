---
name: criar-webinario
description: Playbook ponta a ponta pra lançar um webinário/live gratuita de tráfego pago da Expert Integrado — da definição do produto até a otimização da próxima edição. Orquestra as skills que já existem (criar-campanha, criar-reel, Nano Banana) e adiciona os passos próprios do funil de webinário: landing page em HTML com teste A/B + pixel, criativos (estático e vídeo), campanha no Meta, sequência de lembretes no WhatsApp, dia da live e análise pós-live. Usar quando o pedido for "cria um webinário", "monta a live", "lança a próxima edição da aula gratuita", "campanha de webinar", ou colar um briefing de live/webinário.
---

# Criar Webinário — funil completo de live gratuita (Expert Integrado)

Pega uma ideia de live/webinário e entrega **tudo pronto pra rodar**: landing page (A/B) com pixel,
criativos, campanha no Meta pausada, sequência de lembretes e o plano de análise pós-live.

> **Por que esta skill existe:** documenta o processo inteiro que foi feito na mão na primeira edição
> (live "Imposto Invisível", jun/2026) pra qualquer pessoa do time conseguir repetir sem o contexto
> todo na cabeça. Cada fase tem o passo a passo + os aprendizados que custaram caro pra descobrir.

## Antes de começar — ler estes references
- `references/funil-e-metricas.md` — benchmarks reais do funil, onde o dinheiro vaza, as alavancas.
- `references/criativo-formula.md` — a fórmula de criativo que converteu (e a que não converteu).
- `references/pixel-e-tracking.md` — o erro de pixel que inflou os leads e como NÃO repetir.
- `references/landing-page-ab.md` — estrutura da LP, como rodar e medir o A/B, hospedagem.
- `references/mensageria-lembretes.md` — sequência de lembretes (a maior alavanca de presença).

## Público-alvo (ICP) — trava
Donos, sócios e diretores de empresa com **mais de 20 funcionários**. A régua de ICP entra na copy do
criativo E na segmentação. Empresa abaixo disso entra no funil mas raramente vira agendamento bom.

---

## Fluxo (8 fases)

### Fase 1 — Definição do webinário
Levantar e travar com o responsável:
- **Tema e promessa** (o que a pessoa sai sabendo/resolvendo). Ângulo que funciona: tirar tarefa
  repetitiva/operacional da empresa usando IA.
- **Oferta do fim da live** (o que é apresentado pra gerar agendamento — ex: Super SDR, mentoria).
- **Data, horário e plataforma** (ex: Zoom). Regra: **janela curta de inscrição** (até 3-4 dias antes
  da live — quem se inscreve com 10 dias esquece e não aparece).
- **Link de inscrição** e **link de agendamento** (Calendly/RD) que aparece no fim da live, com UTM
  (`utm_campaign=webinario`, `utm_source=<tema-da-live>`, `utm_medium=ppt`).
- **Bônus exclusivo pra quem está ao vivo** (material/template entregue só no final) — alavanca de presença.

Saída: um `brief.md` na pasta do webinário com tudo acima.

### Fase 2 — Landing page (HTML + A/B)
Ler `references/landing-page-ab.md`. **A skill (você) gera as LPs em HTML** a partir dos templates
prontos em `templates/` (estrutura validada por pesquisa de LP de alta conversão).
- Copiar `templates/lp.html` e `templates/confirmacao.html`, trocar os tokens `{{ASSIM}}`.
- Gerar `lp-a.html` e `lp-b.html` mudando **só o `{{HEADLINE}}`** (a variável do A/B); resto igual.
- **Formulário enxuto** (cada campo a mais derruba conversão): só nome + WhatsApp + nº de funcionários
  (o qualificador de ICP). Já vem assim no template. Grava a variante (`?lp=a`/`?lp=b`) e os UTMs.
- Deploy: **Cloudflare Pages** ou Vercel → duas URLs públicas. A pág. de confirmação é separada (Fase 3).

### Fase 3 — Pixel & tracking
Ler `references/pixel-e-tracking.md` (lição cara — leitura obrigatória).
- Pixel nas duas variantes da LP: `PageView` no load, evento de **registro só na página de confirmação**.
- **Evento de registro EXCLUSIVO deste funil** (ex: `InscricaoWebinar`), nunca o `Lead` genérico
  compartilhado com outro site — senão um funil contamina o outro (foi o que aconteceu com a biblioteca).
- Criar **Conversão Personalizada por URL** (`URL contém webinario...`) e otimizar/reportar a campanha nela.
- Se houver CAPI server-side, casar o `event_id` pixel↔server pra deduplicar.

### Fase 4 — Criativos (estático + vídeo)
Ler `references/criativo-formula.md`.
- **Vídeos:** usar a skill `criar-reel` (voz Eric no ElevenLabs + lip-sync HeyGen + B-roll do banco).
  Roteiros seguem a fórmula: **abrir com cena concreta** de dor operacional repetitiva (não pergunta
  abstrata), régua de ICP na fala ("mais de vinte funcionários"), **CTA de ad** ("o link tá aqui
  embaixo" — nunca "comenta", isso é orgânico).
- **Estáticos:** usar Nano Banana (`gemini_generate_image`, modelo pro, 9:16/1:1) — testar 1 formato
  estático junto, costuma converter bem em B2B.
- **Lineup enxuto:** 3-4 criativos por conjunto, não 8 (com ~70 leads/edição, mais que isso pulveriza a
  entrega e você não aprende nada).

### Fase 5 — Campanha no Meta
Pode usar a skill `criar-campanha` como base. Estrutura validada:
- **2 conjuntos:** "Público Vencedor 20+" (frio) + "Engajamento 180 dias" (remarketing de quem
  interagiu — costuma ter CPL melhor, mas satura rápido, não escalar demais).
- **Otimização:** na Conversão Personalizada do webinar (Fase 3), não no `Lead` genérico.
- **Conjunto novo a cada edição** → aproveita pra já otimizar na conversão certa (não dá pra trocar
  evento de otimização de conjunto que já está rodando).
- Publicar **pausada** via MCP (`ads_create_*`), revisar e dar play.
- Budget: começar moderado (~R$200-400/dia), escalar só depois de 2-3 dias com CPL real estável
  (subir 20-30% a cada 2-3 dias nos vencedores).

### Fase 6 — Mensageria em grupo / lembretes (maior alavanca de presença)
Ler `references/mensageria-lembretes.md`. Show rate é onde mais se perde gente (80% de no-show na 1ª
edição). Subir presença não custa mídia.
- Sequência de **4 toques no WhatsApp** (via whatsapp-mcp): confirmação na inscrição → lembrete D-1 →
  lembrete 3h antes → "tô entrando agora, vem" no minuto zero.
- Esquenta no dia (story/áudio do Eric de manhã).
- Reforçar o bônus de quem está ao vivo.

### Fase 7 — Dia da live
- Checklist: link do Zoom, slides/ppt com o link de agendamento (UTM `medium=ppt`), bônus à mão.
- O agendamento converte no fim da live — garantir que o CTA de agendar apareça claro e mais de uma vez.

### Fase 8 — Pós-live: análise e otimização
Ler `references/funil-e-metricas.md`. Montar o relatório do funil:
- **Investimento → inscritos → presença ao vivo → agendamentos**, com custo por etapa e CPL real.
- **Show rate**, qualidade ICP dos agendamentos (faixa de funcionários), **ranking dos criativos** por
  CPL (cuidado: dados pré-correção de tracking ficam inflados).
- Decidir: o que **ativar/pausar**, e gerar os **scripts da próxima edição** na fórmula vencedora.
- Cruzar Meta (leads reportados) × inscritos reais (export da plataforma) × pixel (Events Manager) pra
  flagrar qualquer divergência de tracking cedo.

## Saídas (tudo na pasta do webinário)
- `brief.md` — definição (Fase 1).
- `lp-a.html`, `lp-b.html` — landing pages pro deploy.
- `criativos/` — vídeos (criar-reel) + estáticos (Nano Banana).
- Campanha pausada no Meta (link no chat).
- `lembretes.md` — a sequência de WhatsApp pronta pra disparar.
- `analise-pos-live.md` — relatório do funil + plano da próxima edição.

## Skills e MCPs que esta skill usa
- `criar-reel` (vídeos), Nano Banana (estáticos), `criar-campanha` (campanha base).
- MCPs: Meta Ads (`ads_*`), WhatsApp (`whatsapp_*`), biblioteca/plataforma de inscritos.

## Notas
- Tudo na voz do Eric (`criar-reel/references/voz-eric.md`): humano, oral, específico — nunca IA/corporativo.
- Nunca inventar case/número. Conferir antes (regra de fato do `voz-eric.md`).
- CTA de **ad** ≠ CTA orgânico. Ad = aponta link. Orgânico = "comenta X".
